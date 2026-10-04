import {
  REGISTER_URL,
  clean,
  keyFor,
  idFor,
  csvRows,
  toRecord,
  boundedText,
  csvSource,
  querySpec,
} from "./data.js";
import { jobsAPI, refreshJobs } from "./jobs.js";
import { immigrationAPI, refreshImmigration } from "./immigration.js";
import { authAPI, recoverAccount, digest, reply, sameOrigin } from "./auth.js";
import { careerAPI } from "./career.js";
import { pageResponse } from "./pages.js";
import { feedbackAPI } from "./feedback.js";
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
        : { sources: await refreshJobs(env) },
    );
  }
  if (path === "/api/feedback") return feedbackAPI(request, env);
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
async function refresh(env) {
  const now = new Date().toISOString();
  const current = await getMeta(env);
  const page = await boundedText(
    await fetch(REGISTER_URL, { signal: AbortSignal.timeout(30000) }),
    2000000,
  );
  const source = csvSource(page);
  if (current?.source_url === source.url) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires<?")
      .bind(Date.now())
      .run();
    await env.DB.prepare("UPDATE metadata SET value=? WHERE key='register'")
      .bind(
        JSON.stringify({ ...current, checked_at: now, refresh_error: null }),
      )
      .run();
    return { unchanged: true };
  }
  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok || !response.body)
    throw new Error("Register download failed");
  const records = new Map();
  let rows = 0;
  let first = true;
  for await (const cells of csvRows(response.body)) {
    if (first) {
      first = false;
      if (
        cells[0].replace(/^\uFEFF/, "") !== "Organisation Name" ||
        cells[4] !== "Route"
      )
        throw new Error("Register schema changed");
      continue;
    }
    if (cells.every((x) => !x.trim())) continue;
    const r = toRecord(cells);
    rows++;
    if (rows > 300000) throw new Error("Unexpected register growth");
    const key = keyFor(r.name, r.city, r.county);
    let v = records.get(key);
    if (!v) {
      v = {
        name: r.name,
        city: r.city,
        county: r.county,
        ratings: new Set(),
        routes: new Set(),
      };
      records.set(key, v);
    }
    v.ratings.add(r.rating);
    v.routes.add(r.route);
  }
  if (
    records.size < 100000 ||
    (current &&
      Math.abs(records.size - current.employers) / current.employers > 0.2)
  )
    throw new Error("Register size needs manual review");
  const snapshot = source.date + "-" + crypto.randomUUID().slice(0, 8);
  let chunk = [];
  const cities = new Map();
  const routes = new Map();
  let skilled = 0;
  async function flush() {
    const values = await Promise.all(
      chunk.map(async ([key, r]) => [
        await idFor(key),
        snapshot,
        r.name,
        r.city,
        r.county,
        JSON.stringify([...r.ratings].sort()),
        JSON.stringify([...r.routes].sort()),
        r.routes.has("Skilled Worker") ? 1 : 0,
      ]),
    );
    const statements = [];
    for (let i = 0; i < values.length; i += 10) {
      const group = values.slice(i, i + 10);
      statements.push(
        env.DB.prepare(
          "INSERT INTO sponsors(id,snapshot,name,city,county,ratings,routes,skilled) VALUES " +
            group.map(() => "(?,?,?,?,?,?,?,?)").join(","),
        ).bind(...group.flat()),
      );
    }
    await env.DB.batch(statements);
    chunk = [];
  }
  for (const entry of records) {
    const r = entry[1];
    if (r.routes.has("Skilled Worker")) skilled++;
    if (r.city)
      cities.set(
        r.city.toLowerCase(),
        (cities.get(r.city.toLowerCase()) || 0) + 1,
      );
    for (const route of r.routes)
      routes.set(route, (routes.get(route) || 0) + 1);
    chunk.push(entry);
    if (chunk.length === 250) await flush();
  }
  if (chunk.length) await flush();
  const verified = await env.DB.prepare(
    "SELECT COUNT(*) total FROM sponsors WHERE snapshot=?",
  )
    .bind(snapshot)
    .first();
  if (verified.total !== records.size)
    throw new Error("Incomplete imported register");
  const meta = {
    snapshot,
    source_date: source.date,
    source_url: source.url,
    publication_url: REGISTER_URL,
    checked_at: now,
    imported_at: new Date().toISOString(),
    employers: records.size,
    source_rows: rows,
    skilled_worker: skilled,
    cities: cities.size,
    routes: [...routes].map(([name, count]) => ({ name, count })),
    refresh_error: null,
  };
  await env.DB.prepare(
    "INSERT INTO metadata(key,value) VALUES('register',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(JSON.stringify(meta))
    .run();
  await env.DB.prepare("DELETE FROM sponsors WHERE snapshot<>? AND snapshot<>?")
    .bind(snapshot, current?.snapshot || snapshot)
    .run();
  await env.DB.prepare("DELETE FROM rate_limits WHERE expires<?")
    .bind(Date.now())
    .run();
  return { imported: records.size };
}
const security = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
};
export default {
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
      for (const [k, v] of Object.entries(security)) response.headers.set(k, v);
      return response;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "request_failed",
          message: /^\/api\/(auth|career|recover)(\/|$)/.test(
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
    if (event.cron === "*/15 * * * *") {
      console.log(
        JSON.stringify({
          event: "immigration_refresh",
          ...(await refreshImmigration(env)),
        }),
      );
      return;
    }
    if (event.cron === "30 */6 * * *") {
      const result = await refreshJobs(env);
      await env.DB.prepare("DELETE FROM ai_usage WHERE expires<?")
        .bind(Date.now())
        .run();
      console.log(JSON.stringify({ event: "jobs_refresh", sources: result }));
      return;
    }
    try {
      const result = await refresh(env);
      console.log(JSON.stringify({ event: "register_refresh", ...result }));
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "register_refresh_failed",
          message: error.message,
        }),
      );
      const meta = await getMeta(env);
      if (meta)
        await env.DB.prepare("UPDATE metadata SET value=? WHERE key='register'")
          .bind(
            JSON.stringify({
              ...meta,
              refresh_error:
                "Automatic refresh could not complete. The last verified snapshot remains available.",
              last_attempt: new Date().toISOString(),
            }),
          )
          .run();
      throw error;
    }
  },
};
