import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {RESEARCH_POLICY,validateReport,validateReview,reviewOutcome} from '../worker/research-contract.js';
import {startInvestigation,researchContext,analyseResearch,reviewResearch,finishResearch,approveObservation,modelStep,prepareCriticChallenge} from '../worker/agent-research.js';
import {scoreEvaluation,RESEARCH_CASES,criticChallenge,scoreCriticEvaluation} from '../worker/research-evals.js';
import {agentOperationsAPI} from '../worker/agent-api.js';

const evidence=[{id:'right-to-work-only',title:'UK engineer',company:'Synthetic employer',description:'Applicants must already have the right to work in the UK.',current:true,complete:true,observed_at:new Date().toISOString()}];
function report(){return {summary_claims:[{claim_id:'s1',text:'This advert asks for existing work permission but does not make an explicit sponsorship commitment.',citations:[{job_id:evidence[0].id,quote:evidence[0].description}]}],assessments:[{job_id:evidence[0].id,verdict:'not_stated',quote:evidence[0].description,reason:'Existing work permission alone does not establish an explicit visa sponsorship refusal.'}],next_checks:['Does this specific vacancy offer visa sponsorship?']};}
function review(r){return {checks:r.assessments.map(a=>({job_id:a.job_id,supported:true,reason:'The advert states work permission only.'})),summary_checks:r.summary_claims.map(c=>({claim_id:c.claim_id,supported:true,reason:'This inference is limited to the observed wording.'})),next_check_checks:r.next_checks.map((_,index)=>({index,supported:true,reason:'A neutral question to resolve the missing commitment.'}))};}
async function setup(t){const env=database(t);env.RESEARCH_WORKFLOW={create:async()=>({})};env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';const {id}=await startInvestigation(env,'owner','research');await researchContext(env,id);env.sql.prepare('UPDATE agent_investigations SET context=? WHERE id=?').run(JSON.stringify({evidence,decisions:[],memory:[]}),id);return{env,id};}
function responses(env,list){let calls=0;env.AI={run:async()=>({response:JSON.stringify(list[calls++])})};return()=>calls;}

test('each summary claim requires bounded, unique original evidence citations',()=>{
 const r=report();assert.equal(validateReport(r,evidence),r);
 for(const mutate of [x=>{x.summary_claims=[];},x=>{x.summary_claims[0].citations=[];},x=>{x.summary_claims[0].citations[0].quote='Invented wording';},x=>{x.summary_claims[0].citations[0].job_id='unknown';},x=>{x.summary_claims[0].claim_id='s2';},x=>{x.summary_claims[0].citations.push(x.summary_claims[0].citations[0]);},x=>{x.summary='unreviewed bypass';},x=>{x.summary_claims[0].execute='publish';}]){const broken=structuredClone(r);mutate(broken);assert.throws(()=>validateReport(broken,evidence));}
});
test('review coverage rejects a legacy assessment-only rubber stamp and missing, duplicate or foreign claim checks',()=>{
 const r=report(),good=review(r);assert.equal(validateReview(good,r),good);
 for(const mutate of [x=>{delete x.summary_checks;},x=>{delete x.next_check_checks;},x=>{x.summary_checks=[];},x=>{x.summary_checks[0].claim_id='other';},x=>{x.next_check_checks[0].index='0';},x=>{x.checks[0].supported='yes';},x=>{x.next_check_checks[0].reason='';},x=>{x.summary_checks[0].override=true;}]){const broken=structuredClone(good);mutate(broken);assert.throws(()=>validateReview(broken,r));}
 const two=structuredClone(r);two.summary_claims.push({...two.summary_claims[0],claim_id:'s2'});const duplicate=review(two);duplicate.summary_checks[1].claim_id='s1';assert.throws(()=>validateReview(duplicate,two));
});
test('the known right-to-work summary overreach triggers revision even with a correct label and exact quote',async t=>{
 const {env,id}=await setup(t),bad=report();bad.summary_claims[0].text='This employer does not offer visa sponsorship.';
 // Quote matching establishes provenance, not support: the independent critic must reject the inference.
 assert.equal(validateReport(bad,evidence),bad);
 const critique=review(bad);critique.summary_checks[0]={claim_id:'s1',supported:false,reason:'The work-permission requirement does not explicitly refuse sponsorship; the claim also generalises this vacancy to the employer.'};
 const corrected=report(),calls=responses(env,[bad,critique,corrected,review(corrected)]);
 await analyseResearch(env,id);assert.equal((await reviewResearch(env,id)).revise,true);
 await analyseResearch(env,id,true);assert.equal((await reviewResearch(env,id,true)).revise,false);await finishResearch(env,id);
 const saved=JSON.parse(env.sql.prepare('SELECT report FROM agent_investigations WHERE id=?').get(id).report);
 assert.equal(saved.previous_report.summary_claims[0].text,bad.summary_claims[0].text);assert.equal(saved.previous_review.summary_checks[0].supported,false);assert.equal(saved.quality.accepted,true);assert.equal(saved.quality.reviewed_items,3);assert.equal(saved.publication,'none');assert.equal(calls(),4);
});
test('unsupported premises in follow-up questions trigger revision independently of summary and labels',async t=>{
 const {env,id}=await setup(t),r=report();r.next_checks=['Why does this employer refuse all sponsorship?'];const critique=review(r);critique.next_check_checks[0]={index:0,supported:false,reason:'The question assumes a refusal that the advert never states.'};responses(env,[r,critique]);await analyseResearch(env,id);assert.equal((await reviewResearch(env,id)).revise,true);
});
test('a second rejection remains a disputed private report and cannot be approved into memory',async t=>{
 const {env,id}=await setup(t),r=report(),critique=review(r);critique.summary_checks[0].supported=false;responses(env,[r,critique,r,critique]);await analyseResearch(env,id);await reviewResearch(env,id);await analyseResearch(env,id,true);await reviewResearch(env,id,true);await finishResearch(env,id);
 const saved=JSON.parse(env.sql.prepare('SELECT report FROM agent_investigations').get().report);assert.equal(saved.quality.accepted,false);assert.equal(saved.quality.unsupported_items,1);await assert.rejects(approveObservation(env,id,evidence[0].id,'owner'),/every independent-review objection/);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_memory').get().n,0);
});
test('finishing cannot turn missing summary reviews into a complete application receipt',async t=>{
 const {env,id}=await setup(t),r=report();env.sql.prepare('UPDATE agent_investigations SET report=? WHERE id=?').run(JSON.stringify({report:r,review:{checks:review(r).checks}}),id);await assert.rejects(finishResearch(env,id),/Incomplete independent review/);assert.equal(env.sql.prepare('SELECT state FROM agent_investigations').get().state,'running');
});
test('old policies remain readable but cannot resume or learn under new prompts',async t=>{
 const {env,id}=await setup(t);env.sql.prepare("UPDATE agent_investigations SET policy='investigator-v1'").run();await assert.rejects(researchContext(env,id),/older research policy/);await assert.rejects(analyseResearch(env,id),/older research policy/);
 env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();let gets=0;env.RESEARCH_WORKFLOW.get=()=>{gets++;throw Error('must not restart');};const req=new Request('https://sponsorintel.london/api/admin/agents/research/recover',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify({run_id:id})});assert.equal((await agentOperationsAPI(req,env,{user:{id:'owner'}})).status,400);assert.equal(gets,0);
 env.sql.prepare("UPDATE agent_investigations SET state='review'").run();await assert.rejects(approveObservation(env,id,evidence[0].id,'owner'),/older research policy/);assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations').get().calls,0);
});
test('cached model output must still satisfy the current step contract without a paid replay',async t=>{
 const {env,id}=await setup(t);env.sql.prepare("INSERT INTO agent_research_steps(run_id,name,role,state,created_at,output) VALUES(?,'analysis','investigator','completed',?,'{\"summary\":\"legacy bypass\"}')").run(id,new Date().toISOString());env.AI={run:()=>{throw Error('No new paid call');}};await assert.rejects(modelStep(env,id,'analysis','investigator','',{},x=>validateReport(x,evidence)));assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations').get().calls,0);
});
test('evaluation separately counts unsupported refusals from right-to-work wording',()=>{
 const r={assessments:RESEARCH_CASES.map(([job_id,,verdict])=>({job_id,verdict}))};r.assessments.find(x=>x.job_id==='right-to-work-only').verdict='unavailable';const score=scoreEvaluation(r);assert.equal(score.dataset,'sponsorship-challenges-v2');assert.equal(score.total,20);assert.equal(score.correct,19);assert.equal(score.unsupported_refusals,1);assert.equal(score.dangerous_false_positives,0);
});
test('review outcome includes all three claim types and never trusts a supplied acceptance flag',()=>{
 const r=report(),v=review(r);assert.equal(reviewOutcome(r,v).policy,RESEARCH_POLICY);for(const key of ['checks','summary_checks','next_check_checks']){const bad=structuredClone(v);bad[key][0].supported=false;assert.equal(reviewOutcome(r,bad).accepted,false);}assert.throws(()=>reviewOutcome(r,{...v,accepted:true}));
});

