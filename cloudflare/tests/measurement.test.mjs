import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './research-db.mjs';
import { analyticsAPI, preparationReply, guidanceReply, publicMeasurement, recordResponseMetrics, responseMetric } from '../worker/analytics.js';
import { collectBusinessSnapshot, businessFindings } from '../worker/business-operations.js';
import { dispatchMarketingAgents, captureMarketingContext, EDITORIAL_SOURCES } from '../worker/marketing-agents.js';
const origin='https://sponsorintel.london';
const request=(path,headers={})=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-SI-Campaign':'fb-applications',...headers},body:JSON.stringify({page:'/jobs?cv=PRIVATE_CV',campaign:'fb-applications',userId:'forged-owner',event:'document_prepared'})});
const boundary=(env)=>env.sql.prepare("UPDATE metadata SET value=? WHERE key='analytics_v2'").run(JSON.stringify({version:2,enabled_at:'2026-10-08T12:00:00.000Z'}));
const count=env=>env.sql.prepare('SELECT COUNT(*) n FROM analytics_public_daily').get().n;

test('clarifications and insufficient-evidence responses are not counted as sourced answers',async t=>{
 const env=database(t);
 for(const status of ['answered','clarify','insufficient']) {
  const response=guidanceReply({status,message:'PRIVATE_QUESTION',blocks:[]});
  response.clone=()=>{throw Error('Guidance content must not be read by metrics');};
  await recordResponseMetrics(env,request('/api/chat'),response);
 }
 assert.equal(env.sql.prepare("SELECT count FROM analytics_public_daily WHERE event='guidance_answer'").get().count,1);
 assert.equal(env.sql.prepare("SELECT count FROM analytics_public_daily WHERE event='guidance_followup'").get().count,2);
 assert.equal(responseMetric('/api/chat','POST',200),null);
 assert.doesNotMatch(JSON.stringify(env.sql.prepare('SELECT * FROM analytics_public_daily').all()),/PRIVATE/);
});

test('CVs and cover letters are distinct from analysis, research and preparation; no private result is read',async t=>{
 const env=database(t);
 for(const kind of ['cv','coverLetter','analysis','companyResearch','interview','portfolio','learningPlan']) {
  const response=preparationReply({kind,text:'PRIVATE_DOCUMENT'});
  response.clone=()=>{throw Error('Private document must not be read by metrics');};
  await recordResponseMetrics(env,request('/api/career/generate'),response);
  assert.equal(responseMetric('/api/career/generate','POST',200,kind),['cv','coverLetter'].includes(kind)?'document_prepared':'preparation_completed');
 }
 const rows=env.sql.prepare('SELECT * FROM analytics_public_daily').all();
 assert.equal(rows.find(r=>r.event==='document_prepared').count,2);
 assert.equal(rows.find(r=>r.event==='preparation_completed').count,5);
 assert.equal(rows.find(r=>r.event==='campaign_document_prepared').count,2);
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|forged|application_generated/);
 for(const status of [202,204,400,429,500])assert.equal(responseMetric('/api/career/generate','POST',status,'cv'),null);
 assert.equal(responseMetric('/api/career/generate','POST',200),null);
 assert.equal(responseMetric('/api/career/generate','POST',200,'private-value'),null);
});

