import {REGISTER_URL,keyFor,idFor,csvRows,toRecord,boundedText,csvSource} from './data.js';
import {registerFailureCode} from './register-health.js';
import {registerCleanupStatement} from './register-cleanup.js';
function activationStatement(DB, value, expected, owner, now) {
  return DB.prepare(`INSERT INTO metadata(key,value)
    SELECT 'register',? WHERE
      EXISTS (SELECT 1 FROM feed_locks WHERE name='worker-register' AND owner=? AND expires>?)
      AND ((? IS NULL AND NOT EXISTS (SELECT 1 FROM metadata WHERE key='register'))
        OR EXISTS (SELECT 1 FROM metadata WHERE key='register' AND value=?))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value RETURNING value`)
    .bind(value, owner, now, expected, expected);
}

// Read bounded pages through the (snapshot,id) primary key. Equal counts or URLs
// alone are insufficient; every canonical field and stable identity must match.
export async function sameRegisterSnapshot(DB, snapshot, records) {
  if (!snapshot) return false;
  let cursor = '', count = 0;
  while (true) {
    const {results} = await DB.prepare(`SELECT id,name,city,county,ratings,routes,skilled
      FROM sponsors WHERE snapshot=? AND id>? ORDER BY id LIMIT 10000`)
      .bind(snapshot, cursor).all();
    for (const row of results) {
      const item = records.get(keyFor(row.name, row.city, row.county));
      if (!item || item.id !== row.id ||
        !['name','city','county','ratings','routes','skilled'].every(key => item[key] === row[key])) return false;
    }
    count += results.length;
    if (count > records.size) return false;
    if (results.length < 10000) return count === records.size;
    cursor = results.at(-1).id;
  }
}

// One owned lease, exact metadata comparisons, and no retry after an uncertain write.
export async function runRegisterRefresh(env, fetcher=fetch, clock=Date.now) {
  const progress={stage:'ownership',publication:'not_attempted',started_at:new Date(clock()).toISOString()};
  const owner=crypto.randomUUID();
  let acquired=false;
  try {
    const lock=await env.DB.prepare(`INSERT INTO feed_locks(name,owner,expires) VALUES('worker-register',?,?)
      ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE expires<? RETURNING owner`)
      .bind(owner,clock()+300000,clock()).first();
    if (!lock) return {skipped:'Worker register check already in progress'};
    acquired=true;
    const result=await refresh(env,progress,fetcher,clock,owner);
    console.log(JSON.stringify({event:'register_refresh',...result}));
    return result;
  } catch(error) {
    const failure={stage:progress.stage,code:registerFailureCode(error),
      started_at:progress.started_at,failed_at:new Date(clock()).toISOString(),
      publication:progress.publication,source_date:progress.source_date||null};
    console.error(JSON.stringify({event:'register_refresh_failed',...failure}));
    try {
      const row=acquired ? await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first() : null;
      // A lost activation acknowledgement may have committed our own new pointer.
      // Preserve that pointer; never annotate or replace a different owner's value.
      if(row && (row.value===progress.expected || row.value===progress.activation_value)) {
        const meta=JSON.parse(row.value);
        await env.DB.prepare(`UPDATE metadata SET value=? WHERE key='register' AND value=?
          AND EXISTS (SELECT 1 FROM feed_locks WHERE name='worker-register' AND owner=? AND expires>?)`)
          .bind(JSON.stringify({...meta,refresh_error:'Automatic refresh could not complete. The last verified snapshot remains available.',
            last_attempt:failure.failed_at,refresh_failure:failure}),row.value,owner,clock()).run();
      }
    } catch {
      console.error(JSON.stringify({event:'register_refresh_diagnostic_unavailable',stage:progress.stage}));
    }
    throw Error('Register refresh failed ('+failure.stage+', '+failure.code+').');
  } finally {
    if(acquired) try {
      await env.DB.prepare("DELETE FROM feed_locks WHERE name='worker-register' AND owner=?").bind(owner).run();
    } catch {
      // The bounded lease expires naturally. Never retry or disguise the outcome.
      console.error(JSON.stringify({event:'register_refresh_lease_release_unavailable'}));
    }
  }
}