test('reviewer challenge supplies planted proposals without answer keys and records genuine rejection as success',async t=>{
 const env=database(t);env.RESEARCH_WORKFLOW={create:async()=>({})};env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';const {id}=await startInvestigation(env,'owner','evaluation','critic');await researchContext(env,id);await prepareCriticChallenge(env,id);await prepareCriticChallenge(env,id);
 const challenge=criticChallenge(),v=review(challenge.report);v.checks.find(x=>x.job_id==='conditional').supported=false;v.summary_checks.find(x=>x.claim_id==='s1').supported=false;v.summary_checks.find(x=>x.claim_id==='s3').supported=false;v.next_check_checks[0].supported=false;
 let calls=0;env.AI={run:async(model,input)=>{calls++;assert.equal(model,'critic');const data=JSON.parse(input.messages[1].content);assert.deepEqual(Object.keys(data).sort(),['evidence','proposed']);assert.ok(!JSON.stringify(data).includes('missed_unsupported'));return {response:JSON.stringify(v)};}};
 assert.equal((await reviewResearch(env,id)).revise,true);await finishResearch(env,id);const result=JSON.parse(env.sql.prepare('SELECT report FROM agent_investigations').get().report);assert.equal(result.evaluation.correct,10);assert.equal(result.evaluation.missed_unsupported,0);assert.equal(result.quality.accepted,false);assert.equal(calls,1);assert.equal(result.publication,'none');await assert.rejects(approveObservation(env,id,'conditional','owner'));
 const rubberStamp=review(challenge.report),score=scoreCriticEvaluation(rubberStamp);assert.equal(score.correct,6);assert.equal(score.missed_unsupported,4);assert.equal(scoreCriticEvaluation({}).correct,0);
});
test('unknown or mismatched evaluation suites cannot reserve work or manufacture an evaluation',async t=>{
 const {env,id}=await setup(t);for(const [kind,suite] of [['research','critic'],['evaluation','other']])await assert.rejects(startInvestigation(env,'owner',kind,suite),/supported research evaluation/);await assert.rejects(prepareCriticChallenge(env,id),/not active/);assert.equal(env.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,1);
});

