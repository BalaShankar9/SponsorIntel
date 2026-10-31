import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSourceDiagnostic,sourceFailureHistory} from '../shared/source-diagnostics.js';
import {SourceCheckError,sourceDiagnostic,withSourceContext,sourceFailureNeedsReview} from '../worker/source-errors.js';
import {sourceDatabase} from './helpers/source-d1.mjs';
import {source,posting,provider} from './fixtures/smartrecruiters.mjs';
import {collectSmartRecruiters} from '../worker/smartrecruiters.js';
import {fetchBoard} from '../worker/jobs.js';
import {dispatchSources,initialiseRun,executeSourceTask,operationsSnapshot,SourceRetry,completeRun} from '../worker/agent-operations.js';

const stamp=()=>new Date().toISOString();
async function start(env,id){await dispatchSources(env,{id,sourceId:source.id});await initialiseRun(env,id);}
const task=env=>env.sql.prepare('SELECT * FROM agent_tasks').get();

test('only bounded server-owned diagnostic fields survive; arbitrary exceptions cannot forge evidence',()=>{
 const context={phase:'description',posting_ref:posting(1).id,http_status:403,requests:2,message:'PRIVATE_FIXTURE',url:'https://private.invalid',body:'PRIVATE_FIXTURE'};
 assert.deepEqual(sourceDiagnostic(new SourceCheckError('http_error',context,'PRIVATE_FIXTURE')),{code:'http_error',phase:'description',posting_ref:posting(1).id,requests:2,http_status:403});
 for(const error of [Object.assign(new Error('PRIVATE_FIXTURE'),context,{code:'http_error'}),Object.assign(Object.create(SourceCheckError.prototype),context),null,'PRIVATE_FIXTURE'])assert.deepEqual(sourceDiagnostic(error),{code:'unclassified'});
 assert.deepEqual(safeSourceDiagnostic({code:{toString(){throw Error('Never coerce unknown input');}},phase:'PRIVATE_FIXTURE',posting_ref:'secret',requests:51,page_offset:1,http_status:200}),{code:'unclassified'});
 const saved=withSourceContext(new SourceCheckError('storage_failed',{phase:'cache'}),{phase:'description',posting_ref:posting(1).id,requests:2});
 assert.deepEqual(sourceDiagnostic(saved),{code:'storage_failed',phase:'cache',posting_ref:posting(1).id,requests:2});
 const failures=sourceFailureHistory({attempt_failures:[{attempt:1,checked_at:stamp(),code:'invalid_sections',message:'PRIVATE_FIXTURE'},{attempt:1,checked_at:stamp(),code:'http_error'},{attempt:3,checked_at:'invalid',code:'http_error'}]});
 assert.equal(failures.length,1);assert.ok(!JSON.stringify(failures).includes('PRIVATE_FIXTURE'));assert.deepEqual(sourceFailureHistory('{broken'),[]);
});

test('catalogue network, redirect, body and timeout failures identify the stage without retaining provider content',async t=>{
 for(const [code,fetcher,status] of [
  ['http_error',async()=>new Response('PRIVATE_FIXTURE',{status:429}),429],
  ['redirected',async()=>new Response('PRIVATE_FIXTURE',{status:302,headers:{Location:'https://private.invalid'}}),302],
  ['invalid_payload',async()=>new Response('PRIVATE_FIXTURE'),undefined],
  ['oversized_payload',async()=>new Response('x'.repeat(2000001)),undefined],
  ['request_timeout',async()=>{throw new DOMException('PRIVATE_FIXTURE','TimeoutError');},undefined],
  ['request_failed',async()=>{throw new Error('PRIVATE_FIXTURE');},undefined],
 ]){
  const env=sourceDatabase(t);env.sql.prepare("INSERT INTO feed_locks VALUES('jobs','fixture',?)").run(Date.now()+120000);
  await assert.rejects(collectSmartRecruiters(source,{DB:env.DB,leaseOwner:'fixture',fetcher}),error=>{
   assert.deepEqual(sourceDiagnostic(error),{code,phase:'catalogue',page_offset:0,requests:1,...(status?{http_status:status}:{})});
   assert.ok(!JSON.stringify(sourceDiagnostic(error)).includes('PRIVATE_FIXTURE'));return true;
  });
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 }
});

