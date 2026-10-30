import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {database} from './research-db.mjs';
import {runRegisterRefresh, sameRegisterSnapshot} from '../worker/register-refresh.js';
import {registerFailureCode,registerFailureDetail} from '../worker/register-health.js';
const now=Date.parse('2026-10-15T07:15:00Z'),stamp=new Date(now).toISOString();
const old={snapshot:'old',source_date:'2026-10-13',source_url:'https://assets.publishing.service.gov.uk/media/test/register-2026-10-13.csv',checked_at:'2026-10-14T07:15:00Z',employers:100000,refresh_error:null};
const source='https://assets.publishing.service.gov.uk/media/test/register-2026-10-14.csv';
const page=url=>new Response('<a href="'+url+'">Worker register</a>');
const metadata=env=>JSON.parse(env.sql.prepare("SELECT value FROM metadata WHERE key='register'").get().value);
function seed(t){const env=database(t);env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register',JSON.stringify(old));env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run('0'.repeat(24),'old','Fictional retained employer','Cardiff','','["Worker (A rating)"]','["Skilled Worker"]',1);return env;}
function intercept(env,match,action){const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=query=>{const stmt=prepare(query);if(match(query)){for(const method of ['run','first']){const run=stmt[method].bind(stmt);stmt[method]=()=>action(run,query);}}return stmt;};}
const header='Organisation Name,Town/City,County,Type & Rating,Route';
const fixtureRows=Array.from({length:100000},(_,i)=>'Fictional QA Employer '+i+',Cardiff,,Worker (A rating),Skilled Worker');
function newFeed(url=source,rows=fixtureRows){let calls=0;return {fetcher:async target=>{calls++;if(calls===1)return page(url);assert.equal(target,url);return new Response(header+'\n'+rows.join('\n'));},calls:()=>calls};}
function completeSeed(t) {
 const env=seed(t);env.sql.exec('BEGIN; DELETE FROM sponsors;');
 const insert=env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)');
 for(let i=0;i<100000;i++) {
   const name='Fictional QA Employer '+i;
   const id=createHash('sha256').update(name.toLowerCase()+'|cardiff|').digest('hex').slice(0,24);
   insert.run(id,'old',name,'Cardiff','','["Worker (A rating)"]','["Skilled Worker"]',1);
 }
 env.sql.exec('COMMIT');return env;
}

