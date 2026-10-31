import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkbook} from '../shared/founder.js';
import {createFounderWorkspace,founderDeviceKey,founderDirty,prepareFounderExit,cancelFounderExit,finishFounderExit} from '../shared/founder-workspace.js';

const changed=text=>{const b=emptyWorkbook();b.notes.innovation=text;return b;};
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function fixture(id=crypto.randomUUID()){
 const storage=memory(),calls=[],receipts=new Map();let saved={accountId:id,workbook:emptyWorkbook(),revision:0},lost=false;
 const request=async(method,payload)=>{
  calls.push({method,payload:structuredClone(payload)});
  if(method==='GET')return structuredClone(saved);
  const previous=receipts.get(payload.request_key);if(previous)return previous;
  if(payload.revision!==saved.revision)throw Object.assign(Error('conflict'),{code:'founder_revision_conflict'});
  saved={accountId:id,workbook:payload.workbook,revision:saved.revision+1};
  const result={accountId:id,revision:saved.revision};receipts.set(payload.request_key,result);
  if(lost){lost=false;throw Error('Lost response');}return result;
 };
 const store=createFounderWorkspace({storage,request});store.setIdentity(id);
 return {id,storage,store,calls,request,get saved(){return saved;},remote:b=>{saved={accountId:id,workbook:b,revision:saved.revision+1};},lose:()=>{lost=true;}};
}
test('explicit open/save, offline edits and reload preserve separate account content and never save automatically',async()=>{
 const f=fixture();f.store.change(changed('Fictional tab note'));assert.equal(f.calls.length,0);assert.equal(f.storage.getItem(founderDeviceKey(f.id)),null);
 await f.store.open(f.id);assert.equal(f.calls.length,1);assert.ok(f.store.state.incoming);f.store.choose('local');
 await f.store.save();assert.equal(f.saved.workbook.notes.innovation,'Fictional tab note');assert.equal(founderDirty(f.store.state),false);
 f.store.change(changed('Unsynced fictional edit'));assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
 const reloaded=createFounderWorkspace({storage:f.storage,request:f.request});reloaded.setIdentity(f.id);await reloaded.open(f.id);
 assert.equal(reloaded.state.book.notes.innovation,'Unsynced fictional edit');assert.equal(founderDirty(reloaded.state),true);
 assert.throws(()=>prepareFounderExit(f.storage,f.id),/Founder hub/);
 reloaded.setIdentity('different-account');assert.equal(reloaded.state.book.notes.innovation,'');assert.ok(f.storage.getItem(founderDeviceKey(f.id)));
});
test('lost acknowledgement survives reload, retries exact request and retains newer local edits',async()=>{
 const f=fixture();await f.store.open(f.id);f.store.change(changed('First saved note'));f.lose();await f.store.save();
 const original=f.store.state.pending;assert.ok(original);assert.equal(f.saved.revision,1);f.store.change(changed('Later local note'));
 const reloaded=createFounderWorkspace({storage:f.storage,request:f.request});reloaded.setIdentity(f.id);await reloaded.open(f.id);
 assert.deepEqual(reloaded.state.pending,original);await reloaded.save();
 assert.equal(f.saved.revision,1);assert.equal(reloaded.state.book.notes.innovation,'Later local note');assert.equal(founderDirty(reloaded.state),true);assert.equal(reloaded.state.pending,null);
 assert.deepEqual(f.calls.filter(c=>c.method==='PUT').map(c=>c.payload),[original,original]);
 await reloaded.save();assert.equal(f.saved.revision,2);assert.equal(f.saved.workbook.notes.innovation,'Later local note');
});
test('cloud conflicts preserve both copies and require explicit choice with a recoverable displaced copy',async()=>{
 const f=fixture();await f.store.open(f.id);f.store.change(changed('Local note'));f.remote(changed('Other-device note'));await f.store.save();
 assert.equal(f.store.state.pending,null);assert.equal(f.store.state.known,false);await f.store.refresh();assert.equal(f.store.state.book.notes.innovation,'Local note');
 assert.equal(f.store.state.incoming.book.notes.innovation,'Other-device note');f.store.choose('cloud');assert.equal(f.store.state.recovery.notes.innovation,'Local note');
 assert.throws(()=>prepareFounderExit(f.storage,f.id),/Founder hub/);f.store.restoreRecovery();assert.equal(f.store.state.book.notes.innovation,'Local note');assert.equal(f.saved.workbook.notes.innovation,'Other-device note');
 f.store.removeRecovery();await f.store.save();assert.equal(f.saved.workbook.notes.innovation,'Local note');
 const raw=prepareFounderExit(f.storage,f.id);assert.throws(()=>f.store.change(changed('Late edit')),/account change/);cancelFounderExit();
 assert.equal(finishFounderExit(f.storage,f.id,raw),true);assert.equal(f.storage.getItem(founderDeviceKey(f.id)),null);assert.equal(f.store.state.accountId,null);
});
test('an intentional empty edit conflicts instead of silently restoring newer cloud content',async()=>{
 const f=fixture();f.remote(changed('Earlier note'));await f.store.open(f.id);f.store.change(emptyWorkbook());f.remote(changed('Newer cloud note'));await f.store.refresh();
 assert.equal(f.store.state.book.notes.innovation,'');assert.ok(f.store.state.incoming);f.store.choose('local');await f.store.save();assert.equal(f.saved.workbook.notes.innovation,'');assert.equal(f.store.state.recovery.notes.innovation,'Newer cloud note');
});
test('storage denial, silent failure, changed cross-tab copy and damaged data never trigger a cloud write or erase current notes',async()=>{
 for(const mode of ['throw','silent','race']){
  const f=fixture();await f.store.open(f.id);f.store.change(changed('Keep this fictional note'));const before=f.storage.getItem(founderDeviceKey(f.id));
  if(mode==='race')f.storage.setItem(founderDeviceKey(f.id),before+' ');else f.storage.setItem=()=>{if(mode==='throw')throw Error('Quota exceeded');};
  await f.store.save();assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);assert.equal(f.store.state.book.notes.innovation,'Keep this fictional note');assert.ok(f.store.state.error);
 }
 const f=fixture();f.storage.setItem(founderDeviceKey(f.id),'damaged fictional backup');await f.store.open(f.id);assert.equal(f.store.state.rawBackup,'damaged fictional backup');assert.equal(f.calls.length,0);
 assert.throws(()=>prepareFounderExit(f.storage,f.id));f.store.setIdentity('other');assert.equal(f.store.state.rawBackup,null);f.store.setIdentity(f.id);await f.store.open(f.id);assert.equal(f.store.state.rawBackup,'damaged fictional backup');assert.equal(f.storage.getItem(founderDeviceKey(f.id)),'damaged fictional backup');await assert.rejects(f.store.refresh(),/unopened/);assert.equal(f.calls.length,0);f.store.discardDevice();assert.equal(f.storage.getItem(founderDeviceKey(f.id)),null);
});
test('late account reads and saves cannot replace another identity, and changed device data survives sign-out cleanup',async()=>{
 let release;const storage=memory(),id=crypto.randomUUID();
 const store=createFounderWorkspace({storage,request:()=>new Promise(r=>release=r)});store.setIdentity(id);const opening=store.open(id);store.setIdentity('other');release({accountId:id,revision:1,workbook:changed('Account A private note')});await opening;assert.equal(store.state.accountId,null);assert.equal(store.state.book.notes.innovation,'');
 const f=fixture();await f.store.open(f.id);const raw=prepareFounderExit(f.storage,f.id);f.storage.setItem(founderDeviceKey(f.id),raw+' ');assert.equal(finishFounderExit(f.storage,f.id,raw),false);assert.equal(f.storage.getItem(founderDeviceKey(f.id)),raw+' ');
 assert.equal(finishFounderExit(f.storage,f.id,null,{deleted:true}),true);
});

