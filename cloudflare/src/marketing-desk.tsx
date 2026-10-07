import React,{useEffect,useState} from 'react';
import {RefreshCw,ArrowUpRight,FileCheck2} from 'lucide-react';
import './marketing-desk.css';
type Source={title:string;url:string;excerpt:string;checked_at?:string;observed_on?:string};
type Receipt={version:number;provider:string;external_id:string;state:string;scheduled_at:string|null;post_url:string|null;observed_at:string;evidence:string};
type Brief={id:string;title:string;destination:string;state:string;version:number;revision:number;purpose:string;text:string;sources:Source[];expires_at:string;writer:string;attention:string|null;events:{revision:number;version:number;kind:string;actor:string;detail:string;created_at:string}[];receipts:Receipt[]};
type Destination={label:string;account:string;provider:string;url:string};
type Desk={items:Brief[];destinations:Record<string,Destination>;measured_at:string};
const stamp=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const labels:Record<string,string>={proposed:'Needs review',held:'Held',reviewed:'Reviewed',scheduled:'Scheduled',uncertain:'Delivery uncertain',published:'Published',failed:'Failed',cancelled:'Cancellation confirmed'};
function detail(value:string){try{return JSON.parse(value).note||value;}catch{return value;}}
async function api(path='',body?:unknown){const r=await fetch('/api/admin/marketing'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw Error(data.error||'Marketing records could not load.');return data;}
function BriefCard({brief:b,destination:d,onSaved}:{brief:Brief;destination:Destination;onSaved:()=>Promise<void>}){
 const[note,setNote]=useState(''),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const[outcome,setOutcome]=useState('uncertain'),[postURL,setPostURL]=useState(''),[external,setExternal]=useState(b.receipts[0]?.external_id||'');
 const receipt=b.receipts[0],editable=['proposed','held','reviewed'].includes(b.state);
 async function decide(kind:string){
  setBusy(true);setError('');
  try{await api('/decide',{id:b.id,revision:b.revision,kind,note,request_key:crypto.randomUUID(),
   checks:kind==='reviewed'?{claims:checked,sources:checked,destination:checked,duplication:checked}:undefined,
   receipt:editable?undefined:{account:d.account,provider:d.provider,external_id:external,observed_at:new Date().toISOString(),post_url:postURL,evidence:note}});
   setNote('');setChecked(false);await onSaved();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details className="marketing-card">
  <summary><span className={'marketing-state '+b.state}>{labels[b.state]||b.state}</span><span className="marketing-title">{b.title}<small>{d.label}{receipt?.scheduled_at?' · '+stamp(receipt.scheduled_at):''}</small></span><span className="marketing-version">v{b.version}</span></summary>
  {b.attention&&<p className="marketing-attention">{b.attention}. Check the source or provider before taking further action.</p>}
  <p>{b.purpose}</p><div className="marketing-copy">{b.text}</div>
  <p className="business-fine">Evidence expires {stamp(b.expires_at)}. <a href={d.url} target="_blank" rel="noreferrer">Open the exact account <ArrowUpRight size={12}/></a></p>
  <h4>Evidence behind this version</h4>{b.sources.map((s,i)=><div className="marketing-source" key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><small>Observed {stamp(s.checked_at||s.observed_on||'')}</small><p>{s.excerpt}</p></div>)}
  {receipt&&<div className="marketing-receipt"><FileCheck2 size={18}/><div><strong>{labels[receipt.state]||receipt.state} · observed {stamp(receipt.observed_at)}</strong><p>{receipt.evidence}</p><small>Reference: {receipt.external_id} · Content v{receipt.version}</small>{receipt.post_url&&<p><a href={receipt.post_url} target="_blank" rel="noreferrer">View the delivered post</a></p>}</div></div>}
  {(editable||['scheduled','uncertain'].includes(b.state))&&<form className="marketing-decision" onSubmit={e=>e.preventDefault()}>
   <h4>{editable?'Record an editorial decision':'Record a delivery observation'}</h4>
   <p className="business-fine">{editable?'Check every factual claim, source date, exact destination and existing queue. The author cannot approve their own version.':'First inspect the exact social account. This form records what you observed; it does not publish, retry or cancel a post. An empty queue is not proof of delivery.'}</p>
   {!editable&&<><label>Observed result<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="uncertain">Uncertain — investigate before retry</option><option value="published">Published — matching live post found</option><option value="failed">Provider confirmed failure</option><option value="cancelled">Provider confirmed cancellation</option></select></label><label>Provider post or schedule reference<input value={external} onChange={e=>setExternal(e.target.value)} maxLength={200}/></label>{outcome==='published'&&<label>Live post URL<input type="url" value={postURL} onChange={e=>setPostURL(e.target.value)} placeholder="https://www.linkedin.com/feed/update/…"/></label>}</>}
   <label>{editable?'Evidence and decision notes':'What did the provider show?'}<textarea value={note} onChange={e=>setNote(e.target.value)} minLength={20} maxLength={1200} rows={3} placeholder="Include the evidence for this decision…"/></label>
   {editable&&b.state!=='reviewed'&&<label className="marketing-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked the claims, sources, destination and duplication.</label>}
   <div className="business-actions">{editable?<><button disabled={busy||note.trim().length<20} onClick={()=>void decide('held')}>Hold with reason</button>{b.state!=='reviewed'&&<button disabled={busy||!checked||note.trim().length<20} onClick={()=>void decide('reviewed')}>Record review</button>}</>:<button disabled={busy||note.trim().length<20||(outcome==='published'&&!postURL)} onClick={()=>void decide(outcome)}>Save delivery observation</button>}</div>
   {error&&<p className="career-error" role="alert">{error}</p>}
  </form>}
  <details className="marketing-history"><summary>Decision history · {b.events.length} recent records</summary>{b.events.map(e=><div key={e.revision}><strong>{e.kind.replaceAll('_',' ')} · v{e.version}</strong><small>{stamp(e.created_at)} · {e.actor.startsWith('owner:')?'Owner review':e.actor}</small><p>{detail(e.detail)}</p></div>)}</details>
 </details>;
}
export function MarketingDesk(){
 const[data,setData]=useState<Desk|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){try{setData(await api());setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 async function sync(){setBusy(true);try{const r=await api('/sync',{});setMessage(`${r.prepared} new brief${r.prepared===1?'':'s'} prepared. Existing schedules reconciled from recorded evidence. No posts sent.`);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="business-ops marketing-desk" aria-labelledby="marketing-heading">
  <header className="business-head"><div><p className="business-eyebrow">From idea to delivery</p><h2 id="marketing-heading">Marketing desk</h2><p>Content, sources, review decisions and delivery evidence in one place.</p></div><div className="business-actions"><button aria-label="Refresh marketing desk" onClick={()=>void load()}><RefreshCw size={16}/></button><button disabled={busy} onClick={()=>void sync()}>Prepare & reconcile</button></div></header>
  <p className="marketing-boundary">This desk keeps the record. Facebook uses Metricool and LinkedIn uses its native scheduler. Planning and writing agents, automatic delivery checks and Instagram publishing are still being built.</p>
  {error&&<p className="career-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {!data?<p>Loading marketing records…</p>:<>
   <div className="business-metrics marketing-metrics">{[['proposed','Needs review'],['scheduled','Scheduled'],['published','Published'],['attention','Needs attention']].map(([key,label])=><div key={key}><strong>{data.items.filter(b=>key==='attention'?b.attention||['held','failed','uncertain'].includes(b.state):b.state===key).length}</strong><span>{label}</span></div>)}</div>
   <p className="business-fine">Latest 50 briefs. Scheduled is not published. Imported launch records retain their original observation date and do not claim a retrospective independent review. Changes here do not modify the provider queue.</p>
   {data.items.length?data.items.map(b=><BriefCard key={b.id+':'+b.revision} brief={b} destination={data.destinations[b.destination]} onSaved={load}/>):<p>No briefs yet. Prepare & reconcile will import the recorded launch queue and prepare available report drafts.</p>}
  </>}
 </section>;
}
