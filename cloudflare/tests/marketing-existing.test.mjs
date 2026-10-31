import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './research-db.mjs';
import {createBrief,decideBrief,syncMarketing,marketingSnapshot} from '../worker/marketing.js';
import {instagramWelcomeContent,WELCOME_SOURCES} from '../worker/marketing-welcome.js';
import {dispatchMarketingAgents,captureMarketingContext,prepareExistingMarketing,critiqueExistingMarketing,concludeExistingMarketing,failMarketingAgent,EDITORIAL_SOURCES} from '../worker/marketing-agents.js';
import {validateExistingReview} from '../worker/marketing-existing.js';
import {superviseAgents} from '../worker/agent-supervision.js';
import media from '../shared/marketing-media.json' with {type:'json'};
const now=Date.parse('2026-10-09T01:00:00Z'),DAY=86400000,iso=n=>new Date(n).toISOString(),image=readFileSync(new URL('../public'+new URL(media[0].url).pathname,import.meta.url));
function envFor(t){
 const env=database(t);env.AI_MODEL='synthetic-writer';env.AI_REVIEW_MODEL='synthetic-reviewer';env.MARKETING_WORKFLOW={create:async()=>({id:'local-only'})};
 env.ASSETS={fetch:async request=>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/social/'))return new Response(env.changedImage?'changed bytes':image,{headers:{'Content-Type':'image/png'}});
  const facts=[...EDITORIAL_SOURCES,...WELCOME_SOURCES].filter(s=>path===s.path+'/index.html').flatMap(s=>s.facts);
  return new Response('<article class="resource-article">'+facts.join(' ')+(env.changedGuide?' Additional changed context.':'')+'</article>',{headers:{'Content-Type':'text/html'}});
 }};
 env.sql.prepare("INSERT INTO jobs(id,board_id,company,title,location,description,apply_url,provider,sponsorship,level,first_seen,last_seen) VALUES('local','test','LOCAL employer','LOCAL role','London','Synthetic local role','https://example.com/job','test','not_stated','professional',?,?)").run(iso(now-DAY),iso(now-DAY));
 return env;
}
async function setup(t,{queue=false,prepare=true}={}){
 const env=envFor(t),content=await instagramWelcomeContent(env,undefined,now-DAY);
 const b=await createBrief(env,content,'template:instagram-welcome-v1:requested-by-local-qa',now-DAY);
 if(queue){await syncMarketing(env,now-DAY);env.sql.prepare("UPDATE marketing_briefs SET state='published' WHERE id='launch-fb-evidence'").run();}
 const run=await dispatchMarketingAgents(env,now),context=await captureMarketingContext(env,run.id,undefined,now);
 if(prepare&&context.existing_review)await prepareExistingMarketing(env,run.id,now);
 return {env,id:run.id,context,b};
}
const review=target=>({checks:target.units.map(u=>({index:u.index,supported:true,reason:'Synthetic response for execution tests; not an independent quality judgement.',evidence:u.claim?target.sources.map(s=>({source_id:s.id,quote:s.excerpt})):[]})),accessibility_consistent:true,publishable:true,reason:'Synthetic acceptance exercises the stored review and evidence controls only.'});
const caller=value=>async()=>({value,usage:{total_tokens:1}});

