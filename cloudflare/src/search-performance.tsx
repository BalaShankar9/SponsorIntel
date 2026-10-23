import React,{useEffect,useState} from 'react';
import {ArrowUpRight,RefreshCw,Search,Pause,Play} from 'lucide-react';
import './search-performance.css';
type Metric={clicks:number;impressions:number;ctr:number;position:number|null};
type Part={state:string;rows?:any[];error?:string;excluded_rows?:number;row_limit_reached?:boolean};
type Run={day:string;state:string;trigger_kind:string;created_at:string;finished_at:string|null;requests:number;result:{window?:{startDate:string;endDate:string};parts?:Record<string,Part>;inspections?:any[];error?:string}|null};
type Data={property:string;enabled:boolean;reading_enabled:boolean;business_enabled:boolean;configured:boolean;status:string;connected:boolean;latest:Run|null;runs:Run[];schedule:string;scope:string};
const labels:Record<string,string>={not_configured:'Google connection needed',awaiting_first_read:'Ready for the first read',paused:'Search reading paused',running:'Reading Google data',completed:'Latest read completed',partial:'Some reports could not be read',failed:'Latest read failed',overdue:'Search evidence is overdue',invalid_timestamp:'Search evidence has an invalid date',interrupted:'The daily read was interrupted'};
const stamp=(s:string)=>new Date(s).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const number=(n:number|undefined|null)=>n==null?'—':n.toLocaleString('en-GB');
const google='https://search.google.com/search-console?resource_id=https%3A%2F%2Fsponsorintel.london%2F';
export function SearchPerformance(){
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(){try{const r=await fetch('/api/admin/search');if(!r.ok)throw Error('Search evidence could not load.');setData(await r.json());setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 async function act(path:string,body:unknown){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/search/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),x=await r.json();if(!r.ok)throw Error(x.error||'Search reading could not update.');setMessage(path==='run'?`Read status: ${x.state}${x.reused?' · Today’s recorded attempt was retained.':''}.`:'Saved.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const run=data?.latest,result=run?.result,total:Metric|undefined=result?.parts?.total?.state==='available'?result.parts.total.rows?.[0]:undefined;
 const pages=result?.parts?.pages,inspections=result?.inspections||[];
 return <section className="search-desk" aria-labelledby="search-heading">
  <header><div><p className="search-eyebrow">Measured visibility</p><h2 id="search-heading"><Search size={24}/> Search performance</h2><p>Google observations for sponsorintel.london, with reporting dates and limits.</p></div><a href={google} target="_blank" rel="noreferrer">Open Search Console <ArrowUpRight size={16}/></a></header>
  {error&&<p role="alert" className="career-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {!data?<p>Loading search evidence…</p>:<>
   <div className={'search-status '+(data.connected?'ready':'')}><div><strong>{labels[data.status]||data.status}</strong><p>{run?`Last attempt ${stamp(run.created_at)} · ${run.trigger_kind==='scheduled'?'Scheduled':'Owner-triggered'} · ${run.requests}/10 requests`:'No API read has been recorded.'}</p></div><div className="search-actions"><button onClick={()=>void load()} disabled={busy} aria-label="Refresh search evidence"><RefreshCw size={16}/></button><button disabled={busy||!data.configured||!data.enabled||run?.day===new Date().toISOString().slice(0,10)} onClick={()=>void act('run',{})}>Read today’s data</button><button disabled={busy} onClick={()=>void act('settings',{enabled:!data.reading_enabled})}>{data.reading_enabled?<Pause size={16}/>:<Play size={16}/>} {data.reading_enabled?'Pause':'Resume'}</button></div></div>
   {!data.business_enabled&&<p role="status" className="search-note">Business operations are paused. Resume them in the business desk before this reader can run.</p>}
   {!data.configured&&<div className="search-setup"><h3>One read-only connection is still required</h3><p>Google ownership is separate from cloud access. A dedicated account needs Restricted access to this property, with its credential stored as a Cloudflare secret. Setup needs the owner’s permission; no credential is requested through this page.</p><p>The reader is limited to this site’s aggregate search metrics, public page URLs, sitemap and four stored indexing inspections. It cannot submit or remove pages, change permissions or post content.</p></div>}
   <p className="search-note">{data.schedule} At most 10 Google requests per day, including authentication. A failed or interrupted attempt is retained until the next UTC day. Pausing business operations also pauses this reader.</p>
   {run&&<>
    {result?.window&&<p><strong>Reporting window:</strong> {result.window.startDate} to {result.window.endDate}, Pacific time. Finalized web-search data only; the last three Pacific calendar days are excluded.</p>}
    <div className="search-metrics">{[['Clicks',number(total?.clicks)],['Impressions',number(total?.impressions)],['Click-through rate',total?`${(total.ctr*100).toFixed(1)}%`:'—'],['Average position',total?.position==null?'—':total.position.toFixed(1)]].map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    {!total&&<p className="search-note">{result?.parts?.total?.state==='no_data'?'Google returned no finalized rows for this window. This is not a measured zero.':'A verified total is unavailable for this attempt.'}</p>}
    <p className="search-note">These are search-result events, not unique people or successful applications. Average position covers observed impressions; it is not a guaranteed ranking. No traffic-growth claim is inferred.</p>
    <h3>Pages returned by Google</h3>
    {pages?.rows?.length?<><div className="search-table"><table><thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr></thead><tbody>{pages.rows.map(r=><tr key={r.page}><td><a href={r.page} target="_blank" rel="noreferrer">{new URL(r.page).pathname}</a></td><td>{number(r.clicks)}</td><td>{number(r.impressions)}</td><td>{r.position==null?'—':r.position.toFixed(1)}</td></tr>)}</tbody></table></div><p className="search-note">Up to 100 top returned pages; not a complete index or a total to sum.{pages.row_limit_reached?' The row limit was reached.':''}{pages.excluded_rows?` ${pages.excluded_rows} unsafe or private URLs were excluded.`:''}</p></>:<p className="search-note">{pages?.state==='error'?'Page data could not be read.':'No eligible page rows were returned.'}</p>}
    <h3>Stored indexing inspections</h3><p className="search-note">Four fixed public URLs, not site-wide index coverage or a live crawl request.</p>
    <div className="search-inspections">{inspections.map(r=><article key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{new URL(r.url).pathname}</a><strong>{r.state==='error'?'Inspection unavailable':r.coverage||r.verdict||'Unknown'}</strong><p>{r.last_crawl?'Google last crawled '+stamp(r.last_crawl):'No crawl time supplied.'}</p>{r.google_canonical&&<p>Google canonical: <a href={r.google_canonical}>{new URL(r.google_canonical).pathname}</a></p>}</article>)}</div>
    <h3>Primary sitemap</h3>{result?.parts?.sitemaps?.rows?.length?result.parts.sitemaps.rows.map(r=><p key={r.url}>{r.pending?'Google processing is pending.':'Read status recorded.'} Last downloaded: {r.last_downloaded?stamp(r.last_downloaded):'not supplied'} · Errors: {number(r.errors)} · Submitted pages: {number(r.submitted_pages)}</p>):<p className="search-note">No verified sitemap receipt in this attempt.</p>}
    {result?.error&&<p role="status">Read stopped: {result.error.replaceAll('_',' ')}. Check the connection before the next daily attempt.</p>}
    <details><summary>Read history</summary>{data.runs.map(r=><p key={r.day}>{r.day} · {labels[r.state]||r.state} · {r.requests}/10 requests · {r.trigger_kind}</p>)}</details>
   </>}
  </>}
 </section>;
}
