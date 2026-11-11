import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkbook,exportWorkbook} from '../shared/founder.js';
import {createFounderWorkspace,founderDeviceKey,finishFounderExit} from '../shared/founder-workspace.js';

const note=text=>{const value=emptyWorkbook();value.notes.finances=text;return value;};
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
function fixture(){
 const id=crypto.randomUUID(),storage=memory(),calls=[],emissions=[],receipts=new Map();
 let remote={accountId:id,revision:0,workbook:emptyWorkbook()},store;
 const request=async(method,payload)=>{
  calls.push({method,payload:structuredClone(payload)});
  if(method==='GET')return structuredClone(remote);
  if(receipts.has(payload.request_key))return receipts.get(payload.request_key);
  if(payload.revision!==remote.revision)throw Object.assign(Error('conflict'),{code:'founder_revision_conflict'});
  remote={accountId:id,revision:remote.revision+1,workbook:structuredClone(payload.workbook)};
  const result={accountId:id,revision:remote.revision};receipts.set(payload.request_key,result);return result;
 };
 store=createFounderWorkspace({storage,request,notify:state=>emissions.push({token:store.contextToken,state})});
 return {id,storage,store,calls,emissions,request,remote:workbook=>{remote={accountId:id,revision:remote.revision+1,workbook};}};
}

test('draft context stays stable through ordinary edits, saves, matching-base and same-book refreshes',async()=>{
 const f=fixture();f.store.setIdentity(f.id);await f.store.open(f.id);const token=f.store.contextToken;
 f.store.change(note('Fictional finance assumptions'));assert.equal(f.store.contextToken,token);
 await f.store.save();assert.equal(f.store.contextToken,token);
 f.store.change(note('Later fictional assumptions'));await f.store.refresh();
 assert.equal(f.store.state.book.notes.finances,'Later fictional assumptions');assert.equal(f.store.contextToken,token);
 await f.store.save();f.remote(note('Later fictional assumptions'));await f.store.refresh();
 assert.equal(f.store.contextToken,token);assert.equal(f.store.state.incoming,null);
});

test('only replacing a displayed remote workbook changes context; presenting or keeping a conflict does not',async()=>{
 const f=fixture();f.store.setIdentity(f.id);await f.store.open(f.id);const initial=f.store.contextToken;
 f.remote(note('Fictional account workbook'));await f.store.refresh();assert.ok(f.store.contextToken>initial);
 const received=f.store.contextToken;f.store.change(note('Fictional local edits'));f.remote(note('Fictional other-device edits'));
 await f.store.refresh();assert.ok(f.store.state.incoming);assert.equal(f.store.contextToken,received);
 f.store.choose('local');assert.equal(f.store.contextToken,received);assert.equal(f.store.state.book.notes.finances,'Fictional local edits');
 f.store.removeRecovery();assert.equal(f.store.contextToken,received);
});

test('choosing cloud and restoring displaced notes invalidate the earlier calculator context before notification',async()=>{
 const f=fixture();f.store.setIdentity(f.id);await f.store.open(f.id);f.store.change(note('Fictional local copy'));
 f.remote(note('Fictional cloud copy'));await f.store.refresh();const prior=f.store.contextToken;
 f.store.choose('cloud');assert.ok(f.store.contextToken>prior);assert.equal(f.store.state.book.notes.finances,'Fictional cloud copy');
 assert.equal(f.emissions.at(-1).token,f.store.contextToken);
 const chosen=f.store.contextToken;f.store.restoreRecovery();assert.ok(f.store.contextToken>chosen);
 assert.equal(f.store.state.book.notes.finances,'Fictional local copy');assert.equal(f.emissions.at(-1).token,f.store.contextToken);
});

test('explicit restore or clear signals replacement even for equal content; invalid or blocked replacements do nothing',async()=>{
 const f=fixture();const initial=f.store.contextToken;f.store.replace(note('Fictional file restore'));
 assert.ok(f.store.contextToken>initial);const restored=f.store.contextToken;
 f.store.replace(note('Fictional file restore'));assert.ok(f.store.contextToken>restored);
 const equal=f.store.contextToken;f.store.replace(emptyWorkbook());assert.ok(f.store.contextToken>equal);
 const cleared=f.store.contextToken;assert.throws(()=>f.store.replace(note('x'.repeat(4001))),/4,000/);
 assert.equal(f.store.contextToken,cleared);assert.deepEqual(f.store.state.book,emptyWorkbook());assert.equal(f.calls.length,0);
 f.store.setIdentity(f.id);await f.store.open(f.id);f.store.prepareExit(f.id);const leaving=f.store.contextToken;
 assert.throws(()=>f.store.replace(note('Blocked replacement')),/account change/);assert.equal(f.store.contextToken,leaving);
});

