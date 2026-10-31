import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARDS} from '../worker/job-sources.js';
import {database} from './research-db.mjs';
import {sourceAdmission,runSourceSequence} from '../worker/source-sequence.js';

function fixture(t,sources=['one','two']) {
 const env=database(t);let now=Date.now();const started=now,trace=[];
 env.sql.prepare("INSERT INTO agent_runs(id,trigger_kind,state,created_at,updated_at) VALUES('fictional-run','scheduled','running',?,?)").run(new Date(now).toISOString(),new Date(now).toISOString());
 for(const id of sources)env.sql.prepare("INSERT INTO agent_tasks(run_id,source_id,company) VALUES('fictional-run',?,?)").run(id,'Fictional '+id);
 const ops={async initialiseRun(){return sources;},sourceAdmission:(DB,r,s)=>sourceAdmission(DB,r,s,now),async markTaskFailure(DB,r,s){env.sql.prepare("UPDATE agent_tasks SET state='failed' WHERE source_id=? AND state NOT IN ('published','needs_review','failed','skipped')").run(s);trace.push(['failed',s,now]);},async completeRun(){return 'complete';}};
 const step={async do(name,config,callback){if(!callback){callback=config;config=null;}trace.push(['step',name,now,config]);return callback();},async sleepUntil(name,at){assert.ok(at>=now);trace.push(['lease-wait',name,now,at]);now=at;},async sleep(name,delay){trace.push(['retry-delay',name,now,delay]);now+=delay;}};
 return {env,ops,step,trace,started,now:()=>now};
}
const event={payload:{runId:'fictional-run'}};

test('simulated CPU-terminated attempts retain their leases; the next attempt and next source wait for expiry',async t=>{
 const f=fixture(t),calls=[];
 f.ops.executeSourceTask=async(_env,_run,source)=>{
  const lease=f.env.sql.prepare("SELECT * FROM feed_locks WHERE name='jobs'").get();
  assert.ok(!lease||lease.expires<f.now(),'must not execute while another lease is live');
  calls.push([source,f.now()]);
  if(source==='one') {
   f.env.sql.prepare("INSERT OR REPLACE INTO feed_locks VALUES('jobs','fictional-terminated-step',?)").run(f.now()+120000);
   throw Error('Simulated uncatchable platform termination after lease acquisition');
  }
  f.env.sql.prepare("UPDATE agent_tasks SET state='published' WHERE source_id=?").run(source);
  return {state:'published'};
 };
 assert.equal(await runSourceSequence(f.env,event,f.step,f.ops),'complete');
 assert.deepEqual(calls.map(x=>x[0]),['one','one','one','two']);
 for(let i=1;i<calls.length;i++)assert.ok(calls[i][1]>calls[i-1][1]+120000);
 assert.equal(f.env.sql.prepare("SELECT owner FROM feed_locks WHERE name='jobs'").get().owner,'fictional-terminated-step');
 assert.equal(f.env.sql.prepare("SELECT state FROM agent_tasks WHERE source_id='one'").get().state,'failed');
 for(const x of f.trace.filter(x=>x[0]==='step'&&x[3]))assert.equal(x[3].retries.limit,0);
 assert.deepEqual(f.trace.filter(x=>x[0]==='retry-delay').map(x=>x[3]),[30000,60000]);
});

test('completed publication after a lost acknowledgement is replayed without another execution',async t=>{
 const f=fixture(t,['one']);let calls=0;
 f.ops.executeSourceTask=async()=>{calls++;f.env.sql.exec("UPDATE agent_tasks SET state='published'");throw Error('Lost acknowledgement');};
 await runSourceSequence(f.env,event,f.step,f.ops);
 assert.equal(calls,1);assert.equal(f.trace.filter(x=>x[0]==='failed').length,0);
 assert.equal(f.env.sql.prepare('SELECT state FROM agent_tasks').get().state,'published');
});

test('renewed ownership is rechecked after sleep, has bounded waits and is never cleared',async t=>{
 const f=fixture(t,['one']);let waits=0,calls=0;
 f.env.sql.prepare("INSERT INTO feed_locks VALUES('jobs','live-other-owner',?)").run(f.now()+2000);
 const sleep=f.step.sleepUntil;
 f.step.sleepUntil=async(name,at)=>{await sleep(name,at);waits++;f.env.sql.prepare("UPDATE feed_locks SET expires=?").run(f.now()+120000);};
 f.ops.executeSourceTask=async()=>{calls++;throw Error('must not start');};
 await runSourceSequence(f.env,event,f.step,f.ops);
 assert.equal(waits,3);assert.equal(calls,0);
 assert.equal(f.env.sql.prepare('SELECT owner FROM feed_locks').get().owner,'live-other-owner');
 assert.equal(f.env.sql.prepare('SELECT requests FROM agent_runs').get().requests,0);
 assert.equal(f.env.sql.prepare('SELECT attempts FROM agent_tasks').get().attempts,0);
 assert.equal(f.trace.filter(x=>x[0]==='failed').length,1);
});

test('wait stops at the existing two-hour run deadline and does not reserve a request',async t=>{
 const f=fixture(t,['one']);f.env.sql.prepare("INSERT INTO feed_locks VALUES('jobs','long-other-owner',?)").run(f.now()+3*3600000);
 f.ops.executeSourceTask=async()=>{assert.ok(f.now()>f.started+2*3600000);return {state:'failed',error_code:'run_expired'};};
 await runSourceSequence(f.env,event,f.step,f.ops);
 assert.equal(f.now(),f.started+2*3600000+1);
 assert.equal(f.env.sql.prepare('SELECT requests FROM agent_runs').get().requests,0);
 assert.equal(f.env.sql.prepare('SELECT owner FROM feed_locks').get().owner,'long-other-owner');
});

test('terminal tasks skip waits, and unavailable admission never permits a fetch',async t=>{
 const f=fixture(t,['one','two']);f.env.sql.exec("UPDATE agent_tasks SET state='needs_review' WHERE source_id='one'");
 let calls=0;const read=f.ops.sourceAdmission;
 f.ops.sourceAdmission=async(DB,r,s)=>{if(s==='two')throw Error('D1 unavailable');return read(DB,r,s);};
 f.ops.executeSourceTask=async()=>{calls++;};
 await runSourceSequence(f.env,event,f.step,f.ops);
 assert.equal(calls,0);assert.equal(f.trace.filter(x=>x[0]==='lease-wait').length,0);
 assert.equal(f.env.sql.prepare("SELECT state FROM agent_tasks WHERE source_id='one'").get().state,'needs_review');
 assert.equal(f.trace.filter(x=>x[0]==='failed').length,1);
});

// At most three admission/execution opportunities, one recheck after a lease
// wait per opportunity, two retry sleeps and a final failure receipt per source.
test('the worst configured source sequence stays inside the existing Free step ceiling',()=>{
 const maximumSources=BOARDS.length+20;
 assert.ok(2+maximumSources*15<=1024,`${maximumSources} sources exceed the bounded step design`);
});
