import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {database} from './research-db.mjs';
import {digest} from '../worker/auth.js';
import {compactPlannerContext,legacyPlannerContext,COMPACT_MARKETING_POLICY,PLANNER_INPUT_VERSION} from '../worker/marketing-planner-input.js';
import {MARKETING_POLICY,EDITORIAL_SOURCES,dispatchMarketingAgents,captureMarketingContext,planMarketing,critiqueMarketing} from '../worker/marketing-agents.js';
const now=Date.parse('2026-10-15T01:00:00Z'),stamp=new Date(now).toISOString();
const source={id:'job-fixture',kind:'opportunity',title:'Fictional role',topic_key:'fixture',path:'/jobs/fixture',url:'https://sponsorintel.london/jobs/fixture',campaign:'fb-opportunity',facts:['Fictional role in London.','Sponsorship may be considered subject to experience.','A licence alone is not an offer.','No visa or job offer is guaranteed.'],required_segments:['Fictional role in London.'],checked_at:stamp,expires_at:'2026-10-16T00:00:00Z',content_hash:'fictional-proof',proposed_slot:'2026-10-15T09:00:00Z',limitation:'Recheck the current original.',advert:{description:'COMPLETE ORIGINAL FICTIONAL ADVERT',evidence:'subject to experience'},opportunity:{job_id:'fixture',fingerprint:'fictional-proof'},private_extra:'PRIVATE_EXTRA'};
function context(){return {observed_at:stamp,sources:[source,{...source,id:'ineligible',facts:['INELIGIBLE LONG DESCRIPTION'.repeat(100)],advert:{description:'INELIGIBLE ORIGINAL'}}],candidates:[source],unavailable:['changed-guide'],slot:source.proposed_slot,queue:[{id:'held-draft',state:'held',text:'Existing held caption',scheduled_at:null}],metrics:[{event:'campaign_page_view',count:0}],measurement:{completed_days:0,browser_evidence:{evidence_checks:null,limitation:'Not unique people'}},performance:{items:[{metrics:{clicks:2,link_clicks:null},window_type:'lifetime',published_at:null}],limit:'No causal inference'},measurement_limit:'Not conversions',opportunity_scan:{ready:1,held:1},existing_review:{private:'NOT FOR PLANNER'},unknown_private:'PRIVATE_CONTEXT'};}
const decision={decision:'draft',source_id:source.id,reason:'The eligible dated evidence supports a useful fictional learning example.',ranked:[{source_id:source.id,reason:'The only eligible supplied candidate preserves the conditions.'}],timing_reason:'Use only the supplied slot while the evidence is current.'};
async function setup(t,policy=MARKETING_POLICY){const env=database(t),c=context(),input=JSON.stringify(compactPlannerContext(c));if(policy===MARKETING_POLICY)c.planner_input={version:PLANNER_INPUT_VERSION,characters:input.length,sha256:await digest(input)};env.sql.prepare("INSERT INTO marketing_agent_runs(id,day,state,created_at,policy,models,context) VALUES('marketing-2026-10-15','2026-10-15','running',?,?,?,?)").run(stamp,policy,JSON.stringify({writer:{provider:'cloudflare',model:'writer'},reviewer:{provider:'cloudflare',model:'different-critic'}}),JSON.stringify(c));return {env,c,id:'marketing-2026-10-15'};}
test('eligible projection keeps every candidate condition, slot, queue and measurement unchanged while excluding duplicate/non-selectable text',()=>{
 const c=context(),copy=structuredClone(c),p=compactPlannerContext(c);
 assert.deepEqual(c,copy);assert.deepEqual(p.candidates[0].facts,source.facts);assert.deepEqual(p.candidates[0].required_segments,source.required_segments);assert.equal(p.candidates[0].expires_at,source.expires_at);assert.equal(p.candidates[0].proposed_slot,source.proposed_slot);
 for(const key of ['queue','metrics','measurement','performance','measurement_limit','opportunity_scan','unavailable','slot'])assert.deepEqual(p[key],c[key]);
 assert.deepEqual(p.non_candidates,[{id:'ineligible',title:source.title,kind:'opportunity'}]);assert.doesNotMatch(JSON.stringify(p),/PRIVATE_|INELIGIBLE LONG|COMPLETE ORIGINAL|NOT FOR PLANNER/);assert.equal(JSON.stringify(p).split(source.facts[1]).length-1,1);assert.equal(p.measurement.browser_evidence.evidence_checks,null);assert.equal(p.metrics[0].count,0);
});
test('new capture pins the compact input and the exact pinned input reaches the planner, with no provider parameter change',async t=>{
 const env=database(t);env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';env.MARKETING_WORKFLOW={create:async()=>{}};
 const r=await dispatchMarketingAgents(env,now),c=await captureMarketingContext(env,r.id,async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>s.path===new URL(url).pathname).flatMap(s=>s.facts).join(' ')+'</article>',{headers:{'content-type':'text/html'}}),now);
 const row=env.sql.prepare('SELECT policy,context FROM marketing_agent_runs').get();assert.equal(row.policy,COMPACT_MARKETING_POLICY);assert.equal(c.planner_input.sha256,await digest(JSON.stringify(compactPlannerContext(c))));
 let seen;await planMarketing(env,r.id,async(e,model,prompt,input)=>{seen=input;assert.equal(model.model,'writer');assert.match(prompt,/Eligible facts appear once/);return {value:{...decision,source_id:c.candidates[0].id,ranked:[{source_id:c.candidates[0].id,reason:decision.ranked[0].reason}]}};},now);
 assert.deepEqual(seen,compactPlannerContext(c));assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);assert.equal(env.sql.prepare('SELECT context FROM marketing_agent_runs').get().context,row.context);
});
test('legacy run input and prompt are unchanged even after a new policy is deployed',async t=>{
 const {env,c,id}=await setup(t,'sourced-guides-and-browser-evidence-v5');let seen,promptSeen;
 await planMarketing(env,id,async(e,m,prompt,input)=>{seen=input;promptSeen=prompt;return {value:decision};},now);
 assert.deepEqual(seen,legacyPlannerContext(c));assert.doesNotMatch(promptSeen,/Eligible facts appear once/);assert.equal(env.sql.prepare('SELECT policy FROM marketing_agent_runs').get().policy,'sourced-guides-and-browser-evidence-v5');
});
test('changed/missing pinned evidence rejects before reservation; full original still reaches the different critic',async t=>{
 const {env,c,id}=await setup(t);let calls=0;const invalid=structuredClone(c);invalid.candidates[0].facts[1]='Changed condition';env.sql.prepare('UPDATE marketing_agent_runs SET context=?').run(JSON.stringify(invalid));await assert.rejects(planMarketing(env,id,async()=>{calls++;return {value:decision};},now),/input changed/);assert.equal(calls,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
 delete invalid.planner_input;env.sql.prepare('UPDATE marketing_agent_runs SET context=?').run(JSON.stringify(invalid));await assert.rejects(planMarketing(env,id,async()=>{calls++;},now),/input changed/);assert.equal(calls,0);
 env.sql.prepare('UPDATE marketing_agent_runs SET context=?').run(JSON.stringify(c));let modelSeen;
 const copy={segments:source.facts.map(text=>({text,quote:text,source_id:source.id}))};await critiqueMarketing(env,id,decision,copy,false,async(e,model,prompt,input)=>{modelSeen=model.model;assert.deepEqual(input.source.advert,source.advert);assert.deepEqual(input.copy,copy);return {value:{checks:copy.segments.map((_,index)=>({index,supported:false,reason:'Fictional review requires correction; not a semantic-quality verdict.'})),publishable:false,reason:'Fictional fixture retains the independent review requirement.'}};},now);assert.equal(modelSeen,'different-critic');
});
test('excluded sources cannot be selected; rejection stays charged and is not retried',async t=>{
 const {env,id}=await setup(t);let calls=0;const invalid={...decision,source_id:'ineligible',ranked:[{source_id:'ineligible',reason:'This source is not eligible in the captured attempt.'}]};
 for(let i=0;i<2;i++)await assert.rejects(planMarketing(env,id,async()=>{calls++;return {value:invalid};},now));assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);assert.equal(env.sql.prepare('SELECT state FROM marketing_agent_steps').get().state,'failed');
});
test('daily identity across policy versions and the original timeout/model ceilings remain unchanged',async t=>{
 const {env,id}=await setup(t,'sourced-guides-and-browser-evidence-v5');env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';env.MARKETING_WORKFLOW={create:async()=>assert.fail('No second daily run')};assert.equal((await dispatchMarketingAgents(env,now)).id,id);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
 assert.match(readFileSync(new URL('../worker/marketing-workflow.js',import.meta.url),'utf8'),/retries:\{limit:0,delay:'1 second'\},timeout:'2 minutes'/);
 assert.match(readFileSync(new URL('../worker/research-model.js',import.meta.url),'utf8'),/max_tokens: 8192, temperature: 0.1/);
});
