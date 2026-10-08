import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {dispatchBusiness,businessRunId,collectBusinessSnapshot,businessFindings,recordBusinessFindings,housekeeping,scheduleBusinessResearch,businessAPI,businessSnapshot} from '../worker/business-operations.js';
import {publicationGate,publishInsight,insightsResponse,INSIGHT_SLUG} from '../worker/insights.js';
import {adminAPI} from '../worker/admin.js';
import {sitemapResponse,canonicalPath} from '../worker/pages.js';
import {metricRoute} from '../worker/analytics.js';
const now=Date.now(),stamp=new Date(now).toISOString();
function snapshot(){return {measured_at:stamp,jobs:{total:20,employers:1,offered:2,conditional:3,unavailable:4,not_stated:11,early_career:6,salary:8},sources:[{id:'test',company:'Example employer',careers_url:'https://example.com/careers',last_success:stamp,error:null,paused:0,roles:20}],immigration:[{last_success:stamp}],register:{checked_at:stamp},metrics:[],held_batches:0,feedback_count:0,tracking_started:null,checks:['/api/health','/jobs','/insights','/sitemap.xml','/api/admin/session'].map(path=>({path,ok:true,security:true,status:path.endsWith('session')?403:200}))};}
const seedRun=(env,id='run-1')=>env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES(?,'running',?)").run(id,stamp);
function addJob(env,id,patch={}){const row={id,board_id:'test',company:'Example employer',title:'Engineer',location:'London',description:'Public advert',apply_url:'https://example.com/jobs/1',provider:'greenhouse',sponsorship:'not_stated',level:'experienced',first_seen:stamp,last_seen:stamp,active:1,...patch};const k=Object.keys(row);env.sql.prepare(`INSERT INTO jobs(${k.join(',')}) VALUES(${k.map(()=>'?').join(',')})`).run(...Object.values(row));}

