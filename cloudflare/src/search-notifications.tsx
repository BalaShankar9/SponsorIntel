import React, {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Bell,Check,Download,RefreshCw,Search,X} from 'lucide-react';
import {download,request,sponsorLabels,useCareer,type SavedSearch,type Job} from './career-data';

type Match = Pick<Job,'id'|'title'|'company'|'location'|'sponsorship'|'evidence'|'first_seen'|'last_seen'|'closes_at'> & {detected_at:string;read_at:string|null};
type Monitor = {id:string;search_id:string;filters:Record<string,string>;started_at:string;checked_at:string|null;delayed:boolean;unread:number;matches:Match[]};
type Inbox = {as_of:string;retention_days:number;monitors:Monitor[]};
const endpoint='/api/career/search-notifications';
const filtersFor=(s:SavedSearch)=>({q:s.q||'',location:s.location||'',sponsorship:s.sponsorship||'',level:s.level||'',salary:s.salary||'',sector:s.sector||'',licence:s.licence||''});
const time=(s:string)=>new Date(s).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const label=(s:SavedSearch)=>[s.q||'All roles',s.location,s.sponsorship==='mentioned'?'Sponsorship mentioned':sponsorLabels[s.sponsorship],s.level==='early_career'?'Early career':'',s.salary?'GBP pay':'',s.sector,s.licence==='matched'?'Licensed employers':''].filter(Boolean).join(' · ');
const href=(s:SavedSearch)=>'/jobs?'+new URLSearchParams({q:s.q,location:s.location,sponsorship:s.sponsorship,level:s.level,salary:s.salary||'',sector:s.sector||'',licence:s.licence||''});

