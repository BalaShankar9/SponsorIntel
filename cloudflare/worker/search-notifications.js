import { jobFilter } from './job-filters.js';
import { employerLicences } from './employer-licences.js';

const iso = n => new Date(n).toISOString();
const DAYS = 14 * 86400000;
const keys = ['q','location','sponsorship','level','salary','sector','licence'];
const filtersFor = s => Object.fromEntries(keys.map(k=>[k,typeof s[k]==='string'?s[k]:'']));
const fail = (message,status=400) => {throw Object.assign(Error(message),{status});};

async function matchingContext(env,now) {
  const boards = (await env.DB.prepare("SELECT id,sector,sponsor_id,reviewed_at,state FROM employer_boards WHERE state='approved'").all()).results;
  const licences = await employerLicences(env.DB,boards,now);
  return {boards,licensed:[...licences.matches.keys()]};
}
function predicate(m,context,now) {
  return jobFilter(new URLSearchParams(JSON.parse(m.filters)),context.boards,context.licensed,now,'j');
}

export async function configureSearchMonitor(env,user,input,now=Date.now()) {
  if (!input || typeof input.enabled!=='boolean' || typeof input.search_id!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.search_id)) fail('Choose a saved search.');
  if (input.enabled && !user.emailVerified) fail('Verify your account email before following a search.',403);
  const previous = await env.DB.prepare('SELECT id FROM search_monitors WHERE user_id=? AND search_id=?').bind(user.id,input.search_id).first();
  if (!input.enabled) {
    if (previous && input.monitor_id!==previous.id) fail('This search changed on another device. Reload and try again.',409);
    if (previous) await env.DB.prepare('DELETE FROM search_monitors WHERE id=? AND user_id=?').bind(previous.id,user.id).run();
    return {enabled:false};
  }
  const workspace = await env.DB.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(user.id).first();
  const searches = workspace ? JSON.parse(workspace.data).searches?.filter(s=>s.id===input.search_id) : [];
  if (searches?.length!==1) fail('Wait for your saved search to sync, then try again.',409);
  const filters = JSON.stringify(filtersFor(searches[0]));
  if (input.filters && JSON.stringify(filtersFor(input.filters))!==filters) fail('Wait for your changed search to sync, then try again.',409);
  if (previous) return {enabled:true,id:previous.id}; // Idempotent; never reset the baseline.
  const saved = await env.DB.prepare(`INSERT INTO search_monitors(id,user_id,search_id,filters,started_at)
    SELECT ?,user_id,?,?,? FROM career_workspaces WHERE user_id=? AND revision=?
    ON CONFLICT(user_id,search_id) DO NOTHING RETURNING id`)
    .bind(crypto.randomUUID(),input.search_id,filters,iso(now),user.id,workspace.revision).first();
  if (!saved) fail('Your workspace changed. Reload and try again.',409);
  return {enabled:true,id:saved.id};
}

