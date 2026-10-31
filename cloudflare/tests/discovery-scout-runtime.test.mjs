import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {provider,candidate,advert} from './fixtures/teaching-scout.mjs';

for(const sameSchool of [false,true])test('actual discovery Workflow/D1 retains distinct school identities and replays without I/O: '+(sameSchool?'two adverts from one school':'two schools'),{timeout:60000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {WorkflowEntrypoint} from 'cloudflare:workers';
 import {scoutTeachingVacancies} from './worker/discovery-scout.js';
 export class ScoutFixture extends WorkflowEntrypoint {async run(event,step){return step.do('discover-daily-education-leads',{retries:{limit:0,delay:'1 second'},timeout:'3 minutes'},()=>scoutTeachingVacancies(this.env,event.payload.runId,fetch,()=>event.payload.now||Date.now()));}}
 export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/start')return Response.json(await env.SCOUT.create({id:'fictional-scout',params:{runId:'fictional-business'}}));if(path==='/next')return Response.json(await env.SCOUT.create({id:'fictional-next',params:{runId:'fictional-next',now:Number(new URL(request.url).searchParams.get('now'))}}));if(path==='/status-next')return Response.json(await(await env.SCOUT.get('fictional-next')).status());if(path==='/status')return Response.json(await(await env.SCOUT.get('fictional-scout')).status());return Response.json(await scoutTeachingVacancies(env,'fictional-business'));}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const now=Date.now(),deadline=new Date(now+2*86400000).toISOString(),fixture=provider(now,{first:[candidate(1),candidate(2),candidate(3),candidate(4)],pages:{
  [candidate(1).url]:advert(candidate(1),now,{validThrough:deadline}),
  ...(sameSchool?{[candidate(2).url]:advert(candidate(2),now,{hiringOrganization:{name:'Fictional school 1',identifier:'123451'}})}:{}),
 }}),mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'discovery-scout-isolated'},workflows:{SCOUT:{name:'discovery-scout-isolated',className:'ScoutFixture'}},outboundService:request=>fixture.fetch(request.url,{redirect:'manual'})}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  await db.batch([db.prepare('INSERT INTO business_controls(singleton,updated_at) VALUES(1,?)').bind(new Date(now).toISOString()),db.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('fictional-business','running',?)").bind(new Date(now).toISOString())]);
  assert.equal((await mf.dispatchFetch('http://localhost/start')).status,200);
  let state;for(let i=0;i<150;i++){state=await(await mf.dispatchFetch('http://localhost/status')).json();if(['complete','errored','terminated'].includes(state.status))break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(state?.status,'complete',JSON.stringify(state));
  const run=await db.prepare('SELECT * FROM discovery_scout_runs').first();assert.equal(run.state,'completed');assert.equal(run.retained,sameSchool?1:2);assert.equal(run.requests,3);assert.equal(fixture.calls.length,3);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM discovery_revisions').first()).n,sameSchool?1:2);assert.equal((await db.prepare('SELECT COUNT(*) n FROM jobs').first()).n,0);
  const saved=JSON.parse((await db.prepare('SELECT r.content FROM discovery_revisions r JOIN discovery_leads l ON l.id=r.lead_id WHERE l.source_url=?').bind(candidate(1).url).first()).content);
  assert.equal(saved.deadline,deadline);assert.equal(saved.follow_up_at,new Date(now+86400000).toISOString());
  const replay=await(await mf.dispatchFetch('http://localhost/replay')).json();assert.equal(replay.replayed,true);assert.equal(fixture.calls.length,3);assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,4);
  const priorItems=(await db.prepare('SELECT * FROM discovery_scout_items ORDER BY source_url').all()).results,priorRevisions=(await db.prepare('SELECT * FROM discovery_revisions ORDER BY id').all()).results,later=now+86400000,nextDay=new Date(later).toISOString().slice(0,10);
  await db.batch([db.prepare("UPDATE business_runs SET state='completed'"),db.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('fictional-next','running',?)").bind(new Date(later).toISOString())]);
  assert.equal((await mf.dispatchFetch('http://localhost/next?now='+later)).status,200);
  for(let i=0;i<150;i++){state=await(await mf.dispatchFetch('http://localhost/status-next')).json();if(['complete','errored','terminated'].includes(state.status))break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(state?.status,'complete',JSON.stringify(state));
  const next=await db.prepare('SELECT * FROM discovery_scout_runs WHERE day=?').bind(nextDay).first();assert.equal(next.retained,2);assert.equal(next.inspected,2);assert.equal(next.requests,3);assert.equal(next.reserved_requests,4);
  assert.deepEqual(fixture.calls.slice(3).map(x=>x.url),[fixture.calls[0].url,candidate(3).url,candidate(4).url]);
  const skips=(await db.prepare("SELECT * FROM discovery_scout_items WHERE day=? AND json_extract(evidence,'$.selection')='known_advert_skipped'").bind(nextDay).all()).results;assert.equal(skips.length,2);
  assert.deepEqual((await db.prepare('SELECT * FROM discovery_scout_items WHERE day=? ORDER BY source_url').bind(run.day).all()).results,priorItems);
  for(const revision of priorRevisions)assert.deepEqual(await db.prepare('SELECT * FROM discovery_revisions WHERE id=?').bind(revision.id).first(),revision);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM jobs').first()).n,0);
 }finally{await mf.dispose();}
});
