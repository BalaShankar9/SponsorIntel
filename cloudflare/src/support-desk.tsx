import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw,MessageSquare,ArrowRight} from 'lucide-react';
import './support-desk.css';
type Report={id:string;kind:string;message:string;context:string;app_version:string;created_at:string;support_queue:string;support_state:string;support_version:number;support_updated_at:string|null};
type Summary={total:number;open:number;new:number;in_progress:number;resolved:number;closed:number;overdue:number;overdue_quality:number};
type Snapshot={items:Report[];summary:Summary;next_cursor:string|null;policy:string};
const statuses:Record<string,string>={new:'New',in_progress:'Investigating',resolved:'Verified fix',closed:'Closed without a fix'};
const queues:Record<string,string>={engineering:'Bugs & technical help',evidence:'Information corrections',product:'Ideas & feedback'};
const date=(v:string)=>new Date(v).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
async function api(path:string,body?:unknown){
 const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 const result=await response.json();if(!response.ok)throw Error(result.error||'This action could not be confirmed. Refresh to check its status.');return result;
}
export function SupportDesk(){
 const [state,setState]=useState('open'),[queue,setQueue]=useState('all'),[cursors,setCursors]=useState<(string|null)[]>([null]);
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const current=cursors[cursors.length-1];
 useEffect(()=>{let active=true;setBusy(true);setError('');setData(null);
  const params=new URLSearchParams({state,queue});if(current)params.set('cursor',current);
  api('/api/admin/support?'+params).then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[state,queue,current,refresh]);
 const changed=()=>{setCursors([null]);setRefresh(n=>n+1);};
 return <section className="career-panel support-desk" aria-label="Support queue" aria-busy={busy}>
  <div className="support-heading"><div><p className="eyebrow">LOOK AFTER YOUR USERS</p><h2><MessageSquare size={22}/> Support queue</h2></div><button className="secondary-button" disabled={busy} onClick={changed}><RefreshCw size={15}/> Refresh reports</button></div>
  <p>Follow every report through to a recorded outcome. Messages and review notes are private; no AI reads them.</p>
  {data&&<div className="support-totals">{[[data.summary.open,'Unresolved'],[data.summary.overdue,'Over 72 hours'],[data.summary.resolved,'Verified fixes'],[data.summary.closed,'Closed without a fix']].map(([n,label])=><div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div>}
  <div className="support-filters"><label>Status<select value={state} onChange={e=>{setState(e.target.value);setCursors([null]);}}><option value="open">All unresolved</option>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}<option value="all">All reports</option></select></label><label>Review team<select value={queue} onChange={e=>{setQueue(e.target.value);setCursors([null]);}}><option value="all">All teams</option>{Object.entries(queues).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
  {error&&<p role="alert" className="career-error">{error}</p>}{busy&&<p role="status">Loading reports…</p>}
  {data&&<>{data.items.length?data.items.map(item=><SupportReport key={item.id+':'+item.support_version} item={item} changed={changed}/>):<div className="support-empty"><MessageSquare size={26}/><h3>No reports in this view</h3><p>{data.summary.total?'Try a different status or review team.':'Reports sent through the site’s feedback button will appear here automatically.'}</p></div>}
   <div className="support-pagination"><button disabled={busy||cursors.length===1} onClick={()=>setCursors(v=>v.slice(0,-1))}>Previous reports</button><span>Page {cursors.length} · Oldest first</span><button disabled={busy||!data.next_cursor} onClick={()=>setCursors(v=>[...v,data.next_cursor])}>More reports <ArrowRight size={14}/></button></div><p className="fine-print">{data.policy}</p></>}
 </section>;
}
function SupportReport({item,changed}:{item:Report;changed:()=>void}){
 const [state,setState]=useState(item.support_state),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState<{events:{from_state:string;to_state:string;note:string;created_at:string}[];older_events:boolean}|null>(null),[historyBusy,setHistoryBusy]=useState(false);
 const action=useRef<{signature:string;operation_id:string}|null>(null),pending=useRef(false);
 let context:{page?:string;item?:{label?:string}}={};try{const value=JSON.parse(item.context);if(value&&typeof value==='object'&&!Array.isArray(value))context=value;}catch{/* Old reports can have no context. */}
 const overdue=['new','in_progress'].includes(item.support_state)&&Date.now()-Date.parse(item.created_at)>72*3600000;
 async function save(e:React.FormEvent){e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('');
  const body={id:item.id,version:item.support_version,state,note};const signature=JSON.stringify(body);
  if(action.current?.signature!==signature)action.current={signature,operation_id:crypto.randomUUID()};
  try{await api('/api/admin/support/review',{...body,operation_id:action.current.operation_id});changed();}catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}
 }
 async function loadHistory(){setHistoryBusy(true);setError('');try{setHistory(await api('/api/admin/support/history?id='+encodeURIComponent(item.id)));}catch(e){setError((e as Error).message);}finally{setHistoryBusy(false);}}
 return <article className="support-report" aria-label={'Report '+item.id}>
  <div className="support-report-meta"><span className="tag">{queues[item.support_queue]}</span><span className="tag">{statuses[item.support_state]}</span>{overdue&&<span className="support-overdue">Review overdue</span>}<time dateTime={item.created_at}>{date(item.created_at)}</time></div>
  <p className="preserve-lines">{item.message}</p><p className="fine-print preserve-lines">{context.page||'No page shared'}{context.item?.label?' · '+context.item.label:''} · Version {item.app_version||'unknown'}<br/>Reference: {item.id}</p>
  <details><summary>Review this report</summary><form onSubmit={save}>
   <label>Next status<select value={state} disabled={busy} onChange={e=>setState(e.target.value)}>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label>Private review note<textarea value={note} required minLength={['resolved','closed'].includes(state)?30:10} maxLength={1600} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder="What did you check? Record the fix and verification, next action, or reason for closing."/></label>
   <p className="fine-print">Use “Verified fix” only after reproducing and checking the repair. Use “Closed without a fix” for a reviewed duplicate, unsupported report or declined idea. You can reopen either outcome. No reply is sent to the submitter.</p>
   <button className="primary-button" disabled={busy}>{busy?'Saving review…':'Save private review'}</button>
  </form></details>
  <button className="text-button" disabled={historyBusy||busy} onClick={loadHistory}>{historyBusy?'Loading history…':'View review history'}</button>
  {error&&<p role="alert" className="career-error">{error}</p>}
  {history&&<div className="support-history">{history.events.length?history.events.map((e,i)=><div key={i}><small>{date(e.created_at)} · {statuses[e.from_state]} → {statuses[e.to_state]}</small><p className="preserve-lines">{e.note}</p></div>):<p>No review recorded yet.</p>}{history.older_events&&<p className="fine-print">Showing the latest 25 reviews. Older reviews remain retained.</p>}</div>}
 </article>;
}