test('hourly dispatch is idempotent and pause prevents new work',async t=>{
 const env=database(t);let calls=0;env.BUSINESS_WORKFLOW={create:async()=>{calls++;return{};}};
 const a=await dispatchBusiness(env,now),b=await dispatchBusiness(env,now+100);
 assert.equal(a.id,b.id);assert.equal(calls,1);assert.equal(a.id,businessRunId(now));
 env.sql.prepare('UPDATE business_controls SET enabled=0').run();assert.equal((await dispatchBusiness(env,now+3600000)).state,'paused');assert.equal(calls,1);
});
test('uncertain dispatch never forks a second run and terminal stale work is reconciled',async t=>{
 const env=database(t);let calls=0;env.BUSINESS_WORKFLOW={create:async()=>{calls++;throw Error('network');},get:async()=>{throw Error('unavailable');}};
 assert.equal((await dispatchBusiness(env,now)).state,'uncertain');await dispatchBusiness(env,now);assert.equal(calls,1);
 env.sql.prepare("UPDATE business_runs SET created_at='2000-01-01'").run();assert.equal((await dispatchBusiness(env,now+3600000)).state,'uncertain');assert.equal(calls,1);
 env.BUSINESS_WORKFLOW={create:async()=>{calls++;},get:async()=>({status:async()=>({status:'errored'})})};
 await dispatchBusiness(env,now+3600000);assert.equal(calls,2);assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM business_runs WHERE state='failed'").get().n,1);
});
test('publication blocks stale, incomplete, paused, failed and unreconciled evidence',()=>{
 assert.equal(publicationGate(snapshot(),now),null);
 for(const mutate of [s=>s.measured_at='bad',s=>s.measured_at=new Date(now-1800001).toISOString(),s=>s.checks[0].ok=false,s=>s.checks[4].security=false,s=>s.jobs.offered=40,s=>s.jobs.not_stated=0,s=>s.sources[0].roles=19,s=>s.sources[0].paused=1,s=>s.sources[0].last_success='bad',s=>s.sources[0].last_success=new Date(now-86400001).toISOString(),s=>s.sources[0].error='failed',s=>s.sources[0].careers_url='javascript:alert(1)',s=>s.held_batches=1]){const s=snapshot();mutate(s);assert.ok(publicationGate(s,now));}
});
test('report publication and two social drafts are atomic and replay-safe',async t=>{
 const env=database(t);seedRun(env);
 const r=await publishInsight(env,'run-1',snapshot(),now);assert.equal(r.state,'published');
 assert.equal((await publishInsight(env,'run-1',snapshot(),now)).replayed,true);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM insight_versions').get().n,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM social_outbox').get().n,2);
 assert.equal((await publishInsight(env,'run-2',snapshot(),now)).state,'not_due');
 const posts=env.sql.prepare('SELECT * FROM social_outbox').all();assert.ok(posts.every(x=>x.state==='needs_connection'&&x.destination===null&&x.receipt===null));assert.ok(posts.some(x=>x.audience==='personal'));
 const next={...snapshot(),measured_at:new Date(now+8*86400000).toISOString()};next.sources[0].last_success=next.measured_at;
 await publishInsight(env,'run-3',next,now+8*86400000);assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM social_outbox WHERE state='superseded'").get().n,2);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM insight_publications').get().n,1);
});
test('paused publication leaves no article, version or distribution draft',async t=>{
 const env=database(t);env.sql.prepare('UPDATE business_controls SET publishing=0').run();
 assert.equal((await publishInsight(env,'run',snapshot(),now)).state,'paused');
 for(const table of ['insight_publications','insight_versions','social_outbox'])assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
});
test('housekeeping retires only stale records, preserves customer data and does not repeat its receipt',async t=>{
 const env=database(t);seedRun(env);
 addJob(env,'a',{last_seen:new Date(now-4*86400000).toISOString()});addJob(env,'b');
 env.sql.prepare('INSERT INTO career_workspaces(user_id,data,updated_at) VALUES(?,?,?)').run('private-user','PRIVATE CV',stamp);
 const r=await housekeeping(env,'run-1',now);assert.equal(r.stale_roles,1);
 assert.equal(env.sql.prepare("SELECT active FROM jobs WHERE id='a'").get().active,0);assert.equal(env.sql.prepare("SELECT active FROM jobs WHERE id='b'").get().active,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,2);assert.equal(env.sql.prepare('SELECT data FROM career_workspaces').get().data,'PRIVATE CV');
 assert.deepEqual(await housekeeping(env,'run-1',now),r);
});
test('snapshot is aggregate-only, excludes current partial day and uses five fixed bounded HEAD requests',async t=>{
 const env=database(t);addJob(env,'a');
 env.sql.prepare('INSERT INTO career_workspaces(user_id,data,updated_at) VALUES(?,?,?)').run('secret-id','PRIVATE CV',stamp);
 env.sql.prepare('INSERT INTO analytics_daily VALUES(?,?,?,?)').run(stamp.slice(0,10),'page_view','/jobs',5);
 const calls=[];const s=await collectBusinessSnapshot(env,async(url,opts)=>{calls.push({url,opts});return new Response(null,{status:url.endsWith('/session')?403:200,headers:{'x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'none'"}});},now);
 assert.equal(s.jobs.total,1);assert.equal(s.metrics.length,0);assert.equal(calls.length,5);assert.ok(calls.every(x=>x.url.startsWith('https://sponsorintel.london/')&&x.opts.method==='HEAD'&&x.opts.redirect==='manual'&&x.opts.signal));
 assert.doesNotMatch(JSON.stringify(s),/PRIVATE CV|secret-id/);
});
test('issues reopen on recurrence and resolve only when evidence no longer supports them',async t=>{
 const env=database(t),s=snapshot();s.checks[0].ok=false;
 assert.ok(businessFindings(s,now).some(x=>x.severity==='critical'));
 await recordBusinessFindings(env,'run',s);assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='http:/api/health'").get().state,'open');
 await recordBusinessFindings(env,'run',snapshot());assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='http:/api/health'").get().state,'resolved');
 await recordBusinessFindings(env,'run',s);assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='http:/api/health'").get().state,'open');
});
test('reference failures become owner findings without presenting archived results as public job changes',()=>{
 const s=snapshot();s.reference={state:'needs_attention',dangerous_false_positives:2,unsupported_refusals:1};
 const findings=businessFindings(s,now);
 assert.ok(findings.some(x=>x.id==='reference-evaluation-held'&&x.severity==='high'));
 assert.ok(findings.some(x=>x.id==='reference-label-errors'&&/provisional archived/.test(x.detail)&&/Public labels were not changed/.test(x.next_action)));
 s.reference={state:'ready',dangerous_false_positives:0,unsupported_refusals:0};
 assert.ok(!businessFindings(s,now).some(x=>x.id.startsWith('reference-')));
});
test('invalid and future evidence timestamps cannot hide failed freshness checks',()=>{
 const targets=[
  {id:'register-freshness',age:36*3600000,set:(s,v)=>s.register.checked_at=v},
  {id:'source:test',age:24*3600000,set:(s,v)=>s.sources[0].last_success=v},
  {id:'immigration-freshness',age:3600000,set:(s,v)=>s.immigration[0].last_success=v},
 ];
 for(const target of targets){
  for(const value of [null,'','invalid timestamp',new Date(now+300001).toISOString(),new Date(now-target.age-1).toISOString()]){
   const s=snapshot();target.set(s,value);
   assert.ok(businessFindings(s,now).some(x=>x.id===target.id&&x.severity==='high'),target.id+': '+value);
  }
  for(const value of [stamp,new Date(now+300000).toISOString(),new Date(now-target.age).toISOString()]){
   const s=snapshot();target.set(s,value);
   assert.ok(!businessFindings(s,now).some(x=>x.id===target.id),target.id+': valid boundary');
  }
 }
 const empty=snapshot();empty.immigration=[];
 assert.match(businessFindings(empty,now).find(x=>x.id==='immigration-freshness').detail,/No immigration source checks/);
});
test('bad timestamps open and resolve a real monitoring issue without changing evidence',async t=>{
 const env=database(t),s=snapshot();s.immigration[0].last_success='invalid timestamp';
 await recordBusinessFindings(env,'run',s);
 assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='immigration-freshness'").get().state,'open');
 assert.equal(s.immigration[0].last_success,'invalid timestamp');
 await recordBusinessFindings(env,'run',snapshot());
 assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='immigration-freshness'").get().state,'resolved');
});
test('daily research respects the existing allowance and never re-dispatches on workflow replay',async t=>{
 const env=database(t);let calls=0;env.RESEARCH_WORKFLOW={create:async()=>{calls++;}};env.AI_MODEL='one';env.AI_REVIEW_MODEL='two';
 const r=await scheduleBusinessResearch(env,now);assert.equal(r.state,'started');await scheduleBusinessResearch(env,now);assert.equal(calls,1);
 env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();env.sql.prepare('UPDATE agent_research_budget SET runs=4').run();
 assert.equal((await scheduleBusinessResearch(env,now+86400000)).state,'held');assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT runs FROM agent_research_budget').get().runs,4);
});
test('public report escapes source text, has factual structured data and is removed from search after withdrawal',async t=>{
 const env=database(t),s=snapshot();s.sources[0].company='<script>alert(1)</script>';
 await publishInsight(env,'run',s,now);
 const req=new Request('https://sponsorintel.london/insights/'+INSIGHT_SLUG);
 let response=await insightsResponse(req,env),html=await response.text();
 assert.equal(response.status,200);assert.match(html,/application\/ld\+json/);assert.match(html,/"dateModified"/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);assert.match(html,/not a legal review/);
 assert.match(await(await sitemapResponse(env,now)).text(),new RegExp('/insights/'+INSIGHT_SLUG));
 env.sql.prepare("UPDATE insight_publications SET state='withdrawn'").run();response=await insightsResponse(req,env);assert.equal(response.status,410);assert.match(response.headers.get('x-robots-tag'),/noindex/);
 assert.doesNotMatch(await(await sitemapResponse(env,now)).text(),new RegExp('/insights/'+INSIGHT_SLUG));
 assert.equal(canonicalPath('/insights/'+INSIGHT_SLUG+'/'),'/insights/'+INSIGHT_SLUG);
 assert.equal(metricRoute('/insights/'+INSIGHT_SLUG+'?private=secret'),'/insights/'+INSIGHT_SLUG);
});
test('owner-only APIs deny anonymous access, cross-origin mutations and unknown control fields',async t=>{
 const env=database(t);env.APP_ORIGIN='https://sponsorintel.london';
 assert.equal((await adminAPI(new Request('https://sponsorintel.london/api/admin/business'),env)).status,403);
 const make=(origin,body)=>new Request('https://sponsorintel.london/api/admin/business/settings',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const owner={user:{id:'owner'}};
 assert.equal((await businessAPI(make('https://evil.example',{setting:'enabled',value:false}),env,owner)).status,403);
 assert.equal((await businessAPI(make('https://sponsorintel.london',{setting:'DROP TABLE jobs',value:false}),env,owner)).status,400);
 assert.equal((await businessAPI(make('https://sponsorintel.london',{setting:'enabled',value:false}),env,owner)).status,200);
 assert.equal((await businessSnapshot(env)).settings.enabled,0);
});
