import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

for(const retry of [false,true])test('actual SourceWorkflow '+(retry?'retains the ordinary retry delay and reservations':'waits for another lease without clearing it or fetching early'),{timeout:75000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {dispatchSources} from './worker/agent-operations.js'; export {SourceWorkflow} from './worker/source-workflow.js'; export default {async fetch(r,e){if(new URL(r.url).pathname==='/start')return Response.json(await dispatchSources(e,{id:'fictional-wait',sourceId:'monzo'}));return Response.json(await(await e.SOURCE_WORKFLOW.get('fictional-wait')).status());}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const calls=[];
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-source-wait'},workflows:{SOURCE_WORKFLOW:{name:'fictional-source-wait',className:'SourceWorkflow'}},outboundService:r=>{
  assert.equal(r.url,'https://boards-api.greenhouse.io/v1/boards/monzo/jobs?content=true');calls.push(Date.now());
  if(retry&&calls.length===1)return new Response('unavailable',{status:503});
  return Response.json({jobs:[{id:123,title:'Fictional QA analyst',location:{name:'London'},content:'Fictional UK vacancy for validating this isolated source workflow. Visa sponsorship is not available for this role.',absolute_url:'https://job-boards.greenhouse.io/monzo/jobs/123'}],meta:{total:1}});
 }}));
 try {
  const db=await mf.getD1Database('DB'),schema=migrationSchema();for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const expires=Date.now()+2500;
  if(!retry)await db.prepare("INSERT INTO feed_locks VALUES('jobs','fictional-existing-owner',?)").bind(expires).run();
  assert.equal((await mf.dispatchFetch('https://fixture.test/start')).status,200);
  if(!retry) {
   await new Promise(r=>setTimeout(r,250));assert.equal(calls.length,0);
   assert.equal((await db.prepare("SELECT owner FROM feed_locks WHERE name='jobs'").first()).owner,'fictional-existing-owner');
   assert.equal((await db.prepare('SELECT requests FROM agent_runs').first()).requests,0);
  }
  let state;for(let i=0;i<300;i++){state=await(await mf.dispatchFetch('https://fixture.test/status')).json();if(['complete','errored','terminated'].includes(state.status))break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(state.status,'complete',JSON.stringify(state));
  assert.equal(calls.length,retry?2:1);
  if(retry)assert.ok(calls[1]-calls[0]>=30000);else assert.ok(calls[0]>expires);
  const task=await db.prepare('SELECT state,attempts FROM agent_tasks').first();assert.equal(task.state,'published');assert.equal(task.attempts,retry?2:1);
  assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,retry?2:1);
  await mf.dispatchFetch('https://fixture.test/start');assert.equal(calls.length,retry?2:1);
  console.log(JSON.stringify({fixture:retry?'ordinary retry':'owned lease wait',requests:calls.length,task_attempts:task.attempts,delay_ms:retry?calls[1]-calls[0]:calls[0]-expires}));
 }finally{await mf.dispose();}
});