test('quote references resolve only to original substrings and cannot override an advert or supply replacement text',async()=>{
 const {evidenceWithQuotes,resolveReport}=await import('../worker/research-contract.js');const r=report();for(const a of r.assessments){delete a.quote;a.quote_id='q1';}for(const c of r.summary_claims)for(const ref of c.citations){delete ref.quote;ref.quote_id='q1';}
 const canonical=resolveReport(r,evidence);assert.equal(canonical.assessments[0].quote,evidence[0].description);assert.equal(canonical.summary_claims[0].citations[0].quote,evidence[0].description);assert.equal(canonical.assessments[0].quote_id,undefined);
 for(const mutate of [x=>{x.assessments[0].quote_id='q99';},x=>{x.assessments[0].job_id='elsewhere';},x=>{x.assessments[0].quote='replacement';},x=>{x.summary_claims[0].citations[0].quote_id=null;}]){const broken=structuredClone(r);mutate(broken);assert.throws(()=>resolveReport(broken,evidence));}
 const long={...evidence[0],description:'a'.repeat(16000)};const spans=evidenceWithQuotes([long])[0].quote_options;assert.equal(spans.map(x=>x.text).join(''),long.description);assert.ok(spans.every(x=>x.text.length<=600));
});
test('selecting no quotation cannot establish a sponsorship commitment',async()=>{
 const {resolveReport}=await import('../worker/research-contract.js');const r=report();delete r.assessments[0].quote;r.assessments[0].quote_id='';r.assessments[0].verdict='offered';assert.throws(()=>resolveReport(r,evidence),/needs a quote/);
});
test('a known validation failure preserves the rejected structured draft and actual usage but does not retry',async t=>{
 const {env,id}=await setup(t);const r=report();r.assessments[0].quote='fabricated';let calls=0;env.AI={run:async()=>{calls++;return {response:r,usage:{total_tokens:41}};}};await assert.rejects(analyseResearch(env,id));await assert.rejects(analyseResearch(env,id));const step=env.sql.prepare('SELECT output,usage,state FROM agent_research_steps').get();assert.equal(step.state,'failed');assert.equal(JSON.parse(step.output).rejected_draft.assessments[0].quote,'fabricated');assert.equal(JSON.parse(step.usage).total_tokens,41);assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT report FROM agent_investigations').get().report,null);
});

test('a committed completion can be replayed after a lost acknowledgement without reviving a failed run',async t=>{
 const {env,id}=await setup(t),r=report();responses(env,[r,review(r)]);await analyseResearch(env,id);await reviewResearch(env,id);
 const prepare=env.DB.prepare;let lost=true;env.DB.prepare=query=>{const s=prepare(query);if(query.startsWith("UPDATE agent_investigations SET state='review'")){const first=s.first;s.first=async()=>{const saved=await first();if(lost){lost=false;throw Error('Acknowledgement lost');}return saved;};}return s;};
 await assert.rejects(finishResearch(env,id),/Acknowledgement/);assert.equal(env.sql.prepare('SELECT state FROM agent_investigations').get().state,'review');assert.deepEqual(await finishResearch(env,id),{state:'review'});assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations').get().calls,2);
 env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();await assert.rejects(finishResearch(env,id),/no longer active/);
});
