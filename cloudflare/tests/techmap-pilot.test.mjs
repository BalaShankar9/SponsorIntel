import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { techmapQuery, reserveTechmapRequest, parseTechmapPage, readTechmapPilotPage } from '../integrations/techmap/pilot.js';

const now=Date.parse('2026-10-07T10:00:00Z'), query={from:'2026-10-05',to:'2026-10-07'};
const record=(patch={})=>({title:'Graduate analyst',company:'Fictional QA employer',countryCode:'gb',portal:'linkedin',
 dateCreated:'2026-10-06T08:00:00.000Z',dateActive:'2026-11-05T08:00:00.000Z',city:'London',
 jsonLD:{url:'https://uk.linkedin.com/jobs/view/graduate-analyst-1234567890/?trackingId=remove-me',
 description:'Join our fictional analytics team in London and work on research, reporting and responsible data analysis. We cannot provide visa sponsorship. Salary: £31,000 per annum.'},...patch});
const payload=(rows)=>({result:rows,totalCount:rows.length});
function db(t,cap=2){
 const sql=new DatabaseSync(':memory:'); t.after(()=>sql.close());
 sql.exec(readFileSync(new URL('../integrations/techmap/pilot-schema.sql',import.meta.url),'utf8'));
 sql.prepare('INSERT INTO techmap_pilot_budget VALUES(?,?,?,?,?,?,?)').run('techmap',1,'fictional-local-approval',now-1000,now+DAY,cap,0);
 return {sql,prepare(text){return{bind(...values){return{async first(){return sql.prepare(text).get(...values)||null}}}}}};
}
const DAY=86400000;

test('pilot query pins the provider, UK and LinkedIn filters with explicit bounded dates',()=>{
 const u=techmapQuery({...query,company:'Hospitality + Care',title:'graduate'},now);
 assert.equal(u.hostname,'daily-international-job-postings.p.rapidapi.com');
 assert.equal(u.searchParams.get('countryCode'),'gb');assert.equal(u.searchParams.get('portal'),'linkedin');
 assert.equal(u.searchParams.get('dateCreatedMin'),'2026-10-05');assert.equal(u.searchParams.get('isActive'),null);
 for(const patch of [{from:'2026-02-31'},{from:'2026-09-01'},{to:'2026-10-08'},{page:11},{page:0}])
  assert.throws(()=>techmapQuery({...query,...patch},now));
});

test('provider-inferred expiry and matching company names cannot establish availability or a sponsor licence',async()=>{
 const d=await parseTechmapPage(payload([record({company:'Monzo'})]),now),j=d.candidates[0];
 assert.equal(j.company,'Monzo');assert.equal(j.employer_licence,null);assert.equal(j.availability,'unverified');
 assert.equal(j.state,'needs_review');assert.equal(j.public_display,false);assert.equal(j.source_portal,'linkedin');
 assert.equal(j.source_url,'https://www.linkedin.com/jobs/view/1234567890/');assert.equal(j.provider_reported_closing_at,null);
 assert.equal(j.provider_assumed_expiry_at,'2026-11-05T08:00:00.000Z');assert.equal(j.sponsorship,'unavailable');
 assert.match(j.evidence,/cannot provide/);assert.match(j.salary_excerpt,/£31,000/);
});

test('foreign, stale, expired, duplicate and unsafe records stay out of the review candidates',async()=>{
 const rows=[record({countryCode:'us'}),record({countryCode:['gb']}),record({portal:'other'}),record({isDuplicate:true}),
  record({dateCreated:'2026-08-01'}),record({dateExpired:'2026-10-06'}),record({dateCreated:'2026-10-09'}),
  record({jsonLD:{...record().jsonLD,url:'https://www.linkedin.com.attacker.example/jobs/view/1234567890/'}}),
  record(),record({jsonLD:{...record().jsonLD,url:'https://www.linkedin.com/jobs/view/1234567890/'}})];
 const d=await parseTechmapPage(payload(rows),now);assert.equal(d.candidates.length,1);assert.equal(d.rejected.length,9);
});

test('source closing dates keep the UK stated day, and malformed dates/envelopes fail conservatively',async()=>{
 const r=record({dateExpired:'2026-10-07'});
 assert.equal((await parseTechmapPage(payload([r]),Date.parse('2026-10-07T22:59:59Z'))).candidates.length,1);
 assert.equal((await parseTechmapPage(payload([r]),Date.parse('2026-10-07T23:00:00Z'))).candidates.length,0);
 assert.equal((await parseTechmapPage(payload([record({dateExpired:'2026-11-31'})]),now)).candidates.length,0);
 await assert.rejects(parseTechmapPage({result:[record()]},now),/Unexpected/);
 await assert.rejects(parseTechmapPage(payload(Array(11).fill(record())),now),/Unexpected/);
});

test('a shared SQL reservation enforces the cap across concurrent callers and never resets itself',async(t)=>{
 const DB=db(t,3);const attempts=await Promise.allSettled(Array.from({length:20},()=>reserveTechmapRequest(DB,now)));
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,3);
 assert.equal(DB.sql.prepare('SELECT used_requests FROM techmap_pilot_budget').get().used_requests,3);
 await assert.rejects(reserveTechmapRequest(DB,now+2*DAY));
 assert.throws(()=>DB.sql.exec('UPDATE techmap_pilot_budget SET max_requests=101'));
});

test('disabled, unapproved and out-of-period pilots make no requests',async(t)=>{
 const DB=db(t);let calls=0;const args={apiKey:'fictional-key',DB,query,now,fetcher:async()=>{calls++;return Response.json(payload([]))}};
 await assert.rejects(readTechmapPilotPage(args),/disabled/);
 DB.sql.exec("UPDATE techmap_pilot_budget SET approval_reference=''");
 await assert.rejects(readTechmapPilotPage({...args,enabled:true}),/unapproved/);
 DB.sql.exec("UPDATE techmap_pilot_budget SET approval_reference='local',period_end="+now);
 await assert.rejects(readTechmapPilotPage({...args,enabled:true}),/billing period/);assert.equal(calls,0);
});

test('requests keep the credential in headers, decline redirects, and charge failures without automatic retry',async(t)=>{
 const DB=db(t,4),apiKey='fictional-key-never-log';let calls=0;
 const args={enabled:true,apiKey,DB,query,now};
 await assert.rejects(readTechmapPilotPage({...args,fetcher:async(url,options)=>{
  calls++;assert.ok(!url.includes(apiKey));assert.equal(options.redirect,'manual');assert.equal(options.headers['X-RapidAPI-Key'],apiKey);
  return new Response('',{status:302,headers:{Location:'https://attacker.example'}});
 }}),/HTTP 302/);
 await assert.rejects(readTechmapPilotPage({...args,fetcher:async()=>{calls++;throw Error(apiKey)}}),e=>!e.message.includes(apiKey));
 await assert.rejects(readTechmapPilotPage({...args,fetcher:async()=>{calls++;return new Response(apiKey)}}),e=>!e.message.includes(apiKey));
 const d=await readTechmapPilotPage({...args,fetcher:async()=>{calls++;return Response.json(payload([record()]))}});
 assert.equal(d.candidates.length,1);assert.equal(calls,4);
 await assert.rejects(readTechmapPilotPage({...args,fetcher:async()=>{calls++;return Response.json(payload([]))}}));
 assert.equal(calls,4);assert.equal(DB.sql.prepare('SELECT used_requests FROM techmap_pilot_budget').get().used_requests,4);
});
