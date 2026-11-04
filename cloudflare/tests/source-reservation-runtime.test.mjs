import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual Worker/D1 rejects an unaffordable collection without spending the other allowance', {timeout:30000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {executeSourceTask} from './worker/agent-operations.js';
 let calls=0;
 export default {async fetch(request,env){const u=new URL(request.url);const result=await executeSourceTask(env,u.searchParams.get('run'),u.searchParams.get('source'),{readBoard:async()=>{calls++;return [];}});return Response.json({result,calls});}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'reservation-isolated'},outboundService:()=>{assert.fail('No provider network is permitted');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema(),now=new Date().toISOString(),day=now.slice(0,10);
  for(const type of ['table','index','view','trigger']){
   const statements=schema.objects.filter(x=>x.type===type).map(object=>db.prepare(object.sql));
   if(statements.length)await db.batch(statements);
  }
  async function seed(id,daily,run){
   await db.batch([
    db.prepare("INSERT INTO agent_daily_budget(day,requests) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET requests=excluded.requests").bind(day,daily),
    db.prepare("INSERT INTO agent_runs(id,trigger_kind,state,created_at,updated_at,requests) VALUES(?,'owner','running',?,?,?)").bind(id,now,now,run),
    db.prepare("INSERT INTO agent_tasks(run_id,source_id,company) VALUES(?,'portmandentex','PortmanDentex')").bind(id),
   ]);
  }
  const invoke=async(run,source)=>(await mf.dispatchFetch('http://localhost/?run='+run+'&source='+source)).json();
  for(const [id,daily,run] of [['daily-limit',499,0],['run-limit',0,149]]){
   await seed(id,daily,run);
   for(let repeat=0;repeat<2;repeat++){
    const response=await invoke(id,'portmandentex');
    assert.equal(response.result.state,'skipped');assert.equal(response.calls,0);
    assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget WHERE day=?').bind(day).first()).requests,daily);
    assert.equal((await db.prepare('SELECT requests FROM agent_runs WHERE id=?').bind(id).first()).requests,run);
   }
  }
  // A cheap ordinary feed can still use the remaining slot after a costly
  // collection was refused. Test data is confined to this disposable database.
  await db.prepare("INSERT INTO agent_tasks(run_id,source_id,company) VALUES('run-limit','monzo','Monzo')").run();
  const accepted=await invoke('run-limit','monzo');assert.equal(accepted.result.state,'published');assert.equal(accepted.calls,1);
  assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget WHERE day=?').bind(day).first()).requests,1);
  assert.equal((await db.prepare("SELECT requests FROM agent_runs WHERE id='run-limit'").first()).requests,150);
  assert.equal((await invoke('run-limit','monzo')).calls,1);
 }finally{await mf.dispose();}
});
