import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {database} from './research-db.mjs';
import {referenceSet,candidateReferenceSet,referenceEvidence,referenceProgress} from '../worker/research-reference.js';
import {reviewReferenceComparison,referenceComparisonSnapshot} from '../worker/research-reference-controls.js';
import {candidateReferenceProfile,compactReferenceEvidence,RESEARCH_CANDIDATE_POLICY} from '../worker/research-candidate.js';
import {researchModels} from '../worker/research-model.js';
import {evidenceWithQuotes,resolveReport} from '../worker/research-contract.js';
import {startInvestigation,researchContext,analyseResearch,reviewResearch,finishResearch,approveObservation} from '../worker/agent-research.js';
import {scheduleBusinessResearch} from '../worker/business-operations.js';
import {verifyResearchSource} from '../scripts/research-source.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const reason='Agent-assisted local fictional review of the stopped attempt; no production evidence or calls.';
const request=(action,expected_revision)=>({action,expected_revision,request_id:randomUUID(),reason,source_sha256:candidateReferenceProfile({investigator:{provider:'cloudflare',model:'@cf/zai-org/glm-4.7-flash'},reviewer:{provider:'cloudflare',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}}).source_sha256});
function setup(t){
  const env=database(t);env.RESEARCH_WORKFLOW={create:async()=>({})};
  env.AI_MODEL='@cf/zai-org/glm-4.7-flash';env.AI_REVIEW_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const originals=referenceSet.cases.map(x=>({...x}));t.after(()=>originals.forEach((x,i)=>Object.assign(referenceSet.cases[i],x)));
  for(const c of referenceSet.cases){
    const description='LOCAL FICTIONAL QA. '.repeat(40)+'We may offer visa sponsorship for this fictional role.';
    const record={id:c.id,title:'FICTIONAL QA Engineer',company:'LOCAL QA',description,apply_url:'https://example.test/jobs/'+c.id,last_seen:'2026-10-08T00:16:00Z',content_hash:sha(description)};
    c.content_hash=sha(description);c.record_hash=sha(JSON.stringify(record));
    env.sql.prepare('INSERT INTO agent_reference_cases VALUES(?,?,?)').run(referenceSet.id,c.id,JSON.stringify(record));
  }
  env.sql.prepare('UPDATE business_controls SET enabled=1,research=1').run();
  env.sql.prepare("INSERT INTO agent_investigations(id,kind,state,actor,created_at,policy,models,reference_batch,calls) VALUES('original-held','evaluation','failed','fixture','2026-10-10','investigator-v3-cited-claim-review',?,?,1)").run(JSON.stringify(researchModels(env)),referenceSet.batches[1].id);
  env.sql.prepare("INSERT INTO agent_research_steps(run_id,name,role,state,created_at,output) VALUES('original-held','analysis','investigator','failed','2026-10-10','{\"failure\":\"Model response incomplete.\"}')").run();
  return env;
}
async function prepare(env){return reviewReferenceComparison(env,'fixture-owner',request('prepare',0));}
async function resume(env){return reviewReferenceComparison(env,'fixture-owner',request('resume',1));}
function responseFor(evidence){return {assessments:evidence.map(e=>({job_id:e.id,verdict:'conditional',quote_id:'q2',reason:'Fictional archived wording was conditional.'})),summary_claims:[{claim_id:'s1',text:'The archived fictional adverts used conditional wording.',citations:evidence.map(e=>({job_id:e.id,quote_id:'q2'}))}],next_checks:[]};}
function installModel(env,checks){let calls=0;env.AI={run:async(model,input)=>{
  calls++;const value=JSON.parse(input.messages[1].content);assert.equal(input.max_tokens,8192);assert.equal(input.temperature,0.1);
  if(model===env.AI_MODEL){assert.deepEqual(input.chat_template_kwargs,{enable_thinking:true});assert.deepEqual(input.response_format,{type:'json_object'});assert.ok(value.evidence.every(e=>!Object.hasOwn(e,'description')));return {response:responseFor(value.evidence)};}
  assert.equal(input.response_format.type,'json_schema');assert.equal(input.response_format.json_schema.properties.checks.maxItems,value.evidence.length);
  assert.ok(value.evidence.every(e=>e.description.includes('LOCAL FICTIONAL QA')));
  return {response:{checks:value.proposed.assessments.map(a=>({job_id:a.job_id,supported:checks,reason:'Fictional review of label and explanation.'})),summary_checks:value.proposed.summary_claims.map(a=>({claim_id:a.claim_id,supported:true,reason:'Historical scope checked.'})),next_check_checks:[]}};
}};return ()=>calls;}

