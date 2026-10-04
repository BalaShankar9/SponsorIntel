import { boundedText, idFor } from "./data.js";
import pages from "../shared/pages.json" with { type: "json" };
const allowedPages = new Set([
  ...Object.values(pages).map((p) => p.path),
  "/account",
  "/applications",
  "/saved",
  "/studio",
  "/career-profile",
  "/settings",
  "/employer-notes",
]);
const json = (data, status = 200, extra = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
export function feedbackContext(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  // Drop queries and fragments, then accept only known, non-personal route names.
  const page =
    typeof value.page === "string" ? value.page.split(/[?#]/)[0] : "";
  if (allowedPages.has(page)) result.page = page;
  const item = value.item;
  if (
    item &&
    ["employer", "job", "update"].includes(item.type) &&
    typeof item.id === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(item.id) &&
    typeof item.label === "string" &&
    item.label.trim().length <= 240
  ) {
    result.item = {
      type: item.type,
      id: item.id,
      label: item.label.replace(/[\u0000-\u001f\u007f]/g, " ").trim(),
    };
  }
  return result;
}
export async function feedbackAPI(request, env) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405, { Allow: "POST" });
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    return json({ error: "Please send feedback from Sponsor Intel." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "JSON required" }, 415);
  let body;
  try {
    body = JSON.parse(await boundedText(new Response(request.body), 12000));
  } catch {
    return json({ error: "Please keep feedback under 2,000 characters." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return json({ error: "Invalid feedback" }, 400);
  if (body.website) return json({ ok: true });
  if (
    !["feedback", "bug", "data"].includes(body.kind) ||
    typeof body.message !== "string" ||
    body.message.trim().length < 10 ||
    body.message.length > 2000
  )
    return json(
      { error: "Please write between 10 and 2,000 characters." },
      400,
    );
  const bucket = Math.floor(Date.now() / 3600000);
  const hash = await idFor(
    (request.headers.get("CF-Connecting-IP") || "local") + ":" + bucket,
  );
  const rate = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(hash, Date.now() + 7200000)
    .first();
  if (rate.count > 5)
    return json(
      {
        error:
          "You’ve sent five reports this hour. Please try again in an hour; your message is still here.",
      },
      429,
      { "Retry-After": "3600" },
    );
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO feedback(id,kind,message,created_at,context,app_version) VALUES(?,?,?,?,?,?)",
  )
    .bind(
      id,
      body.kind,
      body.message.trim(),
      new Date().toISOString(),
      JSON.stringify(feedbackContext(body.context)),
      env.APP_VERSION || "",
    )
    .run();
  return json({ ok: true, id }, 201);
}
