import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './research-db.mjs';
import { parseJobDeadline, universityClosingDate } from '../worker/job-deadlines.js';
import { jobAvailability } from '../shared/job-detail.js';
import { currentJobs } from '../worker/current-jobs.js';
import { BOARDS, normaliseBoardJobs, storeBoardJobs, jobsAPI, getJobDetail } from '../worker/jobs.js';
import { sitemapResponse } from '../worker/pages.js';
import { companyBrief } from '../worker/company-brief.js';
import { collectBusinessSnapshot } from '../worker/business-operations.js';
import { executeResearchTool } from '../worker/agent-research.js';

const now = Date.parse('2026-10-08T23:00:00.000Z');
const board = BOARDS.find(x => x.id === 'monzo');
const raw = (id, deadline) => ({id, title:'Graduate engineer', location:{name:'London'},
  content:'Our team builds useful software. We offer visa sponsorship for this role.',
  absolute_url:'https://job-boards.greenhouse.io/monzo/jobs/'+id, application_deadline:deadline});
const healthFetch = async url => new Response(null,{status:url.endsWith('/session')?403:200,
  headers:{'x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'none'"}});

test('explicit deadlines preserve precision and convert UK date-only cutoffs through both clock changes',()=>{
  for (const [date, cutoff] of [
    ['2026-10-08','2026-10-08T23:00:00.000Z'],
    ['2026-10-24','2026-10-24T23:00:00.000Z'],
    ['2026-10-25','2026-10-26T00:00:00.000Z'],
    ['2026-03-28','2026-03-29T00:00:00.000Z'],
    ['2026-03-29','2026-03-29T23:00:00.000Z'],
    ['2028-02-29','2028-03-01T00:00:00.000Z'],
    ['2026-12-31','2027-01-01T00:00:00.000Z'],
    ['2026-10-08T17:00+05:30','2026-10-08T11:30:00.000Z'],
    ['2026-10-08T17:00:15.5Z','2026-10-08T17:00:15.500Z'],
    ['2026-10-08T17:00:00-04:00','2026-10-08T21:00:00.000Z'],
  ]) assert.deepEqual(parseJobDeadline(date),{application_deadline:date,closes_at:cutoff});
  for(const absent of [null,undefined,'']) assert.deepEqual(parseJobDeadline(absent),{application_deadline:null,closes_at:null});
  for(const invalid of ['2026-02-29','2026-04-31','2026-00-02','2026-13-01','08/10/2026','2026-10-08T17:00','2026-10-08T24:00Z','2026-10-08T17:60Z','2026-10-08T17:00:60Z','2026-10-08T17:00+14:30','2026-10-08T17:00+01:70','2026-10-08T17:00-00:00',123,{}]) assert.throws(()=>parseJobDeadline(invalid),/deadline/);
  assert.throws(()=>universityClosingDate('Closing Date: 8 Oct 2026\nClosing Date: 9 Oct 2026'),/single/);
  assert.throws(()=>universityClosingDate('Closing Date: 8 Oct 2026 at noon'),/single/);
  assert.throws(()=>parseJobDeadline('2026-10-08\n'),/deadline/);
});

test('normalisation stores deadlines, keeps unknown dates unknown and excludes passed timestamps',async()=>{
 const jobs=await normaliseBoardJobs([raw('1','2026-10-08'),raw('2',null),raw('3','2026-10-08T12:00Z')],board,now-1);
 assert.equal(jobs.length,2);assert.equal(jobs[0].closes_at,new Date(now).toISOString());assert.equal(jobs[1].closes_at,null);
 assert.equal((await normaliseBoardJobs([raw('1','2026-10-08')],board,now)).length,0);
 await assert.rejects(normaliseBoardJobs([raw('1','2026-02-30')],board,now),/deadline/);
});

test('expiry changes public counts, sitemap, brief and business snapshot with no source refresh or workspace mutation',async t=>{
 const env=database(t), seen=new Date(now-3600000).toISOString();
 const jobs=await normaliseBoardJobs([raw('1','2026-10-08'),raw('2',null)],board,now-3600000);
 await storeBoardJobs(env.DB,board,jobs,seen);
 env.sql.prepare('INSERT INTO career_workspaces(user_id,data,updated_at) VALUES(?,?,?)').run('private-test','retained notes and draft',seen);
 const before=await (await jobsAPI(new URL('https://sponsorintel.london/api/jobs'),env,now-1)).json();
 assert.equal(before.total,2);assert.equal(before.catalog_total,2);assert.equal(before.collections.sponsorship,2);assert.equal(before.next_deadline,new Date(now).toISOString());assert.equal(before.items.find(x=>x.id===jobs[0].id).application_deadline,'2026-10-08');
 assert.match(await (await sitemapResponse(env,now-1)).text(),new RegExp(jobs[0].id));
 const app={jobId:jobs[0].id,company:board.company};
 assert.match(await companyBrief(app,env,now-1),/EMPLOYER ADVERT EVIDENCE/);
 const after=await (await jobsAPI(new URL('https://sponsorintel.london/api/jobs'),env,now)).json();
 assert.equal(after.total,1);assert.equal(after.catalog_total,1);assert.equal(after.collections.sponsorship,1);assert.equal(after.next_deadline,null);
 assert.doesNotMatch(await (await sitemapResponse(env,now)).text(),new RegExp(jobs[0].id));
 assert.match(await companyBrief(app,env,now),/EVIDENCE NEEDED/);
 const snapshot=await collectBusinessSnapshot(env,healthFetch,now);
 assert.equal(snapshot.jobs.total,1);assert.equal(snapshot.sources[0].roles,1);
 const detail=await getJobDetail(jobs[0].id,env);
 assert.equal(jobAvailability(detail,now-1),'current');assert.equal(jobAvailability(detail,now),'expired');assert.equal(detail.active,1);assert.equal(detail.last_seen,seen);assert.equal(detail.first_seen,seen);
 assert.equal(env.sql.prepare('SELECT data FROM career_workspaces').get().data,'retained notes and draft');
 // A genuine employer extension makes the listing current again; not a local timer reset.
 const extended=await normaliseBoardJobs([raw('1','2026-10-09'),raw('2',null)],board,now);
 await storeBoardJobs(env.DB,board,extended,new Date(now).toISOString());
 assert.equal(jobAvailability(await getJobDetail(jobs[0].id,env),now),'current');
 assert.equal((await getJobDetail(jobs[0].id,env)).first_seen,seen);
});

test('current collection SQL and detail availability agree on stale, future, malformed and passed records',async t=>{
 const env=database(t), jobs=await normaliseBoardJobs([raw('1',null)],board,now-1);
 await storeBoardJobs(env.DB,board,jobs,new Date(now).toISOString());
 const {sql,values}=currentJobs(now);
 for(const [deadline,seen,active] of [
  [null,new Date(now).toISOString(),1],['invalid',new Date(now).toISOString(),1],
  [new Date(now).toISOString(),new Date(now).toISOString(),1],
  [new Date(now+1).toISOString(),new Date(now).toISOString(),1],
  [null,new Date(now-3*86400000).toISOString(),1],
  [null,new Date(now+300001).toISOString(),1],[null,'bad',1],[null,new Date(now).toISOString(),0],
 ]){
  env.sql.prepare('UPDATE jobs SET closes_at=?,last_seen=?,active=?').run(deadline,seen,active);
  const count=env.sql.prepare('SELECT COUNT(*) n FROM jobs WHERE '+sql).get(...values).n;
  assert.equal(count,jobAvailability(await getJobDetail(jobs[0].id,env),now)==='current'?1:0);
 }
});

test('live research excludes expired candidates before selecting an advert',async t=>{
 const env=database(t),stamp=new Date().toISOString();
 const jobs=await normaliseBoardJobs([raw('1',null),raw('2',null)],board);
 await storeBoardJobs(env.DB,board,jobs,stamp);
 env.sql.prepare('UPDATE jobs SET application_deadline=?,closes_at=? WHERE id=?').run('2020-01-01','2020-01-02T00:00:00.000Z',jobs[0].id);
 const context={sources:[{id:board.id}],candidates:[],listed:[],evidence:[],decisions:[]};
 env.sql.prepare("INSERT INTO agent_investigations(id,kind,state,created_at,context,actor,policy,models) VALUES('deadline-test','research','running',?,?,'local-test','test','{}')").run(stamp,JSON.stringify(context));
 await executeResearchTool(env,'deadline-test',0,{tool:'list_jobs',id:board.id,purpose:'Find current roles'});
 const result=JSON.parse(env.sql.prepare("SELECT context FROM agent_investigations WHERE id='deadline-test'").get().context);
 assert.deepEqual(result.candidates.map(x=>x.id),[jobs[1].id]);
});

import { deadlineBackfill } from '../scripts/prepare-deadline-backfill.mjs';
test('deadline backfill preserves observations and personal work, and refuses stale input on rerun',async t=>{
 const env=database(t),stamp=new Date(now).toISOString();
 const uni=BOARDS.find(x=>x.id==='university-bath');
 const jobs=await normaliseBoardJobs([raw('1',null)],uni,now);
 jobs[0].description="An employer's advert. Closing Date: 8 Oct 2026";
 await storeBoardJobs(env.DB,uni,jobs,stamp);
 const row={...jobs[0]},plan=deadlineBackfill([row]);
 assert.equal(plan.records[0].closes_at,new Date(now).toISOString());
 env.sql.exec(plan.sql);env.sql.exec(plan.sql);
 const after=await getJobDetail(row.id,env);
 assert.equal(after.last_seen,stamp);assert.equal(after.first_seen,stamp);assert.equal(after.active,1);assert.equal(after.application_deadline,'2026-10-08');
 env.sql.prepare('UPDATE jobs SET description=?,application_deadline=NULL,closes_at=NULL').run('A newer advert. Closing Date: 9 Oct 2026');
 env.sql.exec(plan.sql);assert.equal((await getJobDetail(row.id,env)).closes_at,null);
 assert.throws(()=>deadlineBackfill([{...row,provider:'unreviewed'}]),/Unexpected/);
 assert.throws(()=>deadlineBackfill([{...row,description:'No deadline'}]),/closing date/);
});
