import {runRegisterRefresh} from './register-refresh.js';
import {
  clean,
  querySpec,
} from "./data.js";
import { jobsAPI } from "./jobs.js";
import { dispatchSources } from "./agent-operations.js";
import { researchRetentionStatement } from './research-reference.js';
export { SourceWorkflow } from "./source-workflow.js";
export { ResearchWorkflow } from './research-workflow.js';
export { BusinessWorkflow } from './business-workflow.js';
export { MarketingWorkflow } from './marketing-workflow.js';
export {ApplicationEvaluationWorkflow} from './application-evaluation-workflow.js';
import { dispatchBusiness } from './business-operations.js';
import { scanSearchNotifications } from './search-notifications.js';
import { scanOperationAlerts } from './operation-alerts.js';
import {consumeEmailEvents} from './email-events.js';
import { immigrationAPI, refreshImmigration } from "./immigration.js";
import { authAPI, recoverAccount, digest, reply, sameOrigin } from "./auth.js";
import { careerAPI } from "./career.js";
import { pageResponse } from "./pages.js";
import { feedbackAPI } from "./feedback.js";
import { adminAPI } from "./admin.js";
import { advisersAPI, checkAdviserDataset } from "./advisers.js";
import { chatAPI } from "./chat.js";
import { analyticsAPI, recordResponseMetrics, responseMetric, PREPARATION_HEADER, GUIDANCE_HEADER } from "./analytics.js";
import { studyAPI, refreshStudents } from "./study.js";
import { getSponsorCities } from './sponsor-cities.js';
const FEATURED = [
  "Google (UK) Limited",
  "Deloitte LLP",
  "Microsoft Limited",
  "Barclays Bank PLC",
  "Accenture (UK) Limited",
  "The University of Manchester",
  "University College London",
  "Amazon UK Services Ltd",
];
const parse = (r) => ({
  ...r,
  routes: JSON.parse(r.routes),
  ratings: JSON.parse(r.ratings),
});
const json = (data, status = 200, extra = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
async function getMeta(env) {
  const row = await env.DB.prepare(
    "SELECT value FROM metadata WHERE key='register'",
  ).first();
  return row ? JSON.parse(row.value) : null;
}
async function api(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith("/api/auth/")) return authAPI(request, env);
  if (path === "/api/recover" && request.method === "POST")
    return recoverAccount(request, env);
  if (path.startsWith("/api/career/")) return careerAPI(request, env);
  if (path === "/api/updates" && ["GET", "HEAD"].includes(request.method))
    return immigrationAPI(env);
  if (
    path.startsWith("/api/jobs") &&
    (request.method === "GET" || request.method === "HEAD")
  )
    return jobsAPI(url, env);
  if (
    ["/api/admin/refresh-jobs", "/api/admin/refresh-updates"].includes(path) &&
    request.method === "POST"
  ) {
    const supplied =
      request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (
      !env.ADMIN_TOKEN ||
      !(await crypto.subtle.timingSafeEqual(
        new TextEncoder().encode(await digest(supplied)),
        new TextEncoder().encode(await digest(env.ADMIN_TOKEN)),
      ))
    )
      return reply({ error: "Not authorised" }, 401);
    return reply(
      path.endsWith("refresh-updates")
        ? await refreshImmigration(env)
        : await dispatchSources(env, { id: 'operator-' + crypto.randomUUID(), trigger: 'operator' }),
    );
  }
  if (path === "/api/feedback") return feedbackAPI(request, env);
  if (
    path === "/api/study/sponsors" &&
    ["GET", "HEAD"].includes(request.method)
  )
    return studyAPI(url, env);
  if (path === "/api/advisers" && ["GET", "HEAD"].includes(request.method))
    return advisersAPI(url, env);
  if (path === "/api/chat") return chatAPI(request, env);
  if (path === "/api/metrics") return analyticsAPI(request, env);
  if (path.startsWith("/api/admin/")) return adminAPI(request, env);
  if (request.method !== "GET" && request.method !== "HEAD")
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD" });
  const meta = await getMeta(env);
  if (path === "/api/health")
    return json(
      {
        ok: !!meta,
        version: env.APP_VERSION,
        register: meta
          ? {
              date: meta.source_date,
              count: meta.employers,
              checked_at: meta.checked_at,
            }
          : null,
      },
      meta ? 200 : 503,
    );
  if (!meta)
    return json(
      {
        error:
          "The official register is being prepared. Please try again shortly.",
      },
      503,
    );
  if (path === "/api/meta") return json(meta);
  if (path === '/api/sponsor-cities') {
    try { return json(await getSponsorCities(env, url.search)); }
    catch { return json({error:'The register could not be loaded. Please try again.'},503); }
  }
  if (path === "/api/sponsors") {
    const { q, city, route, page, where, values } = querySpec(url.searchParams);
    const bindings = [meta.snapshot, ...values];
    const sort = url.searchParams.get("sort") === "za" ? "DESC" : "ASC";
    const limit = 12;
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM sponsors WHERE " + where,
    )
      .bind(...bindings)
      .first();
    let result = await env.DB.prepare(
      "SELECT id,name,city,county,ratings,routes FROM sponsors WHERE " +
        where +
        " ORDER BY name COLLATE NOCASE " +
        sort +
        ",id LIMIT ? OFFSET ?",
    )
      .bind(...bindings, limit, (page - 1) * limit)
      .all();
    return json({
      items: result.results.map(parse),
      total: count.total,
      page,
      pages: Math.ceil(count.total / limit),
      source_date: meta.source_date,
    });
  }
  if (path === "/api/featured") {
    const result = await env.DB.prepare(
      "SELECT id,name,city,county,ratings,routes FROM sponsors WHERE snapshot=? AND name COLLATE NOCASE IN (" +
        FEATURED.map(() => "?").join(",") +
        ") ORDER BY CASE name " +
        FEATURED.map((_, i) => "WHEN ? THEN " + i).join(" ") +
        " END LIMIT 8",
    )
      .bind(meta.snapshot, ...FEATURED, ...FEATURED)
      .all();
    return json({ items: result.results.map(parse) });
  }
  if (path === "/api/cities") {
    const q = clean(url.searchParams.get("q")).slice(0, 60);
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    const result = await env.DB.prepare(
      "SELECT city,COUNT(*) count FROM sponsors WHERE snapshot=? AND city<>'' AND city LIKE ? ESCAPE '\\' GROUP BY city COLLATE NOCASE ORDER BY count DESC LIMIT 80",
    )
      .bind(meta.snapshot, escaped + "%")
      .all();
    return json(result.results);
  }
  if (path.startsWith("/api/sponsors/")) {
    const id = path.split("/").pop();
    if (!/^[a-f0-9]{24}$/.test(id))
      return json({ error: "Employer not found" }, 404);
    const row = await env.DB.prepare(
      "SELECT id,name,city,county,ratings,routes FROM sponsors WHERE snapshot=? AND id=?",
    )
      .bind(meta.snapshot, id)
      .first();
    return row
      ? json({
          ...parse(row),
          source_date: meta.source_date,
          source_url: meta.source_url,
        })
      : json(
          {
            error:
              "This employer is not listed in our current register snapshot. Check the official register.",
          },
          404,
        );
  }
  return json({ error: "Not found" }, 404);
}

