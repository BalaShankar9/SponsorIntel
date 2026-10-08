import { currentJobs } from './current-jobs.js';
import { JOB_FRESHNESS_MS } from '../shared/job-detail.js';

const iso = time => new Date(time).toISOString();
const positive = column => `${column} IN ('offered','conditional')`;
const counts = `json_object('total',COUNT(*),'employers',COUNT(DISTINCT board_id),
  'offered',COALESCE(SUM(sponsorship='offered'),0),'conditional',COALESCE(SUM(sponsorship='conditional'),0),
  'unavailable',COALESCE(SUM(sponsorship='unavailable'),0),'not_stated',COALESCE(SUM(sponsorship='not_stated'),0))`;
const parsedRun = row => row ? {...row,claim:undefined,before_counts:JSON.parse(row.before_counts),counts:JSON.parse(row.counts),changes:JSON.parse(row.changes)} : null;

// One D1 transaction compares the public collection with its prior observation.
// Capture is tied to an existing business run, pause-aware and retry-safe. A
// private claim ensures duplicate/older captures cannot overwrite newer state.
export async function captureJobMovement(env, runId, now = Date.now()) {
  const at=iso(now), claim=crypto.randomUUID(), current=currentJobs(now,'j');
  const guard='EXISTS(SELECT 1 FROM job_movement_runs WHERE id=? AND claim=?)';
  const live=`SELECT j.id job_id,j.board_id,j.company,j.title,j.sponsorship,
    SUBSTR(COALESCE(j.evidence,''),1,500) evidence FROM jobs j WHERE ${current.sql}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO job_movement_runs(id,claim,observed_at,previous_at,trigger_kind,baseline,before_counts)
      SELECT ?,?,?,(SELECT MAX(observed_at) FROM job_movement_runs),b.trigger_kind,
        NOT EXISTS(SELECT 1 FROM job_movement_runs),
        (SELECT ${counts} FROM job_movement_state WHERE available=1)
      FROM business_runs b WHERE b.id=? AND b.state IN ('queued','running')
        AND (SELECT enabled FROM business_controls WHERE singleton=1)=1
        AND NOT EXISTS(SELECT 1 FROM job_movement_runs WHERE observed_at>=?)
      ON CONFLICT DO NOTHING`).bind(runId,claim,at,runId,at),
    env.DB.prepare(`WITH live AS (${live})
      INSERT INTO job_movement_events(run_id,job_id,board_id,company,title,kind,reason,before_sponsorship,after_sponsorship,before_evidence,after_evidence)
      SELECT ?,c.job_id,c.board_id,c.company,c.title,
        CASE WHEN s.job_id IS NULL THEN 'entered' WHEN s.available=0 THEN 'returned'
          WHEN s.sponsorship<>c.sponsorship THEN 'sponsorship_changed' ELSE 'evidence_changed' END,
        CASE WHEN COALESCE(s.available,0)=0 THEN 'current_at_observation' ELSE 'source_wording_changed' END,
        CASE WHEN s.available=1 THEN s.sponsorship END,c.sponsorship,
        CASE WHEN s.available=1 THEN s.evidence END,c.evidence
      FROM live c LEFT JOIN job_movement_state s ON s.job_id=c.job_id
      WHERE (s.job_id IS NULL OR s.available=0 OR s.sponsorship<>c.sponsorship OR s.evidence<>c.evidence)
        AND ${guard} AND (SELECT baseline FROM job_movement_runs WHERE id=?)=0
      UNION ALL
      SELECT ?,s.job_id,s.board_id,s.company,s.title,'left',
        CASE WHEN j.id IS NULL THEN 'record_missing'
          WHEN j.closes_at IS NOT NULL AND strftime('%Y-%m-%dT%H:%M:%fZ',j.closes_at)=j.closes_at AND j.closes_at<=? THEN 'deadline_passed'
          WHEN j.last_seen<=? THEN 'source_stale'
          WHEN j.active=0 THEN 'inactive_record' ELSE 'not_current' END,
        s.sponsorship,NULL,s.evidence,NULL
      FROM job_movement_state s LEFT JOIN jobs j ON j.id=s.job_id
      WHERE s.available=1 AND NOT EXISTS(SELECT 1 FROM live c WHERE c.job_id=s.job_id)
        AND ${guard} AND (SELECT baseline FROM job_movement_runs WHERE id=?)=0`)
      .bind(...current.values,runId,runId,claim,runId,runId,at,iso(now-JOB_FRESHNESS_MS),runId,claim,runId),
    env.DB.prepare(`WITH live AS (${live})
      INSERT INTO job_movement_state(job_id,board_id,company,title,sponsorship,evidence,available,observed_at)
      SELECT job_id,board_id,company,title,sponsorship,evidence,1,? FROM live WHERE ${guard}
      ON CONFLICT(job_id) DO UPDATE SET board_id=excluded.board_id,company=excluded.company,title=excluded.title,
        sponsorship=excluded.sponsorship,evidence=excluded.evidence,available=1,observed_at=excluded.observed_at`)
      .bind(...current.values,at,runId,claim),
    env.DB.prepare(`UPDATE job_movement_state SET available=0,observed_at=? WHERE available=1
      AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.id=job_movement_state.job_id AND ${current.sql}) AND ${guard}`)
      .bind(at,...current.values,runId,claim),
    env.DB.prepare(`UPDATE job_movement_runs SET counts=(SELECT ${counts} FROM job_movement_state WHERE available=1),
      changes=(SELECT json_object('entered',COALESCE(SUM(kind='entered'),0),'returned',COALESCE(SUM(kind='returned'),0),
        'left',COALESCE(SUM(kind='left'),0),'sponsorship_changed',COALESCE(SUM(kind='sponsorship_changed'),0),
        'evidence_changed',COALESCE(SUM(kind='evidence_changed'),0),
        'stated_gained',COALESCE(SUM(${positive('after_sponsorship')} AND NOT COALESCE(${positive('before_sponsorship')},0)),0),
        'stated_lost',COALESCE(SUM(${positive('before_sponsorship')} AND NOT COALESCE(${positive('after_sponsorship')},0)),0))
        FROM job_movement_events WHERE run_id=?) WHERE id=? AND claim=?`).bind(runId,runId,claim),
  ]);
  const row=await env.DB.prepare('SELECT * FROM job_movement_runs WHERE id=?').bind(runId).first();
  return row?{state:'recorded',...parsedRun(row)}:{state:'not_recorded'};
}

