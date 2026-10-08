import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {candidate,search,advert,provider} from './fixtures/teaching-scout.mjs';
import {parseTeachingAdvert,parseTeachingSearch,teachingJobURL,teachingSearchURL,TEACHING_QUOTE} from '../worker/teaching-discovery.js';
import {scoutTeachingVacancies,discoveryScoutHealth,discoveryScoutFindings} from '../worker/discovery-scout.js';
import {discoveryAPI} from '../worker/discovery.js';
import {businessAPI} from '../worker/business-operations.js';
const now=Date.parse('2026-10-08T10:00:00Z'),day='2026-10-08',at=n=>new Date(n).toISOString();
function setup(t){const env=database(t);env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('fictional-business','running',?)").run(at(now));return env;}
function seeded(env,n=5){for(let i=0;i<n;i++)env.sql.prepare('INSERT INTO discovery_leads(id,source_key,source_url,source_kind,recorded_at) VALUES(?,?,?,?,?)').run('seed-'+i,'seed-'+i,'https://example.com/'+i,'employer',at(now));}

test('search parser handles actual nested-form layout, precise visa field and bounded official links',()=>{
 const result=parseTeachingSearch(search([candidate(1),candidate(2)],true));assert.equal(result.candidates.length,2);assert.equal(result.next,true);
 assert.equal(parseTeachingSearch(search().replaceAll(TEACHING_QUOTE,'Visas cannot be sponsored')).candidates.length,0);
 assert.equal(parseTeachingSearch(search().replaceAll(TEACHING_QUOTE,'The school is sponsored by a charity')).candidates.length,0);
 assert.equal(parseTeachingSearch(search([{...candidate(1),url:'https://external.example/jobs/teacher'}])).candidates.length,0);
 assert.throws(()=>parseTeachingSearch('<h1>Challenge</h1>'),{reason:'search_layout_changed'});
 for(const v of ['https://teaching-vacancies.service.gov.uk.evil.example/jobs/a','https://user:secret@teaching-vacancies.service.gov.uk/jobs/a','/jobs/a/apply','/jobs/a?token=secret','/jobs/a#x','http://teaching-vacancies.service.gov.uk/jobs/a'])assert.equal(teachingJobURL(v),null);
 assert.throws(()=>teachingSearchURL(3));
});
test('individual source must match title, location, future deadline and uncontradicted structured sponsorship',()=>{
 const c=candidate(1),parsed=parseTeachingAdvert(advert(c,now),c,now);assert.equal(parsed.method,'automated_source');assert.equal(parsed.posted_at,null);assert.match(parsed.posted_evidence,/2026-10-08/);assert.equal(parsed.quote,TEACHING_QUOTE);assert.equal(parsed.identity_url,'');
 for(const patch of [{title:'Other role'},{url:candidate(2).url},{validThrough:at(now-1)},{validThrough:'2026-10-19'},{datePosted:'2026-10-09'},{datePosted:'2026-13-40'},{jobLocation:{address:{addressCountry:'US'}}},{hiringOrganization:{name:''}}])assert.throws(()=>parseTeachingAdvert(advert(c,now,patch),c,now));
 for(const quote of ['Visas cannot be sponsored','A licence is available',''])assert.throws(()=>parseTeachingAdvert(advert(c,now,{},quote),c,now),{reason:'sponsorship_not_confirmed'});
 assert.throws(()=>parseTeachingAdvert(advert(c,now,{},TEACHING_QUOTE,'We cannot provide visa sponsorship for this role.'),c,now),{reason:'contradictory_sponsorship_wording'});
 assert.throws(()=>parseTeachingAdvert(advert(c,now,{},TEACHING_QUOTE,'This job has closed.'),c,now),{reason:'advert_closed_or_deadline_unknown'});
});
test('daily scout retains two distinct employers privately with server attribution and source proof; replay makes no requests',async t=>{
 const env=setup(t),fixture=provider(now),run=await scoutTeachingVacancies(env,'fictional-business',fixture.fetch,()=>now);
 assert.equal(run.state,'completed');assert.equal(run.retained,2);assert.equal(run.requests,3);assert.equal(run.reserved_requests,4);assert.equal(fixture.calls.length,3);assert.ok(fixture.calls.every(c=>c.redirect==='manual'));
 assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,4);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 const rows=env.sql.prepare('SELECT * FROM discovery_revisions').all();assert.equal(rows.length,2);assert.ok(rows.every(r=>r.actor==='system:teaching-vacancies-scout'&&JSON.parse(r.content).method==='automated_source'&&!r.job_proof));
 const health=await discoveryScoutHealth(env,now);assert.equal(health.items.length,2);assert.ok(health.items.every(i=>/^[a-f0-9]{64}$/.test(i.evidence.body_sha256)));assert.match(health.attribution,/Open Government/);
 assert.equal((await scoutTeachingVacancies(env,'fictional-business',fixture.fetch,()=>now)).replayed,true);assert.equal(fixture.calls.length,3);
});
test('shared five-lead and 500-request ceilings are reserved before I/O, including concurrent runs',async t=>{
 const full=setup(t);seeded(full);const f=provider(now);assert.equal((await scoutTeachingVacancies(full,'fictional-business',f.fetch,()=>now)).reason,'daily_lead_allowance_used');assert.equal(f.calls.length,0);
 const one=setup(t);seeded(one,4);const f1=provider(now);const r=await scoutTeachingVacancies(one,'fictional-business',f1.fetch,()=>now);assert.equal(r.retained,1);assert.equal(r.reserved_requests,3);
 const budget=setup(t);budget.sql.prepare('INSERT INTO agent_daily_budget(day,requests) VALUES(?,497)').run(day);assert.equal((await scoutTeachingVacancies(budget,'fictional-business',f.fetch,()=>now)).reason,'daily_request_allowance_used');assert.equal(f.calls.length,0);
 const env=setup(t),p=provider(now);await Promise.all([scoutTeachingVacancies(env,'fictional-business',p.fetch,()=>now),scoutTeachingVacancies(env,'fictional-business',p.fetch,()=>now)]);assert.equal(p.calls.length,3);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,4);
});
test('owner pause, midnight rollover and a newly filled allowance stop writes or fetches without refunds',async t=>{
 for(const setting of ['enabled','discovery']){const env=setup(t);env.sql.exec('UPDATE business_controls SET '+setting+'=0');const p=provider(now);assert.equal((await scoutTeachingVacancies(env,'fictional-business',p.fetch,()=>now)).state,'paused');assert.equal(p.calls.length,0);}
 for(const mode of ['pause','midnight','full']){const env=setup(t);let time=now;const p=provider(now,{mutate:(_,__,n)=>{if(n===2){if(mode==='pause')env.sql.exec('UPDATE business_controls SET discovery=0');if(mode==='midnight')time=now+86400000;if(mode==='full')seeded(env,5);}}});const r=await scoutTeachingVacancies(env,'fictional-business',p.fetch,()=>time);assert.equal(r.retained,0);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,4);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_revisions').get().n,0);if(mode!=='full')assert.equal(p.calls.length,2);}
});
test('duplicates advance to a bounded second page; negative adverts remain private, never published',async t=>{
 const env=setup(t),p=provider(now);await scoutTeachingVacancies(env,'fictional-business',p.fetch,()=>now);
 const later=now+86400000;env.sql.exec("UPDATE business_runs SET state='completed' WHERE id='fictional-business'");env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('fictional-next','queued',?)").run(at(later));
 const fixture=provider(later,{second:[candidate(3),candidate(4)],pages:{[candidate(3).url]:advert(candidate(3),later,{},'Visas cannot be sponsored')}});
 const r=await scoutTeachingVacancies(env,'fictional-next',fixture.fetch,()=>later);assert.equal(r.search_pages,2);assert.equal(r.retained,1);assert.equal(r.inspected,2);assert.equal(fixture.calls.length,4);assert.equal((await discoveryScoutHealth(env,later)).items.find(i=>i.source_url===candidate(3).url).state,'rejected');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
});
test('unsafe responses and interrupted execution are visible and cannot trigger extra fetches',async t=>{
 for(const response of [()=>new Response('',{status:302,headers:{location:'https://internal.example/'}}),()=>new Response('PRIVATE_SECRET',{status:403}),()=>new Response('x'.repeat(500001),{headers:{'Content-Type':'text/html'}}),()=>new Response('<h1>Challenge</h1>',{headers:{'Content-Type':'text/html'}})]){
  const env=setup(t);let calls=0;const fetcher=async()=>{calls++;return response();};const r=await scoutTeachingVacancies(env,'fictional-business',fetcher,()=>now);assert.equal(r.state,'held');assert.equal(calls,1);assert.ok(!JSON.stringify(r).includes('PRIVATE_SECRET'));assert.equal((await scoutTeachingVacancies(env,'fictional-business',fetcher,()=>now)).replayed,true);assert.equal(calls,1);assert.equal(discoveryScoutFindings(await discoveryScoutHealth(env,now)).length,1);
 }
 const env=setup(t);env.sql.prepare("INSERT INTO discovery_scout_runs(day,run_id,claim,state,reason,started_at,capacity,reserved_requests) VALUES(?,'fictional-business','lost','running','searching',?,2,4)").run(day,at(now));const p=provider(now);assert.equal((await scoutTeachingVacancies(env,'fictional-business',p.fetch,()=>now+600000)).state,'uncertain');assert.equal(p.calls.length,0);assert.equal((await discoveryScoutHealth(env,now+600000)).latest.state,'uncertain');
});
test('lost lead-commit acknowledgement preserves exactly one revision per source',async t=>{
 const env=setup(t),batch=env.DB.batch;let lost=true;env.DB.batch=async statements=>{const result=await batch(statements);if(lost&&env.sql.prepare('SELECT COUNT(*) n FROM discovery_revisions').get().n){lost=false;throw Error('Lost acknowledgement');}return result;};const fixture=provider(now);const r=await scoutTeachingVacancies(env,'fictional-business',fixture.fetch,()=>now);assert.equal(r.retained,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_revisions').get().n,2);assert.equal(fixture.calls.length,3);
});
test('owner API cannot impersonate automated attribution, and can pause discovery through its existing guarded setting',async t=>{
 const env=setup(t),owner={user:{id:'owner'}},origin='https://sponsorintel.london';const post=(path,body,source=origin)=>new Request(origin+path,{method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const content=parseTeachingAdvert(advert(candidate(1),now),candidate(1),now);
 assert.equal((await discoveryAPI(post('/api/admin/discovery',{id:null,revision:0,request_key:crypto.randomUUID(),source_kind:'teaching_vacancy',source_url:candidate(1).url,content}),env,owner)).status,400);
 assert.equal((await businessAPI(post('/api/admin/business/settings',{setting:'discovery',value:false},'https://foreign.example'),env,owner)).status,403);
 assert.equal((await businessAPI(post('/api/admin/business/settings',{setting:'discovery',value:false}),env,owner)).status,200);assert.equal((await discoveryScoutHealth(env,now)).enabled,false);
});