test('source and validation failures preserve the old snapshot and retain only bounded diagnostics',async t=>{
 for(const [response,stage,code] of [[new Response('bad',{status:503}),'publication','source_unavailable'],[page('https://example.invalid/wrong.csv'),'publication','invalid_source']]){
  const env=seed(t);await assert.rejects(runRegisterRefresh(env,async()=>response,()=>now),/Register refresh failed/);
  const saved=metadata(env);assert.equal(saved.snapshot,old.snapshot);assert.equal(saved.checked_at,old.checked_at);assert.equal(saved.source_date,old.source_date);assert.deepEqual(saved.refresh_failure,{stage,code,started_at:stamp,failed_at:stamp,publication:'not_attempted',source_date:null});
 }
 const env=seed(t);let calls=0;await assert.rejects(runRegisterRefresh(env,async()=>++calls===1?page(source):new Response('Wrong,header\n'),()=>now),/validation, invalid_register/);assert.equal(calls,2);assert.equal(metadata(env).snapshot,'old');
});
test('identical complete content reuses the snapshot at the same or new URL and clears failure diagnostics',{timeout:60000},async t=>{
 const env=completeSeed(t);
 for(const url of [old.source_url,source]) {
  env.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify({...old,refresh_error:'old error',refresh_failure:{stage:'publication'}}));
  const feed=newFeed(url,[...fixtureRows].reverse());
  assert.deepEqual(await runRegisterRefresh(env,feed.fetcher,()=>now),{unchanged:true});
  assert.equal(feed.calls(),2);const saved=metadata(env);
  assert.equal(saved.checked_at,stamp);assert.equal(saved.refresh_error,null);assert.equal(saved.refresh_failure,null);
  assert.equal(saved.snapshot,old.snapshot);assert.equal(saved.source_url,url);assert.equal(saved.source_rows,100000);
  assert.equal(saved.employers,100000);assert.equal(saved.skilled_worker,100000);assert.equal(saved.cities,1);
  assert.equal(env.sql.prepare('SELECT count(*) n FROM sponsors').get().n,100000);
 }
});
test('same URL with unavailable, invalid or truncated CSV never renews the successful check',async t=>{
 for(const response of [()=>new Response('no',{status:503}),()=>new Response('Wrong,header\n'),()=>new Response(header+'\n'+fixtureRows.slice(0,2).join('\n')),()=>new Response(header+'\n"unterminated')]) {
  const env=seed(t);let calls=0;
  await assert.rejects(runRegisterRefresh(env,async()=>++calls===1?page(old.source_url):response(),()=>now));
  assert.equal(calls,2);assert.equal(metadata(env).checked_at,old.checked_at);assert.equal(metadata(env).snapshot,old.snapshot);
 }
});
test('same URL and count with changed rating stages a complete new snapshot',{timeout:60000},async t=>{
 const env=completeSeed(t),rows=[...fixtureRows];rows[0]=rows[0].replace('(A rating)','(B rating)');
 const feed=newFeed(old.source_url,rows),result=await runRegisterRefresh(env,feed.fetcher,()=>now);
 assert.equal(result.imported,100000);assert.notEqual(metadata(env).snapshot,'old');
 assert.equal(env.sql.prepare('SELECT ratings FROM sponsors WHERE snapshot=? AND name=?').get(metadata(env).snapshot,'Fictional QA Employer 0').ratings,'["Worker (B rating)"]');
 assert.equal(env.sql.prepare("SELECT count(*) n FROM sponsors WHERE snapshot='old'").get().n,100000);
});
test('comparison requires every field and a complete unique set',async t=>{
 const env=seed(t),row=env.sql.prepare('SELECT * FROM sponsors').get();
 const key='fictional retained employer|cardiff|',records=new Map([[key,row]]);
 assert.equal(await sameRegisterSnapshot(env.DB,'old',records),true);
 for(const field of ['id','name','city','county','ratings','routes','skilled']) {
   assert.equal(await sameRegisterSnapshot(env.DB,'old',new Map([[key,{...row,[field]:'changed'}]])),false,field);
 }
 assert.equal(await sameRegisterSnapshot(env.DB,'missing',records),false);
 assert.equal(await sameRegisterSnapshot(env.DB,'old',new Map()),false);
});
test('busy, replaced and expired ownership or newer metadata cannot be activated by an old check',{timeout:60000},async t=>{
 const busy=seed(t);busy.sql.prepare("INSERT INTO feed_locks VALUES('worker-register','other',?)").run(now+60000);
 assert.match((await runRegisterRefresh(busy,()=>{throw Error('must not fetch');},()=>now)).skipped,/in progress/);
 const env=completeSeed(t),winner={...old,refresh_error:'newer decision',checked_at:stamp};
 for(const scenario of ['metadata','owner','expired']) {
   env.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify(old));
   env.sql.exec("DELETE FROM feed_locks");
   const feed=newFeed(old.source_url);
   const result=await runRegisterRefresh(env,async url=>{
     if(url===old.source_url) {
       if(scenario==='metadata')env.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify(winner));
       if(scenario==='owner')env.sql.exec("UPDATE feed_locks SET owner='winner'");
       if(scenario==='expired')env.sql.exec("UPDATE feed_locks SET expires=0");
     }
     return feed.fetcher(url);
   },()=>now);
   assert.match(result.skipped,/changed or ownership expired/);
   assert.deepEqual(metadata(env),scenario==='metadata'?winner:old);
   if(scenario==='owner')assert.equal(env.sql.prepare("SELECT owner FROM feed_locks").get().owner,'winner');
 }
});
test('actual complete import plus later cleanup failure cannot be reported as a pre-publication failure',{timeout:60000},async t=>{
 const env=seed(t),feed=newFeed();intercept(env,q=>q.startsWith('DELETE FROM sponsors'),()=>{throw Error('D1_ERROR: confidential database detail');});
 await assert.rejects(runRegisterRefresh(env,feed.fetcher,()=>now),/snapshot_cleanup, database_error/);
 const saved=metadata(env);assert.equal(feed.calls(),2);assert.notEqual(saved.snapshot,'old');assert.equal(saved.employers,100000);assert.equal(env.sql.prepare('SELECT count(*) n FROM sponsors WHERE snapshot=?').get(saved.snapshot).n,100000);
 assert.equal(saved.refresh_failure.publication,'confirmed');assert.equal(saved.refresh_failure.stage,'snapshot_cleanup');assert.match(registerFailureDetail(saved),/activated before/);assert.doesNotMatch(JSON.stringify(saved),/confidential/);
 assert.equal(env.sql.prepare("SELECT count(*) n FROM sponsors WHERE snapshot='old'").get().n,1);
});
test('lost activation acknowledgement stays uncertain and does not rerun or clean snapshots',{timeout:60000},async t=>{
 const env=seed(t),feed=newFeed();intercept(env,q=>q.startsWith("INSERT INTO metadata(key,value)"),async run=>{await run();throw Error('D1_ERROR: response lost');});
 await assert.rejects(runRegisterRefresh(env,feed.fetcher,()=>now),/activation, database_error/);
 const saved=metadata(env);assert.equal(feed.calls(),2);assert.notEqual(saved.snapshot,'old');assert.equal(saved.refresh_failure.publication,'uncertain');assert.match(registerFailureDetail(saved),/reconcile/);assert.equal(env.sql.prepare("SELECT count(*) n FROM sponsors WHERE snapshot='old'").get().n,1);
});
test('older in-flight failures and compare-and-set races cannot overwrite a later successful snapshot',async t=>{
 const env=seed(t),newer={...old,snapshot:'newer',checked_at:new Date(now+1000).toISOString()};
 await assert.rejects(runRegisterRefresh(env,async()=>{env.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify(newer));throw Error('upstream');},()=>now));assert.deepEqual(metadata(env),newer);
 const raced=seed(t);intercept(raced,q=>q.includes("AND value=?"),async run=>{raced.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify(newer));return run();});
 await assert.rejects(runRegisterRefresh(raced,async()=>{throw Error('upstream');},()=>now));assert.deepEqual(metadata(raced),newer);
});
test('diagnostic storage failure never hides the refresh failure or marks old data healthy',async t=>{
 const env=seed(t);intercept(env,q=>q.includes('AND value=?'),()=>{throw Error('D1_ERROR: unavailable');});
 await assert.rejects(runRegisterRefresh(env,async()=>new Response(null,{status:500}),()=>now),/publication, source_unavailable/);assert.deepEqual(metadata(env),old);
 assert.equal(registerFailureCode(Error('secret account SQL command')),'unexpected_error');assert.doesNotMatch(registerFailureDetail({refresh_failure:{stage:'PRIVATE STAGE',publication:'confirmed'}}),/PRIVATE/);
});
test('actual Worker and D1 cannot mistake same-URL publication for a complete CSV check',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import {runRegisterRefresh} from './worker/register-refresh.js';export default {async fetch(r,e){try{return Response.json(await runRegisterRefresh(e));}catch{return new Response('failed',{status:503});}}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let unavailable=true,calls=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-register-refresh'},outboundService:req=>{calls++;return unavailable?new Response('unavailable',{status:503}):req.url.endsWith('.csv')?new Response('invalid CSV'):page(old.source_url);}}));
 try {const db=await mf.getD1Database('DB');await db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));await db.exec('CREATE TABLE feed_locks(name TEXT PRIMARY KEY,owner TEXT NOT NULL,expires INTEGER NOT NULL);');await db.prepare('INSERT INTO metadata VALUES(?,?)').bind('register',JSON.stringify(old)).run();
  assert.equal((await mf.dispatchFetch('https://fixture.test/')).status,503);let saved=JSON.parse((await db.prepare("SELECT value FROM metadata WHERE key='register'").first()).value);assert.equal(saved.snapshot,old.snapshot);assert.equal(saved.checked_at,old.checked_at);assert.equal(saved.refresh_failure.stage,'publication');assert.equal(calls,1);
  unavailable=false;assert.equal((await mf.dispatchFetch('https://fixture.test/')).status,503);saved=JSON.parse((await db.prepare("SELECT value FROM metadata WHERE key='register'").first()).value);assert.equal(saved.checked_at,old.checked_at);assert.equal(saved.refresh_failure.stage,'validation');assert.equal(calls,3);
 }finally{await mf.dispose();}
});