async function refresh(env, progress, fetcher, clock, owner) {
  const now = new Date(clock()).toISOString();
  progress.started_at = now;
  progress.stage = "metadata";
  const saved = await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first();
  progress.expected = saved?.value ?? null;
  const current = saved ? JSON.parse(saved.value) : null;
  progress.stage = "publication";
  const page = await boundedText(
    await fetcher(REGISTER_URL, { redirect: "manual", signal: AbortSignal.timeout(30000) }),
    2000000,
  );
  const source = csvSource(page);
  progress.source_date = source.date;
  if (source.date > now.slice(0,10) || (current?.source_date && source.date < current.source_date))
    throw Error("Source date needs review");
  progress.stage = "download";
  const response = await fetcher(source.url, {
    redirect: "manual", signal: AbortSignal.timeout(60000),
  });
  if (response.status !== 200 || !response.body)
    throw new Error("Register download failed");
  progress.stage = "validation";
  const records = new Map();
  let rows = 0;
  let first = true;
  for await (const cells of csvRows(response.body)) {
    if (first) {
      first = false;
      if (
        cells.map(x => x.replace(/^\uFEFF/, "").trim()).join("|") !==
          "Organisation Name|Town/City|County|Type & Rating|Route"
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
  // Normalize once, in bounded groups, for both comparison and staging.
  const cities = new Set(), routes = new Map();
  let skilled = 0, chunk = [];
  async function normalize() {
    await Promise.all(chunk.map(async ([key,r]) => {
      r.id = await idFor(key);
      r.skilled = r.routes.has("Skilled Worker") ? 1 : 0;
      skilled += r.skilled;
      if(r.city) cities.add(r.city.toLowerCase());
      for(const route of r.routes) routes.set(route,(routes.get(route)||0)+1);
      r.ratings = JSON.stringify([...r.ratings].sort());
      r.routes = JSON.stringify([...r.routes].sort());
    }));
    chunk = [];
  }
  for(const entry of records) { chunk.push(entry); if(chunk.length===250) await normalize(); }
  if(chunk.length) await normalize();
  progress.stage = "comparison";
  const unchanged = await sameRegisterSnapshot(env.DB, current?.snapshot, records);
  const snapshot = unchanged ? current.snapshot : source.date + "-" + crypto.randomUUID();
  progress.stage = "staging";
  async function flush() {
    const statements = [];
    for (let i = 0; i < chunk.length; i += 10) {
      const group = chunk.slice(i, i + 10).map(r => [r.id,snapshot,r.name,r.city,r.county,r.ratings,r.routes,r.skilled]);
      statements.push(env.DB.prepare(
        "INSERT INTO sponsors(id,snapshot,name,city,county,ratings,routes,skilled) VALUES " + group.map(() => "(?,?,?,?,?,?,?,?)").join(","),
      ).bind(...group.flat()));
    }
    await env.DB.batch(statements);
    chunk = [];
  }
  if (!unchanged) {
    for(const r of records.values()) { chunk.push(r); if(chunk.length===250) await flush(); }
    if(chunk.length) await flush();
  }
  progress.stage = "verification";
  const verified = unchanged ? {total:records.size} : await env.DB.prepare(
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
    imported_at: unchanged ? current.imported_at : new Date(clock()).toISOString(),
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
  progress.activation_value = JSON.stringify(meta);
  const activated = await activationStatement(env.DB, progress.activation_value, progress.expected, owner, clock()).first();
  if (!activated) {
    progress.publication = "not_attempted";
    return {skipped:'Worker register changed or ownership expired during this check'};
  }
  progress.publication = "confirmed";
  if (!unchanged) {
    progress.stage = "snapshot_cleanup";
    await registerCleanupStatement(env.DB, snapshot, current?.snapshot || snapshot,
      {value:progress.activation_value,owner,now:clock()}).run();
  }
  progress.stage = "rate_limit_cleanup";
  await env.DB.prepare(`DELETE FROM rate_limits WHERE expires<?
    AND EXISTS (SELECT 1 FROM metadata WHERE key='register' AND value=?)
    AND EXISTS (SELECT 1 FROM feed_locks WHERE name='worker-register' AND owner=? AND expires>?)`)
    .bind(clock(),progress.activation_value,owner,clock()).run();
  return unchanged ? {unchanged:true} : {imported:records.size};
}
