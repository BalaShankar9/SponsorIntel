import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {database} from './research-db.mjs';
import {feedbackAPI} from '../worker/feedback.js';
import {supportSnapshot,supportHistory,updateSupport,supportAPI} from '../worker/support.js';
import {adminAPI} from '../worker/admin.js';
import {collectBusinessSnapshot,businessFindings,recordBusinessFindings} from '../worker/business-operations.js';
const now=Date.now(),stamp=new Date(now).toISOString(),owner={user:{id:'test-owner'}};
function seed(env,{id=crypto.randomUUID(),kind='bug',created=new Date(now-9*86400000).toISOString(),message='PRIVATE CUSTOMER MESSAGE <script>untrusted</script>'}={}){
 env.sql.prepare('INSERT INTO feedback(id,kind,message,created_at,context,app_version) VALUES(?,?,?,?,?,?)').run(id,kind,message,created,'{"page":"/studio"}','previous-release');return id;
}
const change=(id,patch={})=>({id,operation_id:crypto.randomUUID(),version:0,state:'in_progress',note:'Reproducing the reported behaviour locally.',...patch});
function request(path,body,origin='https://sponsorintel.london'){
 return new Request('https://sponsorintel.london/api/admin/support'+path,body?{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
}
test('migration preserves legacy messages and dates while routing each existing category',()=>{
 const sql=new DatabaseSync(':memory:');try{
  sql.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  sql.exec("CREATE TABLE admin_audit(actor TEXT,action TEXT,target TEXT,created_at TEXT)");
  for(const kind of ['bug','data','feedback'])sql.prepare('INSERT INTO feedback VALUES(?,?,?,?)').run(kind,kind,'private '+kind,'2026-09-01T00:00:00.000Z');
  sql.exec(readFileSync(new URL('../migrations/0017_support_queue.sql',import.meta.url),'utf8'));
  const rows=sql.prepare('SELECT * FROM feedback ORDER BY kind').all();
  assert.deepEqual(rows.map(x=>[x.kind,x.support_queue]),[['bug','engineering'],['data','evidence'],['feedback','product']]);
  assert.ok(rows.every(x=>x.support_state==='new'&&x.support_version===0&&x.created_at==='2026-09-01T00:00:00.000Z'&&x.message==='private '+x.kind));
 }finally{sql.close();}
});
test('new public reports route atomically without AI or changing the submitter receipt',async t=>{
 const env=database(t);env.AI={run:()=>{throw Error('Private messages must not reach AI');}};
 for(const [kind,queue] of [['bug','engineering'],['data','evidence'],['feedback','product']]){
  const r=await feedbackAPI(new Request('https://sponsorintel.london/api/feedback',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify({kind,message:'A fictional report for local verification.',context:{page:'/studio'}})}),env);
  assert.equal(r.status,201);const {id}=await r.json();const row=env.sql.prepare('SELECT support_queue,support_state FROM feedback WHERE id=?').get(id);assert.equal(row.support_queue,queue);assert.equal(row.support_state,'new');
 }
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM support_events').get().n,0);
});
test('all unresolved ages remain visible with stable bounded pagination and exact filters',async t=>{
 const env=database(t);const ids=[];
 for(let i=0;i<60;i++)ids.push(seed(env,{kind:i%2?'data':'bug',created:stamp}));
 let cursor=null,seen=[];do{const p=new URLSearchParams();if(cursor)p.set('cursor',cursor);const page=await supportSnapshot(env,p,now);assert.ok(page.items.length<=25);seen.push(...page.items.map(x=>x.id));cursor=page.next_cursor;}while(cursor);
 assert.equal(seen.length,60);assert.equal(new Set(seen).size,60);assert.deepEqual(seen,ids.sort());
 const filtered=await supportSnapshot(env,new URLSearchParams({queue:'evidence'}),now);assert.ok(filtered.items.every(x=>x.kind==='data'));
 for(const params of [{queue:"' OR 1=1 --"},{state:'deleted'},{cursor:'bad'},{cursor:btoa('{}')}])await assert.rejects(supportSnapshot(env,new URLSearchParams(params),now));
});
test('reviews preserve the original report, require evidence notes, retain history and allow reopening',async t=>{
 const env=database(t),id=seed(env);const original=env.sql.prepare('SELECT message,created_at FROM feedback WHERE id=?').get(id);
 await assert.rejects(updateSupport(env,change(id,{state:'resolved',note:'done'}),owner.user.id),/review note/);
 await assert.rejects(updateSupport(env,change(id,{state:'resolved',note:'The bug was fixed.'}),owner.user.id),/30 characters/);
 assert.equal((await updateSupport(env,change(id),owner.user.id,now)).version,1);
 assert.equal((await updateSupport(env,change(id,{version:1,state:'resolved',note:'Fixed the local reproduction and verified keyboard submission in the test environment.'}),owner.user.id,now)).version,2);
 let snapshot=await supportSnapshot(env);assert.equal(snapshot.summary.open,0);assert.equal(snapshot.summary.resolved,1);assert.equal(snapshot.items.length,0);
 await updateSupport(env,change(id,{version:2,state:'new',note:'Reopened after a new reproducible regression.'}),owner.user.id,now);
 snapshot=await supportSnapshot(env);assert.equal(snapshot.summary.open,1);assert.equal(snapshot.items[0].support_state,'new');
 assert.deepEqual(env.sql.prepare('SELECT message,created_at FROM feedback WHERE id=?').get(id),original);
 assert.equal((await supportHistory(env,id)).events.length,3);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,3);
 assert.throws(()=>env.sql.prepare('DELETE FROM support_events').run(),/immutable/);
 assert.throws(()=>env.sql.prepare("UPDATE support_events SET note='different private note'").run(),/immutable/);
});
test('duplicate acknowledgements replay, conflicting operation IDs and stale reviews cannot overwrite',async t=>{
 const env=database(t),id=seed(env),body=change(id);
 assert.equal((await updateSupport(env,body,owner.user.id)).ok,true);
 assert.equal((await updateSupport(env,body,owner.user.id)).replayed,true);
 assert.equal((await updateSupport(env,{...body,note:'A changed action cannot reuse its old operation ID.'},owner.user.id)).status,409);
 assert.equal((await updateSupport(env,change(id),owner.user.id)).status,409);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM support_events').get().n,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
 const nextA=change(id,{version:1}),nextB=change(id,{version:1});const results=await Promise.all([updateSupport(env,nextA,owner.user.id),updateSupport(env,nextB,owner.user.id)]);
 assert.equal(results.filter(x=>x.ok).length,1);assert.equal(results.filter(x=>x.status===409).length,1);
});
test('an audit failure rolls back the event and state together without a false resolution',async t=>{
 const env=database(t),id=seed(env);
 env.sql.exec("CREATE TRIGGER fail_support_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END");
 await assert.rejects(updateSupport(env,change(id),owner.user.id),/storage failure/);
 assert.equal(env.sql.prepare('SELECT support_state FROM feedback').get().support_state,'new');
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM support_events').get().n,0);
});
test('owner boundary, origin, invalid transitions and mutation fields are enforced',async t=>{
 const env=database(t),id=seed(env);
 for(const path of ['/api/admin/support','/api/admin/support/history?id='+id,'/api/admin/support/review'])assert.equal((await adminAPI(new Request('https://sponsorintel.london'+path),env)).status,403);
 assert.equal((await supportAPI(request('/review',change(id),'https://elsewhere.example'),env,owner)).status,403);
 for(const patch of [{state:'deleted'},{version:-1},{note:'short'},{extra:'ignore validation'},{operation_id:'guess'}])assert.equal((await supportAPI(request('/review',change(id,patch)),env,owner)).status,400);
 const r=await supportAPI(request('/review',change(id)),env,owner);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await supportAPI(request('/history?id=bad'),env,owner)).status,400);
 assert.equal((await supportAPI(request('/history?id='+crypto.randomUUID()),env,owner)).status,404);
});
test('business monitoring sees old open reports until a recorded outcome and never copies private content',async t=>{
 const env=database(t),id=seed(env);
 const fetcher=async url=>new Response(null,{status:url.endsWith('/session')?403:200,headers:{'x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'none'"}});
 let s=await collectBusinessSnapshot(env,fetcher,now);assert.equal(s.feedback_count,1);assert.equal(s.support.overdue_quality,1);assert.equal(s.support.overdue,1);
 assert.ok(businessFindings(s,now).some(x=>x.id==='feedback'&&x.severity==='high'));assert.doesNotMatch(JSON.stringify(s),/PRIVATE CUSTOMER|<script>|\/studio/);
 await recordBusinessFindings(env,'first',s);assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='feedback'").get().state,'open');
 await updateSupport(env,change(id,{state:'closed',note:'Fictional local case closed without a fix after verification of the queue behaviour.'}),owner.user.id,now);
 s=await collectBusinessSnapshot(env,fetcher,now);assert.equal(s.feedback_count,0);assert.equal(s.support.closed,1);
 assert.doesNotMatch(JSON.stringify(s),/Fictional local|PRIVATE CUSTOMER/);
 await recordBusinessFindings(env,'second',s);assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='feedback'").get().state,'resolved');
});
