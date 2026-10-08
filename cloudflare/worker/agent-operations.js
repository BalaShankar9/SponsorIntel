import { BOARDS, sourceRequestCost } from "./job-sources.js";
import {
  fetchBoard,
  storeBoardJobs,
  sponsorshipEvidence,
  canonicalJobURL,
} from "./jobs.js";
import { employerLicences } from "./employer-licences.js";
import { sourceDiagnostic } from './source-errors.js';
import { sourceFailureHistory } from '../shared/source-diagnostics.js';

export const OPERATIONS_POLICY = "sources-v1";
const terminal = new Set(["published", "needs_review", "failed", "skipped"]);
const iso = (now = Date.now()) => new Date(now).toISOString();
export class SourceBusy extends Error {}
export class SourceRetry extends Error {}

export async function approvedSources(DB) {
  const extra = await DB.prepare(
    "SELECT b.* FROM employer_boards b WHERE state='approved' AND EXISTS(SELECT 1 FROM sponsors s WHERE s.id=b.sponsor_id AND s.skilled=1 AND s.snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot')) ORDER BY b.id LIMIT 20",
  ).all();
  return [...BOARDS, ...extra.results];
}

export async function dispatchSources(
  env,
  { id, actor = null, sourceId = null, trigger = "owner" },
) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error("Invalid run ID.");
  if (!env.SOURCE_WORKFLOW) throw Error("Source workflow is unavailable.");
  if (
    sourceId &&
    !(await approvedSources(env.DB)).some((b) => b.id === sourceId)
  )
    throw Error("Choose an approved source.");
  // One open run keeps manual requests and scheduled dispatch from multiplying work.
  const open = await env.DB.prepare(
    "SELECT id,state,created_at FROM agent_runs WHERE state IN ('queued','running') LIMIT 1",
  ).first();
  if (open && Date.now() - Date.parse(open.created_at) > 2 * 3600000) {
    // Recover bookkeeping only after the platform confirms execution has ended.
    // A slow or unavailable status service never authorises overlapping work.
    try {
      const status = await (await env.SOURCE_WORKFLOW.get(open.id)).status();
      if (["complete", "errored", "terminated"].includes(status.status)) {
        await env.DB.prepare(
          "UPDATE agent_tasks SET state='failed',error_code='workflow_ended',finished_at=? WHERE run_id=? AND state IN ('queued','running')",
        )
          .bind(iso(), open.id)
          .run();
        await completeRun(env.DB, open.id);
      }
    } catch {
      console.error(
        JSON.stringify({ event: "agent_status_unavailable", run_id: open.id }),
      );
    }
  }
  const existing = await env.DB.prepare(
    "SELECT id,state FROM agent_runs WHERE id=? OR state IN ('queued','running') ORDER BY created_at DESC LIMIT 1",
  )
    .bind(id)
    .first();
  if (existing && existing.id !== id) return { ...existing, reused: true };
  if (existing && !["queued", "dispatch_failed"].includes(existing.state))
    return { ...existing, reused: true };
  const now = iso();
  const row = await env.DB.prepare(
    "INSERT INTO agent_runs(id,trigger_kind,actor,state,created_at,updated_at,source_id) SELECT ?,?,?,'queued',?,?,? WHERE NOT EXISTS(SELECT 1 FROM agent_runs WHERE state IN ('queued','running')) ON CONFLICT(id) DO UPDATE SET state='queued',updated_at=excluded.updated_at WHERE agent_runs.state='dispatch_failed' RETURNING id",
  )
    .bind(id, trigger, actor, now, now, sourceId)
    .first();
  if (!row && !existing) {
    const active = await env.DB.prepare(
      "SELECT id,state FROM agent_runs WHERE state IN ('queued','running') LIMIT 1",
    ).first();
    return { ...active, reused: true };
  }
  try {
    await env.SOURCE_WORKFLOW.create({ id, params: { runId: id } });
  } catch {
    // An uncertain create may have succeeded. Check the same ID, never dispatch a new one.
    try {
      await (await env.SOURCE_WORKFLOW.get(id)).status();
    } catch {
      await env.DB.prepare(
        "UPDATE agent_runs SET state='dispatch_failed',updated_at=?,summary=? WHERE id=? AND state='queued'",
      )
        .bind(
          iso(),
          JSON.stringify({
            error: "Workflow dispatch unconfirmed. Retry this run ID.",
          }),
          id,
        )
        .run();
      throw Error("Workflow dispatch could not be confirmed.");
    }
  }
  return { id, state: "queued", reused: !!existing };
}

