import { JOB_FRESHNESS_MS } from '../shared/job-detail.js';

// Shared by every current-collection query. Read-time expiry does not depend
// on a successful feed refresh or the housekeeping schedule.
export function currentJobs(now = Date.now(), alias = '') {
  if (alias && !/^[a-z]+$/.test(alias)) throw Error('Invalid job table alias');
  const p = alias ? alias + '.' : '';
  return {
    sql: `${p}active=1 AND ${p}last_seen>? AND ${p}last_seen<=? AND julianday(${p}last_seen) IS NOT NULL
      AND (${p}closes_at IS NULL OR (${p}closes_at>? AND strftime('%Y-%m-%dT%H:%M:%fZ',${p}closes_at)=${p}closes_at))`,
    values: [new Date(now - JOB_FRESHNESS_MS).toISOString(), new Date(now + 300000).toISOString(), new Date(now).toISOString()],
  };
}
