import React,{useState} from 'react';
import {exportWorkbook} from '../shared/founder.js';
import {founderDirty,type FounderState} from '../shared/founder-workspace.js';
import {founderStore} from './founder-data';

export function FounderStorage({state,user}:{state:FounderState;user:{id:string;name:string}|null}){
 const[showBackup,setShowBackup]=useState(false),[confirm,setConfirm]=useState(''),[error,setError]=useState('');
 const act=async(fn:()=>void|Promise<void>)=>{setError('');try{await fn();}catch(e){setError((e as Error).message);}};
 return <section className="founder-card" aria-label="Founder workbook saving">
  <h3>{state.accountId?'Your private account workbook':'Keep your founder work'}</h3>
  <p role="status">{state.status}{state.accountId?` · Saved revision ${state.revision}`:''}</p>
  {!state.accountId&&<><p>Account saving stores this workbook separately from your career applications. Opening it also keeps a private recovery copy on this browser. Your notes are sent only when you choose Save; never to AI. Avoid sensitive documents or customer records. On shared devices, resolve any unsaved copy and sign out when finished.</p>{user?<button disabled={state.busy} onClick={()=>void act(()=>founderStore.open(user.id))}>Open my private founder workspace</button>:<p><a href="/signin">Sign in to use account saving</a>. Export these tab notes before leaving.</p>}</>}
  {state.accountId&&<div className="founder-tools">
   <button disabled={state.busy||state.leaving||!!state.incoming||!state.known&&!state.pending||!founderDirty(state)} onClick={()=>void act(()=>founderStore.save())}>{state.pending?'Reconcile last save':founderDirty(state)?'Save workbook to my account':'Saved to my account'}</button>
   <button disabled={state.busy||state.leaving||!!state.pending} onClick={()=>void act(()=>founderStore.refresh())}>Check saved account copy</button>
   <button disabled={state.busy||state.leaving} onClick={()=>setConfirm('device')}>Remove device copy & disconnect</button>
  </div>}
  {(state.error||error)&&<p className="founder-confirm" role="alert">{error||state.error} Your current notes remain available below.</p>}
  {state.pending&&<p>A save is awaiting reconciliation. This action sends the original request and content again, so it cannot create a second revision. Newer edits stay separate until that save is resolved.</p>}
  {state.incoming&&<div className="founder-confirm" role="region" aria-label="Compare founder copies">
   <h3>Your account has another copy</h3><p>Review both copies before choosing. Choosing your current notes does not save them automatically. The replaced copy stays in device recovery until you explicitly remove it.</p>
   <div className="founder-two"><label className="founder-field">Current notes<textarea aria-label="Current founder copy" readOnly rows={7} value={exportWorkbook(state.book)}/></label><label className="founder-field">Saved account revision {state.incoming.revision}<textarea aria-label="Saved founder copy" readOnly rows={7} value={exportWorkbook(state.incoming.book)}/></label></div>
   <button disabled={state.busy} onClick={()=>void act(()=>founderStore.choose('cloud'))}>Open saved copy; keep current in recovery</button>
   <button disabled={state.busy} onClick={()=>void act(()=>founderStore.choose('local'))}>Keep my notes for an explicit save</button>
  </div>}
  <button onClick={()=>setShowBackup(!showBackup)}>{showBackup?'Hide':'Show'} copyable workbook backup</button>
  {showBackup&&<label className="founder-field">Copy this private text into a .json file when downloads are unavailable.<textarea aria-label="Copyable founder workbook" readOnly rows={8} value={exportWorkbook(state.book)}/></label>}
  {state.recovery&&<div className="founder-confirm" role="region" aria-label="Founder recovery copy"><h3>Previous workbook kept on this device</h3><p>Copy this text into a private .json file or restore it. A download request alone is not evidence that a file was saved. This recovery copy is not a remote backup.</p><label className="founder-field">Recovery workbook<textarea aria-label="Founder recovery JSON" readOnly rows={6} value={exportWorkbook(state.recovery)}/></label><div className="founder-tools"><button disabled={state.busy||!!state.pending} onClick={()=>void act(()=>founderStore.restoreRecovery())}>Restore recovery notes locally</button><button disabled={state.busy||!!state.pending} onClick={()=>setConfirm('recovery')}>Remove this recovery copy</button></div></div>}
  {state.rawBackup&&<label className="founder-field">Unopened device copy — preserve this raw text before removing it.<textarea aria-label="Unopened founder device copy" readOnly rows={7} value={state.rawBackup}/><button onClick={()=>setConfirm('device')}>Remove this unreadable device copy</button></label>}
  {confirm&&<div className="founder-confirm" role="region" aria-label="Confirm founder device removal"><p>{confirm==='device'?'Remove this browser’s founder workbook, unsaved changes, pending-save reference and recovery copy? Export or copy anything you need first. This does not delete your account workbook; an uncertain save may already have reached your account.':'Remove the previous recovery copy from this browser? Copy or restore it first if you still need it. Current notes and your account copy remain unchanged.'}</p><button onClick={()=>void act(()=>{if(confirm==='device')founderStore.discardDevice();else founderStore.removeRecovery();setConfirm('');})}>Remove the selected device copy</button><button onClick={()=>setConfirm('')}>Keep it</button></div>}
 </section>;
}
