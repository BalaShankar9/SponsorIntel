import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSourceDiagnostic,sourceFailureHistory} from '../shared/source-diagnostics.js';
import {SourceCheckError,sourceDiagnostic,withSourceContext} from '../worker/source-errors.js';
import {sourceDatabase} from './helpers/source-d1.mjs';
import {source,posting,provider} from './fixtures/smartrecruiters.mjs';
import {collectSmartRecruiters} from '../worker/smartrecruiters.js';
import {fetchBoard} from '../worker/jobs.js';
import {dispatchSources,initialiseRun,executeSourceTask,operationsSnapshot,SourceRetry} from '../worker/agent-operations.js';

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

test('three invalid advert attempts retain a precise safe history, spend bounded reservations and replay without fetching',async t=>{
 const env=sourceDatabase(t),f=provider([posting(1)],(value,u)=>{if(!u.search)delete value.jobAd.sections.qualifications;return value;});
 await start(env,'invalid-advert');const readBoard=(b,c)=>fetchBoard(b,{...c,fetcher:f.fetcher});
 for(let i=0;i<2;i++)await assert.rejects(executeSourceTask(env,'invalid-advert',source.id,{readBoard}),SourceRetry);
 assert.equal((await executeSourceTask(env,'invalid-advert',source.id,{readBoard})).state,'failed');
 const failures=sourceFailureHistory(task(env).evidence);assert.equal(failures.length,3);
 assert.deepEqual(failures.map(({attempt,checked_at,...rest})=>rest),Array(3).fill({code:'invalid_sections',phase:'description',posting_ref:posting(1).id,requests:2}));
 assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,150);assert.equal(f.calls.length,6);
 await executeSourceTask(env,'invalid-advert',source.id,{readBoard});assert.equal(f.calls.length,6);
 const snapshot=await operationsSnapshot(env);assert.equal(snapshot.diagnostics[0].attempt_failures.length,3);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_FIXTURE'));
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
