import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {provider} from './fixtures/teaching-scout.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const body=(i,now=Date.now())=>({id:null,revision:0,request_key:crypto.randomUUID(),source_kind:'linkedin_job',source_url:`https://www.linkedin.com/jobs/view/${1234567000+i}/`,content:{title:'Fictional local engineering lead '+i,employer:'Fictional employer',location:'London',observed_at:new Date(now).toISOString(),posted_at:null,posted_evidence:'',deadline:null,deadline_evidence:'',original_url:'',identity_url:'',identity_note:'',quote:'',state:'rejected',reason:'Fictional local test record; this is not an actual recruiting opportunity.',follow_up_at:null,job_id:null,duplicate_of:null,method:'agent_assisted'}});
async function fixture(t,mutate){
 const bundle=await build({stdin:{contents:`import {discoveryAPI,saveDiscovery,discoverySummary} from './worker/discovery.js';
 import {scoutTeachingVacancies} from './worker/discovery-scout.js';
 export default {async fetch(request,env){const path=new URL(request.url).pathname;
 if(path==='/scout')return Response.json(await scoutTeachingVacancies(env,'fictional-business'));
 if(path==='/clock'){const {input,now}=await request.json();return Response.json({saved:await saveDiscovery(env,input,'fictional-owner',now),summary:await discoverySummary(env,now)});}
 const response=await discoveryAPI(request,env,{user:{id:request.headers.get('X-Test-Owner')||'fictional-owner'}});
 return request.headers.has('X-Test-Lose-Ack')?new Response('Fictional lost acknowledgement',{status:502}):response;}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',target:'es2022'});
 const fake=provider(Date.now(),{mutate}),mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',cf:false,d1Databases:{DB:'discovery-allowance-fictional'},outboundService:request=>fake.fetch(request.url,{redirect:'manual'})}));
 t.after(()=>mf.dispose());const db=await mf.getD1Database('DB'),schema=migrationSchema();
 for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
 const now=new Date().toISOString();await db.batch([db.prepare('INSERT INTO business_controls(singleton,updated_at) VALUES(1,?)').bind(now),db.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('fictional-business','running',?)").bind(now)]);
 const call=(input,headers={})=>mf.dispatchFetch('https://sponsorintel.london/api/admin/discovery',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json',...headers},body:JSON.stringify(input)});
 const count=async table=>(await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n;
 return {mf,db,fake,call,count};
}

test('actual Worker/D1 shares five new identities across scout and concurrent owner saves, while preserving reviews and retries',{timeout:30000},async t=>{
 const {mf,db,fake,call,count}=await fixture(t);
 const scout=await(await mf.dispatchFetch('https://sponsorintel.london/scout')).json();assert.equal(scout.retained,2);assert.equal(fake.calls.length,3);
 const first=body(1),second=body(2),a=await(await call(first)).json();assert.equal(a.lead.revision,1);
 assert.equal((await call(second,{'X-Test-Lose-Ack':'1'})).status,502);assert.equal(await count('discovery_leads'),4);
 const race=await Promise.all([call(body(3)),call(body(4),{'X-Test-Owner':'fictional-other-owner'})]);
 assert.deepEqual(race.map(r=>r.status).sort(),[200,429],'Concurrent owners must share the scout allowance');
 assert.equal(await count('discovery_leads'),5);assert.equal(await count('discovery_revisions'),5);assert.equal(await count('admin_audit'),5);
 const refusal=await(await call(body(5))).json();assert.match(refusal.error,/five new sourcing leads.*UTC day/i);
 const replay=await(await call(second)).json();assert.equal(replay.replayed,true);assert.equal(await count('discovery_leads'),5);
 assert.equal((await call({...second,content:{...second.content,title:'Changed fictional content'}})).status,409);
 assert.equal((await call(body(1))).status,409,'Duplicate identity still points to the retained lead');
 const revision={...first,id:a.lead.id,revision:1,request_key:crypto.randomUUID(),content:{...first.content,reason:'A second fictional evidence review is permitted after the daily new-lead limit.'}};
 assert.equal((await call(revision)).status,200);assert.equal(await count('discovery_leads'),5);assert.equal(await count('discovery_revisions'),6);assert.equal(await count('admin_audit'),6);
 const summary=(await(await mf.dispatchFetch('https://sponsorintel.london/api/admin/discovery?q=no-match')).json()).summary;
 assert.equal(summary.allowance.used,5);assert.equal(summary.allowance.remaining,0);assert.equal(summary.allowance.limit,5);
 assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,4);assert.equal(fake.calls.length,3);assert.equal(await count('jobs'),0);
 // A new UTC day uses its own count; it never resets or rewrites old records.
 const tomorrow=Date.now()+86400000,input=body(6,tomorrow);
 const rollover=await(await mf.dispatchFetch('https://sponsorintel.london/clock',{method:'POST',body:JSON.stringify({input,now:tomorrow})})).json();
 assert.equal(rollover.summary.allowance.used,1);assert.equal(rollover.summary.allowance.remaining,4);assert.equal(await count('discovery_leads'),6);
});

test('an in-flight scout cannot add a sixth identity after an owner takes the last slot',{timeout:30000},async t=>{
 let release,started;const held=new Promise(r=>release=r),begun=new Promise(r=>started=r);
 const {mf,db,call,count,fake}=await fixture(t,async(_url,_options,n)=>{if(n===1){started();await held;}});
 t.after(()=>release());
 for(let i=1;i<=4;i++)assert.equal((await call(body(i))).status,200);
 const scouting=mf.dispatchFetch('https://sponsorintel.london/scout');await begun;
 try{assert.equal((await call(body(5))).status,200);}finally{release();}
 const result=await(await scouting).json();assert.equal(result.retained,0);assert.equal(result.reserved_requests,3);assert.equal(result.requests,2);
 assert.equal(await count('discovery_leads'),5);assert.equal(await count('discovery_revisions'),5);assert.equal(await count('admin_audit'),5);
 const item=await db.prepare('SELECT state,reason FROM discovery_scout_items').first();assert.equal(item.state,'held');assert.equal(item.reason,'daily_allowance_or_control_changed');
 assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,3);
 assert.equal((await call(body(6))).status,429);assert.equal((await(await mf.dispatchFetch('https://sponsorintel.london/scout')).json()).replayed,true);assert.equal(fake.calls.length,2);
});
