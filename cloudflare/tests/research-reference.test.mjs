import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {database} from './research-db.mjs';
import {referenceSet,referenceEvidence,referenceProgress,scoreReferenceEvaluation,researchRetentionStatement} from '../worker/research-reference.js';
import {evidenceWithQuotes,validateReport} from '../worker/research-contract.js';
import {startInvestigation,researchContext,analyseResearch,reviewResearch,finishResearch,approveObservation,researchSnapshot} from '../worker/agent-research.js';
import {scheduleBusinessResearch} from '../worker/business-operations.js';

const sha=s=>createHash('sha256').update(s).digest('hex');
function insert(env,dataset,record) {env.sql.prepare('INSERT INTO agent_reference_cases VALUES(?,?,?)').run(dataset,record.id,JSON.stringify(record));}
function loadedPlaceholders(env) {for(const c of referenceSet.cases) insert(env,referenceSet.id,{id:c.id});}
function config(env) {env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';env.RESEARCH_WORKFLOW={create:async()=>({})};}
function reviews(report,dispute=false) {return {checks:report.assessments.map((a,i)=>({job_id:a.job_id,supported:!(dispute&&i===0),reason:'Synthetic adapter review.'})),summary_checks:report.summary_claims.map(c=>({claim_id:c.claim_id,supported:true,reason:'Historical scope checked.'})),next_check_checks:[]};}
async function prepared(t) {
  const env=database(t);config(env);loadedPlaceholders(env);
  const {id}=await startInvestigation(env,'owner','evaluation');await researchContext(env,id);
  const batch=referenceSet.batches[0];
  const evidence=batch.job_ids.map(id=>({id,title:'LOCAL QA historical advert',company:'LOCAL QA',description:'Sponsorship may be considered for this historical fixture.',current:false,complete:true,historical_snapshot:referenceSet.snapshot_at}));
  env.sql.prepare('UPDATE agent_investigations SET reference_batch=?,context=? WHERE id=?').run(batch.id,JSON.stringify({evidence,memory:[],decisions:[],limitations:['Historical fixture; no current opportunity claim.']}),id);
  const report={assessments:evidence.map(e=>({job_id:e.id,verdict:'conditional',quote:e.description,reason:'Fixture wording only.'})),summary_claims:[{claim_id:'s1',text:'The archived fixture included conditional wording.',citations:[{job_id:evidence[0].id,quote:evidence[0].description}]}],next_checks:[]};
  return {env,id,batch,evidence,report};
}

test('reference cohort has complete non-overlapping batches and explicit provisional ambiguity',()=>{
  const ids=referenceSet.batches.flatMap(b=>b.job_ids);
  assert.equal(ids.length,50);assert.equal(new Set(ids).size,50);
  assert.deepEqual([...ids].sort(),referenceSet.cases.map(c=>c.id).sort());
  assert.equal(new Set(referenceSet.cases.map(c=>c.content_hash)).size,49);
  assert.equal(referenceSet.cases.filter(c=>c.accepted_labels.length>1).length,8);
  assert.equal(referenceSet.human_adjudicated,false);
});

test('snapshot byte pins protect all metadata and keep answer keys outside model evidence',async t=>{
  const env=database(t),description='We may provide visa sponsorship for this vacancy.';
  const record={id:'fixture',board_id:'test',company:'LOCAL QA',title:'Engineer',description,apply_url:'https://example.com/role',last_seen:'2026-10-01T00:00:00Z',content_hash:sha(description)};
  const set={id:'qa',snapshot_at:'2026-10-02T00:00:00Z',cases:[{id:'fixture',content_hash:sha(description),record_hash:sha(JSON.stringify(record)),accepted_labels:['conditional']}],batches:[{id:'batch',job_ids:['fixture']}]};
  insert(env,set.id,record);
  const evidence=await referenceEvidence(env,'batch',set),input=JSON.stringify(evidenceWithQuotes(evidence));
  assert.equal(evidence[0].current,false);assert.equal(evidence[0].complete,true);assert.equal(evidence[0].description,description);
  for(const secret of ['accepted_labels','record_hash','annotation','conditional'])assert.ok(!input.includes(secret));
  const changed=structuredClone(set);changed.cases[0].record_hash='0'.repeat(64);
  await assert.rejects(referenceEvidence(env,'batch',changed),/changed/);
  await assert.rejects(referenceEvidence(env,'unknown',set),/known/);
  assert.throws(()=>env.sql.prepare("UPDATE agent_reference_cases SET record='{}'").run(),/immutable/);
  assert.throws(()=>env.sql.prepare('DELETE FROM agent_reference_cases').run(),/immutable/);
});

test('missing or corrupt frozen data cannot reserve a run or make a paid call',async t=>{
  const env=database(t);config(env);let calls=0;env.AI={run:async()=>{calls++;}};
  for(const [kind,suite,reference] of [['research','end_to_end','next'],['evaluation','critic','next'],['evaluation','end_to_end',referenceSet.batches[1].id]])
    await assert.rejects(startInvestigation(env,'owner',kind,suite,reference),/next fixed reference/);
  assert.equal((await referenceProgress(env)).state,'not_loaded');
  await assert.rejects(startInvestigation(env,'owner','evaluation','end_to_end','next'),/unavailable/);
  loadedPlaceholders(env);
  await assert.rejects(startInvestigation(env,'owner','evaluation','end_to_end','next'),/snapshot changed/);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_investigations').get().n,0);assert.equal(calls,0);
});

test('historical evidence never passes as current production research',async t=>{
  const {report,evidence}=await prepared(t);
  assert.throws(()=>validateReport(report,evidence),/Incomplete evidence/);
  assert.equal(validateReport(report,evidence,{historical:true}),report);
  const truncated=structuredClone(evidence);truncated[0].complete=false;
  assert.throws(()=>validateReport(report,truncated,{historical:true}),/Incomplete evidence/);
});

test('real-advert flow uses historical prompts, retains disputes and cannot enter learning memory',async t=>{
  const {env,id,report,batch}=await prepared(t);let calls=0;
  env.AI={run:async(model,input)=>{
    const data=JSON.parse(input.messages[1].content);
    assert.match(input.messages[0].content,/historical evaluation/);
    for(const e of data.evidence){assert.equal(e.current,false);assert.equal(e.accepted_labels,undefined);assert.equal(e.stored_verdict,undefined);}
    calls++;return{response:JSON.stringify(model==='writer'?report:reviews(report,true)),usage:{total_tokens:10}};
  }};
  await analyseResearch(env,id);assert.equal((await reviewResearch(env,id)).revise,true);await finishResearch(env,id);await finishResearch(env,id);
  const result=JSON.parse(env.sql.prepare('SELECT report FROM agent_investigations WHERE id=?').get(id).report);
  assert.equal(calls,2);assert.equal(result.evaluation.synthetic,false);assert.equal(result.evaluation.provisional,true);
  assert.equal(result.quality.accepted,false);assert.equal(result.publication,'none');assert.equal(result.evaluation.batch,batch.id);
  await assert.rejects(approveObservation(env,id,batch.job_ids[0],'owner'),/completed investigation/);
  const p=await referenceProgress(env);assert.equal(p.completed_batches,1);assert.equal(p.disputed_items,1);assert.equal(p.next_batch,referenceSet.batches[1].id);
  const snapshot=await researchSnapshot(env);assert.equal(snapshot.runs[0].context,undefined);assert.equal(snapshot.reference.dataset,referenceSet.id);
});

test('reference scoring excludes ambiguous boundaries and counts missing and harmful answers',()=>{
  let total=0,correct=0,ambiguous=0;
  for(const b of referenceSet.batches){
    const report={assessments:b.job_ids.map(id=>({job_id:id,verdict:referenceSet.cases.find(c=>c.id===id).accepted_labels[0]}))};
    const score=scoreReferenceEvaluation(report,b.id);total+=score.total;correct+=score.correct;ambiguous+=score.ambiguous_cases;
  }
  assert.equal(total,42);assert.equal(correct,42);assert.equal(ambiguous,8);
  const c=referenceSet.cases.find(c=>c.accepted_labels[0]==='not_stated'),b=referenceSet.batches.find(b=>b.job_ids.includes(c.id));
  assert.equal(scoreReferenceEvaluation({assessments:[{job_id:c.id,verdict:'offered'}]},b.id).dangerous_false_positives,1);
  assert.equal(scoreReferenceEvaluation({assessments:[{job_id:c.id,verdict:'unavailable'}]},b.id).unsupported_refusals,1);
  const absent=scoreReferenceEvaluation({assessments:[]},b.id);assert.equal(absent.correct,0);assert.ok(absent.cases.every(c=>c.actual==='missing'));
});

test('failed or incomplete attempts hold the campaign and cannot be silently skipped or duplicated',async t=>{
  const {env,id,batch}=await prepared(t);
  assert.equal((await referenceProgress(env)).state,'running');
  env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();
  const p=await referenceProgress(env);assert.equal(p.state,'needs_attention');assert.equal(p.next_batch,null);
  await assert.rejects(startInvestigation(env,'owner','evaluation','end_to_end','next'),/needs attention/);
  const {id:other}=await startInvestigation(env,'owner','evaluation');
  assert.throws(()=>env.sql.prepare('UPDATE agent_investigations SET reference_batch=? WHERE id=?').run(batch.id,other),/UNIQUE/);
  assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations WHERE id=?').get(id).calls,0);
});

test('model changes cannot continue a mixed-comparison campaign',async t=>{
  const {env,id,report}=await prepared(t);env.AI={run:async m=>({response:JSON.stringify(m==='writer'?report:reviews(report))})};
  await analyseResearch(env,id);await reviewResearch(env,id);await finishResearch(env,id);
  env.AI_MODEL='different-writer';
  await assert.rejects(startInvestigation(env,'owner','evaluation','end_to_end','next'),/model or policy changed/);
  assert.equal(env.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,1);
});

test('owner pause is rechecked before each new reference model call without consuming a reservation',async t=>{
  const {env,id,report}=await prepared(t);let calls=0;
  env.AI={run:async()=>{calls++;return{response:JSON.stringify(report)};}};
  await analyseResearch(env,id);
  env.sql.prepare('UPDATE business_controls SET research=0').run();
  await assert.rejects(reviewResearch(env,id),/paused/);
  assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
  assert.equal((await referenceProgress(env)).state,'paused');
});

test('daily scheduling holds broken reference evidence without falling back to a chargeable investigation',async t=>{
  const env=database(t);config(env);loadedPlaceholders(env);
  env.sql.prepare('UPDATE business_controls SET enabled=1,research=1').run();
  const first=await scheduleBusinessResearch(env),second=await scheduleBusinessResearch(env);
  assert.equal(first.state,'held');assert.equal(second.state,'held');
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_investigations').get().n,0);
});

test('retention preserves reference attempts and paid-call receipts while ordinary old research expires',async t=>{
  const {env,id}=await prepared(t);
  env.sql.prepare("UPDATE agent_investigations SET state='failed',created_at='2000-01-01'").run();
  env.sql.prepare("INSERT INTO agent_research_steps(run_id,name,role,state,created_at) VALUES(?,'analysis','investigator','failed','2000-01-01')").run(id);
  const {id:ordinary}=await startInvestigation(env,'owner','evaluation');
  env.sql.prepare("UPDATE agent_investigations SET state='failed',created_at='2000-01-01' WHERE id=?").run(ordinary);
  await researchRetentionStatement(env.DB,'2026-10-01').run();
  assert.ok(env.sql.prepare('SELECT id FROM agent_investigations WHERE id=?').get(id));
  assert.equal(env.sql.prepare('SELECT id FROM agent_investigations WHERE id=?').get(ordinary),undefined);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_steps WHERE run_id=?').get(id).n,1);
  env.sql.prepare("DELETE FROM agent_investigations WHERE state IN ('review','failed') AND created_at<'2026-10-01'").run();
  assert.ok(env.sql.prepare('SELECT id FROM agent_investigations WHERE id=?').get(id));
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_steps WHERE run_id=?').get(id).n,1);
});
