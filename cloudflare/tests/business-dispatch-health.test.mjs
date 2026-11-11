import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {businessDispatchHealth} from '../worker/business-dispatch-health.js';
import {businessSnapshot,dispatchBusiness} from '../worker/business-operations.js';
const now=Date.parse('2026-10-26T10:00:00Z');
function seed(env,id,state='queued',time=new Date(now-7200000).toISOString()){
  env.sql.prepare('INSERT INTO business_runs(id,state,created_at,trigger_kind) VALUES(?,?,?,?)').run(id,state,time,'scheduled');
}
test('owner health finds an old blocker outside the recent twelve-run history without provider calls or writes',async t=>{
  const env=database(t);seed(env,'old-unresolved');
  for(let i=0;i<14;i++)seed(env,'new-'+i,'completed',new Date(now-i*1000).toISOString());
  env.BUSINESS_WORKFLOW={get(){throw Error('must not look up provider');},create(){throw Error('must not dispatch');}};
  const before=env.sql.prepare('SELECT * FROM business_runs ORDER BY id').all();
  const snapshot=await businessSnapshot(env);
  assert.equal(snapshot.runs.length,12);assert.ok(!snapshot.runs.some(x=>x.id==='old-unresolved'));
  assert.equal(snapshot.dispatch.unfinished_count,1);assert.equal(snapshot.dispatch.unfinished[0].id,'old-unresolved');
  assert.equal(snapshot.dispatch.provider_status_checked,false);assert.equal(snapshot.dispatch.execution_outcome,'not_determined');
  assert.deepEqual(env.sql.prepare('SELECT * FROM business_runs ORDER BY id').all(),before);
});
test('completed and paused receipts do not mask a pending reservation and zero steps never proves no execution',async t=>{
  const env=database(t);seed(env,'pending','queued',new Date(now-3600000).toISOString());seed(env,'terminal','completed');seed(env,'paused','paused');
  let result=await businessDispatchHealth(env,now);assert.equal(result.state,'pending');assert.equal(result.unfinished_count,1);assert.equal(result.unfinished[0].recorded_steps,0);
  assert.equal(result.execution_outcome,'not_determined');
  result=await businessDispatchHealth(env,now+1);assert.equal(result.state,'needs_review');
});
test('invalid and future times cannot look healthy and the schema prevents overlapping reservations',async t=>{
  const env=database(t);
  for(const time of ['not-a-date',new Date(now+300001).toISOString()]){
    seed(env,'invalid','queued',time);
    const result=await businessDispatchHealth(env,now);assert.equal(result.unfinished_count,1);assert.equal(result.state,'needs_review');
    assert.equal(result.unfinished[0].timing,'invalid');assert.equal(result.unfinished[0].age_seconds,null);
    assert.throws(()=>seed(env,'overlap'),/UNIQUE/);
    env.sql.prepare("DELETE FROM business_runs WHERE id='invalid'").run();
  }
});
test('small clock skew is tolerated and an empty queue does not claim provider or business success',async t=>{
  const env=database(t);const empty=await businessDispatchHealth(env,now);assert.equal(empty.state,'clear');assert.equal(empty.provider_status_checked,false);assert.equal(empty.execution_outcome,'not_determined');
  seed(env,'skew','running',new Date(now+300000).toISOString());const result=await businessDispatchHealth(env,now);assert.equal(result.state,'pending');assert.equal(result.unfinished[0].age_seconds,0);
});
test('paused controls retain unfinished evidence and diagnostic reads cannot clear an unknown dispatch',async t=>{
  t.mock.timers.enable({apis:['Date'],now});
  const env=database(t);seed(env,'missing-original');env.sql.prepare('UPDATE business_controls SET enabled=0').run();
  env.BUSINESS_WORKFLOW={get:async()=>{throw Error('instance_not_found');},create:async()=>{throw Error('must not dispatch');}};
  assert.equal((await businessDispatchHealth(env,now)).state,'needs_review');
  assert.equal((await dispatchBusiness(env,now)).state,'paused');
  env.sql.prepare('UPDATE business_controls SET enabled=1').run();
  const before=env.sql.prepare('SELECT * FROM business_runs').all();
  assert.equal((await dispatchBusiness(env,now)).state,'uncertain');
  await businessDispatchHealth(env,now);
  assert.deepEqual(env.sql.prepare('SELECT * FROM business_runs').all(),before);
});
