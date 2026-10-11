import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

const origin='http://127.0.0.1:8788';
const workspace=marker=>({version:2,profile:{name:'Fictional candidate',cv:marker},applications:[],searches:[{id:'fictional-search',name:'Fictional saved search',q:'engineer'}]});

test('actual Worker/auth/D1 isolates private workspaces, preserves concurrent edits and scopes account removal',{timeout:60000},async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-private-accounts'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('External actions forbidden in account fixture');}}));
 try{
  const db=await mf.getD1Database('DB');
  for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':'198.51.100.49',...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const signUp=async(name)=>{
   const password=crypto.randomUUID(),email=name+'@example.invalid';
   const response=await call('/api/auth/sign-up/email',{method:'POST',body:{name,email,password}});assert.equal(response.status,200);
   const data=await response.json(),cookie=response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.ok(cookie);
   return {id:data.user.id,email,password,cookie};
  };
  const a=await signUp('fictional-one'),b=await signUp('fictional-two');
  assert.equal((await call('/api/career/workspace')).status,401);
  assert.equal((await call('/api/career/workspace',{method:'PUT',body:{revision:0,data:workspace('anonymous marker')}})).status,401);
  const put=(user,revision,marker,requestOrigin=origin)=>call('/api/career/workspace',{method:'PUT',cookie:user.cookie,requestOrigin,body:{revision,user_id:a.id,data:{...workspace(marker),user_id:a.id}}});
  assert.equal((await put(a,0,'Fictional A private CV')).status,200);
  const other=await call('/api/career/workspace?user_id='+a.id,{cookie:b.cookie});assert.equal(other.status,200);assert.equal((await other.json()).data,null);
  assert.equal((await put(b,0,'Fictional B private CV')).status,200);
  assert.equal((await (await call('/api/career/workspace',{cookie:a.cookie})).json()).data.profile.cv,'Fictional A private CV');
  assert.equal((await put(a,1,'Cross-origin replacement','https://untrusted.example')).status,403);
  assert.equal((await put(a,0,'Stale replacement')).status,409);
  const attempts=await Promise.all([put(a,1,'First concurrent edit'),put(a,1,'Second concurrent edit')]);
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  const saved=await (await call('/api/career/workspace',{cookie:a.cookie})).json();assert.equal(saved.revision,2);assert.ok(['First concurrent edit','Second concurrent edit'].includes(saved.data.profile.cv));
  assert.equal(saved.data.user_id,undefined);
  await db.prepare('UPDATE user SET emailVerified=1').run();
  const monitor=async user=>{const r=await call('/api/career/search-notifications',{method:'PUT',cookie:user.cookie,body:{enabled:true,search_id:'fictional-search',user_id:a.id}});assert.equal(r.status,200);return (await r.json()).id;};
  const aMonitor=await monitor(a),bMonitor=await monitor(b);assert.notEqual(aMonitor,bMonitor);
  const crossRead=await call('/api/career/search-notifications',{method:'POST',cookie:b.cookie,body:{monitor_id:aMonitor,as_of:new Date().toISOString(),job_ids:[]}});assert.equal(crossRead.status,404);
  const bInbox=await (await call('/api/career/search-notifications',{cookie:b.cookie})).json();assert.deepEqual(bInbox.monitors.map(m=>m.id),[bMonitor]);
  const codeResponse=await call('/api/career/recovery-code',{method:'POST',cookie:b.cookie,body:{}});assert.equal(codeResponse.status,200);assert.match((await codeResponse.json()).code,/^[a-f0-9]{64}$/);
  const bHash=await db.prepare('SELECT hash FROM recovery_codes WHERE user_id=?').bind(b.id).first();assert.ok(bHash);
  await db.prepare('UPDATE session SET createdAt=? WHERE userId=?').bind(Date.now()-11*60000,b.id).run();
  assert.equal((await call('/api/career/recovery-code',{method:'POST',cookie:b.cookie,body:{}})).status,403);
  assert.equal((await call('/api/career/account',{method:'DELETE',cookie:b.cookie,body:{}})).status,403);
  assert.deepEqual(await db.prepare('SELECT hash FROM recovery_codes WHERE user_id=?').bind(b.id).first(),bHash);
  await db.prepare('UPDATE session SET createdAt=? WHERE userId=?').bind(Date.now(),b.id).run();
  assert.equal((await call('/api/career/account',{method:'DELETE',cookie:b.cookie,requestOrigin:'https://untrusted.example',body:{}})).status,403);
  const aBefore=await db.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(a.id).first();
  const deletion=await call('/api/career/account',{method:'DELETE',cookie:b.cookie,body:{user_id:a.id}});assert.equal(deletion.status,200);
  for(const [table,column] of [['user','id'],['account','userId'],['session','userId'],['career_workspaces','user_id'],['recovery_codes','user_id'],['search_monitors','user_id']])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${column}=?`).bind(b.id).first()).n,0,table);
  assert.deepEqual(await db.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(a.id).first(),aBefore);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM search_monitors WHERE id=?').bind(aMonitor).first()).n,1);
  assert.equal((await call('/api/career/workspace',{cookie:b.cookie})).status,401);
  assert.equal((await call('/api/career/workspace',{cookie:a.cookie})).status,200);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);assert.equal(outbound,0);
 }finally{await mf.dispose();}
});

test('actual recovery code is single-use, revokes existing sessions and preserves the saved workspace',{timeout:60000},async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-recovery'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external account operations');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':'198.51.100.50',...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const password=crypto.randomUUID(),email='fictional-recovery@example.invalid';const signup=await call('/api/auth/sign-up/email',{method:'POST',body:{name:'Fictional recovery',email,password}});assert.equal(signup.status,200);
  const cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),user=(await signup.json()).user;
  const saved=await call('/api/career/workspace',{method:'PUT',cookie,body:{revision:0,data:workspace('Fictional preserved CV')}});assert.equal(saved.status,200);
  const another=await call('/api/auth/sign-in/email',{method:'POST',body:{email,password}});assert.equal(another.status,200);const anotherCookie=another.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  const recovery=await call('/api/career/recovery-code',{method:'POST',cookie,body:{}});assert.equal(recovery.status,200);const {code:oldCode}=await recovery.json();const rotated=await call('/api/career/recovery-code',{method:'POST',cookie,body:{}});assert.equal(rotated.status,200);const {code}=await rotated.json();assert.notEqual(code,oldCode);assert.equal((await call('/api/recover',{method:'POST',body:{code:oldCode,password:crypto.randomUUID()}})).status,400);const before=await db.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(user.id).first();
  const newPassword=crypto.randomUUID();assert.equal((await call('/api/recover',{method:'POST',requestOrigin:'https://untrusted.example',body:{code,password:newPassword}})).status,403);
  const resets=await Promise.all([0,1].map(()=>call('/api/recover',{method:'POST',body:{code,password:newPassword}})));assert.deepEqual(resets.map(r=>r.status).sort(),[200,400]);
  for(const oldCookie of [cookie,anotherCookie])assert.equal((await call('/api/career/workspace',{cookie:oldCookie})).status,401);
  assert.equal((await call('/api/recover',{method:'POST',body:{code,password:crypto.randomUUID()}})).status,400);
  assert.equal((await call('/api/auth/sign-in/email',{method:'POST',body:{email,password}})).status,401);
  const signedIn=await call('/api/auth/sign-in/email',{method:'POST',body:{email,password:newPassword}});assert.equal(signedIn.status,200);
  const freshCookie=signedIn.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');const read=await call('/api/career/workspace',{cookie:freshCookie});assert.equal(read.status,200);assert.equal((await read.json()).data.profile.cv,'Fictional preserved CV');
  assert.deepEqual(await db.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(user.id).first(),before);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM recovery_codes WHERE user_id=?').bind(user.id).first()).n,0);
  assert.equal(outbound,0);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{await mf.dispose();}
});

for(const minify of [false,true]) test('account removal blocks already-authenticated writes ('+(minify?'minified':'ordinary')+' Worker)',{timeout:60000},async()=>{
 // A local service supplies the timing barrier; it never reaches the network.
 // Authentication, deletion and competing SQL still run in the real Worker/D1.
 const observer=await build({stdin:{contents:`import worker from './worker/index.js';export default {async fetch(r,e,c){const p=new URL(r.url).pathname;
 const target=p==='/api/career/workspace'&&r.method==='PUT'?'career_workspaces':p==='/api/career/recovery-code'&&r.method==='POST'?'recovery_codes':null;
 if(target){const wrap=s=>({bind:(...v)=>wrap(s.bind(...v)),run:async()=>{await fetch('https://timing-fixture.invalid/'+target);return s.run();}});
 const DB={prepare:q=>q.startsWith('INSERT INTO '+target)?wrap(e.DB.prepare(q)):e.DB.prepare(q),batch:s=>e.DB.batch(s),exec:s=>e.DB.exec(s)};
 return worker.fetch(r,{...e,DB},c);}return worker.fetch(r,e,c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,minify,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let gate=null,barriers=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:observer.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-delete-race'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:async request=>{
  assert.equal(request.url,'https://timing-fixture.invalid/'+gate.table);barriers++;gate.ready();await gate.wait;return new Response('released');
 }}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const observations=[];
  for(const kind of ['workspace','recovery']){
   const headers={Origin:origin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':kind==='workspace'?'198.51.100.51':'198.51.100.52'};
   const signup=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers,body:JSON.stringify({name:'Fictional delayed '+kind,email:'fictional-delayed-'+kind+'@example.invalid',password:crypto.randomUUID()})});assert.equal(signup.status,200);
   const {user}=await signup.json(),cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   let ready,release;const table=kind==='workspace'?'career_workspaces':'recovery_codes';
   gate={table,arrived:new Promise(x=>ready=x),wait:new Promise(x=>release=x),ready:()=>ready(),release:()=>release()};
   const path=kind==='workspace'?'/api/career/workspace':'/api/career/recovery-code';
   const pending=mf.dispatchFetch(origin+path,{method:kind==='workspace'?'PUT':'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify(kind==='workspace'?{revision:0,data:workspace('Fictional delayed CV that must not survive deletion')}:{})});
   let deadline;
   try{await Promise.race([gate.arrived,pending.then(async r=>{throw Error('Write returned before barrier: '+r.status+' '+await r.text());}),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Local write barrier did not arrive')),15000);})]);}
   finally{clearTimeout(deadline);}
   const deletion=await mf.dispatchFetch(origin+'/api/career/account',{method:'DELETE',headers:{...headers,Cookie:cookie},body:'{}'});assert.equal(deletion.status,200);
   gate.release();const result=await pending;
   observations.push({kind,status:result.status,retained:(await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`).bind(user.id).first()).n});
   assert.equal((await db.prepare('SELECT COUNT(*) n FROM user WHERE id=?').bind(user.id).first()).n,0);
  }
  assert.equal(barriers,2);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  assert.deepEqual(observations, [{kind:'workspace',status:409,retained:0},{kind:'recovery',status:401,retained:0}]);
 }finally{gate?.release();await mf.dispose();}
});
