import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from './research-db.mjs';
import {describeReceipt,inspectBusiness,providerError,readApplication,receiptQuery,saveReceipt,target} from '../scripts/business-status.mjs';

const now='2026-10-30T14:00:00.000Z';
const info={uuid:target.id,name:target.name};
const version='53176112-4726-4bdf-93f2-1e7ab3453bd9';
const row=(id='business-497990',state='attention')=>({id,state,created_at:'2026-10-23T14:45:30.093Z',finished_at:state==='queued'?null:'2026-10-23T14:46:54.646Z',trigger_kind:'scheduled',recorded_steps:state==='queued'?0:5});
const response=(runs=[row()])=>[{success:true,results:[{unfinished:runs.filter(x=>['queued','running'].includes(x.state)).length}]},{success:true,results:runs}];
const original=(id='business-497990')=>({id,params:{runId:id,private:'SECRET INPUT'},versionId:version,queued:'2026-10-23T14:45:43.326Z',start:'2026-10-23T14:45:46.469Z',end:'2026-10-23T14:46:55.013Z',success:true,output:{state:'attention',private:'PRIVATE OUTPUT'},steps:[{output:'PRIVATE STEP'}],error:null});

test('real SQLite query retains old unfinished work beyond recent history and excludes private fields',t=>{
  const env=database(t);
  env.sql.prepare('INSERT INTO business_runs(id,state,created_at,snapshot,result,trigger_kind) VALUES(?,?,?,?,?,?)').run('business-1','queued','2026-10-01','PRIVATE SNAPSHOT','PRIVATE RESULT','scheduled');
  for(let i=2;i<22;i++)env.sql.prepare('INSERT INTO business_runs(id,state,created_at,trigger_kind) VALUES(?,?,?,?)').run('business-'+i,'completed',`2026-10-${String(i).padStart(2,'0')}`,'scheduled');
  const before=env.sql.prepare('SELECT * FROM business_runs').all();
  const result=readApplication(receiptQuery.split(';').filter(x=>x.trim()).map(sql=>({success:true,results:env.sql.prepare(sql).all()})));
  assert.deepEqual(result.runs.map(x=>x.id),['business-1','business-21']);
  assert.equal(result.unfinished_count,1);assert.equal(result.runs[0].recorded_steps,0);
  assert.deepEqual(env.sql.prepare('SELECT * FROM business_runs').all(),before);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});

test('only exact production identity and fixed read commands are used; nothing dispatches or mutates',async()=>{
  const calls=[];
  const receipt=await inspectBusiness(async args=>{
    calls.push(args);
    if(args[0]==='d1'&&args[1]==='info')return info;
    if(args[0]==='d1'&&args[1]==='execute'){assert.equal(args[5],receiptQuery);return response();}
    assert.deepEqual(args,['workflows','instances','describe',target.workflow,'business-497990','--json']);return original();
  },()=>now);
  assert.equal(calls.length,4);assert.equal(receipt.application_stable_during_inspection,true);
  assert.equal(receipt.providers[0].execution_outcome,'ended_successfully');
  assert.equal(receipt.providers[0].application_output_state,'attention');
  assert.equal(receipt.execution_success_is_business_acceptance,false);
  assert.deepEqual(receipt.actions_performed,[]);assert.doesNotMatch(JSON.stringify(receipt),/PRIVATE|SECRET/);
  assert.ok(calls.every(args=>!args.some(x=>['create','terminate','resume','restart','restore','export'].includes(x))));
  let n=0;await assert.rejects(inspectBusiness(async()=>{n++;return {...info,uuid:'other'};}),/Wrong database/);assert.equal(n,1);
});

test('missing instance, transient failures and zero steps never become terminal or clear unfinished work',async()=>{
  const queued=row('business-497989','queued');
  for(const error of [{stderr:'instance.not_found [code: 10400] PRIVATE'},{stdout:'PRIVATE',stderr:'internal [code: 10001]'},{stderr:'credentials PRIVATE'}]){
    const result=await inspectBusiness(async args=>args[1]==='info'?info:args[0]==='d1'?response([queued]):Promise.reject(error),()=>now);
    assert.equal(result.status,'needs_review');assert.equal(result.providers[0].execution_outcome,'unknown');
    assert.equal(result.application_after.runs[0].state,'queued');
    assert.equal(result.missing_instance_is_terminal_proof,false);assert.equal(result.zero_recorded_steps_proves_no_external_action,false);
    assert.equal(result.automatic_recovery_authorized,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|credentials/);
  }
});

