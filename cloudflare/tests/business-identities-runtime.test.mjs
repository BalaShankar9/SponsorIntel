import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
test('real Worker auth, D1 and public search enforce reviewed business boundaries',{timeout:60000},async()=>{
 const origin='http://127.0.0.1:8788';
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-business-identities'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external calls in business identity test');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const call=(path,{cookie,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':'198.51.100.48',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const signup=async name=>{const r=await call('/api/auth/sign-up/email',{body:{name,email:name+'@example.invalid',password:crypto.randomUUID()}});assert.equal(r.status,200);const data=await r.json();return {id:data.user.id,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const owner=await signup('fictional-business-owner'),member=await signup('fictional-business-member');await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.id,new Date().toISOString()).run();
  const now=Date.now(),stamp=new Date(now).toISOString(),sponsor='a'.repeat(24),meta={snapshot:'fixture',source_date:stamp.slice(0,10),checked_at:stamp};
  await db.prepare('INSERT INTO metadata VALUES(?,?)').bind('register',JSON.stringify(meta)).run();await db.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').bind(sponsor,'fixture','Fictional Legal Ltd','Cardiff','',JSON.stringify(['Worker (A rating)']),JSON.stringify(['Skilled Worker']),1).run();
  const f={identity_id:crypto.randomUUID(),revision:0,sponsor_id:sponsor,sponsor_name:'Fictional Legal Ltd',business_name:'Harbour Fictional',relationship:'trading_name',website:'https://fictional.example/',careers_url:'',activity:'',locations:'',official_identifier:'',evidence_url:'https://fictional.example/legal',evidence_summary:'Fictional source identifies the trading name and exact legal company.',rights_basis:'Fictional test source; no commercial reuse decision made.',observed_at:stamp,review_due_at:new Date(now+86400000).toISOString(),state:'approved',review_method:'agent_assisted',note:'Private fictional reason never shown to a public reader.',request_key:crypto.randomUUID()},path='/api/admin/business-identities';
  for(const cookie of [undefined,member.cookie])for(const body of [undefined,f])assert.equal((await call(path,{cookie,body})).status,403);
  assert.equal((await call(path,{cookie:owner.cookie,body:f,requestOrigin:'https://untrusted.example'})).status,403);
  assert.equal((await call(path,{cookie:owner.cookie,body:f})).status,200);
  const publicPath='/api/business-identities?sponsor_id='+sponsor;
  let r=await call(publicPath);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);let publicData=await r.json();assert.equal(publicData.items[0].business_name,'Harbour Fictional');assert.doesNotMatch(JSON.stringify(publicData),/Private fictional|rights_basis|request_hash|request_key/);
  const search=()=>call('/api/sponsors?q=Harbour');assert.equal((await(await search()).json()).total,1);
  const held={...f,revision:1,state:'held',request_key:crypto.randomUUID()};const competing={...held,state:'withdrawn',request_key:crypto.randomUUID()};const writes=await Promise.all([call(path,{cookie:owner.cookie,body:held}),call(path,{cookie:owner.cookie,body:competing})]);assert.deepEqual(writes.map(x=>x.status).sort(),[200,409]);
  assert.equal((await(await search()).json()).total,0);assert.equal((await(await call(publicPath)).json()).items.length,0);
  const replay=await(await call(path,{cookie:owner.cookie,body:f})).json();assert.equal(replay.replayed,true);assert.equal(replay.saved_revision,1);assert.equal(replay.review.revision,2);assert.notEqual(replay.review.state,'approved');
  const newProof={...f,revision:2,observed_at:new Date().toISOString(),request_key:crypto.randomUUID()};assert.equal((await call(path,{cookie:owner.cookie,body:newProof})).status,200);
  await db.prepare("UPDATE metadata SET value=? WHERE key='register'").bind(JSON.stringify({...meta,checked_at:new Date(now-3*86400000).toISOString()})).run();assert.equal((await(await search()).json()).total,0);assert.equal((await(await call(publicPath)).json()).status,'register_unavailable');
  const history=await(await call(path+'?id='+f.identity_id,{cookie:owner.cookie})).json();assert.equal(history.history.length,3);assert.equal(history.history[0].actor,undefined);
  for(const table of ['agent_daily_budget','agent_research_budget','agent_runs','jobs','employer_boards'])assert.equal((await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