export async function initialiseRun(env, runId) {
  const run = await env.DB.prepare("SELECT * FROM agent_runs WHERE id=?")
    .bind(runId)
    .first();
  if (!run || !["queued", "running"].includes(run.state)) return [];
  const existing = await env.DB.prepare(
    "SELECT source_id FROM agent_tasks WHERE run_id=? ORDER BY source_id",
  )
    .bind(runId)
    .all();
  if (existing.results.length) return existing.results.map((t) => t.source_id);
  const boards = (await approvedSources(env.DB)).filter(
    (b) => !run.source_id || run.source_id === b.id,
  );
  const now = iso();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE agent_runs SET state='running',updated_at=? WHERE id=?",
    ).bind(now, runId),
    ...boards.map((b) =>
      env.DB.prepare(
        "INSERT INTO agent_tasks(run_id,source_id,company) VALUES(?,?,?) ON CONFLICT DO NOTHING",
      ).bind(runId, b.id, b.company),
    ),
    env.DB.prepare(
      "UPDATE jobs SET active=0 WHERE board_id IN (SELECT id FROM employer_boards b WHERE state<>'approved' OR NOT EXISTS(SELECT 1 FROM sponsors s WHERE s.id=b.sponsor_id AND s.skilled=1 AND s.snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot')))",
    ),
  ]);
  return boards.map((b) => b.id);
}

export function assessSourceJobs(board, jobs, previousCount) {
  if (!Array.isArray(jobs) || jobs.length > 5000)
    return { code: "invalid_batch", message: "Unexpected source batch size." };
  const ids = new Set(),
    links = new Set();
  for (const j of jobs) {
    const evidence = sponsorshipEvidence(j.description || "");
    if (
      !/^[a-f0-9]{24}$/.test(j.id || "") ||
      j.board_id !== board.id ||
      !j.title ||
      !j.description ||
      !j.location ||
      !canonicalJobURL(j.apply_url) ||
      ids.has(j.id) ||
      links.has(canonicalJobURL(j.apply_url)) ||
      j.company !== board.company ||
      j.provider !== board.provider ||
      j.sponsorship !== evidence.status ||
      j.evidence !== evidence.quote
    )
      return {
        code: "evidence_mismatch",
        message:
          "A record failed identity, duplicate, link or sponsorship-evidence checks.",
      };
    ids.add(j.id);
    links.add(canonicalJobURL(j.apply_url));
  }
  if (
    (previousCount >= 10 && jobs.length === 0) ||
    (previousCount >= 20 && jobs.length < previousCount * 0.4)
  )
    return {
      code: "unexpected_drop",
      message: `Source returned ${jobs.length} UK roles after ${previousCount}. Check whether the feed is complete.`,
    };
  return null;
}

async function finishTask(
  DB,
  runId,
  sourceId,
  state,
  code,
  now,
  evidence = {},
) {
  await DB.batch([
    DB.prepare(
      "UPDATE agent_tasks SET state=?,error_code=?,finished_at=?,evidence=json_patch(COALESCE(evidence,'{}'),?) WHERE run_id=? AND source_id=?",
    ).bind(state, code, iso(now), JSON.stringify(evidence), runId, sourceId),
    DB.prepare("UPDATE agent_runs SET updated_at=? WHERE id=?").bind(
      iso(now),
      runId,
    ),
  ]);
  return { source_id: sourceId, state, error_code: code };
}

