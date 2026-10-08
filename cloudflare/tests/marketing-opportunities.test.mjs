import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {opportunityFixture} from './opportunity-fixture.mjs';
import {readOpportunitySource,publicOpportunitySource,captureOpportunitySources,requireOpportunity,opportunityBriefHealth,opportunityFindings} from '../worker/marketing-opportunities.js';
import {createBrief,decideBrief,reconcileOpportunities,marketingSnapshot} from '../worker/marketing.js';
import {EDITORIAL_SOURCES,dispatchMarketingAgents,captureMarketingContext,planMarketing,writeMarketing,storeMarketingDraft,critiqueMarketing,concludeMarketing,validateCopy} from '../worker/marketing-agents.js';
const now=Date.parse('2026-10-09T01:00:00Z'),hour=3600000,iso=time=>new Date(time).toISOString();
function seeded(t){const env=database(t);env.AI_MODEL='fictional-writer';env.AI_REVIEW_MODEL='fictional-reviewer';env.MARKETING_WORKFLOW={create:async()=>({})};const fixture=opportunityFixture(now);for(const [sql,...args] of fixture.statements)env.sql.prepare(sql).run(...args);return {env,fixture};}
const guideFetch=async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>s.path===new URL(url).pathname).flatMap(s=>s.facts).map(f=>'<p>'+f+'</p>').join('')+'</article>',{headers:{'content-type':'text/html'}});
function content(source){return {topic_key:source.topic_key,destination:'facebook-company',title:source.title,purpose:'Help readers inspect this dated fictional vacancy and its original evidence.',text:source.facts.join('\n\n')+'\n\nRead the dated vacancy: '+source.url,sources:[{title:source.title,url:source.url,excerpt:source.facts.join(' ').slice(0,1600),checked_at:source.checked_at}],expires_at:source.expires_at,opportunity:source.opportunity};}
const decision=(id,revision,kind,extra={})=>({id,revision,kind,note:'Independent fictional test review or delivery observation only.',request_key:kind+':'+id+':'+revision,...extra});
const checks={claims:true,sources:true,destination:true,duplication:true};
const receipt=()=>({account:'1319703417896763',provider:'metricool',external_id:'fictional-schedule',observed_at:iso(now),scheduled_at:iso(now+8*hour),evidence:'Fictional provider response in an isolated test only.'});
async function reviewed(env,source){const brief=await createBrief(env,content(source),'template',now);await decideBrief(env,decision(brief.id,1,'reviewed',{checks}),'independent-fixture-reviewer',now);return brief;}

