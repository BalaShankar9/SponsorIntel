import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {recordEmailEvent,consumeEmailEvents,emailRecipientKey,alertEmailBlock,emailDeliveryHealth,emailDeliveryFindings,retainEmailEvents,messageKey} from '../worker/email-events.js';
import {configureOperationAlerts,operationAlertsAPI,operationAlertsStatus,scanOperationAlerts} from '../worker/operation-alerts.js';
const now=Date.now(),DAY=86400000,iso=n=>new Date(n).toISOString(),recipient='fictional-owner@example.invalid';
function fixture(t){
 const env=database(t);env.EMAIL_EVENT_SUBSCRIPTION='local-subscription';
 env.sql.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run('owner','Fictional',recipient,1,now,now);
 env.sql.prepare('INSERT INTO admin_members(user_id,created_at) VALUES(?,?)').run('owner',iso(now));
 env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES('healthy','completed',?)").run(iso(now));
 const sent=[];env.EMAIL_VERIFICATION_ENABLED='true';env.EMAIL={send:async x=>{sent.push(x);return {messageId:'<known-message@sponsorintel.london>'};}};
 env.EMAIL_EVENT_QUEUE={metrics:async()=>({backlogCount:0,backlogBytes:0,oldestMessageTimestamp:0})};env.EMAIL_EVENT_DLQ=env.EMAIL_EVENT_QUEUE;
 return {env,sent};
}
function event(type='delivered',overrides={}){
 const x={type:'cf.email.sending.message.'+type,source:{type:'email.sending',zoneId:'3b8b178dc365a000e9a7df52f909e966',domain:'sponsorintel.london'},payload:{eventId:crypto.randomUUID(),messageId:'known-message@sponsorintel.london',sender:'accounts@sponsorintel.london',recipient,subject:'PRIVATE SUBJECT /reset-password?token=SECRET',terminal:type!=='deferred',delivery:{status:type,smtpResponse:'PRIVATE SMTP CONTENT'},...(type==='bounced'?{bounce:{type:'hard',reason:'PRIVATE BOUNCE'}}:{})},metadata:{accountId:'b7d80aea8a0938fe6d92342fa1ac7ea6',eventSubscriptionId:'local-subscription',eventSchemaVersion:1,eventTimestamp:iso(now)}};
 return {...x,...overrides};
}
const testMail=env=>operationAlertsAPI(new Request('https://sponsorintel.london/api/admin/business/alerts/test',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify({revision:1})}),env,{user:{id:'owner'}});
test('trusted delivery events retain only minimal metadata and never claim Inbox or owner confirmation',async t=>{
 const {env}=fixture(t);await configureOperationAlerts(env,'owner',{enabled:true,revision:null});await testMail(env);
 await recordEmailEvent(env,event(),now);const status=await operationAlertsStatus(env,'owner');
 assert.equal(status.deliveries[0].state,'accepted');assert.equal(status.deliveries[0].received_at,null);assert.equal(status.deliveries[0].provider_event.event_type,'delivered');
 const rows=env.sql.prepare('SELECT * FROM email_delivery_events').all();assert.equal(rows[0].recipient_key,await emailRecipientKey(recipient));assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|SECRET|fictional-owner/);
 assert.equal(messageKey('<known-message@sponsorintel.london>'),'known-message@sponsorintel.london');assert.equal(messageKey('><bad'),null);
});
test('duplicate and reordered events preserve a complaint and do not let later SMTP acceptance clear it',async t=>{
 const {env}=fixture(t),complaint=event('complained');await recordEmailEvent(env,complaint,now);await recordEmailEvent(env,complaint,now+1000);
 await recordEmailEvent(env,event('delivered'),now+2000);await recordEmailEvent(env,event('deferred'),now+3000);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM email_delivery_events').get().n,3);assert.equal((await alertEmailBlock(env,recipient)).reason,'complaint');
 await configureOperationAlerts(env,'owner',{enabled:true,revision:null});await configureOperationAlerts(env,'owner',{enabled:false,revision:1});await configureOperationAlerts(env,'owner',{enabled:true,revision:2});assert.equal((await operationAlertsStatus(env,'owner')).block.reason,'complaint');
});
test('foreign domains, accounts, subscriptions, sender identities, invalid schemas and timestamps cannot change delivery state',async t=>{
 const {env}=fixture(t);
 const changes=[x=>x.source.domain='carpoolnetwork.co.uk',x=>x.source.zoneId='other-zone',x=>x.metadata.accountId='other-account',x=>x.metadata.eventSubscriptionId='another',x=>x.metadata.eventSchemaVersion=2,x=>x.payload.sender='attacker@sponsorintel.london',x=>x.payload.recipient='x\n@example.invalid',x=>x.payload.delivery.status='bounced',x=>x.payload.terminal=false,x=>x.metadata.eventTimestamp=iso(now+DAY),x=>x.metadata.eventTimestamp=iso(now-15*DAY),x=>x.payload.subject='a'.repeat(17000)];
 for(const mutate of changes){const v=event();mutate(v);await assert.rejects(recordEmailEvent(env,v,now));}
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM email_delivery_events').get().n,0);
 await assert.rejects(consumeEmailEvents({queue:'another-queue',messages:[]},env));
});
test('hard bounce blocks future operational sends without using another send reservation or resetting existing daily allowance',async t=>{
 const {env,sent}=fixture(t);await configureOperationAlerts(env,'owner',{enabled:true,revision:null});await recordEmailEvent(env,event('bounced'),now);
 assert.equal((await (await testMail(env)).json()).state,'blocked');assert.equal(sent.length,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM operation_alert_deliveries').get().n,0);
 assert.equal((await operationAlertsStatus(env,'owner')).block.reason,'hard_bounce');
 env.sql.prepare("UPDATE business_runs SET state='failed'").run();assert.equal((await scanOperationAlerts(env,now)).held,1);assert.equal(sent.length,0);
});
test('temporary deferral does not block; terminal temporary failure holds for 24 hours without bypassing provider suppression',async t=>{
 const {env}=fixture(t);await recordEmailEvent(env,event('deferred'),now);assert.equal(await alertEmailBlock(env,recipient,now),null);
 const soft=event('bounced');soft.payload.bounce.type='soft';await recordEmailEvent(env,soft,now);assert.equal((await alertEmailBlock(env,recipient,now)).reason,'delivery_failure');assert.equal(await alertEmailBlock(env,recipient,now+DAY+1),null);
 await recordEmailEvent(env,event('complained'),now);await recordEmailEvent(env,event('failed'),now);assert.equal((await alertEmailBlock(env,recipient,now+DAY+1)).reason,'complaint');
});
test('provider event can precede send response; message ID and recipient must both match a receipt',async t=>{
 const {env}=fixture(t);await configureOperationAlerts(env,'owner',{enabled:true,revision:null});
 env.EMAIL.send=async()=>{await recordEmailEvent(env,event(),now);return {messageId:'<known-message@sponsorintel.london>'};};await testMail(env);
 assert.equal((await operationAlertsStatus(env,'owner')).deliveries[0].provider_event.event_type,'delivered');
 const wrong=event('complained');wrong.payload.recipient='other@example.invalid';await recordEmailEvent(env,wrong,now);
 const status=await operationAlertsStatus(env,'owner');assert.equal(status.deliveries[0].provider_event.event_type,'delivered');assert.equal(status.block,null);
});
test('acknowledgement follows durable storage and errors retry only events, never email sends',async t=>{
 const {env,sent}=fixture(t);let acks=0,retries=0;const body=event();const message={body,ack(){acks++},retry(x){assert.equal(x.delaySeconds,60);retries++}};
 const batch=env.DB.batch;env.DB.batch=async()=>{throw Error('Database unavailable with PRIVATE context');};await consumeEmailEvents({queue:'sponsorintel-email-events',messages:[message]},env);assert.equal(acks,0);assert.equal(retries,1);
 env.DB.batch=batch;await consumeEmailEvents({queue:'sponsorintel-email-events',messages:[message]},env);await consumeEmailEvents({queue:'sponsorintel-email-events',messages:[message]},env);
 assert.equal(acks,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM email_delivery_events').get().n,1);assert.equal(sent.length,0);
});
test('unknown send response stays held even if a provider event arrives without a matching receipt ID',async t=>{
 const {env}=fixture(t);await configureOperationAlerts(env,'owner',{enabled:true,revision:null});env.EMAIL.send=async()=>{await recordEmailEvent(env,event(),now);throw Error('response lost');};await testMail(env);
 const status=await operationAlertsStatus(env,'owner');assert.ok(status.pending);assert.equal(status.deliveries[0].state,'uncertain');assert.equal(status.deliveries[0].provider_event,null);
});
test('business findings surface unavailable/delayed processing and blocked owners without customer data',async t=>{
 const {env}=fixture(t);await configureOperationAlerts(env,'owner',{enabled:true,revision:null});await recordEmailEvent(env,event('bounced'),now);
 env.EMAIL_EVENT_QUEUE={metrics:async()=>({backlogCount:2,backlogBytes:200,oldestMessageTimestamp:now-16*60000})};env.EMAIL_EVENT_DLQ={metrics:async()=>({backlogCount:1,backlogBytes:100,oldestMessageTimestamp:now-1000})};
 const health=await emailDeliveryHealth(env,now),issues=emailDeliveryFindings(health,now);assert.equal(health.blocked_owners,1);assert.equal(issues.length,3);assert.doesNotMatch(JSON.stringify({health,issues}),/fictional-owner|PRIVATE|known-message/);
 env.EMAIL_EVENT_DLQ={metrics:async()=>{throw Error('unavailable');}};assert.equal((await emailDeliveryHealth(env,now)).queues.unprocessed.unavailable,true);
 assert.equal(emailDeliveryFindings({configured:true,queues:{incoming:{backlogCount:0},unprocessed:{backlogCount:0}},failures_7d:0,blocked_owners:0},now).length,0);
});
test('retention removes old event metadata and expired temporary holds while permanent complaints remain',async t=>{
 const {env}=fixture(t);await recordEmailEvent(env,event('complained'),now);
 env.sql.prepare('UPDATE email_delivery_events SET received_at=?').run(iso(now-91*DAY));
 env.sql.prepare("INSERT INTO email_alert_blocks VALUES('temporary','delivery_failure',?,?)").run(iso(now-DAY),iso(now-1));await retainEmailEvents(env,now);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM email_delivery_events').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM email_alert_blocks').get().n,1);
});
test('conflicting duplicate event IDs cannot suppress a different recipient, including concurrent inserts',async t=>{
 const one=event('delivered'),two=event('bounced');two.payload.eventId=one.payload.eventId;two.payload.recipient='other@example.invalid';
 // The first committed event owns the ID, not the first promise in an array.
 // Exercise both known orders and the genuine race without assuming digest order.
 for(const first of [one,two]){const {env}=fixture(t);await recordEmailEvent(env,first,now);await assert.rejects(recordEmailEvent(env,first===one?two:one,now),/Conflicting/);assert.equal((await alertEmailBlock(env,'other@example.invalid'))?.reason||null,first===two?'hard_bounce':null);}
 const {env}=fixture(t),results=await Promise.allSettled([recordEmailEvent(env,one,now),recordEmailEvent(env,two,now)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const winner=results[0].status==='fulfilled'?one:two,saved=env.sql.prepare('SELECT recipient_key,event_type FROM email_delivery_events').get();assert.equal(saved.recipient_key,await emailRecipientKey(winner.payload.recipient));assert.equal(saved.event_type,winner.payload.delivery.status);
 assert.equal((await alertEmailBlock(env,'other@example.invalid'))?.reason||null,winner===two?'hard_bounce':null);assert.equal(await alertEmailBlock(env,recipient),null);
});
test('a bounce arriving after reservation prevents the provider handoff',async t=>{
 const {env,sent}=fixture(t);await configureOperationAlerts(env,'owner',{enabled:true,revision:null});
 const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=q=>{const p=prepare(q);if(q.startsWith('SELECT s.enabled')){const first=p.first.bind(p);p.first=async()=>{await recordEmailEvent(env,event('bounced'),now);return first();};}return p;};
 await testMail(env);assert.equal(sent.length,0);assert.equal((await operationAlertsStatus(env,'owner')).deliveries[0].state,'cancelled');
});

test('hung queue metrics become unavailable within five seconds instead of stalling the owner desk or business run',async t=>{
 const {env}=fixture(t);t.mock.timers.enable({apis:['setTimeout']});let started,seen=0;const ready=new Promise(r=>started=r);
 const stuck={metrics(){if(++seen===2)started();return new Promise(()=>{});}};env.EMAIL_EVENT_QUEUE=stuck;env.EMAIL_EVENT_DLQ=stuck;
 const health=emailDeliveryHealth(env,now);await ready;t.mock.timers.tick(5001);const result=await health;
 assert.equal(result.queues.incoming.unavailable,true);assert.equal(result.queues.unprocessed.unavailable,true);assert.equal(emailDeliveryFindings(result,now)[0].id,'email-event-pipeline');
});
