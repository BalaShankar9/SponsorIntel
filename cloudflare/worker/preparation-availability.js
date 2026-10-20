import { jobAvailability } from '../shared/job-detail.js';
import { preparationAllowed, preparationMessages, manualApplicationId } from '../shared/preparation-availability.js';
import { reply } from './auth.js';
import { advertSnapshot } from './advert-version.js';
import { savedAdvertState } from '../shared/advert-version.js';
import { cvApplicationRestriction } from '../shared/application-instructions.js';

// Read the same public availability facts as the detail page. Never read CVs,
// private review notes or an external employer page from this guard.
export async function preparationSnapshot(jobId, env, now = Date.now()) {
  if (manualApplicationId(jobId)) return {state:'manual'};
  if (!/^[a-f0-9]{24}$/.test(jobId)) return {state:'missing'};
  try {
    const job = await env.DB.prepare(`SELECT j.*,
      (SELECT h.state FROM job_review_holds h JOIN job_review_targets t
       ON t.source_id=h.source_id AND t.apply_url=h.apply_url
       WHERE t.job_id=j.id AND h.source_id=j.board_id
       AND (h.state='held' OR h.recorded_at>=j.last_seen)
       ORDER BY h.state ASC LIMIT 1) AS review_hold
      FROM jobs j WHERE j.id=?`).bind(jobId).first();
    const state = job ? jobAvailability(job, now) : 'missing';
    return state === 'current' ? {state, advert:await advertSnapshot(job)} : {state};
  } catch { return {state:'unavailable'}; }
}

// One bounded catalogue read for an explicitly selected workspace batch. No
// external source fetch and no per-role D1 query multiplication.
export async function preparationSnapshots(jobIds, env, now = Date.now()) {
  const ids=[...new Set(jobIds)];
  if(ids.length>100)throw Error('Too many selected roles.');
  const valid=ids.filter(id=>/^[a-f0-9]{24}$/.test(id));
  let rows;
  try {
    rows=valid.length?(await env.DB.prepare(`SELECT j.*,
      (SELECT h.state FROM job_review_holds h JOIN job_review_targets t
       ON t.source_id=h.source_id AND t.apply_url=h.apply_url
       WHERE t.job_id=j.id AND h.source_id=j.board_id
       AND (h.state='held' OR h.recorded_at>=j.last_seen)
       ORDER BY h.state ASC LIMIT 1) AS review_hold
      FROM jobs j WHERE j.id IN (${valid.map(()=>'?').join(',')})`).bind(...valid).all()).results:[];
  } catch { return new Map(ids.map(id=>[id,{state:'unavailable'}])); }
  const byId=new Map(rows.map(j=>[j.id,j]));
  return new Map(await Promise.all(ids.map(async id=>{
    if(manualApplicationId(id))return [id,{state:'manual'}];
    const job=byId.get(id),state=job?jobAvailability(job,now):'missing';
    return [id,state==='current'?{state,advert:await advertSnapshot(job)}:{state}];
  })));
}

export async function preparationBlock(application, env, kind = '') {
  const snapshot = await preparationSnapshot(application.jobId, env);
  const state = savedAdvertState(application, snapshot);
  if (state === 'current' && kind === 'cv' && cvApplicationRestriction(snapshot.advert.description))
    return reply({error:'The current employer advert says CVs are not accepted. Use your evidence notes with its requested format. Your existing documents remain editable.'},409);
  return preparationAllowed(state) ? null : reply({
    error: preparationMessages[state], availability: state,
  }, state === 'unavailable' ? 503 : 409);
}
