import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import manifest from '../worker/application-contracts/2026-10-08-v1/manifest.json' with {type:'json'};
import {historicalApplicationContract} from '../worker/application-contracts.js';
import {verifyApplicationContracts} from '../scripts/verify-application-contracts.mjs';
import {retainedReviewDiagnostic} from '../worker/application-diagnostics.js';
import {applicationProfile,evaluationCase,initialiseApplicationEvaluation,dispatchApplicationEvaluation} from '../worker/application-evaluation.js';
import {database} from './research-db.mjs';

const profile=JSON.stringify(manifest.profile),current=JSON.stringify({...manifest.profile,implementation:'new-bundle'}),c=evaluationCase('graduate-year');
const stamp='2026-10-11T10:00:00.000Z';
const row=raw=>({stage:'candidate',state:'rejected',run_state:'completed',run_finished_at:stamp,finished_at:stamp,case_ids:JSON.stringify([c.id]),profile,raw:JSON.stringify(raw)});
test('archived inspection admits only the exact recorded configuration and unchanged fictional fixture',()=>{
 const match=historicalApplicationContract(profile,current);assert.equal(match.evidence.id,manifest.id);
 for(const field of ['suite','fixture_hash','policy','candidate_policy','writer','reviewer','implementation']){
  assert.equal(historicalApplicationContract(JSON.stringify({...manifest.profile,[field]:'unreviewed'}),current),null);
 }
 for(const patch of [{extra:true},{review_options:{...manifest.profile.review_options,max_tokens:9999}},{review_options:{...manifest.profile.review_options,temperature:.2}}])assert.equal(historicalApplicationContract(JSON.stringify({...manifest.profile,...patch}),current),null);
 for(const value of ['bad JSON','null','{}','[]',JSON.stringify({...manifest.profile,fixture_hash:'changed'}),JSON.stringify({...manifest.profile,suite:'changed'})])assert.equal(historicalApplicationContract(profile,value),null);
 // Current model drift does not rewrite a historical model; original models remain exact.
 assert.ok(historicalApplicationContract(profile,JSON.stringify({...manifest.profile,reviewer:'next-model'})));
 assert.ok(historicalApplicationContract(JSON.stringify(Object.fromEntries(Object.entries(manifest.profile).reverse())),current));
});
test('historical diagnostics preserve rejection, bounded evidence and uncertainty without exposing raw text',()=>{
 const value={sections:[{heading:'PROFILE',paragraphs:[{text:'Skills: Python, SQL, Excel.',evidence:[{source_id:'C1',quote:'Skills: Python, SQL, Excel.'}]}]}]};
 const original=row(value),before=structuredClone(original),valid=retainedReviewDiagnostic(original,c,current);
 assert.equal(valid.method,'archived_response_recheck_v1');assert.equal(valid.code,'cause_unresolved');assert.equal(valid.contract.recorded_implementation,manifest.profile.implementation);assert.deepEqual(original,before);
 const bad=row('PRIVATE_RAW_SENTINEL not JSON'),d=retainedReviewDiagnostic(bad,c,current);
 assert.equal(d.code,'invalid_json');assert.doesNotMatch(JSON.stringify(d),/PRIVATE_RAW_SENTINEL/);
 assert.equal(retainedReviewDiagnostic({...bad,run_state:'running'},c,current).code,'unfinished');
 assert.equal(retainedReviewDiagnostic({...bad,case_ids:'[]'},c,current).code,'case_mismatch');
 assert.equal(retainedReviewDiagnostic({...bad,raw:null},c,current).code,'response_unavailable');
 assert.equal(retainedReviewDiagnostic({...bad,profile:JSON.stringify({...manifest.profile,writer:'unknown'})},c,current).code,'configuration_changed');
 assert.equal(retainedReviewDiagnostic({...bad,stage:'baseline'},c,current).code,'invalid_json');
});
test('historical source identity is stable and edited helper bytes fail the build check',async t=>{
 const verified=await verifyApplicationContracts();assert.equal(verified.source_sha256,'da205d5d31e11d915938301ce1a67fa48299e8481e9e5ccd536b815e4f35399e');
 const directory=await mkdtemp(join(tmpdir(),'si-archive-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 await cp(new URL('../worker/application-contracts/2026-10-08-v1/',import.meta.url),directory,{recursive:true});
 const file=join(directory,'career-quality.js');await writeFile(file,(await readFile(file,'utf8'))+'\n// changed historical helper');
 await assert.rejects(verifyApplicationContracts(pathToFileURL(directory+'/')),/Historical application source changed/);
});
test('historical inspection never admits a legacy campaign to execution or resets its budget',async t=>{
 const env=database(t);env.AI_MODEL=manifest.profile.writer;env.AI_REVIEW_MODEL=manifest.profile.reviewer;
 env.APPLICATION_EVAL_WORKFLOW={create(){assert.fail('No new workflow permitted');}};env.AI={run(){assert.fail('No model permitted');}};
 const now=Date.parse(stamp);env.sql.exec('UPDATE business_controls SET enabled=1; UPDATE application_eval_controls SET enabled=1;');
 env.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids) VALUES('historical','2026-10-10','scheduled','completed',?,?,?,?)").run(stamp,stamp,profile,JSON.stringify([c.id]));
 const before=env.sql.prepare('SELECT * FROM application_eval_runs').all();
 assert.ok(historicalApplicationContract(profile,JSON.stringify(await applicationProfile(env))));
 const dispatch=await dispatchApplicationEvaluation(env,'scheduled',now);assert.equal(dispatch.state,'needs_attention');
 assert.deepEqual(env.sql.prepare('SELECT * FROM application_eval_runs').all(),before);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
 env.sql.exec("UPDATE application_eval_runs SET state='queued',finished_at=NULL WHERE id='historical'");
 await assert.rejects(initialiseApplicationEvaluation(env,'historical'),/paused or changed/);
});
