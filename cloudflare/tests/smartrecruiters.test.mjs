import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDatabase} from './helpers/source-d1.mjs';
import {source,posting,detail,provider} from './fixtures/smartrecruiters.mjs';
import {collectSmartRecruiters,smartRecruitersDetail} from '../worker/smartrecruiters.js';
import {fetchBoard,normaliseBoardJobs} from '../worker/jobs.js';
import {dispatchSources,initialiseRun,executeSourceTask,completeRun,operationsSnapshot} from '../worker/agent-operations.js';
import {operationFindings} from '../worker/agent-brief.js';
import {sourceDiagnostic} from '../worker/source-errors.js';
const stamp=()=>new Date().toISOString();
function lease(env){env.sql.prepare("INSERT INTO feed_locks VALUES('jobs','fixture',?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires").run(Date.now()+120000);return {DB:env.DB,leaseOwner:'fixture'};}
async function start(env,id){await dispatchSources(env,{id,sourceId:source.id});await initialiseRun(env,id);}

test('public sections preserve role restrictions, exclude private custom pay and do not invent original publication',async()=>{
 const row=posting(1),value=await smartRecruitersDetail(detail(row),row,source),[job]=await normaliseBoardJobs([value],source);
 assert.equal(job.sponsorship,'offered');assert.match(job.description,/GDC registration and Northern Ireland Dental List registration required/);assert.equal(job.source_first_published_at,null);assert.equal(job.salary_excerpt,'');assert.ok(!JSON.stringify(job).includes('PRIVATE_FIXTURE'));assert.ok(job.description_checked_at);
 const declined=detail(row);declined.jobAd.sections.additionalInformation.text='<p>We cannot provide visa sponsorship for this role.</p>';
 assert.equal((await normaliseBoardJobs([await smartRecruitersDetail(declined,row,source)],source))[0].sponsorship,'unavailable');
});

test('foreign, internal, changed, inactive, redirected and incomplete adverts are rejected',async()=>{
 const row=posting(1);
 for(const change of [d=>d.active=false,d=>d.visibility='INTERNAL',d=>d.company.identifier='Other',d=>d.name='Changed',d=>d.postingUrl='https://evil.invalid/job',d=>d.postingUrl+='?token=private',d=>{d.jobAd.sections.jobDescription.text='';d.jobAd.sections.companyDescription.text='';},d=>delete d.jobAd.sections.qualifications,d=>d.jobAd.sections.unreviewed={text:'new',title:'new'},d=>d.location.postalCode={},d=>d.releasedDate='2099-01-01T00:00:00Z']){const d=detail(row);change(d);await assert.rejects(smartRecruitersDetail(d,row,source));}
 await assert.rejects(smartRecruitersDetail(detail(row),row,{...source,board:'other'}));
});

test('a complete advert can place the role under Company Description while Job Description is empty',async()=>{
 const row=posting(1),d=detail(row);d.jobAd.sections.companyDescription.text=d.jobAd.sections.jobDescription.text;d.jobAd.sections.jobDescription.text='';
 const [job]=await normaliseBoardJobs([await smartRecruitersDetail(d,row,source)],source);assert.equal(job.sponsorship,'offered');assert.match(job.description,/GDC registration/);
 d.jobAd.sections.qualifications.text='<p>We cannot provide visa sponsorship for this role.</p>';
 assert.equal((await normaliseBoardJobs([await smartRecruitersDetail(d,row,source)],source))[0].sponsorship,'unavailable');
});

test('41 roles stage 40 privately, resume one, publish atomically and spend nothing on replay',async t=>{
 const env=sourceDatabase(t),fixture=provider(Array.from({length:41},(_,i)=>posting(i+1)));
 const readBoard=(board,context)=>fetchBoard(board,{...context,fetcher:fixture.fetcher});
 await start(env,'first');const one=await executeSourceTask(env,'first',source.id,{readBoard});
 assert.equal(one.error_code,'details_pending');assert.equal(fixture.calls.length,42);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_sources').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_runs').get().n,0);
 const finished=await completeRun(env.DB,'first');assert.equal(finished.state,'completed');assert.equal(finished.counts.collecting,1);
 const snap=await operationsSnapshot(env),s=snap.sources.find(x=>x.id===source.id);assert.equal(s.collection.ready,40);assert.equal(s.collection.total,41);assert.ok(operationFindings(snap).some(x=>x.id==='collecting:'+source.id));
 assert.equal((await executeSourceTask(env,'first',source.id,{readBoard})).replay,true);assert.equal(fixture.calls.length,42);
 await start(env,'second');assert.equal((await executeSourceTask(env,'second',source.id,{readBoard})).state,'published');assert.equal(fixture.calls.length,45);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs WHERE active=1').get().n,41);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,100);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_runs WHERE success=1').get().n,1);
 assert.equal(JSON.parse(env.sql.prepare("SELECT evidence FROM agent_tasks WHERE run_id='second'").get().evidence).collection.ready,41);
});

