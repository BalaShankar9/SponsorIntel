import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareScheduleSave,sendScheduleSave,ScheduleSaveError} from '../shared/marketing-schedule-save.js';
import {createBrief,decideBrief,marketingAPI} from '../worker/marketing.js';
import {database} from './research-db.mjs';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {fileURLToPath} from 'node:url';
const now=Date.parse('2026-10-15T10:00:00Z');
const brief={id:'fictional-brief',revision:2,state:'reviewed',expires_at:'2026-10-18T10:00:00Z',media:[]};
const destination={account:'1319703417896763',provider:'metricool'};
const form={external:'fictional-schedule',observed:'2026-10-15T10:00:00Z',scheduled:'2026-10-16T09:00:37+01:00',note:'Fictional provider shows the exact reviewed copy queued on the company account.',observer:'agent_assisted',checked:true,mediaChecked:false};

test('schedule form keeps actual times, agent attribution and ordered artwork in its pinned request',()=>{
 const request=JSON.parse(prepareScheduleSave({...brief,media:[{sha256:'second'},{sha256:'first'}]},destination,{...form,mediaChecked:true},now,'fictional-key'));
 assert.equal(request.revision,2);assert.equal(request.request_key,'fictional-key');assert.equal(request.receipt.scheduled_at,'2026-10-16T08:00:37.000Z');assert.equal(request.receipt.observed_at,'2026-10-15T10:00:00.000Z');
 assert.match(request.note,/^Agent-assisted observation/);assert.equal(request.note,request.receipt.evidence);assert.deepEqual(request.receipt.media_sha256,['second','first']);assert.equal(request.receipt.account,destination.account);
});
test('unreviewed copy, invented/future observations, unchecked evidence and past or expired slots cannot form a new request',()=>{
 for(const patch of [{checked:false},{observed:''},{observed:'2026-10-15T10:01:00Z'},{scheduled:'2026-10-15T09:00:00Z'},{scheduled:'2026-10-19T09:00:00Z'},{scheduled:'2026-11-20T09:00:00Z'},{external:'https://provider.invalid/schedule'},{note:'Too short'},{observer:'independent-reviewer'}])assert.throws(()=>prepareScheduleSave(brief,destination,{...form,...patch},now));
 assert.throws(()=>prepareScheduleSave({...brief,state:'held'},destination,form,now));
 assert.throws(()=>prepareScheduleSave({...brief,media:[{sha256:'image'}]},destination,form,now));
});
test('network loss, invalid acknowledgement and gateway errors remain uncertain; a structured rejection allows correction',async()=>{
 const request=prepareScheduleSave(brief,destination,form,now);
 for(const fetcher of [async()=>{throw Error('Lost response');},async()=>new Response('<html>gateway</html>',{status:502}),async()=>Response.json({error:'Failed'},{status:500}),async()=>Response.json({error:'The record could not be saved. Refresh before retrying.'},{status:400}),async()=>Response.json({id:'different',state:'scheduled'}),async()=>Response.json({id:brief.id})])await assert.rejects(sendScheduleSave(request,fetcher),e=>e instanceof ScheduleSaveError&&e.uncertain);
 await assert.rejects(sendScheduleSave(request,async()=>Response.json({error:'Evidence expired.'},{status:409})),e=>e instanceof ScheduleSaveError&&!e.uncertain&&e.message==='Evidence expired.');
 assert.equal((await sendScheduleSave(request,async()=>Response.json({id:brief.id,replayed:true}))).replayed,true);
});

test('an unexpected ledger storage failure is a server error, not a definitive input rejection',async t=>{
 const env=database(t);env.APP_ORIGIN='https://sponsorintel.london';
 const original=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{if(sql.includes('FROM marketing_events'))throw Error('Fictional storage outage');return original(sql);};
 const serialized=prepareScheduleSave(brief,destination,form,now);
 const response=await marketingAPI(new Request(env.APP_ORIGIN+'/api/admin/marketing/decide',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:serialized}),env,{user:{id:'fictional-owner'}});
 assert.equal(response.status,500);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);
});

