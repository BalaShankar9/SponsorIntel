import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {database} from './research-db.mjs';
import {applicationCampaignProposal,prepareApplicationCampaign} from '../worker/application-campaigns.js';
import {applicationControlSnapshot,reviewApplicationControl} from '../worker/application-controls.js';
import {applicationEvaluationAPI,dispatchApplicationEvaluation} from '../worker/application-evaluation.js';
const now=Date.parse('2026-10-13T16:00:00Z'),stamp=new Date(now).toISOString();
const reason='Agent-assisted fictional review: checked the exact prepared source and models, original outcomes and current controls. Preserve earlier records and the shared daily allowance; no automatic promotion.';
async function setup(t){const e=database(t);e.AI_MODEL='writer';e.AI_REVIEW_MODEL='reviewer';e.sql.exec('UPDATE application_eval_controls SET enabled=0');e.APPLICATION_EVAL_WORKFLOW={create:async()=>assert.fail('Review must not dispatch')};e.AI={run:async()=>assert.fail('Review must not call a model')};const p=await applicationCampaignProposal(e);await prepareApplicationCampaign(e,{expected_campaign:p.active.id,fingerprint:p.proposal.fingerprint,reason,request_key:'fictional-prepare-001'},'owner',now);return e;}
async function request(e,patch={}){const p=await applicationCampaignProposal(e),c=await applicationControlSnapshot(e);return{action:'resume',expected_campaign:p.active.id,expected_revision:c.revision,fingerprint:p.proposal.fingerprint,reason,request_key:crypto.randomUUID(),...patch};}
const retained=e=>['application_eval_campaigns','application_eval_campaign_control','application_eval_runs','application_eval_steps','application_assessments','agent_research_budget','business_daily'].map(n=>e.sql.prepare('SELECT * FROM '+n).all());
function run(e,state='completed',campaign='legacy-v1',profile='{}',cases='["graduate-year"]'){e.sql.prepare('INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids,campaign_id) VALUES(?,?,\'scheduled\',?,?,?,?,?,?)').run('earlier','2026-10-12',state,stamp,stamp,profile,cases,campaign);}
test('reviewed resume preserves evidence, held day and budgets; exact replay never reverses a subsequent pause',async t=>{
 const e=await setup(t);run(e);e.sql.exec("INSERT INTO agent_research_budget(day,runs,calls) VALUES('2026-10-13',1,0)");const before=retained(e),body=await request(e);
 assert.equal((await reviewApplicationControl(e,body,'owner',now)).current_enabled,true);assert.deepEqual(retained(e),before);assert.equal((await applicationControlSnapshot(e)).revision,1);
 const pause=await request(e,{action:'pause',fingerprint:null});await reviewApplicationControl(e,pause,'owner',now+1);
 const replay=await reviewApplicationControl(e,body,'owner',now+2);assert.equal(replay.replayed,true);assert.equal(replay.applied_enabled,true);assert.equal(replay.current_enabled,false);assert.equal(replay.current_revision,2);
 assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').get().n,2);assert.equal(e.sql.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='application-control-reviewed'").get().n,2);
 await assert.rejects(reviewApplicationControl(e,{...body,reason:reason+' Changed'},'owner',now),/different control review/);
 await assert.rejects(reviewApplicationControl(e,body,'other-owner',now),/different control review/);
 assert.throws(()=>e.sql.exec("UPDATE application_eval_control_reviews SET reason='rewrite'"),/append only/);assert.throws(()=>e.sql.exec('DELETE FROM application_eval_control_reviews'),/append only/);
});
test('resume rejects changed identity, stale revision/campaign, old toggle payload and short reasons without changing controls',async t=>{
 const e=await setup(t),body=await request(e),before=retained(e);
 for(const patch of [{fingerprint:'a'.repeat(64)},{expected_revision:9},{expected_campaign:'legacy-v1'},{reason:'short'},{enabled:true}])await assert.rejects(reviewApplicationControl(e,{...body,...patch},'owner',now));
 await assert.rejects(reviewApplicationControl(e,{enabled:true},'owner',now));e.AI_REVIEW_MODEL='different';await assert.rejects(reviewApplicationControl(e,body,'owner',now),/profile changed/);
 assert.equal((await applicationControlSnapshot(e)).enabled,false);assert.deepEqual(retained(e),before);
});
test('active or uncertain earlier outcomes and business pause prevent resume; known rejected output is retained and permitted',async t=>{
 for(const state of ['queued','running','calling','failed','business','rejected']){
  const e=await setup(t);run(e,['queued','running'].includes(state)?state:'completed');
  if(['calling','failed','rejected'].includes(state))e.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at) VALUES('earlier','graduate-year','candidate',?,?)").run(state,stamp);
  if(state==='business')e.sql.exec('UPDATE business_controls SET enabled=0');const body=await request(e),before=retained(e);
  if(state==='rejected')assert.equal((await reviewApplicationControl(e,body,'owner',now)).current_enabled,true);else await assert.rejects(reviewApplicationControl(e,body,'owner',now),/active or uncertain|Business operations/);
  assert.deepEqual(retained(e),before);
 }
});
test('same-version failed or complete comparisons cannot be restarted; pause remains possible with active work and changed models',async t=>{
 const e=await setup(t),p=await applicationCampaignProposal(e);run(e,'failed',p.active.id,JSON.stringify(p.active.profile));await assert.rejects(reviewApplicationControl(e,await request(e),'owner',now),/needs attention/);
 e.sql.exec("UPDATE application_eval_runs SET state='running'; UPDATE application_eval_controls SET enabled=1");e.AI_REVIEW_MODEL='different';e.sql.exec('UPDATE business_controls SET enabled=0');assert.equal((await reviewApplicationControl(e,await request(e,{action:'pause',fingerprint:null}),'owner',now)).current_enabled,false);
 const f=await setup(t),q=await applicationCampaignProposal(f);run(f,'completed',q.active.id,JSON.stringify(q.active.profile),JSON.stringify(Array.from({length:20},(_,i)=>'case-'+i)));await assert.rejects(reviewApplicationControl(f,await request(f),'owner',now),/complete/);
});
test('atomic admission catches a run, uncertain call, campaign change or owner pause arriving after inspection',async t=>{
 for(const race of ['active','uncertain','campaign','revision','business']){
  const e=await setup(t),body=await request(e),batch=e.DB.batch.bind(e.DB);
  e.DB.batch=async statements=>{if(race==='active')run(e,'queued');if(race==='uncertain'){run(e);e.sql.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at) VALUES('earlier','graduate-year','candidate','failed',?)").run(stamp);}if(race==='campaign')e.sql.exec("UPDATE application_eval_campaign_control SET campaign_id='legacy-v1'");if(race==='revision')e.sql.exec('UPDATE application_eval_controls SET revision=revision+1');if(race==='business')e.sql.exec('UPDATE business_controls SET enabled=0');return batch(statements);};
  await assert.rejects(reviewApplicationControl(e,body,'owner',now),/changed before saving/);assert.equal((await applicationControlSnapshot(e)).enabled,false);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').get().n,0);
 }
});
test('overlapping requests and lost acknowledgements create one immutable review and audit',async t=>{
 const e=await setup(t),body=await request(e),same=await Promise.all([reviewApplicationControl(e,body,'owner',now),reviewApplicationControl(e,body,'owner',now)]);assert.equal(same[0].revision,same[1].revision);assert.equal(e.sql.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').get().n,1);
 const f=await setup(t),a=await request(f),b={...a,request_key:crypto.randomUUID()},different=await Promise.allSettled([reviewApplicationControl(f,a,'owner',now),reviewApplicationControl(f,b,'owner',now)]);assert.equal(different.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').get().n,1);
 const g=await setup(t),c=await request(g),batch=g.DB.batch.bind(g.DB);g.DB.batch=async statements=>{await batch(statements);throw Error('Lost acknowledgement');};assert.equal((await reviewApplicationControl(g,c,'owner',now)).replayed,true);assert.equal(g.sql.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='application-control-reviewed'").get().n,1);
});
test('settings API requires same-origin structured review and cannot consume another used day',async t=>{
 const e=await setup(t),body=await request(e),owner={user:{id:'owner'}},post=(value,origin='https://sponsorintel.london')=>new Request('https://sponsorintel.london/api/admin/application-evaluation/settings',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
 assert.equal((await applicationEvaluationAPI(post(body,'https://other.test'),e,owner)).status,403);assert.equal((await applicationEvaluationAPI(post({enabled:true}),e,owner)).status,400);assert.equal((await applicationEvaluationAPI(post(body),e,owner)).status,200);
 e.sql.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids,campaign_id) VALUES('used','2026-10-13','scheduled','held',?,?,'{}','[]','legacy-v1')").run(stamp,stamp);
 const before=retained(e);assert.equal((await dispatchApplicationEvaluation(e,'scheduled',now)).id,'used');assert.deepEqual(retained(e),before);
});
test('migration preserves the prior pause timestamp and actor and starts review history empty',()=>{
 const sql=new DatabaseSync(':memory:');try{const dir=new URL('../migrations/',import.meta.url);for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<'0039').sort())sql.exec(readFileSync(new URL(f,dir),'utf8'));sql.prepare('UPDATE application_eval_controls SET enabled=0,updated_at=?,actor=?').run(stamp,'fictional-owner');const before={...sql.prepare('SELECT * FROM application_eval_controls').get()};sql.exec(readFileSync(new URL('0039_application_control_reviews.sql',dir),'utf8'));const {revision,reason,...after}=sql.prepare('SELECT * FROM application_eval_controls').get();assert.deepEqual(after,before);assert.equal(revision,0);assert.equal(reason,'');assert.equal(sql.prepare('SELECT COUNT(*) n FROM application_eval_control_reviews').get().n,0);}finally{sql.close();}
});
