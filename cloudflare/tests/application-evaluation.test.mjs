import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {candidateReviewPrompt,validateCandidateReview} from '../worker/career-review-candidate.js';
import {validateReview} from '../worker/career-review.js';
import {applicationCases,evaluationCase,applicationProfile,dispatchApplicationEvaluation,initialiseApplicationEvaluation,applicationModelStep,finishApplicationEvaluation,applicationProgress,applicationEvaluationSnapshot,applicationEvaluationAPI,screenApplication} from '../worker/application-evaluation.js';
import {adminAPI} from '../worker/admin.js';
import {superviseAgents} from '../worker/agent-supervision.js';
const now=Date.now(),stamp=new Date(now).toISOString();
function setup(t){const env=database(t);env.AI_MODEL='synthetic-writer';env.AI_REVIEW_MODEL='synthetic-reviewer';env.APPLICATION_EVAL_WORKFLOW={create:async()=>({}),get:async()=>({status:async()=>({status:'complete'})})};return env;}
const profile={name:'Fictional Graduate',cv:'Built a local Python catalogue.\nVolunteered at a welcome desk.\nBSc Computer Science, 2026.'},app={title:'Graduate Analyst',company:'Fictional Employer'};
function candidate(text='Built a local Python catalogue.',quote='Built a local Python catalogue.') {return {sections:[{heading:'PROFILE',paragraphs:[{text,evidence:[{source_id:'C1',quote}]}]}]};}
test('all 20 fictional cases are pinned, distinct and split across both requested document types',async t=>{
 const env=setup(t),cases=applicationCases();assert.equal(cases.length,20);assert.equal(new Set(cases.map(c=>c.id)).size,20);assert.equal(cases.filter(c=>c.kind==='cv').length,10);
 const p=await applicationProfile(env);assert.equal(p.fixture_hash.length,64);assert.notDeepEqual(p,await applicationProfile({...env,AI_MODEL:'different'}));
 for(const c of cases){const data=evaluationCase(c.id);const prompt=candidateReviewPrompt('draft',data.profile,data.application,data.kind);const user=JSON.parse(prompt.user);assert.deepEqual(Object.keys(user),['kind','ORIGINAL_CANDIDATE','JOB_CONTEXT_NOT_CANDIDATE_EVIDENCE','DRAFT_TO_CORRECT']);assert.equal(user.screening,undefined);assert.match(data.profile.email,/@example\.test$/);}
});
test('retained old-review counterexample proves spot checks do not cover an invented paragraph',()=>{
 const text='PROFILE\nFictional graduate with extensive Kubernetes production leadership.\nPROJECTS\nBuilt a local Python catalogue.\nEXPERIENCE\nVolunteered at a welcome desk.\nEDUCATION\nBSc Computer Science, 2026.';
 assert.equal(validateReview({text,checks:[{claim:'Built a local Python catalogue',source_ids:['C1']},{claim:'Volunteered at a welcome desk',source_ids:['C1']},{claim:'BSc Computer Science',source_ids:['C1']}]},profile,'cv'),text);
 const value=candidate();value.text=text;assert.throws(()=>validateCandidateReview(value,profile,app,'cv'),/structure/);
 const uncovered=candidate();uncovered.sections[0].paragraphs.push({text:'Extensive Kubernetes production leadership.'});assert.throws(()=>validateCandidateReview(uncovered,profile,app,'cv'),/source evidence/);
});
test('candidate paragraphs require matching source quotes and locally supported numbers',()=>{
 const v=validateCandidateReview(candidate(),profile,app,'cv');assert.equal(v.linked_paragraphs,1);assert.match(v.text,/Fictional Graduate/);assert.equal(v.review_required,true);
 for(const value of [candidate('Built a local Python catalogue.','Built a real commercial product.'),candidate('Led 50 engineers.','Built a local Python catalogue.')])assert.throws(()=>validateCandidateReview(value,profile,app,'cv'));
 const wrong=candidate();wrong.sections[0].paragraphs[0].evidence[0].source_id='C9';assert.throws(()=>validateCandidateReview(wrong,profile,app,'cv'),/absent/);
 const bad=candidate();bad.sections.push({...bad.sections[0]});assert.throws(()=>validateCandidateReview(bad,profile,app,'cv'),/heading/);
});
test('a matching quote is not semantic proof and cannot trigger automatic promotion',()=>{
 const semanticallyWrong=candidate('Led a production platform team.','Built a local Python catalogue.');
 const result=validateCandidateReview(semanticallyWrong,profile,app,'cv');assert.equal(result.semantic_verification,false);assert.equal(result.review_required,true);
 assert.equal(screenApplication('graduate-year','Graduated in 2028.').flagged_patterns.length,1);
 assert.match(screenApplication('graduate-year','text').interpretation,/Literal screening only/);
});
test('daily dispatch keeps exhausted and unknown outcomes reserved without model work',async t=>{
 const env=setup(t);let creates=0;env.APPLICATION_EVAL_WORKFLOW.create=async()=>{creates++;throw Error('lost create');};env.APPLICATION_EVAL_WORKFLOW.get=async()=>{throw Error('unknown');};
 const r=await dispatchApplicationEvaluation(env,'scheduled',now);assert.equal(r.state,'queued');await dispatchApplicationEvaluation(env,'owner',now);assert.equal(creates,1);assert.equal((await applicationEvaluationSnapshot(env)).budget.runs,1);
 const exhausted=setup(t);exhausted.sql.prepare('INSERT INTO agent_research_budget(day,runs,calls) VALUES(?,4,6)').run(stamp.slice(0,10));
 const held=await dispatchApplicationEvaluation(exhausted,'scheduled',now);assert.equal(held.state,'held');assert.equal(exhausted.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,4);assert.deepEqual((await applicationProgress(exhausted)).next,['graduate-year','planned-product']);
});
function fakeModels(env){
 const calls=[];
 env.AI={run:async(model,input)=>{
  calls.push({model,input});
  if(model==='synthetic-writer')return {response:'PROFILE\nFictional candidate who built an academic project and has relevant source-described skills.\nEXPERIENCE\nUsed documentation and maintained clear records.'};
  const data=JSON.parse(input.messages[1].content),quote=data.ORIGINAL_CANDIDATE[0].text.split('\n').slice(0,2).join(' ');
  if(input.messages[0].content.includes('candidate review contract'))return {response:{sections:[{heading:'PROFILE',paragraphs:[{text:quote,evidence:[{source_id:'C1',quote}]}]}]}};
  const text=data.ORIGINAL_CANDIDATE[0].text;return {response:{text,checks:[{claim:text.slice(0,30),source_ids:['C1']},{claim:text.slice(30,70),source_ids:['C1']},{claim:text.slice(70,110),source_ids:['C1']}]}};
 }};return calls;
}
test('paired stages share the same draft, retain six calls and advance only after a complete batch',async t=>{
 const env=setup(t),calls=fakeModels(env),r=await dispatchApplicationEvaluation(env,'scheduled',now);const cases=await initialiseApplicationEvaluation(env,r.id);
 for(const id of cases){for(const stage of ['write','baseline','candidate'])await applicationModelStep(env,r.id,id,stage,now);}
 assert.equal(calls.length,6);await applicationModelStep(env,r.id,cases[0],'candidate',now);assert.equal(calls.length,6);
 assert.equal(JSON.parse(calls[1].input.messages[1].content).DRAFT_TO_CORRECT,JSON.parse(calls[2].input.messages[1].content).DRAFT_TO_CORRECT);
 assert.equal((await finishApplicationEvaluation(env,r.id)).state,'completed');assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,6);
 const p=await applicationProgress(env);assert.equal(p.completed,2);assert.deepEqual(p.next,['career-change','advert-injection']);
 assert.equal(JSON.parse(env.sql.prepare('SELECT result FROM application_eval_runs').get().result).automatic_promotion,false);
});
test('unknown model outcomes halt progression and never replay the paid attempt',async t=>{
 const env=setup(t);let count=0;env.AI={run:async()=>{count++;throw Error('uncertain provider');}};const r=await dispatchApplicationEvaluation(env,'scheduled',now);await initialiseApplicationEvaluation(env,r.id);
 await assert.rejects(applicationModelStep(env,r.id,'graduate-year','write',now));await assert.rejects(applicationModelStep(env,r.id,'graduate-year','write',now));assert.equal(count,1);
 await finishApplicationEvaluation(env,r.id,true);assert.equal((await applicationProgress(env)).state,'needs_attention');assert.deepEqual((await applicationProgress(env)).next,[]);
});
test('pause, policy changes, expired runs and exhausted call budgets prevent another paid call',async t=>{
 for(const mode of ['pause','model','expiry','budget']){
  const env=setup(t);let calls=0;env.AI={run:async()=>{calls++;throw Error('must not call');}};
  const r=await dispatchApplicationEvaluation(env,'scheduled',now);await initialiseApplicationEvaluation(env,r.id);
  if(mode==='pause')env.sql.prepare('UPDATE application_eval_controls SET enabled=0').run();
  if(mode==='model')env.AI_REVIEW_MODEL='different';
  if(mode==='budget')env.sql.prepare('UPDATE agent_research_budget SET calls=32').run();
  await assert.rejects(applicationModelStep(env,r.id,'graduate-year','write',mode==='expiry'?now+3600001:now));assert.equal(calls,0);
  assert.equal(env.sql.prepare('SELECT calls FROM application_eval_runs').get().calls,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM application_eval_steps').get().n,0);
 }
});
test('supervisor reconciles only confirmed terminal application tests without deleting evidence',async t=>{
 const env=setup(t),r=await dispatchApplicationEvaluation(env,'scheduled',now);await initialiseApplicationEvaluation(env,r.id);
 env.sql.prepare('UPDATE application_eval_runs SET created_at=?').run(new Date(now-7200000).toISOString());
 env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('business-qa','running',?)").run(stamp);
 const out=await superviseAgents(env,'business-qa',now);assert.equal(out.checks.find(x=>x.kind==='applications').action,'reconciled');assert.equal((await applicationProgress(env)).state,'needs_attention');assert.equal(env.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,1);
});
test('anonymous reads, foreign-origin writes and settings injection are rejected',async t=>{
 const env=setup(t);assert.equal((await adminAPI(new Request('https://sponsorintel.london/api/admin/application-evaluation'),env)).status,403);
 const req=(origin,body)=>new Request('https://sponsorintel.london/api/admin/application-evaluation/settings',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const owner={user:{id:'owner'}};assert.equal((await applicationEvaluationAPI(req('https://elsewhere.test',{enabled:false}),env,owner)).status,403);assert.equal((await applicationEvaluationAPI(req('https://sponsorintel.london',{enabled:false,model:'different'}),env,owner)).status,400);
});
test('a lost storage acknowledgement returns the retained result without another model call',async t=>{
 const env=setup(t),calls=fakeModels(env),r=await dispatchApplicationEvaluation(env,'scheduled',now);await initialiseApplicationEvaluation(env,r.id);
 const prepare=env.DB.prepare.bind(env.DB);let interrupted=false;
 env.DB.prepare=q=>{const statement=prepare(q);if(q.startsWith('UPDATE application_eval_steps SET state=?')){const run=statement.run.bind(statement);statement.run=async()=>{const saved=await run();if(!interrupted){interrupted=true;throw Error('lost acknowledgement');}return saved;};}return statement;};
 const result=await applicationModelStep(env,r.id,'graduate-year','write',now);assert.equal(result.state,'completed');assert.equal(result.replayed,true);
 await applicationModelStep(env,r.id,'graduate-year','write',now);assert.equal(calls.length,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
test('concurrent starts and concurrent model steps reserve one workflow and one call',async t=>{
 const env=setup(t);let creates=0;env.APPLICATION_EVAL_WORKFLOW.create=async()=>{creates++;};
 const starts=await Promise.all([dispatchApplicationEvaluation(env,'scheduled',now),dispatchApplicationEvaluation(env,'owner',now)]);assert.equal(starts[0].id,starts[1].id);assert.equal(creates,1);assert.equal(env.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,1);
 await initialiseApplicationEvaluation(env,starts[0].id);const calls=fakeModels(env);
 const results=await Promise.allSettled([applicationModelStep(env,starts[0].id,'graduate-year','write',now),applicationModelStep(env,starts[0].id,'graduate-year','write',now)]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(calls.length,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
test('a known invalid baseline is retained and permits a distinct candidate comparison',async t=>{
 const env=setup(t),calls=fakeModels(env),fake=env.AI.run;env.AI.run=async(model,input)=>model==='synthetic-reviewer'&&!input.messages[0].content.includes('candidate review contract')?{response:'invalid JSON'}:fake(model,input);
 const r=await dispatchApplicationEvaluation(env,'scheduled',now);await initialiseApplicationEvaluation(env,r.id);await applicationModelStep(env,r.id,'graduate-year','write',now);
 assert.equal((await applicationModelStep(env,r.id,'graduate-year','baseline',now)).state,'rejected');assert.equal((await applicationModelStep(env,r.id,'graduate-year','candidate',now)).state,'completed');
 const before=env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls;await applicationModelStep(env,r.id,'graduate-year','baseline',now);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,before);assert.equal(before,3);
 for(const c of calls)assert.doesNotMatch(c.input.messages[1].content,/expected_anchors|forbidden_patterns|review_questions/);
});
