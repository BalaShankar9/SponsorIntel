import { boundedText, idFor } from "./data.js";
import { digest } from "./auth.js";
import pages from "../shared/pages.json" with { type: "json" };
const allowedPages = new Set([
  ...Object.values(pages).map((p) => p.path),
  "/account",
  "/signin",
  "/signup",
  "/admin",
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
  if (allowedPages.has(page) || /^\/jobs\/[a-f0-9]{24}$/.test(page))
    result.page = page;
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
  if (body.request_key !== undefined &&
      (typeof body.request_key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.request_key)))
    return json({error:'The report reference is invalid. Please reopen the feedback form.'},400);
  const bucket = Math.floor(Date.now() / 3600000);
  const hash = await idFor(
    (request.headers.get("CF-Connecting-IP") || "local") + ":" + bucket,
  );
  if (body.request_key) {
    const message=body.message.trim(),context=JSON.stringify(feedbackContext(body.context));
    const requestHash=await digest(JSON.stringify([body.kind,message,context]));
    const replay=async()=>{
      const row=await env.DB.prepare('SELECT id,request_hash FROM feedback WHERE request_key=?').bind(body.request_key).first();
      if(!row)return null;
      return row.request_hash===requestHash
        ? json({ok:true,id:row.id,replayed:true})
        : json({error:'This report reference belongs to different content. The original report has not changed.'},409);
    };
    const prior=await replay();if(prior)return prior;
    const id=crypto.randomUUID();
    // One transaction admits a new report and its quota slot. Concurrent retries
    // cannot create another report or consume capacity before detecting replay.
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO feedback(id,kind,message,created_at,context,app_version,request_key,request_hash)
        SELECT ?,?,?,?,?,?,?,? WHERE COALESCE((SELECT count FROM rate_limits WHERE key=?),0)<5
        ON CONFLICT DO NOTHING`).bind(id,body.kind,message,new Date().toISOString(),context,env.APP_VERSION||'',body.request_key,requestHash,hash),
      env.DB.prepare(`INSERT INTO rate_limits(key,count,expires)
        SELECT ?,1,? WHERE EXISTS(SELECT 1 FROM feedback WHERE id=? AND request_key=?)
        ON CONFLICT(key) DO UPDATE SET count=count+1`).bind(hash,Date.now()+7200000,id,body.request_key),
    ]);
    const saved=await env.DB.prepare('SELECT id FROM feedback WHERE id=? AND request_key=?').bind(id,body.request_key).first();
    if(saved)return json({ok:true,id},201);
    const concurrent=await replay();if(concurrent)return concurrent;
    return json({error:'You’ve sent five reports this hour. Please try again in an hour; your message is still here.'},429,{'Retry-After':'3600'});
  }
  // Older cached clients remain compatible. They do not have a retry identity.
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
