import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {batchSelection,batchSelectionHash} from '../shared/application-batch.js';
import {validateWorkspace} from '../worker/career-validation.js';
import {preparationSnapshots} from '../worker/preparation-availability.js';
import {digest} from '../worker/auth.js';

const origin='http://127.0.0.1:8788',base='/api/career/batches';
const cv='Fictional applicant used Python and SQL to analyse a classroom dataset. Built a practice dashboard in Excel in 2024. This is a fictional example, not a customer CV.';
const description='Fictional employer requires Python and SQL, clear communication and evidence of data analysis. This is a fictional advert, not a real vacancy.';
const app=(n=0)=>({id:'saved-'+n,jobId:n.toString(16).padStart(24,'0'),company:'Fictional Employer',title:'Fictional Analyst '+n,location:'Cardiff',description,url:'https://example.invalid/roles/'+n,sponsorship:'not_stated',evidence:'',stage:'Saved'});
const work=(n=1)=>validateWorkspace({version:2,profile:{name:'Fictional Candidate',email:'fictional@example.invalid',cv},applications:Array.from({length:n},(_,i)=>app(i)),searches:[]});

test('batch selection hashes protect exact profile/role/document/stage inputs and ignore incidental observation times',async()=>{
 const w=work(2),hash=await batchSelectionHash(w,['saved-0','saved-1']);
 assert.equal(hash,await batchSelectionHash(w,['saved-1','saved-0']));
 for(const ids of [[],['saved-0','saved-0'],['absent'],Array.from({length:101},(_,i)=>'saved-'+i)])assert.throws(()=>batchSelection(w,ids));
 const dupe=structuredClone(w);dupe.applications[1].jobId=dupe.applications[0].jobId;assert.throws(()=>batchSelection(dupe,['saved-0','saved-1']),/same role/);
 for(const field of ['name','email','cv','sponsorship']){const copy=structuredClone(w);copy.profile[field]=field==='sponsorship'?'now':'Changed';assert.notEqual(hash,await batchSelectionHash(copy,['saved-0','saved-1']));}
 for(const field of ['description','url','cv','coverLetter','stage','sourceVersion']){const copy=structuredClone(w);copy.applications[0][field]=field==='url'?'https://example.invalid/changed':field==='stage'?'Applied':field==='sourceVersion'?'a'.repeat(64):'Changed';assert.notEqual(hash,await batchSelectionHash(copy,['saved-0','saved-1']));}
 const incidental=structuredClone(w);Object.assign(incidental.applications[0],{notes:'Private tracking note',checkedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});assert.equal(hash,await batchSelectionHash(incidental,['saved-0','saved-1']));
});