export async function jobMovementHealth(env, now = Date.now(), {compact=false} = {}) {
  const rows=await env.DB.batch([
    env.DB.prepare('SELECT * FROM job_movement_runs ORDER BY observed_at DESC LIMIT 12'),
    env.DB.prepare('SELECT MIN(observed_at) started_at FROM job_movement_runs'),
    env.DB.prepare(`SELECT board_id,company,COUNT(*) total,
      SUM(sponsorship='offered') offered,SUM(sponsorship='conditional') conditional
      FROM job_movement_state WHERE available=1 GROUP BY board_id,company ORDER BY offered+conditional DESC,total DESC,board_id LIMIT 10`),
    env.DB.prepare(`SELECT SUBSTR(observed_at,1,10) day,COUNT(*) observations,
      SUM(json_extract(changes,'$.entered')) entered,SUM(json_extract(changes,'$.returned')) returned,
      SUM(json_extract(changes,'$.left')) AS "left",SUM(json_extract(changes,'$.sponsorship_changed')) sponsorship_changed,
      SUM(json_extract(changes,'$.stated_gained')) stated_gained,SUM(json_extract(changes,'$.stated_lost')) stated_lost
      FROM job_movement_runs WHERE observed_at>=? GROUP BY day ORDER BY day DESC LIMIT 7`).bind(iso(now-6*86400000).slice(0,10)),
    env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1'),
    ...(!compact?[env.DB.prepare(`SELECT e.*,r.observed_at,r.previous_at,r.trigger_kind FROM job_movement_events e
      JOIN job_movement_runs r ON r.id=e.run_id ORDER BY r.observed_at DESC,e.job_id LIMIT 50`)]:[]),
  ]);
  const runs=rows[0].results.map(parsedRun),latest=runs[0]||null;
  const elapsed=latest?now-Date.parse(latest.observed_at):NaN;
  return {enabled:!!rows[4].results[0]?.enabled,checked_at:iso(now),started_at:rows[1].results[0]?.started_at||null,
    status:!latest?'awaiting_baseline':!Number.isFinite(elapsed)||elapsed < -300000||elapsed>2*3600000?'overdue':latest.baseline?'baseline':'tracking',
    latest,employers:rows[2].results,days:rows[3].results,...(!compact?{runs,events:rows[5].results}:{}),
    limitation:'Hourly observations of current jobs. Changes between observations may be missed; observation time is not publication time. Leaving the current list is not proof an employer closed a vacancy. Existing jobs form a baseline, not new discoveries.'};
}

export function jobMovementFindings(health) {
  if(!health?.enabled)return [];
  const findings=[];
  if(health.status==='overdue') findings.push({id:'job-movement-overdue',category:'quality',severity:'normal',title:'Restore job movement observations',
    detail:'The last job movement observation is missing a valid recent timestamp or is over two hours old.',next_action:'Inspect the scheduled business run and retained movement receipt. Do not reconstruct missed history as verified changes.'});
  const total=(health.latest?.counts.offered||0)+(health.latest?.counts.conditional||0),first=health.employers?.[0];
  if(total && first && (first.offered+first.conditional)>total/2) findings.push({id:'source-concentration',category:'growth',severity:'normal',title:'Broaden verified sponsorship sources',
    detail:`${first.company} accounts for ${first.offered+first.conditional} of ${total} offered or conditional adverts in the last observation.`,
    next_action:'Review new employer-original leads, including LinkedIn jobs and recruiting posts. Verify identity, current opening and exact sponsorship wording before expanding approved sources. More successful refreshes alone do not improve coverage.'});
  return findings;
}