test('compact input retains every source character and original quote ID without labels or duplicated text',()=>{
  const description='x'.repeat(599)+'🧪'+String.fromCharCode(10)+'important refusal at the boundary. '.repeat(80);
  const original={id:'fixture',description,complete:true,current:false,stored_verdict:'ANSWER_KEY',accepted_labels:['SECRET'],annotation:'PRIVATE',historical_snapshot:'2026-10-08'};
  const compact=compactReferenceEvidence([original])[0];assert.equal(compact.quote_options.map(q=>q.text).join(''),description);
  assert.deepEqual(compact.quote_options,evidenceWithQuotes([original])[0].quote_options);assert.ok(JSON.stringify(compact).length<JSON.stringify(evidenceWithQuotes([original])[0]).length);
  for(const value of ['description','ANSWER_KEY','SECRET','PRIVATE'])assert.ok(!JSON.stringify(compact).includes(value));
  assert.throws(()=>resolveReport({assessments:[{job_id:'fixture',verdict:'offered',quote_id:'q999',reason:'bad'}],summary_claims:[],next_checks:[]},[original],{historical:true}),/Unknown original quote/);
});

test('preparing verifies all pinned records, keeps the original failure and is paused without calls or budgets',async t=>{
  const env=setup(t),before=env.sql.prepare("SELECT * FROM agent_investigations WHERE id='original-held'").get();
  const operation=request('prepare',0);assert.equal((await reviewReferenceComparison(env,'fixture-owner',operation)).revision,1);
  assert.equal((await reviewReferenceComparison(env,'fixture-owner',operation)).reused,true);
  const snapshot=await referenceComparisonSnapshot(env);assert.equal(snapshot.candidate.state,'paused');assert.equal(snapshot.original.state,'needs_attention');
  assert.equal(snapshot.candidate.total_adverts,50);assert.equal(snapshot.candidate.total_batches,16);
  assert.deepEqual(env.sql.prepare("SELECT * FROM agent_investigations WHERE id='original-held'").get(),before);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM research_reference_reviews').get().n,1);
  await assert.rejects(startInvestigation(env,'fixture-owner','evaluation','end_to_end','next'),/needs attention/);
  await assert.rejects(reviewReferenceComparison(env,'different-owner',operation),/different details/);
  await assert.rejects(reviewReferenceComparison(env,'fixture-owner',request('resume',0)),/changed/);
  await assert.rejects(reviewReferenceComparison(env,'fixture-owner',request('prepare',1)),/already prepared/);
  assert.throws(()=>env.sql.prepare('DELETE FROM research_reference_reviews').run(),/append only/);
});

test('corrupt evidence and unsupported model configuration cannot prepare or reserve work',async t=>{
  const env=setup(t);await assert.rejects(reviewReferenceComparison(env,'fixture-owner',{...request('prepare',0),source_sha256:'0'.repeat(64)}),/source changed/);
  env.AI_MODEL='unreviewed';await assert.rejects(prepare(env),/reviewed Cloudflare/);env.AI_MODEL='@cf/zai-org/glm-4.7-flash';
  referenceSet.cases[49].record_hash='0'.repeat(64);await assert.rejects(prepare(env),/snapshot changed/);
  assert.equal(env.sql.prepare('SELECT revision FROM research_reference_control').get().revision,0);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
});

