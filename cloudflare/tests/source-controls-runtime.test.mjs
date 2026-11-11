import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {BOARDS} from '../worker/job-sources.js';

test('actual Worker/auth/D1 enforces source review versions, receipts, owner privacy and rollback guards',{timeout:60000},async()=>{
 const origin='http://127.0.0.1:8788',source=BOARDS[0].id;
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-source-reviews'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external calls in source-control fixture');}}));
 try{
  const db=await mf.getD1Database('DB');
  const schema=migrationSchema();for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const call=(path,{cookie,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method:body?'POST':'GET',headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':'198.51.100.47',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const signup=async name=>{const r=await call('/api/auth/sign-up/email',{body:{name,email:name+'@example.invalid',password:crypto.randomUUID()}});assert.equal(r.status,200);const data=await r.json();return {id:data.user.id,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const owner=await signup('fictional-source-owner'),member=await signup('fictional-source-member');
  await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.id,new Date().toISOString()).run();
  const path='/api/admin/agents/source';
  const change=(expected_revision,paused,reason)=>({source_id:source,expected_revision,paused,reason,request_key:crypto.randomUUID()});
  const pause=change(0,true,'Fictional private source hold; no external employer action.');
  assert.equal((await call(path,{body:pause})).status,403);
  assert.equal((await call(path,{cookie:member.cookie,body:pause})).status,403);
  assert.equal((await call(path,{cookie:owner.cookie,body:pause,requestOrigin:'https://untrusted.example'})).status,403);
  assert.equal((await call(path,{cookie:owner.cookie,body:{source_id:source,paused:false,reason:'Unversioned old client'}})).status,400);
  assert.equal((await call(path,{cookie:owner.cookie,body:pause})).status,200);
  const resume=change(1,false,'Fictional complete review allowing scheduled source collection.');
  assert.equal((await call(path,{cookie:owner.cookie,body:resume})).status,200);
  const latest=change(2,true,'Fictional later owner hold must survive stale and repeated forms.');
  assert.equal((await call(path,{cookie:owner.cookie,body:latest})).status,200);
  assert.equal((await call(path,{cookie:owner.cookie,body:change(1,false,'Fictional stale source review must not clear the new hold.')})).status,409);
  const replay=await(await call(path,{cookie:owner.cookie,body:resume})).json();assert.equal(replay.replayed,true);assert.equal(replay.current_paused,true);assert.equal(replay.current_revision,3);
  const snap=await(await call('/api/admin/agents',{cookie:owner.cookie})).json();
  const control=snap.sources.find(x=>x.id===source).control;
  assert.equal(control.revision,3);assert.equal(control.history_total,3);assert.deepEqual(control.history.map(h=>h.revision),[3,2,1]);assert.equal(control.history[0].reason,latest.reason);
  assert.equal(JSON.stringify(snap).includes(owner.id),false);
  assert.equal((await call('/api/admin/agents',{cookie:member.cookie})).status,403);
  await assert.rejects(db.prepare("UPDATE agent_source_controls SET paused=0,reason='legacy writer' WHERE source_id=?").bind(source).run(),/review required/);
  await assert.rejects(db.prepare('DELETE FROM source_control_reviews').run(),/append only/);
  await db.prepare('UPDATE agent_source_controls SET failures=1 WHERE source_id=?').bind(source).run();
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM source_control_reviews').first()).n,3);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action IN ('agent_source_paused','agent_source_resumed')").first()).n,3);
  for(const table of ['agent_runs','agent_daily_budget','agent_research_budget','source_collection_progress'])assert.equal((await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