test('pagination is complete across both catalogues and the detail batch stays bounded',async t=>{
 const env=sourceDatabase(t),f=provider(Array.from({length:101},(_,i)=>posting(i+1))),result=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});
 assert.equal(result.pending,true);assert.equal(result.progress.ready,40);assert.equal(result.progress.total,101);assert.equal(f.calls.length,44);assert.equal(f.calls.filter(u=>u.includes('offset=100')).length,2);
});

test('incomplete pagination, duplicate IDs and unsupported total never become public progress',async t=>{
 for(const kind of ['short','duplicate','oversize','redirect']){const env=sourceDatabase(t),f=provider([posting(1),posting(2)],(v,u)=>{if(!u.search)return;if(kind==='short')v.content.pop();if(kind==='duplicate')v.content[1]=v.content[0];if(kind==='oversize')v.totalFound=501;if(kind==='redirect')return new Response('',{status:302,headers:{Location:'https://private.invalid'}});return v;});await assert.rejects(collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher}));assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_collection_progress').get().n,0);assert.equal(f.calls.length,1);}
});

test('overseas and Crown Dependency roles never count as UK descriptions',async t=>{
 const env=sourceDatabase(t),rows=[posting(1),posting(2),posting(3),posting(4)];rows[1].location.country='ie';rows[2].location.postalCode='JE2 4AA';rows[3].location.city='Isle of Man';const f=provider(rows),r=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});assert.equal(r.raw.length,1);assert.equal(r.progress.catalogue_total,4);assert.equal(r.progress.excluded.length,3);assert.equal(f.calls.length,3);
});

test('catalogue change after detail collection stays private until its matching description is fetched',async t=>{
 const env=sourceDatabase(t),rows=[posting(1)];let lists=0;const f=provider(rows,(v,u)=>{if(u.search&&++lists===2){rows[0].releasedDate='2026-02-01T09:00:00Z';v.content=structuredClone(rows);}return v;});const r=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});assert.equal(r.pending,true);assert.equal(r.progress.ready,0);const next=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});assert.equal(next.raw.length,1);assert.equal(next.progress.fetched,1);
});

test('unchanged text reuses its original retrieval time, stale text is fetched and absent posts are pruned',async t=>{
 const env=sourceDatabase(t),rows=[posting(1),posting(2)],f=provider(rows);const r=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});const before=f.calls.length;rows.pop();const cached=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});assert.equal(f.calls.length-before,2);assert.equal(cached.raw[0].description_checked_at,r.raw[0].description_checked_at);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_posting_cache').get().n,1);
 env.sql.exec("UPDATE source_posting_cache SET checked_at='2020-01-01T00:00:00Z'");const refresh=await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});assert.equal(refresh.progress.fetched,1);
 env.sql.exec("UPDATE source_posting_cache SET payload='{}'");assert.equal((await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher})).progress.fetched,1);
});

test('an interrupted batch preserves derivative cache but cannot save after losing its lease',async t=>{
 const env=sourceDatabase(t),f=provider([posting(1),posting(2)],(v,u)=>{if(u.pathname.endsWith(posting(2).id))env.sql.exec("UPDATE feed_locks SET owner='new-operation'");return v;});await assert.rejects(collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher}),e=>sourceDiagnostic(e).code==='lease_ended');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_posting_cache').get().n,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_collection_progress').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
});

