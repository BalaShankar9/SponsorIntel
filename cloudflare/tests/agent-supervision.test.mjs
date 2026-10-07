import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {superviseAgents,supervisionFindings} from '../worker/agent-supervision.js';
import {createBrief,decideBrief} from '../worker/marketing.js';
import {finishResearch,modelStep} from '../worker/agent-research.js';
import {storeMarketingDraft} from '../worker/marketing-agents.js';
import {dispatchBusiness,recordBusinessFindings,businessFindings} from '../worker/business-operations.js';

const now=Date.now(),iso=n=>new Date(n).toISOString(),hour=3600000;
function envFor(t){const env=database(t);env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('business-qa','running',?)").run(iso(now));env.sql.prepare('INSERT INTO agent_research_budget VALUES(?,4,13)').run(iso(now).slice(0,10));env.AI={run:()=>{throw Error('No AI call is permitted during supervision.');}};return env;}
function seed(env,kind,age=2*hour){
 const id=kind+'-qa';
 if(kind==='research')env.sql.prepare("INSERT INTO agent_investigations(id,kind,state,actor,created_at,policy,models,context,calls) VALUES(?,'research','running','owner',?,'test','{}','{\"evidence\":[\"retain this evidence\"]}',3)").run(id,iso(now-age));
 else env.sql.prepare("INSERT INTO marketing_agent_runs(id,day,state,created_at,policy,models,context,calls) VALUES(?,'2000-01-01','running',?,'test',?, ?,2)").run(id,iso(now-age),JSON.stringify({writer:{model:'writer'}}),JSON.stringify({candidates:[{id:'test'}]}));
 return id;
}
function status(env,kind,value){let calls=0;env[kind==='research'?'RESEARCH_WORKFLOW':'MARKETING_WORKFLOW']={get:async()=>{calls++;if(value instanceof Error)throw value;return {status:async()=>({status:value})};},create:()=>{throw Error('No replacement workflow permitted');},restart:()=>{throw Error('No restart permitted');}};return ()=>calls;}
const version=()=>({purpose:'A synthetic sourced guide for recovery testing.',text:'This synthetic guide draft is private and should remain private.',sources:[{title:'Source',url:'https://sponsorintel.london/guides/build-a-shortlist',excerpt:'Public guide quotation for a synthetic recovery test.',checked_at:iso(now-hour)}],expires_at:iso(now+hour)});
async function draft(env,id){const b=await createBrief(env,{...version(),topic_key:'supervision-test',title:'Recovery test',destination:'facebook-company'},'marketing-writer:writer',now);env.sql.prepare('UPDATE marketing_agent_runs SET brief_id=? WHERE id=?').run(b.id,id);return b.id;}

test('idle supervision records both queues without model calls and replays its receipt',async t=>{
 const env=envFor(t),a=await superviseAgents(env,'business-qa',now),b=await superviseAgents(env,'business-qa',now);
 assert.deepEqual(a.checks.map(x=>x.action),['idle','idle']);assert.equal(b.replayed,true);assert.equal(a.model_calls,0);assert.equal(a.external_posts,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM business_steps').get().n,3);
});
test('confirmed stopped research is closed with an atomic receipt while evidence and budgets remain intact',async t=>{
 for(const outcome of ['complete','errored','terminated']){
  const env=envFor(t),id=seed(env,'research'),count=status(env,'research',outcome);const r=await superviseAgents(env,'business-qa',now);
  assert.equal(r.reconciled,1);assert.equal(count(),1);const saved=env.sql.prepare('SELECT state,context,calls FROM agent_investigations WHERE id=?').get(id);
  assert.equal(saved.state,'failed');assert.match(saved.context,/retain this evidence/);assert.equal(saved.calls,3);assert.deepEqual({...env.sql.prepare('SELECT runs,calls FROM agent_research_budget').get()},{runs:4,calls:13});
  assert.equal(JSON.parse(env.sql.prepare("SELECT result FROM business_steps WHERE name='supervise:research'").get().result).platform_status,outcome);
 }
});
test('running, waiting, queued and paused platform instances are retained even when old',async t=>{
 for(const outcome of ['running','waiting','queued','paused','waitingForPause']){const env=envFor(t),id=seed(env,'research');status(env,'research',outcome);const r=await superviseAgents(env,'business-qa',now);assert.equal(r.needs_attention,1);assert.equal(r.reconciled,0);assert.equal(env.sql.prepare('SELECT state FROM agent_investigations WHERE id=?').get(id).state,'running');assert.equal(supervisionFindings(r)[0].severity,'high');}
});
test('missing, unknown and unrecognised platform status cannot authorise recovery',async t=>{
 for(const outcome of [Error('not found'), 'unknown', 'completed', undefined]){const env=envFor(t);seed(env,'marketing');status(env,'marketing',outcome);const r=await superviseAgents(env,'business-qa',now);assert.equal(r.checks[1].action,'uncertain');assert.equal(env.sql.prepare('SELECT state FROM marketing_agent_runs').get().state,'running');}
});
test('recent runs need no platform call and invalid dates are held for inspection',async t=>{
 const env=envFor(t);seed(env,'research',hour);const calls=status(env,'research','complete');let r=await superviseAgents(env,'business-qa',now);assert.equal(r.checks[0].action,'within_window');assert.equal(calls(),0);
 const other=envFor(t);seed(other,'marketing');other.sql.prepare("UPDATE marketing_agent_runs SET created_at='invalid'").run();r=await superviseAgents(other,'business-qa',now);assert.equal(r.needs_attention,1);
});
test('business and editorial pauses prevent both inspection and recovery in their scope',async t=>{
 const env=envFor(t);seed(env,'research');seed(env,'marketing');const a=status(env,'research','complete'),b=status(env,'marketing','complete');env.sql.prepare('UPDATE business_controls SET enabled=0').run();assert.ok((await superviseAgents(env,'business-qa',now)).checks.every(x=>x.action==='paused'));assert.equal(a()+b(),0);
 const other=envFor(t);seed(other,'marketing');const calls=status(other,'marketing','complete');other.sql.prepare('UPDATE marketing_agent_controls SET enabled=0').run();assert.equal((await superviseAgents(other,'business-qa',now)).checks[1].action,'paused');assert.equal(calls(),0);
});
test('pause or completed receipt appearing during platform lookup wins over recovery',async t=>{
 for(const action of ['pause','finish']){const env=envFor(t);seed(env,'research');env.RESEARCH_WORKFLOW={get:async()=>({status:async()=>{env.sql.prepare(action==='pause'?'UPDATE business_controls SET enabled=0':"UPDATE agent_investigations SET state='review'").run();return {status:'complete'};}})};const r=await superviseAgents(env,'business-qa',now);assert.equal(r.reconciled,0);assert.equal(env.sql.prepare('SELECT state FROM agent_investigations').get().state,action==='pause'?'running':'review');}
});
test('unfinished agent-authored marketing copy is held with its version and steps retained',async t=>{
 const env=envFor(t),id=seed(env,'marketing'),brief=await draft(env,id);status(env,'marketing','errored');env.sql.prepare("INSERT INTO marketing_agent_steps VALUES(?,'write','writer','calling',?,NULL,NULL)").run(id,iso(now-hour));
 const r=await superviseAgents(env,'business-qa',now);assert.equal(r.reconciled,1);assert.equal(r.checks[1].draft,'held');assert.equal(env.sql.prepare('SELECT state FROM marketing_agent_runs').get().state,'held');assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs WHERE id=?').get(brief).state,'held');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_versions').get().n,1);assert.equal(env.sql.prepare('SELECT state FROM marketing_agent_steps').get().state,'calling');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);
});
test('an owner review or owner-authored revision is not overwritten by recovery',async t=>{
 for(const action of ['reviewed','revise']){const env=envFor(t),id=seed(env,'marketing'),brief=await draft(env,id);status(env,'marketing','complete');await decideBrief(env,{id:brief,revision:1,kind:action,note:'The owner has reviewed this exact version independently.',request_key:'owner-change',checks:{claims:true,sources:true,destination:true,duplication:true},...(action==='revise'?{content:version()}:{})},'owner',now);const r=await superviseAgents(env,'business-qa',now);assert.equal(r.checks[1].draft,'owner_decision_preserved');const b=env.sql.prepare('SELECT state,revision FROM marketing_briefs').get();assert.equal(b.revision,2);assert.equal(b.state,action==='reviewed'?'reviewed':'proposed');}
});
test('a lost database acknowledgement retains its committed recovery receipt',async t=>{
 const env=envFor(t);seed(env,'research');status(env,'research','terminated');const batch=env.DB.batch;let lost=true;env.DB.batch=async statements=>{const value=await batch(statements);if(lost){lost=false;throw Error('lost acknowledgement');}return value;};const r=await superviseAgents(env,'business-qa',now);assert.equal(r.reconciled,1);assert.equal(r.checks[0].action,'reconciled');
});
test('concurrent supervision cannot create duplicate recovery or reset the shared quota',async t=>{
 const env=envFor(t),id=seed(env,'marketing');await draft(env,id);status(env,'marketing','terminated');await Promise.all([superviseAgents(env,'business-qa',now),superviseAgents(env,'business-qa',now)]);assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='held'").get().n,1);assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM business_steps WHERE name='supervise:marketing'").get().n,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,13);
});
test('terminal research or marketing cannot be resurrected by late completion or draft writes',async t=>{
 const env=envFor(t),research=seed(env,'research'),marketing=seed(env,'marketing');env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();env.sql.prepare("UPDATE marketing_agent_runs SET state='held'").run();await assert.rejects(finishResearch(env,research),/no longer active/);await assert.rejects(modelStep(env,research,'analysis','investigator','',{},x=>x),/expired/);await assert.rejects(storeMarketingDraft(env,marketing,{source_id:'test'},{},false,now),/no longer active/);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_briefs').get().n,0);
});
test('new business runs retain the dispatcher and replay cannot relabel their origin',async t=>{
 const env=database(t);env.BUSINESS_WORKFLOW={create:async()=>({})};await dispatchBusiness(env,now,'scheduled');await dispatchBusiness(env,now,'owner');assert.equal(env.sql.prepare('SELECT trigger_kind FROM business_runs').get().trigger_kind,'scheduled');await assert.rejects(dispatchBusiness(env,now,'fake'),/Unknown/);
});
test('uncertain supervision findings remain actionable through the business issue queue',async t=>{
 const env=envFor(t);seed(env,'research');status(env,'research','unknown');const supervision=await superviseAgents(env,'business-qa',now);
 const s={checks:[],sources:[],immigration:[{last_success:iso(now)}],register:{checked_at:iso(now)},metrics:[],held_batches:0,feedback_count:0,supervision};assert.ok(businessFindings(s,now).some(x=>x.id==='supervision:research'));await recordBusinessFindings(env,'business-qa',s);assert.equal(env.sql.prepare("SELECT severity FROM business_issues WHERE id='supervision:research'").get().severity,'high');
});
