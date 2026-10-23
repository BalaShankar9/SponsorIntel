import React,{useEffect,useRef,useState} from 'react';
import {useCareer,download,sponsorLabels} from './career-data';
import {batchLabels,batchSelectionHash,batchWorkspaceHash} from '../shared/application-batch.js';
import './application-batches.css';
import {factSafeAttempt} from '../shared/application-facts.js';
import {ApplicationFacts} from './application-facts';

type Summary={id:string;state:'active'|'paused'|'cancelled';revision:number;created_at:string;updated_at:string;count:number};
type Item={id:string;title:string;company:string;location:string;url:string|null;status:string;issues:string[];report:string;in_workspace:boolean};
type Batch=Summary&{facts:React.ComponentProps<typeof ApplicationFacts>['batch']['facts'];items:Item[];history:{revision:number;state:string;recorded_at:string}[]};
type Attempt={path:string;body:Record<string,unknown>};
const base='/api/career/batches';
const stateLabel=(state:string)=>({active:'Open',paused:'Paused',cancelled:'Ended'}[state]||state);
const date=(value:string)=>new Date(value).toLocaleString();

export function ApplicationBatches({go}:{go:(view:string)=>void}) {
 const c=useCareer();
 return <section className="application-batches" aria-labelledby="batch-heading"><div className="batch-heading"><div><p className="batch-eyebrow">ONE SELECTION. A CLEAR NEXT STEP.</p><h2 id="batch-heading">Prepare a group of applications</h2><p>Select saved roles and check the evidence in your CV for each one. Notes stay private in your account.</p></div></div>
  {c.user?<BatchWorkspace key={c.user.id} go={go}/>:<p><button className="secondary-button" onClick={()=>go('signin')}>Sign in to prepare a batch</button></p>}
 </section>;
}
function BatchWorkspace({go}:{go:(view:string)=>void}) {
 const c=useCareer(),account=c.user!.id,storageKey='si.batch.pending.'+account;
 const [ids,setIds]=useState<string[]>([]),[list,setList]=useState<Summary[]>([]),[batch,setBatch]=useState<Batch|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmEnd,setConfirmEnd]=useState(false),[checkedData,setCheckedData]=useState('');
 const [pending,setPending]=useState<Attempt|null>(()=>{try{const p=JSON.parse(sessionStorage.getItem(storageKey)||'null');return p?.body?.accountId===account&&typeof p.path==='string'&&p.path.startsWith(base)&&p.body.request_key?p:null;}catch{return null;}});
 const alive=useRef(true),serial=useRef(0),dataRef=useRef(c.data);dataRef.current=c.data;
 const dirty=!!batch&&checkedData!==JSON.stringify(c.data);
 const locked=busy||!!pending;
 function remember(value:Attempt|null){setPending(value);try{if(value)sessionStorage.setItem(storageKey,JSON.stringify(factSafeAttempt(value)));else sessionStorage.removeItem(storageKey);}catch{/* The in-memory attempt is retained if browser storage is unavailable. */}}
 async function read(path:string){const r=await fetch(path,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'The saved batches could not be loaded.');if(d.accountId!==account)throw Error('Your signed-in account changed. Reload to continue.');return d;}
 async function load(id?:string){const n=++serial.current;setBusy(true);setError('');const data=dataRef.current,input=JSON.stringify(data);try{const d=await read(id?base+'/'+id:base),matches=!id||d.workspace_hash===await batchWorkspaceHash(data);if(!alive.current||serial.current!==n)return;if(id){setBatch(d.batch);setCheckedData(matches?input:'');setConfirmEnd(false);if(pending&&d.batch.facts?.some((p:{request_key:string;revoke_request_key:string})=>p.request_key===pending.body.request_key||p.revoke_request_key===pending.body.request_key)){remember(null);setNotice('The original facts request was found. Its saved history is shown.');}}else setList(d.batches);}catch(e){if(alive.current&&serial.current===n)setError((e as Error).message);}finally{if(alive.current&&serial.current===n)setBusy(false);}}
 useEffect(()=>{alive.current=true;void (async()=>{await load();const id=pending?.path.slice(base.length+1);if(id&&alive.current)await load(id);})();return()=>{alive.current=false;serial.current++;};},[]);
 useEffect(()=>{if(!pending)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[pending]);
 async function send(attempt:Attempt){
  const n=++serial.current,data=dataRef.current,input=JSON.stringify(data);remember(attempt);setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch(attempt.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.body)}),d=await r.json();
   if(!alive.current||serial.current!==n)return;
   if(!r.ok){if(r.status<500)remember(null);throw Error(d.error||'The result is uncertain. Check the saved batches or retry the same request.');}
   if(d.accountId!==account)throw Error('Your signed-in account changed. Reload to continue.');
   const matches=d.workspace_hash===await batchWorkspaceHash(data);if(!alive.current||serial.current!==n)return;
   remember(null);setBatch(d.batch);setCheckedData(matches?input:'');setConfirmEnd(false);
   setList(old=>[d.batch,...old.filter(x=>x.id!==d.batch.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at)));
   setNotice(d.duplicate?'This selection and advert status already have a saved batch. Its existing record is shown.':'Saved to your account. No application was sent.');
  }catch(e){if(alive.current&&serial.current===n)setError((e as Error).message||'The result is uncertain. Retry the same request.');}
  finally{if(alive.current&&serial.current===n)setBusy(false);}
 }
 async function prepare(){if(locked)return;setError('');setNotice('');setBusy(true);const input=dataRef.current;try{const hash=await batchSelectionHash(input,ids);if(!alive.current)return;if(input!==dataRef.current){setError('Your workspace changed. Review the selection again.');setBusy(false);return;}await send({path:base,body:{accountId:account,application_ids:[...ids],input_hash:hash,request_key:crypto.randomUUID()}});}catch(e){if(alive.current){setError((e as Error).message);setBusy(false);}}}
 function change(action:string){if(!batch||locked)return;void send({path:base+'/'+batch.id,body:{accountId:account,revision:batch.revision,action,request_key:crypto.randomUUID()}});}
 return <>
  <p className="batch-boundary">This step prepares evidence notes only. It does not generate CVs with AI, fill employer forms or send applications. Checking shared words does not prove that you meet a role’s requirements.</p>
  <details className="batch-selection"><summary>Choose roles <span>{ids.length} selected</span></summary>
   <p>Choose up to 100 roles already in your workspace. New jobs will not be added to this selection automatically.</p>
   <div className="batch-actions"><button className="secondary-button" disabled={locked||!c.data.applications.length} onClick={()=>setIds(c.data.applications.map(a=>a.id))}>Select all {c.data.applications.length} saved roles</button><button className="secondary-button" disabled={locked||!ids.length} onClick={()=>setIds([])}>Clear selection</button><button className="secondary-button" onClick={()=>go('career-profile')}>My CV &amp; profile</button></div>
   {!c.data.applications.length&&<p>Save roles from Jobs, or use Add a role above, then return here.</p>}
   <div className="batch-options">{c.data.applications.map(a=><label key={a.id} className="batch-option"><input type="checkbox" disabled={locked} checked={ids.includes(a.id)} onChange={e=>setIds(old=>e.target.checked?[...old,a.id]:old.filter(id=>id!==a.id))}/><span><strong>{a.title||'Untitled role'}</strong><span>{a.company} · {a.location||'Location not recorded'}</span><small>{sponsorLabels[a.sponsorship]} · {a.stage}</small></span></label>)}</div>
   {ids.some(id=>!c.data.applications.some(a=>a.id===id))&&<p role="status">A selected role was removed. Clear the selection and choose again.</p>}
   <p>Your exact synced CV and selected roles will be checked. If you just edited them, allow account sync to finish first.</p>
   <button className="primary-button" disabled={locked||!ids.length||!c.ready||c.status!=='Synced to your account'} onClick={()=>void prepare()}>{busy?'Working…':`Prepare evidence for ${ids.length} ${ids.length===1?'role':'roles'}`}</button><small className="batch-sync">{c.status}</small>
  </details>
  {error&&<p role="alert" className="batch-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {pending&&<div className="batch-boundary" role="status"><strong>{busy?'Saving your request…':'A request has not been confirmed.'}</strong><p>Check saved batches, or retry this same request. Repeating it cannot create another batch or repeat a recorded action. If you reloaded during a facts confirmation, reopen its form below and restore the exact answers, or recheck the roles to find its saved receipt.</p><button className="secondary-button" disabled={busy||pending.body.action==='approve_facts'&&!pending.body.answers} onClick={()=>void send(pending)}>Retry the same request</button></div>}
  <div className="batch-heading"><h3>Saved batches <small>{list.length}/20</small></h3><button className="secondary-button" disabled={busy} onClick={()=>void load()}>Check saved batches</button></div>
  {!list.length&&<p>No saved batches loaded yet. You can retain up to 20; ending one keeps its history.</p>}
  <div className="batch-list">{list.map(b=><button key={b.id} className={'batch-list-item'+(batch?.id===b.id?' selected':'')} disabled={busy} onClick={()=>void load(b.id)}><strong>{b.count} {b.count===1?'role':'roles'} · {stateLabel(b.state)}</strong><span>{date(b.created_at)}</span></button>)}</div>
  {batch&&<div className="batch-detail"><div className="batch-heading"><div><h3>{batch.count} {batch.count===1?'role':'roles'} · {stateLabel(batch.state)}</h3><p>Created {date(batch.created_at)} · revision {batch.revision}</p></div><button className="secondary-button" disabled={busy} onClick={()=>void load(batch.id)}>Recheck roles</button></div>
   {dirty&&<p className="batch-error" role="status">Your workspace changed since this check. Wait for account sync, then recheck the roles. Earlier notes are hidden until you do.</p>}
   <p>{batch.state==='paused'?'This batch is paused. No background preparation or submission runs.':batch.state==='cancelled'?'This batch has ended. Its private notes and history are retained.':'These notes are saved. No background preparation or submission runs.'} Role availability is checked when you open or recheck the batch.</p>
   <div className="batch-actions">{batch.state!=='cancelled'&&<><button className="secondary-button" disabled={locked} onClick={()=>change(batch.state==='paused'?'resume':'pause')}>{batch.state==='paused'?'Reopen batch':'Pause batch'}</button><button className="secondary-button" disabled={locked} onClick={()=>setConfirmEnd(true)}>End batch</button></>}<button className="secondary-button" disabled={busy||dirty} onClick={()=>download(JSON.stringify({version:1,exported_at:new Date().toISOString(),submission_available:false,batch},null,2),'sponsor-intel-batch-'+batch.id+'.json','application/json')}>Download private batch copy</button></div>
   {confirmEnd&&<div className="batch-boundary"><p>End this batch? It cannot be reopened. Notes and history remain saved. Unchanged inputs and advert status will still open this record.</p><button className="secondary-button" disabled={locked} onClick={()=>change('cancel')}>Confirm end batch</button><button className="secondary-button" onClick={()=>setConfirmEnd(false)}>Keep open</button></div>}
   <ApplicationFacts key={batch.id+':'+batch.revision+':'+batch.facts.length} batch={batch} profile={c.data.profile} blocked={dirty||batch.state!=='active'||c.status!=='Synced to your account'||batch.items.some(i=>['changed','missing','blocked','needs_information'].includes(i.status))} busy={busy} pending={pending} onSend={a=>send({...a,body:{...a.body,accountId:account}})} onProfile={()=>go('career-profile')}/>
   {!dirty&&batch.items.map(item=><article key={item.id} className="batch-role"><div className="batch-heading"><div><h4>{item.title||'Untitled role'}</h4><p>{item.company} · {item.location||'Location not recorded'}</p></div><strong className="batch-status">{batchLabels[item.status]||'Check this role'}</strong></div>{item.issues.length>0&&<ul>{item.issues.map(x=><li key={x}>{x}</li>)}</ul>}<div className="batch-actions">{item.in_workspace&&<button className="secondary-button" onClick={()=>{c.setSelected(item.id);go('studio');}}>Open application workspace</button>}{item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer">Original application link</a>}</div>{item.report&&<details><summary>{item.status==='prepared'?'Read evidence notes':'Read earlier evidence notes'} · prepared {date(batch.created_at)}</summary><pre>{item.report}</pre></details>}</article>)}
   <details><summary>Batch history</summary><ol>{batch.history.map(h=><li key={h.revision}>{stateLabel(h.state)} · revision {h.revision} · {date(h.recorded_at)}</li>)}</ol></details>
   <p className="batch-footnote">Batch copies include saved facts, answers and CV excerpts. Keep downloads private. Server records are separate from your workspace backup and are deleted when you remove your account. Downloaded files remain on your device. Account batches are limited to 20 retained records.</p>
  </div>}
 </>;
}