test('identity changes, cached/suspended entry, disconnect and sign-out separate workbook contexts',async()=>{
 const f=fixture();const initial=f.store.contextToken;f.store.setIdentity(f.id);assert.ok(f.store.contextToken>initial);
 const identity=f.store.contextToken;f.store.setIdentity(f.id);assert.equal(f.store.contextToken,identity);
 await f.store.open(f.id);assert.ok(f.store.contextToken>identity);f.store.change(note('Fictional device copy'));await f.store.save();
 const cached=createFounderWorkspace({storage:f.storage,request:f.request});cached.setIdentity(f.id);const unopened=cached.contextToken;
 await cached.open(f.id);assert.ok(cached.contextToken>unopened);assert.equal(cached.state.book.notes.finances,'Fictional device copy');
 const active=cached.contextToken;cached.setIdentity(null);assert.ok(cached.contextToken>active);assert.equal(cached.state.book.notes.finances,'');
 cached.setIdentity(f.id);const suspended=cached.contextToken;await cached.open(f.id);assert.ok(cached.contextToken>suspended);
 const reopened=cached.contextToken;cached.discardDevice();assert.ok(cached.contextToken>reopened);assert.equal(cached.state.accountId,null);
 await cached.open(f.id);const connected=cached.contextToken;cached.finishExit(f.id);assert.ok(cached.contextToken>connected);
 const exited=cached.contextToken;cached.finishExit(f.id);assert.equal(cached.contextToken,exited);
});

test('context is a read-only memory signal and never enters workbook, device, state or request formats',async()=>{
 const f=fixture();assert.equal(typeof f.store.contextToken,'number');assert.throws(()=>{f.store.contextToken=123;},TypeError);
 assert.equal(f.store.identity,null);assert.throws(()=>{f.store.identity='other';},TypeError);
 f.store.setIdentity(f.id);await f.store.open(f.id);f.store.replace(note('Fictional appended summary'));await f.store.save();
 const device=JSON.parse(f.storage.getItem(founderDeviceKey(f.id)));
 assert.deepEqual(Object.keys(device).sort(),['format','accountId','book','base','revision','known','pending','recovery'].sort());
 assert.deepEqual(Object.keys(f.store.state).sort(),['accountId','book','base','revision','known','pending','recovery','incoming','busy','leaving','error','status','rawBackup'].sort());
 const exported=JSON.parse(exportWorkbook(f.store.state.book));assert.deepEqual(Object.keys(exported),Object.keys(emptyWorkbook()));
 assert.equal(JSON.stringify(device).includes('contextToken'),false);assert.equal(JSON.stringify(exported).includes('contextToken'),false);
 const put=f.calls.find(call=>call.method==='PUT');assert.deepEqual(Object.keys(put.payload).sort(),['accountId','revision','request_key','workbook'].sort());
 assert.equal(JSON.stringify(put).includes('contextToken'),false);
});

test('real in-memory replacement still signals context when device persistence fails',async()=>{
 const f=fixture();f.store.setIdentity(f.id);await f.store.open(f.id);const prior=f.store.contextToken;
 f.storage.setItem=()=>{throw Error('Fictional storage failure');};f.store.replace(note('Fictional replacement retained in memory'));
 assert.ok(f.store.contextToken>prior);assert.equal(f.store.state.book.notes.finances,'Fictional replacement retained in memory');
 assert.match(f.store.state.error,/Fictional storage failure/);assert.equal(f.emissions.at(-1).token,f.store.contextToken);
 assert.equal(f.calls.filter(call=>call.method==='PUT').length,0);
});

test('a late account response cannot advance the changed identity context or reveal its workbook',async()=>{
 let release;const store=createFounderWorkspace({storage:memory(),request:()=>new Promise(resolve=>{release=resolve;})});
 store.setIdentity('fictional-account-a');const opening=store.open('fictional-account-a');store.setIdentity('fictional-account-b');const changed=store.contextToken;
 release({accountId:'fictional-account-a',revision:1,workbook:note('Fictional account A private assumptions')});await opening;
 assert.equal(store.contextToken,changed);assert.equal(store.state.accountId,null);assert.equal(store.state.book.notes.finances,'');
});

test('guest and account tab workbooks are hidden across identities and recovered without storage or requests',()=>{
 let storageCalls=0,requestCalls=0;
 const store=createFounderWorkspace({storage:{getItem(){storageCalls++;return null;},setItem(){storageCalls++;},removeItem(){storageCalls++;}},request:async()=>{requestCalls++;throw Error('No implicit request allowed');}});
 store.change(note('Fictional guest notes'));store.setIdentity('fictional-a');
 assert.equal(store.identity,'fictional-a');assert.equal(store.state.book.notes.finances,'');assert.equal(store.hasHiddenWork,true);
 store.change(note('Fictional A cash summary'));store.setIdentity('fictional-b');
 assert.equal(store.state.book.notes.finances,'');store.change(note('Fictional B notes'));store.setIdentity('fictional-a');
 assert.equal(store.state.book.notes.finances,'Fictional A cash summary');store.setIdentity(null);
 assert.equal(store.state.book.notes.finances,'Fictional guest notes');store.setIdentity('fictional-b');
 assert.equal(store.state.book.notes.finances,'Fictional B notes');assert.equal(store.state.accountId,null);
 assert.equal(storageCalls,0);assert.equal(requestCalls,0);
});

