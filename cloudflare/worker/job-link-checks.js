import { Parser } from 'htmlparser2';
import { approvedSources } from './agent-operations.js';
import { currentJobs } from './current-jobs.js';
import { idFor } from './data.js';
import { UNIVERSITY_FEEDS, universityFeedIds } from './job-sources.js';

const iso=(now=Date.now())=>new Date(now).toISOString();
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const terminal=new Set(['checked','needs_review','uncertain','skipped']);
const REDIRECTS=new Set([301,302,303,307,308]);
const enabled=async env=>!!(await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first())?.enabled;
const validTime=(value,now,maxAge)=>Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+300000&&now-Date.parse(value)<=maxAge;

// Explicit provider hosts and exact advert identity; neither page content nor
// redirect destinations can introduce new network targets or a different job.
export function approvedJobLink(board,value,original=value) {
  try {
    const url=new URL(value),first=new URL(original);
    if ([url,first].some(u=>u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>2000)) return null;
    let valid=false;
    if(board.provider==='university-rss') {
      const feeds=universityFeedIds(board.id).map(id=>UNIVERSITY_FEEDS[id]);
      const ref=first.searchParams.get('ref');
      valid=!!ref&&/^[a-z0-9-]{1,80}$/i.test(ref)&&url.searchParams.get('ref')===ref&&
        feeds.some(f=>first.origin===f.origin&&first.pathname.toLowerCase()===f.path.toLowerCase()&&url.origin===f.origin&&
          [f.path.toLowerCase(),f.path.replace(/rss\/click\.aspx$/i,'Vacancy.aspx').toLowerCase()].includes(url.pathname.toLowerCase()));
    } else if(board.id==='stripe'&&board.provider==='greenhouse'&&board.board==='stripe') {
      const jobId=first.searchParams.get('gh_jid');
      valid=first.origin==='https://stripe.com'&&first.pathname==='/jobs/search'&&/^\d{1,20}$/.test(jobId||'')&&
        url.origin===first.origin&&url.searchParams.get('gh_jid')===jobId&&
        (['/jobs/search','/careers/search/redirect'].includes(url.pathname)||new RegExp('^/careers/listing/[a-z0-9-]{1,200}/'+jobId+'$').test(url.pathname));
    } else {
      const prefixes={greenhouse:['boards.greenhouse.io','job-boards.greenhouse.io','job-boards.eu.greenhouse.io'],ashby:['jobs.ashbyhq.com'],lever:['jobs.lever.co','jobs.eu.lever.co']};
      const hosts=prefixes[board.provider]||[],firstParts=first.pathname.split('/').filter(Boolean),parts=url.pathname.split('/').filter(Boolean);
      valid=hosts.includes(first.hostname)&&hosts.includes(url.hostname)&&firstParts[0]===board.board&&parts[0]===board.board&&
        (board.provider==='greenhouse'?firstParts.length===3&&firstParts[1]==='jobs'&&/^\d+$/.test(firstParts[2])&&parts.length===3&&parts[1]==='jobs'&&parts[2]===firstParts[2]:
          firstParts.length===2&&/^[a-z0-9-]{1,100}$/i.test(firstParts[1])&&parts.length===2&&parts[1]===firstParts[1]);
    }
    if(!valid)return null;
    // Only public advert-routing fields are needed by these reviewed endpoints.
    const routing=board.provider==='university-rss'?'ref':url.origin==='https://stripe.com'?'gh_jid':null;
    for(const key of [...url.searchParams.keys()])if(key!==routing)url.searchParams.delete(key);
    url.hash='';return url.href;
  } catch { return null; }
}

