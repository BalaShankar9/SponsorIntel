import pages from "../shared/pages.json" with { type: "json" };
import { bodyJSON, limit, reply, sameOrigin } from "./auth.js";
const routes = new Set([
  ...Object.values(pages).map((p) => p.path),
  "/signin",
  "/signup",
  "/account",
  "/career-profile",
  "/studio",
  "/applications",
  "/saved",
  "/settings",
  "/employer-notes",
  '/insights',
  '/insights/uk-sponsorship-jobs-report',
]);
export function metricRoute(path) {
  if (typeof path !== "string") return null;
  const clean = path.split(/[?#]/)[0];
  if (/^\/jobs\/[a-f0-9]{24}$/.test(clean)) return "/jobs/:id";
  return routes.has(clean) ? clean : null;
}
export async function recordMetric(env, event, dimension = "") {
  await env.DB.prepare(
    "INSERT INTO analytics_daily(day,event,dimension,count) VALUES(?,?,?,1) ON CONFLICT(day,event,dimension) DO UPDATE SET count=count+1",
  )
    .bind(new Date().toISOString().slice(0, 10), event, dimension)
    .run();
}
export function responseMetric(path, method, status) {
  if (method !== "POST" || status < 200 || status >= 300) return null;
  return (
    {
      "/api/auth/sign-up/email": "account_created",
      "/api/auth/sign-in/email": "sign_in",
      "/api/career/generate": "application_generated",
      "/api/chat": "guidance_answer",
      "/api/feedback": "feedback_sent",
    }[path] || null
  );
}
export async function analyticsAPI(request, env) {
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  if (!sameOrigin(request)) return reply({ error: "Use Sponsor Intel." }, 403);
  let body;
  try {
    body = await bodyJSON(request, 512);
  } catch {
    return reply({ error: "Invalid event" }, 400);
  }
  const route = metricRoute(body?.page);
  if (!route) return reply({ error: "Invalid page" }, 400);
  if (
    !(await limit(
      env,
      "page-event:" + (request.headers.get("CF-Connecting-IP") || "local"),
      120,
    ))
  )
    return reply({ error: "Event limit reached" }, 429);
  await recordMetric(env, "page_view", route);
  return reply({ ok: true });
}
