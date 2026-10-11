import React,{useEffect,useRef,useState} from 'react';
type Destination={label:string;account:string;provider:string;url:string};
const metrics=['impressions','views','reach','clicks','link_clicks','reactions','comments','shares','saves'] as const;
type Observation={id:string;destination:string;title:string;post_url:string;observed_at:string;window_type:string;window_start:string|null;window_end:string;timezone:string;published_at:string|null;availability:string;metrics:Record<string,number|null>;campaign_id:string|null;assessment_type:string;corrected:boolean;supersedes:string|null;evidence_url:string;note:string};
type Snapshot={items:Observation[];destinations:Record<string,Destination>;limit:string};
const labels:Record<string,string>={impressions:'Impressions',views:'Views',reach:'Reach',clicks:'All clicks',link_clicks:'External link clicks',reactions:'Reactions',comments:'Comments',shares:'Shares / reposts',saves:'Saves'};
const empty={destination:'facebook-company',title:'',post_url:'',observed_at:'',window_type:'lifetime',window_start:'',window_end:'',timezone:'Europe/London',published_at:'',availability:'reported',assessment_type:'agent_assisted',evidence_url:'',note:'',campaign_url:'',supersedes:''};
async function api(body?:unknown){const r=await fetch('/api/admin/marketing/performance',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok)throw Error(d.error||'Performance observations could not load.');return d;}
export function MarketingPerformance(){
 const[data,setData]=useState<Snapshot|null>(null),[form,setForm]=useState(empty),[values,setValues]=useState<Record<string,string>>({}),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const lastRequest=useRef<{body:string;key:string}|null>(null);
 async function load(){try{setData(await api());setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 function field(key:keyof typeof empty,label:string,type='text',required=true){return <label>{label}<input type={type} required={required} value={form[key]} maxLength={key==='note'?1000:1000} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></label>;}
 async function save(e:React.FormEvent){
  e.preventDefault();if(!data)return;setBusy(true);setError('');setMessage('');
  try{
   const toUTC=(v:string)=>v?new Date(v).toISOString():null,d=data.destinations[form.destination];
   const body={...form,account:d.account,provider:d.provider,identity_checked:checked,observed_at:toUTC(form.observed_at),window_start:form.window_type==='period'?toUTC(form.window_start):null,window_end:toUTC(form.window_end),published_at:toUTC(form.published_at),metrics:Object.fromEntries(metrics.map(k=>[k,form.availability==='unavailable'||!values[k]?.trim()?null:Number(values[k])]))};
   const serialized=JSON.stringify(body);
   if(lastRequest.current?.body!==serialized)lastRequest.current={body:serialized,key:crypto.randomUUID()};
   const r=await api({...body,request_key:lastRequest.current.key});
   setMessage(`${r.replayed?'Existing observation retained':'Observation saved'}. No post was sent or delivery state changed. Reference: ${r.id}`);await load();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="marketing-card" aria-labelledby="marketing-performance-heading">
  <h3 id="marketing-performance-heading">What happened after posting?</h3>
  <p>Retain the exact post, reporting window and figures shown by the platform. Blank means unknown. These observations help the next eligible planner; they do not prove customer growth.</p>
  {error&&<p className="career-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {!data?<p>Loading performance observations…</p>:<>
   <p className="business-fine">{data.limit}</p>
   <button onClick={()=>void load()}>Refresh performance observations</button>
   <details><summary>Record a platform observation</summary><form className="marketing-decision" onSubmit={e=>void save(e)}>
    <p>Use public post aggregates only. Check the exact author/account and source first; this form cannot verify them automatically. Do not include people’s names, messages, credentials or audience profiles.</p>
    <label>Account<select value={form.destination} onChange={e=>{setForm(f=>({...f,destination:e.target.value}));setChecked(false);}}>{Object.entries(data.destinations).map(([id,d])=><option key={id} value={id}>{d.label}</option>)}</select></label>
    <p>Required account: <a href={data.destinations[form.destination].url} target="_blank" rel="noreferrer">{data.destinations[form.destination].account}</a></p>
    {field('title','Post title')}{field('post_url','Exact public post URL','url')}{field('evidence_url','Native analytics or Metricool evidence URL','url')}
    <p className="business-fine">Enter the actual observation and period times. Date/time fields use this browser’s local timezone. The separate provider timezone records how the source defines its reporting period.</p>
    {field('observed_at','Observed at','datetime-local')}
    <label>Reporting window<select value={form.window_type} onChange={e=>setForm(f=>({...f,window_type:e.target.value,window_start:''}))}><option value="lifetime">Lifetime to the reported time</option><option value="period">Specific reporting period</option></select></label>
    {form.window_type==='period'&&field('window_start','Period starts','datetime-local')}{field('window_end','Figures through','datetime-local')}{field('timezone','Provider reporting timezone')}{field('published_at','Exact publication time, if known','datetime-local',false)}
    <label>Metric availability<select value={form.availability} onChange={e=>setForm(f=>({...f,availability:e.target.value}))}><option value="reported">Platform reports figures</option><option value="unavailable">Missing or unavailable — no figures</option></select></label>
    {form.availability==='reported'&&<div className="performance-fields">{metrics.map(k=><label key={k}>{labels[k]}<input type="number" min="0" max="10000000000" step="1" placeholder="Unknown" value={values[k]||''} onChange={e=>setValues(v=>({...v,[k]:e.target.value}))}/></label>)}</div>}
    {field('campaign_url','Exact campaign destination from the post, if present','url',false)}
    <p className="business-fine">Copy the platform’s metric name: views and impressions are separate. Leave campaign blank when it is untagged or unrecognised. Do not add tracking to an old link retrospectively.</p>
    <label>Observation made by<select value={form.assessment_type} onChange={e=>setForm(f=>({...f,assessment_type:e.target.value}))}><option value="agent_assisted">Agent-assisted through owner account</option><option value="owner">Owner personally</option></select></label>
    {field('supersedes','Corrected observation reference, if needed','text',false)}
    <label>Source evidence and limitations<textarea required minLength={20} maxLength={1000} rows={3} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/></label>
    <label className="marketing-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I checked this post belongs to the exact account above and copied the platform’s window and metrics.</label>
    <button disabled={busy||!checked} type="submit">{busy?'Saving observation…':'Save performance observation'}</button>
   </form></details>
   {!data.items.length?<p>No platform observations recorded. Website events remain separate.</p>:data.items.map(p=><details className="marketing-history" key={p.id}><summary>{p.title} · {p.corrected?'Corrected; retained in history':p.availability==='unavailable'?'Figures unavailable':'Observed figures'} · {new Date(p.observed_at).toLocaleString('en-GB')}</summary>
    <p>{data.destinations[p.destination]?.label} · {p.assessment_type==='agent_assisted'?'Agent-assisted observation':'Owner observation'}</p>
    <p>{p.window_type==='period'?`${p.window_start} to `:'Lifetime through '}{p.window_end} · provider timezone {p.timezone}. {p.published_at?'Publication: '+p.published_at:'Publication time unknown; post-age comparison unavailable.'}</p>
    <p>{metrics.map(k=>`${labels[k]}: ${p.metrics[k]==null?'unknown':p.metrics[k].toLocaleString('en-GB')}`).join(' · ')}</p>
    <p>{p.note}</p><p><a href={p.post_url} target="_blank" rel="noreferrer">Open exact post</a> · <a href={p.evidence_url} target="_blank" rel="noreferrer">Open analytics evidence</a></p><p>Campaign: {p.campaign_id||'Unlinked — no campaign attribution established'}. Reference: {p.id}{p.supersedes?' · Corrects '+p.supersedes:''}</p>
   </details>)}
  </>}
 </section>;
}
