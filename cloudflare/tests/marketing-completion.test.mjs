import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {marketingModelStep} from '../worker/marketing-agents.js';

async function setup(t) {
 const env=database(t), now=Date.now(), id='fixture-marketing';
 await env.DB.prepare("INSERT INTO marketing_agent_runs(id,day,state,created_at,policy,models) VALUES(?,?,'running',?,'fixture',?)").bind(id,new Date(now).toISOString().slice(0,10),new Date(now).toISOString(),JSON.stringify({writer:{provider:'cloudflare',model:'fixture'}})).run();
 return {env,id,now};
}
const call=(env,id,now,validate=x=>x)=>marketingModelStep(env,id,'plan','writer','Fictional fixture',{},validate,undefined,now);

test('lost save acknowledgement preserves the completed marketing result and does not call the model again',async t=>{
 const {env,id,now}=await setup(t);let calls=0;
 env.AI={run:async()=>{calls++;return {response:{decision:'fixture'},usage:{total_tokens:9}};}};
 const prepare=env.DB.prepare;
 env.DB.prepare=q=>{const s=prepare(q);if(q.startsWith("UPDATE marketing_agent_steps SET state='completed'")){const run=s.run.bind(s);s.run=async()=>{await run();throw Error('Lost acknowledgement');};}return s;};
 assert.deepEqual(await call(env,id,now),{decision:'fixture'});
 const before=env.sql.prepare('SELECT * FROM marketing_agent_steps').get();assert.equal(before.state,'completed');
 assert.deepEqual(await call(env,id,now),{decision:'fixture'});assert.equal(calls,1);
 assert.deepEqual(env.sql.prepare('SELECT * FROM marketing_agent_steps').get(),before);
 assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});

test('marketing failures distinguish received response faults and contract rejection without saving private text',async t=>{
 for(const [kind,result,validate,stage] of [
  ['truncated',{response:'PRIVATE_PARTIAL',choices:[{finish_reason:'length'}]},x=>x,'incomplete_response'],
  ['json',{response:'{PRIVATE_JSON'},x=>x,'invalid_json'],
  ['missing',{},x=>x,'invalid_response'],
  ['contract',{response:{secret:'PRIVATE_DRAFT'},choices:[{finish_reason:'stop'}]},()=>{throw Error('PRIVATE_VALIDATION');},'contract_validation'],
 ])await t.test(kind,async t=>{
  const {env,id,now}=await setup(t);let calls=0;
  env.AI={run:async()=>{calls++;return {...result,usage:{total_tokens:12,secret:'PRIVATE_USAGE'}};}};
  await assert.rejects(call(env,id,now,validate));
  const row=env.sql.prepare('SELECT * FROM marketing_agent_steps').get(),saved=JSON.parse(row.output);
  assert.equal(saved.failure_stage,stage);assert.equal(saved.completion.failure_stage,stage);
  assert.deepEqual(JSON.parse(row.usage),{total_tokens:12});assert.doesNotMatch(JSON.stringify(row),/PRIVATE_/);
  await assert.rejects(call(env,id,now,validate));assert.equal(calls,1);
  assert.deepEqual(env.sql.prepare('SELECT * FROM marketing_agent_steps').get(),row);
 });
});

test('transport errors cannot forge completion facts and legacy failures remain unchanged',async t=>{
 const {env,id,now}=await setup(t);env.AI={run:async()=>{throw Object.assign(Error('PRIVATE_ERROR'),{completion:{version:1,provider:'cloudflare',failure_stage:'incomplete_response'}});}};
 await assert.rejects(call(env,id,now));let row=env.sql.prepare('SELECT * FROM marketing_agent_steps').get();
 assert.equal(JSON.parse(row.output).failure_stage,'provider_unconfirmed');assert.equal(JSON.parse(row.output).completion,undefined);
 assert.doesNotMatch(JSON.stringify(row),/PRIVATE_/);
 env.sql.prepare('UPDATE marketing_agent_steps SET output=?').run('{"failure":"Historical unknown outcome"}');
 row=env.sql.prepare('SELECT * FROM marketing_agent_steps').get();await assert.rejects(call(env,id,now));
 assert.deepEqual(env.sql.prepare('SELECT * FROM marketing_agent_steps').get(),row);
});

test('unsaved validated results are held while a completed receipt survives unavailable readback',async t=>{
 for(const commit of [false,true])await t.test('commit='+commit,async t=>{
  const {env,id,now}=await setup(t);let calls=0,started=false;
  env.AI={run:async()=>{calls++;return {response:{answer:1},choices:[{finish_reason:'stop'}],usage:{total_tokens:8}};}};
  const prepare=env.DB.prepare;
  env.DB.prepare=q=>{const s=prepare(q);
   if(q.startsWith("UPDATE marketing_agent_steps SET state='completed'")){const run=s.run.bind(s);s.run=async()=>{started=true;if(commit)await run();throw Error('PRIVATE_STORAGE');};}
   if(q==='SELECT state,output,usage FROM marketing_agent_steps WHERE run_id=? AND name=?')s.first=async()=>{throw Error('PRIVATE_READ');};
   return s;};
  await assert.rejects(call(env,id,now));assert.equal(started,true);
  const row=env.sql.prepare('SELECT * FROM marketing_agent_steps').get();
  assert.equal(row.state,commit?'completed':'failed');assert.doesNotMatch(JSON.stringify(row),/PRIVATE_/);
  if(!commit)assert.equal(JSON.parse(row.output).failure_stage,'retention_unconfirmed');
  env.DB.prepare=prepare;
  if(commit)assert.deepEqual(await call(env,id,now),{answer:1});else await assert.rejects(call(env,id,now));
  assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
 });
});

test('failed diagnostic persistence retains the calling reservation and blocks another model call',async t=>{
 const {env,id,now}=await setup(t);let calls=0;env.AI={run:async()=>{calls++;throw Error('PRIVATE_TRANSPORT');}};
 const prepare=env.DB.prepare;env.DB.prepare=q=>{const s=prepare(q);if(q.startsWith("UPDATE marketing_agent_steps SET state='failed'"))s.run=async()=>{throw Error('Storage unavailable');};return s;};
 await assert.rejects(call(env,id,now));assert.equal(env.sql.prepare('SELECT state FROM marketing_agent_steps').get().state,'calling');
 await assert.rejects(call(env,id,now));assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
