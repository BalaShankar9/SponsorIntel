import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {database} from './research-db.mjs';
import {analyticsAPI,publicMeasurement} from '../worker/analytics.js';
import {browserEvidenceMeasurement} from '../worker/browser-measurement.js';
import {captureMarketingContext,dispatchMarketingAgents,EDITORIAL_SOURCES,MARKETING_POLICY,PLANNER_PROMPT} from '../worker/marketing-agents.js';
const origin='https://sponsorintel.london';
const request=(body,headers={})=>new Request(origin+'/api/metrics',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const boundary=(env,time='2026-10-11T18:00:00.000Z')=>env.sql.prepare("UPDATE metadata SET value=? WHERE key='analytics_browser_evidence_v1'").run(JSON.stringify({version:1,enabled_at:time}));
const action={page:'/studio',action:'local_evidence_check',campaign:'fb-applications'};

test('browser reports have a finite action, no private dimensions and no server/page counter side effects',async t=>{
 const env=database(t);boundary(env,new Date(Date.now()-60000).toISOString());
 const response=await analyticsAPI(request({...action,page:'/studio?cv=PRIVATE',cv:'PRIVATE_CV',user_id:'forged-owner',job:'PRIVATE_JOB'}),env);assert.equal(response.status,200);
 const rows=env.sql.prepare('SELECT * FROM analytics_evidence_daily').all();assert.equal(rows.length,2);assert.equal(rows.find(r=>r.dimension==='').count,1);assert.equal(rows.find(r=>r.dimension==='fb-applications').count,1);
 assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|forged/);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_public_daily').get().n,0);
 for(const body of [{...action,page:'/jobs'},{...action,page:'/admin'},{...action,action:'document_prepared'},{...action,action:null}])assert.equal((await analyticsAPI(request(body),env)).status,400);
 assert.equal((await analyticsAPI(request(action,{Origin:'https://other.example'}),env)).status,403);
 for(const headers of [{'X-SI-Metrics':'exclude'},{'User-Agent':'SponsorIntel-QA/2.60'},{'User-Agent':'SponsorIntel-Operations/1.0'}])assert.equal((await analyticsAPI(request(action,headers),env)).status,200);
 assert.equal(env.sql.prepare("SELECT count FROM analytics_evidence_daily WHERE dimension='' ").get().count,1);
 assert.equal((await analyticsAPI(request({...action,campaign:'PRIVATE_EMAIL'}),env)).status,200);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_evidence_daily').get().n,2);
});

test('browser reports retain the existing shared rate ceiling and atomic campaign writes',async t=>{
 const env=database(t);boundary(env,new Date(Date.now()-60000).toISOString());
 env.sql.exec("CREATE TRIGGER reject_evidence_campaign BEFORE INSERT ON analytics_evidence_daily WHEN NEW.dimension<>'' BEGIN SELECT RAISE(ABORT,'write unavailable'); END;");
 await assert.rejects(analyticsAPI(request(action),env),/write unavailable/);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_evidence_daily').get().n,0);
 env.sql.exec('DROP TRIGGER reject_evidence_campaign');
 // The failed reservation remains consumed; pages and local actions share it.
 for(let i=0;i<119;i++)assert.equal((await analyticsAPI(request(i%2?action:{page:'/studio'}),env)).status,200);
 assert.equal((await analyticsAPI(request(action),env)).status,429);
 assert.equal((await analyticsAPI(request({page:'/studio'}),env)).status,429);
});

test('local measurement starts separately, excludes partial days and retains unknown until a full day exists',async t=>{
 const env=database(t);boundary(env);
 for(const [day,count] of [['2026-10-10',900],['2026-10-11',800],['2026-10-12',3],['2026-10-13',700]])env.sql.prepare('INSERT INTO analytics_evidence_daily VALUES(?,?,?)').run(day,'',count);
 env.sql.prepare('INSERT INTO analytics_evidence_daily VALUES(?,?,?)').run('2026-10-12','fb-applications',2);
 for(const now of ['2026-10-11T19:00:00Z','2026-10-12T12:00:00Z']){const m=await browserEvidenceMeasurement(env,Date.parse(now));assert.equal(m.evidence_checks,null);assert.equal(m.completed_days,0);assert.equal(m.state,'waiting_for_complete_day');}
 const m=await browserEvidenceMeasurement(env,Date.parse('2026-10-13T12:00:00Z'));assert.equal(m.evidence_checks,3);assert.equal(m.completed_days,1);assert.equal(m.campaigns[0].count,2);assert.match(m.limitation,/not unique people/);assert.match(m.limitation,/Earlier local use was not collected/);
 assert.deepEqual((await publicMeasurement(env,Date.parse('2026-10-13T12:00:00Z'))).browser_evidence,m);
 assert.equal((await browserEvidenceMeasurement(env,Date.parse('2026-10-14T12:00:00Z'),1)).evidence_checks,700);
 assert.equal((await browserEvidenceMeasurement(env,Date.parse('2026-10-14T12:00:00Z'),2)).evidence_checks,703);
 env.sql.prepare("DELETE FROM metadata WHERE key='analytics_browser_evidence_v1'").run();assert.equal((await browserEvidenceMeasurement(env)).state,'unavailable');assert.equal((await analyticsAPI(request(action),env)).status,503);
});

