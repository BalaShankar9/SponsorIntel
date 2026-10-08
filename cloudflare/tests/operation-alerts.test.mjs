import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {configureOperationAlerts,scanOperationAlerts,operationAlertsStatus,operationAlertsAPI,operationAlertSnapshot} from '../worker/operation-alerts.js';
import {adminAPI} from '../worker/admin.js';
const now=Date.now(),iso=n=>new Date(n).toISOString(),DAY=86400000;
function fixture(t,id='owner-one'){
 const env=database(t),sent=[];
 env.sql.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(id,'Fictional owner',id+'@example.invalid',1,now,now);
 env.sql.prepare('INSERT INTO admin_members(user_id,created_at) VALUES(?,?)').run(id,iso(now));
 env.sql.prepare("INSERT INTO business_runs(id,state,created_at,finished_at) VALUES('current','completed',?,?)").run(iso(now),iso(now));
 env.EMAIL_VERIFICATION_ENABLED='true';env.EMAIL={send:async mail=>{sent.push(mail);return {messageId:'synthetic-'+sent.length};}};
 return {env,id,sent};
}
function issue(env,name='route',severity='critical'){
 env.sql.prepare('INSERT OR REPLACE INTO business_issues(id,category,severity,title,detail,next_action,state,first_seen,last_seen) VALUES(?,?,?,?,?,?,?, ?,?)').run(name,'health',severity,'PRIVATE TITLE','PRIVATE CUSTOMER CONTENT <script>https://evil.example/token</script>','PRIVATE ACTION','open',iso(now),iso(now));
}
const enable=(env,id)=>configureOperationAlerts(env,id,{enabled:true,revision:null},now);
const req=(path,body,origin='https://sponsorintel.london')=>new Request('https://sponsorintel.london/api/admin/business/alerts'+path,body?{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}:{});