test('declared QA skips page and action counts without weakening access controls or changing responses',async t=>{
 const env=database(t);
 for(const headers of [{'X-SI-Metrics':'exclude'},{'User-Agent':'SponsorIntel-QA/2.37'},{'User-Agent':'SponsorIntel-Operations/1.0'}]) {
  assert.equal((await analyticsAPI(request('/api/metrics',headers),env)).status,200);
  await recordResponseMetrics(env,request('/api/career/generate',headers),preparationReply({kind:'cv'}));
 }
 assert.equal(count(env),0);
 await analyticsAPI(request('/api/metrics'),env);
 assert.equal(env.sql.prepare("SELECT count FROM analytics_public_daily WHERE event='page_view'").get().count,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_daily').get().n,0);
});

test('fresh owner sign-in is excluded even before its session cookie exists; claimed request identities are ignored',async t=>{
 const env=database(t);
 env.sql.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run('owner-id','Fictional owner','owner@example.invalid',1,Date.now(),Date.now());
 env.sql.prepare('INSERT INTO admin_members VALUES(?,?)').run('owner-id',new Date().toISOString());
 for(const path of ['/api/auth/sign-in/email','/api/auth/sign-up/email'])await recordResponseMetrics(env,request(path),Response.json({user:{id:'owner-id',email:'PRIVATE_OWNER'}}));
 assert.equal(count(env),0);
 await recordResponseMetrics(env,request('/api/auth/sign-in/email'),Response.json({user:{id:'member-id',email:'PRIVATE_MEMBER'}}));
 assert.equal(env.sql.prepare("SELECT count FROM analytics_public_daily WHERE event='sign_in'").get().count,1);
 for(const value of [{error:'failed'},{user:{}},{redirect:true}])await recordResponseMetrics(env,request('/api/auth/sign-up/email'),Response.json(value));
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM analytics_public_daily WHERE event='account_created'").get().n,0);
 assert.doesNotMatch(JSON.stringify(env.sql.prepare('SELECT * FROM analytics_public_daily').all()),/PRIVATE|owner-id|member-id/);
 await assert.rejects(recordResponseMetrics(env,request('/api/auth/sign-in/email'),Response.json({user:{id:'member-id'},extra:'x'.repeat(32768)})));
});

test('uncertain owner lookup fails closed and a campaign write failure cannot leave half a count',async t=>{
 const env=database(t),DB=env.DB;
 env.DB={...DB,prepare(sql){if(sql.startsWith('SELECT user_id'))throw Error('Lookup unavailable');return DB.prepare(sql);}};
 await assert.rejects(recordResponseMetrics(env,request('/api/auth/sign-in/email'),Response.json({user:{id:'owner-id'}})),/Lookup unavailable/);
 assert.equal(count(env),0);env.DB=DB;
 env.sql.exec("CREATE TRIGGER reject_campaign BEFORE INSERT ON analytics_public_daily WHEN NEW.event LIKE 'campaign_%' BEGIN SELECT RAISE(ABORT,'write unavailable'); END;");
 await assert.rejects(analyticsAPI(request('/api/metrics'),env),/write unavailable/);
 assert.equal(count(env),0);
});

test('business growth uses complete new-baseline days, never legacy or a partial day',async t=>{
 const env=database(t);boundary(env);
 env.sql.prepare('INSERT INTO analytics_daily VALUES(?,?,?,?)').run('2026-10-09','application_generated','',999);
 for(const [day,n] of [['2026-10-08',800],['2026-10-09',2],['2026-10-10',700]])env.sql.prepare('INSERT INTO analytics_public_daily VALUES(?,?,?,?)').run(day,'document_prepared','',n);
 const now=Date.parse('2026-10-10T12:00:00Z');
 const s=await collectBusinessSnapshot(env,async()=>new Response(null,{status:200}),now);
 assert.equal(s.measurement.completed_days,1);assert.equal(s.metrics.length,1);assert.equal(s.metrics[0].count,2);assert.equal(s.metrics[0].day,'2026-10-09');
 assert.ok(!businessFindings(s,now).some(x=>x.id==='activation'));
 s.metrics=[];assert.match(businessFindings(s,now).find(x=>x.id==='activation').detail,/1 completed UTC days/);
 s.measurement.completed_days=0;assert.ok(businessFindings(s,now).some(x=>x.id==='growth-baseline'));assert.ok(!businessFindings(s,now).some(x=>x.id==='activation'));
 for(const time of ['2026-10-08T13:00:00Z','2026-10-09T12:00:00Z'])assert.equal((await publicMeasurement(env,Date.parse(time))).completed_days,0);
 assert.equal((await publicMeasurement(env,Date.parse('2026-11-01T12:00:00Z'))).completed_days,14);
 env.sql.prepare("DELETE FROM metadata WHERE key='analytics_v2'").run();assert.equal((await publicMeasurement(env,now)).completed_days,0);
});

test('marketing receives the filtered boundary and cannot learn from mixed or partial counts',async t=>{
 const env=database(t);boundary(env);env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';env.MARKETING_WORKFLOW={create:async()=>({})};
 for(const [table,day,n] of [['analytics_daily','2026-10-09',999],['analytics_public_daily','2026-10-08',800],['analytics_public_daily','2026-10-09',2],['analytics_public_daily','2026-10-10',700]])env.sql.prepare(`INSERT INTO ${table} VALUES(?,?,?,?)`).run(day,'campaign_page_view','fb-applications',n);
 const now=Date.parse('2026-10-10T12:00:00Z'),run=await dispatchMarketingAgents(env,now);
 const context=await captureMarketingContext(env,run.id,async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>s.path===new URL(url).pathname).flatMap(s=>s.facts).map(f=>'<p>'+f+'</p>').join('')+'</article>',{headers:{'Content-Type':'text/html'}}),now);
 assert.equal(context.metrics.length,1);assert.equal(context.metrics[0].count,2);assert.equal(context.measurement.completed_days,1);
 assert.match(context.measurement_limit,/Empty data is not proof/);assert.equal(env.sql.prepare('SELECT calls FROM marketing_agent_runs').get().calls,0);
});
