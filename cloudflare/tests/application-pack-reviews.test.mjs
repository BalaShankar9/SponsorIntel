import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {batchHash,batchSelectionHash} from '../shared/application-batch.js';
import {packDocument,PACK_SCOPE} from '../shared/application-pack.js';
import {validateFactAnswers} from '../shared/application-facts.js';
import {validateWorkspace} from '../worker/career-validation.js';
import {preparationSnapshot} from '../worker/preparation-availability.js';
const origin='http://127.0.0.1:8788',base='/api/career/batches';
const cv='Fictional applicant used Python and SQL to analyse a classroom dataset. Built a practice dashboard in Excel in 2024. This is a fictional example, not a customer CV.';
const description='Fictional employer requires Python and SQL, clear communication and evidence of data analysis. This is a fictional advert, not a real vacancy.';
const work=(jobId)=>validateWorkspace({version:2,profile:{name:'Fictional Candidate',email:'fictional@example.invalid',cv},applications:[{id:'saved-0',jobId,company:'Fictional Harbour',title:'Fictional Analyst',location:'Cardiff',description,url:'https://example.invalid/roles/0',sponsorship:'not_stated',stage:'Saved',cv:cv+'\nName: Éva — exact UTF-8.\r\n',coverLetter:'Fictional cover letter\nNo added claims.'}],searches:[]});
async function fixture(run){
 const built=await build({stdin:{contents:`import worker from './worker/index.js';export default {async fetch(r,e,c){
 if(r.headers.get('X-Fictional-Barrier')==='pack'){const DB={prepare:q=>{const s=e.DB.prepare(q);return q.startsWith('INSERT INTO application_pack_reviews')?{bind:(...v)=>{const b=s.bind(...v);return {run:async()=>{await fetch('https://pack-barrier.invalid/ready');return b.run();}};}}:s;},exec:q=>e.DB.exec(q),batch:statements=>e.DB.batch(statements)};return worker.fetch(r,{...e,DB},c);}
 return worker.fetch(r,e,c);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let gate=null,outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-packs'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin},outboundService:async r=>{assert.equal(r.url,'https://pack-barrier.invalid/ready');assert.ok(gate);outbound++;gate.ready();await gate.wait;return new Response('Released');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const stmts=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(stmts.length)await db.batch(stmts);}
  const call=(u,path,method='GET',body,extra={})=>mf.dispatchFetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json','X-SI-Metrics':'exclude','CF-Connecting-IP':u?.ip||'198.51.100.55',...(u?{Cookie:u.cookie}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let count=0;
  const signup=async()=>{const n=++count,r=await call(null,'/api/auth/sign-up/email','POST',{name:'Fictional Pack',email:'fictional-pack-'+n+'@example.invalid',password:crypto.randomUUID()},{'CF-Connecting-IP':'198.51.100.'+(55+n)});assert.equal(r.status,200,await r.clone().text());return {id:(await r.json()).user.id,ip:'198.51.100.'+(55+n),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const setup=async({manual=false,patch={}}={})=>{const u=await signup(),w=work(manual?'manual-'+crypto.randomUUID():count.toString(16).padStart(24,'0'));Object.assign(w.applications[0],patch);let revision=0;
   if(!manual){const a=w.applications[0],now=new Date().toISOString();await db.prepare('INSERT INTO jobs(id,board_id,provider,company,title,location,description,apply_url,sponsorship,evidence,level,first_seen,last_seen,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(a.jobId,'fictional','fictional',a.company,a.title,a.location,a.description,a.url,a.sponsorship,'','not_stated',now,now).run();w.applications[0].sourceVersion=(await preparationSnapshot(a.jobId,{DB:db})).advert.version;}
   const save=async data=>{const r=await call(u,'/api/career/workspace','PUT',{accountId:u.id,revision,data});assert.equal(r.status,200,await r.clone().text());revision=(await r.json()).revision;};await save(w);
   const created=await call(u,base,'POST',{accountId:u.id,application_ids:['saved-0'],input_hash:await batchSelectionHash(w,['saved-0']),request_key:crypto.randomUUID()});assert.equal(created.status,200,await created.clone().text());const batch=(await created.json()).batch,path=base+'/'+batch.id;
   const answers=validateFactAnswers({notice_period:'Four weeks'}),facts={accountId:u.id,action:'approve_facts',confirmed:true,revision:1,previous_version:0,profile_hash:await batchHash(w.profile),answers,answers_hash:await batchHash(answers),request_key:crypto.randomUUID()};const r=await call(u,path,'POST',facts);assert.equal(r.status,200,await r.clone().text());
   const preview=await(await call(u,path+'?pack_role=saved-0')).json(),body={accountId:u.id,action:'review_pack',role_id:'saved-0',confirmed:true,revision:1,previous_version:0,payload_hash:preview.payload_hash,request_key:crypto.randomUUID()};return {u,w,path,batch,preview,body,save};};
  const barrier=()=>{let ready,release;gate={arrived:new Promise(r=>ready=r),wait:new Promise(r=>release=r),ready:()=>ready(),release:()=>release()};return gate;};
  await run({db,call,signup,setup,barrier,outbound:()=>outbound});
 }finally{gate?.release();await mf.dispose();}
}

test('plain-text document digest covers exact UTF-8 bytes without normalizing line endings',async()=>{
 const text='Éva\r\nSQL — evidence\n',d=await packDocument(text,'cv.txt');assert.equal(d.text,text);assert.equal(d.bytes,Buffer.byteLength(text));assert.equal(d.sha256,createHash('sha256').update(text).digest('hex'));assert.notEqual(d.sha256,(await packDocument(text.replaceAll('\r',''),'cv.txt')).sha256);
});

test('actual Worker pack review preserves exact private content, revocation and request replay without dispatch',{timeout:60000},()=>fixture(async({db,call,setup,signup,outbound})=>{
 const x=await setup(),{u,w,path,preview,body}=x,other=await signup();assert.equal(preview.can_approve,true);assert.equal(preview.submission_available,false);assert.equal(preview.payload.scope,PACK_SCOPE);assert.equal(preview.payload.role.url,w.applications[0].url);assert.equal(preview.payload.facts.answers.salary_expectation,null);assert.deepEqual(preview.payload.screening_answers,[]);
 assert.equal((await call(null,path+'?pack_role=saved-0')).status,401);assert.equal((await call(other,path+'?pack_role=saved-0')).status,404);assert.equal((await call(u,path+'?pack_role=outside')).status,404);
 assert.equal((await call(u,path,'POST',body,{Origin:'https://hostile.invalid'})).status,403);assert.equal((await call(u,path,'POST',{...body,accountId:other.id})).status,409);assert.equal((await call(u,path,'POST',{...body,confirmed:false})).status,400);assert.equal((await call(u,path,'POST',{...body,payload_hash:'0'.repeat(64)})).status,409);
 const approved=await call(u,path,'POST',{...body,payload:{documents:['FORGED']},status:'submitted'});assert.equal(approved.status,200,await approved.clone().text());assert.match(approved.headers.get('cache-control'),/no-store/);const d=await approved.json();assert.equal(d.batch.pack_reviews[0].status,'approved_content');assert.equal(d.submission_available,false);
 const saved=await(await call(u,path+'?pack_role=saved-0&pack_version=1')).json();assert.deepEqual(saved.payload,preview.payload);assert.equal(saved.payload_hash,await batchHash(saved.payload));assert.equal(saved.payload.documents[0].sha256,createHash('sha256').update(w.applications[0].cv).digest('hex'));assert.equal(saved.can_approve,false);assert.doesNotMatch(JSON.stringify(saved),/FORGED|submitted/);
 assert.equal((await call(u,path,'POST',body)).status,200);assert.equal((await call(u,path,'POST',{...body,payload_hash:'f'.repeat(64)})).status,409);
 const race=await Promise.all([1,2].map(()=>call(u,path,'POST',{...body,previous_version:1,request_key:crypto.randomUUID()})));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 const revoke={accountId:u.id,action:'revoke_pack',role_id:'saved-0',version:2,request_key:crypto.randomUUID()};assert.equal((await call(u,path,'POST',revoke)).status,200);assert.equal((await call(u,path,'POST',revoke)).status,200);assert.equal((await call(u,path,'POST',{...revoke,version:1})).status,409);
 const state=await(await call(u,path)).json();assert.deepEqual(state.batch.pack_reviews.map(r=>r.status),['revoked','superseded']);
 await x.save({...w,applications:w.applications.map(a=>({...a,cv:a.cv+' Changed saved document.'}))});assert.equal((await(await call(u,path+'?pack_role=saved-0')).json()).can_approve,false);const old=await(await call(u,path+'?pack_role=saved-0&pack_version=1')).json();assert.equal(old.payload.documents[0].text,w.applications[0].cv);
 for(const sql of ["UPDATE application_pack_reviews SET payload='{}'","UPDATE application_pack_revocations SET revoked_at='changed'"])await assert.rejects(db.prepare(sql).run(),/immutable/);
 assert.equal((await call(u,path,'POST',{...body,previous_version:10,request_key:crypto.randomUUID()})).status,400);assert.equal(outbound(),0);
 assert.equal((await call(u,'/api/career/account','DELETE',{})).status,200);for(const table of ['application_pack_reviews','application_pack_revocations'])assert.equal((await db.prepare('SELECT COUNT(*) n FROM '+table).first()).n,0);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
}));

test('missing final CV, employer CV refusal, already applied and changed original destination cannot be approved',{timeout:60000},()=>fixture(async({call,setup,outbound})=>{
 for(const patch of [{cv:''},{description:description+' CVs will not be accepted.'},{stage:'Applied'}]){const x=await setup({patch});assert.equal(x.preview.can_approve,false,JSON.stringify(patch));assert.equal((await call(x.u,x.path,'POST',x.body)).status,409);}
 const manual=await setup({manual:true});assert.equal(manual.preview.can_approve,true);assert.equal(manual.preview.payload.role.source_kind,'applicant_added');assert.equal(manual.preview.payload.delivery.permitted_provider,null);
 const x=await setup();await x.save({...x.w,applications:x.w.applications.map(a=>({...a,url:'https://changed.invalid/other'}))});assert.equal((await(await call(x.u,x.path+'?pack_role=saved-0')).json()).can_approve,false);assert.equal((await call(x.u,x.path,'POST',x.body)).status,409);assert.equal(outbound(),0);
}));

test('atomic insert rejects deletion, late edits, fact revocation, parent pause, original close and changed original',{timeout:60000},()=>fixture(async({db,call,setup,barrier,outbound})=>{
 for(const kind of ['delete','edit','revoke_facts','pause','close','source_change']){
  const x=await setup(),gate=barrier(),pending=call(x.u,x.path,'POST',x.body,{'X-Fictional-Barrier':'pack'});let timer;
  try{await Promise.race([gate.arrived,pending.then(async r=>{throw Error('No barrier '+r.status+' '+await r.clone().text());}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Barrier timeout')),10000);})]);}finally{clearTimeout(timer);}
  if(kind==='delete')assert.equal((await call(x.u,'/api/career/account','DELETE',{})).status,200);
  if(kind==='edit')await x.save({...x.w,applications:x.w.applications.map(a=>({...a,coverLetter:'Changed letter'}))});
  if(kind==='revoke_facts')assert.equal((await call(x.u,x.path,'POST',{accountId:x.u.id,action:kind,version:1,request_key:crypto.randomUUID()})).status,200);
  if(kind==='pause')assert.equal((await call(x.u,x.path,'POST',{accountId:x.u.id,action:kind,revision:1,request_key:crypto.randomUUID()})).status,200);
  if(kind==='close')await db.prepare('UPDATE jobs SET active=0 WHERE id=?').bind(x.w.applications[0].jobId).run();
  if(kind==='source_change')await db.prepare("UPDATE jobs SET apply_url='https://changed.invalid/new' WHERE id=?").bind(x.w.applications[0].jobId).run();
  gate.release();const result=await pending;assert.equal(result.status,409,kind+' '+await result.clone().text());assert.equal((await db.prepare('SELECT COUNT(*) n FROM application_pack_reviews WHERE batch_id=?').bind(x.batch.id).first()).n,0);
 }
 assert.equal(outbound(),6);assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
}));

test('pack history capacity is checked atomically without truncating or clearing earlier content',{timeout:60000},()=>fixture(async({db,call,setup})=>{
 const x=await setup({manual:true}),now=new Date().toISOString();
 for(let i=0;i<17;i++)await db.prepare('INSERT INTO application_pack_reviews(batch_id,role_id,version,batch_revision,facts_version,facts_hash,payload,payload_hash,payload_bytes,request_key,request_hash,approved_at) VALUES(?,?,1,1,1,?,?,?,?,?,?,?)').bind(x.batch.id,'fictional-retained-'+i,'fictional-hash','{}','fictional-hash',i===16?199990:300000,crypto.randomUUID(),'fictional-hash',now).run();
 const before=(await db.prepare('SELECT role_id,payload,payload_bytes FROM application_pack_reviews ORDER BY role_id').all()).results;
 const r=await call(x.u,x.path,'POST',x.body);assert.equal(r.status,409);assert.match(await r.text(),/5 MB retained-pack limit/);assert.deepEqual((await db.prepare('SELECT role_id,payload,payload_bytes FROM application_pack_reviews ORDER BY role_id').all()).results,before);
}));
