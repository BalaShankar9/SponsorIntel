import {digest} from './auth.js';
import {approvedSources} from './agent-operations.js';
import {employerLicences} from './employer-licences.js';
import {currentJobs} from './current-jobs.js';
import {approvedJobLink} from './job-link-checks.js';
import {sponsorshipEvidence} from './jobs.js';

const DAY=86400000,iso=time=>new Date(time).toISOString();
const recent=(value,now,age=DAY)=>Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+300000&&now-Date.parse(value)<age;
const stop=()=>{throw Object.assign(Error('Vacancy evidence changed, expired or is not ready for promotion. Refresh and review this version before scheduling.'),{status:409});};
const jobFields=['board_id','company','title','location','description','apply_url','sponsorship','evidence','closes_at','application_deadline','last_seen'];
export const OPPORTUNITY_LIMITATION='This is a dated advert observation, not a visa or job offer. A sponsor licence does not guarantee sponsorship for this vacancy or eligibility for any applicant. Read the original advert and confirm the details with the employer.';

// The public catalogue can contain general licensed-company jobs. Promotion is
// narrower: positive/conditional employer wording, current reviewed identity,
// a successful recent page sample, and enough time to recheck before a post.
export async function readOpportunitySource(env,jobId,now=Date.now()) {
 if(!/^[a-f0-9]{24}$/.test(jobId||''))stop();
 const controls=await env.DB.prepare('SELECT b.enabled business,m.enabled marketing FROM business_controls b CROSS JOIN marketing_agent_controls m WHERE b.singleton=1 AND m.singleton=1').first();
 if(!controls?.business||!controls.marketing)stop();
 const current=currentJobs(now,'j');
 const row=await env.DB.prepare(`SELECT j.*,s.last_success source_success,s.error source_error,COALESCE(c.paused,0) paused
   FROM jobs j JOIN job_sources s ON s.id=j.board_id LEFT JOIN agent_source_controls c ON c.source_id=j.board_id
   WHERE j.id=? AND ${current.sql}`).bind(jobId,...current.values).first();
 if(!row||row.paused||row.source_error||!recent(row.last_seen,now)||!recent(row.source_success,now)||row.description.length>30000||
   row.title.length>160||row.company.length>160||row.location.length>180||!['offered','conditional'].includes(row.sponsorship))stop();
 const boards=await approvedSources(env.DB),board=boards.find(b=>b.id===row.board_id);
 if(!board||!approvedJobLink(board,row.apply_url))stop();
 const signal=sponsorshipEvidence(row.description);
 // Keep the complete extracted sentence. Never truncate away conditions for a
 // shorter social card; overlong/inconsistent excerpts need separate review.
 if(signal.status!==row.sponsorship||signal.quote!==row.evidence||!row.description.includes(row.evidence)||row.evidence.length>=500)stop();
 const registerValue=(await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first())?.value;
 const licences=await employerLicences(env.DB,boards,now),licence=licences.matches.get(row.board_id);
 if(!licence||!recent(licence.checked_at,now,2*DAY)||(await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first())?.value!==registerValue)stop();
 const link=await env.DB.prepare('SELECT * FROM job_link_checks WHERE job_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(jobId).first();
 let evidence;try{evidence=JSON.parse(link?.evidence||'null');}catch{stop();}
 if(!link||link.state!=='checked'||!recent(link.finished_at,now)||link.url!==row.apply_url||link.title!==row.title||link.source_id!==row.board_id||
   evidence?.title_match!==true||evidence.closure_signal||!evidence.chain?.length||evidence.chain.at(-1).status!==200||
   !evidence.chain.every(h=>approvedJobLink(board,h.url,row.apply_url)))stop();
 const expiry=Math.min(Date.parse(row.last_seen)+DAY,Date.parse(row.source_success)+DAY,Date.parse(link.finished_at)+DAY,Date.parse(licence.checked_at)+2*DAY,row.closes_at?Date.parse(row.closes_at):Infinity);
 if(expiry<=now+3600000)stop();
 const facts=[
  `${row.title} — ${row.company}. Location: ${row.location}.`,
  `The employer advert says: “${row.evidence}”`,
  `The employer has a reviewed link to ${licence.name} in the current Skilled Worker sponsor register. This is employer-level evidence, separate from the vacancy wording.`,
  OPPORTUNITY_LIMITATION,
 ];
 const content={job_id:row.id,board_id:row.board_id,company:row.company,title:row.title,location:row.location,description:row.description,apply_url:row.apply_url,
   sponsorship:row.sponsorship,evidence:row.evidence,closes_at:row.closes_at,application_deadline:row.application_deadline,
   licence:{id:licence.id,name:licence.name,city:licence.city,routes:licence.routes,ratings:licence.ratings},facts};
 const fingerprint=await digest(JSON.stringify(content));
 return {kind:'opportunity',id:'job-'+row.id,topic_key:'opportunity:'+row.id,title:(row.company+': '+row.title).slice(0,160),path:'/jobs/'+row.id,
   campaign:'fb-opportunity',url:'https://sponsorintel.london/jobs/'+row.id,facts,required_segments:[facts[0],facts[1],facts[3]],
   checked_at:iso(now),expires_at:iso(expiry),content_hash:fingerprint,
   opportunity:{job_id:row.id,fingerprint,link_check_id:link.id,checked_at:iso(now),expires_at:iso(expiry)},
   advert:{...content,observed_at:row.last_seen,source_success:row.source_success,licence_checked_at:licence.checked_at,link_checked_at:link.finished_at},
   // Only server callers receive the DB guard fields. They are excluded from
   // model context and public/owner snapshots by captureOpportunitySources.
   guard:{row,link_id:link.id,register_value:registerValue,board},
   limitation:'A model review can be wrong. Recheck the original vacancy before scheduling and immediately before delivery; no direct publisher or cancellation is provided by this adapter.'};
}

export function publicOpportunitySource({guard,...source}){return source;}
export async function captureOpportunitySources(env,now=Date.now()) {
 const current=currentJobs(now,'j');
 const rows=(await env.DB.prepare(`SELECT j.id FROM jobs j WHERE ${current.sql} AND j.sponsorship IN ('offered','conditional')
   AND NOT EXISTS(SELECT 1 FROM marketing_briefs b WHERE b.topic_key='opportunity:'||j.id)
   AND EXISTS(SELECT 1 FROM job_link_checks c WHERE c.job_id=j.id AND c.state='checked' AND c.finished_at>?)
   ORDER BY j.last_seen DESC,j.id LIMIT 12`).bind(...current.values,iso(now-DAY)).all()).results;
 const sources=[],held=[];
 for(const row of rows){try{sources.push(publicOpportunitySource(await readOpportunitySource(env,row.id,now)));}catch{held.push(row.id);}if(sources.length===3)break;}
 return {sources,held,policy:'current-vacancy-evidence-v1',scope:'At most three candidates from up to twelve recent matched adverts. Missing candidates do not mean no sponsorship jobs exist.'};
}

export async function requireOpportunity(env,proof,now=Date.now()) {
 if(!proof||Object.keys(proof).some(k=>!['job_id','fingerprint','link_check_id','checked_at','expires_at'].includes(k))||
   !recent(proof.checked_at,now)||!Number.isFinite(Date.parse(proof.expires_at))||Date.parse(proof.expires_at)<=now)stop();
 const source=await readOpportunitySource(env,proof.job_id,now);
 if(source.content_hash!==proof.fingerprint||source.opportunity.link_check_id!==proof.link_check_id||Date.parse(proof.expires_at)>Date.parse(source.expires_at))stop();
 return source;
}

// Include this predicate in the ledger's write transaction. A feed refresh,
// approval change, pause or new link result between validation and commit wins.
export function opportunityWriteGuard(source,now) {
 if(!source)return {sql:'1',values:[]};
 const {row,link_id,register_value,board}=source.guard,current=currentJobs(now,'j');
 const values=[row.id,...jobFields.map(k=>row[k]??null),...current.values,row.source_success,link_id,link_id,register_value];
 let approval='1';
 if(board.state==='approved'){
  approval="EXISTS(SELECT 1 FROM employer_boards b WHERE b.id=? AND b.state='approved' AND b.board=? AND b.provider=? AND b.sponsor_id=? AND b.reviewed_at IS ?)";
  values.push(board.id,board.board,board.provider,board.sponsor_id,board.reviewed_at??null);
 }
 return {sql:`EXISTS(SELECT 1 FROM jobs j JOIN job_sources s ON s.id=j.board_id LEFT JOIN agent_source_controls c ON c.source_id=j.board_id
   WHERE j.id=? AND ${jobFields.map(k=>'j.'+k+' IS ?').join(' AND ')} AND ${current.sql} AND COALESCE(c.paused,0)=0
   AND s.error IS NULL AND s.last_success IS ?
   AND EXISTS(SELECT 1 FROM job_link_checks x WHERE x.id=? AND x.state='checked')
   AND ?=(SELECT x.id FROM job_link_checks x WHERE x.job_id=j.id ORDER BY x.created_at DESC,x.id DESC LIMIT 1)
   AND (SELECT value FROM metadata WHERE key='register') IS ? AND ${approval}
   AND (SELECT enabled FROM business_controls WHERE singleton=1)=1 AND (SELECT enabled FROM marketing_agent_controls WHERE singleton=1)=1)`,values};
}

export async function opportunityBriefHealth(env,now=Date.now()) {
 const enabled=await env.DB.prepare('SELECT b.enabled business,m.enabled marketing FROM business_controls b CROSS JOIN marketing_agent_controls m WHERE b.singleton=1 AND m.singleton=1').first();
 if(!enabled?.business||!enabled.marketing)return {enabled:false,checked_at:iso(now),items:[],attention:0,external_attention:0,limited:false};
 const rows=(await env.DB.prepare(`SELECT b.id,b.state,b.revision,b.version,b.title,p.job_id,p.fingerprint,p.link_check_id,p.checked_at,p.expires_at
   FROM marketing_briefs b LEFT JOIN marketing_opportunity_versions p ON p.brief_id=b.id AND p.version=b.version
   WHERE b.topic_key LIKE 'opportunity:%' AND b.state IN ('proposed','reviewed','scheduled','uncertain')
   ORDER BY CASE WHEN b.state IN ('scheduled','uncertain') THEN 0 ELSE 1 END,b.updated_at LIMIT 41`).all()).results;
 const items=[];
 for(const row of rows.slice(0,40)){
  const {job_id,fingerprint,link_check_id,checked_at,expires_at}=row;
  let current=false;try{await requireOpportunity(env,{job_id,fingerprint,link_check_id,checked_at,expires_at},now);current=true;}catch(error){if(error.status!==409)throw error;}
  items.push({id:row.id,state:row.state,revision:row.revision,version:row.version,title:row.title,job_id,current,
   action:current?'No evidence change detected':(['scheduled','uncertain'].includes(row.state)?'Inspect the original provider schedule now; hold or cancel there if needed. This check cannot cancel it.':'Hold this draft and review fresh evidence before approval.')});
 }
 return {enabled:true,checked_at:iso(now),items,attention:items.filter(x=>!x.current).length,
  external_attention:items.filter(x=>!x.current&&['scheduled','uncertain'].includes(x.state)).length,limited:rows.length>40};
}

export function opportunityFindings(health){
 if(!health?.enabled||!health.attention&&!health.limited)return [];
 return [{id:'opportunity-promotion-evidence',category:'distribution',severity:health.external_attention?'high':'normal',title:'Review changed vacancy promotions',
  detail:`${health.attention} opportunity briefs no longer match their current evidence; ${health.external_attention} have an external schedule or uncertain delivery.${health.limited?' The inspection limit was reached; additional briefs require review.':''}`,
  next_action:'Inspect original adverts and exact provider jobs. A local hold never cancels an external post. Confirm cancellation or correct a published error at the provider, preserve its receipt, and review a new version before rescheduling.'}];
}
