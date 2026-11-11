import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {emptyWorkbook,parseWorkbook} from '../shared/founder.js';

const origin='http://127.0.0.1:8788';
test('actual Worker/auth/D1 founder saving isolates accounts, atomically replays, rejects races and cascades deletion',{timeout:60000},async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-founder-accounts'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin,FOUNDER_SAVING_ENABLED:'true'},outboundService:()=>{outbound++;throw Error('No external actions in fictional founder fixture');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':'198.51.100.73',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const signup=async name=>{const response=await call('/api/auth/sign-up/email',{method:'POST',body:{name,email:name+'@example.invalid',password:crypto.randomUUID()}});assert.equal(response.status,200);return {id:(await response.json()).user.id,cookie:response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const a=await signup('fictional-founder-a'),b=await signup('fictional-founder-b'),path='/api/career/founder-workspace';
  assert.equal((await call(path)).status,401);assert.equal((await call(path,{method:'PUT',body:{}})).status,401);
  const payload=(user,revision,text)=>{const workbook=emptyWorkbook();workbook.notes.innovation=text;return {accountId:user.id,revision,request_key:crypto.randomUUID(),workbook};};
  const put=(user,body,requestOrigin=origin)=>call(path,{method:'PUT',cookie:user.cookie,body,requestOrigin});
  const one=payload(a,0,'Fictional private A evidence'),saved=await put(a,one);assert.equal(saved.status,200);assert.match(saved.headers.get('Cache-Control'),/no-store/);assert.equal((await saved.json()).revision,1);
  assert.equal((await put(b,one)).status,409);assert.equal((await put(a,payload(a,1,'CSRF'),'https://untrusted.example')).status,403);
  assert.equal((await (await call(path+'?accountId='+a.id,{cookie:b.cookie})).json()).workbook.notes.innovation,'');
  const exported=await (await call(path,{cookie:a.cookie})).json();assert.deepEqual(parseWorkbook(JSON.stringify(exported.workbook)),one.workbook);
  const replay=await (await put(a,one)).json();assert.equal(replay.replayed,true);assert.equal(replay.revision,1);
  assert.equal((await put(a,{...one,workbook:emptyWorkbook()})).status,409);
  assert.equal((await put(a,{...payload(a,1,'invalid'),extra:'not accepted'})).status,400);
  assert.equal((await put(a,{...payload(a,1,'invalid'),workbook:{...emptyWorkbook(),notes:{}}})).status,400);
  const attempts=await Promise.all([put(a,payload(a,1,'First concurrent A note')),put(a,payload(a,1,'Second concurrent A note'))]);assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);
  assert.equal((await (await put(a,one)).json()).revision,1);assert.equal((await (await call(path,{cookie:a.cookie})).json()).revision,2);
  const before=await db.prepare('SELECT * FROM founder_workspaces WHERE user_id=?').bind(a.id).first();
  await db.prepare("CREATE TRIGGER fictional_receipt_failure BEFORE INSERT ON founder_save_receipts BEGIN SELECT RAISE(ABORT,'fictional atomic failure'); END").run();
  const atomic=payload(a,2,'Must not survive failed receipt');const failure=await put(a,atomic);assert.equal(failure.status,500);assert.ok(!(await failure.text()).includes('Must not survive'));
  assert.deepEqual(await db.prepare('SELECT * FROM founder_workspaces WHERE user_id=?').bind(a.id).first(),before);
  await db.prepare('DROP TRIGGER fictional_receipt_failure').run();assert.equal((await put(a,atomic)).status,200);
  assert.equal((await put(b,payload(b,0,'Fictional B independent workbook'))).status,200);
  const aBefore=await db.prepare('SELECT * FROM founder_workspaces WHERE user_id=?').bind(a.id).first();
  await db.prepare('UPDATE session SET createdAt=? WHERE userId=?').bind(Date.now(),b.id).run();assert.equal((await call('/api/career/account',{method:'DELETE',cookie:b.cookie,body:{}})).status,200);
  for(const table of ['founder_workspaces','founder_save_receipts'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`).bind(b.id).first()).n,0);
  assert.deepEqual(await db.prepare('SELECT * FROM founder_workspaces WHERE user_id=?').bind(a.id).first(),aBefore);assert.equal((await call(path,{cookie:b.cookie})).status,401);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);assert.equal(outbound,0);
 }finally{await mf.dispose();}
});

test('an authenticated founder save cannot recreate data after concurrent account deletion',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import worker from './worker/index.js';export default {async fetch(r,e,c){if(new URL(r.url).pathname==='/api/career/founder-workspace'&&r.method==='PUT'){
 let finalWrite=false;const DB={prepare:q=>{if(q.includes('INSERT INTO founder_save_receipts'))finalWrite=true;return e.DB.prepare(q);},batch:async statements=>{if(finalWrite)await fetch('https://founder-timing.invalid/batch');return e.DB.batch(statements);},exec:q=>e.DB.exec(q)};return worker.fetch(r,{...e,DB},c);}return worker.fetch(r,e,c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,minify:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let ready,release;const arrived=new Promise(r=>ready=r),wait=new Promise(r=>release=r);let barriers=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-founder-delete-race'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin,FOUNDER_SAVING_ENABLED:'true'},outboundService:async request=>{assert.equal(request.url,'https://founder-timing.invalid/batch');barriers++;ready();await wait;return new Response('released');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const headers={Origin:origin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':'198.51.100.74'};
  const signup=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers,body:JSON.stringify({name:'Fictional delayed founder',email:'fictional-delayed-founder@example.invalid',password:crypto.randomUUID()})});assert.equal(signup.status,200);
  const {user}=await signup.json(),cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),workbook=emptyWorkbook();workbook.notes.innovation='Fictional delayed private idea';
  const pending=mf.dispatchFetch(origin+'/api/career/founder-workspace',{method:'PUT',headers:{...headers,Cookie:cookie},body:JSON.stringify({accountId:user.id,revision:0,request_key:crypto.randomUUID(),workbook})});
  let deadline;try{await Promise.race([arrived,pending.then(async r=>{throw Error('Write ended before barrier '+r.status);}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Founder write barrier did not arrive')),15000);})]);}finally{clearTimeout(deadline);}
  const deletion=await mf.dispatchFetch(origin+'/api/career/account',{method:'DELETE',headers:{...headers,Cookie:cookie},body:'{}'});assert.equal(deletion.status,200);release();assert.equal((await pending).status,409);
  for(const table of ['founder_workspaces','founder_save_receipts'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`).bind(user.id).first()).n,0);
  assert.equal(barriers,1);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{release();await mf.dispose();}
});

test('Founder saving remains disabled without its explicit deployment flag and does not query the new schema',async()=>{
 const {founderWorkspaceAPI}=await import('../worker/founder-workspace.js');
 for(const method of ['GET','PUT']){
  const response=await founderWorkspaceAPI(new Request(origin+'/api/career/founder-workspace',{method}),{DB:{prepare(){throw Error('Disabled route queried its schema');}}},{id:'fictional'});
  assert.equal(response.status,503);assert.equal((await response.json()).available,false);
 }
});
