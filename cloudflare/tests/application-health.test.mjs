import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {applicationProfile,applicationEvaluationHealth,applicationEvaluationSnapshot,dispatchApplicationEvaluation} from '../worker/application-evaluation.js';
import {businessFindings} from '../worker/business-operations.js';

function setup(t){const e=database(t);e.AI_MODEL='fictional-writer';e.AI_REVIEW_MODEL='fictional-reviewer';e.AI={run:()=>{throw Error('No model calls allowed');}};return e;}
test('the health receipt reports either pause control separately from unchanged ready progress',async t=>{
 const e=setup(t);
 for(const [business,evaluation,reason] of [[1,0,'evaluation'],[0,1,'business'],[0,0,'business_and_evaluation'],[1,1,null]]){
  e.sql.prepare('UPDATE business_controls SET enabled=?').run(business);e.sql.prepare('UPDATE application_eval_controls SET enabled=?').run(evaluation);
  const h=await applicationEvaluationHealth(e),s=await applicationEvaluationSnapshot(e);
  assert.equal(h.state,reason?'paused':'ready');assert.equal(h.progress_state,'ready');assert.equal(h.pause_reason,reason);
  assert.equal(h.enabled,!!business&&!!evaluation);assert.equal(h.campaign_id,'legacy-v1');assert.equal(s.state,h.state);assert.equal(s.progress_state,h.progress_state);assert.equal(s.pause_reason,h.pause_reason);
 }
 assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_runs').get().n,0);
 assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
});
test('pausing a failed comparison keeps the owner finding and retained evidence unchanged',async t=>{
 const e=setup(t),stamp=new Date().toISOString(),profile=JSON.stringify(await applicationProfile(e));
 e.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids,error) VALUES('failed-example','2026-10-10','scheduled','failed',?,?,?,'[\"graduate-year\"]','Retained fictional failure')").run(stamp,stamp,profile);
 const before=e.sql.prepare('SELECT * FROM application_eval_runs').all();
 e.sql.prepare('UPDATE application_eval_controls SET enabled=0').run();
 const h=await applicationEvaluationHealth(e);assert.equal(h.state,'needs_attention');assert.equal(h.operation_state,'paused');assert.equal(h.progress_state,'needs_attention');
 const snapshot={checks:[],sources:[],immigration:[],metrics:[],application_evaluation:h};
 assert.ok(businessFindings(snapshot).some(f=>f.id==='application-evaluation-held'));
 assert.deepEqual(await dispatchApplicationEvaluation(e),{state:'paused'});
 assert.deepEqual(e.sql.prepare('SELECT * FROM application_eval_runs').all(),before);
 assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
 // Existing retained snapshots without the additive field still surface holds.
 snapshot.application_evaluation={state:'needs_attention'};
 assert.ok(businessFindings(snapshot).some(f=>f.id==='application-evaluation-held'));
});
test('paused in-flight and changed-policy states cannot become an unqualified ready signal',async t=>{
 const e=setup(t),stamp=new Date().toISOString(),profile=await applicationProfile(e);
 e.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,profile,case_ids) VALUES('running-example','2026-10-11','scheduled','running',?,?,'[\"graduate-year\"]')").run(stamp,JSON.stringify(profile));
 e.sql.prepare('UPDATE business_controls SET enabled=0').run();
 const active=await applicationEvaluationHealth(e);assert.equal(active.state,'paused');assert.equal(active.progress_state,'running');assert.equal(active.pause_reason,'business');
 e.AI_MODEL='different-fictional-writer';
 const changed=await applicationEvaluationHealth(e);assert.equal(changed.state,'needs_attention');assert.equal(changed.operation_state,'paused');assert.equal(changed.progress_state,'needs_attention');
 e.sql.prepare('UPDATE business_controls SET enabled=1').run();assert.equal((await applicationEvaluationHealth(e)).state,'needs_attention');
 assert.equal(e.sql.prepare('SELECT state FROM application_eval_runs').get().state,'running');
 assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_steps').get().n,0);
});
