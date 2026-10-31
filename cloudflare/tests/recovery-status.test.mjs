import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRecovery, inspectRecovery, migrationSchema, schemaQuery, target } from '../scripts/recovery-status.mjs';

const expected=migrationSchema();
const info={uuid:target.id,name:target.name,database_size:1000,running_in_region:'WEUR'};
const point={bookmark:'00000001-00000002-00000003-'+'a'.repeat(32)};
const response=rows=>[{success:true,results:rows}];

test('recovery inspection requires exact live identity and a valid provider recovery point',()=>{
  for(const bad of [{...info,uuid:'wrong'},{...info,name:'different'}])assert.throws(()=>assessRecovery(bad,point,response(expected.objects),expected),/wrong database/);
  for(const bookmark of ['',null,'unknown','00000001'])assert.throws(()=>assessRecovery(info,{bookmark},response(expected.objects),expected),/bookmark/);
  assert.throws(()=>assessRecovery(info,point,[{success:false}],expected),/could not be read/);
});
test('exact migrated schema produces an aggregate receipt without raw bookmark, source SQL or customer rows',()=>{
  const receipt=assessRecovery(info,point,response(expected.objects),expected,'2026-10-08T10:00:00.000Z');
  assert.equal(receipt.status,'available');assert.equal(receipt.schema.actual_objects,expected.objects.length);assert.ok(expected.objects.length>0);
  assert.equal(receipt.schema.actual_sha256,receipt.schema.expected_sha256);
  assert.equal(receipt.customer_data_restoration_verified,false);assert.equal(receipt.retention_window_verified,false);
  assert.equal(receipt.production_data_exported,false);assert.equal(receipt.production_restore_performed,false);
  assert.doesNotMatch(JSON.stringify(receipt),/CREATE TABLE|aaaaaaaaaaaaaaaa|fictional-person@example/);
});
test('missing, additional and altered schema objects cannot look healthy',()=>{
  const rows=structuredClone(expected.objects);const removed=rows.shift();rows[0].sql+=' -- changed';rows.push({type:'table',name:'unexpected',tbl_name:'unexpected',sql:'CREATE TABLE unexpected(id TEXT)'});
  const r=assessRecovery(info,point,response(rows),expected);
  assert.equal(r.status,'schema_drift');assert.deepEqual(r.schema.missing,[removed.type+':'+removed.name]);
  assert.deepEqual(r.schema.extra,['table:unexpected']);assert.equal(r.schema.changed.length,1);
  assert.throws(()=>assessRecovery(info,point,response([]),expected),/incomplete/);
  assert.throws(()=>assessRecovery(info,point,response([...expected.objects,expected.objects[0]]),expected),/Duplicate/);
});
test('inspection uses only exact-target metadata, bookmark-info and sqlite_master reads; wrong identity stops early',async()=>{
  const calls=[];
  const receipt=await inspectRecovery(async args=>{calls.push(args);return calls.length===1?info:calls.length===2?point:response(expected.objects);});
  assert.equal(receipt.status,'available');assert.equal(calls.length,3);
  assert.deepEqual(calls[2],['d1','execute',target.name,'--remote','--command',schemaQuery,'--json']);
  assert.ok(calls.every(args=>!args.includes('restore')&&!args.includes('export')&&!args.includes('delete')));
  let badCalls=0;await assert.rejects(inspectRecovery(async()=>{badCalls++;return {...info,uuid:'wrong'};}),/identity/);assert.equal(badCalls,1);
});
