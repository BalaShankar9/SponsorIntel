import { sessionFor, reply, bodyJSON, sameOrigin, limit } from "./auth.js";
import { BOARDS, SECTORS } from "./job-sources.js";
import { fetchBoard } from "./jobs.js";
import { refreshStudents } from "./study.js";
import { agentOperationsAPI } from "./agent-api.js";
import { businessAPI } from './business-operations.js';
export async function ownerFor(request, env) {
  const session = await sessionFor(request, env);
  if (!session?.user) return null;
  const role = await env.DB.prepare(
    "SELECT user_id FROM admin_members WHERE user_id=?",
  )
    .bind(session.user.id)
    .first();
  return role ? session : null;
}
export function validateBoard(body) {
  if (!body || typeof body !== "object")
    throw Error("Enter the employer details.");
  const clean = (key, max) =>
    typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
  const value = {
    company: clean("company", 150),
    provider: clean("provider", 20),
    board: clean("board", 80),
    careers: clean("careers", 500),
    sector: clean("sector", 30),
    sponsor_id: clean("sponsor_id", 24),
    evidence: clean("evidence", 1200),
  };
  if (
    !value.company ||
    !["greenhouse", "lever", "ashby"].includes(value.provider) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(value.board) ||
    !Object.hasOwn(SECTORS, value.sector) ||
    !/^[a-f0-9]{24}$/.test(value.sponsor_id) ||
    value.evidence.length < 30
  )
    throw Error(
      "Add a supported board, sector, sponsor record ID and the evidence linking the employer to this board.",
    );
  let url;
  try {
    url = new URL(value.careers);
  } catch {
    throw Error("Enter the official HTTPS careers page.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
    /(^|\.)(localhost|local|internal)$/.test(url.hostname)
  )
    throw Error("Enter the public HTTPS careers page.");
  value.careers = url.href;
  if (
    BOARDS.some(
      (b) =>
        b.provider === value.provider &&
        b.board.toLowerCase() === value.board.toLowerCase(),
    )
  )
    throw Error("This board is already monitored.");
  value.id = "reviewed-" + value.provider + "-" + value.board.toLowerCase();
  return value;
}
async function audit(env, owner, action, target) {
  return env.DB.prepare(
    "INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)",
  )
    .bind(owner.user.id, action, target, new Date().toISOString())
    .run();
}
export async function adminAPI(request, env) {
  const owner = await ownerFor(request, env);
  if (!owner) return reply({ error: "The owner account is required." }, 403);
  const url = new URL(request.url),
    path = url.pathname;
  if (path === '/api/admin/business' || path.startsWith('/api/admin/business/'))
    return businessAPI(request, env, owner);
  if (path === '/api/admin/agents' || path.startsWith('/api/admin/agents/'))
    return agentOperationsAPI(request, env, owner);
  if (path === "/api/admin/session" && request.method === "GET")
    return reply({ owner: true });
  if (path === "/api/admin/refresh-students" && request.method === "POST") {
    if (!sameOrigin(request))
      return reply({ error: "Use the owner dashboard." }, 403);
    if (!(await limit(env, "owner-students:" + owner.user.id, 3)))
      return reply({ error: "Please try later." }, 429);
    return reply(await refreshStudents(env));
  }
  if (request.method === "GET" && path === "/api/admin/dashboard") {
    const days = [7, 30, 90].includes(Number(url.searchParams.get("days")))
      ? Number(url.searchParams.get("days"))
      : 30;
    const start = new Date(Date.now() - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    const userPage = Math.max(
      1,
      Math.min(10000, parseInt(url.searchParams.get("page") || "1") || 1),
    );
    const results = await env.DB.batch([
      env.DB.prepare(
        "SELECT COUNT(*) total,COALESCE(SUM(createdAt>=?),0) new_users FROM user",
      ).bind(Date.parse(start)),
      env.DB.prepare(
        "SELECT COUNT(DISTINCT userId) count FROM session WHERE expiresAt>? AND max(createdAt,updatedAt)>=?",
      ).bind(Date.now(), Date.parse(start)),
      env.DB.prepare(
        "SELECT day,event,dimension,count FROM analytics_daily WHERE day>=? ORDER BY day",
      ).bind(start),
      env.DB.prepare("SELECT MIN(day) started FROM analytics_daily"),
      env.DB.prepare(
        "SELECT u.id,u.name,u.email,u.emailVerified,u.createdAt,(SELECT MAX(max(s.createdAt,s.updatedAt)) FROM session s WHERE s.userId=u.id) last_session,w.updated_at workspace_updated FROM user u LEFT JOIN career_workspaces w ON w.user_id=u.id ORDER BY u.createdAt DESC LIMIT 25 OFFSET ?",
      ).bind((userPage - 1) * 25),
      env.DB.prepare(
        "SELECT id,company,careers_url,checked_at,last_success,count,error FROM job_sources ORDER BY company",
      ),
      env.DB.prepare(
        "SELECT id,title,url,checked_at,last_success,error,withdrawn FROM immigration_sources ORDER BY title",
      ),
      env.DB.prepare(
        "SELECT key,value FROM metadata WHERE key IN ('register','adviser_dataset','students')",
      ),
      env.DB.prepare(
        "SELECT id,kind,message,created_at,context,app_version FROM feedback ORDER BY created_at DESC LIMIT 50",
      ),
      env.DB.prepare(
        "SELECT id,company,provider,board,careers,sector,sponsor_id,evidence,state,created_at,reviewed_at FROM employer_boards ORDER BY created_at DESC LIMIT 100",
      ),
      env.DB.prepare(
        "SELECT source_id,checked_at,success,count FROM source_runs ORDER BY checked_at DESC LIMIT 60",
      ),
      env.DB.prepare(
        "SELECT COUNT(*) total,COALESCE(SUM(sponsorship IN ('offered','conditional')),0) sponsorship FROM jobs WHERE active=1 AND last_seen>=?",
      ).bind(new Date(Date.now() - 3 * 86400000).toISOString()),
    ]);
    const rows = results.map((r) => r.results || []);
    return reply({
      days,
      start,
      measured_at: new Date().toISOString(),
      users: {
        ...rows[0][0],
        active_sessions: rows[1][0]?.count || 0,
        page: userPage,
        items: rows[4],
      },
      metrics: rows[2],
      tracking_started: rows[3][0]?.started || null,
      job_sources: rows[5],
      immigration_sources: rows[6],
      metadata: Object.fromEntries(
        rows[7].map((r) => [r.key, JSON.parse(r.value)]),
      ),
      feedback: rows[8],
      boards: rows[9],
      runs: rows[10],
      jobs: rows[11][0],
    });
  }
  if (request.method !== "POST" || path !== "/api/admin/boards")
    return reply({ error: "Not found" }, 404);
  if (!sameOrigin(request))
    return reply({ error: "Use the owner dashboard." }, 403);
  if (!(await limit(env, "owner-boards:" + owner.user.id, 20)))
    return reply({ error: "Please try again later." }, 429);
  let body;
  try {
    body = await bodyJSON(request, 5000);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
  try {
    if (body.action === "add") {
      const b = validateBoard(body);
      const existing = await env.DB.prepare(
        "SELECT COUNT(*) count FROM employer_boards",
      ).first();
      if (existing.count >= 100)
        return reply(
          { error: "Review the current source list before expanding further." },
          409,
        );
      const sponsor = await env.DB.prepare(
        "SELECT name FROM sponsors WHERE id=? AND snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot') AND skilled=1",
      )
        .bind(b.sponsor_id)
        .first();
      if (!sponsor)
        return reply(
          { error: "Choose a current Skilled Worker sponsor record." },
          400,
        );
      const duplicate = await env.DB.prepare(
        "SELECT id FROM employer_boards WHERE id=?",
      )
        .bind(b.id)
        .first();
      if (duplicate)
        return reply(
          { error: "This source is already in your review queue." },
          409,
        );
      await env.DB.prepare(
        "INSERT INTO employer_boards(id,company,provider,board,careers,sector,sponsor_id,evidence,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          b.id,
          b.company,
          b.provider,
          b.board,
          b.careers,
          b.sector,
          b.sponsor_id,
          b.evidence,
          new Date().toISOString(),
        )
        .run();
      await audit(env, owner, "source_added", b.id);
      return reply({
        ok: true,
        message:
          "Added to review. Check the legal employer, official careers link and board before approving.",
      });
    }
    if (
      !["approve", "pause"].includes(body.action) ||
      typeof body.id !== "string"
    )
      throw Error("Choose a source and action.");
    const b = await env.DB.prepare("SELECT * FROM employer_boards WHERE id=?")
      .bind(body.id)
      .first();
    if (!b) return reply({ error: "Source not found" }, 404);
    if (body.action === "approve") {
      if (body.confirmed !== true)
        throw Error(
          "Confirm that you checked the official careers page and legal employer.",
        );
      const count = await env.DB.prepare(
        "SELECT COUNT(*) count FROM employer_boards WHERE state='approved' AND id<>?",
      )
        .bind(b.id)
        .first();
      if (count.count >= 20)
        throw Error(
          "The extra-board limit is 20. Pause an unused board before adding another.",
        );
      const sponsor = await env.DB.prepare(
        "SELECT id FROM sponsors WHERE id=? AND snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot') AND skilled=1",
      )
        .bind(b.sponsor_id)
        .first();
      if (!sponsor)
        throw Error(
          "The sponsor is no longer in the current Skilled Worker snapshot. Re-check it.",
        );
      await fetchBoard(b); // Probe only a fixed, supported ATS endpoint. Never the submitted URL.
    }
    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare(
        "UPDATE employer_boards SET state=?,reviewed_at=?,reviewed_by=? WHERE id=?",
      ).bind(
        body.action === "approve" ? "approved" : "paused",
        now,
        owner.user.id,
        b.id,
      ),
    ];
    let pauseOwner = null;
    if (body.action === "pause") {
      pauseOwner = crypto.randomUUID();
      const lock = await env.DB.prepare(
        "INSERT INTO feed_locks(name,owner,expires) VALUES('jobs',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE feed_locks.expires<? RETURNING owner",
      )
        .bind(pauseOwner, Date.now() + 30000, Date.now())
        .first();
      if (lock?.owner !== pauseOwner)
        return reply(
          {
            error:
              "The employer refresh is running. Wait for it to finish, then pause this source.",
          },
          409,
        );
      statements.push(
        env.DB.prepare("UPDATE jobs SET active=0 WHERE board_id=?").bind(b.id),
        env.DB.prepare(
          "UPDATE job_sources SET count=0,error=? WHERE id=?",
        ).bind("Paused by the owner. Vacancies hidden.", b.id),
      );
    }
    try {
      await env.DB.batch(statements);
    } finally {
      if (pauseOwner)
        await env.DB.prepare(
          "DELETE FROM feed_locks WHERE name='jobs' AND owner=?",
        )
          .bind(pauseOwner)
          .run();
    }
    await audit(env, owner, "source_" + body.action, b.id);
    return reply({
      ok: true,
      message:
        body.action === "approve"
          ? "Approved. The next six-hour refresh will import current UK vacancies."
          : "Paused. Its vacancies have been removed from discovery.",
    });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update this source.",
      },
      400,
    );
  }
}
