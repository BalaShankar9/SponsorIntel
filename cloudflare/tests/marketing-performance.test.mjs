import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {validatePerformance,recordPerformance,performanceSnapshot,performanceContext,marketingPerformanceAPI} from '../worker/marketing-performance.js';
import {adminAPI} from '../worker/admin.js';
import {EDITORIAL_SOURCES,dispatchMarketingAgents,captureMarketingContext,planMarketing} from '../worker/marketing-agents.js';
const now=Date.parse('2026-10-11T14:00:00Z'),DAY=86400000,iso=n=>new Date(n).toISOString();
export const observation=(patch={})=>({request_key:crypto.randomUUID(),destination:'linkedin-company',account:'146710167',provider:'linkedin-native',identity_checked:true,title:'Fictional post',post_url:'https://www.linkedin.com/feed/update/urn:li:share:123456/',observed_at:iso(now),window_type:'lifetime',window_start:null,window_end:iso(now),timezone:'Europe/London',published_at:null,availability:'reported',assessment_type:'agent_assisted',metrics:{impressions:102,clicks:2,link_clicks:null},evidence_url:'https://www.linkedin.com/company/146710167/admin/page-posts/published/',note:'Fictional native observation. Clicks are not necessarily website visits.',...patch});

test('reported zero stays zero, missing stays unknown and plain links acquire no retrospective campaign',()=>{
 const v=validatePerformance(observation({metrics:{impressions:0}}),now);assert.equal(v.metrics.impressions,0);assert.equal(v.metrics.reach,null);assert.equal(v.campaign_id,null);assert.equal(v.published_at,null);
 assert.equal(validatePerformance(observation({post_url:'https://linkedin.com/feed/update/urn:li:share:123456'}),now).post_url,v.post_url);
 assert.equal(validatePerformance(observation({availability:'unavailable',metrics:{}}),now).metrics.impressions,null);
});
test('invalid identity, unsupported metrics, future or impossible dates and sensitive URL components fail',()=>{
 for(const patch of [{account:'personal'},{provider:'metricool'},{identity_checked:false},{destination:'other'},{destination:'__proto__',account:undefined,provider:undefined},{destination:'constructor',account:undefined,provider:undefined},
  {metrics:{impressions:-1}},{metrics:{reach:1.2}},{metrics:{impressions:'0'}},{metrics:{followers:5}},{metrics:{}},
  {availability:'unavailable',metrics:{impressions:0}},{assessment_type:'independent-human'},
  {observed_at:iso(now+3600000)},{window_end:iso(now+1)},{window_type:'period',window_start:iso(now)},{window_type:'lifetime',window_start:iso(now-DAY)},
  {observed_at:'2026-02-31T00:00:00Z'},{timezone:'not/a/timezone'},{published_at:iso(now+1)},
  {post_url:'https://www.linkedin.com/feed/update/urn:li:share:123456/?token=secret'},
  {post_url:'https://user:secret@www.linkedin.com/feed/update/urn:li:share:123456/'},
  {post_url:'https://evil.example/feed/update/urn:li:share:123456/'},{evidence_url:'https://app.metricool.com/planner'},
  {evidence_url:'https://www.linkedin.com/analytics/?token=private'}])assert.throws(()=>validatePerformance(observation(patch),now),JSON.stringify(patch));
});
test('campaign evidence requires recognised exact tagging and the correct destination',()=>{
 const url='https://sponsorintel.london/jobs?utm_source=linkedin&utm_medium=organic_social&utm_campaign=social_launch&utm_content=company_welcome';
 assert.equal(validatePerformance(observation({campaign_url:url}),now).campaign_id,'li-welcome');
 for(const campaign_url of [url.replace('linkedin','facebook'),url.replace('company_welcome','founder_intro'),url.replace('sponsorintel.london','other.example'),url+'&utm_source=linkedin',url+'&email=private'])assert.throws(()=>validatePerformance(observation({campaign_url}),now));
});
test('observations and audit are atomic, immutable and idempotent under replay or conflict',async t=>{
 const env=database(t),input=observation(),a=await recordPerformance(env,input,'owner',now);
 assert.equal((await recordPerformance(env,input,'owner',now+1000)).id,a.id);
 await assert.rejects(recordPerformance(env,{...input,metrics:{impressions:200}},'owner',now),{status:409});
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_performance').get().n,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
 assert.throws(()=>env.sql.exec("UPDATE marketing_performance SET actor='other'"),/append only/);
 assert.throws(()=>env.sql.exec('DELETE FROM marketing_performance'),/append only/);
 env.sql.exec("CREATE TRIGGER fail_performance_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'fictional failure'); END");
 await assert.rejects(recordPerformance(env,observation({post_url:'https://www.linkedin.com/feed/update/urn:li:share:999/'}),'owner',now));assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_performance').get().n,1);
});
test('a second key cannot duplicate or silently conflict with the same observed post window',async t=>{
 const env=database(t);await recordPerformance(env,observation(),'owner',now);
 for(const patch of [{},{metrics:{impressions:999}}])await assert.rejects(recordPerformance(env,observation(patch),'owner',now),{status:409});
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_performance').get().n,1);
});
test('corrections retain history and only one concurrent replacement can win',async t=>{
 const env=database(t),a=await recordPerformance(env,observation(),'owner',now);
 const results=await Promise.allSettled([2,3].map(n=>recordPerformance(env,observation({supersedes:a.id,metrics:{impressions:n}}),'owner',now)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const s=await performanceSnapshot(env,now);assert.equal(s.items.length,2);assert.equal(s.items.filter(p=>p.corrected).length,1);
 assert.equal((await performanceContext(env,now)).items.length,1);
 await assert.rejects(recordPerformance(env,observation({supersedes:a.id,post_url:'https://www.linkedin.com/feed/update/urn:li:share:999/'}),'owner',now),{status:409});
});
test('planner keeps reporting windows separate, takes the newest cumulative reading and excludes stale data and private notes',async t=>{
 const env=database(t);
 await recordPerformance(env,observation({observed_at:iso(now-1000),window_end:iso(now-1000),metrics:{impressions:10}}),'PRIVATE_OWNER',now);
 await recordPerformance(env,observation({note:'PRIVATE_NOTE must never be included in the model context.',metrics:{impressions:11}}),'PRIVATE_OWNER',now);
 await recordPerformance(env,observation({window_type:'period',window_start:iso(now-2*DAY),window_end:iso(now-DAY),metrics:{impressions:3}}),'owner',now);
 await recordPerformance(env,observation({post_url:'https://www.linkedin.com/feed/update/urn:li:share:777/',observed_at:iso(now-8*DAY),window_end:iso(now-8*DAY)}),'owner',now);
 await recordPerformance(env,observation({post_url:'https://www.linkedin.com/feed/update/urn:li:share:888/',window_type:'period',window_start:iso(now-10*DAY),window_end:iso(now-9*DAY)}),'owner',now);
 const c=await performanceContext(env,now);assert.equal(c.items.length,2);assert.equal(c.items.find(x=>x.window_type==='lifetime').metrics.impressions,11);assert.equal(c.items.find(x=>x.window_type==='period').metrics.impressions,3);assert.doesNotMatch(JSON.stringify(c),/PRIVATE_|request_key|evidence_url/);assert.equal(c.items[0].published_at,null);
});
test('unavailable figures supersede an older cumulative snapshot without becoming zero',async t=>{
 const env=database(t);await recordPerformance(env,observation({observed_at:iso(now-1000),window_end:iso(now-1000)}),'owner',now);
 await recordPerformance(env,observation({availability:'unavailable',metrics:{}}),'owner',now);
 const c=await performanceContext(env,now);assert.equal(c.items.length,1);assert.equal(c.items[0].availability,'unavailable');assert.ok(Object.values(c.items[0].metrics).every(v=>v===null));
});
test('new agent contexts retain observations but replay preserves the original decision evidence',async t=>{
 const env=database(t);env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';env.MARKETING_WORKFLOW={create:async()=>({})};
 const p=await recordPerformance(env,observation(),'owner',now);
 const run=await dispatchMarketingAgents(env,now);
 const fetcher=async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>s.path===new URL(url).pathname).flatMap(s=>s.facts).join(' ')+'</article>',{headers:{'Content-Type':'text/html'}});
 const context=await captureMarketingContext(env,run.id,fetcher,now);assert.equal(context.performance.items[0].id,p.id);
 await recordPerformance(env,observation({supersedes:p.id,metrics:{impressions:200}}),'owner',now);
 assert.deepEqual(await captureMarketingContext(env,run.id,fetcher,now),context);
 let calls=0;const caller=async(_env,_model,prompt,input)=>{calls++;assert.match(prompt,/do not sum reach/i);assert.equal(input.performance.items[0].metrics.impressions,102);return {value:{decision:'no_post',source_id:'',reason:'The fictional sparse observations do not establish useful acquisition.',ranked:[],timing_reason:'Keep the existing limit and wait for sufficient evidence.'}};};
 await planMarketing(env,run.id,caller,now);assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);
});
test('owner routing and same-origin writes protect observations and reads do not mutate records',async t=>{
 const env=database(t),url='https://sponsorintel.london/api/admin/marketing/performance';
 assert.equal((await adminAPI(new Request(url),env)).status,403);
 assert.equal((await marketingPerformanceAPI(new Request(url,{method:'POST',headers:{Origin:'https://evil.example'}}),env,{user:{id:'owner'}})).status,403);
 await recordPerformance(env,observation(),'owner',now);
 const result=await(await marketingPerformanceAPI(new Request(url),env,{user:{id:'owner'}})).json();assert.equal(result.items.length,1);assert.equal(result.items[0].actor,undefined);assert.equal(result.items[0].request_key,undefined);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_performance').get().n,1);
});