export function inspectJobPage(html,job) {
  const parts=[],headings=[];let suppressed=0,heading=null;
  const parser=new Parser({
    onopentag(name){if(['script','style','noscript','template'].includes(name))suppressed++;if(!suppressed&&['title','h1'].includes(name))heading={tag:name,parts:[]};if(!suppressed&&['p','div','li','br','h1','h2','section'].includes(name))parts.push('\n');},
    ontext(text){if(!suppressed){parts.push(text);if(heading)heading.parts.push(text);}},
    onclosetag(name){if(['script','style','noscript','template'].includes(name))suppressed=Math.max(0,suppressed-1);if(heading?.tag===name){headings.push(heading.parts.join(''));heading=null;}if(!suppressed&&['p','div','li','h1','h2','section'].includes(name))parts.push('\n');}
  },{decodeEntities:true});parser.end(html);
  let expected=job.title;
  if(job.provider==='university-rss'){
    const ref=new URL(job.url).searchParams.get('ref');
    if(ref&&expected.endsWith(' ('+ref+')'))expected=expected.slice(0,-ref.length-3);
  }
  const matches=!!normalize(expected)&&headings.some(h=>normalize(h).includes(normalize(expected)));
  const visible=parts.join('').replace(/[ \t]+/g,' ');
  const closed=/\b(?:this (?:job|role|position|vacancy) (?:is no longer available|has (?:now )?closed|has been (?:filled|removed))|applications (?:for this (?:role|position|vacancy) )?are (?:now )?closed|no longer accepting applications)\b/i.exec(visible);
  return { title_match:matches,observed_heading:headings.map(h=>h.trim()).find(h=>normalize(h).includes(normalize(expected)))?.slice(0,300)||headings[0]?.trim().slice(0,300)||null,
    closure_signal:closed?.[0].slice(0,140)||null };
}

export async function planJobLinkChecks(env,runId,now=Date.now()) {
  const previous=(await env.DB.prepare('SELECT id FROM job_link_checks WHERE run_id=? ORDER BY id').bind(runId).all()).results;
  if(previous.length)return previous.map(r=>r.id);
  const run=await env.DB.prepare('SELECT state,created_at FROM business_runs WHERE id=?').bind(runId).first();
  if(!run||!['queued','running'].includes(run.state)||!validTime(run.created_at,now,3600000)||!await enabled(env))return [];
  const boards=await approvedSources(env.DB),current=currentJobs(now,'j'),day=iso(now).slice(0,10);
  const rows=(await env.DB.prepare(`WITH candidates AS (
    SELECT j.id,j.board_id,j.company,j.title,j.apply_url,j.last_seen,
      (SELECT MAX(c.created_at) FROM job_link_checks c WHERE c.source_id=j.board_id) source_checked,
      ROW_NUMBER() OVER(PARTITION BY j.board_id ORDER BY (SELECT MAX(c.created_at) FROM job_link_checks c WHERE c.job_id=j.id),j.id) position
    FROM jobs j LEFT JOIN agent_source_controls s ON s.source_id=j.board_id
    WHERE ${current.sql} AND COALESCE(s.paused,0)=0 AND j.board_id IN (SELECT value FROM json_each(?))
      AND NOT EXISTS(SELECT 1 FROM job_link_checks c WHERE c.source_id=j.board_id AND c.day=?)
    ) SELECT * FROM candidates WHERE position=1 ORDER BY source_checked,board_id LIMIT 2`).bind(...current.values,JSON.stringify(boards.map(b=>b.id)),day).all()).results;
  if(!rows.length)return [];
  const writes=[];
  for(const row of rows)writes.push(env.DB.prepare(`INSERT INTO job_link_checks(id,run_id,source_id,job_id,day,company,title,url,source_seen_at,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING id`).bind(await idFor(runId+':'+row.board_id),runId,row.board_id,row.id,day,row.company,row.title,row.apply_url,row.last_seen,iso(now)));
  return (await env.DB.batch(writes)).flatMap(r=>r.results||[]).map(r=>r.id);
}

async function finish(env,id,state,reason,evidence,now,claim=null) {
  const saved=await env.DB.prepare("UPDATE job_link_checks SET state=?,reason=?,evidence=?,finished_at=? WHERE id=? AND ((state='queued' AND ? IS NULL) OR (state='checking' AND claim=?)) RETURNING id").bind(state,reason,JSON.stringify(evidence),iso(now),id,claim,claim).first();
  if(!saved)return {id,state:'uncertain',reason:'concurrent_or_prior_attempt'};
  return {id,state,reason,requests:evidence.chain?.length||0};
}

async function currentPermission(env,check,now,board) {
  if(!await enabled(env))return false;
  if(!(await approvedSources(env.DB)).some(b=>b.id===board.id&&b.provider===board.provider&&b.board===board.board))return false;
  const current=currentJobs(now,'j');
  return !!await env.DB.prepare(`SELECT j.id FROM jobs j LEFT JOIN agent_source_controls s ON s.source_id=j.board_id
    WHERE j.id=? AND j.board_id=? AND j.apply_url=? AND j.title=? AND COALESCE(s.paused,0)=0 AND ${current.sql}`)
    .bind(check.job_id,check.source_id,check.url,check.title,...current.values).first();
}

