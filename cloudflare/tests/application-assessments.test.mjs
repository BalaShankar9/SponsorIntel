import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {applicationProfile,evaluationCase,applicationEvaluationAPI} from '../worker/application-evaluation.js';
import {applicationAssessmentTarget,applicationAssessmentDetails,applicationAssessmentSummary,recordApplicationAssessment} from '../worker/application-assessments.js';
import {APPLICATION_RUBRIC} from '../shared/application-assessment.js';
import {adminAPI} from '../worker/admin.js';
const now=Date.now(),stamp=new Date(now).toISOString(),caseId='graduate-year',runId='assessment-fixture';
async function setup(t){
 const env=database(t);env.AI_MODEL='fixture-writer';env.AI_REVIEW_MODEL='fixture-reviewer';env.AI={run:()=>{throw Error('An assessment must not call a model');}};
 const profile=await applicationProfile(env),c=evaluationCase(caseId),output=JSON.stringify({text:c.profile.cv});
 env.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids) VALUES(?,?,'owner','completed',?,?,?,?)").run(runId,stamp.slice(0,10),stamp,stamp,JSON.stringify(profile),JSON.stringify([caseId]));
 for(const stage of ['write','baseline','candidate'])env.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at,finished_at,output) VALUES(?,?,?,'completed',?,?,?)").run(runId,caseId,stage,stamp,stamp,output);
 return env;
}
async function input(env,stage='candidate',revision=0,verdict='acceptable',targetRun=runId){
 const target=await applicationAssessmentTarget(env,targetRun,caseId,stage),quote=target.c.profile.cv.slice(0,100);
 return {run_id:targetRun,case_id:caseId,stage,fingerprint:target.fingerprint,revision,request_key:crypto.randomUUID(),ratings:Object.fromEntries(APPLICATION_RUBRIC.map(c=>[c.id,verdict])),rationale:'Fictional fixture assessment comparing the retained draft with the original candidate source. This is not real model quality evidence.',evidence:[{source:'cv',quote},{source:'output',quote}]};
}
test('only a completed output from a finished pinned evaluation can be assessed',async t=>{
 for(const sql of ["UPDATE application_eval_runs SET state='running'","UPDATE application_eval_runs SET finished_at=NULL","UPDATE application_eval_steps SET state='rejected'","UPDATE application_eval_steps SET finished_at=NULL","UPDATE application_eval_runs SET profile='{}'","UPDATE application_eval_steps SET output='{}'"]){const env=await setup(t);env.sql.exec(sql);await assert.rejects(applicationAssessmentTarget(env,runId,caseId,'candidate'),{status:409});}
});
test('an assessment stores its exact target, evidence, owner attribution and audit without model work',async t=>{
 const env=await setup(t),value=await input(env);const result=await recordApplicationAssessment(env,value,'fictional-owner',now);
 assert.equal(result.assessment.content.outcome,'acceptable');assert.equal(result.assessment.output_fingerprint,value.fingerprint);assert.equal(result.assessment.content.independently_verified,false);assert.equal(result.assessment.content.automatic_promotion,false);
 assert.equal(env.sql.prepare('SELECT actor FROM application_assessments').get().actor,'fictional-owner');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
 const detail=await applicationAssessmentDetails(env,caseId),step=detail.steps.find(s=>s.stage==='candidate');assert.equal(step.assessment_current,true);assert.equal(step.assessment_history.length,1);assert.equal(step.raw,undefined);assert.match(detail.assessment_limitation,/not independently verified/);
});
test('unknown criteria, fabricated quotes, duplicate passages, injected actors and empty ratings are rejected',async t=>{
 const mutations=[x=>x.ratings.facts='excellent',x=>x.ratings.extra='acceptable',x=>delete x.ratings.facts,x=>x.actor='someone-else',x=>x.evidence[1].quote='A fictional invented quote that does not exist.',x=>x.evidence[0].source='private-cv',x=>x.evidence=[x.evidence[0],x.evidence[0]],x=>x.rationale='OK',x=>x.ratings=Object.fromEntries(APPLICATION_RUBRIC.map(c=>[c.id,'not_assessed']))];
 for(const mutate of mutations){const env=await setup(t),value=await input(env);mutate(value);await assert.rejects(recordApplicationAssessment(env,value,'owner',now),{status:400});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM application_assessments').get().n,0);}
});
test('a revised assessment appends history without rewriting the draft or the earlier judgment',async t=>{
 const env=await setup(t),before=env.sql.prepare('SELECT output FROM application_eval_steps WHERE stage=\'candidate\'').get();
 await recordApplicationAssessment(env,await input(env),'owner',now);
 const next=await input(env,'candidate',1,'needs_work');await recordApplicationAssessment(env,next,'owner',now+1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM application_assessments').get().n,2);assert.deepEqual(env.sql.prepare('SELECT output FROM application_eval_steps WHERE stage=\'candidate\'').get(),before);
 const detail=await applicationAssessmentDetails(env,caseId),step=detail.steps.find(s=>s.stage==='candidate');assert.equal(step.assessment.revision,2);assert.equal(step.assessment.content.outcome,'needs_work');assert.equal(step.assessment_history[1].content.outcome,'acceptable');
 assert.throws(()=>env.sql.exec("UPDATE application_assessments SET actor='changed'"),/immutable/);assert.throws(()=>env.sql.exec('DELETE FROM application_assessments'),/retained/);
});
test('replays and lost acknowledgements retain one assessment and one audit row',async t=>{
 const env=await setup(t),value=await input(env),batch=env.DB.batch;let first=true;
 env.DB.batch=async s=>{const result=await batch(s);if(first){first=false;throw Error('lost commit acknowledgement');}return result;};
 const a=await recordApplicationAssessment(env,value,'owner',now),b=await recordApplicationAssessment(env,value,'owner',now+1);assert.equal(a.replayed,true);assert.equal(a.assessment.id,b.assessment.id);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
 await assert.rejects(recordApplicationAssessment(env,{...value,rationale:value.rationale+' Changed.'},'owner',now),{status:409});
});
test('concurrent different assessments of one revision have one winner',async t=>{
 const env=await setup(t),a=await input(env),b=await input(env);
 const results=await Promise.allSettled([recordApplicationAssessment(env,a,'owner',now),recordApplicationAssessment(env,b,'owner',now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
});
test('output or policy changes between read and commit invalidate the write transaction',async t=>{
 for(const sql of ["UPDATE application_eval_steps SET output='{\"text\":\"Changed output during commit\"}'", "UPDATE application_eval_runs SET profile='{}'", "UPDATE application_eval_runs SET state='running'", "UPDATE application_eval_steps SET output='{\"text\":\"Changed writer draft during commit\"}' WHERE stage='write'"]){
  const env=await setup(t),value=await input(env),batch=env.DB.batch;env.DB.batch=async statements=>{env.sql.exec(sql);return batch(statements);};
  await assert.rejects(recordApplicationAssessment(env,value,'owner',now),{status:409});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM application_assessments').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,0);
 }
});
test('changed output invalidates an existing assessment and excludes it from comparisons',async t=>{
 const env=await setup(t);await recordApplicationAssessment(env,await input(env),'owner',now);
 env.sql.prepare("UPDATE application_eval_steps SET output=? WHERE stage='candidate'").run(JSON.stringify({text:evaluationCase(caseId).profile.cv+'\nChanged retained paragraph.'}));
 const detail=await applicationAssessmentDetails(env,caseId);assert.equal(detail.steps.find(s=>s.stage==='candidate').assessment_current,false);
 const summary=await applicationAssessmentSummary(env);assert.equal(summary.stale,1);assert.equal(summary.assessed_outputs,0);assert.equal(summary.unassessed_outputs,3);assert.equal(summary.groups.length,0);
});
test('paired counts require complete same-assessor judgments and keep policy profiles separate',async t=>{
 const env=await setup(t);await recordApplicationAssessment(env,await input(env,'baseline',0,'needs_work'),'owner',now);
 const candidate=await input(env);candidate.ratings.clarity='not_assessed';await recordApplicationAssessment(env,candidate,'owner',now);
 assert.equal((await applicationAssessmentSummary(env)).groups.length,0);
 await recordApplicationAssessment(env,await input(env,'candidate',1),'second-owner',now+1);assert.equal((await applicationAssessmentSummary(env)).groups.length,0);
 await recordApplicationAssessment(env,await input(env,'candidate',2),'owner',now+2);const summary=await applicationAssessmentSummary(env);
 assert.equal(summary.groups.length,1);assert.equal(summary.groups[0].paired_cases,1);assert.equal(summary.groups[0].candidate_only_acceptable,1);assert.equal(summary.automatic_promotion,false);assert.equal(summary.unassessed_outputs,1);assert.equal(summary.needs_work,1);
 const otherProfile=await applicationProfile({...env,AI_MODEL:'another-fixture-writer'});
 env.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids) VALUES('other-run','2026-09-01','owner','completed',?,?,?,?)").run(stamp,stamp,JSON.stringify(otherProfile),JSON.stringify([caseId]));
 env.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at,finished_at,output) SELECT 'other-run',case_id,stage,state,created_at,finished_at,output FROM application_eval_steps WHERE run_id=?").run(runId);
 for(const stage of ['baseline','candidate'])await recordApplicationAssessment(env,await input(env,stage,0,'acceptable','other-run'),'owner',now+3);
 const separated=await applicationAssessmentSummary(env);assert.equal(separated.groups.length,2);assert.equal(separated.groups.reduce((n,g)=>n+g.paired_cases,0),2);

});
test('assessment work is available while model execution is paused and cannot reset or promote anything',async t=>{
 const env=await setup(t);env.sql.exec('UPDATE business_controls SET enabled=0; UPDATE application_eval_controls SET enabled=0');
 await recordApplicationAssessment(env,await input(env),'owner',now);assert.equal(env.sql.prepare('SELECT enabled FROM application_eval_controls').get().enabled,0);assert.equal(env.sql.prepare('SELECT calls FROM application_eval_runs').get().calls,0);
});
test('owner endpoint rejects anonymous access, other origins, forged attribution and oversize content',async t=>{
 const env=await setup(t),owner={user:{id:'owner'}},request=(body,origin='https://sponsorintel.london')=>new Request('https://sponsorintel.london/api/admin/application-evaluation/assessment',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await input(env);
 assert.equal((await adminAPI(request(value),env)).status,403);assert.equal((await applicationEvaluationAPI(request(value,'https://elsewhere.test'),env,owner)).status,403);
 assert.equal((await applicationEvaluationAPI(request({...value,actor:'forged'}),env,owner)).status,400);assert.equal((await applicationEvaluationAPI(request({...value,rationale:'x'.repeat(15000)}),env,owner)).status,400);
 assert.equal((await applicationEvaluationAPI(request(value),env,owner)).status,200);
});