export async function executeSourceTask(
  env,
  runId,
  sourceId,
  { readBoard = fetchBoard, now = Date.now() } = {},
) {
  const DB = env.DB;
  let task = await DB.prepare(
    "SELECT t.*,r.created_at,r.requests FROM agent_tasks t JOIN agent_runs r ON r.id=t.run_id WHERE t.run_id=? AND t.source_id=?",
  )
    .bind(runId, sourceId)
    .first();
  if (!task) throw Error("Unknown source task.");
  if (terminal.has(task.state))
    return { source_id: sourceId, state: task.state, replay: true };
  if (now - Date.parse(task.created_at) > 2 * 3600000)
    return finishTask(DB, runId, sourceId, "failed", "run_expired", now);
  const leaseOwner = crypto.randomUUID();
  const lease = await DB.prepare(
    "INSERT INTO feed_locks(name,owner,expires) VALUES('jobs',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE feed_locks.expires<? RETURNING owner",
  )
    .bind(leaseOwner, now + 120000, now)
    .first();
  if (lease?.owner !== leaseOwner)
    throw new SourceBusy("Another source operation is running.");
  try {
    // Another delivery may have completed between our first read and acquisition.
    task = await DB.prepare(
      "SELECT t.*,r.created_at,r.requests FROM agent_tasks t JOIN agent_runs r ON r.id=t.run_id WHERE t.run_id=? AND t.source_id=?",
    )
      .bind(runId, sourceId)
      .first();
    if (terminal.has(task.state))
      return { source_id: sourceId, state: task.state, replay: true };
    const board = (await approvedSources(DB)).find((b) => b.id === sourceId);
    const control = await DB.prepare(
      "SELECT * FROM agent_source_controls WHERE source_id=?",
    )
      .bind(sourceId)
      .first();
    if (!board || control?.paused || control?.cooldown_until > now)
      return finishTask(
        DB,
        runId,
        sourceId,
        "skipped",
        !board
          ? "approval_removed"
          : control.paused
            ? "owner_paused"
            : "source_cooldown",
        now,
      );
    if (task.attempts >= 3)
      return finishTask(DB, runId, sourceId, "failed", "attempt_limit", now);
    // Reserve before fetching. Any uncertain/failing request remains counted.
    const requestCost = sourceRequestCost(board);
    const day = iso(now).slice(0, 10);
    await DB.prepare(
      "INSERT INTO agent_daily_budget(day) VALUES(?) ON CONFLICT DO NOTHING",
    )
      .bind(day)
      .run();
    const reserved = await DB.batch([
      DB.prepare(
        "UPDATE agent_daily_budget SET requests=requests+? WHERE day=? AND requests+?<=500 RETURNING requests",
      ).bind(requestCost, day, requestCost),
      DB.prepare(
        "UPDATE agent_runs SET requests=requests+?,updated_at=? WHERE id=? AND requests+?<=150 RETURNING requests",
      ).bind(requestCost, iso(now), runId, requestCost),
    ]);
    if (reserved.some((r) => !r.results?.length))
      return finishTask(DB, runId, sourceId, "skipped", "request_budget", now);
    await DB.prepare(
      "UPDATE agent_tasks SET state='running',attempts=attempts+1,started_at=?,error_code=NULL WHERE run_id=? AND source_id=?",
    )
      .bind(iso(now), runId, sourceId)
      .run();
    let jobs;
    try {
      jobs = await readBoard(board, {DB, leaseOwner, now});
    } catch (error) {
      const attempts = task.attempts + 1;
      const attemptFailures=[...sourceFailureHistory(task.evidence).filter(x=>x.attempt!==attempts),
        {attempt:attempts,checked_at:iso(now),...sourceDiagnostic(error)}].slice(-3);
      await DB.batch([
        DB.prepare("UPDATE agent_tasks SET evidence=json_patch(COALESCE(evidence,'{}'),?) WHERE run_id=? AND source_id=?")
          .bind(JSON.stringify({attempt_failures:attemptFailures}),runId,sourceId),
        DB.prepare(
          "INSERT INTO agent_source_controls(source_id,updated_at,failures,cooldown_until) VALUES(?,?,1,?) ON CONFLICT(source_id) DO UPDATE SET failures=failures+1,updated_at=excluded.updated_at,cooldown_until=CASE WHEN failures+1>=3 THEN ? ELSE cooldown_until END",
        ).bind(sourceId, iso(now), 0, now + 6 * 3600000),
        DB.prepare(
          "INSERT INTO job_sources(id,company,careers_url,checked_at,count,error) VALUES(?,?,?,?,0,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,error=excluded.error",
        ).bind(
          sourceId,
          board.company,
          board.careers,
          iso(now),
          "Refresh unavailable. Last successful data retained.",
        ),
        DB.prepare(
          "INSERT INTO source_runs(source_id,checked_at,success,count) VALUES(?,?,0,0)",
        ).bind(sourceId, iso(now)),
      ]);
      if (attempts < 3) {
        await DB.prepare(
          "UPDATE agent_tasks SET error_code='fetch_retry' WHERE run_id=? AND source_id=?",
        )
          .bind(runId, sourceId)
          .run();
        throw new SourceRetry("Source fetch failed; bounded retry pending.");
      }
      return finishTask(DB, runId, sourceId, "failed", "fetch_failed", now);
    }
    if (board.provider === 'smartrecruiters' && jobs?.pending === true) {
      const held=await DB.prepare("SELECT owner FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?").bind(leaseOwner,Date.now()+1000).first();
      if(!held)throw new SourceBusy('Source lease expired before progress receipt.');
      await DB.batch([
        DB.prepare("UPDATE job_sources SET checked_at=?,error=NULL WHERE id=? AND EXISTS(SELECT 1 FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?)").bind(iso(now),sourceId,leaseOwner,Date.now()+1000),
        DB.prepare("UPDATE agent_source_controls SET failures=0,cooldown_until=0 WHERE source_id=? AND EXISTS(SELECT 1 FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?)").bind(sourceId,leaseOwner,Date.now()+1000),
      ]);
      return finishTask(DB, runId, sourceId, 'skipped', 'details_pending', now, {collection:jobs.progress});
    }
    const previous = await DB.prepare(
      "SELECT count FROM job_sources WHERE id=?",
    )
      .bind(sourceId)
      .first();
    const issue = assessSourceJobs(board, jobs, previous?.count || 0);
    if (issue) {
      await DB.batch([
        DB.prepare(
          "INSERT INTO agent_reviews(id,run_id,source_id,kind,evidence,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        ).bind(
          `${runId}:${sourceId}`,
          runId,
          sourceId,
          issue.code,
          JSON.stringify({
            message: issue.message,
            previous: previous?.count || 0,
            received: jobs?.length || 0,
            policy: OPERATIONS_POLICY,
          }),
          iso(now),
        ),
        DB.prepare(
          "UPDATE job_sources SET checked_at=?,error='Latest batch held for owner review. Previous snapshot retained.' WHERE id=?",
        ).bind(iso(now), sourceId),
      ]);
      return finishTask(
        DB,
        runId,
        sourceId,
        "needs_review",
        issue.code,
        now,
        issue,
      );
    }
    // Check ownership again after I/O. A late result cannot overwrite a newer operation.
    const held = await DB.prepare(
      "SELECT owner FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?",
    )
      .bind(leaseOwner, Date.now())
      .first();
    if (!held) throw new SourceBusy("Source lease expired before publication.");
    const licences = await employerLicences(DB, board.state ? [board] : []);
    const evidence = {
      policy: OPERATIONS_POLICY,
      checked_at: iso(now),
      received: jobs.length,
      sponsorship_worded: jobs.filter((j) =>
        ["offered", "conditional"].includes(j.sponsorship),
      ).length,
      register_available: licences.register.available,
      licence_id: licences.matches.get(sourceId)?.id || null,
      licence_is_not_vacancy_sponsorship: true,
      duplicate_ids: 0,
      duplicate_links: 0,
      ...(jobs.collection ? {collection:jobs.collection} : {}),
      ...(["university-rss","teaching-vacancies"].includes(board.provider) && jobs.feed_review ? {feed_review:jobs.feed_review} : {}),
      ...(sourceFailureHistory(task.evidence).length ? {attempt_failures:sourceFailureHistory(task.evidence)} : {}),
    };
    // Publication and receipt are one transaction: replay cannot repeat a committed publication.
    await storeBoardJobs(
      DB,
      board,
      jobs,
      iso(now),
      [
        DB.prepare(
          "UPDATE agent_tasks SET state='published',count=?,evidence=?,error_code=NULL,finished_at=? WHERE run_id=? AND source_id=?",
        ).bind(
          jobs.length,
          JSON.stringify(evidence),
          iso(now),
          runId,
          sourceId,
        ),
        DB.prepare(
          "INSERT INTO source_runs(source_id,checked_at,success,count) VALUES(?,?,1,?)",
        ).bind(sourceId, iso(now), jobs.length),
        DB.prepare(
          "UPDATE agent_source_controls SET failures=0,cooldown_until=0 WHERE source_id=?",
        ).bind(sourceId),
        DB.prepare(
          "UPDATE agent_reviews SET state='resolved',resolved_at=? WHERE source_id=? AND state='open'",
        ).bind(iso(now), sourceId),
        DB.prepare("UPDATE agent_runs SET updated_at=? WHERE id=?").bind(
          iso(now),
          runId,
        ),
        DB.prepare("DELETE FROM agent_write_guard WHERE singleton=1"),
      ],
      DB.prepare(
        "INSERT OR REPLACE INTO agent_write_guard(singleton,held) VALUES(1,(SELECT COUNT(*) FROM feed_locks WHERE name='jobs' AND owner=? AND expires>CAST(strftime('%s','now') AS INTEGER)*1000+1000))",
      ).bind(leaseOwner),
    );
    return { source_id: sourceId, state: "published", count: jobs.length };
  } finally {
    await DB.prepare("DELETE FROM feed_locks WHERE name='jobs' AND owner=?")
      .bind(leaseOwner)
      .run();
  }
}