export function SavedSearches() {
  const c=useCareer();
  return <SearchInbox key={c.user?.id||'guest'}/>;
}
function SearchInbox() {
  const c=useCareer();
  const [inbox,setInbox]=useState<Inbox|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState<Record<string,boolean>>({});
  const sequence=useRef(0);
  async function load() {
    const seq=++sequence.current;
    setInbox(null);setError('');
    if (!c.user) return;
    try {
      const data=await request<Inbox>(endpoint);
      if (seq===sequence.current) setInbox(data);
    } catch(e) {if(seq===sequence.current)setError((e as Error).message);}
  }
  useEffect(()=>{
    if (!c.ready || !c.user) return;
    void load();
    const refresh=()=>{if(!document.hidden)void load();};
    const timer=window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{++sequence.current;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[c.ready,c.user?.id,c.status,JSON.stringify(c.data.searches)]);
  useEffect(()=>{
    const dates=inbox?.monitors.flatMap(m=>m.matches.flatMap(j=>[Date.parse(j.closes_at||''),Date.parse(j.last_seen)+72*3600000])).filter(Number.isFinite)||[];
    if (!dates.length) return;
    const timer=window.setTimeout(()=>void load(),Math.min(2147483647,Math.max(1,Math.min(...dates)-Date.now()+20)));
    return ()=>clearTimeout(timer);
  },[inbox]);
  async function change(s:SavedSearch,m:Monitor|undefined,remove=false) {
    setBusy(true);setError('');
    try {
      if (c.user && (!remove||m)) await request(endpoint,'PUT',{search_id:s.id,enabled:!m&&!remove,monitor_id:m?.id,filters:filtersFor(s)});
      if (remove) c.setData(d=>({...d,searches:d.searches.filter(x=>x.id!==s.id)}));
      await load();
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function mark(m:Monitor) {
    setBusy(true);setError('');
    try {await request(endpoint,'POST',{monitor_id:m.id,as_of:inbox?.as_of,job_ids:m.matches.map(j=>j.id)});await load();}
    catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  if (!c.data.searches.length) return <section className="search-inbox" aria-labelledby="saved-search-heading">
    <p className="eyebrow"><Bell size={14}/> YOUR NEXT OPPORTUNITY</p>
    <h2 id="saved-search-heading">New matches, in one place.</h2>
    <p>Find a role, choose your filters and save the search. Then follow it here to see newly added matches while you focus on your applications.</p>
    <a className="secondary-button" href="/jobs"><Search size={16}/> Find and save a search <ArrowUpRight size={16}/></a>
    <p className="fine-print">Following needs a verified account. Matches appear here; no alert emails are sent.</p>
  </section>;
  const canChange=c.ready&&!busy&&(!c.user||!!inbox);
  return <section className="search-inbox" aria-labelledby="saved-search-heading">
    <div className="search-inbox-heading"><div><p className="eyebrow"><Bell size={14}/> YOUR NEXT OPPORTUNITY</p><h2 id="saved-search-heading">Your saved searches</h2></div>
      {c.user&&<button className="text-button" onClick={()=>void load()} disabled={busy} aria-label="Refresh new matches"><RefreshCw size={16}/> Refresh</button>}
    </div>
    <p>Follow a search to see newly added jobs here, even while you’re away. We show up to 100 recent matching vacancies from the last 14 days. Always check the employer’s advert.</p>
    {!c.user&&<p className="search-inbox-notice"><a href="/account">Sign in and verify your email</a> to follow searches across devices. Your saved shortcuts still work here.</p>}
    {c.user&&!c.user.emailVerified&&<p className="search-inbox-notice"><a href="/account">Verify your account email</a> before following a search.</p>}
    {error&&<p className="error-banner" role="alert">{error} Your saved searches are still available.</p>}
    {c.user&&!inbox&&!error&&<p role="status">Checking your followed searches…</p>}
    {c.data.searches.map(s=>{
      const m=inbox?.monitors.find(x=>x.search_id===s.id&&JSON.stringify(x.filters)===JSON.stringify(filtersFor(s)));
      const visible=m?.matches.slice(0,expanded[s.id]?100:3)||[];
      return <article className="followed-search" key={s.id}>
        <div className="followed-search-heading"><a className="saved-search-link" href={href(s)}><Search size={16}/><span>{label(s)}</span><ArrowUpRight size={16}/></a>
          <div className="search-inbox-actions">
            {c.user&&<button className={m?'secondary-button':'primary-button'} disabled={!canChange||(!m&&(!c.user.emailVerified||!!c.error))} onClick={()=>void change(s,m)} aria-label={(m?'Stop following ':'Follow ')+label(s)}><Bell size={15}/>{m?'Stop following':'Follow new matches'}</button>}
            <button className="icon-button" aria-label={'Remove saved search: '+label(s)} disabled={!canChange} onClick={()=>void change(s,m,true)}><X size={17}/></button>
          </div>
        </div>
        {m&&<>
          <p className="search-check"><span>{!m.checked_at?'Waiting for first check':m.unread?`${m.unread} unseen ${m.unread===1?'match':'matches'}`:m.delayed?'Check delayed':'You’re up to date'}</span> · Following since {time(m.started_at)} · {m.checked_at?'Checked '+time(m.checked_at):'First check pending'}{m.delayed&&m.checked_at?' — checks are delayed':''}</p>
          {!m.matches.length&&<p className="search-inbox-empty">{m.checked_at?'No newly added jobs match this search yet.':'Your first background check is pending.'} <a href={href(s)}>Browse current results <ArrowUpRight size={13}/></a></p>}
          {visible.length>0&&<ul className="search-match-list">{visible.map(j=><li key={j.id}>
            <div><a href={'/jobs/'+j.id}>{!j.read_at&&<span className="match-unread-dot" aria-label="Unseen"/>}{j.title}<ArrowUpRight size={14}/></a><p>{j.company} · {j.location}</p><span className={'match-sponsorship '+j.sponsorship}>{sponsorLabels[j.sponsorship]}</span>{j.evidence&&<blockquote>{j.evidence}</blockquote>}<small>Added to Sponsor Intel {time(j.first_seen)}{j.closes_at?' · Closes '+time(j.closes_at):''}</small></div>
          </li>)}</ul>}
          {!!m.matches.length&&<div className="search-inbox-actions search-match-footer">
            {m.matches.length>3&&<button className="text-button" aria-expanded={!!expanded[s.id]} onClick={()=>setExpanded(v=>({...v,[s.id]:!v[s.id]}))}>{expanded[s.id]?'Show fewer':`Show all ${m.matches.length} recent matches`}</button>}
            {m.unread>0&&<button className="text-button" disabled={busy} onClick={()=>void mark(m)}><Check size={15}/> Mark this list as seen</button>}
          </div>}
        </>}
      </article>;
    })}
    <div className="search-inbox-footer"><p>No emails or browser notifications are sent. Sponsorship wording and employer licence evidence are separate; a licence does not confirm sponsorship for a role. Stopping a search removes its match history.</p>
      {!!inbox?.monitors.length&&<button className="text-button" onClick={()=>download(JSON.stringify({...inbox,searches:c.data.searches},null,2),'sponsor-intel-search-matches.json','application/json')}><Download size={15}/> Download matches</button>}
    </div>
  </section>;
}
