import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {syncMarketing,decideBrief} from '../worker/marketing.js';
import {socialDeliveryHealth,socialDeliveryFindings,summarizeSocialDelivery,DELIVERY_GRACE_MS} from '../worker/social-delivery-health.js';
import {businessSnapshot} from '../worker/business-operations.js';
import {adminAPI} from '../worker/admin.js';
const due=Date.parse('2026-10-08T09:00:00Z'),iso=now=>new Date(now).toISOString();
const publishedURL='https://www.facebook.com/122093616117512994/posts/122093924469512994';
const outcome=(kind,revision,now,patch={})=>({id:'launch-fb-evidence',revision,kind,request_key:crypto.randomUUID(),note:'Fictional local receipt for checking delivery monitoring; no external action.',receipt:{provider:'metricool',account:'1319703417896763',external_id:'fixture-post',observed_at:iso(now),evidence:'Fictional provider observation for this isolated runtime test.',post_url:publishedURL,...patch}});

test('observed launch publication replaces pending status while preserving original schedule history',async t=>{
 const env=database(t);await syncMarketing(env,due-86400000);
 let health=await socialDeliveryHealth(env,due+600000);
 assert.equal(health.scheduled,4);assert.equal(health.awaiting_check,1);assert.equal(health.overdue,0);assert.equal(health.published_30d,0);
 await decideBrief(env,outcome('published',1,due+600000),'operator',due+600000);
 health=await socialDeliveryHealth(env,due+600001);
 assert.equal(health.scheduled,3);assert.equal(health.published_30d,1);assert.equal(health.awaiting_check,0);assert.equal(health.overdue,0);
 assert.equal(health.next_scheduled_at,'2026-10-09T09:00:00.000Z');
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_receipts WHERE brief_id='launch-fb-evidence' AND scheduled_at IS NOT NULL").get().n,1);
 assert.equal(socialDeliveryFindings(health).length,0);
 assert.doesNotMatch(JSON.stringify(health),/846 roles|fixture-post|facebook.com|1319703417896763|Fictional/);
});
test('thirty-minute grace distinguishes a pending observation from a failed provider job',async t=>{
 const env=database(t);await syncMarketing(env,due-86400000);
 assert.equal((await socialDeliveryHealth(env,due+DELIVERY_GRACE_MS-1)).overdue,0);
 const health=await socialDeliveryHealth(env,due+DELIVERY_GRACE_MS);
 assert.equal(health.overdue,1);assert.equal(health.failed_30d,0);
 const findings=socialDeliveryFindings(health);
 assert.equal(findings[0].id,'social-delivery-overdue');assert.equal(findings[0].severity,'high');assert.match(findings[0].detail,/does not establish provider failure/);
 await decideBrief(env,outcome('published',1,due+DELIVERY_GRACE_MS),'operator',due+DELIVERY_GRACE_MS);
 assert.ok(!socialDeliveryFindings(await socialDeliveryHealth(env,due+DELIVERY_GRACE_MS)).some(x=>x.id==='social-delivery-overdue'));
});
test('uncertain and confirmed failed outcomes remain distinct and checks cannot send or mutate',async t=>{
 const env=database(t);await syncMarketing(env,due-86400000);
 await decideBrief(env,outcome('uncertain',1,due+600000),'operator',due+600000);
 let health=await socialDeliveryHealth(env,due+600000);
 assert.equal(health.uncertain,1);assert.equal(health.overdue,0);assert.equal(health.published_30d,0);
 assert.ok(socialDeliveryFindings(health).some(x=>x.id==='social-delivery-uncertain'&&x.severity==='high'));
 await decideBrief(env,outcome('failed',2,due+700000),'operator',due+700000);
 const before=env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n;
 health=await socialDeliveryHealth(env,due+700000);
 assert.equal(health.uncertain,0);assert.equal(health.failed_30d,1);
 assert.ok(socialDeliveryFindings(health).some(x=>x.id==='social-delivery-failed'&&x.severity==='normal'));
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n,before);
 assert.equal((await socialDeliveryHealth(env,due+31*86400000)).failed_30d,0);
});
test('missing, inconsistent and future receipt evidence cannot look healthy',async t=>{
 const env=database(t);await syncMarketing(env,due-86400000);
 for(const change of ["observed_at='invalid'","observed_at='2030-01-01T00:00:00Z'","scheduled_at=NULL","version=99","state='published'"]){
  env.sql.exec('SAVEPOINT invalid_case');
  env.sql.prepare("UPDATE marketing_receipts SET "+change+" WHERE brief_id='launch-fb-evidence'").run();
  const h=await socialDeliveryHealth(env,due);assert.equal(h.invalid_records,1,change);assert.ok(socialDeliveryFindings(h).some(x=>x.id==='social-delivery-records'));
  env.sql.exec('ROLLBACK TO invalid_case; RELEASE invalid_case');
 }
 env.sql.prepare("DELETE FROM marketing_receipts WHERE brief_id='launch-fb-evidence'").run();
 assert.equal((await socialDeliveryHealth(env,due)).invalid_records,1);
});
test('bounded and unavailable checks surface incomplete evidence without inventing provider results',async()=>{
 const h=summarizeSocialDelivery(Array.from({length:501},()=>({state:'uncertain',receipt_state:'uncertain',version:1,receipt_version:1,external_id:'private-reference',observed_at:iso(due)})),due);
 assert.equal(h.limited,true);assert.equal(h.records_checked,500);assert.ok(socialDeliveryFindings(h).some(x=>x.id==='social-delivery-records'));
 const failed=await socialDeliveryHealth({DB:{prepare(){throw Error('PRIVATE DATABASE ERROR');}}},due);
 assert.deepEqual(failed,{available:false,checked_at:iso(due)});assert.equal(socialDeliveryFindings(failed)[0].severity,'high');
 assert.deepEqual(socialDeliveryFindings(undefined),[]);
});
test('owner business response includes aggregate delivery status and anonymous access remains denied',async t=>{
 const env=database(t);await syncMarketing(env,due-86400000);
 const state=await businessSnapshot(env);assert.equal(state.social_delivery.available,true);assert.equal(state.social_delivery.scheduled,4);
 assert.equal((await adminAPI(new Request('https://sponsorintel.london/api/admin/business'),env)).status,403);
});