export async function markTaskFailure(DB, runId, sourceId) {
  await DB.prepare(
    "UPDATE agent_tasks SET state='failed',error_code='execution_failed',finished_at=? WHERE run_id=? AND source_id=? AND state IN ('queued','running')",
  )
    .bind(iso(), runId, sourceId)
    .run();
}

export async function completeRun(DB, runId) {
  const rows = (
    await DB.prepare(
      "SELECT state,COUNT(*) count FROM agent_tasks WHERE run_id=? GROUP BY state",
    )
      .bind(runId)
      .all()
  ).results;
  const counts = Object.fromEntries(rows.map((r) => [r.state, r.count]));
  const staged = (await DB.prepare("SELECT COUNT(*) n FROM agent_tasks WHERE run_id=? AND state='skipped' AND error_code='details_pending'").bind(runId).first())?.n || 0;
  if (staged) { counts.collecting = staged; counts.skipped -= staged; }
  const unfinished = (counts.queued || 0) + (counts.running || 0);
  const state = unfinished
    ? "failed"
    : counts.failed || counts.needs_review || counts.skipped
      ? "attention"
      : rows.length
        ? "completed"
        : "attention";
  await DB.prepare(
    "UPDATE agent_runs SET state=?,summary=?,finished_at=?,updated_at=? WHERE id=?",
  )
    .bind(state, JSON.stringify(counts), iso(), iso(), runId)
    .run();
  return { state, counts };
}