test('actual D1 comparison seeks bounded pages and detects a final-page change without directory writes',{timeout:60000},async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-04',cf:false,d1Databases:{DB:'fictional-worker-comparison'}}));
 try {
  const db=await mf.getD1Database('DB');await db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  await db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<10001)
    INSERT INTO sponsors SELECT printf('%024x',i),'retained','Fictional '||i,'Cardiff','','["A"]','["Skilled Worker"]',1 FROM n`).run();
  const records=new Map(Array.from({length:10001},(_,i)=>['fictional '+(i+1)+'|cardiff|',{id:(i+1).toString(16).padStart(24,'0'),name:'Fictional '+(i+1),city:'Cardiff',county:'',ratings:'["A"]',routes:'["Skilled Worker"]',skilled:1}]));
  let reads=0,writes=0,queries=0;
  const DB={prepare(query){const stmt=db.prepare(query);return {bind(...args){const bound=stmt.bind(...args);return {async all(){const result=await bound.all();queries++;reads+=result.meta.rows_read;writes+=result.meta.rows_written;return result;}};}};}};
  assert.equal(await sameRegisterSnapshot(DB,'retained',records),true);
  assert.equal(queries,2);assert.equal(writes,0);assert.ok(reads<30010,String(reads));
  console.log(JSON.stringify({fixture:'10001 fictional rows across two pages',queries,rows_read:reads,rows_written:writes}));
  await db.prepare("UPDATE sponsors SET ratings='[\"B\"]' WHERE snapshot='retained' AND id=?").bind((10001).toString(16).padStart(24,'0')).run();
  assert.equal(await sameRegisterSnapshot(DB,'retained',records),false);
 }finally{await mf.dispose();}
});
