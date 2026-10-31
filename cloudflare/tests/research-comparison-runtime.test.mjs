import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {referenceSet} from '../worker/research-reference.js';
import {candidateReferenceProfile} from '../worker/research-candidate.js';
const models={investigator:{provider:'cloudflare',model:'@cf/zai-org/glm-4.7-flash'},reviewer:{provider:'cloudflare',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}};
const hash=x=>createHash('sha256').update(x).digest('hex');

test('actual auth, D1 and ResearchWorkflow preserve the original and execute only the separately resumed fictional comparison',{timeout:60000},async()=>{
  const manifest=structuredClone(referenceSet),records=manifest.cases.map(c=>{const description='FICTIONAL LOCAL ONLY. We may provide visa sponsorship for this role.';const r={id:c.id,description,title:'Fictional engineer',company:'LOCAL QA',apply_url:'https://example.test/'+c.id,last_seen:'2026-10-08',content_hash:hash(description)};c.content_hash=r.content_hash;c.record_hash=hash(JSON.stringify(r));return r;});
  const profiles=[];
  for(const minify of [false,true]){
    const result=await build({stdin:{contents:`import worker from './worker/index.js';import {ResearchWorkflow} from './worker/research-workflow.js';import {candidateReferenceProfile} from './worker/research-candidate.js';import {researchModels} from './worker/research-model.js';import {startInvestigation} from './worker/agent-research.js';
      let calls=0;function local(e){return {...e,RESEARCH_WORKFLOW:{create:async()=>({})},AI:{run:async(model,input)=>{calls++;const d=JSON.parse(input.messages[1].content);if(model===e.AI_MODEL)return {response:{assessments:d.evidence.map(x=>({job_id:x.id,verdict:'conditional',quote_id:'q1',reason:'Fictional historical conditional wording.'})),summary_claims:[{claim_id:'s1',text:'The historical fictional adverts included conditional wording.',citations:d.evidence.map(x=>({job_id:x.id,quote_id:'q1'}))}],next_checks:[]}};return {response:{checks:d.proposed.assessments.map(x=>({job_id:x.job_id,supported:true,reason:'Full fictional text supports this.'})),summary_checks:d.proposed.summary_claims.map(x=>({claim_id:x.claim_id,supported:true,reason:'Historical scope checked.'})),next_check_checks:[]}};}}};}
      export class ResearchFixture extends ResearchWorkflow {constructor(ctx,env){super(ctx,local(env));}}
      export default {async fetch(r,e,c){const path=new URL(r.url).pathname;if(path==='/fixture/profile')return Response.json(candidateReferenceProfile(researchModels(e)));if(path==='/fixture/status')return Response.json(await(await e.RESEARCH_TEST.get(new URL(r.url).searchParams.get('id'))).status());if(path==='/fixture/workflow'){const env=local(e);const run=await startInvestigation(env,'fixture-owner','evaluation','end_to_end','next');await e.RESEARCH_TEST.create({id:run.id,params:{runId:run.id}});return Response.json({run});}return worker.fetch(r,local(e),c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},plugins:[{name:'fictional-reference-only',setup(b){b.onLoad({filter:/\/reference-manifest\.js$/},()=>({contents:'export const REFERENCE_SET='+JSON.stringify(manifest),loader:'js'}));}}],bundle:true,minify,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
    let outbound=0;const origin='http://127.0.0.1:8788';
    const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'reference-comparison-isolated'},workflows:{RESEARCH_TEST:{name:'reference-comparison-isolated',className:'ResearchFixture'}},bindings:{AUTH_SECRET:'fictional-local-reference-secret',APP_ORIGIN:origin,AI_MODEL:models.investigator.model,AI_REVIEW_MODEL:models.reviewer.model},outboundService:()=>{outbound++;throw Error('No external I/O');}}));
    try{
      const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const s=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(s.length)await db.batch(s);}
      await db.batch([db.prepare("INSERT INTO research_reference_control(singleton,campaign,enabled) VALUES(1,?,1)").bind(manifest.id),db.prepare("INSERT INTO business_controls(singleton,enabled,research,updated_at) VALUES(1,1,1,'2026-10-11')"),...records.map(r=>db.prepare('INSERT INTO agent_reference_cases VALUES(?,?,?)').bind(manifest.id,r.id,JSON.stringify(r))),db.prepare("INSERT INTO agent_investigations(id,kind,state,actor,created_at,policy,models,reference_batch,calls) VALUES('retained-original','evaluation','failed','fictional-owner','2026-10-10','investigator-v3-cited-claim-review',?,?,1)").bind(JSON.stringify(models),manifest.batches[1].id)]);
      const original=await db.prepare("SELECT * FROM agent_investigations WHERE id='retained-original'").first();
      const profile=await(await mf.dispatchFetch(origin+'/fixture/profile')).json();profiles.push(profile);assert.deepEqual(profile,candidateReferenceProfile(models));
      const signup=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional Owner',email:'owner@example.invalid',password:'Fictional-reference-257!'})});assert.equal(signup.status,200);
      const account=await signup.json(),cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(account.user.id,new Date().toISOString()).run();
      const path='/api/admin/agents/research/reference',body={source_sha256:profile.source_sha256,action:'prepare',expected_revision:0,request_id:randomUUID(),reason:'Agent-assisted fictional runtime review. Retain the old failure and prepare the unchanged cohort as a paused separate comparison.'};
      const post=(value,headers={})=>mf.dispatchFetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
      assert.equal((await post(body,{Cookie:''})).status,403);assert.equal((await post(body,{Origin:'https://elsewhere.invalid'})).status,403);
      assert.equal((await post(body)).status,200);assert.equal((await(await post(body)).json()).reused,true);
      assert.equal((await db.prepare('SELECT enabled FROM research_reference_control').first()).enabled,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_research_budget').first()).n,0);
      assert.deepEqual(await db.prepare("SELECT * FROM agent_investigations WHERE id='retained-original'").first(),original);
      assert.equal((await post({...body,action:'resume',expected_revision:1,request_id:randomUUID()})).status,200);
      const executionResponse=await mf.dispatchFetch(origin+'/fixture/workflow');const executionText=await executionResponse.text();assert.equal(executionResponse.status,200,executionText);const execution=JSON.parse(executionText);let state;for(let i=0;i<150;i++){state=await(await mf.dispatchFetch(origin+'/fixture/status?id='+execution.run.id)).json();if(['complete','errored','terminated'].includes(state.status))break;await new Promise(r=>setTimeout(r,100));}assert.equal(state?.status,'complete',JSON.stringify(state));assert.equal((await db.prepare('SELECT state FROM agent_investigations WHERE id=?').bind(execution.run.id).first()).state,'review');assert.equal((await db.prepare('SELECT calls FROM agent_research_budget').first()).calls,2);
      const report=JSON.parse((await db.prepare('SELECT report FROM agent_investigations WHERE id=?').bind(execution.run.id).first()).report);assert.equal(report.publication,'none');assert.equal(report.human_review_required,true);
      const snapshot=await(await mf.dispatchFetch(origin+'/api/admin/agents/research',{headers:{Cookie:cookie}})).json();assert.equal(snapshot.reference_comparison.original.state,'needs_attention');assert.equal(snapshot.reference_comparison.candidate.completed_batches,1);
      assert.equal(outbound,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_research_memory').first()).n,0);
    }finally{await mf.dispose();}
  }
  assert.deepEqual(profiles[0],profiles[1]);
});