export async function setSourcePause(DB, sourceId, paused, actor, reason) {
  if (!(await approvedSources(DB)).some((b) => b.id === sourceId))
    throw Error("Choose an approved source.");
  if (
    typeof paused !== "boolean" ||
    typeof reason !== "string" ||
    reason.trim().length < 8 ||
    reason.length > 500
  )
    throw Error("Add a short reason for this change.");
  const owner = crypto.randomUUID(),
    now = Date.now();
  const lease = await DB.prepare(
    "INSERT INTO feed_locks(name,owner,expires) VALUES('jobs',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE feed_locks.expires<? RETURNING owner",
  )
    .bind(owner, now + 30000, now)
    .first();
  if (lease?.owner !== owner)
    throw new SourceBusy(
      "A source refresh is running. Try again when it completes.",
    );
  try {
    await DB.batch([
      DB.prepare(
        "INSERT INTO agent_source_controls(source_id,paused,reason,updated_at,actor) VALUES(?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET paused=excluded.paused,reason=excluded.reason,updated_at=excluded.updated_at,actor=excluded.actor,failures=0,cooldown_until=0",
      ).bind(sourceId, paused ? 1 : 0, reason.trim(), iso(now), actor),
      ...(paused
        ? [
            DB.prepare("UPDATE jobs SET active=0 WHERE board_id=?").bind(
              sourceId,
            ),
            DB.prepare(
              "UPDATE job_sources SET count=0,error='Paused by owner. Vacancies hidden.' WHERE id=?",
            ).bind(sourceId),
          ]
        : []),
      DB.prepare(
        "INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)",
      ).bind(
        actor,
        paused ? "agent_source_paused" : "agent_source_resumed",
        sourceId,
        iso(now),
      ),
    ]);
  } finally {
    await DB.prepare("DELETE FROM feed_locks WHERE name='jobs' AND owner=?")
      .bind(owner)
      .run();
  }
}

