import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {batchHash,batchSelection,batchSelectionHash} from '../shared/application-batch.js';
import {validateWorkspace} from '../worker/career-validation.js';
import {preparationSnapshots} from '../worker/preparation-availability.js';
import {digest} from '../worker/auth.js';

const origin='http://127.0.0.1:8788',base='/api/career/batches';
const cv='Fictional applicant used Python and SQL to analyse a classroom dataset. Built a practice dashboard in Excel in 2024. This is a fictional example, not a customer CV.';
const description='Fictional employer requires Python and SQL, clear communication and evidence of data analysis. This is a fictional advert, not a real vacancy.';
const app=(n=0)=>({id:'saved-'+n,jobId:n.toString(16).padStart(24,'0'),company:'Fictional Employer',title:'Fictional Analyst '+n,location:'Cardiff',description,url:'https://example.invalid/roles/'+n,sponsorship:'not_stated',evidence:'',stage:'Saved'});
const work=(n=1)=>validateWorkspace({version:2,profile:{name:'Fictional Candidate',email:'fictional@example.invalid',cv},applications:Array.from({length:n},(_,i)=>app(i)),searches:[]});

import {validateFactAnswers,factSafeAttempt} from '../shared/application-facts.js';

test('routine answers stay explicit; empty is unknown and invalid fields are rejected',()=>{
 assert.deepEqual(validateFactAnswers({notice_period:'  Four weeks  '}),{notice_period:'Four weeks',salary_expectation:null,interview_availability:null});
 for(const value of [null,[],{visa_status:'yes'},{notice_period:5},{salary_expectation:'x'.repeat(1201)}])assert.throws(()=>validateFactAnswers(value));
});

