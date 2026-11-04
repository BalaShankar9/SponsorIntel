import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual Worker and D1 reconcile a committed marketing result after lost acknowledgement',{timeout:30000},async()=>{
 const bundle=await build({stdin:{contents:`import {marketingModelStep} from './worker/marketing-agents.js';let calls=0;
 export default {async fetch(request,env){
  const now=Date.now(),id='fictional-marketing',stamp=new Date(now).toISOString();
  await env.DB.prepare("INSERT INTO marketing_agent_runs(id,day,state,created_at,policy,models) VALUES(?,?,'running',?,'fixture',?) ON CONFLICT DO NOTHING").bind(id,stamp.slice(0,10),stamp,JSON.stringify({writer:{provider:'cloudflare',model:'fictional'}})).run();
  const DB={batch:s=>env.DB.batch(s),prepare:q=>{const s=env.DB.prepare(q);
   if(q.startsWith("UPDATE marketing_agent_steps SET state='completed'")){
    let bound=s;return {bind(...args){bound=s.bind(...args);return this;},async run(){await bound.run();throw Error('Fictional lost acknowledgement');}};
   }return s;}};
  const output=await marketingModelStep({...env,DB},id,'plan','writer','fixture',{},x=>x,async()=>{calls++;return {value:{answer:7},usage:{total_tokens:4,secret:'PRIVATE'}};},now);
  return Response.json({calls,output,step:await env.DB.prepare('SELECT state,output,usage FROM marketing_agent_steps').first(),budget:await env.DB.prepare('SELECT calls FROM agent_research_budget').first()});
 }};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'marketing-completion-isolated'},outboundService:()=>{assert.fail('External I/O forbidden');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  await db.batch([db.prepare("INSERT INTO business_controls(singleton,updated_at) VALUES(1,'2026-10-13T00:00:00Z')"),db.prepare("INSERT INTO marketing_agent_controls(singleton,updated_at) VALUES(1,'2026-10-13T00:00:00Z')")]);
  const first=await(await mf.dispatchFetch('http://localhost/fixture')).json();
  assert.equal(first.calls,1);assert.deepEqual(first.output,{answer:7});assert.equal(first.step.state,'completed');
  assert.equal(first.budget.calls,1);assert.deepEqual(JSON.parse(first.step.usage),{total_tokens:4});assert.doesNotMatch(JSON.stringify(first),/PRIVATE/);
  const again=await(await mf.dispatchFetch('http://localhost/fixture')).json();assert.deepEqual(again,first);
 }finally{await mf.dispose();}
});
