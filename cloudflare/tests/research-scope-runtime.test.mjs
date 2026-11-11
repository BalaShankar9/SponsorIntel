import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {REFERENCE_SET} from '../worker/reference-manifest.js';
import {verifyScopeSource} from '../scripts/research-scope-source.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');

test('scope deployment manifest pins runtime, controls, source and admission guards',async()=>{assert.match((await verifyScopeSource()).sha256,/^[a-f0-9]{64}$/);});
test('isolated actual Worker, auth, D1 and Workflow keep paired scope calls finite, replay-safe and private',{timeout:90000},async()=>{
 const manifest=structuredClone(REFERENCE_SET),records=manifest.cases.map(c=>{const description='FICTIONAL LOCAL ONLY. We may provide visa sponsorship for this role.';const r={id:c.id,description,title:'Fictional engineer',company:'LOCAL QA',apply_url:'https://example.test/'+c.id};c.content_hash=hash(description);c.record_hash=hash(JSON.stringify(r));return r;});
 const built=await build({stdin:{contents:`import worker from './worker/index.js';import {ResearchWorkflow} from './worker/research-entrypoint.js';import {scheduleScopeResearch,scopeModelStep} from './worker/research-scope-runtime.js';
 function local(e){return {...e,RESEARCH_WORKFLOW:{create:async data=>{const instance=await e.RESEARCH_TEST.create(data);if(e.MODE==='lost_ack')throw Error('fixture lost create acknowledgement');return instance;}},AI:{run:async(model,input)=>{
 const d=JSON.parse(input.messages[1].content);if(JSON.stringify(d).includes('accepted_labels')||JSON.stringify(d).includes('stored_verdict'))throw Error('Answer key leaked');
 if(e.MODE==='length')return {choices:[{finish_reason:'length'}],usage:{completion_tokens:8192}};
 if(e.MODE==='pause')await e.DB.prepare('UPDATE research_scope_control SET enabled=0').run();
 if(e.MODE==='late'){await e.DB.prepare("UPDATE agent_investigations SET state='failed',finished_at=?,error='Fictional provider timeout.' WHERE scope_profile IS NOT NULL AND state='running'").bind(new Date().toISOString()).run();}
 if(model===e.AI_MODEL)return {response:{job_id:d.evidence.job_id,complete:true,facts:[{id:'f1',subject:'work_visa',stance:'conditional',scope:'this_role',quote_ids:['q1'],reason:'Fictional conditional visa wording.'}]}};
 return {response:{job_id:d.evidence.job_id,checks:[{fact_id:'f1',supported:true,reason:'Full fictional source supports this.'}],coverage:{supported:true,reason:'Complete fictional statement covered.'},label:{supported:true,reason:'Conditional fictional wording.'}}};}}};}
 export class ScopeFixture extends ResearchWorkflow{constructor(ctx,e){super(ctx,local(e));}}
 export default {async fetch(r,e,c){const p=new URL(r.url).pathname;if(p==='/fixture/schedule')return Response.json(await scheduleScopeResearch(local(e)));if(p==='/fixture/status')return Response.json(await(await e.RESEARCH_TEST.get(new URL(r.url).searchParams.get('id'))).status());if(p==='/fixture/replay'){try{return Response.json(await scopeModelStep(local(e),new URL(r.url).searchParams.get('id'),'extract-0',0,'investigator'));}catch{return new Response('Held',{status:409});}}return worker.fetch(r,local(e),c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},plugins:[{name:'fictional-frozen-records',setup(b){b.onLoad({filter:/\/reference-manifest\.js$/},()=>({contents:'export const REFERENCE_SET='+JSON.stringify(manifest),loader:'js'}));}}],bundle:true,minify:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 for(const mode of ['normal','length','late','lost_ack','pause']){
  const origin='http://127.0.0.1:8788';let outbound=0;
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'scope-'+mode},workflows:{RESEARCH_TEST:{name:'scope-'+mode,className:'ScopeFixture'}},bindings:{MODE:mode,AUTH_SECRET:'fictional-local-scope-secret',APP_ORIGIN:origin,AI_MODEL:'@cf/zai-org/glm-4.7-flash',AI_REVIEW_MODEL:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'},outboundService:()=>{outbound++;throw Error('No external I/O');}}));
  try{
   const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
   await db.batch([db.prepare('INSERT INTO research_scope_control(singleton) VALUES(1)'),db.prepare('INSERT INTO research_reference_control(singleton,campaign,enabled) VALUES(1,?,1)').bind(manifest.id),db.prepare("INSERT INTO business_controls(singleton,enabled,research,updated_at) VALUES(1,1,1,'2026-10-11')"),...records.map(r=>db.prepare('INSERT INTO agent_reference_cases VALUES(?,?,?)').bind(manifest.id,r.id,JSON.stringify(r))),db.prepare("INSERT INTO agent_investigations(id,kind,state,actor,created_at,policy,models,reference_batch,calls) VALUES('retained-original','evaluation','failed','fictional-owner','2026-10-10','old-policy','{}',?,1)").bind(manifest.batches[1].id)]);
   const original=await db.prepare("SELECT * FROM agent_investigations WHERE id='retained-original'").first();
   const signup=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional Owner',email:'owner@example.invalid',password:'Fictional-scope-257!'})});assert.equal(signup.status,200);
   const account=await signup.json(),cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(account.user.id,new Date().toISOString()).run();
   const path='/api/admin/agents/research/scope',get=async()=>{const r=await mf.dispatchFetch(origin+path,{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
   const snapshot=await get();assert.equal(snapshot.state,'not_prepared');
   const body={source_sha256:snapshot.source_sha256,action:'prepare',expected_revision:0,expected_reference_revision:0,request_id:randomUUID(),reason:'Agent-assisted fictional runtime review retains old failure, reviewed source and all historical evidence.'};
   const post=(value,headers={})=>mf.dispatchFetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
   assert.equal((await post(body,{Cookie:''})).status,403);assert.equal((await post(body,{Origin:'https://elsewhere.invalid'})).status,403);
   assert.equal((await post({...body,source_sha256:'changed'})).status,400);
   assert.equal((await post({...body,expected_reference_revision:99})).status,400);
   const prepared=await post(body);assert.equal(prepared.status,200,await prepared.text());assert.equal((await(await post(body)).json()).reused,true);
   assert.equal((await post({...body,reason:body.reason+' changed'})).status,400);
   assert.equal((await get()).state,'paused');assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_research_budget').first()).n,0);
   await assert.rejects(db.prepare("UPDATE research_reference_control SET enabled=0").run(),/historical/);
   await assert.rejects(db.prepare('UPDATE research_scope_control SET prepared=0').run(),/reset/);
   await assert.rejects(db.prepare("UPDATE agent_investigations SET state='running' WHERE id='retained-original'").run(),/restart/);
   await assert.rejects(db.prepare("INSERT INTO agent_research_steps(run_id,name,role,state,created_at) VALUES('retained-original','bypass','investigator','calling','2026-10-23')").run(),/bypass/);
   const resume={...body,action:'resume',expected_revision:1,request_id:randomUUID()};
   const raced=await Promise.all([post(resume),post({...resume,request_id:randomUUID()})]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,400]);
   const dispatches=await Promise.all([mf.dispatchFetch(origin+'/fixture/schedule'),mf.dispatchFetch(origin+'/fixture/schedule')]);
   const dispatch=await dispatches[0].json(),second=await dispatches[1].json();const id=dispatch.id||dispatch.research_id||second.id||second.research_id;assert.ok(id,JSON.stringify([dispatch,second]));
   let status;for(let i=0;i<300;i++){status=await(await mf.dispatchFetch(origin+'/fixture/status?id='+id)).json();if(['complete','errored','terminated'].includes(status.status))break;await new Promise(r=>setTimeout(r,50));}assert.equal(status?.status,'complete',JSON.stringify(status));
   const run=await db.prepare('SELECT * FROM agent_investigations WHERE id=?').bind(id).first(),budget=await db.prepare('SELECT * FROM agent_research_budget').first();
   assert.equal(budget.runs,1);assert.equal(run.calls,budget.calls);assert.equal(budget.calls,['normal','lost_ack'].includes(mode)?4:1);assert.equal(run.state,['normal','lost_ack'].includes(mode)?'review':'failed');
   const steps=await db.prepare('SELECT * FROM agent_research_steps WHERE run_id=? ORDER BY name').bind(id).all();
   if(mode==='late')assert.equal(steps.results[0].state,'late_completed');
   if(mode==='length'){assert.equal(steps.results[0].state,'failed');assert.equal(JSON.parse(steps.results[0].output).completion.failure_stage,'incomplete_response');}
   if(run.state==='review'){const report=JSON.parse(run.report);assert.equal(report.scope_cases.length,2);assert.equal(report.scope_cases[0].outcome.publishable,false);assert.equal(report.quality.accepted,true);assert.equal(report.scope_cases[0].source.source_blocks.map(q=>q.text).join(''),records[0].description);}
   assert.equal((await mf.dispatchFetch(origin+'/fixture/replay?id='+id)).status,409);
   await mf.dispatchFetch(origin+'/fixture/schedule');assert.deepEqual(await db.prepare('SELECT * FROM agent_research_budget').first(),budget);
   await assert.rejects(db.prepare("UPDATE agent_investigations SET state='running' WHERE id=?").bind(id).run(),/terminal/);
   await assert.rejects(db.prepare("UPDATE agent_research_steps SET output='{}' WHERE run_id=?").bind(id).run(),/immutable/);
   await assert.rejects(db.prepare('DELETE FROM agent_research_steps WHERE run_id=?').bind(id).run(),/deleted/);
   assert.deepEqual(await db.prepare("SELECT * FROM agent_investigations WHERE id='retained-original'").first(),original);
   const current=await get();assert.equal(current.evaluated_adverts,run.state==='review'?2:0);
   const pause=await post({...body,action:'pause',expected_revision:2,request_id:randomUUID()});assert.equal(pause.status,200,await pause.text());
   assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_research_memory').first()).n,0);assert.equal(outbound,0);
  }finally{await mf.dispose();}
 }
});