test('session expiry hides notes but preserves a storage-failed copy and late-save replay for its original owner',async()=>{
 const f=fixture();await f.store.open(f.id);const set=f.storage.setItem;f.storage.setItem=()=>{throw Error('device full');};
 f.store.change(changed('Fictional memory-only note'));f.store.setIdentity(null);assert.equal(f.store.state.book.notes.innovation,'');assert.equal(f.store.hasHiddenWork,true);
 f.store.setIdentity('other');assert.equal(f.store.state.book.notes.innovation,'');f.store.setIdentity(f.id);await f.store.open(f.id);
 assert.equal(f.store.state.book.notes.innovation,'Fictional memory-only note');assert.match(f.store.state.error,/device full/);f.storage.setItem=set;await f.store.refresh();await f.store.save();
 assert.equal(f.saved.workbook.notes.innovation,'Fictional memory-only note');
 let release;const delayed=createFounderWorkspace({storage:f.storage,request:(method,body)=>method==='GET'?f.request(method):new Promise(r=>{release=async()=>r(await f.request(method,body));})});
 delayed.setIdentity(f.id);await delayed.open(f.id);delayed.change(changed('Fictional delayed save'));const saving=delayed.save();delayed.setIdentity('other');await release();await saving;
 assert.equal(delayed.state.book.notes.innovation,'');delayed.setIdentity(f.id);await delayed.open(f.id);assert.ok(delayed.state.pending);const retry=delayed.save();await release();await retry;
 assert.equal(delayed.state.pending,null);assert.equal(f.saved.revision,2);assert.equal(delayed.state.book.notes.innovation,'Fictional delayed save');
});

test('failed device cleanup after confirmed account deletion stays explicit and clears in-memory private display',async()=>{
 const f=fixture();await f.store.open(f.id);f.store.change(changed('Fictional deleted account note'));f.storage.removeItem=()=>{throw Error('storage unavailable');};
 assert.equal(finishFounderExit(f.storage,f.id,null,{deleted:true}),false);assert.equal(f.store.state.accountId,null);assert.equal(f.store.state.book.notes.innovation,'');assert.ok(f.storage.getItem(founderDeviceKey(f.id)));
});