test('actual owner Worker/D1 saves once after lost acknowledgement, retains timestamps and rejects untrusted schedules without external I/O',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import {adminAPI} from './worker/admin.js';import {authFor} from './worker/auth.js';export default {fetch(r,e){return new URL(r.url).pathname.startsWith('/api/auth/')?authFor(r,e).handler(r):adminAPI(r,e);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const origin='http://127.0.0.1:8788';let outbound=0;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-schedule-save'},bindings:{AUTH_SECRET:'fictional-local-test-secret-not-a-production-credential',APP_ORIGIN:origin},outboundService:()=>{outbound++;throw Error('No external services allowed');}}));
 try{
  const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  const signup=async email=>{const r=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional owner',email,password:'Fictional-testing-264!'})});assert.equal(r.status,200);const b=await r.json();return{id:b.user.id,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};};
  const owner=await signup('schedule-owner@example.invalid'),member=await signup('schedule-member@example.invalid');await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.id,new Date().toISOString()).run();
  const at=Date.now(),iso=ms=>new Date(ms).toISOString(),env={DB:db};
  const created=await createBrief(env,{topic_key:'fictional-schedule',destination:'facebook-company',title:'Fictional reviewed guide',purpose:'Test a private schedule receipt without any real provider action.',text:'Fictional copy for an isolated local receipt test. No real post is scheduled.',sources:[{title:'Fictional guide evidence',url:'https://sponsorintel.london/guides/build-a-shortlist',excerpt:'Fictional source excerpt retained only in the isolated test database.',checked_at:iso(at)}],expires_at:iso(at+3*86400000)},'fictional-writer',at);
  await decideBrief(env,{id:created.id,revision:1,kind:'reviewed',request_key:'fictional-review',note:'Fictional test review of complete copy, source and destination.',checks:{claims:true,sources:true,destination:true,duplication:true}},'fictional-reviewer',at);
  const body=prepareScheduleSave({...brief,id:created.id,expires_at:iso(at+3*86400000)},destination,{...form,observed:iso(at-1234),scheduled:iso(at+86400000+123)},at,'fictional-pinned-key');
  const dispatch=(cookie,payload=body,source=origin)=>mf.dispatchFetch(origin+'/api/admin/marketing/decide',{method:'POST',headers:{Origin:source,Cookie:cookie,'Content-Type':'application/json'},body:payload});
  assert.equal((await dispatch('')).status,403);assert.equal((await dispatch(member.cookie)).status,403);assert.equal((await dispatch(owner.cookie,body,'https://untrusted.invalid')).status,403);
  const malformed=JSON.parse(body);malformed.receipt.account='wrong-account';assert.equal((await dispatch(owner.cookie,JSON.stringify(malformed))).status,400);
  const posted=[];let first=true;
  const transport=async(path,init)=>{assert.equal(path,'/api/admin/marketing/decide');posted.push(init.body);const response=await dispatch(owner.cookie,init.body);if(first){first=false;assert.equal(response.status,200);throw Error('Acknowledgement lost after commit');}return response;};
  await assert.rejects(sendScheduleSave(body,transport),e=>e.uncertain);
  const replay=await sendScheduleSave(body,transport);assert.equal(replay.replayed,true);assert.deepEqual(posted,[body,body]);
  const rows=await db.prepare('SELECT * FROM marketing_receipts').all();assert.equal(rows.results.length,1);assert.equal(rows.results[0].observed_at,iso(at-1234));assert.equal(rows.results[0].scheduled_at,iso(at+86400000+123));assert.match(rows.results[0].evidence,/Agent-assisted observation/);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='scheduled'").first()).n,1);
  assert.equal((await db.prepare('SELECT state FROM marketing_briefs WHERE id=?').bind(created.id).first()).state,'scheduled');
  const competing=JSON.parse(body);competing.request_key='another-key';assert.equal((await dispatch(owner.cookie,JSON.stringify(competing))).status,409);
  assert.equal(outbound,0);
 }finally{await mf.dispose();}
});
