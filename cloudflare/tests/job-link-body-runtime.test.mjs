import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual Worker/D1 preserves a bounded page-read failure and its charged replay without provider I/O',{timeout:30000},async()=>{
 const bundle=await build({stdin:{contents:`import {planJobLinkChecks,checkJobLink,jobLinkHealth} from './worker/job-link-checks.js';
 let calls=0,cancelled=0;
 export default {async fetch(request,env){
 const [id]=await planJobLinkChecks(env,'local-run');
 const result=await checkJobLink(env,id,async()=>{calls++;let sent=0;return new Response(new ReadableStream({pull(controller){controller.enqueue(new TextEncoder().encode(sent++===0?'<title>Fictional Engineer</title>'+' '.repeat(499968):'extra'));},cancel(){cancelled++;}}),{headers:{'Content-Type':'text/html'}});});
 return Response.json({result,calls,cancelled,health:await jobLinkHealth(env)});
 }};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'link-body-isolated'},outboundService:()=>{assert.fail('No external service may be called');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema(),stamp=new Date().toISOString();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  await db.batch([
   db.prepare('INSERT INTO business_controls(singleton,updated_at) VALUES(1,?)').bind(stamp),
   db.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('local-run','queued',?)").bind(stamp),
   db.prepare("INSERT INTO jobs(id,board_id,company,title,location,description,apply_url,provider,sponsorship,level,first_seen,last_seen) VALUES('fictional','monzo','Fictional employer','Fictional Engineer','London','Fictional advert','https://job-boards.greenhouse.io/monzo/jobs/123','greenhouse','not_stated','experienced',?,?)").bind(stamp,stamp)
  ]);
  const before=await db.prepare('SELECT * FROM jobs').first();
  const first=await(await mf.dispatchFetch('http://localhost/')).json();
  assert.equal(first.result.reason,'response_body_limit');assert.equal(first.result.state,'uncertain');assert.equal(first.calls,1);assert.equal(first.cancelled,1);assert.equal(first.health.needs_attention,1);assert.equal(first.health.matched,0);
  const receipt=await db.prepare('SELECT * FROM job_link_checks').first();assert.deepEqual(JSON.parse(receipt.evidence),{chain:[{url:'https://job-boards.greenhouse.io/monzo/jobs/123',status:200}]});
  const again=await(await mf.dispatchFetch('http://localhost/')).json();assert.equal(again.result.replay,true);assert.equal(again.calls,1);assert.equal(again.cancelled,1);
  assert.deepEqual(await db.prepare('SELECT * FROM jobs').first(),before);assert.deepEqual(await db.prepare('SELECT * FROM job_link_checks').first(),receipt);
  assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,4);assert.equal((await db.prepare('SELECT reserved_requests FROM job_link_daily_budget').first()).reserved_requests,4);
 }finally{await mf.dispose();}
});
