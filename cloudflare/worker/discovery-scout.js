import {digest} from './auth.js';
import {validateDiscovery} from './discovery.js';
import {parseTeachingSearch,parseTeachingAdvert,teachingSearchURL,TEACHING_TERMS,TEACHING_ATTRIBUTION} from './teaching-discovery.js';

const iso=t=>new Date(t).toISOString();
const controlsSQL='(SELECT enabled=1 AND discovery=1 FROM business_controls WHERE singleton=1)';
const dailyCountSQL="(SELECT COUNT(*) FROM discovery_leads WHERE substr(recorded_at,1,10)=?)";
const reasons=new Set(['search_layout_changed','advert_layout_changed','advert_metadata_changed','advert_identity_changed','sponsorship_not_confirmed','advert_closed_or_deadline_unknown','advert_posting_date_unknown','contradictory_sponsorship_wording','controls_or_day_changed','request_unavailable','unexpected_response','response_too_large']);
const safeReason=e=>reasons.has(e?.reason)?e.reason:'request_unavailable';
const stop=reason=>{throw Object.assign(Error(reason),{reason});};
const enabled=async env=>!!(await env.DB.prepare('SELECT enabled=1 AND discovery=1 active FROM business_controls WHERE singleton=1').first())?.active;
const runRow=(env,day)=>env.DB.prepare('SELECT * FROM discovery_scout_runs WHERE day=?').bind(day).first();

async function readHTML(response){
 if(response.status!==200||!/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type')||'')||!response.body){await response.body?.cancel();stop('unexpected_response');}
 const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,body='';
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>500000){await reader.cancel();stop('response_too_large');}body+=decoder.decode(part.value,{stream:true});}return body+decoder.decode();}finally{reader.releaseLock();}
}

async function retain(env,run,url,content,evidence,now){
 // Automated attribution can only be written by this server-side producer.
 // Owner HTTP submissions continue to reject this method.
 validateDiscovery({...content,method:'agent_assisted'},now);
 const id=crypto.randomUUID(),revision=crypto.randomUUID(),request=crypto.randomUUID(),key=await digest(url),at=iso(now);
 const proof=JSON.stringify(evidence),actor='system:teaching-vacancies-scout';
 const result=await env.DB.batch([
  env.DB.prepare(`INSERT INTO discovery_leads(id,source_key,source_url,source_kind,recorded_at)
   SELECT ?,?,?,'teaching_vacancy',? WHERE ${controlsSQL}=1 AND ${dailyCountSQL}<5
   AND EXISTS(SELECT 1 FROM discovery_scout_runs WHERE day=? AND claim=? AND state='running' AND retained<capacity)
   AND NOT EXISTS(SELECT 1 FROM discovery_leads WHERE source_key=?) RETURNING id`).bind(id,key,url,at,run.day,run.day,run.claim,key),
  env.DB.prepare(`INSERT INTO discovery_revisions(id,lead_id,revision,content,actor,recorded_at,request_key,request_hash)
   SELECT ?,id,1,?,?,?,?,? FROM discovery_leads WHERE id=?`).bind(revision,JSON.stringify(content),actor,at,request,await digest(JSON.stringify({url,content,evidence})),id),
  env.DB.prepare("UPDATE discovery_scout_items SET state='retained',reason='original_advert_observed',lead_id=?,evidence=?,observed_at=? WHERE day=? AND source_url=? AND EXISTS(SELECT 1 FROM discovery_revisions WHERE id=?)").bind(id,proof,at,run.day,url,revision),
  env.DB.prepare("UPDATE discovery_scout_runs SET retained=retained+1 WHERE day=? AND claim=? AND EXISTS(SELECT 1 FROM discovery_revisions WHERE id=?)").bind(run.day,run.claim,revision),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT actor,'discovery-source-candidate',lead_id,recorded_at FROM discovery_revisions WHERE id=?").bind(revision),
 ]);
 return !!result[0].results?.length;
}

