import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDatabase} from './helpers/source-d1.mjs';
import {school,provider,seedSchool,vacancy} from './fixtures/teaching-board.mjs';
import {fetchBoard,storeBoardJobs,getJobDetail,jobsAPI} from '../worker/jobs.js';
import {saveJobReview,reviewEvidenceURL,jobReviewSummary,jobReviewFindings,jobReviewsAPI} from '../worker/job-reviews.js';
import {currentJobs} from '../worker/current-jobs.js';
import {jobAvailability,jobMetadata,jobStructuredData} from '../shared/job-detail.js';
const now=Date.now(),iso=n=>new Date(n).toISOString();
const input=(patch={})=>({source_id:school.id,apply_url:vacancy(1).url,revision:0,state:'held',title:vacancy(1).title,reason:'deadline_conflict',evidence_url:'https://employer.example/careers?ref=fictional-1',note:'Original employer deadline differs from the linked advert. Fictional isolated evidence.',observed_at:iso(now),follow_up_at:iso(now+86400000),request_key:crypto.randomUUID(),...patch});
async function setup(t,publish=true){const env=sourceDatabase(t);await seedSchool(env.DB,now);const f=provider(undefined,{now}),jobs=await fetchBoard(school,{readOnlyProbe:true,fetcher:f.fetcher,now});if(publish)await storeBoardJobs(env.DB,school,jobs,iso(now));return {...env,jobs};}
function current(env){const c=currentJobs(now+10000);return env.sql.prepare('SELECT id FROM jobs WHERE '+c.sql).all(...c.values);}
const release=()=>input({revision:1,state:'released',note:'Fresh original evidence now confirms matching deadlines for this exact role.',observed_at:iso(now+2000),follow_up_at:null});
test('hold retires only its advert, preserves evidence and disables current metadata',async t=>{
 const env=await setup(t);await saveJobReview(env,input(),'owner',now);assert.equal(current(env).length,1);const j=await getJobDetail(env.jobs[0].id,env);assert.equal(j.review_hold,'held');assert.equal(jobAvailability(j,now),'held');assert.equal(jobMetadata(j,now).indexable,false);assert.equal(jobStructuredData(j,now)['@graph'].some(x=>x['@type']==='JobPosting'),false);assert.equal(j.description,env.jobs[0].description);
 const list=await(await jobsAPI(new URL('https://sponsorintel.london/api/jobs'),env,now)).json();assert.equal(list.total,1);assert.ok(!JSON.stringify(list).includes('Original employer deadline differs'));
});
test('prepublication hold survives full collection and stable job ID survives URL rename',async t=>{
 const env=await setup(t,false);await saveJobReview(env,input(),'owner',now);await storeBoardJobs(env.DB,school,env.jobs,iso(now+1000));assert.equal(current(env).length,1);const renamed=env.jobs.map((j,i)=>i?j:{...j,apply_url:j.apply_url+'-renamed'});await storeBoardJobs(env.DB,school,renamed,iso(now+2000));assert.equal(current(env).length,1);assert.equal((await getJobDetail(renamed[0].id,env)).review_hold,'held');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_review_targets').get().n,1);
});
test('release requires new evidence and a collection started after release, not an older in-flight result',async t=>{
 const env=await setup(t);await saveJobReview(env,input(),'owner',now);await assert.rejects(saveJobReview(env,input({revision:1,state:'released',follow_up_at:null}),'owner',now+1000),/new evidence/);
 await saveJobReview(env,release(),'owner',now+2000);assert.equal(current(env).length,1);assert.equal(jobAvailability(await getJobDetail(env.jobs[0].id,env),now+2000),'awaiting_refresh');await storeBoardJobs(env.DB,school,env.jobs,iso(now+1000));assert.equal(current(env).length,1);await storeBoardJobs(env.DB,school,env.jobs,iso(now+3000));assert.equal(current(env).length,2);assert.equal((await getJobDetail(env.jobs[0].id,env)).review_hold,null);
});
test('lost-acknowledgement replay preserves one decision and never retires a later refreshed advert',async t=>{
 const env=await setup(t),first=input();await saveJobReview(env,first,'owner',now);const value=release();await saveJobReview(env,value,'owner',now+2000);await storeBoardJobs(env.DB,school,env.jobs,iso(now+3000));assert.equal((await saveJobReview(env,value,'owner',now+5000)).replayed,true);assert.equal((await saveJobReview(env,first,'owner',now+5000)).review.state,'held');assert.equal(current(env).length,2);await assert.rejects(saveJobReview(env,{...value,note:'Different content cannot reuse this request identity.'},'owner',now+5000),{status:409});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,2);
});
test('concurrent decisions and audit failure preserve atomic history and job state',async t=>{
 const env=await setup(t);const result=await Promise.allSettled([saveJobReview(env,input(),'owner',now),saveJobReview(env,input(),'owner',now)]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_review_revisions').get().n,1);assert.throws(()=>env.sql.exec("UPDATE job_review_revisions SET state='released'"),/immutable/);assert.throws(()=>env.sql.exec('DELETE FROM job_review_revisions'),/immutable/);
 const another=await setup(t);another.sql.exec("CREATE TRIGGER test_failure BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'fictional failure'); END");await assert.rejects(saveJobReview(another,input(),'owner',now));assert.equal(current(another).length,2);assert.equal(another.sql.prepare('SELECT COUNT(*) n FROM job_review_revisions').get().n,0);assert.equal(another.sql.prepare('SELECT COUNT(*) n FROM job_review_targets').get().n,0);
});
test('overdue holds stay effective and create aggregate follow-up findings',async t=>{
 const env=await setup(t);await saveJobReview(env,input(),'owner',now);const s=await jobReviewSummary(env,now+2*86400000);assert.equal(s.overdue,1);assert.equal(jobReviewFindings(s).length,1);assert.doesNotMatch(JSON.stringify(jobReviewFindings(s)),/Original employer deadline|employer.example/);await storeBoardJobs(env.DB,school,env.jobs,iso(now+1000));assert.equal(current(env).length,1);
});
test('invalid source, stale evidence, missing follow-up and session-bearing links cannot create holds',async t=>{
 const env=await setup(t);for(const patch of [{source_id:'unknown'},{apply_url:vacancy(1).url+'?token=secret'},{evidence_url:'https://employer.example/careers?USESSION=secret'},{observed_at:iso(now-4*86400000)},{follow_up_at:iso(now-1000)},{follow_up_at:iso(now+8*86400000)},{revision:0,state:'released',follow_up_at:null},{actor:'someone-else'}])await assert.rejects(saveJobReview(env,input(patch),'owner',now));assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_review_revisions').get().n,0);assert.equal(reviewEvidenceURL('https://employer.example/jobs?WVID=public-board'),'https://employer.example/jobs?WVID=public-board');assert.throws(()=>reviewEvidenceURL('https://user:secret@employer.example/'));
});
test('owner API enforces same-origin writes and exposes bounded history without reviewer identifiers',async t=>{
 const env=await setup(t);let r=await jobReviewsAPI(new Request('https://sponsorintel.london/api/admin/job-reviews',{method:'POST',headers:{Origin:'https://other.example'},body:JSON.stringify(input())}),env,{user:{id:'owner'}});assert.equal(r.status,403);await saveJobReview(env,input(),'owner',now);
 r=await jobReviewsAPI(new Request('https://sponsorintel.london/api/admin/job-reviews'),env,{user:{id:'owner'}});const d=await r.json();assert.equal(d.summary.held,1);assert.equal(d.items[0].actor,undefined);assert.equal(d.items[0].request_key,undefined);const h=await(await jobReviewsAPI(new Request('https://sponsorintel.london/api/admin/job-reviews?id='+d.items[0].id),env,{user:{id:'owner'}})).json();assert.equal(h.history.length,1);assert.equal(h.review.id,d.items[0].id);
});
