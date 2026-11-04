import {emptyWorkbook,parseWorkbook,hasWork} from './founder.js';

export const founderDeviceKey=id=>'si.founder.user.'+encodeURIComponent(id);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const book=b=>parseWorkbook(JSON.stringify(b));
const validRevision=r=>Number.isSafeInteger(r)&&r>=0;
const stores=new Set();
const blank=()=>({accountId:null,book:emptyWorkbook(),base:emptyWorkbook(),revision:0,known:false,pending:null,recovery:null,incoming:null,busy:false,leaving:false,error:'',status:'Held in this tab only',rawBackup:null});
function parseDevice(raw,id){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>1500000)throw Error('The device copy cannot be opened. Export its raw text before removing it.');
 const d=JSON.parse(raw);
 if(d.format!=='si-founder-device-v1'||d.accountId!==id||!validRevision(d.revision)||typeof d.known!=='boolean')throw Error('The device copy does not match this account or format.');
 const result={accountId:id,book:book(d.book),base:book(d.base),revision:d.revision,known:d.known,pending:null,recovery:d.recovery?book(d.recovery):null};
 if(d.pending){
  const p=d.pending;
  if(p.accountId!==id||!validRevision(p.revision)||typeof p.request_key!=='string'||!/^[a-f0-9-]{36}$/i.test(p.request_key))throw Error('The pending save is not valid. Preserve this device copy.');
  result.pending={accountId:id,revision:p.revision,request_key:p.request_key,workbook:book(p.workbook)};
 }
 return result;
}
function encoded(s){return JSON.stringify({format:'si-founder-device-v1',accountId:s.accountId,book:s.book,base:s.base,revision:s.revision,known:s.known,pending:s.pending,recovery:s.recovery});}
export const founderDirty=s=>!!s.pending||!same(s.book,s.base);
export function createFounderWorkspace({storage,request,uuid=()=>crypto.randomUUID(),notify=()=>{}}){
 let s=blank(),identity=null,raw=null,epoch=0;
 const suspended=new Map();
 const emit=()=>notify({...s});
 const persist=()=>{
  if(!s.accountId)return;
  if(s.rawBackup)throw Error('Preserve the unopened device copy, then explicitly remove it before saving or opening another copy.');
  const key=founderDeviceKey(s.accountId),next=encoded(s);
  if(storage.getItem(key)!==raw)throw Error('Another tab changed the device copy. Your current work remains here; export it before reopening.');
  storage.setItem(key,next);
  if(storage.getItem(key)!==next)throw Error('The device copy could not be verified. Keep this tab open and export your work.');
  raw=next;
 };
 const fail=e=>{s={...s,error:e instanceof Error?e.message:String(e),status:'Current work kept; action needs attention'};emit();};
 const scope=()=>{if(!identity||identity!==s.accountId||s.leaving)throw Error('Sign in to the same account and finish any account change first.');};
 const cloud=data=>{
  if(data?.accountId!==s.accountId||!validRevision(data.revision))throw Error('The saved response belongs to a changed account or is invalid. Current work was kept.');
  return {book:book(data.workbook),revision:data.revision};
 };
 const receive=remote=>{
  if((s.known&&remote.revision===s.revision&&same(remote.book,s.base))||same(s.book,remote.book)||(!hasWork(s.book)&&!founderDirty(s))){
   // Matching bases permit unsynced edits to survive a cloud read.
   const keep=s.known&&remote.revision===s.revision&&same(remote.book,s.base)&&founderDirty(s);
   s={...s,book:keep?s.book:remote.book,base:remote.book,revision:remote.revision,known:true,incoming:null,status:keep?'Unsaved changes recovered on this device':'Saved account copy opened'};
  }else s={...s,incoming:remote,status:'Two copies need your choice. Neither has been overwritten.'};
  persist();emit();
 };
 async function refresh(){
  scope();if(s.rawBackup)throw Error('Preserve and explicitly remove the unopened device copy first.');if(s.busy||s.pending)throw Error('Reconcile the pending save before opening another cloud copy.');
  const ticket=epoch;s={...s,busy:true,error:''};emit();
  try{const remote=await request('GET');if(ticket!==epoch)return;receive(cloud(remote));}
  catch(e){if(ticket===epoch)fail(e);}
  finally{if(ticket===epoch){s={...s,busy:false};emit();}}
 }
 const api={
  get state(){return {...s};},
  get hasHiddenWork(){return [...suspended.values()].some(x=>founderDirty(x.state)||x.state.recovery||x.state.error);},
  setIdentity(id){
   if(identity===id)return;
   identity=id;epoch++;
   if(s.accountId&&s.accountId!==id){
    // A session can expire even when browser storage has failed. Hide the
    // notes from other identities but retain this tab copy for the same owner.
    suspended.set(s.accountId,{state:{...s,busy:false,leaving:false},raw});s=blank();raw=null;
   }
   s={...s,busy:false};emit();
  },
  change(next){
   if(s.leaving)throw Error('Finish the account change before editing.');
   s={...s,book:book(next),error:'',status:s.accountId?'Unsaved changes on this device':'Held in this tab only'};
   try{persist();}catch(e){fail(e);}emit();
  },
  async open(id){
   if(id!==identity||!id)throw Error('Sign in before opening your private founder workspace.');
   if(s.accountId){await refresh();return;}
   const held=suspended.get(id);
   if(held){
    if(hasWork(s.book)&&!same(s.book,held.state.book))throw Error('Export your separate tab notes before reopening the retained account copy.');
    s=held.state;raw=held.raw;suspended.delete(id);emit();
    try{persist();}catch(e){fail(e);return;}
    if(s.pending){s={...s,status:'Reconcile the retained exact save before continuing.'};emit();return;}
    await refresh();return;
   }
   let cached;
   try{
    raw=storage.getItem(founderDeviceKey(id));cached=raw?parseDevice(raw,id):null;
    if(cached&&hasWork(s.book)&&!same(s.book,cached.book))throw Error('A separate device workbook exists. Export your tab notes, then clear the tab before opening that copy.');
   }catch(e){s={...s,accountId:id,known:false,rawBackup:raw};fail(e);return;}
   s={...s,...(cached||{accountId:id}),rawBackup:null,error:''};emit();
   try{persist();}catch(e){fail(e);return;}
   if(s.pending){s={...s,status:'A previous save has an uncertain result. Reconcile that exact save before continuing.'};emit();return;}
   await refresh();
  },
  refresh,
  choose(which){
   scope();if(s.busy||s.pending||!s.incoming)throw Error('Wait for the current action.');
   if(s.recovery)throw Error('Export or restore the existing recovery copy, then explicitly remove it before replacing another copy.');
   const remote=s.incoming;
   s={...s,recovery:which==='cloud'&&hasWork(s.book)?s.book:which==='local'&&hasWork(remote.book)?remote.book:null,book:which==='cloud'?remote.book:s.book,base:remote.book,revision:remote.revision,known:true,incoming:null,error:'',status:which==='cloud'?'Saved copy opened; previous notes kept in device recovery':'Your copy kept for an explicit save; cloud copy kept in device recovery'};
   try{persist();}catch(e){fail(e);}emit();
  },
  restoreRecovery(){
   scope();if(s.busy||s.pending||!s.recovery)throw Error('Reconcile any save first.');
   if(founderDirty(s))throw Error('Save or export your current edits before restoring the recovery copy.');
   s={...s,book:s.recovery,error:'',status:'Recovery copy restored locally; save explicitly to update your account'};
   try{persist();}catch(e){fail(e);}emit();
  },
  removeRecovery(){
   scope();if(s.busy||s.pending)throw Error('Reconcile any save first.');
   s={...s,recovery:null,error:''};try{persist();}catch(e){fail(e);}emit();
  },
  async save(){
   scope();if(s.busy||s.incoming||!s.known&&!s.pending)throw Error('Open and compare your saved workbook before saving.');
   const ticket=epoch;
   try{
    if(!s.pending){s={...s,pending:{accountId:s.accountId,revision:s.revision,request_key:uuid(),workbook:s.book}};persist();}
    else persist();
   }catch(e){fail(e);return;}
   const pending=s.pending;s={...s,busy:true,error:'',status:'Saving this exact workbook…'};emit();
   try{
    const result=await request('PUT',pending);if(ticket!==epoch)return;
    if(result?.accountId!==pending.accountId||result.revision!==pending.revision+1)throw Error('The save acknowledgement could not be verified. Reconcile the same save before continuing.');
    s={...s,base:pending.workbook,revision:result.revision,known:true,pending:null,status:same(s.book,pending.workbook)?'Saved to your account':'Earlier edits saved; newer edits remain on this device'};
    persist();emit();
   }catch(e){
    if(ticket!==epoch)return;
    // Only a receipt-aware revision conflict proves this request was not saved.
    if(e.code==='founder_revision_conflict'){s={...s,pending:null,known:false};try{persist();}catch{}}
    fail(e);
   }finally{if(ticket===epoch){s={...s,busy:false};emit();}}
  },
  discardDevice(){
   if(s.busy||s.leaving)throw Error('Wait for the current action.');
   const id=s.accountId||identity;if(!id)throw Error('Sign in to the account that owns this device copy.');
   const key=founderDeviceKey(id);
   if(storage.getItem(key)!==raw)throw Error('The device copy changed. Reopen it before choosing to remove it.');
   storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('The device copy could not be removed.');
   epoch++;s=blank();raw=null;emit();
  },
  prepareExit(id){if(s.accountId===id){if(s.busy||founderDirty(s)||s.recovery)throw Error('Save or export and resolve your Founder hub device/recovery copy before signing out.');s={...s,leaving:true};emit();}},
  cancelExit(){s={...s,leaving:false};emit();},
  finishExit(id){suspended.delete(id);if(s.accountId===id){epoch++;identity=null;s=blank();raw=null;emit();}},
 };
 stores.add(api);return api;
}
export function prepareFounderExit(storage,id){
 const raw=storage.getItem(founderDeviceKey(id));
 if(raw){const d=parseDevice(raw,id);if(founderDirty(d)||d.recovery)throw Error('Save or export and resolve your Founder hub device/recovery copy before signing out.');}
 try{for(const store of stores)store.prepareExit(id);}catch(e){for(const store of stores)store.cancelExit();throw e;}
 return raw;
}
export function cancelFounderExit(){for(const store of stores)store.cancelExit();}
export function finishFounderExit(storage,id,expected,{deleted=false}={}){
 const key=founderDeviceKey(id);let removed=false;
 try{if(deleted||storage.getItem(key)===expected){storage.removeItem(key);removed=storage.getItem(key)===null;}}
 catch{/* The account action already succeeded. Keep any failed device cleanup explicit. */}
 finally{for(const store of stores)store.finishExit(id);}
 return removed;
}