// Each scan considers the latest 100 current matches per search. Replaying or
// overlapping a scan cannot create duplicate notifications or reset read state.
export async function scanSearchMonitor(env,m,context,now=Date.now()) {
  const f = predicate(m,context,now), floor = iso(Math.max(Date.parse(m.started_at),now-DAYS));
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO search_matches(monitor_id,job_id,detected_at)
      SELECT ?,j.id,? FROM jobs j WHERE ${f.sql} AND j.first_seen>? AND j.first_seen<=?
      AND strftime('%Y-%m-%dT%H:%M:%fZ',j.first_seen)=j.first_seen
      AND EXISTS(SELECT 1 FROM search_monitors WHERE id=? AND user_id=?)
      ORDER BY j.first_seen DESC,j.id LIMIT 100`)
      .bind(m.id,iso(now),...f.values,floor,iso(now),m.id,m.user_id),
    env.DB.prepare('UPDATE search_monitors SET checked_at=? WHERE id=? AND (checked_at IS NULL OR checked_at<?)').bind(iso(now),m.id,iso(now)),
  ]);
}

export async function scanSearchNotifications(env,now=Date.now()) {
  // No account creation, network fetching, emails or model calls. Oldest
  // attempted searches go first, so one failed search cannot starve the rest.
  const due = (await env.DB.prepare(`SELECT m.* FROM search_monitors m JOIN user u ON u.id=m.user_id
    WHERE u.emailVerified=1 AND (m.attempted_at IS NULL OR m.attempted_at<?)
    ORDER BY m.attempted_at,m.id LIMIT 20`).bind(iso(now-14*60000)).all()).results;
  let checked=0,failed=0;
  if (due.length) {
    const context = await matchingContext(env,now);
    for (const m of due) {
      await env.DB.prepare('UPDATE search_monitors SET attempted_at=? WHERE id=? AND (attempted_at IS NULL OR attempted_at<?)').bind(iso(now),m.id,iso(now)).run();
      try {await scanSearchMonitor(env,m,context,now);checked++;}
      catch {failed++;}
    }
  }
  await env.DB.prepare(`DELETE FROM search_matches WHERE job_id IN (SELECT id FROM jobs WHERE first_seen<=?)`).bind(iso(now-DAYS)).run();
  const result = {checked_at:iso(now),checked,failed};
  await env.DB.prepare("INSERT INTO metadata(key,value) VALUES('search_notifications',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(result)).run();
  return result;
}

export async function searchInbox(env,userId,now=Date.now()) {
  const monitors = (await env.DB.prepare('SELECT * FROM search_monitors WHERE user_id=? ORDER BY started_at,id').bind(userId).all()).results;
  const context = monitors.length ? await matchingContext(env,now) : null;
  const result=[];
  for (const m of monitors) {
    const f=predicate(m,context,now);
    const matches=(await env.DB.prepare(`SELECT j.id,j.title,j.company,j.location,j.sponsorship,j.evidence,j.first_seen,j.last_seen,j.closes_at,n.detected_at,n.read_at
      FROM search_matches n JOIN jobs j ON j.id=n.job_id WHERE n.monitor_id=? AND ${f.sql} AND j.first_seen>?
      ORDER BY j.first_seen DESC,j.id LIMIT 100`).bind(m.id,...f.values,iso(now-DAYS)).all()).results;
    result.push({id:m.id,search_id:m.search_id,filters:JSON.parse(m.filters),started_at:m.started_at,checked_at:m.checked_at,
      delayed:!m.checked_at || now-Date.parse(m.checked_at)>3600000,
      unread:matches.filter(x=>!x.read_at).length,matches});
  }
  return {as_of:iso(now),retention_days:14,monitors:result};
}

export async function markSearchMatchesRead(env,userId,input,now=Date.now()) {
  if (!input || typeof input.monitor_id!=='string' || typeof input.as_of!=='string' || !Number.isFinite(Date.parse(input.as_of)) || Date.parse(input.as_of)>now || !Array.isArray(input.job_ids) || input.job_ids.length>100 || input.job_ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id))) fail('Reload your matches before marking them as seen.');
  const m=await env.DB.prepare('SELECT id FROM search_monitors WHERE id=? AND user_id=?').bind(input.monitor_id,userId).first();
  if (!m) fail('This followed search was not found.',404);
  // A match arriving after the displayed snapshot must stay unread.
  await env.DB.prepare('UPDATE search_matches SET read_at=? WHERE monitor_id=? AND detected_at<=? AND read_at IS NULL AND job_id IN (SELECT value FROM json_each(?))')
    .bind(iso(now),m.id,iso(Date.parse(input.as_of)),JSON.stringify(input.job_ids)).run();
  return {ok:true};
}

export async function searchNotificationHealth(env) {
  const counts=await env.DB.prepare('SELECT COUNT(*) followed,MIN(checked_at) oldest_check,SUM(checked_at IS NULL) awaiting_first_check FROM search_monitors').first();
  const receipt=await env.DB.prepare("SELECT value FROM metadata WHERE key='search_notifications'").first();
  return {...counts,last_run:receipt?JSON.parse(receipt.value):null};
}