test('changed-field diagnostics are finite, ordered, deduplicated and survive context and stored history',()=>{
 const input={code:'posting_changed',changed_fields:['active_status','city','city','title','__proto__','PRIVATE_FIXTURE',{toString(){throw Error('must not coerce');}}],values:{city:'PRIVATE_FIXTURE'}};
 const expected={code:'posting_changed',changed_fields:['title','city','active_status']};
 assert.deepEqual(safeSourceDiagnostic(input),expected);
 assert.deepEqual(safeSourceDiagnostic({...input,code:'http_error'}),{code:'http_error'});
 for(const changed_fields of ['title',null,{},['PRIVATE_FIXTURE']])assert.deepEqual(safeSourceDiagnostic({...input,changed_fields}),{code:'posting_changed'});
 const wrapped=withSourceContext(new SourceCheckError(input.code,input),{phase:'description',posting_ref:posting(1).id,requests:2});
 const retained=sourceFailureHistory({attempt_failures:[{attempt:1,checked_at:stamp(),...sourceDiagnostic(wrapped)}]})[0];
 assert.deepEqual(retained.changed_fields,expected.changed_fields);assert.equal(retained.phase,'description');assert.equal(retained.requests,2);
 assert.ok(!JSON.stringify(retained).includes('PRIVATE_FIXTURE'));
 assert.equal(safeSourceDiagnostic({code:'posting_changed',changed_fields:Array(100).fill('PRIVATE_FIXTURE').concat('title')}).changed_fields,undefined);
});

test('identity disagreement ends this run after one reservation and replay cannot collect again',async t=>{
 const env=sourceDatabase(t),f=provider([posting(1)],(value,u)=>{if(!u.search){value=structuredClone(value);value.location.city='PRIVATE_FIXTURE';value.name='PRIVATE_FIXTURE';value.active=false;}return value;});
 await start(env,'identity-conflict');const readBoard=(b,c)=>fetchBoard(b,{...c,fetcher:f.fetcher});
 assert.equal((await executeSourceTask(env,'identity-conflict',source.id,{readBoard})).state,'needs_review');
 const snapshot=await operationsSnapshot(env),failures=snapshot.diagnostics[0].attempt_failures;
 assert.equal(failures.length,1);assert.ok(failures.every(f=>JSON.stringify(f.changed_fields)===JSON.stringify(['title','city','active_status'])));
 assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,50);assert.equal(f.calls.length,2);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_posting_cache').get().n,0);
 assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_FIXTURE'));
 await executeSourceTask(env,'identity-conflict',source.id,{readBoard});assert.equal(f.calls.length,2);
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM agent_reviews WHERE state='open'").get().n,1);
});

test('invalid sections end this run and retain a precise review without another fetch',async t=>{
 const env=sourceDatabase(t),f=provider([posting(1)],(value,u)=>{if(!u.search)delete value.jobAd.sections.qualifications;return value;});
 await start(env,'invalid-advert');const readBoard=(b,c)=>fetchBoard(b,{...c,fetcher:f.fetcher});
 assert.equal((await executeSourceTask(env,'invalid-advert',source.id,{readBoard})).state,'needs_review');
 const failures=sourceFailureHistory(task(env).evidence);assert.equal(failures.length,1);
 assert.deepEqual(failures.map(({attempt,checked_at,...rest})=>rest),Array(1).fill({code:'invalid_sections',phase:'description',posting_ref:posting(1).id,requests:2}));
 assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,50);assert.equal(f.calls.length,2);
 await executeSourceTask(env,'invalid-advert',source.id,{readBoard});assert.equal(f.calls.length,2);
 const snapshot=await operationsSnapshot(env);assert.equal(snapshot.diagnostics[0].attempt_failures.length,1);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_FIXTURE'));
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_runs WHERE success=1').get().n,0);
});

test('a successful retry keeps the failed attempt and original reservation history',async t=>{
 const env=sourceDatabase(t),f=provider([posting(1)]);await start(env,'recovered');
 const failed=async()=>{throw new SourceCheckError('http_error',{phase:'catalogue',http_status:503,requests:1,page_offset:0},'PRIVATE_FIXTURE');};
 await assert.rejects(executeSourceTask(env,'recovered',source.id,{readBoard:failed}),SourceRetry);
 assert.equal((await executeSourceTask(env,'recovered',source.id,{readBoard:(b,c)=>fetchBoard(b,{...c,fetcher:f.fetcher})})).state,'published');
 assert.equal(sourceFailureHistory(task(env).evidence).length,1);assert.equal(task(env).attempts,2);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,100);
 const snapshot=await operationsSnapshot(env);assert.equal(snapshot.diagnostics[0].state,'published');assert.equal(snapshot.diagnostics[0].attempt_failures[0].http_status,503);
});

test('legacy failures are shown as unspecified and history stays bounded to recent runs',async t=>{
 const env=sourceDatabase(t);await start(env,'legacy');env.sql.exec("UPDATE agent_tasks SET state='failed',error_code='fetch_failed',evidence='{}'");
 assert.deepEqual((await operationsSnapshot(env)).diagnostics[0].attempt_failures,[]);
 for(let i=0;i<17;i++){
  const id='later-'+i,when=new Date(Date.now()+(i+1)*1000).toISOString();
  env.sql.prepare("INSERT INTO agent_runs(id,trigger_kind,state,created_at,updated_at) VALUES(?,'owner','attention',?,?)").run(id,when,when);
  env.sql.prepare("INSERT INTO agent_tasks(run_id,source_id,company,state,error_code,evidence) VALUES(?,?,?,'failed','fetch_failed','{}')").run(id,source.id,source.company);
 }
 const rows=(await operationsSnapshot(env)).diagnostics;assert.equal(rows.length,10);assert.ok(!rows.some(r=>r.run_id==='legacy'));
});


