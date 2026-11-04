import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual Worker/D1 keeps one uncertain dispatch across concurrent requests and read-only reconciliation', {timeout:30000}, async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const bundle=await build({stdin:{contents:`
    import {dispatchSources} from './worker/agent-operations.js';
    import {agentOperationsAPI} from './worker/agent-api.js';
    let creates=0,restarts=0;
    export default {async fetch(request,env){
      const url=new URL(request.url),mode=url.searchParams.get('status');
      const local={...env,SOURCE_WORKFLOW:{
        create:async()=>{creates++;throw Error('Fictional lost create response');},
        get:async()=>({status:async()=>{if(!mode)throw Error('Fictional unavailable history');return {status:mode};},restart:async()=>{restarts++;}}),
      }};
      let response;
      if(url.pathname==='/dispatch'){
        try{response=Response.json(await dispatchSources(local,await request.json()));}
        catch{response=Response.json({held:true},{status:503});}
      }else response=await agentOperationsAPI(request,local,{user:{id:'fictional-owner'}});
      response.headers.set('X-Fictional-Creates',String(creates));
      response.headers.set('X-Fictional-Restarts',String(restarts));
      return response;
    }};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'source-dispatch-isolated'},outboundService:()=>{assert.fail('No external provider request permitted');}}));
  try{
    const db=await mf.getD1Database('DB');
    const schema=migrationSchema();
    for(const type of ['table','index','view','trigger']){
      const statements=schema.objects.filter(x=>x.type===type).map(object=>db.prepare(object.sql));
      if(statements.length)await db.batch(statements);
    }
    const call=(path,body)=>mf.dispatchFetch('https://sponsorintel.london'+path,{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify(body)});
    const responses=await Promise.all(Array.from({length:6},(_,i)=>call('/dispatch',{id:i%2?'same-request':'different-request'})));
    assert.equal(responses.filter(r=>r.status===503).length,1);
    const original=await db.prepare('SELECT id,state,summary FROM agent_runs').first();
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_runs').first()).n,1);
    assert.equal(original.state,'queued');assert.match(original.summary,/unconfirmed/i);
    for(const id of [original.id,'later-request']){
      const response=await call('/dispatch',{id});
      assert.equal((await response.json()).id,original.id);
      assert.equal(response.headers.get('X-Fictional-Creates'),'1');
    }
    await db.batch([
      db.prepare("UPDATE agent_runs SET state='dispatch_failed',created_at='2020-01-01T00:00:00.000Z',requests=149"),
      db.prepare("INSERT INTO agent_daily_budget(day,requests) VALUES('2026-11-04',499)"),
    ]);
    const unknown=await call('/api/admin/agents/reconcile',{run_id:original.id});
    // The legacy API still labels this "retried"; assert the actual zero-retry effect.
    assert.equal(unknown.status,202);assert.equal(unknown.headers.get('X-Fictional-Creates'),'1');
    assert.equal((await db.prepare('SELECT state FROM agent_runs').first()).state,'dispatch_failed');
    const held=await call('/dispatch',{id:'after-legacy'});
    assert.equal((await held.json()).id,original.id);assert.equal(held.headers.get('X-Fictional-Creates'),'1');
    assert.equal(held.headers.get('X-Fictional-Restarts'),'0');
    assert.equal((await db.prepare('SELECT requests FROM agent_runs').first()).requests,149);
    assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,499);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM jobs').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_runs').first()).n,1);
  }finally{await mf.dispose();}
});
