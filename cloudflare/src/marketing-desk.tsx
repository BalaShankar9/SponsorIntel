import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw,ArrowUpRight,FileCheck2} from 'lucide-react';
import './marketing-desk.css';
import {MarketingAgents} from './marketing-agents';
import {MarketingPerformance} from './marketing-performance';
import {MarketingSchedule} from './marketing-schedule';
import {prepareDecisionSave,sendDecisionSave,DecisionSaveError,type DecisionKind} from '../shared/marketing-decision-save.js';
type Source={title:string;url:string;excerpt:string;checked_at?:string;observed_on?:string};
type Media={id:string;url:string;sha256:string;width:number;height:number;alt:string};
type Receipt={version:number;provider:string;external_id:string;state:string;scheduled_at:string|null;post_url:string|null;observed_at:string;evidence:string};
type Brief={id:string;title:string;destination:string;state:string;version:number;revision:number;purpose:string;text:string;sources:Source[];media:Media[];expires_at:string;writer:string;attention:string|null;events:{revision:number;version:number;kind:string;actor:string;detail:string;created_at:string}[];receipts:Receipt[]};
type Destination={label:string;account:string;provider:string;url:string};
type Desk={items:Brief[];destinations:Record<string,Destination>;measured_at:string};
const stamp=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const labels:Record<string,string>={proposed:'Needs review',held:'Held',reviewed:'Reviewed',scheduled:'Scheduled',uncertain:'Delivery uncertain',published:'Published',failed:'Failed',cancelled:'Cancellation confirmed'};
function detail(value:string){try{return JSON.parse(value).note||value;}catch{return value;}}
async function api(path='',body?:unknown){const r=await fetch('/api/admin/marketing'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw Error(data.error||'Marketing records could not load.');return data;}
function BriefCard({brief,destination,onSaved,onRetain}:{brief:Brief;destination:Destination;onSaved:()=>Promise<Desk>;onRetain:(brief:Brief|null)=>void}){
 const[snapshot,setSnapshot]=useState<{brief:Brief;destination:Destination}|null>(null);
 const b=snapshot?.brief||brief,d=snapshot?.destination||destination;
 const[note,setNote]=useState(''),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[mediaChecked,setMediaChecked]=useState(false);
 const[outcome,setOutcome]=useState<DecisionKind>('uncertain'),[postURL,setPostURL]=useState(''),[external,setExternal]=useState(b.receipts[0]?.external_id||'');
 const[scheduleLocked,setScheduleLocked]=useState(false),[pending,setPending]=useState(false),[saved,setSaved]=useState(false);
 const request=useRef<string|null>(null),sending=useRef(false),scheduleLock=useRef(false),latestBrief=useRef(brief);
 latestBrief.current=brief;
 const receipt=b.receipts[0],editable=['proposed','held','reviewed'].includes(b.state),locked=busy||pending||saved||scheduleLocked;
 useEffect(()=>{
  if(scheduleLock.current)return;
  setScheduleLocked(false);
  if(request.current||sending.current)return;
  setNote('');setChecked(false);setMediaChecked(false);setPostURL('');setOutcome('uncertain');setExternal(brief.receipts[0]?.external_id||'');setError('');
 },[brief.id,brief.revision,brief.state]);
 function acquireSchedule(){
  if(request.current||sending.current)return false;
  if(scheduleLock.current)return true;
  scheduleLock.current=true;setScheduleLocked(true);
  setSnapshot(current=>current||{brief:b,destination:d});onRetain(b);
  return true;
 }
 function finishSchedule(next:Brief|undefined){
  if(!scheduleLock.current)return;
  scheduleLock.current=false;setScheduleLocked(false);setSnapshot(null);onRetain(null);
  setNote('');setChecked(false);setMediaChecked(false);setPostURL('');setOutcome('uncertain');setExternal(next?.receipts[0]?.external_id||'');setError('');
 }
 function releaseSchedule(){finishSchedule(latestBrief.current);}
 async function refreshScheduleSaved(){
  const latest=await onSaved();
  finishSchedule(latest.items.find(item=>item.id===b.id));
 }
 async function refreshSaved(){
  setBusy(true);setError('');
  try{const latest=await onSaved();request.current=null;setSnapshot(null);onRetain(null);setSaved(false);setPending(false);setNote('');setChecked(false);setMediaChecked(false);setPostURL('');setOutcome('uncertain');setExternal(latest.items.find(item=>item.id===b.id)?.receipts[0]?.external_id||'');}
  catch{setError('The decision was saved, but the desk could not refresh. Refresh the saved decision below; do not record it again.');}
  finally{setBusy(false);}
 }
 async function decide(kind:DecisionKind){
  if(scheduleLock.current||scheduleLocked||saved||sending.current)return;
  const retrying=request.current!==null;
  sending.current=true;setBusy(true);setError('');
  try{
   request.current??=prepareDecisionSave(b,d,{note,checked,mediaChecked,external,postURL},kind);
   setSnapshot(current=>current||{brief:b,destination:d});onRetain(b);setPending(true);
   await sendDecisionSave(request.current);
   setSaved(true);setPending(false);
  }catch(e){
   setError((e as Error).message);
   if(!request.current||(!retrying&&e instanceof DecisionSaveError&&!e.uncertain)){request.current=null;setSnapshot(null);onRetain(null);setPending(false);setChecked(false);setMediaChecked(false);}
   return;
  }finally{sending.current=false;setBusy(false);}
  await refreshSaved();
 }
 return <details className="marketing-card">
  <summary><span className={'marketing-state '+b.state}>{labels[b.state]||b.state}</span><span className="marketing-title">{b.title}<small>{d.label}{receipt?.scheduled_at?' · '+stamp(receipt.scheduled_at):''}</small></span><span className="marketing-version">v{b.version}</span></summary>
  {b.attention&&<p className="marketing-attention">{b.attention}. Check the source or provider before taking further action.</p>}
  <p>{b.purpose}</p><div className="marketing-copy">{b.text}</div>
  {!!b.media.length&&<div className="marketing-artwork"><h4>Artwork · part of this version</h4>{b.media.map(m=><figure key={m.id}><a href={m.url} target="_blank" rel="noreferrer"><img src={new URL(m.url).pathname} alt={m.alt} width={m.width} height={m.height} loading="lazy"/></a><figcaption><strong>Accessibility text</strong><p>{m.alt}</p><a href={m.url} target="_blank" rel="noreferrer">Open full image</a></figcaption></figure>)}</div>}
  <p className="business-fine">Evidence expires {stamp(b.expires_at)}. <a href={d.url} target="_blank" rel="noreferrer">Open the exact account <ArrowUpRight size={12}/></a></p>
  <h4>Evidence behind this version</h4>{b.sources.map((s,i)=><div className="marketing-source" key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><small>Observed {stamp(s.checked_at||s.observed_on||'')}</small><p>{s.excerpt}</p></div>)}
  {receipt&&<div className="marketing-receipt"><FileCheck2 size={18}/><div><strong>{labels[receipt.state]||receipt.state} · observed {stamp(receipt.observed_at)}</strong><p>{receipt.evidence}</p><small>Reference: {receipt.external_id} · Content v{receipt.version}</small>{receipt.post_url&&<p><a href={receipt.post_url} target="_blank" rel="noreferrer">View the delivered post</a></p>}</div></div>}
  {(editable||['scheduled','uncertain'].includes(b.state))&&<form className="marketing-decision" onSubmit={e=>e.preventDefault()}>
   <h4>{editable?'Record an editorial decision':'Record a delivery observation'}</h4>
   <p className="business-fine">{editable?'Check every factual claim, source date, exact destination and existing queue. The author cannot approve their own version.':'First inspect the exact social account. This form records what you observed; it does not publish, retry or cancel a post. An empty queue is not proof of delivery.'}</p>
   <fieldset disabled={locked}>
   {!editable&&<><label>Observed result<select value={outcome} onChange={e=>setOutcome(e.target.value as DecisionKind)}><option value="uncertain">Uncertain — investigate before retry</option><option value="published">Published — matching live post found</option><option value="failed">Provider confirmed failure</option><option value="cancelled">Provider confirmed cancellation</option></select></label><label>Provider post or schedule reference<input value={external} onChange={e=>setExternal(e.target.value)} maxLength={200}/></label>{outcome==='published'&&<label>Live post URL<input type="url" value={postURL} onChange={e=>setPostURL(e.target.value)} placeholder={b.destination==='instagram-company'?'https://www.instagram.com/p/…/':'https://…'}/></label>}</>}
   <label>{editable?'Evidence and decision notes':'What did the provider show?'}<textarea value={note} onChange={e=>setNote(e.target.value)} minLength={20} maxLength={1200} rows={3} placeholder="Include the evidence for this decision…"/></label>
   {editable&&b.state!=='reviewed'&&<label className="marketing-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked the claims, sources, destination and duplication.</label>}
   {!!b.media.length&&(editable?b.state!=='reviewed':outcome==='published')&&<label className="marketing-check"><input type="checkbox" checked={mediaChecked} onChange={e=>setMediaChecked(e.target.checked)}/>{editable?'I checked every image, its claims and accessibility text.':'I verified the exact caption, ordered images and accessibility text on the company post.'}</label>}
   </fieldset>
   {pending&&!busy&&<p className="marketing-attention" role="status">The save is not confirmed. The original decision and observation time are retained in this open page, including after a desk refresh. Inspect the existing record or provider job; retry only this same decision. Leaving or reloading the page loses this pending request, so reconcile the ledger before starting again.</p>}
   {saved?<div role="status"><p>Decision saved. No post was sent. Only the desk refresh remains.</p><button disabled={busy} onClick={()=>void refreshSaved()}>Refresh saved decision</button></div>:pending?<button disabled={busy||scheduleLocked} onClick={()=>void decide(outcome)}>{busy?'Confirming decision…':'Retry this same decision'}</button>:<div className="business-actions">{editable?<><button disabled={locked||note.trim().length<20} onClick={()=>void decide('held')}>Hold with reason</button>{b.state!=='reviewed'&&<button disabled={locked||!checked||(b.media.length>0&&!mediaChecked)||note.trim().length<20} onClick={()=>void decide('reviewed')}>Record review</button>}</>:<button disabled={locked||note.trim().length<20||(outcome==='published'&&(!postURL||(b.media.length>0&&!mediaChecked)))} onClick={()=>void decide(outcome)}>Save delivery observation</button>}</div>}
   {error&&<p className="career-error" role="alert">{error}</p>}
  </form>}
  {b.state==='reviewed'&&<MarketingSchedule key={b.id+':'+b.revision} brief={b} destination={d} onSaved={refreshScheduleSaved} onAcquire={acquireSchedule} onRelease={releaseSchedule} disabled={busy||pending||saved}/>}
  <details className="marketing-history"><summary>Decision history · {b.events.length} recent records</summary>{b.events.map(e=><div key={e.revision}><strong>{e.kind.replaceAll('_',' ')} · v{e.version}</strong><small>{stamp(e.created_at)} · {e.actor.startsWith('owner:')?'Owner review':e.actor}</small><p>{detail(e.detail)}</p></div>)}</details>
 </details>;
}
export function MarketingDesk(){
 const[data,setData]=useState<Desk|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const[retained,setRetained]=useState<Record<string,Brief>>({});
 const items=data?[...data.items,...Object.values(retained).filter(b=>!data.items.some(current=>current.id===b.id))]:[];
 function retain(id:string,brief:Brief|null){setRetained(current=>{const next={...current};if(brief)next[id]=brief;else delete next[id];return next;});}
 async function load():Promise<Desk>{try{const next:Desk=await api();setData(next);setError('');return next;}catch(e){setError((e as Error).message);throw e;}}
 useEffect(()=>{void load().catch(()=>{});},[]);
 async function sync(){setBusy(true);try{const r=await api('/sync',{});setMessage(`${r.prepared} new brief${r.prepared===1?'':'s'} prepared. Existing schedules reconciled from recorded evidence. No posts sent.`);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function welcome(){setBusy(true);setError('');try{const r=await api('/instagram-welcome',{});setMessage(r.replayed?'The existing Instagram welcome is retained. Review its evidence and expiry; no duplicate was created.':'Instagram welcome prepared with checked sources and artwork. It needs independent review. No post was sent.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="business-ops marketing-desk" aria-labelledby="marketing-heading">
  <header className="business-head"><div><p className="business-eyebrow">From idea to delivery</p><h2 id="marketing-heading">Marketing desk</h2><p>Content, sources, review decisions and delivery evidence in one place.</p></div><div className="business-actions"><button aria-label="Refresh marketing desk" onClick={()=>void load().catch(()=>{})}><RefreshCw size={16}/></button><button disabled={busy} onClick={()=>void sync()}>Prepare & reconcile</button><button disabled={busy} onClick={()=>void welcome()}>Prepare Instagram welcome</button></div></header>
  <p className="marketing-boundary">Editorial agents prepare sourced drafts and record independent model reviews here. Facebook and Instagram are connected through Metricool; LinkedIn uses its native scheduler. This desk records drafts, reviews and observed receipts. It does not send posts or automatically verify delivery. The Instagram welcome is a sourced template and needs a separate review.</p>
  <MarketingAgents/>
  <MarketingPerformance/>
  {error&&<p className="career-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {!data?<p>Loading marketing records…</p>:<>
   <div className="business-metrics marketing-metrics">{[['proposed','Needs review'],['scheduled','Scheduled'],['published','Published'],['attention','Needs attention']].map(([key,label])=><div key={key}><strong>{data.items.filter(b=>key==='attention'?b.attention||['held','failed','uncertain'].includes(b.state):b.state===key).length}</strong><span>{label}</span></div>)}</div>
   <p className="business-fine">Latest 50 briefs. Scheduled is not published. Imported launch records retain their original observation date and do not claim a retrospective independent review. Changes here do not modify the provider queue.</p>
   {items.length?items.map(b=><BriefCard key={b.id} brief={b} destination={data.destinations[b.destination]} onSaved={load} onRetain={value=>retain(b.id,value)}/>):<p>No briefs yet. Prepare & reconcile will import the recorded launch queue and prepare available report drafts.</p>}
  </>}
 </section>;
}
