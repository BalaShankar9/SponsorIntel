import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {database} from './research-db.mjs';
import {applicationSource,verifyApplicationSource} from '../scripts/application-source.mjs';
import {candidateReviewOptions,applicationProfile} from '../worker/application-profile.js';
import {activeApplicationCampaign,applicationCampaignProposal,prepareApplicationCampaign} from '../worker/application-campaigns.js';
import {dispatchApplicationEvaluation,initialiseApplicationEvaluation,applicationModelStep,applicationProgress,applicationEvaluationAPI} from '../worker/application-evaluation.js';
import old from '../worker/application-contracts/2026-10-08-v1/manifest.json' with {type:'json'};
const now=Date.parse('2026-10-11T16:00:00Z'),stamp=new Date(now).toISOString();
const reason='Agent-assisted review of retained malformed candidate responses. Request a bounded schema in a separate comparison; keep the evaluator paused and preserve all earlier evidence and allowances. No quality improvement is yet established.';
function setup(t){const e=database(t);e.AI_MODEL=old.profile.writer;e.AI_REVIEW_MODEL=old.profile.reviewer;e.sql.exec('UPDATE application_eval_controls SET enabled=0');e.APPLICATION_EVAL_WORKFLOW={create:async()=>({})};return e;}
function seed(e,state='completed',day='2026-10-11'){e.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids,calls) VALUES('old',?,'scheduled',?,?,?,?,?,3)").run(day,state,stamp,stamp,JSON.stringify(old.profile),'["graduate-year"]');e.sql.prepare("INSERT INTO agent_research_budget(day,runs,calls) VALUES(?,2,6)").run(day);}
async function input(e,key='request-new-comparison-001'){const p=await applicationCampaignProposal(e);return{expected_campaign:p.active.id,fingerprint:p.proposal.fingerprint,reason,request_key:key};}
const retained=e=>['application_eval_runs','application_eval_steps','application_assessments','agent_research_budget','application_eval_controls'].map(t=>e.sql.prepare('SELECT * FROM '+t).all());
test('preparing a separate comparison preserves old evidence, pause and shared budgets; replay remains truthful after resume',async t=>{
 const e=setup(t);seed(e);const before=retained(e),body=await input(e);const out=await prepareApplicationCampaign(e,body,'owner',now);
 assert.equal(out.paused,true);assert.deepEqual(retained(e),before);assert.equal((await activeApplicationCampaign(e)).id,out.id);assert.equal((await applicationProgress(e)).completed,0);
 assert.equal((await applicationCampaignProposal(e)).proposal.can_prepare,false);assert.equal((await prepareApplicationCampaign(e,body,'owner',now)).replayed,true);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
 e.sql.exec('UPDATE application_eval_controls SET enabled=1');const replay=await prepareApplicationCampaign(e,body,'owner',now);assert.equal(replay.paused,false);assert.equal(replay.prepared_paused,true);
 await assert.rejects(prepareApplicationCampaign(e,{...body,reason:reason+' Changed.'},'owner',now),/different review/);
 assert.equal((await dispatchApplicationEvaluation(e,'scheduled',now)).other_campaign,true);assert.equal(e.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,6);
});
test('new versions cannot bypass running or uncertain previous calls, or a live evaluator',async t=>{
 for(const mode of ['queued','running','calling','failed','enabled']){
  const e=setup(t);seed(e,['queued','running'].includes(mode)?mode:'completed');
  if(['calling','failed'].includes(mode))e.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at) VALUES('old','graduate-year','write',?,?)").run(mode,stamp);
  if(mode==='enabled')e.sql.exec('UPDATE application_eval_controls SET enabled=1');
  const before=retained(e);assert.equal((await applicationCampaignProposal(e)).proposal.can_prepare,false);await assert.rejects(prepareApplicationCampaign(e,await input(e),'owner',now),/changed/);assert.deepEqual(retained(e),before);
 }
});
test('concurrent preparations retain exactly one version and audit; lost acknowledgement replays that version',async t=>{
 const e=setup(t),body=await input(e),result=await Promise.allSettled([prepareApplicationCampaign(e,body,'owner',now),prepareApplicationCampaign(e,{...body,request_key:'request-new-comparison-002'},'owner',now)]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_campaigns').get().n,2);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
 const same=setup(t),sameInput=await input(same),sameResults=await Promise.all([prepareApplicationCampaign(same,sameInput,'owner',now),prepareApplicationCampaign(same,sameInput,'owner',now)]);assert.equal(sameResults[0].id,sameResults[1].id);assert.equal(same.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
 const f=setup(t),request=await input(f),batch=f.DB.batch.bind(f.DB);f.DB.batch=async s=>{await batch(s);throw Error('lost acknowledgement');};assert.equal((await prepareApplicationCampaign(f,request,'owner',now)).replayed,true);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
});
test('stale, forged and injected version requests cannot change the selection',async t=>{
 const e=setup(t),body=await input(e);
 for(const patch of [{fingerprint:'a'.repeat(64)},{expected_campaign:'unknown'},{enabled:true},{reason:'short'}])await assert.rejects(prepareApplicationCampaign(e,{...body,...patch},'owner',now));
 const request=new Request('https://sponsorintel.london/api/admin/application-evaluation/campaign',{method:'POST',headers:{Origin:'https://elsewhere.test','Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await applicationEvaluationAPI(request,e,{user:{id:'owner'}})).status,403);assert.equal((await activeApplicationCampaign(e)).id,'legacy-v1');
});
test('an identical request committed between replay lookup and proposal is reconciled without another version',async t=>{
 const e=setup(t),body=await input(e),prepare=e.DB.prepare.bind(e.DB);let intercept=true;
 e.DB.prepare=q=>{const statement=prepare(q);if(intercept&&q.startsWith('SELECT c.* FROM application_eval_campaigns'))return {first:async()=>{intercept=false;await prepareApplicationCampaign(e,body,'owner',now);return statement.first();}};return statement;};
 const result=await prepareApplicationCampaign(e,body,'owner',now);assert.equal(result.replayed,true);assert.equal(result.paused,true);
 assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_campaigns').get().n,2);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
});
test('a reviewed version stays paused; a later fictional scheduled run uses one shared start and pins its schema',async t=>{
 const e=setup(t);seed(e);const out=await prepareApplicationCampaign(e,await input(e),'owner',now);let creates=0,calls=0;e.APPLICATION_EVAL_WORKFLOW.create=async()=>{creates++;};
 assert.equal((await dispatchApplicationEvaluation(e,'scheduled',now+86400000)).state,'paused');assert.equal(creates,0);
 e.sql.exec('UPDATE application_eval_controls SET enabled=1');const r=await dispatchApplicationEvaluation(e,'scheduled',now+86400000);assert.equal(r.state,'queued');assert.equal(creates,1);assert.equal(e.sql.prepare('SELECT campaign_id FROM application_eval_runs WHERE id=?').get(r.id).campaign_id,out.id);
 await initialiseApplicationEvaluation(e,r.id);const caseId='graduate-year';e.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at,output) VALUES(?,?,'write','completed',?,?)").run(r.id,caseId,stamp,JSON.stringify({text:'A fictional source-based draft.'}));
 e.AI={run:async(model,options)=>{calls++;assert.equal(options.response_format.type,'json_schema');assert.equal(options.response_format.json_schema.additionalProperties,false);return {response:'invalid JSON'};}};
 assert.equal((await applicationModelStep(e,r.id,caseId,'candidate',now+86400000)).state,'rejected');await applicationModelStep(e,r.id,caseId,'candidate',now+86400000);assert.equal(calls,1);assert.equal(e.sql.prepare("SELECT calls FROM agent_research_budget WHERE day='2026-10-12'").get().calls,1);
 assert.equal(e.sql.prepare("SELECT calls FROM agent_research_budget WHERE day='2026-10-11'").get().calls,6);
});
test('pause and version races stop dispatch or call reservation without consuming allowance',async t=>{
 for(const action of ['dispatch','model']){
  const e=setup(t);e.sql.exec('UPDATE application_eval_controls SET enabled=1');let modelCalls=0;e.AI={run:async()=>{modelCalls++;assert.fail('No provider call');}};
  let r;if(action==='model'){r=await dispatchApplicationEvaluation(e,'scheduled',now);await initialiseApplicationEvaluation(e,r.id);}
  const batch=e.DB.batch.bind(e.DB);e.DB.batch=async s=>{e.sql.exec('UPDATE application_eval_controls SET enabled=0');return batch(s);};
  if(action==='dispatch')assert.equal((await dispatchApplicationEvaluation(e,'scheduled',now)).state,'paused_or_changed');else await assert.rejects(applicationModelStep(e,r.id,'graduate-year','write',now),/before reserving/);
  assert.equal(modelCalls,0);assert.equal(e.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,0);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_steps').get().n,0);
 }
});
test('migration preserves old columns exactly, tags rollback inserts and prevents reassignment or false profiles',async()=>{
 const sql=new DatabaseSync(':memory:');try{
  const dir=new URL('../migrations/',import.meta.url);for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')&&f<'0036').sort())sql.exec(await readFile(new URL(f,dir),'utf8'));
  sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,profile,case_ids) VALUES('historic','2026-10-10','scheduled','completed',?,?,'[]')").run(stamp,JSON.stringify(old.profile));
  const before=sql.prepare('SELECT * FROM application_eval_runs').all();sql.exec(await readFile(new URL('0036_application_campaigns.sql',dir),'utf8'));
  assert.deepEqual(sql.prepare('SELECT * FROM application_eval_runs').all().map(({campaign_id,...r})=>({...r})),before.map(r=>({...r})));assert.equal(sql.prepare('SELECT campaign_id FROM application_eval_runs').get().campaign_id,'legacy-v1');
  sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,profile,case_ids) VALUES('rollback','2026-10-11','scheduled','completed',?,?,'[]')").run(stamp,JSON.stringify(old.profile));assert.equal(sql.prepare("SELECT campaign_id FROM application_eval_runs WHERE id='rollback'").get().campaign_id,'legacy-v1');
  assert.throws(()=>sql.exec("UPDATE application_eval_runs SET campaign_id=NULL"),/immutable/);assert.throws(()=>sql.exec("DELETE FROM application_eval_campaigns"),/retained/);
  sql.prepare("INSERT INTO application_eval_campaigns VALUES('new','{}',?,'owner',?,'request-000000001','hash')").run(stamp,reason);assert.throws(()=>sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,profile,case_ids,campaign_id) VALUES('wrong','2026-10-12','scheduled','queued',?,'wrong','[]','new')").run(stamp),/mismatch/);
 }finally{sql.close();}
});
test('source identity detects helper, prompt, schema and fixture edits and all untracked imports',async t=>{
 const actual=await verifyApplicationSource(),directory=await mkdtemp(join(tmpdir(),'si-profile-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const f of [...Object.keys(actual.files),'worker/application-source.json']){await mkdir(join(directory,dirname(f)),{recursive:true});await cp(new URL('../'+f,import.meta.url),join(directory,f));}
 const root=pathToFileURL(directory+'/');assert.deepEqual(await applicationSource(root),actual);
 for(const f of ['worker/career-quality.js','worker/career-writer.js','worker/application-profile.js','tests/fixtures/application-development-20.json']){const path=join(directory,f),before=await readFile(path,'utf8');await writeFile(path,before+'\n ');await assert.rejects(verifyApplicationSource(root),/source changed/);await writeFile(path,before);}
 const path=join(directory,'worker/career-quality.js'),before=await readFile(path,'utf8');for(const line of ["import './missing.js';","export {x} from './missing.js';","const x=import('./missing.js');","const x=require('./missing.js');"]){await writeFile(path,before+'\n'+line);await assert.rejects(applicationSource(root),/dependency/);}
});
test('candidate schema pins both document kinds while the baseline keeps its existing request contract',async()=>{
 const cv=candidateReviewOptions('cv'),letter=candidateReviewOptions('coverLetter');assert.equal(cv.max_tokens,2700);assert.equal(cv.temperature,.1);assert.equal(cv.response_format.type,'json_schema');assert.deepEqual(cv.response_format.json_schema.required,['sections']);assert.equal(letter.response_format.json_schema.properties.sections.maxItems,1);assert.deepEqual(letter.response_format.json_schema.properties.sections.items.properties.heading.enum,['BODY']);assert.equal(letter.response_format.json_schema.properties.sections.items.properties.paragraphs.minItems,2);assert.throws(()=>candidateReviewOptions('other'));
 const p=await applicationProfile({AI_MODEL:'writer',AI_REVIEW_MODEL:'reviewer'});assert.equal(p.review_options.response_format.type,'json_object');assert.equal(p.identity_method,'source-graph-sha256-v1');assert.notEqual(p.policy,old.profile.policy);
});
