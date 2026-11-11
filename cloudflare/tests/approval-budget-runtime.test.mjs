import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('owner approval probes share the source cap across providers, failures and competing requests', {timeout:30000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {probeReviewedBoard} from './worker/admin.js';
 let calls=0;
 export default {async fetch(request,env){
  const u=new URL(request.url),provider=u.searchParams.get('provider');
  try{await probeReviewedBoard(env.DB,{provider},async()=>{
   calls++;
   const day=new Date().toISOString().slice(0,10);
   const reserved=await env.DB.prepare('SELECT requests FROM agent_daily_budget WHERE day=?').bind(day).first();
   if(!reserved?.requests)throw Error('Provider started before reservation');
   if(u.searchParams.has('fail'))throw Error('Fictional provider failed');
   return [];
  });return Response.json({ok:true,calls});}
  catch(error){return Response.json({ok:false,error:error.message,calls});}
 }};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'approval-budget-isolated'},outboundService:()=>{assert.fail('No provider network is permitted');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema(),day=new Date().toISOString().slice(0,10);
  for(const type of ['table','index','view','trigger']){
   const statements=schema.objects.filter(x=>x.type===type).map(object=>db.prepare(object.sql));
   if(statements.length)await db.batch(statements);
  }
  const count=async()=>(await db.prepare('SELECT requests FROM agent_daily_budget WHERE day=?').bind(day).first())?.requests;
  const invoke=async(provider,fail=false)=>(await mf.dispatchFetch('http://localhost/?provider='+provider+(fail?'&fail=1':''))).json();
  let expected=0;
  for(const [provider,cost] of [['greenhouse',1],['lever',1],['ashby',1],['teaching-vacancies',24]]){
   const result=await invoke(provider);assert.equal(result.ok,true,provider+': '+result.error);
   expected+=cost;assert.equal(await count(),expected);
  }
  // Only fictional isolated counters are seeded. No production reset is used.
  await db.prepare('UPDATE agent_daily_budget SET requests=499 WHERE day=?').bind(day).run();
  const race=await Promise.all([invoke('greenhouse'),invoke('lever')]);
  assert.equal(race.filter(r=>r.ok).length,1);
  assert.match(race.find(r=>!r.ok).error,/allowance/);
  assert.equal(await count(),500);
  const denied=await invoke('ashby');assert.equal(denied.ok,false);assert.equal(denied.calls,5);
  assert.equal(await count(),500);
  await db.prepare('UPDATE agent_daily_budget SET requests=499 WHERE day=?').bind(day).run();
  const failed=await invoke('ashby',true);assert.match(failed.error,/Fictional provider failed/);assert.equal(failed.calls,6);
  assert.equal(await count(),500);
  const repeated=await invoke('ashby',true);assert.match(repeated.error,/allowance/);assert.equal(repeated.calls,6);
  assert.equal(await count(),500);
  await db.prepare('UPDATE agent_daily_budget SET requests=477 WHERE day=?').bind(day).run();
  const school=await invoke('teaching-vacancies');assert.match(school.error,/allowance/);assert.equal(school.calls,6);
  assert.equal(await count(),477);
 }finally{await mf.dispose();}
});