async function pageText(response,max=500000) {
  if(!response.body)throw Error('empty');
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,result='';
  try {while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>max){await reader.cancel();throw Error('oversized');}result+=decoder.decode(item.value,{stream:true});}return result+decoder.decode();}
  finally {reader.releaseLock();}
}

export async function checkJobLink(env,id,fetcher=fetch,clock=Date.now) {
  const now=clock(),check=await env.DB.prepare('SELECT * FROM job_link_checks WHERE id=?').bind(id).first();
  if(!check)throw Error('Missing job-link check');
  if(terminal.has(check.state))return {id,state:check.state,replay:true};
  // A previous attempt could have fetched already. Never repeat it from a replay.
  if(check.state==='checking')return {id,state:'uncertain',reason:'prior_attempt_unresolved'};
  if(!validTime(check.created_at,now,3600000)||check.day!==iso(now).slice(0,10))return finish(env,id,'skipped','check_expired',{},now);
  const board=(await approvedSources(env.DB)).find(b=>b.id===check.source_id);
  if(!board||!await currentPermission(env,check,now,board))return finish(env,id,'skipped','no_longer_current_or_enabled',{},now);
  let url=approvedJobLink(board,check.url);
  if(!url)return finish(env,id,'needs_review','unapproved_destination',{},now);
  const day=iso(now).slice(0,10),claim=crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO agent_daily_budget(day) VALUES(?) ON CONFLICT DO NOTHING').bind(day),
    env.DB.prepare('INSERT INTO job_link_daily_budget(day) VALUES(?) ON CONFLICT DO NOTHING').bind(day),
  ]);
  // Reserve all four possible HTTP requests atomically. Unused slots remain
  // charged conservatively, so failed and uncertain work cannot exceed a cap.
  const reserved=await env.DB.batch([
    env.DB.prepare(`UPDATE job_link_checks SET state='checking',started_at=?,claim=?,reserved_requests=4 WHERE id=? AND state='queued'
      AND (SELECT requests FROM agent_daily_budget WHERE day=?)<=496
      AND (SELECT reserved_requests FROM job_link_daily_budget WHERE day=?)<=156
      AND (SELECT enabled FROM business_controls WHERE singleton=1)=1 RETURNING id`).bind(iso(now),claim,id,day,day),
    env.DB.prepare("UPDATE agent_daily_budget SET requests=requests+4 WHERE day=? AND changes()=1 AND EXISTS(SELECT 1 FROM job_link_checks WHERE id=? AND claim=? AND state='checking')").bind(day,id,claim),
    env.DB.prepare("UPDATE job_link_daily_budget SET reserved_requests=reserved_requests+4 WHERE day=? AND changes()=1 AND EXISTS(SELECT 1 FROM job_link_checks WHERE id=? AND claim=? AND state='checking')").bind(day,id,claim),
  ]);
  if(!reserved[0].results?.length)return finish(env,id,'skipped','budget_or_pause',{},clock());
  const done=(state,reason,evidence)=>finish(env,id,state,reason,evidence,clock(),claim);
  const chain=[];
  for(let hop=0;hop<4;hop++){
    const currentTime=clock();
    if(iso(currentTime).slice(0,10)!==day||!await currentPermission(env,check,currentTime,board))return done('skipped','changed_during_check',{chain});
    try {
      const response=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'SponsorIntel-QualityCheck/1.0 (+https://sponsorintel.london/about)','Accept':'text/html'}});
      chain.push({url,status:response.status});
      if(REDIRECTS.has(response.status)){
        const location=response.headers.get('Location');if(response.body)await response.body.cancel();
        const next=location?approvedJobLink(board,new URL(location,url).href,check.url):null;
        if(!next)return done('needs_review','unapproved_redirect',{chain});
        if(chain.some(x=>x.url===next))return done('needs_review','redirect_loop',{chain});
        url=next;continue;
      }
      if(response.status!==200){if(response.body)await response.body.cancel();return done([404,410].includes(response.status)?'needs_review':'uncertain','http_'+response.status,{chain});}
      if(!/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type')||'')){if(response.body)await response.body.cancel();return done('uncertain','non_html_response',{chain});}
      const html=await pageText(response),observed=inspectJobPage(html,{...check,provider:board.provider});
      const evidence={chain,...observed,body_sha256:await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html)).then(b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''))};
      if(iso(clock()).slice(0,10)!==day||!await currentPermission(env,check,clock(),board))return done('skipped','changed_during_check',evidence);
      return done(observed.title_match&&!observed.closure_signal?'checked':'needs_review',observed.closure_signal?'closure_wording':observed.title_match?'title_observed':'title_not_confirmed',evidence);
    } catch { return done('uncertain','request_or_read_unavailable',{chain}); }
  }
  return done('needs_review','redirect_limit',{chain});
}