test('request ceilings and owner pause prevent paged collection before fetching',async t=>{
 for(const reason of ['daily','run','pause']){const env=sourceDatabase(t);await start(env,'limited');env.sql.prepare('INSERT INTO agent_daily_budget(day,requests) VALUES(?,?)').run(stamp().slice(0,10),reason==='daily'?451:0);if(reason==='run')env.sql.exec("UPDATE agent_runs SET requests=101");if(reason==='pause')env.sql.prepare('INSERT INTO agent_source_controls(source_id,paused,updated_at) VALUES(?,1,?)').run(source.id,stamp());const r=await executeSourceTask(env,'limited',source.id,{readBoard:async()=>assert.fail('No network permitted')});assert.equal(r.error_code,reason==='pause'?'owner_paused':'request_budget');}
});

test('stalled, future-dated or failed bootstrap is a freshness issue, not healthy progress',()=>{
 const now=Date.now(),s={id:source.id,company:source.company,collection:{state:'collecting',ready:40,total:249,started_at:stamp(),checked_at:stamp()}},snapshot={register:{available:true},reviews:[],sources:[s]};
 assert.ok(operationFindings(snapshot,now).some(x=>x.id==='collecting:'+source.id));
 for(const change of [s=>s.collection.checked_at='2020-01-01',s=>s.collection.started_at='2099-01-01',s=>s.error='Failed',s=>s.collection.started_at=new Date(now-5*86400000).toISOString()]){const x=structuredClone(snapshot);change(x.sources[0]);assert.ok(operationFindings(x,now).some(f=>f.id==='fresh:'+source.id));assert.ok(!operationFindings(x,now).some(f=>f.id==='collecting:'+source.id));}
});

test('fast responses are paced rather than sent in a burst',async t=>{
 const env=sourceDatabase(t),starts=[],f=provider([posting(1)],()=>{starts.push(Date.now());});
 await collectSmartRecruiters(source,{...lease(env),fetcher:f.fetcher});
 assert.equal(starts.length,3);assert.ok(starts[1]-starts[0]>=180);assert.ok(starts[2]-starts[1]>=180);
});

test('a valid resumed partial collection clears its fetch error without inventing a successful publication',async t=>{
 const env=sourceDatabase(t);env.sql.prepare("INSERT INTO job_sources(id,company,careers_url,checked_at,count,error) VALUES(?,?,?, ?,0,'Prior failed fetch')").run(source.id,source.company,source.careers,stamp());
 env.sql.prepare('INSERT INTO agent_source_controls(source_id,updated_at,failures) VALUES(?,?,2)').run(source.id,stamp());
 await start(env,'resumed');const progress={state:'collecting',ready:40,total:249,checked_at:stamp(),started_at:stamp()};
 const r=await executeSourceTask(env,'resumed',source.id,{readBoard:async()=>({pending:true,progress})});
 assert.equal(r.error_code,'details_pending');assert.equal(env.sql.prepare('SELECT error FROM job_sources').get().error,null);assert.equal(env.sql.prepare('SELECT last_success FROM job_sources').get().last_success,null);assert.equal(env.sql.prepare('SELECT failures FROM agent_source_controls').get().failures,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_runs').get().n,0);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,50);
});

test('single-advert research validates original identity without a source lease or collection cache',async()=>{
 const {fetchBoardJob}=await import('../worker/jobs.js'),{approvedJobLink}=await import('../worker/job-link-checks.js');const row=posting(1),f=provider([row]),[stored]=await normaliseBoardJobs([await smartRecruitersDetail(detail(row),row,source)],source);
 assert.equal((await fetchBoardJob(source,stored,{fetcher:f.fetcher}))[0].id,stored.id);assert.equal(f.calls.length,1);assert.equal(approvedJobLink(source,stored.apply_url),stored.apply_url);assert.equal(approvedJobLink(source,stored.apply_url+'?token=secret'),null);
 await assert.rejects(fetchBoardJob(source,{...stored,title:'Another job'},{fetcher:f.fetcher}));await assert.rejects(fetchBoardJob(source,{...stored,apply_url:'https://evil.invalid/job'},{fetcher:f.fetcher}));assert.equal(f.calls.length,2);
 const outside=provider([row],value=>{value.location.country='ie';return value;});assert.equal((await fetchBoardJob(source,stored,{fetcher:outside.fetcher})).length,0);
});
