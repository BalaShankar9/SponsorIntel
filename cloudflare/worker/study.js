import { boundedText, csvRows, clean, idFor } from "./data.js";
import { reply } from "./auth.js";
export const STUDENT_PUBLICATION =
  "https://www.gov.uk/government/publications/register-of-licensed-sponsors-students";
export const STUDENT_HEADERS = [
  "Sponsor Name",
  "Town/City",
  "Additional Locations",
  "Sponsor Type",
  "Status",
  "Route",
  "Immigration Compliance",
];
export function studentRecord(cells) {
  if (cells.length !== 7) throw Error("Student register columns changed");
  const [name, city, locations, type, status, route, compliance] =
    cells.map(clean);
  if (
    !name ||
    !type ||
    !status ||
    !["Student", "Child Student"].includes(route)
  )
    throw Error("Student register row needs review");
  return { name, city, locations, type, status, route, compliance };
}
export async function parseStudents(response) {
  const records = new Map();
  let first = true,
    rows = 0;
  for await (const cells of csvRows(response.body, 2_000_000)) {
    if (first) {
      first = false;
      if (
        cells.map((s) => s.replace(/^\uFEFF/, "").trim()).join("|") !==
        STUDENT_HEADERS.join("|")
      )
        throw Error("Student register schema changed");
      continue;
    }
    if (cells.every((s) => !s.trim())) continue;
    const r = studentRecord(cells);
    if (++rows > 5000) throw Error("Student register exceeds limit");
    const key = [r.name, r.city, r.type, r.status]
      .map((s) => s.toLowerCase())
      .join("|");
    const old = records.get(key);
    if (old) {
      old.routes.add(r.route);
      if (r.locations) old.locations.add(r.locations);
      if (r.compliance) old.compliance.add(r.compliance);
    } else
      records.set(key, {
        ...r,
        routes: new Set([r.route]),
        locations: new Set(r.locations ? [r.locations] : []),
        compliance: new Set(r.compliance ? [r.compliance] : []),
      });
  }
  return {
    rows,
    items: await Promise.all(
      [...records].map(async ([key, r]) => ({
        ...r,
        id: await idFor(key),
        routes: [...r.routes].sort(),
        locations: [...r.locations].join("; "),
        compliance: [...r.compliance].join("; "),
      })),
    ),
  };
}
export async function refreshStudents(env, fetcher = fetch) {
  const owner = crypto.randomUUID(),
    now = new Date().toISOString();
  const lock = await env.DB.prepare(
    "INSERT INTO feed_locks(name,owner,expires) VALUES('students',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE expires<? RETURNING owner",
  )
    .bind(owner, Date.now() + 300000, Date.now())
    .first();
  if (!lock) return { skipped: "Already checking the student register" };
  const row = await env.DB.prepare(
    "SELECT value FROM metadata WHERE key='students'",
  ).first();
  const previous = row ? JSON.parse(row.value) : null;
  try {
    const publicationResponse = await fetcher(
      "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-students",
      { redirect: "manual", signal: AbortSignal.timeout(15000) },
    );
    if (!publicationResponse.ok) throw Error("Student publication unavailable");
    const publication = JSON.parse(
      await boundedText(publicationResponse, 2_000_000),
    );
    if (
      publication.base_path !==
        "/government/publications/register-of-licensed-sponsors-students" ||
      Object.keys(publication.withdrawn_notice || {}).length
    )
      throw Error("Student publication unavailable");
    const attachments = (publication.details?.attachments || []).filter((a) =>
      /^https:\/\/assets\.publishing\.service\.gov\.uk\/[^?#]+\.csv$/.test(
        a.url || "",
      ),
    );
    if (attachments.length !== 1) throw Error("Student CSV needs review");
    const source = attachments[0].url,
      date = source.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
    if (!date || date > now.slice(0, 10))
      throw Error("Student source date needs review");
    const response = await fetcher(source, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || !response.body) throw Error("Student CSV unavailable");
    const data = await parseStudents(response);
    if (
      data.items.length < 500 ||
      (previous?.total &&
        Math.abs(data.items.length - previous.total) / previous.total > 0.2)
    )
      throw Error("Student register size needs review");
    const snapshot = date + "-" + crypto.randomUUID();
    for (let i = 0; i < data.items.length; i += 80)
      await env.DB.batch(
        data.items
          .slice(i, i + 80)
          .map((r) =>
            env.DB.prepare(
              "INSERT INTO student_sponsors VALUES(?,?,?,?,?,?,?,?,?)",
            ).bind(
              snapshot,
              r.id,
              r.name,
              r.city,
              r.locations,
              r.type,
              r.status,
              JSON.stringify(r.routes),
              r.compliance,
            ),
          ),
      );
    const check = await env.DB.prepare(
      "SELECT COUNT(*) total FROM student_sponsors WHERE snapshot=?",
    )
      .bind(snapshot)
      .first();
    if (check.total !== data.items.length)
      throw Error("Incomplete student import");
    const meta = {
      snapshot,
      source_url: source,
      source_date: date,
      publication_url: STUDENT_PUBLICATION,
      checked_at: now,
      last_success: now,
      total: data.items.length,
      source_rows: data.rows,
      refresh_error: null,
    };
    await env.DB.prepare(
      "INSERT INTO metadata(key,value) VALUES('students',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
      .bind(JSON.stringify(meta))
      .run();
    await env.DB.prepare(
      "DELETE FROM student_sponsors WHERE snapshot<>? AND snapshot<>?",
    )
      .bind(snapshot, previous?.snapshot || snapshot)
      .run();
    return meta;
  } catch (error) {
    const meta = {
      ...previous,
      checked_at: now,
      refresh_error:
        "The latest register check failed. Verify directly with GOV.UK before paying.",
    };
    await env.DB.prepare(
      "INSERT INTO metadata(key,value) VALUES('students',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
      .bind(JSON.stringify(meta))
      .run();
    console.error(
      JSON.stringify({
        event: "student_register_failed",
        message: error.message,
      }),
    );
    return { error: meta.refresh_error };
  } finally {
    await env.DB.prepare(
      "DELETE FROM feed_locks WHERE name='students' AND owner=?",
    )
      .bind(owner)
      .run();
  }
}
export function studyQuery(params) {
  const q = clean(params.get("q")).slice(0, 100),
    type = clean(params.get("type")).slice(0, 100),
    route =
      params.get("route") === "Child Student"
        ? "Child Student"
        : params.get("route") === "all"
          ? ""
          : "Student";
  const page = Math.min(
    400,
    Math.max(1, parseInt(params.get("page") || "1") || 1),
  );
  let where = "snapshot=?";
  const values = [];
  if (q) {
    where +=
      " AND (name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR locations LIKE ? ESCAPE '\\')";
    const escaped = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
    values.push(escaped, escaped, escaped);
  }
  if (type) {
    where += " AND type=?";
    values.push(type);
  }
  if (route) {
    where +=
      " AND EXISTS (SELECT 1 FROM json_each(student_sponsors.routes) WHERE value=?)";
    values.push(route);
  }
  return { where, values, page, route };
}
export async function studyAPI(url, env) {
  const r = await env.DB.prepare(
    "SELECT value FROM metadata WHERE key='students'",
  ).first();
  const meta = r ? JSON.parse(r.value) : null;
  if (!meta?.snapshot)
    return reply(
      {
        error:
          "The student directory is being prepared. Use the official register linked below.",
      },
      503,
    );
  const { where, values, page } = studyQuery(url.searchParams),
    bindings = [meta.snapshot, ...values];
  const [count, items, types] = await env.DB.batch([
    env.DB.prepare(
      "SELECT COUNT(*) total FROM student_sponsors WHERE " + where,
    ).bind(...bindings),
    env.DB.prepare(
      "SELECT id,name,city,locations,type,status,routes,compliance FROM student_sponsors WHERE " +
        where +
        " ORDER BY name COLLATE NOCASE,id LIMIT 12 OFFSET ?",
    ).bind(...bindings, (page - 1) * 12),
    env.DB.prepare(
      "SELECT DISTINCT type FROM student_sponsors WHERE snapshot=? ORDER BY type",
    ).bind(meta.snapshot),
  ]);
  return reply({
    meta,
    items: items.results.map((r) => ({ ...r, routes: JSON.parse(r.routes) })),
    total: count.results[0].total,
    page,
    pages: Math.ceil(count.results[0].total / 12),
    types: types.results.map((r) => r.type),
  });
}
