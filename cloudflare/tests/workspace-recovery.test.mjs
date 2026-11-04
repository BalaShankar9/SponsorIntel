import test from 'node:test';
import assert from 'node:assert/strict';
import {readRecoveryCopy,preserveRecoveryCopy,discardRecoveryCopy,switchCloudWorkspace,recoveryKey,workspaceKey} from '../shared/workspace-recovery.js';
const data=cv=>({version:2,profile:{cv},applications:[],searches:[]});
const fixture=()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},local=data('Fictional unsynced work'),remote={data:data('Fictional cloud copy'),revision:2,accountId:'alice'};
 storage.setItem(workspaceKey('alice'),JSON.stringify({data:local,revision:1,dirty:true}));
 const options={storage,id:'alice',data:local,revision:1,readCloud:async()=>remote,isCurrent:()=>true,onPreserved:()=>{},now:Date.parse('2026-10-11T19:00:00Z')};return {map,storage,local,remote,options};
};
test('cloud switch keeps exact local evidence first, without any download, and retains it across later reads',async()=>{
 const f=fixture();let kept=false;
 f.options.onPreserved=copy=>{assert.deepEqual(copy.snapshot.data,f.local);kept=true;};
 f.options.readCloud=async()=>{assert.equal(kept,true);assert.deepEqual(readRecoveryCopy(f.storage,'alice').snapshot.data,f.local);return f.remote;};
 assert.deepEqual(await switchCloudWorkspace(f.options),f.remote);
 assert.deepEqual(JSON.parse(f.storage.getItem(workspaceKey('alice'))),{data:f.remote.data,revision:f.remote.revision,dirty:false});
 assert.deepEqual(readRecoveryCopy(f.storage,'alice').snapshot.data,f.local);
 assert.equal(readRecoveryCopy(f.storage,'bob'),null);
});
test('full or silently blocked browser storage stops before cloud access and leaves the current cache intact',async()=>{
 for(const mode of ['throw','ignore']){const f=fixture(),before=f.storage.getItem(workspaceKey('alice'));let calls=0;
 f.storage.setItem=()=>{if(mode==='throw')throw Error('Quota exceeded');};f.options.readCloud=async()=>{calls++;return f.remote;};
 await assert.rejects(switchCloudWorkspace(f.options));assert.equal(calls,0);assert.equal(f.storage.getItem(workspaceKey('alice')),before);}
});
test('network failure and malformed responses preserve current work and recovery copy without overwriting it on retry',async()=>{
 for(const response of [null,{accountId:'alice',data:{},revision:2},{accountId:'alice',data:data('x'),revision:-1}]){const f=fixture(),before=f.storage.getItem(workspaceKey('alice'));
 f.options.readCloud=async()=>{if(!response)throw Error('offline');return response;};await assert.rejects(switchCloudWorkspace(f.options));assert.equal(f.storage.getItem(workspaceKey('alice')),before);const backup=readRecoveryCopy(f.storage,'alice');assert.deepEqual(backup.snapshot.data,f.local);
 await assert.rejects(switchCloudWorkspace({...f.options,data:data('later edit')}),/already kept/);assert.equal(readRecoveryCopy(f.storage,'alice').raw,backup.raw);}
});
test('account navigation, edits and other-tab cache or backup changes cannot be overwritten by a late cloud response',async()=>{
 for(const mode of ['account','edit','cache','backup']){const f=fixture(),before=f.storage.getItem(workspaceKey('alice'));
 f.options.readCloud=async()=>{if(mode==='cache')f.storage.setItem(workspaceKey('alice'),'another tab unsynced work');if(mode==='backup')f.storage.setItem(recoveryKey('alice'),'another tab recovery');return f.remote;};f.options.isCurrent=()=>!['account','edit'].includes(mode);
 await assert.rejects(switchCloudWorkspace(f.options));assert.equal(f.storage.getItem(workspaceKey('alice')),mode==='cache'?'another tab unsynced work':before);}
});
test('failed cloud-cache persistence retains the original recovery copy',async()=>{
 const f=fixture(),set=f.storage.setItem;f.storage.setItem=(k,v)=>{if(k===workspaceKey('alice'))throw Error('Quota exhausted');set(k,v);};
 await assert.rejects(switchCloudWorkspace(f.options),/Quota/);assert.deepEqual(readRecoveryCopy(f.storage,'alice').snapshot.data,f.local);
});
test('recovery deletion requires the exact observed copy, preserves other accounts and does not touch the current workspace',()=>{
 const f=fixture();const a=preserveRecoveryCopy(f.storage,'alice',f.local,1),b=preserveRecoveryCopy(f.storage,'bob',data('Bob private'),3),current=f.storage.getItem(workspaceKey('alice'));
 assert.throws(()=>discardRecoveryCopy(f.storage,'bob',a.raw),/changed/);assert.throws(()=>discardRecoveryCopy(f.storage,'alice','stale'),/changed/);
 discardRecoveryCopy(f.storage,'alice',a.raw);assert.equal(readRecoveryCopy(f.storage,'alice'),null);assert.equal(readRecoveryCopy(f.storage,'bob').raw,b.raw);assert.equal(f.storage.getItem(workspaceKey('alice')),current);
});
test('damaged or wrong-account recovery content is preserved for export and cannot be silently replaced',()=>{
 const f=fixture();for(const raw of ['damaged',JSON.stringify({version:1,userId:'bob',data:f.local,createdAt:'2026-10-11',revision:1})]){f.storage.setItem(recoveryKey('alice'),raw);assert.deepEqual(readRecoveryCopy(f.storage,'alice'),{raw,snapshot:null});assert.throws(()=>preserveRecoveryCopy(f.storage,'alice',f.local,1),/already kept/);assert.equal(f.storage.getItem(recoveryKey('alice')),raw);}
});

test('a changed server session cannot load another account into the original workspace',async()=>{
 const f=fixture(),before=f.storage.getItem(workspaceKey('alice'));f.options.readCloud=async()=>({...f.remote,accountId:'bob',data:data('Bob private data')});
 await assert.rejects(switchCloudWorkspace(f.options),/signed-in account changed/);assert.equal(f.storage.getItem(workspaceKey('alice')),before);assert.equal(readRecoveryCopy(f.storage,'alice').snapshot.data.profile.cv,f.local.profile.cv);assert.equal(readRecoveryCopy(f.storage,'bob'),null);
});
