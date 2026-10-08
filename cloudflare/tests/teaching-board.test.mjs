import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {database} from './research-db.mjs';
import {school,vacancy,catalogue,advert,provider,seedSchool} from './fixtures/teaching-board.mjs';
import {parseTeachingCatalogue,parseTeachingVacancy,collectTeachingVacancies} from '../worker/teaching-vacancies.js';
import {teachingBoardIdentity} from '../worker/teaching-source.js';
import {fetchBoard,fetchBoardJob,normaliseBoardJobs} from '../worker/jobs.js';
import {sourceRequestCost} from '../worker/job-sources.js';
import {validateBoard} from '../worker/admin.js';
import {approvedJobLink} from '../worker/job-link-checks.js';
import {dispatchSources,initialiseRun,executeSourceTask} from '../worker/agent-operations.js';
const stamp=()=>new Date().toISOString();


test('one-school catalogue preserves complete role wording, negative roles and exact publication dates',async()=>{
 const f=provider(),jobs=await fetchBoard(school,{readOnlyProbe:true,fetcher:f.fetcher});assert.equal(jobs.length,2);assert.equal(jobs[0].sponsorship,'conditional');assert.equal(jobs[1].sponsorship,'unavailable');assert.match(jobs[0].description,/Qualified teacher status/);assert.doesNotMatch(jobs[0].description,/Unrelated jobs/);assert.equal(jobs[0].source_updated_at,stamp().slice(0,10));assert.equal(jobs[0].source_first_published_at,null);assert.equal(f.calls.length,4);assert.equal(jobs.feed_review.full_catalogue_checked,true);assert.equal(sourceRequestCost(school),24);
});
test('two catalogue pages and all 20 details fit the fixed 24-request reservation',async()=>{
 const rows=Array.from({length:20},(_,i)=>vacancy(i+1)),f=provider(rows);const r=await collectTeachingVacancies(school,{readOnlyProbe:true,fetcher:f.fetcher});assert.equal(r.raw.length,20);assert.equal(f.calls.length,24);assert.equal(f.calls.filter(u=>u.endsWith('page=2')).length,2);
});
test('truncated, duplicated, unfiltered and oversized catalogues never reach publication',()=>{
 const rows=Array.from({length:11},(_,i)=>vacancy(i+1)),html=catalogue(rows);
 for(const changed of [html.replace('Jobs (11)','Jobs (12)').replace('govuk-pagination__next','missing'),html.replace('value="fictional-school"','value="another-school"'),html.replace(rows[1].id,rows[0].id),html.replace('Jobs (11)','Jobs (21)'),html.replace('&page=2','&page=3')])assert.throws(()=>parseTeachingCatalogue(changed,school));
});
test('school name, URN, country, title, date, UUID and complete visa row are required',()=>{
 const r=vacancy(1),now=Date.now();for(const patch of [{hiringOrganization:{name:school.company,identifier:'654321'}},{hiringOrganization:{name:'Another School',identifier:'123456'}},{jobLocation:{address:{addressCountry:'IN'}}},{title:'Different role'},{datePosted:'2026-02-30'},{datePosted:'2099-01-01'},{validThrough:'tomorrow'},{url:'https://evil.invalid/job'}])assert.throws(()=>parseTeachingVacancy(advert(r,now,{patch}),school,r,now));
 assert.throws(()=>parseTeachingVacancy(advert(r).replace(r.id,'not-a-uuid'),school,r));assert.throws(()=>parseTeachingVacancy(advert(r,now,{quote:'Ask us about visas'}),school,r));
});
test('conflicting restrictions anywhere in full text hold the whole batch; expired adverts stay out',async()=>{
 const r=vacancy(1),now=Date.now(),raw=parseTeachingVacancy(advert(r,now,{body:'Good benefits. We cannot provide visa sponsorship for this role.'}),school,r,now);await assert.rejects(normaliseBoardJobs([raw],school,now),/conflicting/);
 const expired=parseTeachingVacancy(advert(r,now,{patch:{validThrough:new Date(now-1000).toISOString()}}),school,r,now);assert.equal((await normaliseBoardJobs([expired],school,now)).length,0);
});
test('changed catalogue, redirects and source pause fail before any partial publication',async t=>{
 const f=provider(undefined,{alter:(html,url,n)=>n===4?html.replace('Fictional teacher 1','Changed role'):html});await assert.rejects(fetchBoard(school,{readOnlyProbe:true,fetcher:f.fetcher}));
 const redirect=provider(undefined,{alter:()=>new Response('',{status:302,headers:{Location:'https://evil.invalid'}})});await assert.rejects(fetchBoard(school,{readOnlyProbe:true,fetcher:redirect.fetcher}));assert.equal(redirect.calls.length,1);
 const env=database(t);await assert.rejects(collectTeachingVacancies(school,{fetcher:()=>{throw Error('unexpected I/O')}}));
 env.sql.prepare("INSERT INTO feed_locks VALUES('jobs','fictional',?)").run(Date.now()+120000);env.sql.prepare("INSERT INTO agent_source_controls(source_id,paused,updated_at) VALUES(?,1,'2026-10-08')").run(school.id);
 const paused=provider();await assert.rejects(collectTeachingVacancies(school,{DB:env.DB,leaseOwner:'fictional',fetcher:paused.fetcher}));assert.equal(paused.calls.length,0);
});
test('owner intake validates school configuration and advert checks retain the exact destination',()=>{
 assert.equal(validateBoard(school).id,school.id);for(const patch of [{board:'123--fictional-school'},{board:'123456--Fictional'},{sector:'healthcare'}])assert.throws(()=>validateBoard({...school,...patch}));
 const url=vacancy(1).url;assert.equal(approvedJobLink(school,url),url);for(const other of [vacancy(2).url,url+'?secret=x','https://evil.invalid/job'])assert.equal(approvedJobLink(school,other,url),null);
 assert.equal(teachingBoardIdentity(school).urn,'123456');
});
test('single-advert research reads once, verifies stored identity and never walks the school catalogue',async()=>{
 const f=provider(),raw=parseTeachingVacancy(advert(vacancy(1)),school,vacancy(1)),[stored]=await normaliseBoardJobs([raw],school);const jobs=await fetchBoardJob(school,stored,{fetcher:f.fetcher});assert.equal(jobs[0].id,stored.id);assert.deepEqual(f.calls,[stored.apply_url]);assert.equal((await fetchBoardJob(school,{...stored,id:'another-id'},{fetcher:f.fetcher})).length,0);
});
test('approved school publication is atomic, reserves 24 and replays without network',async t=>{
 const env=database(t);await seedSchool(env.DB);const f=provider(),readBoard=(b,c)=>fetchBoard(b,{...c,fetcher:f.fetcher});await dispatchSources(env,{id:'school-fixture',sourceId:school.id});await initialiseRun(env,'school-fixture');const result=await executeSourceTask(env,'school-fixture',school.id,{readBoard});assert.equal(result.state,'published');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs WHERE active=1').get().n,2);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,24);assert.equal((await executeSourceTask(env,'school-fixture',school.id,{readBoard})).replay,true);assert.equal(f.calls.length,4);
});
test('provider migration preserves existing reviews, uniqueness and owner foreign keys',()=>{
 const sql=new DatabaseSync(':memory:');try{sql.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')&&n<'0033').sort())sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 sql.exec("INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('owner','Fictional','owner@example.invalid',1,0,0)");sql.exec("INSERT INTO employer_boards VALUES('existing','School','ashby','school','https://example.invalid','education','s','Evidence','paused','2026-10-08','2026-10-08','owner')");const before=sql.prepare('SELECT * FROM employer_boards').all();sql.exec(readFileSync(new URL('../migrations/0033_teaching_employer_provider.sql',import.meta.url),'utf8'));assert.deepEqual(sql.prepare('SELECT * FROM employer_boards').all(),before);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);assert.throws(()=>sql.exec("UPDATE employer_boards SET provider='unreviewed'"));sql.exec("DELETE FROM user WHERE id='owner'");assert.equal(sql.prepare('SELECT reviewed_by FROM employer_boards').get().reviewed_by,null);
 }finally{sql.close();}
});

test('owner approval probes reserve full cost before I/O, retain failures and refuse over budget',async t=>{
 const {probeReviewedBoard}=await import('../worker/admin.js'),env=database(t),day=stamp().slice(0,10);let calls=0;
 await assert.rejects(probeReviewedBoard(env.DB,school,async(b,ctx)=>{calls++;assert.equal(ctx.readOnlyProbe,true);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,24);throw Error('Fixture unavailable');}));assert.equal(calls,1);
 env.sql.prepare('UPDATE agent_daily_budget SET requests=490 WHERE day=?').run(day);await assert.rejects(probeReviewedBoard(env.DB,school,async()=>{calls++;}),/allowance/);assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,490);
});
