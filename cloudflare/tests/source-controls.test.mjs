import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDatabase} from './helpers/source-d1.mjs';
import {agentOperationsAPI} from '../worker/agent-api.js';
import {BOARDS} from '../worker/job-sources.js';
const source=BOARDS[0].id;
const owner={user:{id:'fictional-owner'}};
const request=(body)=>new Request('https://sponsorintel.london/api/admin/agents/source',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify(body)});
const change=(revision,paused,reason)=>({source_id:source,paused,reason,expected_revision:revision,request_key:crypto.randomUUID()});
test('older control writers cannot overwrite recorded decisions while source health updates remain allowed',async t=>{
 const env=sourceDatabase(t);
 assert.equal((await agentOperationsAPI(request(change(0,true,'Fictional reviewed hold protected during rollback.')),env,owner)).status,200);
 assert.throws(()=>env.sql.exec("UPDATE agent_source_controls SET paused=0,reason='older unreviewed resume'"),/review required/);
 assert.throws(()=>env.sql.exec('DELETE FROM agent_source_controls'),/cannot be removed/);
 env.sql.exec("UPDATE agent_source_controls SET failures=3,cooldown_until=123,updated_at='2026-10-18T15:00:00Z'");
 assert.equal(env.sql.prepare('SELECT paused FROM agent_source_controls').get().paused,1);
 assert.equal((await agentOperationsAPI(request(change(1,false,'Fictional freshly reviewed resume after source health update.')),env,owner)).status,200);
 assert.equal(env.sql.prepare('SELECT control_revision FROM agent_source_controls').get().control_revision,2);
});

test('missing versions fail closed; exact replay cannot clear a later owner hold',async t=>{
 const env=sourceDatabase(t),first=change(0,true,'Fictional baseline source hold.');
 const invalid=await agentOperationsAPI(request({source_id:source,paused:false,reason:'Missing reviewed version'}),env,owner);
 assert.equal(invalid.status,400);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,0);
 assert.equal((await agentOperationsAPI(request(first),env,owner)).status,200);
 const resume=change(1,false,'Fictional complete source review.');
 assert.equal((await agentOperationsAPI(request(resume),env,owner)).status,200);
 const hold=change(2,true,'Fictional later owner hold must survive a replay.');
 assert.equal((await agentOperationsAPI(request(hold),env,owner)).status,200);
 const r=await(await agentOperationsAPI(request(resume),env,owner)).json();
 assert.equal(r.replayed,true);assert.equal(r.applied_paused,false);assert.equal(r.current_paused,true);assert.equal(r.current_revision,3);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,3);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,3);
 assert.equal((await agentOperationsAPI(request({...resume,reason:'A different review must not reuse the same request.'}),env,owner)).status,409);
 assert.equal(env.sql.prepare('SELECT paused FROM agent_source_controls').get().paused,1);
});

test('source decision history preserves inherited state without inventing earlier reviews',async t=>{
 const env=sourceDatabase(t);
 env.sql.prepare('INSERT INTO agent_source_controls(source_id,paused,reason,updated_at,actor,failures,cooldown_until) VALUES(?,1,?,?,?,3,123)').run(source,'Fictional older private reason','2026-10-09T10:00:00Z','previous-owner');
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,0);
 const body=change(0,false,'Fictional evidence-based later recovery review.');
 assert.equal((await agentOperationsAPI(request(body),env,owner)).status,200);
 const h=env.sql.prepare('SELECT * FROM source_control_reviews').get();
 assert.equal(h.prior_paused,1);assert.equal(h.prior_reason,'Fictional older private reason');assert.equal(h.prior_record_updated_at,'2026-10-09T10:00:00Z');assert.equal(h.revision,1);
 assert.throws(()=>env.sql.exec("UPDATE source_control_reviews SET reason='altered'"),/append only/);
 assert.throws(()=>env.sql.exec('DELETE FROM source_control_reviews'),/append only/);
 const c=env.sql.prepare('SELECT * FROM agent_source_controls').get();assert.equal(c.failures,0);assert.equal(c.cooldown_until,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_daily_budget').get().n,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_runs').get().n,0);
});

test('a failed audit transaction rolls back the source state and immutable review together',async t=>{
 const env=sourceDatabase(t);
 env.sql.exec("CREATE TRIGGER fictional_audit_failure BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'SQLITE fixture failure'); END");
 const response=await agentOperationsAPI(request(change(0,true,'Fictional pause with failed storage.')),env,owner);
 assert.equal(response.status,400);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_source_controls').get().n,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM feed_locks').get().n,0);
});

test('lost batch acknowledgement is reconciled once without repeating the control change',async t=>{
 const env=sourceDatabase(t),batch=env.DB.batch.bind(env.DB);
 let lost=true;env.DB.batch=async statements=>{const r=await batch(statements);if(lost){lost=false;throw Error('fictional lost acknowledgement');}return r;};
 const body=change(0,true,'Fictional pause with uncertain acknowledgement.');
 const first=await agentOperationsAPI(request(body),env,owner);assert.equal(first.status,200);
 const r=await first.json();assert.equal(r.replayed,true);assert.equal(r.current_paused,true);
 assert.equal((await agentOperationsAPI(request(body),env,owner)).status,200);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
});

test('overlapping source decisions permit one version and preserve the losing reason for a fresh review',async t=>{
 const env=sourceDatabase(t);
 const rs=await Promise.all([change(0,true,'Fictional first overlapping source decision.'),change(0,false,'Fictional second overlapping source decision.')].map(b=>agentOperationsAPI(request(b),env,owner)));
 assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,1);
 assert.equal(env.sql.prepare('SELECT control_revision FROM agent_source_controls').get().control_revision,1);
});

test('lease loss just before the atomic save cannot retain a review or change a source',async t=>{
 const env=sourceDatabase(t),batch=env.DB.batch.bind(env.DB);
 env.DB.batch=async statements=>{env.sql.exec("UPDATE feed_locks SET owner='fictional-newer-operation'");return batch(statements);};
 const response=await agentOperationsAPI(request(change(0,true,'Fictional pause after losing the lock.')),env,owner);
 assert.equal(response.status,409);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM source_control_reviews').get().n,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_source_controls').get().n,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,0);
 assert.equal(env.sql.prepare('SELECT owner FROM feed_locks').get().owner,'fictional-newer-operation');
});

test('an older resume form cannot undo a newer source pause decision',async t=>{
 const env=sourceDatabase(t);
 const first=change(0,true,'Fictional first source hold awaiting review.');
 assert.equal((await agentOperationsAPI(request(first),env,owner)).status,200);
 const oldResume=change(1,false,'Fictional review of the older source evidence.');
 const newer=change(1,true,'Fictional newer identity conflict: preserve this hold.');
 assert.equal((await agentOperationsAPI(request(newer),env,owner)).status,200);
 const result=await agentOperationsAPI(request(oldResume),env,owner);
 assert.equal(result.status,409);
 const row=env.sql.prepare('SELECT paused,reason FROM agent_source_controls WHERE source_id=?').get(source);
 assert.equal(row.paused,1);
 assert.equal(row.reason,newer.reason);
});
