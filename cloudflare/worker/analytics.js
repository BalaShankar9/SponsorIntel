import pages from "../shared/pages.json" with { type: "json" };
import { bodyJSON, limit, reply, sameOrigin, sessionFor } from "./auth.js";
import { boundedText } from './data.js';
import { campaignById, campaigns } from '../shared/campaigns.js';
const campaignEvents = new Set(['page_view', 'account_created', 'sign_in', 'document_prepared', 'preparation_completed', 'guidance_answer', 'guidance_followup', 'feedback_sent']);
export const PREPARATION_HEADER = 'X-SI-Preparation-Kind';
export const GUIDANCE_HEADER = 'X-SI-Guidance-Status';
const documentKinds = new Set(['cv', 'coverLetter']);
const preparationKinds = new Set(['analysis', 'companyResearch', 'interview', 'portfolio', 'learningPlan']);
const DAY = 86400000;
export const MEASUREMENT_LIMIT = 'Known signed-in owners and declared QA requests are excluded. Signed-out operators, repeat visits and bots may still be included. Counts are not unique people, conversions, saved files, submitted applications or job outcomes.';

export async function publicMeasurement(env, now = Date.now(), days = 14) {
  const row = await env.DB.prepare("SELECT value FROM metadata WHERE key='analytics_v2'").first();
  const enabled = row ? JSON.parse(row.value).enabled_at : null;
  const today = new Date(now).toISOString().slice(0, 10);
  const valid = typeof enabled === 'string' && Number.isFinite(Date.parse(enabled)) && Date.parse(enabled) <= now;
  const firstFullDay = valid ? new Date(Date.parse(enabled.slice(0, 10)) + DAY).toISOString().slice(0, 10) : null;
  const windowStart = new Date(now - days * DAY).toISOString().slice(0, 10);
  const from = firstFullDay && firstFullDay > windowStart ? firstFullDay : windowStart;
  return { version: 2, enabled_at: valid ? enabled : null, first_full_day: firstFullDay,
    completed_days: valid ? Math.max(0, (Date.parse(today) - Date.parse(from)) / DAY) : 0,
    from: valid ? from : today, to: today, limitation: MEASUREMENT_LIMIT };
}

// Uses an existing authenticated session only for exclusion; never stores identity.
// Auth success has a new user identity before the browser sends its new cookie.
async function excludedRequest(env, request, authenticatedUserId = null) {
  if (request.headers.get('X-SI-Metrics') === 'exclude' || /^SponsorIntel-(?:Operations|QA)\//.test(request.headers.get('User-Agent') || '')) return true;
  const id = authenticatedUserId || (await sessionFor(request, env))?.user?.id;
  if (!id) return false;
  return !!(await env.DB.prepare('SELECT user_id FROM admin_members WHERE user_id=?').bind(id).first());
}

export function preparationReply(data) {
  const response = reply(data);
  if (documentKinds.has(data.kind) || preparationKinds.has(data.kind)) response.headers.set(PREPARATION_HEADER, data.kind);
  return response;
}
export function guidanceReply(data) {
  const response = reply(data);
  if (['answered', 'clarify', 'insufficient'].includes(data.status)) response.headers.set(GUIDANCE_HEADER, data.status);
  return response;
}
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
    "INSERT INTO analytics_public_daily(day,event,dimension,count) VALUES(?,?,?,1) ON CONFLICT(day,event,dimension) DO UPDATE SET count=count+1",
  )
    .bind(new Date().toISOString().slice(0, 10), event, dimension)
    .run();
}
export async function recordCampaignMetric(env, event, id) {
  if (!campaignEvents.has(event) || !campaignById(id)) return;
  await recordMetric(env, 'campaign_' + event, id);
}
async function recordPublicEvent(env, event, dimension, campaign) {
  const day = new Date().toISOString().slice(0, 10);
  const statement = (name, value) => env.DB.prepare('INSERT INTO analytics_public_daily(day,event,dimension,count) VALUES(?,?,?,1) ON CONFLICT(day,event,dimension) DO UPDATE SET count=count+1').bind(day, name, value);
  const writes = [statement(event, dimension)];
  if (campaignEvents.has(event) && campaignById(campaign)) writes.push(statement('campaign_' + event, campaign));
  await env.DB.batch(writes);
}
export async function recordResponseMetrics(env, request, response) {
  const event = responseMetric(new URL(request.url).pathname, request.method, response.status, response.headers.get(PREPARATION_HEADER), response.headers.get(GUIDANCE_HEADER));
  if (!event || !sameOrigin(request)) return;
  let userId = null;
  if (event === 'account_created' || event === 'sign_in') {
    // Bounded auth result only. Never read CVs, adverts, questions or generated text.
    const result = JSON.parse(await boundedText(response.clone(), 32768));
    if (result.error || typeof result.user?.id !== 'string' || !result.user.id || result.user.id.length > 128) return;
    userId = result.user.id;
  }
  if (await excludedRequest(env, request, userId)) return;
  await recordPublicEvent(env, event, '', request.headers.get('X-SI-Campaign'));
}
export function campaignSummary(metrics) {
  const valid = metrics.filter(m => campaignById(m.dimension) &&
    m.event.startsWith('campaign_') && campaignEvents.has(m.event.slice(9)));
  return {
    first_recorded: valid.map(m => m.day).sort()[0] || null,
    items: campaigns.map(c => ({id:c.id, label:c.label, source:c.source,
      ...Object.fromEntries([...campaignEvents].map(event => [event, valid
        .filter(m => m.dimension === c.id && m.event === 'campaign_' + event)
        .reduce((n, m) => n + m.count, 0)]))})),
  };
}
export function responseMetric(path, method, status, kind = null, guidance = null) {
  if (method !== "POST" || status !== 200) return null;
  if (path === '/api/career/generate') return documentKinds.has(kind) ? 'document_prepared' : preparationKinds.has(kind) ? 'preparation_completed' : null;
  if (path === '/api/chat') return guidance === 'answered' ? 'guidance_answer' : ['clarify','insufficient'].includes(guidance) ? 'guidance_followup' : null;
  return (
    {
      "/api/auth/sign-up/email": "account_created",
      "/api/auth/sign-in/email": "sign_in",
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
  if (await excludedRequest(env, request)) return reply({ ok: true });
  if (
    !(await limit(
      env,
      "page-event:" + (request.headers.get("CF-Connecting-IP") || "local"),
      120,
    ))
  )
    return reply({ error: "Event limit reached" }, 429);
  await recordPublicEvent(env, 'page_view', route, body?.campaign);
  return reply({ ok: true });
}
