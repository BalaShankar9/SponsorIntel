import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {database} from './research-db.mjs';
import {runRegisterRefresh} from '../worker/register-refresh.js';
import {registerFailureCode,registerFailureDetail} from '../worker/register-health.js';
const now=Date.parse('2026-10-15T07:15:00Z'),stamp=new Date(now).toISOString();
const old={snapshot:'old',source_date:'2026-10-13',source_url:'https://assets.publishing.service.gov.uk/media/test/register-2026-10-13.csv',checked_at:'2026-10-14T07:15:00Z',employers:100000,refresh_error:null};
const source='https://assets.publishing.service.gov.uk/media/test/register-2026-10-14.csv';
const page=url=>new Response('<a href="'+url+'">Worker register</a>');
const metadata=env=>JSON.parse(env.sql.prepare("SELECT value FROM metadata WHERE key='register'").get().value);
function seed(t){const env=database(t);env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register',JSON.stringify(old));env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run('0'.repeat(24),'old','Fictional retained employer','Cardiff','','["Worker (A rating)"]','["Skilled Worker"]',1);return env;}
function intercept(env,match,action){const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=query=>{const stmt=prepare(query);if(match(query)){const run=stmt.run.bind(stmt);stmt.run=()=>action(run,query);}return stmt;};}
function newFeed(){let calls=0;return {fetcher:async url=>{calls++;if(calls===1)return page(source);assert.equal(url,source);let rows='Organisation Name,Town/City,County,Type & Rating,Route\n';for(let i=0;i<100000;i++)rows+='Fictional QA Employer '+i+',Cardiff,,Worker (A rating),Skilled Worker\n';return new Response(rows);},calls:()=>calls};}

test('source and validation failures preserve the old snapshot and retain only bounded diagnostics',async t=>{
 for(const [response,stage,code] of [[new Response('bad',{status:503}),'publication','source_unavailable'],[page('https://example.invalid/wrong.csv'),'publication','invalid_source']]){
  const env=seed(t);await assert.rejects(runRegisterRefresh(env,async()=>response,()=>now),/Register refresh failed/);
  const saved=metadata(env);assert.equal(saved.snapshot,old.snapshot);assert.equal(saved.checked_at,old.checked_at);assert.equal(saved.source_date,old.source_date);assert.deepEqual(saved.refresh_failure,{stage,code,started_at:stamp,failed_at:stamp,publication:'not_attempted',source_date:null});
 }
 const env=seed(t);let calls=0;await assert.rejects(runRegisterRefresh(env,async()=>++calls===1?page(source):new Response('Wrong,header\n'),()=>now),/validation, invalid_register/);assert.equal(calls,2);assert.equal(metadata(env).snapshot,'old');
});
test('a genuine unchanged source check clears old failure diagnostics without importing',async t=>{
 const env=seed(t);env.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify({...old,refresh_error:'old error',refresh_failure:{stage:'publication'}}));let calls=0;
 assert.deepEqual(await runRegisterRefresh(env,async()=>{calls++;return page(old.source_url);},()=>now),{unchanged:true});
 assert.equal(calls,1);const saved=metadata(env);assert.equal(saved.checked_at,stamp);assert.equal(saved.refresh_error,null);assert.equal(saved.refresh_failure,null);assert.equal(saved.snapshot,old.snapshot);assert.equal(env.sql.prepare('SELECT count(*) n FROM sponsors').get().n,1);
});
test('actual complete import plus later cleanup failure cannot be reported as a pre-publication failure',{timeout:60000},async t=>{
 const env=seed(t),feed=newFeed();intercept(env,q=>q.startsWith('DELETE FROM sponsors'),()=>{throw Error('D1_ERROR: confidential database detail');});
 await assert.rejects(runRegisterRefresh(env,feed.fetcher,()=>now),/snapshot_cleanup, database_error/);
 const saved=metadata(env);assert.equal(feed.calls(),2);assert.notEqual(saved.snapshot,'old');assert.equal(saved.employers,100000);assert.equal(env.sql.prepare('SELECT count(*) n FROM sponsors WHERE snapshot=?').get(saved.snapshot).n,100000);
 assert.equal(saved.refresh_failure.publication,'confirmed');assert.equal(saved.refresh_failure.stage,'snapshot_cleanup');assert.match(registerFailureDetail(saved),/activated before/);assert.doesNotMatch(JSON.stringify(saved),/confidential/);
 assert.equal(env.sql.prepare("SELECT count(*) n FROM sponsors WHERE snapshot='old'").get().n,1);
});
test('lost activation acknowledgement stays uncertain and does not rerun or clean snapshots',{timeout:60000},async t=>{
 const env=seed(t),feed=newFeed();intercept(env,q=>q.startsWith("INSERT INTO metadata(key,value) VALUES('register'"),async run=>{await run();throw Error('D1_ERROR: response lost');});
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
test('actual Worker and D1 keep a failed snapshot warning until an unchanged-source success',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import {runRegisterRefresh} from './worker/register-refresh.js';export default {async fetch(r,e){try{return Response.json(await runRegisterRefresh(e));}catch{return new Response('failed',{status:503});}}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let unavailable=true,calls=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-register-refresh'},outboundService:()=>{calls++;return unavailable?new Response('unavailable',{status:503}):page(old.source_url);}}));
 try {const db=await mf.getD1Database('DB');await db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));await db.prepare('INSERT INTO metadata VALUES(?,?)').bind('register',JSON.stringify(old)).run();
  assert.equal((await mf.dispatchFetch('https://fixture.test/')).status,503);let saved=JSON.parse((await db.prepare("SELECT value FROM metadata WHERE key='register'").first()).value);assert.equal(saved.snapshot,old.snapshot);assert.equal(saved.checked_at,old.checked_at);assert.equal(saved.refresh_failure.stage,'publication');assert.equal(calls,1);
  unavailable=false;assert.equal((await mf.dispatchFetch('https://fixture.test/')).status,200);saved=JSON.parse((await db.prepare("SELECT value FROM metadata WHERE key='register'").first()).value);assert.equal(saved.refresh_error,null);assert.equal(saved.refresh_failure,null);assert.equal(calls,2);
 }finally{await mf.dispose();}
});
