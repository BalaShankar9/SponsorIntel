import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {provider} from './fixtures/teaching-scout.mjs';

test('discovery step executes in an actual Cloudflare Workflow and D1; duplicate invocation has no outbound I/O',{timeout:60000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {WorkflowEntrypoint} from 'cloudflare:workers';
 import {scoutTeachingVacancies} from './worker/discovery-scout.js';
 export class ScoutFixture extends WorkflowEntrypoint {async run(event,step){return step.do('discover-daily-education-leads',{retries:{limit:0,delay:'1 second'},timeout:'3 minutes'},()=>scoutTeachingVacancies(this.env,event.payload.runId));}}
 export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/start')return Response.json(await env.SCOUT.create({id:'fictional-scout',params:{runId:'fictional-business'}}));if(path==='/status')return Response.json(await(await env.SCOUT.get('fictional-scout')).status());return Response.json(await scoutTeachingVacancies(env,'fictional-business'));}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const now=Date.now(),fixture=provider(now),mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'discovery-scout-isolated'},workflows:{SCOUT:{name:'discovery-scout-isolated',className:'ScoutFixture'}},outboundService:request=>fixture.fetch(request.url,{redirect:'manual'})}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  await db.batch([db.prepare('INSERT INTO business_controls(singleton,updated_at) VALUES(1,?)').bind(new Date(now).toISOString()),db.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('fictional-business','running',?)").bind(new Date(now).toISOString())]);
  assert.equal((await mf.dispatchFetch('http://localhost/start')).status,200);
  let state;for(let i=0;i<150;i++){state=await(await mf.dispatchFetch('http://localhost/status')).json();if(['complete','errored','terminated'].includes(state.status))break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(state?.status,'complete',JSON.stringify(state));
  const run=await db.prepare('SELECT * FROM discovery_scout_runs').first();assert.equal(run.state,'completed');assert.equal(run.retained,2);assert.equal(run.requests,3);assert.equal(fixture.calls.length,3);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM discovery_revisions').first()).n,2);assert.equal((await db.prepare('SELECT COUNT(*) n FROM jobs').first()).n,0);
  const replay=await(await mf.dispatchFetch('http://localhost/replay')).json();assert.equal(replay.replayed,true);assert.equal(fixture.calls.length,3);assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,4);
 }finally{await mf.dispose();}
});