export async function scoutTeachingVacancies(env,runId,fetcher=fetch,clock=Date.now){
 const now=clock(),day=iso(now).slice(0,10),prior=await runRow(env,day);
 if(prior)return {...prior,replayed:true,state:prior.state==='running'?'uncertain':prior.state};
 if(!await enabled(env))return {state:'paused',reason:'owner_control'};
 const business=await env.DB.prepare('SELECT state,created_at FROM business_runs WHERE id=?').bind(runId).first();
 if(!business||!['queued','running'].includes(business.state)||!Number.isFinite(Date.parse(business.created_at))||Math.abs(now-Date.parse(business.created_at))>3600000)return {state:'held',reason:'business_run_not_current'};
 await env.DB.prepare('INSERT INTO agent_daily_budget(day) VALUES(?) ON CONFLICT DO NOTHING').bind(day).run();
 const claim=crypto.randomUUID();
 // The same five-new-lead ceiling includes agent-assisted records. At most two
 // slots go to this source, leaving room for ordinary posts and other sectors.
 const reservation=await env.DB.batch([
  env.DB.prepare(`INSERT INTO discovery_scout_runs(day,run_id,claim,state,reason,started_at,capacity,reserved_requests)
   SELECT ?,?,?,'running','searching',?,MIN(2,5-${dailyCountSQL}),2+MIN(2,5-${dailyCountSQL})
   WHERE ${controlsSQL}=1 AND ${dailyCountSQL}<5 AND (SELECT requests FROM agent_daily_budget WHERE day=?)<=500-(2+MIN(2,5-${dailyCountSQL}))
   ON CONFLICT(day) DO NOTHING RETURNING day`).bind(day,runId,claim,iso(now),day,day,day,day,day),
  env.DB.prepare("UPDATE agent_daily_budget SET requests=requests+(SELECT reserved_requests FROM discovery_scout_runs WHERE day=? AND claim=?) WHERE day=? AND changes()=1").bind(day,claim,day),
 ]);
 if(!reservation[0].results?.length){
  const saved=await runRow(env,day);if(saved)return {...saved,replayed:true,state:saved.state==='running'?'uncertain':saved.state};
  if(!await enabled(env))return {state:'paused',reason:'owner_control'};
  const count=await env.DB.prepare('SELECT COUNT(*) n FROM discovery_leads WHERE substr(recorded_at,1,10)=?').bind(day).first();
  await env.DB.prepare("INSERT INTO discovery_scout_runs(day,run_id,claim,state,reason,started_at,finished_at,capacity) VALUES(?,?,?,'held',?,?,?,0) ON CONFLICT(day) DO NOTHING").bind(day,runId,claim,count.n>=5?'daily_lead_allowance_used':'daily_request_allowance_used',iso(now),iso(now)).run();
  return runRow(env,day);
 }
 const run=await runRow(env,day);
 const permitted=async()=>iso(clock()).slice(0,10)===day&&await enabled(env);
 const request=async url=>{
  if(!await permitted())stop('controls_or_day_changed');
  const ticket=await env.DB.prepare(`UPDATE discovery_scout_runs SET requests=requests+1 WHERE day=? AND claim=? AND state='running' AND requests<reserved_requests AND ${controlsSQL}=1 RETURNING day`).bind(day,claim).first();
  if(!ticket)stop('controls_or_day_changed');
  const response=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html',Referer:'https://sponsorintel.london/','User-Agent':'SponsorIntel-Discovery/1.0 (+https://sponsorintel.london/about)'}});
  const html=await readHTML(response);if(!await permitted())stop('controls_or_day_changed');return html;
 };
 const done=async(state,reason)=>{await env.DB.prepare("UPDATE discovery_scout_runs SET state=?,reason=?,finished_at=? WHERE day=? AND claim=? AND state='running'").bind(state,reason,iso(clock()),day,claim).run();return runRow(env,day);};
 const candidates=[];
 try{
  for(let page=1;page<=2&&candidates.length<run.capacity;page++){
   const html=await request(teachingSearchURL(page)),parsed=parseTeachingSearch(html);
   await env.DB.prepare('UPDATE discovery_scout_runs SET search_pages=search_pages+1 WHERE day=? AND claim=?').bind(day,claim).run();
   for(const candidate of parsed.candidates){
    if(candidates.some(c=>c.url===candidate.url))continue;
    if(!await env.DB.prepare('SELECT id FROM discovery_leads WHERE source_key=?').bind(await digest(candidate.url)).first())candidates.push(candidate);
    if(candidates.length===run.capacity)break;
   }
   if(!parsed.next)break;
  }
  for(const candidate of candidates){
   if(!await permitted())stop('controls_or_day_changed');
   await env.DB.batch([
    env.DB.prepare("INSERT INTO discovery_scout_items(day,source_url,state,reason,observed_at) VALUES(?,?,'checking','awaiting_original_advert',?)").bind(day,candidate.url,iso(clock())),
    env.DB.prepare('UPDATE discovery_scout_runs SET inspected=inspected+1 WHERE day=? AND claim=?').bind(day,claim),
   ]);
   let html,content;
   try{html=await request(candidate.url);content=parseTeachingAdvert(html,candidate,clock());}
   catch(error){
    const reason=safeReason(error),held=['request_unavailable','unexpected_response','response_too_large','controls_or_day_changed'].includes(reason);
    await env.DB.prepare('UPDATE discovery_scout_items SET state=?,reason=? WHERE day=? AND source_url=?').bind(held?'held':'rejected',reason,day,candidate.url).run();
    if(held)return done('held',reason);continue;
   }
   if(!await permitted())stop('controls_or_day_changed');
   const evidence={source:'Department for Education Teaching Vacancies',source_url:candidate.url,observed_at:content.observed_at,body_sha256:await digest(html),title:content.title,employer:content.employer,sponsorship_quote:content.quote,deadline:content.deadline,posted_evidence:content.posted_evidence,terms:TEACHING_TERMS,attribution:TEACHING_ATTRIBUTION};
   let saved;
   try{saved=await retain(env,run,candidate.url,content,evidence,clock());}
   catch(error){
    // A lost commit acknowledgement must be resolved by the retained receipt,
    // never another fetch or a second first revision.
    const item=await env.DB.prepare('SELECT state FROM discovery_scout_items WHERE day=? AND source_url=?').bind(day,candidate.url).first();
    if(item?.state!=='retained')throw error;saved=true;
   }
   if(!saved){
    const duplicate=await env.DB.prepare('SELECT id FROM discovery_leads WHERE source_key=?').bind(await digest(candidate.url)).first();
    await env.DB.prepare('UPDATE discovery_scout_items SET state=?,reason=?,evidence=? WHERE day=? AND source_url=?').bind(duplicate?'duplicate':'held',duplicate?'already_retained':'daily_allowance_or_control_changed',JSON.stringify(evidence),day,candidate.url).run();
   }
  }
  return done('completed',candidates.length?'bounded_search_finished':'no_new_candidates_in_checked_pages');
 }catch(error){return done('held',safeReason(error));}
}