test('account deletion and a workspace edit win against an already authenticated batch write',{timeout:60000},async()=>{
 const wrapper=await build({stdin:{contents:`import worker from './worker/index.js';export default {async fetch(r,e,c){
 if(r.headers.get('X-Fictional-Barrier')==='batch'){const targets=new WeakSet();const DB={prepare:q=>{const s=e.DB.prepare(q);return q.startsWith('INSERT INTO application_batches')?{bind:(...v)=>{const b=s.bind(...v);targets.add(b);return b;}}:s;},exec:q=>e.DB.exec(q),batch:async statements=>{if(statements.some(s=>targets.has(s)))await fetch('https://batch-barrier.invalid/ready');return e.DB.batch(statements);}};return worker.fetch(r,{...e,DB},c);}
 return worker.fetch(r,e,c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let gate,barriers=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:wrapper.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-batch-races'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:async request=>{assert.equal(request.url,'https://batch-barrier.invalid/ready');barriers++;gate.ready();await gate.wait;return new Response('released');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const stmts=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(stmts.length)await db.batch(stmts);}
  for(const kind of ['deletion','edit']){
   const headers={Origin:origin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':kind==='deletion'?'198.51.100.130':'198.51.100.131'};
   const signed=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers,body:JSON.stringify({name:'Fictional race',email:kind+'@example.invalid',password:crypto.randomUUID()})});assert.equal(signed.status,200);
   const user=(await signed.json()).user;headers.Cookie=signed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   const w=work();w.applications[0].jobId='manual-'+crypto.randomUUID();
   const save=await mf.dispatchFetch(origin+'/api/career/workspace',{method:'PUT',headers,body:JSON.stringify({accountId:user.id,revision:0,data:w})});assert.equal(save.status,200);
   let ready,release;gate={arrived:new Promise(r=>ready=r),wait:new Promise(r=>release=r),ready:()=>ready(),release:()=>release()};
   const pending=mf.dispatchFetch(origin+base,{method:'POST',headers:{...headers,'X-Fictional-Barrier':'batch'},body:JSON.stringify({accountId:user.id,application_ids:['saved-0'],input_hash:await batchSelectionHash(w,['saved-0']),request_key:crypto.randomUUID()})});
   let timer;try{await Promise.race([gate.arrived,pending.then(async r=>{throw Error('Write did not reach barrier: '+r.status+' '+await r.text());}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Barrier timeout')),10000);})]);}finally{clearTimeout(timer);}
   const result=kind==='deletion'?await mf.dispatchFetch(origin+'/api/career/account',{method:'DELETE',headers,body:'{}'}):await mf.dispatchFetch(origin+'/api/career/workspace',{method:'PUT',headers,body:JSON.stringify({accountId:user.id,revision:1,data:{...w,profile:{...w.profile,cv:cv+' New fictional details.'}}})});assert.equal(result.status,200);
   gate.release();assert.equal((await pending).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_batches WHERE user_id=?').bind(user.id).first()).n,0);
  }
  assert.equal(barriers,2);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{gate?.release();await mf.dispose();}
});

test('100 selected roles use one bounded catalogue query; failed reads do not become ready roles',async()=>{
 let queries=0,binds=0;const ids=Array.from({length:100},(_,i)=>i.toString(16).padStart(24,'0'));
 const env={DB:{prepare(sql){queries++;assert.match(sql,/WHERE j.id IN/);return {bind(...v){binds=v.length;return {all:async()=>({results:[]})};}};}}};
 assert.equal((await preparationSnapshots(ids,env)).size,100);assert.equal(queries,1);assert.equal(binds,100);
 await assert.rejects(preparationSnapshots([...ids,'f'.repeat(24)],env));
 const failed=await preparationSnapshots(ids,{DB:{prepare(){throw Error('database unavailable');}}});assert.ok([...failed.values()].every(x=>x.state==='unavailable'));
});

test('actual Worker/auth/D1 keeps batches private, idempotent, bounded and separate from employer submission',{timeout:60000},async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-batches'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('External actions forbidden');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const stmts=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(stmts.length)await db.batch(stmts);}
  const call=(path,{method='GET',user,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':user?.ip||'198.51.100.101',...(user?{Cookie:user.cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const signUp=async n=>{const r=await call('/api/auth/sign-up/email',{method:'POST',body:{name:'Fictional '+n,email:'fictional-batch-'+n+'@example.invalid',password:crypto.randomUUID()}});assert.equal(r.status,200);const d=await r.json();return {id:d.user.id,ip:'198.51.100.'+(101+n),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const a=await signUp(1),b=await signUp(2),w=work(3);w.applications[1].jobId='manual-'+crypto.randomUUID();w.applications[2].stage='Applied';
  for(const saved of w.applications.filter(x=>!x.jobId.startsWith('manual'))){await db.prepare('INSERT INTO jobs(id,board_id,provider,company,title,location,description,apply_url,sponsorship,evidence,level,first_seen,last_seen,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(saved.jobId,'fictional','fictional',saved.company,saved.title,saved.location,saved.description,saved.url,saved.sponsorship,saved.evidence,'not_stated',new Date().toISOString(),new Date().toISOString()).run();}
  let revision=0;const save=async data=>{const r=await call('/api/career/workspace',{method:'PUT',user:a,body:{accountId:a.id,revision,data}});assert.equal(r.status,200,await r.clone().text());revision=(await r.json()).revision;};await save(w);
  const before=await db.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(a.id).first();
  const ids=w.applications.map(x=>x.id),body={accountId:a.id,application_ids:ids,input_hash:await batchSelectionHash(w,ids),request_key:crypto.randomUUID(),report:'FORGED INPUT MUST NOT BE STORED',state:'submitted'};
  assert.equal((await call(base)).status,401);assert.equal((await call(base,{method:'POST',body})).status,401);
  assert.equal((await call(base,{method:'POST',user:a,body,requestOrigin:'https://untrusted.invalid'})).status,403);
  assert.equal((await call(base,{method:'POST',user:b,body})).status,409);
  assert.equal((await call(base,{method:'POST',user:a,body:{...body,input_hash:'0'.repeat(64)}})).status,409);
  const created=await call(base,{method:'POST',user:a,body});assert.equal(created.status,200,await created.clone().text());let result=await created.json(),id=result.batch.id;
  assert.equal(result.submission_available,false);assert.equal(result.batch.items.length,3);assert.deepEqual(result.batch.items.map(x=>x.status),['prepared','needs_review','needs_review']);
  assert.match(result.batch.items[0].report,/Fictional applicant used Python/);assert.doesNotMatch(JSON.stringify(result),/FORGED INPUT/);assert.equal(result.batch.history.length,1);
  assert.equal((await call(base+'/'+id,{user:b})).status,404);assert.deepEqual((await(await call(base,{user:b})).json()).batches,[]);
  for(const request_key of [body.request_key,crypto.randomUUID()]){const r=await call(base,{method:'POST',user:a,body:{...body,request_key}});assert.equal(r.status,200);assert.equal((await r.json()).batch.id,id);}
  assert.equal((await call(base,{method:'POST',user:a,body:{...body,application_ids:[ids[0]]}})).status,409);
  assert.deepEqual(await db.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(a.id).first(),before);
  await assert.rejects(db.prepare("UPDATE application_batches SET items='[]' WHERE id=?").bind(id).run(),/immutable/);
  const pause={accountId:a.id,action:'pause',revision:1,request_key:crypto.randomUUID()};
  const race=await Promise.all([pause,{...pause,request_key:crypto.randomUUID()}].map(body=>call(base+'/'+id,{method:'POST',user:a,body})));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const successful=race[0].status===200?pause:{...pause,request_key:null};
  result=await(await call(base+'/'+id,{user:a})).json();assert.equal(result.batch.state,'paused');assert.equal(result.batch.revision,2);assert.equal(result.batch.history.length,2);
  if(successful.request_key){assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:successful})).status,200);assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:{...successful,action:'resume'}})).status,409);}
  const resume={accountId:a.id,action:'resume',revision:2,request_key:crypto.randomUUID()};assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:resume})).status,200);
  assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:{...resume,action:'submit',revision:3,request_key:crypto.randomUUID()}})).status,400);
  await db.prepare('UPDATE jobs SET active=0 WHERE id=?').bind(w.applications[0].jobId).run();result=await(await call(base+'/'+id,{user:a})).json();assert.equal(result.batch.items[0].status,'blocked');assert.match(result.batch.items[0].report,/Fictional applicant/);
  const unavailable=await(await call(base,{method:'POST',user:a,body:{...body,request_key:crypto.randomUUID()}})).json();assert.notEqual(unavailable.batch.id,id);assert.equal(unavailable.batch.items[0].report,'');
  await db.prepare('UPDATE jobs SET active=1 WHERE id=?').bind(w.applications[0].jobId).run();const restored=await(await call(base+'/'+unavailable.batch.id,{user:a})).json();assert.equal(restored.batch.items[0].status,'needs_review');
  await db.prepare('UPDATE jobs SET description=description||? WHERE id=?').bind(' Changed requirement.',w.applications[0].jobId).run();result=await(await call(base+'/'+id,{user:a})).json();assert.equal(result.batch.items[0].status,'blocked');
  const changed=structuredClone(w);changed.profile.cv+=' New private fact.';await save(changed);result=await(await call(base+'/'+id,{user:a})).json();assert.ok(result.batch.items.every(x=>x.status==='changed'));
  changed.applications.shift();await save(changed);result=await(await call(base+'/'+id,{user:a})).json();assert.equal(result.batch.items[0].status,'missing');
  const cancel={accountId:a.id,action:'cancel',revision:3,request_key:crypto.randomUUID()};assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:cancel})).status,200);assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:cancel})).status,200);
  assert.equal((await call(base+'/'+id,{method:'POST',user:a,body:{...resume,revision:4,request_key:crypto.randomUUID()}})).status,409);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_batch_events WHERE batch_id=?').bind(id).first()).n,4);
  await assert.rejects(db.prepare("UPDATE application_batch_events SET state='active' WHERE batch_id=?").bind(id).run(),/immutable/);
  assert.equal((await call('/api/career/account',{method:'DELETE',user:a,body:{}})).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_batches').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_batch_events').first()).n,0);
  assert.equal((await call(base,{user:a})).status,401);assert.equal(outbound,0);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
  const allowedUsage=new Set(await Promise.all([-1,0,1].flatMap(offset=>['auth:198.51.100.101','application-batches:'+a.id,'application-batches:'+b.id].map(key=>digest(key+':'+(Math.floor(Date.now()/3600000)+offset))))));
  assert.ok((await db.prepare('SELECT key FROM ai_usage').all()).results.every(x=>allowedUsage.has(x.key)),'Only account and batch rate limits were consumed, never model allowances');
  const c=await signUp(3),cw=work(2),savedC=await call('/api/career/workspace',{method:'PUT',user:c,body:{accountId:c.id,revision:0,data:cw}});assert.equal(savedC.status,200);
  const now=new Date().toISOString();for(let i=0;i<19;i++)await db.prepare("INSERT INTO application_batches VALUES(?,?,?,?,?,'active',1,?,?,?,?,?)").bind('seed-'+i,c.id,'input-'+i,'profile','[]','key-'+i,'hash','key-'+i,now,now).run();
  const nearLimit=await Promise.all(cw.applications.map(async item=>call(base,{method:'POST',user:c,body:{accountId:c.id,application_ids:[item.id],input_hash:await batchSelectionHash(cw,[item.id]),request_key:crypto.randomUUID()}})));
  assert.deepEqual(nearLimit.map(r=>r.status).sort(),[200,409]);assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_batches WHERE user_id=?').bind(c.id).first()).n,20);
  assert.equal((await(await call(base,{user:c})).json()).batches.length,20);assert.equal(outbound,0);
  const d=await signUp(4),dw=work(100);dw.applications.forEach(x=>x.jobId='manual-'+crypto.randomUUID());
  const ds=await call('/api/career/workspace',{method:'PUT',user:d,body:{accountId:d.id,revision:0,data:dw}});assert.equal(ds.status,200);
  const allIds=dw.applications.map(x=>x.id),hundred=await call(base,{method:'POST',user:d,body:{accountId:d.id,application_ids:allIds,input_hash:await batchSelectionHash(dw,allIds),request_key:crypto.randomUUID()}});assert.equal(hundred.status,200,await hundred.clone().text());
  const all=await hundred.json();assert.equal(all.batch.items.length,100);assert.ok(all.batch.items.every(x=>x.report.includes('Fictional applicant')&&x.status==='needs_review'));assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
