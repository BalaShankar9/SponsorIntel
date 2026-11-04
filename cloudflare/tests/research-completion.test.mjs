import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {startInvestigation,researchContext,modelStep,researchSnapshot} from '../worker/agent-research.js';
import {callResearchModel,researchResponseFailure} from '../worker/research-model.js';
import {researchCompletion} from '../shared/research-completion.js';

async function setup(t) {
  const env=database(t); env.RESEARCH_WORKFLOW={create:async()=>({})};
  env.AI_MODEL='fictional-investigator'; env.AI_REVIEW_MODEL='fictional-reviewer';
  const {id}=await startInvestigation(env,'owner','evaluation'); await researchContext(env,id);
  return {env,id};
}

test('cut-short Cloudflare response retains only finite completion facts and usage, with no charged retry',async t=>{
  const {env,id}=await setup(t);let calls=0;
  env.AI={run:async(_model,options)=>{calls++;assert.equal(options.max_tokens,8192);return {
    response:'PRIVATE_PARTIAL_TEXT',choices:[{finish_reason:'length',message:{reasoning_content:'PRIVATE_THINKING'}}],
    usage:{prompt_tokens:350,completion_tokens:8192,total_tokens:8542,secret:'PRIVATE_USAGE'},error:'PRIVATE_ERROR'};}};
  await assert.rejects(modelStep(env,id,'analysis','investigator','fixture',{},x=>x));
  const before=env.sql.prepare('SELECT * FROM agent_research_steps').get();
  const saved=JSON.parse(before.output);
  assert.equal(saved.completion.failure_stage,'incomplete_response');assert.equal(saved.completion.finish_reason,'length');
  assert.deepEqual(JSON.parse(before.usage),{prompt_tokens:350,completion_tokens:8192,total_tokens:8542});
  assert.equal(saved.rejected_draft,undefined);assert.ok(!JSON.stringify(before).includes('PRIVATE_'));
  const snapshot=await researchSnapshot(env);assert.equal(snapshot.steps[0].completion.finish_reason,'length');assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_'));
  await assert.rejects(modelStep(env,id,'analysis','investigator','fixture',{},x=>x),/prior model attempt/);
  assert.equal(calls,1);assert.deepEqual(env.sql.prepare('SELECT * FROM agent_research_steps').get(),before);
  assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
  assert.equal(env.sql.prepare('SELECT report FROM agent_investigations').get().report,null);
});

test('invalid JSON and invalid content retain received-response evidence without guessing absent stop reasons',async()=>{
  for(const [response,stage] of [['{PRIVATE_FRAGMENT','invalid_json'],[undefined,'invalid_response'],['a'.repeat(32001),'invalid_response']]) {
    let caught;
    try {await callResearchModel({AI:{run:async()=>({response,usage:{completion_tokens:0,prompt_tokens:-1,total_tokens:'secret'}})}},{provider:'cloudflare',model:'fixture'},'JSON',{});}catch(e){caught=e;}
    assert.ok(caught);const receipt=researchResponseFailure(caught);assert.equal(receipt.failure_stage,stage);
    assert.equal(receipt.finish_reason,'not_reported');assert.deepEqual(receipt.usage,{completion_tokens:0});
    assert.ok(!JSON.stringify(receipt).includes('PRIVATE_FRAGMENT'));
  }
});

test('structured rejection stays separate from provider truncation and hides rejected text in owner summary',async t=>{
  const {env,id}=await setup(t);env.AI={run:async()=>({response:{secret:'PRIVATE_REJECTED_DRAFT'},choices:[{finish_reason:'stop'}],usage:{total_tokens:42}})};
  await assert.rejects(modelStep(env,id,'analysis','investigator','fixture',{},()=>{throw Error('Invalid research structure.');}));
  const saved=JSON.parse(env.sql.prepare('SELECT output FROM agent_research_steps').get().output);
  assert.equal(saved.completion.failure_stage,'contract_validation');assert.equal(saved.completion.finish_reason,'stop');
  assert.equal(saved.rejected_draft.secret,'PRIVATE_REJECTED_DRAFT');
  const snapshot=await researchSnapshot(env);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_REJECTED_DRAFT'));
  assert.equal(snapshot.steps[0].completion.usage.total_tokens,42);
});

test('transport failures cannot spoof completion evidence; old receipts and arbitrary fields stay unknown',async t=>{
  const {env,id}=await setup(t);env.AI={run:async()=>{throw Object.assign(Error('PRIVATE_TRANSPORT'),{completion:{version:1,provider:'cloudflare',finish_reason:'length',failure_stage:'incomplete_response'}});}};
  await assert.rejects(modelStep(env,id,'analysis','investigator','fixture',{},x=>x));
  const snapshot=await researchSnapshot(env);assert.equal(snapshot.steps[0].completion,null);assert.ok(!JSON.stringify(snapshot).includes('PRIVATE_TRANSPORT'));
  assert.equal(researchCompletion({version:2,provider:'cloudflare'}),null);
  const clean=researchCompletion({version:1,provider:'cloudflare',failure_stage:'invalid_json',finish_reason:'PRIVATE_VALUE',response_kind:'PRIVATE_KIND',usage:{total_tokens:NaN,completion_tokens:Infinity,prompt_tokens:3,secret:'PRIVATE'},raw:'PRIVATE'});
  assert.deepEqual(clean,{version:1,provider:'cloudflare',failure_stage:'invalid_json',finish_reason:'unknown',response_kind:'other',usage:{prompt_tokens:3}});
});

test('a storage acknowledgement error is not mislabeled as a rejected model contract',async t=>{
  const {env,id}=await setup(t);env.AI={run:async()=>({response:{answer:1},choices:[{finish_reason:'stop'}],usage:{total_tokens:7}})};
  const prepare=env.DB.prepare;env.DB.prepare=query=>{const statement=prepare(query);if(query.startsWith("UPDATE agent_research_steps SET state='completed'")){statement.run=async()=>{throw Error('Synthetic storage unavailable');};}return statement;};
  await assert.rejects(modelStep(env,id,'analysis','investigator','fixture',{},x=>x));
  const saved=JSON.parse(env.sql.prepare('SELECT output FROM agent_research_steps').get().output);
  assert.equal(saved.completion.failure_stage,'retention_unconfirmed');assert.equal(saved.completion.finish_reason,'stop');
  assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
