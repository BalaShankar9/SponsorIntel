import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
test('actual Worker/auth/D1 history is owner-only, isolated by selected run and never invokes providers',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import {adminAPI} from './worker/admin.js';import {authFor} from './worker/auth.js';export default {fetch(r,e){return new URL(r.url).pathname.startsWith('/api/auth/')?authFor(r,e).handler(r):adminAPI(r,e);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const origin='http://127.0.0.1:8788';let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'marketing-history-isolated'},bindings:{AUTH_SECRET:'fictional-local-test-secret-not-a-production-credential',APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external services allowed');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const signup=async email=>{const r=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional test owner',email,password:'Fictional-testing-264!'})});assert.equal(r.status,200);const b=await r.json();return {id:b.user.id,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const owner=await signup('owner@example.invalid'),member=await signup('member@example.invalid');await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.id,new Date().toISOString()).run();
  const id='marketing-2026-10-12',path='/api/admin/marketing/agents/history';
  await db.prepare("INSERT INTO marketing_agent_runs(id,day,state,created_at,policy,models,context,result,calls) VALUES(?,'2026-10-12','held','2026-10-12T00:00:00Z','fictional-old-policy',?,?,?,1)").bind(id,JSON.stringify({writer:{provider:'cloudflare',model:'historical-writer'}}),JSON.stringify({facts:['Fictional retained original']}),JSON.stringify({reason:'Fictional held attempt'})).run();
  await db.prepare("INSERT INTO marketing_agent_steps(run_id,name,role,state,created_at,output) VALUES(?,'plan','writer','failed','2026-10-12T00:01:00Z',?)").bind(id,JSON.stringify({failure:'Fictional failed output',failure_stage:'provider_unconfirmed'})).run();
  const read=(query,cookie)=>mf.dispatchFetch(origin+path+query,{headers:{Cookie:cookie}});
  for(const cookie of ['',member.cookie])for(const query of ['', '?id='+id,'?before='+id])assert.equal((await read(query,cookie)).status,403);
  const list=await(await read('',owner.cookie)).json();assert.equal(list.runs.length,1);assert.equal(list.runs[0].id,id);
  const history=await(await read('?id='+id,owner.cookie)).json();assert.equal(history.run.models.writer.model,'historical-writer');assert.equal(history.steps[0].state,'failed');assert.equal(history.run.context.facts[0],'Fictional retained original');
  const reads=await Promise.all(Array.from({length:6},(_,i)=>read('?id='+id,i%2?member.cookie:owner.cookie)));assert.deepEqual(reads.map(r=>r.status),[200,403,200,403,200,403]);
  assert.equal((await read('?id=marketing-2026-10-13',owner.cookie)).status,404);assert.equal((await read('?id=invalid',owner.cookie)).status,400);
  for(const table of ['agent_research_budget','marketing_receipts','admin_audit'])assert.equal((await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0);
  assert.equal((await db.prepare('SELECT state FROM marketing_agent_runs WHERE id=?').bind(id).first()).state,'held');assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
