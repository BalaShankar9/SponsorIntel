import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {applicationProfile,evaluationCase,applicationEvaluationAPI} from '../worker/application-evaluation.js';
import {applicationAssessmentDetails} from '../worker/application-assessments.js';
import {retainedReviewDiagnostic} from '../worker/application-diagnostics.js';
import {adminAPI} from '../worker/admin.js';

const c=evaluationCase('graduate-year'),stamp='2026-10-11T10:00:00.000Z';
const candidate=()=>({sections:[{heading:'PROFILE',paragraphs:[{text:'Skills: Python, SQL, Excel.',evidence:[{source_id:'C1',quote:'Skills: Python, SQL, Excel.'}]}]}]});
const row=raw=>({stage:'candidate',state:'rejected',run_state:'completed',run_finished_at:stamp,finished_at:stamp,case_ids:JSON.stringify([c.id]),profile:'pinned-profile',raw:JSON.stringify(raw)});
const diagnose=raw=>retainedReviewDiagnostic(row(raw),c,'pinned-profile');

test('retained review diagnostics distinguish safe structural, citation and numeric failures',()=>{
 const examples=[['invalid_json','MODEL_PRIVATE_SENTINEL is not JSON'],['structure',{sections:[],private_extra:'MODEL_PRIVATE_SENTINEL'}],['sections',{}],['headings',{sections:[{heading:'NONSENSE',paragraphs:[]}]}]];
 let value=candidate();value.sections[0].paragraphs[0].evidence=[];examples.push(['evidence_count',value]);
 value=candidate();value.sections[0].paragraphs[0].evidence[0].quote='MODEL_PRIVATE_SENTINEL invented source';examples.push(['source_quote',value]);
 value=candidate();value.sections[0].paragraphs[0].text='Managed 50 engineers.';examples.push(['linked_number',value]);
 for(const [code,raw] of examples){const d=diagnose(raw);assert.equal(d.state,'rejected_again');assert.equal(d.code,code);assert.doesNotMatch(JSON.stringify(d),/MODEL_PRIVATE_SENTINEL/);assert.equal(d.raw,undefined);}
});
test('a passing recheck never overrides the original rejection or establishes its cause',()=>{
 for(const raw of [candidate(),JSON.stringify(candidate())]){
  const original=row(raw),before=structuredClone(original),d=retainedReviewDiagnostic(original,c,'pinned-profile');
  assert.equal(d.state,'passes_recheck');assert.equal(d.code,'cause_unresolved');assert.match(d.summary,/original rejection remains/);assert.deepEqual(original,before);
 }
});
test('missing response, malformed wrapper, changed configuration and unfinished outcomes remain unavailable',()=>{
 const examples=[['response_unavailable',{raw:null}],['response_unavailable',{raw:'x'.repeat(100001)}],['response_unavailable',{raw:'null'}],['retention_invalid',{raw:'broken wrapper MODEL_PRIVATE_SENTINEL'}],['configuration_changed',{profile:'changed'}],['unfinished',{run_state:'running'}],['unfinished',{finished_at:null}],['case_mismatch',{case_ids:'[]'}],['case_mismatch',{case_ids:'broken'}]];
 for(const [code,patch] of examples){const d=retainedReviewDiagnostic({...row(candidate()),...patch},c,'pinned-profile');assert.equal(d.state,'unavailable');assert.equal(d.code,code);assert.doesNotMatch(JSON.stringify(d),/MODEL_PRIVATE_SENTINEL/);}
 assert.equal(retainedReviewDiagnostic(row(candidate()),c).code,'configuration_changed');
 for(const patch of [{stage:'write'},{state:'calling'},{state:'failed'},{state:'completed'}])assert.equal(retainedReviewDiagnostic({...row(candidate()),...patch},c,'pinned-profile'),null);
});
test('baseline checks use their own contract and generic exceptions cannot disclose response content',()=>{
 const text=c.profile.cv;
 const valid={text,checks:[{claim:'Fictional Anika Rao',source_ids:['C1']},{claim:'Skills: Python, SQL, Excel.',source_ids:['C1']},{claim:'Welcome desk volunteer',source_ids:['C1']}]};
 const d=raw=>retainedReviewDiagnostic({...row(raw),stage:'baseline'},c,'pinned-profile');
 assert.equal(d(valid).state,'passes_recheck');assert.equal(d({text}).code,'factual_checks');
 valid.checks[0].source_ids=['MODEL_PRIVATE_SENTINEL'];assert.equal(d(valid).code,'evidence_check');assert.doesNotMatch(JSON.stringify(d(valid)),/MODEL_PRIVATE_SENTINEL/);
});
test('owner case API diagnoses retained rejection without calls, writes, budgets or raw-response disclosure',async t=>{
 const env=database(t);env.AI_MODEL='fixture-writer';env.AI_REVIEW_MODEL='fixture-reviewer';env.AI={run(){throw Error('No model calls allowed');}};
 const profile=JSON.stringify(await applicationProfile(env));
 env.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids) VALUES('diagnostic-fixture','2026-10-11','scheduled','completed',?,?,?,?)").run(stamp,stamp,profile,JSON.stringify([c.id]));
 env.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at,finished_at,raw,error) VALUES('diagnostic-fixture',?,'candidate','rejected',?,?,?,?)").run(c.id,stamp,stamp,JSON.stringify('MODEL_PRIVATE_SENTINEL invalid JSON'),'Review output did not meet its document contract.');
 env.sql.exec('UPDATE application_eval_controls SET enabled=0; UPDATE business_controls SET enabled=0;');
 const before=env.sql.prepare('SELECT * FROM application_eval_steps').all();
 const request=()=>new Request('https://sponsorintel.london/api/admin/application-evaluation/case?id='+c.id);
 assert.equal((await adminAPI(request(),env)).status,403);
 const api=await applicationEvaluationAPI(request(),env,{user:{id:'fictional-owner'}}),value=await api.json();
 assert.equal(api.status,200);assert.equal(value.steps[0].diagnostic.code,'invalid_json');assert.equal(value.steps[0].state,'rejected');assert.equal(value.steps[0].assessment_target,null);
 assert.doesNotMatch(JSON.stringify(value),/MODEL_PRIVATE_SENTINEL/);assert.equal(value.steps[0].raw,undefined);
 assert.deepEqual(env.sql.prepare('SELECT * FROM application_eval_steps').all(),before);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,0);assert.equal(env.sql.prepare('SELECT enabled FROM application_eval_controls').get().enabled,0);
 const changed=await applicationAssessmentDetails(env,c.id,'different-profile');assert.equal(changed.steps[0].diagnostic.code,'configuration_changed');
});