test('misidentified, malformed or future provider responses remain unknown',async()=>{
  for(const change of [{id:'business-3'},{params:{runId:'business-3'}},{versionId:'bad'},{end:'invalid'},{end:'2027-01-01T00:00:00Z'},{start:'2026-10-23T14:44:00Z'},{queued:null},{success:'true'}]){
    const raw={...original(),...change};assert.throws(()=>describeReceipt(raw,'business-497990',now));
    const result=await inspectBusiness(async args=>args[1]==='info'?info:args[0]==='d1'?response():raw,()=>now);
    assert.equal(result.providers[0].lookup,'invalid_response');assert.equal(result.status,'needs_review');
  }
  const waiting=describeReceipt({...original(),end:null,success:null},'business-497990',now);
  assert.equal(waiting.execution_outcome,'no_terminal_receipt');
  const failed=describeReceipt({...original(),success:false,error:{message:'PRIVATE'}},'business-497990',now);
  assert.equal(failed.execution_outcome,'ended_unsuccessfully');assert.doesNotMatch(JSON.stringify(failed),/PRIVATE/);
});

test('racing application changes and unavailable second read preserve observations without stable-state claims',async()=>{
  for(const unavailable of [true,false]){
    let reads=0;
    const result=await inspectBusiness(async args=>{
      if(args[1]==='info')return info;
      if(args[0]==='workflows')return original();
      if(++reads===1)return response();
      if(unavailable)throw Error('D1 unavailable');
      return response([row('business-497991','queued')]);
    },()=>now);
    assert.equal(result.status,'needs_review');assert.equal(result.application_stable_during_inspection,false);
    assert.equal(result.application_before.runs[0].id,'business-497990');
    assert.equal(result.providers[0].id,'business-497990');
  }
});

test('bounded selection validates every ID and count before any provider lookup',async()=>{
  for(const bad of [[],[{success:false,results:[]}],response([{...row(),id:'--latest'}]),response([{...row(),state:'unknown'}]),response([{...row(),recorded_steps:-1}]),response([row(),row()])])assert.throws(()=>readApplication(bad));
  const absent=response();absent[0].results[0].unfinished=1;assert.throws(()=>readApplication(absent),/Incomplete/);
  const many=response(Array.from({length:5},(_,i)=>row('business-'+i,'queued')));many[0].results[0].unfinished=20;
  let lookups=0;const result=await inspectBusiness(async args=>args[1]==='info'?info:args[0]==='d1'?many:(lookups++,original(args[4])),()=>now);
  assert.equal(lookups,5);assert.equal(result.application_before.selection_limited,true);assert.equal(result.status,'needs_review');
  assert.equal(providerError({stderr:'do not store arbitrary error'}).error_code,null);
});

test('receipt files are private and cannot overwrite an earlier observation',t=>{
  const directory=mkdtempSync(join(tmpdir(),'si-business-receipt-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'receipt.json');saveReceipt(path,{observed_at:now});
  assert.equal(statSync(path).mode&0o777,0o600);
  assert.throws(()=>saveReceipt(path,{observed_at:'later'}),/EEXIST/);
  assert.deepEqual(JSON.parse(readFileSync(path,'utf8')),{observed_at:now});
});

test('empty and stale history cannot masquerade as a current supervisor observation',async()=>{
  const inspect=runs=>inspectBusiness(async args=>args[1]==='info'?info:args[0]==='d1'?response(runs):original(args[4]),()=>now);
  const empty=await inspect([]);assert.equal(empty.status,'needs_review');assert.ok(empty.issues.includes('no_application_receipts'));
  const stale=await inspect([row()]);assert.ok(stale.issues.includes('latest_application_over_two_hours_old'));
  for(const changed of [{created_at:'invalid'},{finished_at:'invalid'},{created_at:'2027-01-01T00:00:00Z'}]){
    const result=await inspect([{...row(),...changed}]);assert.ok(result.issues.includes('invalid_application_time:business-497990'));
  }
});
