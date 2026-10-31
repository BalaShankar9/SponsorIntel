import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {database} from './research-db.mjs';
import {REFERENCE_SET} from '../worker/reference-manifest.js';
import {scopeProfile,scopeSnapshot} from '../worker/research-scope.js';
import {reviewScope} from '../worker/research-scope-controls.js';
import {scopeAPI} from '../worker/research-scope-api.js';
import {scheduleScopeResearch,scopeModelStep} from '../worker/research-scope-runtime.js';
import {prepareCase,resolveExtraction,evaluateReview} from '../worker/research-scope-contract.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
async function setup(t){
 const env=database(t);let calls=0,starts=0;
 env.AI_MODEL='@cf/zai-org/glm-4.7-flash';env.AI_REVIEW_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';env.RESEARCH_WORKFLOW={create:async()=>{starts++;return {};}};env.AI={run:async()=>{calls++;throw Error('Unexpected external call');}};
 const original=structuredClone(REFERENCE_SET.cases);t.after(()=>original.forEach((c,i)=>Object.assign(REFERENCE_SET.cases[i],c)));
 for(const c of REFERENCE_SET.cases){const r={id:c.id,description:'Fictional local complete advert. Visa sponsorship is conditional.',title:'Fictional role',company:'LOCAL QA',apply_url:'https://example.test/'+c.id};c.record_hash=sha(JSON.stringify(r));c.content_hash=sha(r.description);env.sql.prepare('INSERT INTO agent_reference_cases VALUES(?,?,?)').run(REFERENCE_SET.id,c.id,JSON.stringify(r));}
 env.sql.exec("UPDATE business_controls SET enabled=1,research=1");
 env.sql.prepare("INSERT INTO agent_investigations(id,kind,state,actor,created_at,policy,models,reference_batch,calls) VALUES('old-failure','evaluation','failed','fixture','2026-10-17','old','{}',?,1)").run(REFERENCE_SET.batches[1].id);
 const request=(action,revision)=>({action,expected_revision:revision,expected_reference_revision:0,source_sha256:scopeProfile(env).source_sha256,request_id:randomUUID(),reason:'Agent-assisted fictional local review. Preserve old results, controls, provider outcomes and spending limits.'});
 await reviewScope(env,'fixture',request('prepare',0));await reviewScope(env,'fixture',request('resume',1));
 return {env,request,spent:()=>({calls,starts})};
}
test('scope admission preserves exhausted shared budgets and the consumed daily hold',async t=>{
 const {env,spent}=await setup(t),day=new Date().toISOString().slice(0,10);
 env.sql.prepare('INSERT INTO agent_research_budget VALUES(?,3,29)').run(day);
 assert.equal((await scheduleScopeResearch(env)).state,'held');assert.deepEqual(spent(),{calls:0,starts:0});
 assert.deepEqual({...env.sql.prepare('SELECT * FROM agent_research_budget').get()},{day,runs:3,calls:29});
 assert.equal((await scheduleScopeResearch(env)).state,'held');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_investigations WHERE scope_profile IS NOT NULL').get().n,0);
 await assert.rejects(scheduleScopeResearch(env,Date.now()+86400000),/fabricated/);
});
test('pause racing with reservation atomically rolls back both call counters before provider I/O',async t=>{
 const {env,spent}=await setup(t),dispatch=await scheduleScopeResearch(env);assert.equal(dispatch.state,'started');
 env.sql.prepare("UPDATE agent_investigations SET state='running' WHERE id=?").run(dispatch.id);
 const before=env.sql.prepare('SELECT * FROM agent_research_budget').get(),batch=env.DB.batch;
 env.DB.batch=async stmts=>{env.sql.exec('UPDATE research_scope_control SET enabled=0');return batch(stmts);};
 await assert.rejects(scopeModelStep(env,dispatch.id,'extract-0',0,'investigator'),/paused/);
 assert.deepEqual(env.sql.prepare('SELECT * FROM agent_research_budget').get(),before);assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations WHERE id=?').get(dispatch.id).calls,0);assert.deepEqual(spent(),{calls:0,starts:1});
});
test('scope pins source configuration and forbids retry of an existing uncertain call',async t=>{
 const {env,spent}=await setup(t),dispatch=await scheduleScopeResearch(env);env.sql.prepare("UPDATE agent_investigations SET state='running' WHERE id=?").run(dispatch.id);
 env.sql.prepare("INSERT INTO agent_research_steps(run_id,name,role,state,created_at) VALUES(?,'extract-0','investigator','calling',?)").run(dispatch.id,new Date().toISOString());
 await assert.rejects(scopeModelStep(env,dispatch.id,'extract-0',0,'investigator'),/retry/);
 assert.equal((await scopeSnapshot(env)).state,'needs_attention');assert.deepEqual(spent(),{calls:0,starts:1});
 env.AI_MODEL='different-model';await assert.rejects(scopeModelStep(env,dispatch.id,'extract-0',0,'investigator'),/configuration/);
 assert.equal((await scopeSnapshot(env)).state,'needs_attention');
});
test('runtime contract distinguishes non-visa subjects and preserves incomplete/critic holds',()=>{
 const source=prepareCase({id:'fictional',title:'Local role',company:'LOCAL QA',description:'We cannot sponsor an export licence. We may sponsor a visa for this role.',apply_url:'https://example.test/job'},'2026-10-08');
 for(const subject of ['export_authorisation','professional_training','commercial','unspecified']){const x=resolveExtraction({job_id:source.job_id,complete:true,facts:[{id:'f1',subject,stance:'refused',scope:'this_role',quote_ids:['q1'],reason:'Non-visa statement.'}]},source);assert.equal(x.provisional_label,'not_stated');}
 const x=resolveExtraction({job_id:source.job_id,complete:false,facts:[]},source);assert.equal(x.provisional_label,null);
 const review={job_id:source.job_id,checks:[],coverage:{supported:true,reason:'Fictional acknowledgment.'},label:{supported:true,reason:'Unresolved label.'}};
 assert.equal(evaluateReview(review,x,source).accepted,false);assert.equal(evaluateReview(review,x,source).publishable,false);
 assert.throws(()=>resolveExtraction({job_id:source.job_id,complete:true,facts:[{id:'f1',subject:'work_visa',stance:'offered',scope:'this_role',quote_ids:['q999'],reason:'Invalid source.'}]},source),/Unknown source/);
});
test('a committed scope review with a lost acknowledgement returns uncertainty and exact replay does not append another decision',async t=>{
 const {env,request,spent}=await setup(t),body=request('pause',2),batch=env.DB.batch;
 env.DB.batch=async statements=>{const result=await batch(statements);env.DB.batch=batch;throw Error('D1_ERROR: fictional lost acknowledgement');};
 const send=()=>scopeAPI(new Request('https://sponsorintel.london/api/admin/agents/research/scope',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify(body)}),env,{user:{id:'fixture'}});
 const lost=await send();assert.equal(lost.status,503);assert.match((await lost.json()).error,/same request/);
 const again=await send();assert.equal(again.status,200);assert.equal((await again.json()).reused,true);
 assert.equal(env.sql.prepare('SELECT revision FROM research_scope_control').get().revision,3);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM research_scope_reviews').get().n,3);
 assert.deepEqual(spent(),{calls:0,starts:0});
});