test('concurrent owner reviews cannot overwrite each other or spend a model call',async t=>{
  const env=setup(t);await prepare(env);
  const results=await Promise.allSettled([reviewReferenceComparison(env,'first',request('resume',1)),reviewReferenceComparison(env,'second',request('resume',1))]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal(env.sql.prepare('SELECT revision FROM research_reference_control').get().revision,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM research_reference_reviews').get().n,2);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
});

test('configuration changes and expired or uncertain calls never become chargeable retries',async t=>{
  const env=setup(t);await prepare(env);await resume(env);const {id}=await startInvestigation(env,'fixture-owner','evaluation','end_to_end','next');await researchContext(env,id);let calls=0;
  env.AI={run:async()=>{calls++;return{choices:[{finish_reason:'length',message:{content:'private incomplete text'}}]};}};
  env.AI_REVIEW_MODEL='changed';await assert.rejects(analyseResearch(env,id),/reviewed Cloudflare/);assert.equal(calls,0);env.AI_REVIEW_MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  await assert.rejects(analyseResearch(env,id),/validated result/);await assert.rejects(analyseResearch(env,id),/prior model attempt/);assert.equal(calls,1);
  const row=env.sql.prepare('SELECT output FROM agent_research_steps WHERE run_id=?').get(id);assert.equal(JSON.parse(row.output).completion.finish_reason,'length');assert.ok(!row.output.includes('private incomplete'));
  assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});

test('candidate runs through analysis and different-model review with separate scores and replay-safe spending',async t=>{
  const env=setup(t);await prepare(env);await resume(env);const count=installModel(env,true);
  const {id}=await startInvestigation(env,'fixture-owner','evaluation','end_to_end','next');const context=await researchContext(env,id);
  assert.equal(context.evidence.length,referenceSet.batches[0].job_ids.length);
  const row=env.sql.prepare('SELECT * FROM agent_investigations WHERE id=?').get(id);assert.equal(row.policy,RESEARCH_CANDIDATE_POLICY);assert.equal(row.reference_profile,JSON.stringify(candidateReferenceProfile(researchModels(env))));
  await analyseResearch(env,id);await reviewResearch(env,id);await finishResearch(env,id);await finishResearch(env,id);
  const saved=JSON.parse(env.sql.prepare('SELECT report FROM agent_investigations WHERE id=?').get(id).report);
  assert.equal(saved.quality.policy,RESEARCH_CANDIDATE_POLICY);assert.equal(saved.evaluation.dataset,candidateReferenceSet.id);assert.equal(saved.publication,'none');assert.equal(saved.human_review_required,true);
  const progress=await referenceComparisonSnapshot(env);assert.equal(progress.original.completed_batches,0);assert.equal(progress.candidate.completed_batches,1);assert.equal(count(),2);
  assert.deepEqual({...env.sql.prepare('SELECT runs,calls FROM agent_research_budget').get()},{runs:1,calls:2});
  await assert.rejects(approveObservation(env,id,context.evidence[0].id,'fixture-owner'),/completed investigation/);
  assert.throws(()=>env.sql.prepare("UPDATE agent_investigations SET reference_profile='{}' WHERE id=?").run(id),/original identity/);
});

test('pause racing with a model reservation rolls back spending and prevents the call; failed comparisons stay held',async t=>{
  const env=setup(t);await prepare(env);await resume(env);let count=installModel(env,true);
  const {id}=await startInvestigation(env,'fixture-owner','evaluation','end_to_end','next');await researchContext(env,id);
  await reviewReferenceComparison(env,'fixture-owner',request('pause',2));
  await assert.rejects(analyseResearch(env,id),/paused or changed/);assert.equal(count(),0);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,0);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_steps WHERE run_id=?').get(id).n,0);
  env.sql.prepare("UPDATE agent_investigations SET state='failed' WHERE id=?").run(id);
  await assert.rejects(reviewReferenceComparison(env,'fixture-owner',request('resume',3)),/needs attention/);
  assert.equal((await referenceProgress(env)).state,'needs_attention');
});

test('a held daily receipt is never reset by preparation or resume and no ordinary investigation bypasses a paused comparison',async t=>{
  const env=setup(t);await prepare(env);
  const first=await scheduleBusinessResearch(env);assert.equal(first.state,'held');await resume(env);
  const again=await scheduleBusinessResearch(env);assert.equal(again.state,'held');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
});

test('source identity verifies the exact checked-in comparison bytes',async()=>{const identity=await verifyResearchSource();assert.equal(candidateReferenceProfile({investigator:{provider:'cloudflare',model:'@cf/zai-org/glm-4.7-flash'},reviewer:{provider:'cloudflare',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}}).source_sha256,identity.sha256);});