test('vacancy evidence includes the exact conditional quote, current reviewed identity and complete retained advert',async t=>{
 const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now);assert.equal(source.kind,'opportunity');assert.ok(source.required_segments[1].includes(fixture.quote));assert.equal(source.advert.sponsorship,'conditional');assert.match(source.advert.description,/Applicants must meet/);assert.ok(source.required_segments.at(-1).includes('does not guarantee'));
 assert.ok(!('guard' in publicOpportunitySource(source)));assert.equal((await captureOpportunitySources(env,now)).sources.length,1);assert.equal((await requireOpportunity(env,source.opportunity,now)).content_hash,source.content_hash);
});
test('missing, stale, closed, inconsistent and paused evidence cannot become a promotion candidate',async t=>{
 const mutations=[
  "UPDATE jobs SET sponsorship='not_stated'", "UPDATE jobs SET evidence='Invented sponsorship wording'", "UPDATE jobs SET active=0",
  "UPDATE jobs SET last_seen='invalid'", "UPDATE jobs SET closes_at='2026-10-09T00:59:59.000Z'", "UPDATE jobs SET last_seen='2026-10-07T01:00:00.000Z'",
  "UPDATE jobs SET apply_url='https://evil.invalid/role'", "UPDATE jobs SET description=description||' We cannot offer visa sponsorship.'",
  "UPDATE job_sources SET error='temporarily failed'", "UPDATE sponsors SET skilled=0", "UPDATE metadata SET value='{}' WHERE key='register'",
  "UPDATE job_link_checks SET state='uncertain'", "UPDATE job_link_checks SET finished_at='2026-10-07T01:00:00.000Z'", "UPDATE job_link_checks SET title='Different role'",
  "UPDATE business_controls SET enabled=0", "UPDATE marketing_agent_controls SET enabled=0",
  "INSERT INTO agent_source_controls(source_id,paused,updated_at) VALUES('monzo',1,'2026-10-09T01:00:00.000Z')",
 ];
 for(const sql of mutations){const {env,fixture}=seeded(t);env.sql.exec(sql);await assert.rejects(readOpportunitySource(env,fixture.id,now),{status:409},sql);}
});
test('a short job expiry excludes only that candidate and cannot suppress durable guides',async t=>{
 const {env}=seeded(t);env.sql.prepare('UPDATE jobs SET closes_at=?').run(iso(now+3*hour));const run=await dispatchMarketingAgents(env,now),context=await captureMarketingContext(env,run.id,guideFetch,now);
 assert.equal(context.sources.filter(s=>s.kind==='opportunity').length,1);assert.equal(context.candidates.filter(s=>s.kind==='opportunity').length,0);assert.ok(context.candidates.some(s=>s.id==='shortlist'));
});
test('the job path uses a planner and independent critic, preserves all fixed facts, and makes no rewriting model call',async t=>{
 const {env,fixture}=seeded(t);const run=await dispatchMarketingAgents(env,now),context=await captureMarketingContext(env,run.id,guideFetch,now),source=context.candidates.find(s=>s.kind==='opportunity');assert.ok(source);
 let calls=0;const plan=await planMarketing(env,run.id,async(_env,_model,_prompt,input)=>{calls++;assert.doesNotMatch(JSON.stringify(input),/"description"|"guard"/);return {value:{decision:'draft',source_id:source.id,reason:'A dated vacancy with explicit conditional wording is useful for readers to inspect.',ranked:[{source_id:source.id,reason:'Original employer wording and recent page evidence are available.'}],timing_reason:'The proposed slot falls before the retained evidence expires.'}};},now);
 const copy=await writeMarketing(env,run.id,plan,null,async()=>{throw Error('Vacancy facts must not be rewritten by a model');},now);
 assert.equal(copy.segments.length,4);assert.equal(copy.segments[0].text,source.facts[0]);assert.ok(copy.segments[1].text.includes(fixture.quote));assert.throws(()=>validateCopy({segments:copy.segments.slice(0,3)},source));
 await storeMarketingDraft(env,run.id,plan,copy,false,now);
 const review=await critiqueMarketing(env,run.id,plan,copy,false,async(_env,model,_prompt,input)=>{calls++;assert.equal(model.model,'fictional-reviewer');assert.match(input.source.advert.description,/Applicants must meet/);return {value:{checks:copy.segments.map((_,index)=>({index,supported:true,reason:'Fictional review confirms this paragraph against the fixture evidence.'})),publishable:true,reason:'All four fixture paragraphs retain their limits and supporting evidence.'}};},now);
 const result=await concludeMarketing(env,run.id,plan,copy,review,guideFetch,now);assert.equal(result.state,'reviewed');assert.equal(calls,2);assert.equal(env.sql.prepare('SELECT calls FROM marketing_agent_runs').get().calls,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_opportunity_versions').get().n,1);
 assert.equal((await captureOpportunitySources(env,now)).sources.length,0);
});
test('fact edits, missing pinned evidence and another destination cannot enter the opportunity ledger',async t=>{
 for(const mutate of [x=>delete x.opportunity,x=>x.destination='linkedin-company',x=>x.text=x.text.replace('subject to eligibility','for everyone'),x=>x.expires_at=iso(now+2*86400000),x=>x.sources[0].url='https://sponsorintel.london/jobs']){
  const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now),input=content(source);mutate(input);await assert.rejects(createBrief(env,input,'template',now));assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_briefs').get().n,0);
 }
});
test('a changed advert cannot pass review or scheduling; a new immutable version is required',async t=>{
 for(const phase of ['review','schedule']){
  const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now);const brief=phase==='schedule'?await reviewed(env,source):await createBrief(env,content(source),'template',now);
  env.sql.prepare("UPDATE jobs SET description=description||' Additional requirements now apply.'").run();
  await assert.rejects(decideBrief(env,decision(brief.id,phase==='review'?1:2,phase==='review'?'reviewed':'scheduled',phase==='review'?{checks}:{receipt:receipt()}),'independent-fixture-reviewer',now),{status:409});
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);assert.equal(env.sql.prepare('SELECT version FROM marketing_briefs').get().version,1);
 }
});
test('the ledger write transaction rejects a feed change or pause after validation',async t=>{
 for(const mutate of [env=>env.sql.prepare("UPDATE jobs SET description=description||' Changed during commit.'").run(),env=>env.sql.prepare('UPDATE business_controls SET enabled=0').run()]){
  const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now),brief=await createBrief(env,content(source),'template',now),batch=env.DB.batch;
  env.DB.batch=async statements=>{mutate(env);return batch(statements);};
  await assert.rejects(decideBrief(env,decision(brief.id,1,'reviewed',{checks}),'independent-fixture-reviewer',now),{status:409});assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'proposed');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n,1);
 }
});
test('changed drafts are automatically held once, preserving their copy and evidence history',async t=>{
 const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now),brief=await reviewed(env,source),before=env.sql.prepare('SELECT * FROM marketing_versions').get();env.sql.prepare('UPDATE jobs SET active=0').run();
 const result=await reconcileOpportunities(env,now);assert.deepEqual(result.held,[brief.id]);assert.equal(result.external_actions,0);assert.deepEqual(env.sql.prepare('SELECT * FROM marketing_versions').get(),before);assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'held');assert.equal((await reconcileOpportunities(env,now)).held.length,0);
});
test('a bad externally scheduled vacancy creates an actionable finding but never fabricates cancellation',async t=>{
 const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now),brief=await reviewed(env,source);await decideBrief(env,decision(brief.id,2,'scheduled',{receipt:receipt()}),'publisher',now);env.sql.prepare('UPDATE jobs SET active=0').run();
 const health=await opportunityBriefHealth(env,now);assert.equal(health.external_attention,1);assert.equal(opportunityFindings(health)[0].severity,'high');assert.equal((await reconcileOpportunities(env,now)).held.length,0);assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'scheduled');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,1);assert.match((await marketingSnapshot(env,now)).items[0].attention,/provider/);
});
test('revising refreshed job evidence preserves both versions and revokes the earlier review',async t=>{
 const {env,fixture}=seeded(t),source=await readOpportunitySource(env,fixture.id,now),brief=await reviewed(env,source);env.sql.prepare("UPDATE jobs SET description=description||' New factual requirement.'").run();const current=await readOpportunitySource(env,fixture.id,now);
 await decideBrief(env,decision(brief.id,2,'revise',{content:content(current)}),'editor',now);assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'proposed');const rows=env.sql.prepare('SELECT version,fingerprint FROM marketing_opportunity_versions ORDER BY version').all();assert.equal(rows.length,2);assert.notEqual(rows[0].fingerprint,rows[1].fingerprint);
});
