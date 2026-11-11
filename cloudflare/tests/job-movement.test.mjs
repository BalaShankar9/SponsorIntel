import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {captureJobMovement,jobMovementHealth,jobMovementFindings} from '../worker/job-movement.js';
const start=Date.parse('2026-10-08T15:00:00.000Z'),hour=3600000;
const at=t=>new Date(t).toISOString();
function run(env,id,time=start,origin='scheduled'){env.sql.prepare("UPDATE business_runs SET state='completed' WHERE state IN ('queued','running')").run();env.sql.prepare("INSERT INTO business_runs(id,state,created_at,trigger_kind) VALUES(?,'queued',?,?)").run(id,at(time),origin);}
function job(env,id,patch={}){const row={id,board_id:'example',company:'Example',title:'Engineer '+id,location:'London, UK',description:'Public description',apply_url:'https://example.com/job/'+id,provider:'greenhouse',level:'experienced',sponsorship:'offered',evidence:'Visa sponsorship is available.',first_seen:at(start),last_seen:at(start),active:1,...patch};const keys=Object.keys(row);env.sql.prepare(`INSERT INTO jobs(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row));}

test('baseline preserves distinct offered/conditional counts without inventing new discoveries',async t=>{
 const env=database(t);run(env,'one');job(env,'a');job(env,'b',{sponsorship:'conditional'});job(env,'c',{sponsorship:'not_stated',evidence:''});
 job(env,'stale',{last_seen:at(start-73*hour)});job(env,'expired',{closes_at:at(start)});job(env,'inactive',{active:0});
 const receipt=await captureJobMovement(env,'one',start);
 assert.equal(receipt.state,'recorded');assert.equal(receipt.baseline,1);assert.equal(receipt.previous_at,null);assert.equal(receipt.trigger_kind,'scheduled');
 assert.deepEqual(receipt.counts,{total:3,employers:1,offered:1,conditional:1,unavailable:0,not_stated:1});
 assert.equal(receipt.changes.entered,0);assert.equal(receipt.changes.stated_gained,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_movement_events').get().n,0);
 assert.equal((await jobMovementHealth(env,start)).status,'baseline');
});

test('flat total reconciles a newly observed conditional role with an offered role leaving',async t=>{
 const env=database(t);job(env,'old');job(env,'retained',{sponsorship:'conditional'});run(env,'one');await captureJobMovement(env,'one',start);
 env.sql.prepare("UPDATE jobs SET active=0 WHERE id='old'").run();job(env,'new',{sponsorship:'conditional',board_id:'new-employer',company:'New employer'});
 run(env,'two',start+hour);const second=await captureJobMovement(env,'two',start+hour);
 assert.equal(second.baseline,0);assert.equal(second.before_counts.offered+second.before_counts.conditional,2);assert.equal(second.counts.offered+second.counts.conditional,2);
 assert.equal(second.changes.entered,1);assert.equal(second.changes.left,1);assert.equal(second.changes.stated_gained,1);assert.equal(second.changes.stated_lost,1);
 const events=(await jobMovementHealth(env,start+hour)).events;
 assert.equal(events.find(x=>x.job_id==='old').reason,'inactive_record');assert.equal(events.find(x=>x.job_id==='new').before_sponsorship,null);
 assert.equal(second.counts.employers,2);
});

test('label and evidence changes retain both quotations and reconcile gains and losses',async t=>{
 const env=database(t);for(const id of ['lose','gain','same-positive','quote'])job(env,id,{sponsorship:id==='gain'?'not_stated':'offered'});
 run(env,'one');await captureJobMovement(env,'one',start);
 env.sql.prepare("UPDATE jobs SET sponsorship='unavailable',evidence='No visa sponsorship.' WHERE id='lose'").run();
 env.sql.prepare("UPDATE jobs SET sponsorship='conditional',evidence='Sponsorship may be possible.' WHERE id IN ('gain','same-positive')").run();
 env.sql.prepare("UPDATE jobs SET evidence='We offer visa sponsorship for this vacancy.' WHERE id='quote'").run();
 run(env,'two',start+hour);const next=await captureJobMovement(env,'two',start+hour);
 assert.equal(next.changes.sponsorship_changed,3);assert.equal(next.changes.evidence_changed,1);assert.equal(next.changes.stated_gained,1);assert.equal(next.changes.stated_lost,1);
 const loss=(await jobMovementHealth(env,start+hour)).events.find(x=>x.job_id==='lose');
 assert.equal(loss.before_evidence,'Visa sponsorship is available.');assert.equal(loss.after_evidence,'No visa sponsorship.');
 assert.equal(next.counts.offered+next.counts.conditional,next.before_counts.offered+next.before_counts.conditional+next.changes.stated_gained-next.changes.stated_lost);
});

test('deadline and freshness exits are observed without falsely asserting employer closure; reactivation is returned',async t=>{
 const env=database(t);job(env,'deadline',{closes_at:at(start+hour)});job(env,'stale',{last_seen:at(start-71*hour)});job(env,'invalid');
 run(env,'one');await captureJobMovement(env,'one',start);
 env.sql.prepare("UPDATE jobs SET last_seen='not-a-date' WHERE id='invalid'").run();
 run(env,'two',start+hour);const r=await captureJobMovement(env,'two',start+hour);
 assert.equal(r.changes.left,3);assert.equal(r.counts.total,0);
 const health=await jobMovementHealth(env,start+hour);
 assert.equal(health.events.find(x=>x.job_id==='deadline').reason,'deadline_passed');assert.equal(health.events.find(x=>x.job_id==='stale').reason,'source_stale');assert.equal(health.events.find(x=>x.job_id==='invalid').reason,'not_current');
 env.sql.prepare("UPDATE jobs SET last_seen=? WHERE id='stale'").run(at(start+2*hour));
 run(env,'three',start+2*hour);const returned=await captureJobMovement(env,'three',start+2*hour);
 assert.equal(returned.changes.returned,1);assert.equal(returned.changes.entered,0);assert.equal(returned.changes.stated_gained,1);
});

test('replay and overlapping older observations cannot duplicate changes or rewind state',async t=>{
 const env=database(t);job(env,'a');run(env,'one');const one=await captureJobMovement(env,'one',start);
 job(env,'b');assert.deepEqual(await captureJobMovement(env,'one',start+hour),one);
 run(env,'newer',start+2*hour);const newer=await captureJobMovement(env,'newer',start+2*hour);
 run(env,'older',start+hour);assert.equal((await captureJobMovement(env,'older',start+hour)).state,'not_recorded');
 run(env,'same-time',start+2*hour);assert.equal((await captureJobMovement(env,'same-time',start+2*hour)).state,'not_recorded');
 assert.equal((await jobMovementHealth(env,start+2*hour)).latest.id,'newer');assert.equal(newer.changes.entered,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_movement_events').get().n,1);
});

test('pause, unknown and terminal business runs cannot advance the observation',async t=>{
 const env=database(t);job(env,'a');run(env,'one');env.sql.prepare('UPDATE business_controls SET enabled=0').run();
 assert.equal((await captureJobMovement(env,'one',start)).state,'not_recorded');
 env.sql.prepare('UPDATE business_controls SET enabled=1').run();
 assert.equal((await captureJobMovement(env,'missing',start)).state,'not_recorded');
 env.sql.prepare("UPDATE business_runs SET state='completed'").run();assert.equal((await captureJobMovement(env,'one',start)).state,'not_recorded');
 assert.equal((await jobMovementHealth(env,start)).status,'awaiting_baseline');
});

test('failed transaction leaves neither a partial observation nor changed state and can retry',async t=>{
 const env=database(t);job(env,'a');run(env,'one');await captureJobMovement(env,'one',start);job(env,'b');run(env,'two',start+hour);
 env.sql.exec("CREATE TRIGGER fail_movement BEFORE UPDATE OF counts ON job_movement_runs BEGIN SELECT RAISE(ABORT,'test failure'); END;");
 await assert.rejects(captureJobMovement(env,'two',start+hour),/test failure/);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_movement_runs').get().n,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_movement_events').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_movement_state').get().n,1);
 env.sql.exec('DROP TRIGGER fail_movement');assert.equal((await captureJobMovement(env,'two',start+hour)).changes.entered,1);
});

test('health limits detail but retains full aggregate changes and flags concentration and overdue observation',async t=>{
 const env=database(t);run(env,'one');await captureJobMovement(env,'one',start);
 for(let i=0;i<60;i++)job(env,'a'+i);
 run(env,'two',start+hour,'owner');await captureJobMovement(env,'two',start+hour);
 const health=await jobMovementHealth(env,start+hour);
 assert.equal(health.events.length,50);assert.equal(health.days[0].entered,60);assert.equal(health.days[0].stated_gained,60);assert.equal(health.latest.trigger_kind,'owner');
 assert.ok(jobMovementFindings(health).some(x=>x.id==='source-concentration'));
 assert.ok(jobMovementFindings(await jobMovementHealth(env,start+4*hour)).some(x=>x.id==='job-movement-overdue'));
 assert.equal((await jobMovementHealth(env,start+hour,{compact:true})).events,undefined);
 env.sql.prepare('UPDATE business_controls SET enabled=0').run();assert.deepEqual(jobMovementFindings(await jobMovementHealth(env,start+4*hour)),[]);
});