test('alerts default off, require verified owner opt-in, and contain only aggregate operational information',async t=>{
 const {env,id,sent}=fixture(t);issue(env);assert.equal((await scanOperationAlerts(env,now)).owners,0);assert.equal(sent.length,0);
 env.sql.prepare('UPDATE user SET emailVerified=0').run();await assert.rejects(enable(env,id),{status:403});env.sql.prepare('UPDATE user SET emailVerified=1').run();
 await enable(env,id);assert.equal((await scanOperationAlerts(env,now)).accepted,1);assert.equal(sent[0].to,id+'@example.invalid');
 assert.match(sent[0].text,/1 critical and 0 high-priority/);assert.match(sent[0].text,/https:\/\/sponsorintel.london\/admin#operation-alerts/);
 assert.doesNotMatch(JSON.stringify(sent[0]),/PRIVATE|evil\.example|<script>/);
 assert.equal((await operationAlertsStatus(env,id)).deliveries[0].state,'accepted');assert.equal((await operationAlertsStatus(env,id)).deliveries[0].received_at,null);
});
test('unchanged findings deduplicate, reminders are daily, and recovery follows a previously accepted incident',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);await scanOperationAlerts(env,now);assert.equal(sent.length,0);
 issue(env);await scanOperationAlerts(env,now);await scanOperationAlerts(env,now+60000);assert.equal(sent.length,1);
 env.sql.prepare('UPDATE business_runs SET created_at=?').run(iso(now+DAY));await scanOperationAlerts(env,now+DAY);assert.equal(sent.length,2);
 env.sql.prepare("UPDATE business_issues SET state='resolved'").run();await scanOperationAlerts(env,now+DAY+60000);assert.equal(sent.length,3);assert.match(sent[2].subject,/findings cleared/);
 await scanOperationAlerts(env,now+DAY+120000);assert.equal(sent.length,3);
});
test('parallel scans reserve one send and uncertain results hold subsequent attempts without a retry',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);issue(env);
 let unblock,started;const begun=new Promise(r=>started=r),gate=new Promise(r=>unblock=r);
 env.EMAIL.send=async mail=>{sent.push(mail);started();await gate;throw Error('Response lost after possible acceptance');};
 const first=scanOperationAlerts(env,now);await begun;assert.equal((await scanOperationAlerts(env,now+1)).held,1);unblock();await first;
 assert.equal((await operationAlertsStatus(env,id)).deliveries[0].state,'uncertain');await scanOperationAlerts(env,now+DAY);assert.equal(sent.length,1);
 const delivery=(await operationAlertsStatus(env,id)).deliveries[0];const r=await operationAlertsAPI(req('/received',{id:delivery.id}),env,{user:{id}});assert.equal(r.status,200);
 assert.equal((await operationAlertsStatus(env,id)).pending,null);assert.equal((await operationAlertsStatus(env,id)).deliveries[0].state,'confirmed');
});
test('removed owner access, changed email and paused operations cannot send; stale setting writes cannot undo a pause',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);issue(env);
 await configureOperationAlerts(env,id,{enabled:false,revision:1},now+1);await assert.rejects(configureOperationAlerts(env,id,{enabled:true,revision:1}),{status:409});await scanOperationAlerts(env,now);assert.equal(sent.length,0);
 await configureOperationAlerts(env,id,{enabled:true,revision:2});env.sql.prepare("UPDATE user SET email='new@example.invalid'").run();await scanOperationAlerts(env,now);assert.equal(sent.length,0);assert.equal((await operationAlertsStatus(env,id)).address_changed,true);
 env.sql.prepare('UPDATE user SET email=?').run(id+'@example.invalid');env.sql.prepare('UPDATE business_controls SET enabled=0').run();assert.equal((await scanOperationAlerts(env,now)).state,'paused');
 env.sql.prepare('UPDATE business_controls SET enabled=1').run();env.sql.prepare('DELETE FROM admin_members').run();await scanOperationAlerts(env,now);assert.equal(sent.length,0);
});
test('an unverified owner can still disable previously enabled alerts',async t=>{
 const {env,id}=fixture(t);await enable(env,id);env.sql.prepare('UPDATE user SET emailVerified=0').run();await configureOperationAlerts(env,id,{enabled:false,revision:1});assert.equal((await operationAlertsStatus(env,id)).enabled,false);
});
test('daily limits cover changed incidents and tests; a test cannot be used as an unrestricted email endpoint',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);
 const test=await operationAlertsAPI(req('/test',{revision:1,to:'attacker@example.invalid'}),env,{user:{id}});assert.equal((await test.json()).state,'accepted');
 assert.equal((await (await operationAlertsAPI(req('/test',{revision:1}),env,{user:{id}})).json()).state,'held');
 for(let i=0;i<5;i++){issue(env,'event-'+i);await scanOperationAlerts(env,now+i*1000);}
 assert.equal(sent.length,4);assert.ok(sent.every(m=>m.to===id+'@example.invalid'));
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM operation_alert_deliveries').get().n,4);
});
test('failed and overdue business runs raise a critical alert independently of the business workflow',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);env.sql.prepare("UPDATE business_runs SET state='failed'").run();assert.equal((await operationAlertSnapshot(env,now)).critical,1);await scanOperationAlerts(env,now);assert.equal(sent.length,1);
 env.sql.prepare("UPDATE business_runs SET state='completed',created_at=?").run(iso(now-3*3600000));await scanOperationAlerts(env,now+1000);assert.equal(sent.length,2);
 env.sql.prepare('UPDATE business_runs SET created_at=?').run(iso(now+86400000));assert.equal((await operationAlertSnapshot(env,now)).critical,1);
});
test('private endpoints deny anonymous/foreign-origin requests and cross-owner receipt confirmation',async t=>{
 const {env,id}=fixture(t);await enable(env,id);
 assert.equal((await adminAPI(req(''),env)).status,403);
 assert.equal((await operationAlertsAPI(req('/settings',{enabled:false,revision:1},'https://evil.example'),env,{user:{id}})).status,403);
 const r=await operationAlertsAPI(req('/test',{revision:1}),env,{user:{id}}),receipt=await r.json();
 assert.equal((await operationAlertsAPI(req('/received',{id:receipt.id}),env,{user:{id:'other'}})).status,404);
 assert.equal((await operationAlertsStatus(env,'other')).deliveries.length,0);
 const status=await operationAlertsAPI(req(''),env,{user:{id}});assert.equal(status.headers.get('cache-control'),'no-store');
});
test('an absent provider receipt is uncertain and never treated as successful delivery',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);issue(env);env.EMAIL.send=async mail=>{sent.push(mail);return {};};await scanOperationAlerts(env,now);
 assert.equal((await operationAlertsStatus(env,id)).deliveries[0].state,'uncertain');await scanOperationAlerts(env,now+60000);assert.equal(sent.length,1);
});
test('a pause during reservation cancels the message before provider handoff',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);issue(env);
 const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=query=>{const p=prepare(query);if(query.startsWith('SELECT s.enabled')){const first=p.first.bind(p);p.first=async()=>{env.sql.prepare('UPDATE operation_alert_settings SET enabled=0,revision=revision+1').run();return first();};}return p;};
 await scanOperationAlerts(env,now);assert.equal(sent.length,0);assert.equal((await operationAlertsStatus(env,id)).deliveries[0].state,'cancelled');
});
test('a hung provider times out to an uncertain receipt and cannot be sent again',async t=>{
 const {env,id}=fixture(t);await enable(env,id);issue(env);let ready,calls=0;const started=new Promise(r=>ready=r);
 t.mock.timers.enable({apis:['setTimeout']});env.EMAIL.send=()=>{calls++;ready();return new Promise(()=>{});};
 const run=scanOperationAlerts(env,now);await started;t.mock.timers.tick(15001);await run;
 assert.equal((await operationAlertsStatus(env,id)).deliveries[0].state,'uncertain');await scanOperationAlerts(env,now+DAY);assert.equal(calls,1);
});
test('the five-owner limit is enforced in storage, and the shared daily cap bounds all recipients',async t=>{
 const {env,id,sent}=fixture(t);await enable(env,id);
 for(let i=2;i<=6;i++){const name='owner-'+i;env.sql.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(name,'Fictional',name+'@example.invalid',1,now,now);env.sql.prepare('INSERT INTO admin_members(user_id,created_at) VALUES(?,?)').run(name,iso(now));if(i<=5)await enable(env,name);else await assert.rejects(enable(env,name),/Five owners/);}
 assert.throws(()=>env.sql.prepare("INSERT INTO operation_alert_settings(user_id,enabled,destination,updated_at) VALUES('owner-6',1,'owner-6@example.invalid',?)").run(iso(now)),/Five alert owners/);
 for(let i=0;i<6;i++){issue(env,'finding-'+i);await scanOperationAlerts(env,now+i*1000);}
 assert.equal(sent.length,20);assert.equal(new Set(sent.map(m=>m.to)).size,5);
});