test('only trusted validation faults end retries; transport, storage and forged errors keep their existing behavior',()=>{
 for(const code of ['unreviewed_source','redirected','invalid_payload','oversized_payload','incomplete_catalogue','duplicate_posting','posting_identity','posting_changed','invalid_destination','invalid_sections','oversized_advert'])assert.equal(sourceFailureNeedsReview(new SourceCheckError(code)),true,code);
 for(const code of ['http_error','request_failed','request_timeout','storage_failed','lease_ended','collection_limit','unclassified'])assert.equal(sourceFailureNeedsReview(new SourceCheckError(code)),false,code);
 for(const error of [Object.assign(new Error('PRIVATE_FIXTURE'),{code:'posting_changed'}),Object.create(SourceCheckError.prototype),null,'posting_changed'])assert.equal(sourceFailureNeedsReview(error),false);
});

test('a lost validation receipt acknowledgement replays the committed hold without another collection',async t=>{
 const env=sourceDatabase(t);await start(env,'lost-ack');let reads=0;
 const batch=env.DB.batch;
 env.DB.batch=async statements=>{const result=await batch(statements);if(env.sql.prepare("SELECT state FROM agent_tasks WHERE run_id='lost-ack'").get().state==='needs_review'){env.DB.batch=batch;throw Error('Simulated lost acknowledgement');}return result;};
 const readBoard=async()=>{reads++;throw new SourceCheckError('posting_changed',{changed_fields:['title'],posting_ref:posting(1).id});};
 await assert.rejects(executeSourceTask(env,'lost-ack',source.id,{readBoard}),/lost acknowledgement/);
 assert.equal((await executeSourceTask(env,'lost-ack',source.id,{readBoard})).replay,true);assert.equal(reads,1);
 assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,50);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_reviews').get().n,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_runs WHERE success=0').get().n,1);
});


test('a validation hold preserves earlier publication and partial cache, then a later complete collection can recover',async t=>{
 const env=sourceDatabase(t),rows=[posting(1),posting(2)];let reject=false;
 const f=provider(rows,(value,u)=>{if(reject&&!u.search&&value.id===posting(2).id){value=structuredClone(value);value.location.city='PRIVATE_FIXTURE';}return value;});
 const readBoard=(b,c)=>fetchBoard(b,{...c,fetcher:f.fetcher});
 await start(env,'good-snapshot');assert.equal((await executeSourceTask(env,'good-snapshot',source.id,{readBoard})).state,'published');await completeRun(env.DB,'good-snapshot');
 const beforeJobs=env.sql.prepare('SELECT * FROM jobs ORDER BY id').all(),beforeSource=env.sql.prepare('SELECT count,last_success FROM job_sources').get();
 env.sql.prepare("INSERT INTO agent_source_controls(source_id,paused,reason,actor,updated_at) VALUES(?,0,'Existing owner review','fictional-owner',?)").run(source.id,stamp());
 rows.forEach(row=>row.releasedDate='2026-02-01T09:00:00Z');reject=true;
 await start(env,'bad-snapshot');assert.equal((await executeSourceTask(env,'bad-snapshot',source.id,{readBoard})).state,'needs_review');await completeRun(env.DB,'bad-snapshot');
 assert.deepEqual(env.sql.prepare('SELECT * FROM jobs ORDER BY id').all(),beforeJobs);
 assert.deepEqual(env.sql.prepare('SELECT count,last_success FROM job_sources').get(),beforeSource);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_posting_cache').get().n,2);
 const control=env.sql.prepare('SELECT paused,reason,actor FROM agent_source_controls').get();assert.deepEqual({...control},{paused:0,reason:'Existing owner review',actor:'fictional-owner'});
 const count=f.calls.length;await executeSourceTask(env,'bad-snapshot',source.id,{readBoard});assert.equal(f.calls.length,count);
 reject=false;await start(env,'later-complete');assert.equal((await executeSourceTask(env,'later-complete',source.id,{readBoard})).state,'published');
 assert.equal(f.calls.length-count,3);assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM agent_reviews WHERE state='resolved'").get().n,1);
 assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,150);
 assert.equal(sourceFailureHistory(env.sql.prepare("SELECT evidence FROM agent_tasks WHERE run_id='bad-snapshot'").get().evidence).length,1);
});
