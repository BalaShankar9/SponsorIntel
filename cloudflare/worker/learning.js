import {currentJobs} from './current-jobs.js';
import {BOARDS,SECTORS} from './job-sources.js';
import {JOB_FRESHNESS_MS} from '../shared/job-detail.js';
import {LEARNING_VERSION,summariseSkills} from '../shared/learning.js';
export async function learningAPI(request,env,now=Date.now()){
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const reply=(data,status=200)=>Response.json(data,{status,headers});
  if(!['GET','HEAD'].includes(request.method))return reply({error:'Method not allowed'},405);
  const sector=new URL(request.url).searchParams.get('sector')||'';
  if(sector&&!Object.hasOwn(SECTORS,sector))return reply({error:'Unknown employer sector'},400);
  const current=currentJobs(now,'j');
  const rows=await env.DB.prepare(`SELECT j.id,j.board_id,j.company,j.title,
    CASE WHEN SUM(length(j.description)) OVER ()<=4000000 THEN j.description ELSE NULL END description,
    j.apply_url,j.sponsorship,j.last_seen,j.closes_at
    FROM jobs j LEFT JOIN employer_boards b ON b.id=j.board_id
    LEFT JOIN agent_source_controls c ON c.source_id=j.board_id
    WHERE ${current.sql} AND j.sponsorship IN ('offered','conditional') AND length(trim(j.evidence))>0
    AND (b.state='approved' OR (b.id IS NULL AND j.board_id IN (SELECT value FROM json_each(?))))
    AND COALESCE(c.paused,0)=0
    AND (?='' OR b.sector=? OR (b.id IS NULL AND j.board_id IN (SELECT value FROM json_each(?))))
    AND NOT EXISTS (SELECT 1 FROM job_review_targets t JOIN job_review_holds h ON t.source_id=h.source_id AND t.apply_url=h.apply_url
      WHERE t.job_id=j.id AND h.source_id=j.board_id AND (h.state='held' OR h.recorded_at>=j.last_seen))
    ORDER BY j.board_id,j.id LIMIT 1001`).bind(...current.values,JSON.stringify(BOARDS.map(b=>b.id)),sector,sector,JSON.stringify(BOARDS.filter(b=>b.sector===sector).map(b=>b.id))).all();
  const jobs=rows.results;
  if(jobs.length>1000||jobs.some(j=>j.description===null))return reply({error:'This selection is too large for a complete skills check. Choose an employer sector.'},503);
  const validUntil=Math.min(now+5*60000,...jobs.flatMap(j=>[Date.parse(j.last_seen)+JOB_FRESHNESS_MS,Date.parse(j.closes_at)]).filter(Number.isFinite));
  return reply({version:LEARNING_VERSION,generated_at:new Date(now).toISOString(),valid_until:new Date(validUntil).toISOString(),sector,sectors:SECTORS,...summariseSkills(jobs)});
}