test('real Worker keeps fact confirmations private, versioned, revocable and distinct from dispatch',{timeout:60000},async()=>{
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-facts'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external actions permitted');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const stmts=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(stmts.length)await db.batch(stmts);}
  const call=(path,{method='GET',user,body,requestOrigin=origin}={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':user?.ip||'198.51.100.151',...(user?{Cookie:user.cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const signUp=async n=>{const r=await call('/api/auth/sign-up/email',{method:'POST',body:{name:'Fictional facts '+n,email:'facts-'+n+'@example.invalid',password:crypto.randomUUID()}});assert.equal(r.status,200);return {id:(await r.json()).user.id,ip:'198.51.100.'+(151+n),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const a=await signUp(1),b=await signUp(2),w=work();w.applications[0].jobId='manual-'+crypto.randomUUID();
  let wr=0;const save=async data=>{const res=await call('/api/career/workspace',{method:'PUT',user:a,body:{accountId:a.id,revision:wr,data}});assert.equal(res.status,200,await res.clone().text());wr=(await res.json()).revision;};await save(w);
  const created=await call(base,{method:'POST',user:a,body:{accountId:a.id,application_ids:['saved-0'],input_hash:await batchSelectionHash(w,['saved-0']),request_key:crypto.randomUUID()}});assert.equal(created.status,200);const batch=(await created.json()).batch,path=base+'/'+batch.id;
  const answers=validateFactAnswers({notice_period:'Four weeks after accepting an offer',salary_expectation:'GBP 30,000 annually'});
  const body={accountId:a.id,action:'approve_facts',confirmed:true,revision:1,previous_version:0,profile_hash:await batchHash(w.profile),answers,answers_hash:await batchHash(answers),request_key:crypto.randomUUID(),profile:{name:'FORGED'},status:'submitted'};
  const post=x=>call(path,{method:'POST',user:a,body:x});
  assert.equal((await call(path,{method:'POST',body})).status,401);
  assert.equal((await call(path,{method:'POST',user:a,body,requestOrigin:'https://hostile.invalid'})).status,403);
  assert.equal((await call(path,{method:'POST',user:b,body:{...body,accountId:b.id}})).status,404);
  assert.equal((await post({...body,accountId:b.id})).status,409);
  assert.equal((await post({...body,confirmed:false})).status,400);
  assert.equal((await post({...body,answers:{visa_status:'yes'}})).status,400);
  assert.equal((await post({...body,answers:{notice_period:'Different'}})).status,409);
  const approve=await post(body);assert.equal(approve.status,200,await approve.clone().text());let d=await approve.json();
  assert.equal(d.submission_available,false);assert.equal(d.batch.facts[0].status,'current');assert.deepEqual(d.batch.facts[0].profile,w.profile);assert.deepEqual(d.batch.facts[0].answers,answers);assert.equal(d.batch.facts[0].scope,'preparation_only');assert.equal(d.batch.facts[0].profile.sponsorship,'unsure');assert.doesNotMatch(JSON.stringify(d),/FORGED|submitted/);assert.match(approve.headers.get('cache-control'),/no-store/);
  assert.equal((await post(body)).status,200);assert.equal((await post({...body,confirmed:false})).status,400);
  const newAnswers=validateFactAnswers({notice_period:'Eight weeks'});assert.equal((await post({...body,answers:newAnswers,answers_hash:await batchHash(newAnswers)})).status,409);
  const candidates=[1,2].map(()=>({...body,previous_version:1,request_key:crypto.randomUUID()}));
  const race=await Promise.all(candidates.map(post));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  d=await(await call(path,{user:a})).json();assert.equal(d.batch.facts.length,2);assert.equal(d.batch.facts[1].status,'superseded');assert.equal(d.batch.facts[0].status,'current');assert.equal((await call(path,{user:b})).status,404);
  const revoke={accountId:a.id,action:'revoke_facts',version:2,request_key:crypto.randomUUID()};assert.equal((await post(revoke)).status,200);assert.equal((await post(revoke)).status,200);assert.equal((await post({...revoke,version:1})).status,409);
  d=await(await call(path,{user:a})).json();assert.equal(d.batch.facts[0].status,'revoked');assert.equal(d.batch.facts[0].revoke_request_key,revoke.request_key);
  assert.equal((await post({...body,previous_version:2,request_key:crypto.randomUUID()})).status,200);
  await save({...w,profile:{...w.profile,cv:cv+' Different experience.'}});d=await(await call(path,{user:a})).json();assert.equal(d.batch.facts[0].status,'inputs_changed');assert.deepEqual(d.batch.facts[0].profile,w.profile);
  assert.equal((await post({...body,previous_version:3,request_key:crypto.randomUUID()})).status,409);
  await save(w);assert.equal((await post({accountId:a.id,action:'pause',revision:1,request_key:crypto.randomUUID()})).status,200);d=await(await call(path,{user:a})).json();assert.equal(d.batch.facts[0].status,'batch_changed');
  assert.equal((await post({accountId:a.id,action:'resume',revision:2,request_key:crypto.randomUUID()})).status,200);d=await(await call(path,{user:a})).json();assert.equal(d.batch.facts[0].status,'batch_changed');
  assert.equal((await post({...body,previous_version:3,revision:3,request_key:crypto.randomUUID()})).status,200);
  for(const sql of ["UPDATE application_fact_packs SET payload='{}'", "UPDATE application_fact_revocations SET revoked_at='changed'"])await assert.rejects(db.prepare(sql).run(),/immutable/);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_fact_packs').first()).n,4);
  assert.equal((await post({...body,previous_version:20,revision:3,request_key:crypto.randomUUID()})).status,400);
  assert.equal((await call('/api/career/account',{method:'DELETE',user:a,body:{}})).status,200);
  for(const table of ['application_batches','application_fact_packs','application_fact_revocations'])assert.equal((await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0);
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
test('account deletion and a workspace edit win against an already authenticated facts confirmation',{timeout:60000},async()=>{
 const wrapper=await build({stdin:{contents:`import worker from './worker/index.js';export default {async fetch(r,e,c){
 if(r.headers.get('X-Fictional-Barrier')==='batch'){const DB={prepare:q=>{const s=e.DB.prepare(q);return q.startsWith('INSERT INTO application_fact_packs')?{bind:(...v)=>{const b=s.bind(...v);return {run:async()=>{await fetch('https://batch-barrier.invalid/ready');return b.run();}};}}:s;},exec:q=>e.DB.exec(q),batch:statements=>e.DB.batch(statements)};return worker.fetch(r,{...e,DB},c);}
 return worker.fetch(r,e,c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let gate,barriers=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:wrapper.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-batch-races'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:async request=>{assert.equal(request.url,'https://batch-barrier.invalid/ready');barriers++;gate.ready();await gate.wait;return new Response('released');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const stmts=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(stmts.length)await db.batch(stmts);}
  for(const kind of ['deletion','edit','pause']){
   const headers={Origin:origin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':kind==='deletion'?'198.51.100.130':kind==='edit'?'198.51.100.131':'198.51.100.132'};
   const signed=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers,body:JSON.stringify({name:'Fictional race',email:kind+'@example.invalid',password:crypto.randomUUID()})});assert.equal(signed.status,200);
   const user=(await signed.json()).user;headers.Cookie=signed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   const w=work();w.applications[0].jobId='manual-'+crypto.randomUUID();
   const save=await mf.dispatchFetch(origin+'/api/career/workspace',{method:'PUT',headers,body:JSON.stringify({accountId:user.id,revision:0,data:w})});assert.equal(save.status,200);
   let ready,release;gate={arrived:new Promise(r=>ready=r),wait:new Promise(r=>release=r),ready:()=>ready(),release:()=>release()};
   const made=await mf.dispatchFetch(origin+base,{method:'POST',headers,body:JSON.stringify({accountId:user.id,application_ids:['saved-0'],input_hash:await batchSelectionHash(w,['saved-0']),request_key:crypto.randomUUID()})});assert.equal(made.status,200);const bid=(await made.json()).batch.id;
   const answers=validateFactAnswers({});
   const pending=mf.dispatchFetch(origin+base+'/'+bid,{method:'POST',headers:{...headers,'X-Fictional-Barrier':'batch'},body:JSON.stringify({accountId:user.id,action:'approve_facts',confirmed:true,revision:1,previous_version:0,profile_hash:await batchHash(w.profile),answers,answers_hash:await batchHash(answers),request_key:crypto.randomUUID()})});
   let timer;try{await Promise.race([gate.arrived,pending.then(async r=>{throw Error('Write did not reach barrier: '+r.status+' '+await r.text());}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Barrier timeout')),10000);})]);}finally{clearTimeout(timer);}
   const result=kind==='deletion'?await mf.dispatchFetch(origin+'/api/career/account',{method:'DELETE',headers,body:'{}'}):kind==='pause'?await mf.dispatchFetch(origin+base+'/'+bid,{method:'POST',headers,body:JSON.stringify({accountId:user.id,action:'pause',revision:1,request_key:crypto.randomUUID()})}):await mf.dispatchFetch(origin+'/api/career/workspace',{method:'PUT',headers,body:JSON.stringify({accountId:user.id,revision:1,data:{...w,profile:{...w.profile,cv:cv+' New fictional details.'}}})});assert.equal(result.status,200);
   gate.release();assert.equal((await pending).status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_fact_packs WHERE batch_id=?').bind(bid).first()).n,0);
  }
  assert.equal(barriers,3);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 }finally{gate?.release();await mf.dispose();}
});


test('pending browser recovery retains hashes and request identity but no private answers',()=>{
 const a={path:'/api/career/batches/fictional',body:{action:'approve_facts',request_key:'fictional-request-key',accountId:'fictional',answers:{salary_expectation:'PRIVATE FICTIONAL ANSWER'},answers_hash:'expected-hash'}};
 const safe=factSafeAttempt(a);assert.equal(safe.body.request_key,a.body.request_key);assert.equal(safe.body.answers_hash,'expected-hash');assert.doesNotMatch(JSON.stringify(safe),/PRIVATE FICTIONAL ANSWER/);assert.equal(a.body.answers.salary_expectation,'PRIVATE FICTIONAL ANSWER');
});
