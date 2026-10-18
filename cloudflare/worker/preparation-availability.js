import { jobAvailability } from '../shared/job-detail.js';
import { preparationAllowed, preparationMessages, manualApplicationId } from '../shared/preparation-availability.js';
import { reply } from './auth.js';

// Read the same public availability facts as the detail page. Never read CVs,
// private review notes or an external employer page from this guard.
export async function preparationAvailability(jobId, env, now = Date.now()) {
  if (manualApplicationId(jobId)) return 'manual';
  if (!/^[a-f0-9]{24}$/.test(jobId)) return 'missing';
  try {
    const job = await env.DB.prepare(`SELECT j.id,j.active,j.last_seen,j.closes_at,
      (SELECT h.state FROM job_review_holds h JOIN job_review_targets t
       ON t.source_id=h.source_id AND t.apply_url=h.apply_url
       WHERE t.job_id=j.id AND h.source_id=j.board_id
       AND (h.state='held' OR h.recorded_at>=j.last_seen)
       ORDER BY h.state ASC LIMIT 1) AS review_hold
      FROM jobs j WHERE j.id=?`).bind(jobId).first();
    return job ? jobAvailability(job, now) : 'missing';
  } catch { return 'unavailable'; }
}

export async function preparationBlock(jobId, env) {
  const state = await preparationAvailability(jobId, env);
  return preparationAllowed(state) ? null : reply({
    error: preparationMessages[state], availability: state,
  }, state === 'unavailable' ? 503 : 409);
}
