import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {SEARCH_PROPERTY,SEARCH_SCOPE,searchWindow,searchPage,searchAnalytics,searchSitemaps,searchInspection,searchAssertion,syncSearchConsole,searchSnapshot,searchFindings,searchAPI} from '../worker/search-console.js';
import {adminAPI} from '../worker/admin.js';
import {collectBusinessSnapshot,businessFindings} from '../worker/business-operations.js';

const now=Date.parse('2026-10-08T00:50:00Z');
const metric={clicks:1,impressions:10,ctr:.1,position:3};
const credentials=async()=>{
 const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const exported=await crypto.subtle.exportKey('pkcs8',key.privateKey);
 return {publicKey:key.publicKey,secret:JSON.stringify({type:'service_account',client_email:'search-reader@test-project.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(exported).toString('base64')+'\n-----END PRIVATE KEY-----',token_uri:'https://attacker.invalid/token'})};
};
const credentialFixture=credentials();
async function envFor(t){const env=database(t);env.SEARCH_CONSOLE_SERVICE_ACCOUNT=(await credentialFixture).secret;return env;}
const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
function googleFixture(mutate){
 const calls=[];
 const fetcher=async(url,options)=>{
  const body=options.body&&typeof options.body==='string'?JSON.parse(options.body):null;
  calls.push({url,options,body});const replacement=await mutate?.(url,options,body,calls);if(replacement)return replacement;
  if(url==='https://oauth2.googleapis.com/token')return json({access_token:'synthetic-token',token_type:'Bearer',expires_in:3600});
  if(url.endsWith('/searchAnalytics/query')){
   const rows=body.dimensions.length?body.dimensions[0]==='date'?[{keys:['2026-10-04'],...metric}]:[{keys:[SEARCH_PROPERTY+'jobs'],...metric}]:[{...metric}];
   return json({rows});
  }
  if(url.endsWith('/sitemaps'))return json({sitemap:[{path:SEARCH_PROPERTY+'sitemap.xml',lastDownloaded:'2026-10-06T12:00:00Z',isPending:false,errors:'0',warnings:'0',contents:[{type:'web',submitted:'779'}]}]});
  if(url==='https://searchconsole.googleapis.com/v1/urlInspection/index:inspect')return json({inspectionResult:{indexStatusResult:{verdict:'PASS',coverageState:'Submitted and indexed',googleCanonical:body.inspectionUrl,lastCrawlTime:'2026-10-05T12:00:00Z'}}});
  return json({siteUrl:SEARCH_PROPERTY,permissionLevel:'siteRestrictedUser'});
 };
 return {fetcher,calls};
}
test('reporting uses finalized Pacific calendar dates across UTC midnight and DST',()=>{
 assert.deepEqual(searchWindow(now),{startDate:'2026-09-07',endDate:'2026-10-04',timeZone:'America/Los_Angeles',dataState:'final'});
 assert.equal(searchWindow(Date.parse('2026-03-09T00:00:00Z')).endDate,'2026-03-05');
 assert.equal(searchWindow(Date.parse('2026-11-02T08:00:00Z')).endDate,'2026-10-30');
});
test('signed assertions request only read access, fixed token audience and no impersonation',async()=>{
 const c=await credentialFixture,assertion=await searchAssertion(c.secret,now),[header,body,signature]=assertion.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')),{alg:'RS256',typ:'JWT'});
 const claims=JSON.parse(Buffer.from(body,'base64url'));assert.equal(claims.scope,SEARCH_SCOPE);assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.equal(claims.exp-claims.iat,3600);assert.equal(claims.sub,undefined);
 assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',c.publicKey,Buffer.from(signature,'base64url'),new TextEncoder().encode(header+'.'+body)));
 for(const invalid of ['{}','bad',JSON.stringify({type:'authorized_user'})])await assert.rejects(searchAssertion(invalid,now),/invalid_credentials/);
});
test('empty reports stay no-data, real zeroes are retained and invalid metrics are rejected',()=>{
 const window=searchWindow(now);assert.equal(searchAnalytics({},'total',window).state,'no_data');
 const zero=searchAnalytics({rows:[{clicks:0,impressions:0,ctr:0,position:0}]},'total',window);assert.equal(zero.state,'available');assert.equal(zero.rows[0].clicks,0);assert.equal(zero.rows[0].position,null);
 for(const row of [{...metric,clicks:-1},{...metric,clicks:20},{...metric,impressions:NaN},{...metric,ctr:2},{...metric,position:Infinity}])assert.throws(()=>searchAnalytics({rows:[row]},'total',window),/invalid_response/);
 for(const date of ['2026-02-30','2026-10-08','garbage'])assert.throws(()=>searchAnalytics({rows:[{keys:[date],...metric}]},'dates',window),/invalid_response/);
 assert.throws(()=>searchAnalytics({rows:[],metadata:{first_incomplete_date:'2026-10-04'}},'dates',window),/invalid_response/);
});
test('page collection excludes credentials, private routes, arbitrary queries and external destinations',()=>{
 for(const url of ['https://evil.example/','https://sponsorintel.london.evil.example/jobs',SEARCH_PROPERTY+'account',SEARCH_PROPERTY+'jobs?email=private@example.com',SEARCH_PROPERTY+'jobs#secret','https://user:secret@sponsorintel.london/jobs'])assert.equal(searchPage(url),null);
 const result=searchAnalytics({rows:[{keys:[SEARCH_PROPERTY+'jobs'],...metric},{keys:[SEARCH_PROPERTY+'account?token=private'],...metric}]},'pages',searchWindow(now));assert.equal(result.rows.length,1);assert.equal(result.excluded_rows,1);assert.doesNotMatch(JSON.stringify(result.rows),/token|private/);
 assert.equal(searchPage(SEARCH_PROPERTY+'jobs/'+'a'.repeat(24)),SEARCH_PROPERTY+'jobs/'+'a'.repeat(24));
 assert.throws(()=>searchAnalytics({rows:[{keys:[SEARCH_PROPERTY],...metric},{keys:[SEARCH_PROPERTY],...metric}]},'pages',searchWindow(now)),/invalid_response/);
});
test('sitemap and inspection sanitizers do not turn missing dates or counts into zero',()=>{
 const s=searchSitemaps({sitemap:[{path:SEARCH_PROPERTY+'sitemap.xml',lastDownloaded:'bad'}]}).rows[0];assert.equal(s.last_downloaded,null);assert.equal(s.errors,null);assert.equal(s.submitted_pages,null);
 const i=searchInspection({inspectionResult:{indexStatusResult:{verdict:'NEUTRAL',googleCanonical:'https://evil.example/',lastCrawlTime:'bad'}}},'/');assert.equal(i.google_canonical,null);assert.equal(i.last_crawl,null);
});
test('missing connection and pause make no outbound requests or run reservations',async t=>{
 const env=database(t),fixture=googleFixture();assert.equal((await syncSearchConsole(env,'scheduled',now,fixture.fetcher)).state,'not_configured');assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_runs').get().n,0);
 env.sql.prepare('UPDATE search_controls SET enabled=0').run();assert.equal((await syncSearchConsole(env,'owner',now,fixture.fetcher)).state,'paused');assert.equal(fixture.calls.length,0);assert.equal((await searchSnapshot(env,now)).connected,false);
});
test('real signed read pipeline is fixed-property, bounded, replay-safe and secret-free',async t=>{
 const env=await envFor(t),fixture=googleFixture();const run=await syncSearchConsole(env,'scheduled',now,fixture.fetcher);assert.equal(run.state,'completed');assert.equal(fixture.calls.length,10);
 assert.ok(fixture.calls.every(c=>c.options.redirect==='error'&&c.options.signal));assert.ok(fixture.calls.every(c=>!c.url.includes('attacker')));
 const reads=fixture.calls.slice(1);assert.ok(reads.every(c=>c.options.headers.Authorization==='Bearer synthetic-token'));
 assert.ok(reads.filter(c=>c.body?.dimensions).every(c=>!c.body.dimensions.includes('query')&&c.body.dataState==='final'));
 assert.ok(reads.filter(c=>c.url.includes('index:inspect')).every(c=>c.body.siteUrl===SEARCH_PROPERTY&&c.body.inspectionUrl.startsWith(SEARCH_PROPERTY)));
 await syncSearchConsole(env,'owner',now,fixture.fetcher);assert.equal(fixture.calls.length,10);
 const saved=await searchSnapshot(env,now);assert.equal(saved.connected,true);assert.equal(saved.latest.trigger_kind,'scheduled');assert.equal(saved.latest.requests,10);assert.equal(saved.latest.result.parts.total.rows[0].clicks,1);
 assert.doesNotMatch(JSON.stringify(saved),/synthetic-token|PRIVATE KEY|assertion|client_email|access_token/);
 assert.equal((await searchSnapshot(env,now+37*3600000)).status,'overdue');
});
test('concurrent dispatch reserves one daily read and cannot relabel its trigger',async t=>{
 const env=await envFor(t),f=googleFixture();await Promise.all([syncSearchConsole(env,'scheduled',now,f.fetcher),syncSearchConsole(env,'owner',now,f.fetcher)]);assert.equal(f.calls.length,10);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_runs').get().n,1);
});
test('failed authentication is counted, sanitized and not retried that day',async t=>{
 const env=await envFor(t),f=googleFixture(()=>new Response('private token in error',{status:403}));
 assert.equal((await syncSearchConsole(env,'scheduled',now,f.fetcher)).state,'failed');await syncSearchConsole(env,'owner',now,f.fetcher);assert.equal(f.calls.length,1);
 const s=await searchSnapshot(env,now);assert.equal(s.latest.result.error,'permission_denied');assert.doesNotMatch(JSON.stringify(s),/private token/);
});
test('partial failure retains successful sections and marks the missing section explicitly',async t=>{
 const env=await envFor(t),f=googleFixture((url,opts,body)=>body?.dimensions?.[0]==='page'?new Response('quota',{status:429}):undefined);
 const r=await syncSearchConsole(env,'scheduled',now,f.fetcher);assert.equal(r.state,'partial');const s=await searchSnapshot(env,now);assert.equal(s.latest.result.parts.total.rows[0].clicks,1);assert.deepEqual(s.latest.result.parts.pages,{state:'error',error:'rate_limited'});assert.equal(s.connected,false);assert.ok(searchFindings(s).some(x=>x.id==='search-console-read'));
});
test('pause during a fetch prevents later requests and discards an unfinished aggregate',async t=>{
 const env=await envFor(t),f=googleFixture((url,opts,body,calls)=>{if(calls.length===2)env.sql.prepare('UPDATE business_controls SET enabled=0').run();});
 const r=await syncSearchConsole(env,'scheduled',now,f.fetcher);assert.equal(r.state,'paused');assert.equal(f.calls.length,2);assert.equal((await searchSnapshot(env,now)).latest.result.error,'paused');
});
test('oversized streaming response is bounded and a lost response consumes its request',async t=>{
 for(const response of [()=>new Response(' '.repeat(262145)),()=>{throw Error('network SECRET');}]){
  const env=await envFor(t),f=googleFixture(response);await syncSearchConsole(env,'scheduled',now,f.fetcher);const s=await searchSnapshot(env,now);assert.equal(s.latest.state,'failed');assert.equal(s.latest.requests,1);assert.doesNotMatch(JSON.stringify(s),/SECRET/);
 }
});
test('a committed completion survives a lost acknowledgement without another Google call',async t=>{
 const env=await envFor(t),f=googleFixture(),prepare=env.DB.prepare;let lost=true;
 env.DB.prepare=query=>{const statement=prepare(query),bind=statement.bind;statement.bind=(...args)=>{bind(...args);if(query.startsWith('UPDATE search_runs SET state=')&&args[0]==='completed'){const run=statement.run;statement.run=async()=>{const out=await run.call(statement);if(lost){lost=false;throw Error('lost ack');}return out;};}return statement;};return statement;};
 const r=await syncSearchConsole(env,'scheduled',now,f.fetcher);assert.equal(r.state,'completed');assert.equal(f.calls.length,10);assert.equal((await searchSnapshot(env,now)).latest.state,'completed');
});
test('indexing findings are scoped to sampled URLs and do not infer a ranking improvement',()=>{
 const result={parts:{total:{state:'no_data'},sitemaps:{rows:[{errors:1}]}},inspections:[{state:'available',verdict:'NEUTRAL'}]};const findings=searchFindings({status:'completed',latest:{result}});assert.equal(findings.length,3);assert.match(findings.find(x=>x.id==='search-indexing').detail,/four inspected URLs/);assert.match(findings.find(x=>x.id==='search-baseline').detail,/No traffic or ranking improvement/);
});
test('owner endpoints reject anonymous reads, cross-origin writes and settings injection',async t=>{
 const env=database(t);env.APP_ORIGIN='https://sponsorintel.london';
 assert.equal((await adminAPI(new Request(SEARCH_PROPERTY+'api/admin/search'),env)).status,403);
 const req=(origin,body)=>new Request(SEARCH_PROPERTY+'api/admin/search/settings',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await searchAPI(req('https://evil.example',{enabled:false}),env,{user:{id:'owner'}})).status,403);
 assert.equal((await searchAPI(req('https://sponsorintel.london',{enabled:false,property:'https://other.example'}),env,{user:{id:'owner'}})).status,400);
 assert.equal((await searchAPI(req('https://sponsorintel.london',{enabled:false}),env,{user:{id:'owner'}})).status,200);
 assert.equal(env.sql.prepare('SELECT enabled FROM search_controls').get().enabled,0);
});
test('business monitoring uses the connection evidence without reading a secret into its snapshot',async t=>{
 const env=database(t),s=await collectBusinessSnapshot(env,async url=>new Response(null,{status:url.endsWith('session')?403:200,headers:{'x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'none'"}}),now);
 assert.equal(s.search.status,'not_configured');assert.ok(businessFindings(s,now).some(x=>x.id==='search-console'));
});

test('business evidence stays compact, history has no duplicated reports and separate pause controls stay truthful',async t=>{
 const env=await envFor(t),f=googleFixture();await syncSearchConsole(env,'scheduled',now,f.fetcher);
 const compact=await searchSnapshot(env,now,{compact:true}),full=await searchSnapshot(env,now);
 assert.equal(compact.latest.result.parts.pages,undefined);assert.equal(compact.latest.result.parts.dates,undefined);assert.equal(compact.runs.length,0);assert.ok(compact.latest.result.parts.total);
 assert.ok(full.latest.result.parts.pages);assert.equal(full.runs[0].result,undefined);
 env.sql.prepare('UPDATE business_controls SET enabled=0').run();const paused=await searchSnapshot(env,now);assert.equal(paused.reading_enabled,true);assert.equal(paused.business_enabled,false);assert.equal(paused.enabled,false);
});
test('corrupt and future dates cannot mark search evidence connected; interrupted reads stay reserved',async t=>{
 const env=await envFor(t),f=googleFixture();await syncSearchConsole(env,'scheduled',now,f.fetcher);
 for(const date of ['bad','2026-10-09T00:00:00Z']){env.sql.prepare('UPDATE search_runs SET created_at=?').run(date);const s=await searchSnapshot(env,now);assert.equal(s.status,'invalid_timestamp');assert.equal(s.connected,false);}
 env.sql.prepare("UPDATE search_runs SET state='running',created_at=?").run(new Date(now-660000).toISOString());assert.equal((await searchSnapshot(env,now)).status,'interrupted');await syncSearchConsole(env,'scheduled',now,f.fetcher);assert.equal(f.calls.length,10);
});