export async function operationsSnapshot(env) {
  const DB = env.DB,
    now = Date.now(),
    day = iso(now).slice(0, 10);
  const sources = await approvedSources(DB);
  const results = await DB.batch([
    DB.prepare("SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 15"),
    DB.prepare(
      "SELECT * FROM agent_tasks WHERE run_id=(SELECT id FROM agent_runs ORDER BY created_at DESC LIMIT 1) ORDER BY company",
    ),
    DB.prepare("SELECT * FROM agent_source_controls"),
    DB.prepare(
      "SELECT id,run_id,source_id,kind,evidence,state,created_at FROM agent_reviews WHERE state='open' ORDER BY created_at DESC LIMIT 50",
    ),
    DB.prepare(
      "SELECT requests,briefs FROM agent_daily_budget WHERE day=?",
    ).bind(day),
    DB.prepare("SELECT id,company,count,last_success,error FROM job_sources"),
    DB.prepare(
      "SELECT id,created_at,model,output FROM agent_briefs ORDER BY created_at DESC LIMIT 1",
    ),
    DB.prepare('SELECT * FROM source_collection_progress'),
    // Bound the history to the same recent runs shown by the owner dashboard.
    DB.prepare("SELECT t.run_id,t.source_id,t.company,t.state,t.error_code,t.evidence,r.created_at FROM agent_tasks t JOIN agent_runs r ON r.id=t.run_id WHERE t.run_id IN (SELECT id FROM agent_runs ORDER BY created_at DESC LIMIT 15) AND (json_array_length(t.evidence,'$.attempt_failures')>0 OR t.error_code IN ('fetch_retry','fetch_failed','execution_failed','workflow_ended')) ORDER BY r.created_at DESC,t.source_id LIMIT 10"),
  ]);
  const [runs, tasks, controls, reviews, budget, health, briefs, progress, diagnostics] = results.map(
    (r) => r.results || [],
  );
  const licences = await employerLicences(
    DB,
    sources.filter((b) => b.state),
  );
  return {
    measured_at: iso(now),
    policy: OPERATIONS_POLICY,
    enabled: !!env.SOURCE_WORKFLOW,
    runs: runs.map(({ actor, ...r }) => ({
      ...r,
      summary: r.summary ? JSON.parse(r.summary) : null,
    })),
    tasks: tasks.map((t) => ({
      ...t,
      evidence: t.evidence ? JSON.parse(t.evidence) : null,
    })),
    diagnostics: diagnostics.map(({evidence,...task})=>({...task,attempt_failures:sourceFailureHistory(evidence)})),
    sources: sources.map((b) => ({
      id: b.id,
      company: b.company,
      careers: b.careers,
      ...health.find((h) => h.id === b.id),
      collection: progress.find(p=>p.source_id===b.id) || null,
      paused: !!controls.find((c) => c.source_id === b.id)?.paused,
      cooldown_until:
        controls.find((c) => c.source_id === b.id)?.cooldown_until || 0,
      licence_linked: licences.matches.has(b.id),
    })),
    reviews: reviews.map((r) => ({ ...r, evidence: JSON.parse(r.evidence) })),
    budget: {
      day,
      requests: budget[0]?.requests || 0,
      request_limit: 500,
      briefs: budget[0]?.briefs || 0,
      brief_limit: 2,
    },
    latest_brief: briefs[0]
      ? { ...briefs[0], output: JSON.parse(briefs[0].output) }
      : null,
    register: licences.register,
    linkedin: { state: "access_required", connected: false },
  };
}
