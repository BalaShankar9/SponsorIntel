import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {applicationProfile} from '../worker/application-profile.js';
import old from '../worker/application-contracts/2026-10-08-v1/manifest.json' with {type:'json'};

test('complete Worker builds keep the source profile stable; actual auth/D1 prepares a paused version once with no external actions',{timeout:60000},async()=>{
 const profiles=[];
 for(const minify of [false,true]){
  const observer=await build({stdin:{contents:`import worker from './worker/index.js';import {applicationProfile} from './worker/application-profile.js';import {dispatchApplicationEvaluation,initialiseApplicationEvaluation,applicationModelStep} from './worker/application-evaluation.js';let syntheticCalls=0;const unrelatedNames={text:'unrelated',draft:'bundler-name-noise'};export default {async fetch(r,e,c){if(new URL(r.url).pathname==='/fictional-test-profile')return Response.json({profile:await applicationProfile(e),noise:unrelatedNames});if(new URL(r.url).pathname==='/fictional-reservation'){const local={...e,APPLICATION_EVAL_WORKFLOW:{create:async()=>({})},AI:{run:async()=>{syntheticCalls++;return {response:'PROFILE\\nFictional candidate with source-described skills and a local academic project.\\nEXPERIENCE\\nMaintained records and documented the project.'};}}};const run=await dispatchApplicationEvaluation(local,'scheduled');await initialiseApplicationEvaluation(local,run.id);await applicationModelStep(local,run.id,'graduate-year','write');await applicationModelStep(local,run.id,'graduate-year','write');return Response.json({syntheticCalls,run});}return worker.fetch(r,e,c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,minify,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
  assert.ok(observer.outputFiles[0].text.length>100000);let outbound=0;const origin='http://127.0.0.1:8788';
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:observer.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'campaign-fixture'},bindings:{AUTH_SECRET:'fictional-local-only-campaign-secret',APP_ORIGIN:origin,AI_MODEL:old.profile.writer,AI_REVIEW_MODEL:old.profile.reviewer},outboundService:()=>{outbound++;throw Error('No external calls allowed');}}));
  try{
   const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const rows=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(rows.length)await db.batch(rows);}
   // Schema verifier returns DDL only, so use the same explicit singleton defaults as migrations.
   await db.batch([db.prepare("INSERT INTO application_eval_campaigns(id,created_at,reason) VALUES('legacy-v1','2026-10-11T00:00:00Z','Fictional migration boundary')"),db.prepare("INSERT INTO application_eval_campaign_control VALUES(1,'legacy-v1')"),db.prepare('INSERT INTO application_eval_controls(singleton,enabled) VALUES(1,0)'),db.prepare("INSERT INTO business_controls(singleton,enabled,updated_at) VALUES(1,1,'2026-10-11T00:00:00Z')")]);
   const p=await (await mf.dispatchFetch(origin+'/fictional-test-profile')).json();profiles.push(p.profile);assert.deepEqual(p.profile,await applicationProfile({AI_MODEL:old.profile.writer,AI_REVIEW_MODEL:old.profile.reviewer}));
   const signup=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional Owner',email:'owner@example.invalid',password:'Fictional-local-255!'})});assert.equal(signup.status,200);
   const owner=await signup.json(),cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),stamp=new Date().toISOString();await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.user.id,stamp).run();
   await db.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids) VALUES('historic','2026-10-10','scheduled','completed',?,?,?,'[]')").bind(stamp,stamp,JSON.stringify(old.profile)).run();
   await db.prepare("INSERT INTO agent_research_budget(day,runs,calls) VALUES('2026-10-11',2,6)").run();
   const path='/api/admin/application-evaluation';assert.equal((await mf.dispatchFetch(origin+path)).status,403);
   const snapshot=await (await mf.dispatchFetch(origin+path,{headers:{Cookie:cookie}})).json();assert.equal(snapshot.campaigns.proposal.can_prepare,true);
   const body={expected_campaign:'legacy-v1',fingerprint:snapshot.campaigns.proposal.fingerprint,reason:'Agent-assisted fictional runtime review. Request a candidate response schema; preserve previous results and remain paused until the separate scheduled comparison is explicitly resumed.',request_key:'runtime-campaign-request-001'};
   const post=async(headers={})=>mf.dispatchFetch(origin+path+'/campaign',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
   assert.equal((await post({Origin:'https://elsewhere.test'})).status,403);const first=await post();assert.equal(first.status,200);assert.equal((await first.json()).paused,true);assert.equal((await (await post()).json()).replayed,true);
   const current=await (await mf.dispatchFetch(origin+path,{headers:{Cookie:cookie}})).json();assert.equal(current.state,'paused');assert.equal(current.progress_state,'ready');assert.equal(current.pause_reason,'evaluation');assert.equal(current.business_enabled,true);assert.equal(current.evaluation_enabled,false);assert.equal(current.campaigns.proposal.can_prepare,false);assert.equal(current.runs[0].campaign_id,'legacy-v1');assert.equal((await db.prepare('SELECT COUNT(*) n FROM admin_audit WHERE action=?').bind('application-campaign-prepared').first()).n,1);
   assert.equal((await db.prepare('SELECT calls FROM agent_research_budget').first()).calls,6);assert.equal(outbound,0);
   const review={action:'resume',expected_campaign:current.campaigns.active.id,expected_revision:0,fingerprint:current.campaigns.proposal.fingerprint,reason:'Agent-assisted fictional full Worker review. Exact source profile, terminal earlier outcomes and shared allowance checked; preserve history and do not start any real model call.',request_key:crypto.randomUUID()};
   const settings=(body,headers={})=>mf.dispatchFetch(origin+path+'/settings',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
   assert.equal((await settings(review,{Cookie:''})).status,403);assert.equal((await settings(review,{Origin:'https://elsewhere.test'})).status,403);assert.equal((await settings({enabled:true})).status,400);
   const saves=await Promise.all([settings(review),settings(review)]);assert.ok(saves.every(r=>r.status===200));assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').first()).n,1);
   const paused=await settings({...review,action:'pause',fingerprint:null,expected_revision:1,request_key:crypto.randomUUID()});assert.equal(paused.status,200);
   const oldReplay=await(await settings(review)).json();assert.equal(oldReplay.replayed,true);assert.equal(oldReplay.current_enabled,false);assert.equal(oldReplay.current_revision,2);
   assert.equal((await settings({...review,expected_revision:0,request_key:crypto.randomUUID()})).status,409);
   assert.equal((await settings({...review,expected_revision:2,request_key:crypto.randomUUID()})).status,200);
   assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').first()).n,3);
   assert.equal((await db.prepare('SELECT calls FROM agent_research_budget').first()).calls,6);assert.equal(outbound,0);
   const runResult=await mf.dispatchFetch(origin+'/fictional-reservation');assert.equal(runResult.status,200);assert.equal((await runResult.json()).syntheticCalls,1);assert.equal((await db.prepare('SELECT calls FROM application_eval_runs WHERE campaign_id!=?').bind('legacy-v1').first()).calls,1);assert.equal(outbound,0);
  }finally{await mf.dispose();}
 }
 assert.deepEqual(profiles[0],profiles[1]);
});
