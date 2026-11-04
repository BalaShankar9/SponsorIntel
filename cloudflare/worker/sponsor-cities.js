import { querySpec } from './data.js';
import { readCityFilters } from '../shared/sponsor-cities.js';

// Read only the current imported snapshot. No geocoding, inferred metro areas,
// new employer identities, licence claims or job matches are created here.
export async function getSponsorCities(env, search = '', now = Date.now()) {
  const row = await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first();
  if (!row) throw new Error('Register unavailable');
  const meta = JSON.parse(row.value), filters = readCityFilters(search);
  if (!meta.snapshot || !meta.source_date) throw new Error('Register unavailable');
  const spec = querySpec(new URLSearchParams({ route: filters.route, city: filters.city }));
  const values = [meta.snapshot, ...spec.values];
  let where = spec.where;
  const escape = s => s.replace(/[\\%_]/g, '\\$&');
  const summary = await env.DB.prepare(`SELECT COUNT(*) entries, COUNT(DISTINCT NULLIF(city,'') COLLATE NOCASE) locations, COALESCE(SUM(city=''),0) without_city FROM sponsors WHERE snapshot=?`).bind(meta.snapshot).first();
  if (!summary.entries) throw new Error('Register unavailable');
  if (filters.city && filters.employer) {
    where += " AND name LIKE ? ESCAPE '\\'";
    values.push('%' + escape(filters.employer) + '%');
  } else if (!filters.city) {
    where += " AND city<>''";
    if (filters.q) { where += " AND city LIKE ? ESCAPE '\\'"; values.push('%' + escape(filters.q) + '%'); }
  }
  const countSQL = filters.city ? `SELECT COUNT(*) total FROM sponsors WHERE ${where}` : `SELECT COUNT(*) total FROM (SELECT city FROM sponsors WHERE ${where} GROUP BY city COLLATE NOCASE)`;
  const { total } = await env.DB.prepare(countSQL).bind(...values).first();
  const limit = filters.city ? 12 : 36, pages = Math.ceil(total / limit), page = Math.min(filters.page, Math.max(1, pages));
  const sql = filters.city
    ? `SELECT id,name,city,county,routes,ratings FROM sponsors WHERE ${where} ORDER BY name COLLATE NOCASE,id LIMIT ? OFFSET ?`
    : `SELECT MIN(city) city,COUNT(*) count,SUM(skilled) skilled_worker FROM sponsors WHERE ${where} GROUP BY city COLLATE NOCASE ORDER BY ${filters.sort === 'az' ? 'city COLLATE NOCASE' : 'count DESC,city COLLATE NOCASE'} LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...values, limit, (page - 1) * limit).all();
  return { items: filters.city ? results.map(r => ({...r,routes:JSON.parse(r.routes),ratings:JSON.parse(r.ratings)})) : results,
    total, page, pages, filters:{...filters,page}, summary, routes:meta.routes || [],
    source_date:meta.source_date, checked_at:meta.checked_at, generated_at:new Date(now).toISOString(),
    stale:!!meta.refresh_error || !Number.isFinite(Date.parse(meta.source_date)) || now-Date.parse(meta.source_date)>7*86400000 };
}