test('existing welcome gets one reviewer call, refreshed version and no fabricated provider receipt',async t=>{
 const {env,id,context,b}=await setup(t);
 assert.equal(context.existing_review.id,b.id);assert.equal(context.existing_review.units.length,14);
 await prepareExistingMarketing(env,id,now+1000);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_versions WHERE brief_id=?').get(b.id).n,2);
 let calls=0;const model=async(...args)=>{calls++;assert.doesNotMatch(JSON.stringify(args[3]),/requested-by-local-qa/);return caller(review(context.existing_review))();};
 const result=await critiqueExistingMarketing(env,id,model,now);
 await critiqueExistingMarketing(env,id,model,now+1000);assert.equal(calls,1);
 await concludeExistingMarketing(env,id,result,undefined,now+2000);
 const snapshot=await marketingSnapshot(env,now);assert.equal(snapshot.items[0].state,'reviewed');assert.equal(snapshot.items[0].receipts.length,0);
 assert.deepEqual({...env.sql.prepare('SELECT runs,calls FROM agent_research_budget').get()},{runs:1,calls:1});
 assert.equal(env.sql.prepare('SELECT calls FROM marketing_agent_runs').get().calls,1);
 assert.equal((await dispatchMarketingAgents(env,now+5000)).reused,true);
});
test('review cannot be applied without the exact completed independent model receipt',async t=>{
 const {env,id,context}=await setup(t);
 await assert.rejects(concludeExistingMarketing(env,id,review(context.existing_review),undefined,now),/model review receipt/);
 assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'proposed');
});
test('all caption, artwork and accessibility units need coverage and factual quote support',async t=>{
 const {context}=await setup(t);const target=context.existing_review;
 for(const mutate of [r=>r.checks.pop(),r=>r.checks[1].index=0,r=>r.checks[1].evidence=[],r=>r.checks[1].evidence[0].quote='An invented source quotation.',r=>r.accessibility_consistent='true']){const r=review(target);mutate(r);assert.throws(()=>validateExistingReview(r,target));}
});
test('changed sources or registered image bytes hold a completed review',async t=>{
 for(const flag of ['changedGuide','changedImage']){
  const {env,id,context}=await setup(t),r=await critiqueExistingMarketing(env,id,caller(review(context.existing_review)),now);
  env[flag]=true;const outcome=await concludeExistingMarketing(env,id,r,undefined,now+1000);
  assert.equal(outcome.state,'held');assert.match(outcome.reason,/changed or expired/);
  assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='reviewed'").get().n,0);
 }
});
test('owner edits and holds made during review are preserved by completion and failure handling',async t=>{
 for(const mode of ['held','revise']){
  const {env,id,context,b}=await setup(t),r=await critiqueExistingMarketing(env,id,caller(review(context.existing_review)),now);
  const content={...context.existing_review.content,text:'Owner-edited caption requiring its own independent review, with the same registered artwork.'};
  await decideBrief(env,{id:b.id,revision:2,kind:mode,content,request_key:'owner-'+mode,note:'Synthetic owner decision during the model call must be retained.'},'owner:local',now);
  const before=env.sql.prepare('SELECT state,version,revision,last_event FROM marketing_briefs WHERE id=?').get(b.id);
  await concludeExistingMarketing(env,id,r,undefined,now+1000);await failMarketingAgent(env,id);
  assert.deepEqual(env.sql.prepare('SELECT state,version,revision,last_event FROM marketing_briefs WHERE id=?').get(b.id),before);
 }
});
test('failed or uncertain model outcomes retain consumed calls and hold the unchanged template',async t=>{
 const {env,id}=await setup(t);let calls=0;
 const timeout=async()=>{calls++;throw Error('Synthetic response lost');};
 await assert.rejects(critiqueExistingMarketing(env,id,timeout,now));
 await assert.rejects(critiqueExistingMarketing(env,id,timeout,now+1000));assert.equal(calls,1);
 await failMarketingAgent(env,id);assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'held');
 assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
test('held or edited templates and full/uncertain queues are not auto-refreshed',async t=>{
 for(const mode of ['held','edited','uncertain','overdue']){
  const env=envFor(t),c=await instagramWelcomeContent(env,undefined,now-DAY),b=await createBrief(env,c,'template:instagram-welcome-v1:requested-by-local',now-DAY);
  if(mode==='held')await decideBrief(env,{id:b.id,revision:1,kind:'held',request_key:'owner-hold',note:'Synthetic owner hold must not be reversed automatically.'},'owner:local',now-DAY);
  if(mode==='edited')await decideBrief(env,{id:b.id,revision:1,kind:'revise',content:{...c,text:'Owner edited this caption and expects it to remain unchanged in future checks.'},request_key:'owner-edit',note:'Synthetic owner edit must not be overwritten by the template.'},'owner:local',now-DAY);
  if(mode==='uncertain'){await syncMarketing(env,now-DAY);env.sql.prepare("UPDATE marketing_briefs SET state='uncertain' WHERE destination='facebook-company'").run();}
  if(mode==='overdue')await syncMarketing(env,now-DAY);
  const run=await dispatchMarketingAgents(env,now),ctx=await captureMarketingContext(env,run.id,undefined,now);
  assert.equal(ctx.existing_review,null);assert.equal(env.sql.prepare('SELECT calls FROM marketing_agent_runs').get().calls,0);
  assert.equal(env.sql.prepare('SELECT version FROM marketing_briefs WHERE id=?').get(b.id).version,mode==='edited'?2:1);
 }
});

test('fresh immutable evidence lasts through the first legal slot after the launch queue',async t=>{
 const {env,id,b,context}=await setup(t,{queue:true});
 assert.equal(context.existing_review.slot,'2026-10-15T09:00:00.000Z');
 const versions=env.sql.prepare('SELECT version,expires_at FROM marketing_versions WHERE brief_id=? ORDER BY version').all(b.id);
 assert.ok(Date.parse(versions[0].expires_at)<Date.parse(context.slot));
 assert.ok(Date.parse(versions[1].expires_at)>Date.parse(context.slot));
 const r=await critiqueExistingMarketing(env,id,caller(review(context.existing_review)),now);
 const result=await concludeExistingMarketing(env,id,r,undefined,now);
 assert.equal(result.state,'reviewed');assert.equal(result.proposed_slot,context.slot);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts WHERE brief_id=?').get(b.id).n,0);
});
test('semantic rejection or inconsistent accessibility text holds the exact version',async t=>{
 for(const field of ['publishable','accessibility_consistent','supported']){
  const {env,id,context}=await setup(t),value=review(context.existing_review);
  if(field==='supported')value.checks[2].supported=false;else value[field]=false;
  const r=await critiqueExistingMarketing(env,id,caller(value),now);
  assert.equal((await concludeExistingMarketing(env,id,r,undefined,now)).state,'held');
  assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='reviewed'").get().n,0);
 }
});
test('supervision only holds the unchanged refreshed template after a confirmed stopped workflow',async t=>{
 for(const ownerEdited of [false,true]){
  const {env,id,context,b}=await setup(t);
  if(ownerEdited)await decideBrief(env,{id:b.id,revision:2,kind:'revise',content:{...context.existing_review.content,text:'An owner-written caption with its own separate evidence and review process.'},request_key:'owner-revise',note:'Synthetic owner change during a stopped workflow.'},'owner:local',now);
  env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('supervisor','running',?)").run(iso(now+2*3600000));
  env.MARKETING_WORKFLOW={get:async()=>({status:async()=>({status:'errored'})})};
  const result=await superviseAgents(env,'supervisor',now+2*3600000);
  assert.equal(result.checks[1].draft,ownerEdited?'owner_decision_preserved':'held');
  const current=env.sql.prepare('SELECT state,version FROM marketing_briefs WHERE id=?').get(b.id);
  assert.equal(current.state,ownerEdited?'proposed':'held');assert.equal(current.version,ownerEdited?3:2);
  assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,0);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);
 }
});
