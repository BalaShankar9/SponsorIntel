import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual Worker/auth/D1 protects aggregate observations, preserves concurrent replay and makes no outbound call',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import {adminAPI} from './worker/admin.js';import {authFor} from './worker/auth.js';export default {fetch(r,e){return new URL(r.url).pathname.startsWith('/api/auth/')?authFor(r,e).handler(r):adminAPI(r,e);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const origin='http://127.0.0.1:8788';let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'marketing-performance-isolated'},bindings:{AUTH_SECRET:'fictional-local-test-secret-not-a-production-credential',APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external services allowed');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const post=(path,body,cookie='',extra={})=>mf.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extra},body:JSON.stringify(body)});
  const signup=async email=>{const r=await post('/api/auth/sign-up/email',{name:'Fictional test owner',email,password:'Fictional-testing-253!'});assert.equal(r.status,200,await r.clone().text());const b=await r.json();return {id:b.user.id,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const owner=await signup('owner@example.invalid'),member=await signup('member@example.invalid');
  await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.id,new Date().toISOString()).run();
  const path='/api/admin/marketing/performance',stamp=new Date().toISOString();
  const input={request_key:'fictional-observation',destination:'linkedin-company',account:'146710167',provider:'linkedin-native',identity_checked:true,title:'Fictional observed post',post_url:'https://www.linkedin.com/feed/update/urn:li:share:123456/',observed_at:stamp,window_type:'lifetime',window_end:stamp,timezone:'Europe/London',availability:'reported',assessment_type:'agent_assisted',metrics:{impressions:4,link_clicks:0},evidence_url:'https://www.linkedin.com/company/146710167/admin/page-posts/published/',note:'Fictional isolated runtime fixture, no real performance claim.'};
  for(const cookie of ['',member.cookie]){
   assert.equal((await mf.dispatchFetch(origin+path,{headers:{Cookie:cookie}})).status,403);
   assert.equal((await post(path,input,cookie)).status,403);
  }
  assert.equal((await post(path,input,owner.cookie,{Origin:'https://other.example'})).status,403);
  const requests=await Promise.all([post(path,input,owner.cookie),post(path,input,owner.cookie)]);
  for(const r of requests)assert.equal(r.status,201,await r.clone().text());
  const results=await Promise.all(requests.map(r=>r.json()));assert.equal(results[0].id,results[1].id);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM marketing_performance').first()).n,1);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM admin_audit').first()).n,1);
  const race=await Promise.all([1,2].map(n=>post(path,{...input,request_key:'correction-'+n,supersedes:results[0].id,metrics:{impressions:n}},owner.cookie)));
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
  const view=await(await mf.dispatchFetch(origin+path,{headers:{Cookie:owner.cookie}})).json();assert.equal(view.items.length,2);assert.equal(view.items.filter(x=>x.corrected).length,1);assert.doesNotMatch(JSON.stringify(view),/request_key|request_hash|owner@example|member@example/);
  const checks=await Promise.all(Array.from({length:8},(_,i)=>mf.dispatchFetch(origin+path,{headers:{Cookie:i%2?owner.cookie:member.cookie}})));
  assert.deepEqual(checks.map(r=>r.status),[403,200,403,200,403,200,403,200]);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM marketing_receipts').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_research_budget').first()).n,0);assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