export async function discoveryScoutHealth(env,now=Date.now()){
 const runs=(await env.DB.prepare('SELECT * FROM discovery_scout_runs ORDER BY day DESC LIMIT 7').all()).results;
 const latest=runs[0]||null;
 const items=latest?(await env.DB.prepare('SELECT source_url,state,reason,lead_id,evidence,observed_at FROM discovery_scout_items WHERE day=? ORDER BY observed_at,source_url').bind(latest.day).all()).results.map(r=>({...r,evidence:JSON.parse(r.evidence)})):[];
 return {enabled:await enabled(env),checked_at:iso(now),latest:latest?{...latest,...(latest.state==='running'&&now-Date.parse(latest.started_at)>5*60000?{state:'uncertain'}:{})}:null,runs,items,
  limits:{new_source_leads_daily:2,total_new_leads_daily:5,requests_daily:4,search_pages_daily:2},attribution:TEACHING_ATTRIBUTION,terms:TEACHING_TERMS};
}
export function discoveryScoutFindings(health){
 const run=health?.latest;if(!health?.enabled||!run||!['uncertain','failed'].includes(run.state)&&!(run.state==='held'&&!['daily_lead_allowance_used','daily_request_allowance_used'].includes(run.reason)))return [];
 return [{id:'discovery-scout-review',category:'growth',severity:'normal',title:'Review the education discovery check',detail:`The ${run.day} source search ended ${run.state}: ${run.reason.replaceAll('_',' ')}. ${run.retained} private leads were retained.`,next_action:'Inspect the discovery scout receipt and original source. Do not retry consumed requests or interpret this as a completed market scan.'}];
}
