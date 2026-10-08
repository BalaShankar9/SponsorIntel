import React,{useEffect,useRef,useState} from 'react';
type Review={id:string;source_id:string;apply_url:string;revision:number;state:string;title:string;reason:string;evidence_url:string;note:string;observed_at:string;follow_up_at:string|null;recorded_at:string};
type Data={page:number;summary:{total:number;held:number;overdue:number};sources:{id:string;company:string}[];items:Review[]};
const labels:Record<string,string>={deadline_conflict:'Conflicting deadlines',sponsorship_conflict:'Conflicting sponsorship wording',availability_conflict:'Uncertain availability',other:'Other evidence problem'};
const local=(s:string)=>{const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);};
const display=(s:string)=>new Date(s).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const empty=()=>({source_id:'',apply_url:'',revision:0,state:'held',title:'',reason:'deadline_conflict',evidence_url:'',note:'',observed_at:local(new Date().toISOString()),follow_up_at:local(new Date(Date.now()+86400000).toISOString())});
async function api(query='',body?:unknown){const r=await fetch('/api/admin/job-reviews'+query,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw Error(data.error||'The review could not be loaded.');return data;}
export function JobReviews(){
 const [data,setData]=useState<Data|null>(null),[page,setPage]=useState(1),[form,setForm]=useState(empty),[selected,setSelected]=useState<Review|null>(null),[history,setHistory]=useState<Review[]>([]),[before,setBefore]=useState<number|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
 const key=useRef(crypto.randomUUID());
 const load=async()=>setData(await api('?page='+page));
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[page]);
 function change(k:string,v:string){key.current=crypto.randomUUID();setForm(f=>({...f,[k]:v}));}
 async function open(r:Review){setBusy(true);setMessage('');try{const d=await api('?id='+r.id);setSelected(d.review);setHistory(d.history);setBefore(d.next_before);setForm({...d.review,observed_at:local(d.review.observed_at),follow_up_at:d.review.follow_up_at?local(d.review.follow_up_at):local(new Date(Date.now()+86400000).toISOString())});key.current=crypto.randomUUID();setEditing(true);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{
 const {source_id,apply_url,revision,state,title,reason,evidence_url,note,observed_at,follow_up_at}=form;
 const d=await api('',{source_id,apply_url,revision,state,title,reason,evidence_url,note,observed_at:selected&&observed_at===local(selected.observed_at)?selected.observed_at:new Date(observed_at).toISOString(),follow_up_at:state==='held'?new Date(follow_up_at).toISOString():null,request_key:key.current});
 setMessage(d.review.state==='held'?'Advert held. Employer refreshes cannot return it to current opportunities.':'Review released. A later successful employer refresh is required before this role can return.');setEditing(false);setSelected(null);setForm(empty());key.current=crypto.randomUUID();await load();
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="career-panel" aria-labelledby="job-reviews-heading">
 <h2 id="job-reviews-heading">Advert reviews</h2>
 <p>Hold an individual advert when its dates, sponsorship wording or availability conflict. Complete employer-feed checks still apply. Holds never expire automatically; releasing one requires fresh evidence and a later successful feed refresh.</p>
 {message&&<p className="career-notice" role="status">{message}</p>}
 {data&&<><p><strong>{data.summary.held} adverts held</strong> · {data.summary.overdue} follow-ups due · {data.summary.total} reviewed adverts</p>
 <button className="secondary-button" disabled={busy} onClick={()=>{setSelected(null);setHistory([]);setBefore(null);setForm(empty());key.current=crypto.randomUUID();setEditing(true);setMessage('');}}>Hold an advert</button>
 {editing&&<form className="platform-form" onSubmit={e=>void save(e)}>
 <label>Employer source<select required disabled={!!selected||busy} value={form.source_id} onChange={e=>change('source_id',e.target.value)}><option value="">Choose an employer</option>{data.sources.map(s=><option key={s.id} value={s.id}>{s.company}</option>)}</select></label>
 <label>Original advert URL<input type="url" required maxLength={1500} disabled={!!selected||busy} value={form.apply_url} onChange={e=>change('apply_url',e.target.value)}/></label>
 <label>Advert title<input required minLength={3} maxLength={240} value={form.title} onChange={e=>change('title',e.target.value)}/></label>
 <label>Evidence problem<select value={form.reason} onChange={e=>change('reason',e.target.value)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>Public evidence URL<input type="url" required maxLength={1500} value={form.evidence_url} onChange={e=>change('evidence_url',e.target.value)}/></label>
 <label>Evidence observed at<input type="datetime-local" step="1" required value={form.observed_at} onChange={e=>change('observed_at',e.target.value)}/></label><button type="button" className="secondary-button" onClick={()=>change('observed_at',local(new Date().toISOString()))}>I checked the evidence just now</button>
 <label className="wide">Evidence and decision<textarea required minLength={30} maxLength={2000} value={form.note} onChange={e=>change('note',e.target.value)}/></label>
 <p className="fine-print wide">Record the exact role/reference and conflicting wording, or the fresh evidence resolving it. Use public links without session identifiers. Keep applicant details, CVs and credentials out of this record. Evidence must be observed within 72 hours.</p>
 {selected&&<label>Decision<select value={form.state} onChange={e=>change('state',e.target.value)}><option value="held">Keep or place on hold</option><option value="released">Release after evidence review</option></select></label>}
 {form.state==='held'&&<label>Review again by (within seven days)<input type="datetime-local" step="1" required value={form.follow_up_at} onChange={e=>change('follow_up_at',e.target.value)}/></label>}
 <button className="primary-button" disabled={busy}>{busy?'Saving…':form.state==='held'?'Save advert hold':'Record release for next refresh'}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>
 </form>}
 {history.length>0&&editing&&<details><summary>Decision history ({history.length} loaded)</summary>{history.map(r=><article key={r.id}><strong>Revision {r.revision} · {r.state} · {display(r.recorded_at)}</strong><p>{r.note}</p><a href={r.evidence_url} target="_blank" rel="noopener noreferrer">Review evidence</a></article>)}{before&&selected&&<button type="button" className="secondary-button" onClick={()=>void api('?id='+selected.id+'&before='+before).then(d=>{setHistory(h=>[...h,...d.history]);setBefore(d.next_before);}).catch(e=>setMessage(e.message))}>Older decisions</button>}</details>}
 <div>{data.items.map(r=><article className="source-status" key={r.id}><div><strong>{r.title}</strong><p>{r.state==='held'?'Held':'Released for a later refresh'} · {labels[r.reason]}{r.follow_up_at?' · Follow-up '+display(r.follow_up_at):''}</p><a href={r.apply_url} target="_blank" rel="noopener noreferrer">Original advert</a></div><button className="secondary-button" disabled={busy} onClick={()=>void open(r)}>Review advert</button></article>)}</div>
 {!data.items.length&&<p>No advert reviews recorded on this page.</p>}
 {data.summary.total>25&&<div className="platform-actions"><button disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Previous reviews</button><span>Page {page}</span><button disabled={page*25>=data.summary.total||busy} onClick={()=>setPage(p=>p+1)}>Next reviews</button></div>}
 </>}
 </section>;
}