export async function jobLinkHealth(env,now=Date.now()) {
  const current=currentJobs(now,'j'),boards=await approvedSources(env.DB);
  const started=(await env.DB.prepare("SELECT value FROM metadata WHERE key='job_link_checks_started'").first())?.value;
  const rows=(await env.DB.prepare(`WITH eligible AS (
    SELECT j.board_id,MIN(j.first_seen) first_seen FROM jobs j LEFT JOIN agent_source_controls s ON s.source_id=j.board_id
    WHERE ${current.sql} AND COALESCE(s.paused,0)=0 AND j.board_id IN (SELECT value FROM json_each(?)) GROUP BY j.board_id
    ) SELECT c.*,e.board_id eligible_source,e.first_seen,
      EXISTS(SELECT 1 FROM jobs j WHERE j.id=c.job_id AND j.apply_url=c.url AND j.title=c.title AND ${current.sql}) advert_current
    FROM eligible e LEFT JOIN job_link_checks c ON c.id=(SELECT x.id FROM job_link_checks x WHERE x.source_id=e.board_id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
    ORDER BY e.board_id LIMIT 80`).bind(...current.values,JSON.stringify(boards.map(b=>b.id)),...current.values).all()).results;
  const items=rows.map(({claim,...row})=>{
    const recent=row.id&&validTime(row.created_at,now,36*3600000);
    const since=row.id?row.created_at:iso(Math.max(Date.parse(started)||0,Date.parse(row.first_seen)||0));
    const overdue=!validTime(since,now,36*3600000);
    const uncertain=row.advert_current&&(['needs_review','uncertain'].includes(row.state)||row.state==='checking'&&!validTime(row.started_at,now,120000));
    return {...row,source_id:row.eligible_source,company:row.company||boards.find(b=>b.id===row.eligible_source)?.company,
      evidence:row.evidence?JSON.parse(row.evidence):null,overdue,
      status:overdue?'overdue':uncertain?'needs_attention':recent&&row.advert_current&&row.state==='checked'?'matched':'awaiting'};
  });
  return {checked_at:iso(now),enabled:await enabled(env),started_at:started,policy:'one-current-advert-per-source-per-UTC-day-v1',
    eligible_sources:items.length,sampled_sources:items.filter(r=>r.id&&validTime(r.created_at,now,36*3600000)).length,
    matched:items.filter(r=>r.status==='matched').length,needs_attention:items.filter(r=>['needs_attention','overdue'].includes(r.status)).length,
    awaiting:items.filter(r=>r.status==='awaiting').length,overdue:items.filter(r=>r.overdue).length,
    limits:{sources_per_run:2,reserved_requests_per_check:4,reserved_requests_daily:160,shared_source_requests_daily:500},
    items,
    limitation:'A rotating sample checks initial page headings and response codes. It does not establish every vacancy is open, rendered application-form functionality or sponsorship. No public vacancy is changed by this check.'};
}

export function jobLinkFindings(health) {
  if(!health?.enabled||!health.needs_attention)return [];
  return [{id:'employer-application-links',category:'quality',severity:'normal',title:'Review employer application links',detail:`${health.needs_attention} employer samples need review, including ${health.overdue} overdue checks. A feed observation alone does not verify the candidate application page.`,next_action:'Inspect the exact check and employer page. Distinguish closure from access blocks, redirects and temporary failure; use the existing source/quality controls only after checking the evidence. Do not alter observation timestamps to hide a failed check.'}];
}
