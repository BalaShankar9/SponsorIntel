import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('feedback retry recovers a lost acknowledgement without a duplicate or another quota slot', {timeout:30000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {feedbackAPI} from './worker/feedback.js';
 export default {async fetch(request,env){const result=await feedbackAPI(request,env);if(request.headers.get('X-Local-Lose-Ack'))return new Response('Fictional lost acknowledgement',{status:502});return result;}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',cf:false,bindings:{APP_VERSION:'fictional-test'},d1Databases:{DB:'feedback-replay-isolated'},outboundService:()=>assert.fail('No outbound service permitted')}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const body={request_key:crypto.randomUUID(),kind:'bug',message:'Fictional local report: button did not work.',context:{page:'/studio?private=omitted'}};
  const call=(payload=body,headers={})=>mf.dispatchFetch('https://sponsorintel.london/api/feedback',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},body:JSON.stringify(payload)});
  const reportCount=async()=>(await db.prepare('SELECT COUNT(*) n FROM feedback').first()).n;
  const reservationCount=async()=>(await db.prepare('SELECT COALESCE(SUM(count),0) n FROM rate_limits').first()).n;
  assert.equal((await call(body,{'X-Local-Lose-Ack':'1'})).status,502);
  assert.equal(await reportCount(),1);
  const retry=await call();assert.equal(retry.status,200,'An uncertain retry must recover the receipt');
  const receipt=await retry.json();assert.equal(receipt.replayed,true);
  assert.equal(await reportCount(),1);assert.equal(await reservationCount(),1);
  const row=await db.prepare('SELECT * FROM feedback WHERE id=?').bind(receipt.id).first();
  assert.equal(row.support_queue,'engineering');assert.equal(row.support_version,0);assert.equal(row.message,body.message);
  assert.deepEqual(JSON.parse(row.context),{page:'/studio'});
  assert.equal((await call({...body,message:'Changed fictional text must not replace the original.'})).status,409);
  assert.equal(await reservationCount(),1);
  const crossNetwork=await call(body,{'CF-Connecting-IP':'192.0.2.2'});assert.equal((await crossNetwork.json()).id,receipt.id);assert.equal(await reservationCount(),1);
  // Four distinct fictional reports use the remaining slots; a concurrent same-key pair uses one.
  for(let i=0;i<3;i++)assert.equal((await call({...body,request_key:crypto.randomUUID()})).status,201);
  const last={...body,request_key:crypto.randomUUID()};
  const pair=await Promise.all([call(last),call(last)]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,201]);
  assert.equal(await reportCount(),5);assert.equal(await reservationCount(),5);
  assert.equal((await call({...body,request_key:crypto.randomUUID()})).status,429);
  assert.equal((await call()).status,200);assert.equal(await reservationCount(),5);
  for(let i=0;i<4;i++)assert.equal((await call({...body,request_key:crypto.randomUUID()},{'CF-Connecting-IP':'192.0.2.3'})).status,201);
  const race=await Promise.all([call({...body,request_key:crypto.randomUUID()},{'CF-Connecting-IP':'192.0.2.3'}),call({...body,request_key:crypto.randomUUID()},{'CF-Connecting-IP':'192.0.2.3'})]);
  assert.deepEqual(race.map(x=>x.status).sort(),[201,429]);
  assert.equal(await reportCount(),10);
  assert.equal((await call({...body,request_key:'invalid'})).status,400);
  // A failed quota write must roll back the feedback insert in the same D1 batch.
  await db.prepare("CREATE TRIGGER fictional_fail_rate BEFORE INSERT ON rate_limits BEGIN SELECT RAISE(ABORT,'fictional quota failure'); END").run();
  const failed=await call({...body,request_key:crypto.randomUUID()},{'CF-Connecting-IP':'192.0.2.4'});assert.equal(failed.status,500);assert.equal(await reportCount(),10);
  assert.equal((await call()).status,200);
 }finally{await mf.dispose();}
});