test('opening a private workspace adopts only its identity tab notes and failed reads keep them recoverable',async()=>{
 const storage=memory(),calls=[];
 const store=createFounderWorkspace({storage,request:async(method)=>{calls.push(method);throw Error('Fictional private endpoint unavailable');}});
 store.change(note('Fictional guest workbook'));store.setIdentity('fictional-a');store.change(note('Fictional account A workbook'));
 await store.open('fictional-a');assert.equal(store.state.accountId,'fictional-a');assert.equal(store.state.book.notes.finances,'Fictional account A workbook');
 assert.match(store.state.error,/unavailable/);assert.equal(JSON.parse(storage.getItem(founderDeviceKey('fictional-a'))).book.notes.finances,'Fictional account A workbook');
 const callCount=calls.length;store.setIdentity('fictional-b');assert.equal(store.state.book.notes.finances,'');
 store.setIdentity('fictional-a');assert.equal(store.state.book.notes.finances,'');assert.equal(calls.length,callCount);
 await store.open('fictional-a');assert.equal(store.state.book.notes.finances,'Fictional account A workbook');
 store.setIdentity(null);assert.equal(store.state.book.notes.finances,'Fictional guest workbook');assert.equal(calls.includes('PUT'),false);
});

test('sign-out keeps tab notes hidden for the same identity and restores a separate guest workbook',()=>{
 const f=fixture();f.store.change(note('Fictional guest draft'));f.store.setIdentity(f.id);f.store.change(note('Fictional signed-in tab summary'));
 const prior=f.store.contextToken;f.store.finishExit(f.id);
 assert.equal(f.store.identity,null);assert.ok(f.store.contextToken>prior);assert.equal(f.store.state.book.notes.finances,'Fictional guest draft');
 assert.equal(f.store.hasHiddenWork,true);f.store.setIdentity('fictional-b');assert.equal(f.store.state.book.notes.finances,'');
 f.store.setIdentity(f.id);assert.equal(f.store.state.book.notes.finances,'Fictional signed-in tab summary');assert.equal(f.calls.length,0);
});

test('confirmed deletion removes only that identity hidden tab workbook and raw draft; sign-out does not',()=>{
 const deleted=[],rawDrafts=new Map([['fictional-a','private cash A'],['fictional-b','private cash B'],['guest','guest cash']]);
 const store=createFounderWorkspace({storage:memory(),request:async()=>{throw Error('No requests allowed');},onDeleteIdentity:id=>{deleted.push(id);rawDrafts.delete(id);}});
 store.change(note('Guest workbook'));store.setIdentity('fictional-a');store.change(note('A workbook'));store.finishExit('fictional-a');
 assert.deepEqual(deleted,[]);assert.equal(rawDrafts.get('fictional-a'),'private cash A');
 store.setIdentity('fictional-b');store.change(note('B workbook'));const before=store.contextToken;
 store.finishExit('fictional-a',{deleted:true});assert.deepEqual(deleted,['fictional-a']);assert.equal(rawDrafts.has('fictional-a'),false);
 assert.equal(rawDrafts.get('fictional-b'),'private cash B');assert.equal(rawDrafts.get('guest'),'guest cash');
 assert.equal(store.identity,'fictional-b');assert.equal(store.contextToken,before);assert.equal(store.state.book.notes.finances,'B workbook');
 store.setIdentity('fictional-a');assert.equal(store.state.book.notes.finances,'');store.setIdentity(null);assert.equal(store.state.book.notes.finances,'Guest workbook');
});

test('confirmed deletion forwards the draft cleanup signal even if browser storage removal fails',()=>{
 const id=crypto.randomUUID(),deleted=[],storage=memory();storage.removeItem=()=>{throw Error('Fictional device cleanup failure');};
 const store=createFounderWorkspace({storage,request:async()=>{throw Error('No requests allowed');},onDeleteIdentity:value=>deleted.push(value)});
 store.change(note('Separate guest notes'));store.setIdentity(id);store.change(note('Private account tab notes'));
 assert.equal(finishFounderExit(storage,id,null,{deleted:true}),false);assert.deepEqual(deleted,[id]);
 assert.equal(store.identity,null);assert.equal(store.state.book.notes.finances,'Separate guest notes');
 store.setIdentity(id);assert.equal(store.state.book.notes.finances,'');
});
