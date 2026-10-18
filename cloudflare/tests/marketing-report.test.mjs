import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {publishInsight,insightSocialCopy} from '../worker/insights.js';
import {syncMarketing,decideBrief} from '../worker/marketing.js';
import {dispatchMarketingAgents,captureMarketingContext,prepareReportMarketing,critiqueReportMarketing,concludeReportMarketing,failMarketingAgent,EDITORIAL_SOURCES} from '../worker/marketing-agents.js';
import {captureReportReview,validateReportReview,reportWriteGuard} from '../worker/marketing-report.js';
import {superviseAgents} from '../worker/agent-supervision.js';
const now=Date.parse('2026-10-18T01:00:00Z'),DAY=86400000,iso=n=>new Date(n).toISOString();
const snapshot=at=>({measured_at:iso(at),jobs:{total:20,employers:1,offered:2,conditional:3,unavailable:4,not_stated:11,early_career:6,salary:8},sources:[{id:'fictional',company:'Fictional employer',careers_url:'https://example.com/careers',last_success:iso(at),error:null,paused:0,roles:20}],held_batches:0,checks:Array.from({length:5},()=>({ok:true,security:true}))});
const fetcher=async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>s.path===new URL(url).pathname).flatMap(s=>s.facts).join(' ')+'</article>',{headers:{'content-type':'text/html'}});
async function setup(t,{prepare=true}={}){
 const env=database(t);env.AI_MODEL='synthetic-writer';env.AI_REVIEW_MODEL='different-synthetic-reviewer';env.MARKETING_WORKFLOW={create:async()=>{}};
 await publishInsight(env,'fictional-old-report',snapshot(now-12*DAY),now-12*DAY);await syncMarketing(env,now-12*DAY);
 await publishInsight(env,'fictional-report',snapshot(now-4*DAY),now-4*DAY);await syncMarketing(env,now);
 env.sql.prepare("UPDATE marketing_briefs SET state='published' WHERE id LIKE 'launch-%'").run();
 const brief=env.sql.prepare("SELECT * FROM marketing_briefs WHERE topic_key='report:fictional-report' AND destination='linkedin-company' AND id NOT LIKE 'launch-%'").get();
 const run=await dispatchMarketingAgents(env,now),context=await captureMarketingContext(env,run.id,fetcher,now);
 if(prepare&&context.report_review)await prepareReportMarketing(env,run.id,now);
 return {env,id:run.id,context,b:brief};
}
const review=target=>({checks:target.units.map(u=>({index:u.index,supported:true,reason:'Synthetic fixture checks receipt handling, not semantic quality.',evidence:u.claim?target.evidence.sources.map(s=>({source_id:s.id,quote:s.excerpt})):[]})),publishable:true,reason:'Synthetic acceptance verifies execution only, with no quality or publishing claim.'});
const caller=value=>async()=>({value,usage:{total_tokens:1}});
test('unchanged company report receives one charged critic call, exact copy and unchanged expiry; no delivery',async t=>{
 const {env,id,context,b}=await setup(t);assert.ok(context.report_review);assert.equal(context.existing_review,null);
 const before=env.sql.prepare('SELECT text,expires_at FROM marketing_versions WHERE brief_id=? AND version=1').get(b.id);
 assert.match(before.text,/5 adverts.*20 roles checked as of 14 October 2026/);
 await prepareReportMarketing(env,id,now+1000);
 let calls=0;const r=await critiqueReportMarketing(env,id,async(e,m,prompt,input)=>{calls++;assert.equal(m.model,'different-synthetic-reviewer');assert.equal(input.units[0].text,before.text.split('\n\n')[0]);assert.doesNotMatch(JSON.stringify(input),/PRIVATE_CUSTOMER_CV|purpose|fictional-report/);return caller(review(context.report_review))();},now);
 await critiqueReportMarketing(env,id,caller(r),now+1000);assert.equal(calls,1);
 const result=await concludeReportMarketing(env,id,r,now+2000);assert.equal(result.state,'reviewed');assert.equal(result.publication,'none');assert.equal(result.proposed_slot,undefined);
 const after=env.sql.prepare('SELECT text,expires_at FROM marketing_versions WHERE brief_id=? AND version=2').get(b.id);assert.deepEqual(after,before);
 assert.deepEqual({...env.sql.prepare('SELECT runs,calls FROM agent_research_budget').get()},{runs:1,calls:1});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts WHERE brief_id=?').get(b.id).n,0);
 assert.equal((await dispatchMarketingAgents(env,now+3000)).reused,true);
});
test('held, edited, expired, mismatched, media or previously reviewed company drafts cannot enter; personal drafts never enter',async t=>{
 for(const mode of ['held','edited','expired','copy','outbox','media','reviewed','personal','queue']){
  const {env,b}=await setup(t,{prepare:false});
  if(mode==='held'||mode==='reviewed')env.sql.prepare('UPDATE marketing_briefs SET state=? WHERE id=?').run(mode,b.id);
  if(mode==='edited')await decideBrief(env,{id:b.id,revision:1,kind:'revise',content:{...JSON.parse(env.sql.prepare('SELECT context FROM marketing_agent_runs').get().context).report_review.content,text:'An owner changed this report and it must retain its separate review.'},note:'Owner edits are not automatically overwritten or independently reviewed.',request_key:'owner-edit'},'owner:local',now);
  if(mode==='expired')env.sql.prepare('UPDATE marketing_versions SET expires_at=? WHERE brief_id=?').run(iso(now+3600000),b.id);
  if(mode==='copy')env.sql.prepare("UPDATE marketing_versions SET text='Unrecognised changed copy' WHERE brief_id=?").run(b.id);
  if(mode==='outbox')env.sql.prepare("UPDATE social_outbox SET state='sent' WHERE audience='company'").run();
  if(mode==='media')env.sql.prepare("UPDATE marketing_media_versions SET assets='[{}]' WHERE brief_id=?").run(b.id);
  if(mode==='personal')env.sql.prepare("UPDATE marketing_briefs SET state='held' WHERE destination='linkedin-company'").run();
  if(mode==='queue')env.sql.prepare("UPDATE marketing_briefs SET state='uncertain' WHERE id='launch-li-evidence'").run();
  assert.equal(await captureReportReview(env,now),null,mode);
  assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,0);
 }
});
test('full unit coverage and exact evidence are required, and fabricated approval cannot be applied',async t=>{
 const {env,id,context}=await setup(t);const target=context.report_review;
 for(const mutate of [r=>r.checks.pop(),r=>r.checks[1].index=0,r=>r.checks[0].evidence=[],r=>r.checks[0].evidence[0].quote='This quotation is not in the report',r=>r.publishable='yes']){const r=review(target);mutate(r);assert.throws(()=>validateReportReview(r,target));}
 await assert.rejects(concludeReportMarketing(env,id,review(target),now),/exact independent/);
 const result=await critiqueReportMarketing(env,id,caller(review(target)),now);result.reason+=' changed';await assert.rejects(concludeReportMarketing(env,id,result,now),/exact independent/);
});
test('withdrawn, replaced, changed, expired or queued report cannot approve after a completed critic',async t=>{
 for(const mode of ['withdrawn','replaced','changed','expired','queue','paused','sent']){
  const {env,id,context,b}=await setup(t),r=await critiqueReportMarketing(env,id,caller(review(context.report_review)),now);
  if(mode==='withdrawn')env.sql.prepare("UPDATE insight_publications SET state='withdrawn'").run();
  if(mode==='replaced')env.sql.prepare('UPDATE insight_publications SET updated_at=?').run(iso(now));
  if(mode==='changed')env.sql.prepare("UPDATE insight_publications SET title='Changed public report title'").run();
  if(mode==='queue')env.sql.prepare("UPDATE marketing_briefs SET state='scheduled' WHERE id='launch-li-evidence'").run();
  if(mode==='sent')env.sql.prepare("UPDATE social_outbox SET state='sent' WHERE audience='company'").run();
  if(mode==='paused')env.sql.prepare('UPDATE marketing_agent_controls SET enabled=0').run();
  const outcome=await concludeReportMarketing(env,id,r,mode==='expired'?now+4*DAY:now+1000);assert.equal(outcome.state,'held',mode);
  assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE brief_id=? AND kind='reviewed'").get(b.id).n,0);
 }
});
test('owner holds and revisions during critic are preserved by conclusion and stopped-workflow supervision',async t=>{
 for(const mode of ['held','revise']){
  const {env,id,context,b}=await setup(t),r=await critiqueReportMarketing(env,id,caller(review(context.report_review)),now);
  await decideBrief(env,{id:b.id,revision:2,kind:mode,content:{...context.report_review.content,text:'Owner rewritten company caption requires its own complete review.'},note:'Synthetic owner decision during independent editorial review.',request_key:'owner-decision'},'owner:local',now);
  const before=env.sql.prepare('SELECT state,version,revision,last_event FROM marketing_briefs WHERE id=?').get(b.id);
  env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('supervisor','running',?)").run(iso(now+7200000));env.MARKETING_WORKFLOW={get:async()=>({status:async()=>({status:'errored'})})};
  await superviseAgents(env,'supervisor',now+7200000);await concludeReportMarketing(env,id,r,now+1000);await failMarketingAgent(env,id);
  assert.deepEqual(env.sql.prepare('SELECT state,version,revision,last_event FROM marketing_briefs WHERE id=?').get(b.id),before);
 }
});
test('failed and rejected reviews stay held and charged without rewriting or retry',async t=>{
 for(const mode of ['uncertain','reject']){
  const {env,id,context,b}=await setup(t);let calls=0;
  const model=async()=>{calls++;if(mode==='uncertain')throw Error('Unknown provider outcome');const value=review(context.report_review);value.checks[0].supported=false;return {value};};
  if(mode==='uncertain'){await assert.rejects(critiqueReportMarketing(env,id,model,now));await assert.rejects(critiqueReportMarketing(env,id,model,now));await failMarketingAgent(env,id);}
  else await concludeReportMarketing(env,id,await critiqueReportMarketing(env,id,model,now),now);
  assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs WHERE id=?').get(b.id).state,'held');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_versions WHERE brief_id=?').get(b.id).n,2);
 }
});
test('atomic final guards preserve pause, publication and queue changes between checks and writes',async t=>{
 for(const mutation of [env=>env.sql.prepare("UPDATE social_outbox SET state='sent' WHERE audience='company'").run(),env=>env.sql.prepare('UPDATE business_controls SET enabled=0').run(),env=>env.sql.prepare("UPDATE insight_publications SET state='withdrawn'").run(),env=>env.sql.prepare("UPDATE marketing_briefs SET state='uncertain' WHERE id='launch-li-evidence'").run()]){
  const {env,b,context}=await setup(t),guard=reportWriteGuard(context.report_review),batch=env.DB.batch.bind(env.DB);
  env.DB.batch=async statements=>{mutation(env);return batch(statements);};
  await assert.rejects(decideBrief(env,{id:b.id,revision:2,kind:'reviewed',checks:{claims:true,sources:true,destination:true,duplication:true},note:'Synthetic atomic race test must not approve changed evidence.',request_key:'atomic-review'},'reviewer:local',now,guard));
  assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs WHERE id=?').get(b.id).state,'proposed');assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE brief_id=? AND kind='reviewed'").get(b.id).n,0);
 }
});
test('shared template preserves exact original company and personal wording',()=>{
 const data=snapshot(now);assert.equal(insightSocialCopy(data),'5 adverts in our selected UK catalogue contain positive or conditional sponsorship wording, out of 20 roles checked as of 18 October 2026. These are advert signals, not sponsorship guarantees. Our new report shows the evidence, coverage and limits.\n\nhttps://sponsorintel.london/insights/uk-sponsorship-jobs-report?utm_source=linkedin&utm_medium=organic_social&utm_campaign=evidence-report');
 assert.equal(insightSocialCopy(data,'personal'),'I’m building Sponsor Intel to make the UK job search easier to navigate.\n\n'+insightSocialCopy(data));
});
test('a lost decision acknowledgement replays its exact event without another version or critic call',async t=>{
 const {env,id,context,b}=await setup(t,{prepare:false}),batch=env.DB.batch.bind(env.DB);let lose=true;
 env.DB.batch=async statements=>{const result=await batch(statements);if(lose){lose=false;throw Error('Lost committed acknowledgement');}return result;};
 await prepareReportMarketing(env,id,now);await prepareReportMarketing(env,id,now+1000);
 const r=await critiqueReportMarketing(env,id,caller(review(context.report_review)),now);lose=true;
 await concludeReportMarketing(env,id,r,now);await concludeReportMarketing(env,id,r,now+1000);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_versions WHERE brief_id=?').get(b.id).n,2);
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE brief_id=? AND kind='reviewed'").get(b.id).n,1);
 assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
test('supervision holds an unchanged report only after its original workflow is confirmed stopped',async t=>{
 const {env,id,b}=await setup(t);env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('supervisor','running',?)").run(iso(now+7200000));
 env.MARKETING_WORKFLOW={get:async requested=>{assert.equal(requested,id);return {status:async()=>({status:'errored'})};}};
 const result=await superviseAgents(env,'supervisor',now+7200000);assert.equal(result.checks[1].draft,'held');assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs WHERE id=?').get(b.id).state,'held');assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,0);
});
test('an existing v6 attempt cannot acquire the new report route or reserve another daily start',async t=>{
 const {env,id}=await setup(t,{prepare:false});
 env.sql.prepare("UPDATE marketing_agent_runs SET policy='sourced-guides-eligible-planner-v6',context=NULL,state='queued',brief_id=NULL").run();
 const old=await captureMarketingContext(env,id,fetcher,now);assert.equal(old.report_review,undefined);
 assert.equal((await dispatchMarketingAgents(env,now)).reused,true);
 assert.equal(env.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,1);
});