const security = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
};
export default {
  async queue(batch,env){await consumeEmailEvents(batch,env);},
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      let response = url.pathname.startsWith("/api/")
        ? await api(request, env)
        : await pageResponse(request, env);
      response = new Response(
        request.method === "HEAD" ? null : response.body,
        response,
      );
      for (const [k, v] of Object.entries(security))
        response.headers.set(
          k,
          k === "Referrer-Policy" &&
            (url.pathname === "/reset-password" ||
              url.pathname.startsWith("/api/auth/"))
            ? "no-referrer"
            : v,
        );
      const metric = responseMetric(
        url.pathname,
        request.method,
        response.status,
        response.headers.get(PREPARATION_HEADER),
        response.headers.get(GUIDANCE_HEADER),
      );
      if (metric)
        ctx.waitUntil(
          recordResponseMetrics(env, request, response).catch(() =>
            console.error("Aggregate metric unavailable"),
          ),
        );
      response.headers.delete(PREPARATION_HEADER);
      response.headers.delete(GUIDANCE_HEADER);
      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          message: /^\/api\/(auth|career|recover|admin|chat)(\/|$)/.test(
            new URL(request.url).pathname,
          )
            ? "Private endpoint failed"
            : error instanceof Error
              ? error.message
              : "Unknown error",
        }),
      );
      return json(
        { error: "We could not load this right now. Please try again." },
        500,
      );
    }
  },
  async scheduled(event, env, ctx) {
    if (event.cron === '45 * * * *') {
      console.log(JSON.stringify({event:'business_operations',...(await dispatchBusiness(env,event.scheduledTime,'scheduled'))}));
      return;
    }
    if (event.cron === "*/15 * * * *") {
      const results=await Promise.allSettled([refreshImmigration(env),scanSearchNotifications(env),scanOperationAlerts(env)]);
      for (const [i,result] of results.entries()) console.log(JSON.stringify({
        event:['immigration_refresh','search_notifications','operation_alerts'][i],
        ...(result.status==='fulfilled'?result.value:{state:'failed'})
      }));
      if (results.some(r=>r.status==='rejected')) throw Error('A scheduled refresh failed.');
      return;
    }
    if (event.cron === "30 */6 * * *") {
      const result = await dispatchSources(env, { id: 'scheduled-' + event.scheduledTime, trigger: 'scheduled' });
      await env.DB.prepare("DELETE FROM ai_usage WHERE expires<?")
        .bind(Date.now())
        .run();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM analytics_daily WHERE day<?").bind(
          new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        ),
        env.DB.prepare("DELETE FROM analytics_public_daily WHERE day<?").bind(
          new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        ),
        env.DB.prepare("DELETE FROM analytics_evidence_daily WHERE day<?").bind(
          new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
        ),
        env.DB.prepare("DELETE FROM source_runs WHERE checked_at<?").bind(
          new Date(Date.now() - 30 * 86400000).toISOString(),
        ),
        env.DB.prepare("DELETE FROM agent_runs WHERE state IN ('completed','attention','failed','dispatch_failed') AND created_at<?").bind(new Date(Date.now()-30*86400000).toISOString()),
        env.DB.prepare("DELETE FROM agent_reviews WHERE state<>'open' AND resolved_at<?").bind(new Date(Date.now()-90*86400000).toISOString()),
        env.DB.prepare("DELETE FROM agent_briefs WHERE created_at<?").bind(new Date(Date.now()-30*86400000).toISOString()),
        env.DB.prepare("DELETE FROM agent_daily_budget WHERE day<?").bind(new Date(Date.now()-30*86400000).toISOString().slice(0,10)),
        researchRetentionStatement(env.DB,new Date(Date.now()-30*86400000).toISOString()),
        env.DB.prepare("DELETE FROM agent_research_memory WHERE expires_at<?").bind(new Date().toISOString()),
        env.DB.prepare("DELETE FROM agent_research_budget WHERE day<?").bind(new Date(Date.now()-30*86400000).toISOString().slice(0,10)),
      ]);
      console.log(JSON.stringify({ event: "jobs_refresh", sources: result }));
      return;
    }
    await checkAdviserDataset(env);
    await refreshStudents(env);
    await runRegisterRefresh(env);
  },
};
