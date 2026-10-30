import {REGISTER_URL,keyFor,idFor,csvRows,toRecord,boundedText,csvSource} from './data.js';
import {registerFailureCode} from './register-health.js';
import {registerCleanupStatement} from './register-cleanup.js';
async function getMeta(env) {
  const row=await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first();
  return row ? JSON.parse(row.value) : null;
}

// Diagnostic writes are limited to this actual attempt. No retries or refresh trigger.
export async function runRegisterRefresh(env, fetcher=fetch, clock=Date.now) {
  const progress={stage:'metadata',publication:'not_attempted'};
  try {
    const result=await refresh(env,progress,fetcher,clock);
    console.log(JSON.stringify({event:'register_refresh',...result}));
    return result;
  } catch(error) {
    const failure={stage:progress.stage,code:registerFailureCode(error),
      started_at:progress.started_at,failed_at:new Date(clock()).toISOString(),
      publication:progress.publication,source_date:progress.source_date||null};
    console.error(JSON.stringify({event:'register_refresh_failed',...failure}));
    try {
      const row=await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first();
      const meta=row ? JSON.parse(row.value) : null;
      // An older in-flight failure must not overwrite a later attempt's metadata.
      if(meta && (!Number.isFinite(Date.parse(meta.checked_at)) || Date.parse(meta.checked_at)<=Date.parse(progress.started_at))
        && (!Number.isFinite(Date.parse(meta.last_attempt)) || Date.parse(meta.last_attempt)<=Date.parse(progress.started_at))) {
        await env.DB.prepare("UPDATE metadata SET value=? WHERE key='register' AND value=?")
          .bind(JSON.stringify({...meta,refresh_error:'Automatic refresh could not complete. The last verified snapshot remains available.',
            last_attempt:failure.failed_at,refresh_failure:failure}),row.value).run();
      }
    } catch {
      // A failed diagnostic write is not a successful refresh; do not replace its failure.
      console.error(JSON.stringify({event:'register_refresh_diagnostic_unavailable',stage:progress.stage}));
    }
    throw Error('Register refresh failed ('+failure.stage+', '+failure.code+').');
  }
}

async function refresh(env, progress, fetcher, clock) {
  const now = new Date(clock()).toISOString();
  progress.started_at = now;
  progress.stage = "metadata";
  const current = await getMeta(env);
  progress.stage = "publication";
  const page = await boundedText(
    await fetcher(REGISTER_URL, { signal: AbortSignal.timeout(30000) }),
    2000000,
  );
  const source = csvSource(page);
  progress.source_date = source.date;
  if (current?.source_url === source.url) {
    progress.stage = "rate_limit_cleanup";
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires<?")
      .bind(Date.now())
      .run();
    progress.stage = "unchanged_check";
    await env.DB.prepare("UPDATE metadata SET value=? WHERE key='register'")
      .bind(
        JSON.stringify({ ...current, checked_at: now, refresh_error: null, refresh_failure: null }),
      )
      .run();
    return { unchanged: true };
  }
  progress.stage = "download";
  const response = await fetcher(source.url, {
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok || !response.body)
    throw new Error("Register download failed");
  progress.stage = "validation";
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
  progress.stage = "staging";
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
  progress.stage = "verification";
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
    imported_at: new Date(clock()).toISOString(),
    employers: records.size,
    source_rows: rows,
    skilled_worker: skilled,
    cities: cities.size,
    routes: [...routes].map(([name, count]) => ({ name, count })),
    refresh_error: null,
    refresh_failure: null,
  };
  progress.stage = "activation";
  progress.publication = "uncertain";
  await env.DB.prepare(
    "INSERT INTO metadata(key,value) VALUES('register',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  )
    .bind(JSON.stringify(meta))
    .run();
  progress.publication = "confirmed";
  progress.stage = "snapshot_cleanup";
  await registerCleanupStatement(env.DB, snapshot, current?.snapshot || snapshot).run();
  progress.stage = "rate_limit_cleanup";
  await env.DB.prepare("DELETE FROM rate_limits WHERE expires<?")
    .bind(Date.now())
    .run();
  return { imported: records.size };
}