test('malformed, future or unsupported browser baselines fail closed rather than reporting zero',async t=>{
 const env=database(t);
 for(const value of ['not json',JSON.stringify({version:2,enabled_at:'2026-10-11T18:00:00.000Z'}),JSON.stringify({version:1,enabled_at:'Oct 11 2026'}),JSON.stringify({version:1,enabled_at:'2099-01-01T00:00:00.000Z'})]){
  env.sql.prepare("UPDATE metadata SET value=? WHERE key='analytics_browser_evidence_v1'").run(value);const m=await browserEvidenceMeasurement(env);assert.equal(m.state,'unavailable');assert.equal(m.evidence_checks,null);assert.equal((await analyticsAPI(request(action),env)).status,503);
 }
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_evidence_daily').get().n,0);
});

test('marketing captures the separate complete-day browser baseline without a model call or retrospective rewrite',async t=>{
 const env=database(t);boundary(env);env.AI_MODEL='writer';env.AI_REVIEW_MODEL='critic';env.MARKETING_WORKFLOW={create:async()=>({})};
 env.sql.prepare('INSERT INTO analytics_evidence_daily VALUES(?,?,?)').run('2026-10-11','',700);env.sql.prepare('INSERT INTO analytics_evidence_daily VALUES(?,?,?)').run('2026-10-12','',2);
 const now=Date.parse('2026-10-13T12:00:00Z'),run=await dispatchMarketingAgents(env,now);
 const context=await captureMarketingContext(env,run.id,async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>s.path===new URL(url).pathname).flatMap(s=>s.facts).map(f=>'<p>'+f+'</p>').join('')+'</article>',{headers:{'Content-Type':'text/html'}}),now);
 assert.equal(context.measurement.browser_evidence.evidence_checks,2);assert.equal(context.measurement.browser_evidence.completed_days,1);assert.equal(context.metrics.length,0);assert.match(PLANNER_PROMPT,/null count is not zero/);assert.match(MARKETING_POLICY,/v6$/);
 env.sql.prepare('UPDATE analytics_evidence_daily SET count=999').run();assert.deepEqual(await captureMarketingContext(env,run.id,()=>{throw Error('Must reuse pinned context')},now),context);
 assert.equal(env.sql.prepare('SELECT calls FROM marketing_agent_runs').get().calls,0);
});

test('browser sender emits only the fixed local action and tolerates offline delivery without retry',async()=>{
 const bundle=await build({entryPoints:['src/metrics.ts'],bundle:true,write:false,format:'iife',globalName:'Metrics',platform:'browser',target:'es2022'});
 const sent=[];let offline=false;const context=vm.createContext({window:{location:{search:'?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_week&utm_content=application_review'}},URLSearchParams,Date,fetch:(path,init)=>{sent.push({path,...init});return offline?Promise.reject(Error('offline')):Promise.resolve({ok:true});}});
 vm.runInContext(bundle.outputFiles[0].text,context);assert.equal(sent.length,0);context.Metrics.trackEvidenceCheck();assert.equal(sent.length,1);
 assert.deepEqual(JSON.parse(sent[0].body),action);assert.equal(sent[0].keepalive,true);assert.equal(sent[0].path,'/api/metrics');
 offline=true;context.Metrics.trackEvidenceCheck();await new Promise(r=>setImmediate(r));assert.equal(sent.length,2);context.fetch=()=>{throw Error('synchronously blocked')};assert.doesNotThrow(()=>context.Metrics.trackEvidenceCheck());assert.equal(sent.length,2);
});
