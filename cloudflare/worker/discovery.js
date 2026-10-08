import {bodyJSON,digest,limit,reply,sameOrigin} from './auth.js';
import {currentJobs} from './current-jobs.js';
import {BOARDS} from './job-sources.js';
import {DISCOVERY_KINDS,DISCOVERY_STATES,DISCOVERY_LIMITATION} from '../shared/discovery.js';
const iso=t=>new Date(t).toISOString();
const fail=(message,status=400,extra={})=>{throw Object.assign(Error(message),{status,...extra});};
const fields=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('Unexpected discovery fields.');};
const text=(s,min,max,label)=>{if(typeof s!=='string'||s.trim().length<min||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))fail(`${label} is missing or too long.`);return s.trim();};
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const normalize=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const snapshotFields=['id','board_id','company','title','location','description','apply_url','sponsorship','evidence','closes_at','source_first_published_at'];
const latest=`SELECT l.id,l.source_key,l.source_url,l.source_kind,l.recorded_at first_recorded_at,r.* FROM discovery_leads l JOIN discovery_revisions r ON r.lead_id=l.id WHERE r.revision=(SELECT MAX(x.revision) FROM discovery_revisions x WHERE x.lead_id=l.id)`;
const sourceAllowed=`(j.board_id IN (${BOARDS.map(()=>'?').join(',')}) OR EXISTS(SELECT 1 FROM employer_boards b JOIN sponsors s ON s.id=b.sponsor_id WHERE b.id=j.board_id AND b.state='approved' AND s.skilled=1 AND s.snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot'))) AND NOT EXISTS(SELECT 1 FROM agent_source_controls a WHERE a.source_id=j.board_id AND a.paused=1)`;
const sourceValues=()=>BOARDS.map(b=>b.id);

export function discoveryURL(value,kind=null){
 text(value,1,1500,'Public link');let u;try{u=new URL(value);}catch{fail('Enter a public HTTPS link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)||/(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)||/\\|[\r\n]/.test(value))fail('Use a public HTTPS link without credentials or a custom port.');
 for(const key of [...u.searchParams.keys()]){
  if(/^(token|access_token|api_key|key|password|secret|email|signature|sig)$/i.test(key))fail('Do not save private or credential-bearing links.');
  if(/^(utm_.+|trk|trackingId|refId|originalSubdomain|original_referer)$/i.test(key))u.searchParams.delete(key);
 }
 u.hash='';
 if(kind==='linkedin_job'||kind==='linkedin_post'){
  if(!/(^|\.)linkedin\.com$/.test(u.hostname))fail('This source type requires its original LinkedIn link.');
  const match=kind==='linkedin_job'?u.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d{6,25})\/?$/):u.pathname.match(/^\/posts\/[^/]*activity-(\d{10,25})(?:-[^/]*)?\/?$/)||u.pathname.match(/^\/feed\/update\/urn:li:activity:(\d{10,25})\/?$/);
  if(!match)fail('Use an individual LinkedIn job or post, not a search or profile page.');
  return kind==='linkedin_job'?`https://www.linkedin.com/jobs/view/${match[1]}/`:`https://www.linkedin.com/feed/update/urn:li:activity:${match[1]}/`;
 }
 u.searchParams.sort();return u.href;
}
function stamp(value,label,{optional=false,now=Date.now(),future=false}={}){
 if(optional&&(value===''||value===null))return null;
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||iso(Date.parse(value))!==value)fail(`Use an exact date and time for ${label}, or leave an unknown date blank.`);
 if(!future&&Date.parse(value)>now+300000)fail(`${label} cannot be in the future.`);
 return value;
}
export function validateDiscovery(input,now=Date.now()){
 fields(input,['title','employer','location','observed_at','posted_at','posted_evidence','deadline','deadline_evidence','original_url','identity_url','identity_note','quote','state','reason','follow_up_at','job_id','duplicate_of','method']);
 if(!Object.hasOwn(DISCOVERY_STATES,input.state)||!['agent_assisted','owner_recorded'].includes(input.method))fail('Choose a review decision and recording method.');
 const out={title:text(input.title,3,180,'Lead title'),employer:text(input.employer,0,160,'Employer'),location:text(input.location,0,160,'Location'),
  observed_at:stamp(input.observed_at,'Source observation',{now}),posted_at:stamp(input.posted_at,'Original posting',{optional:true,now}),posted_evidence:text(input.posted_evidence,0,500,'Posting-date evidence'),
  deadline:stamp(input.deadline,'Deadline',{optional:true,now,future:true}),deadline_evidence:text(input.deadline_evidence,0,500,'Deadline evidence'),
  original_url:input.original_url?discoveryURL(input.original_url):'',identity_url:input.identity_url?discoveryURL(input.identity_url):'',identity_note:text(input.identity_note,0,1500,'Employer identity evidence'),
  quote:text(input.quote,0,1000,'Sponsorship quotation'),state:input.state,reason:text(input.reason,30,2000,'Decision reason'),follow_up_at:stamp(input.follow_up_at,'Follow-up',{optional:true,now,future:true}),
  job_id:input.job_id||null,duplicate_of:input.duplicate_of||null,method:input.method};
 if(out.posted_at&&(!out.posted_evidence||out.posted_at>out.observed_at))fail('A posting date needs source evidence and cannot follow the observation.');
 if(out.deadline&&!out.deadline_evidence)fail('A deadline needs its original source wording.');
 if(['pending','held'].includes(out.state)){
  if(!out.follow_up_at||Date.parse(out.follow_up_at)<=now||Date.parse(out.follow_up_at)>now+30*86400000)fail('Set a follow-up within the next 30 days for an unresolved lead.');
 }else if(out.follow_up_at)fail('Only unresolved leads need a follow-up.');
 if(out.state==='linked'){
  if(!/^[a-f0-9]{24}$/.test(out.job_id||'')||!out.original_url||!out.identity_url||out.identity_note.length<30||now-Date.parse(out.observed_at)>72*3600000||out.deadline&&Date.parse(out.deadline)<=now)fail('Link a current published job after a recent original-source and employer-identity review.');
 }else if(out.job_id)fail('Only a linked decision can name a published job.');
 if(out.state==='duplicate'){if(!uuid(out.duplicate_of))fail('Select the earlier lead this duplicates.');}else if(out.duplicate_of)fail('Only a duplicate decision can name another lead.');
 return out;
}
const parse=row=>{
 if(!row)return null;
 const proof=row.job_proof?JSON.parse(row.job_proof):null;
 if(proof)delete proof.description;
 return {id:row.lead_id,source_url:row.source_url,source_kind:row.source_kind,first_recorded_at:row.first_recorded_at,revision:row.revision,recorded_at:row.recorded_at,content:JSON.parse(row.content),job_proof:proof};
};
async function replay(env,key,hash){
 const r=await env.DB.prepare(`SELECT * FROM (${latest}) WHERE request_key=? UNION ALL SELECT l.id,l.source_key,l.source_url,l.source_kind,l.recorded_at first_recorded_at,r.* FROM discovery_leads l JOIN discovery_revisions r ON l.id=r.lead_id WHERE r.request_key=? AND r.revision<>(SELECT MAX(x.revision) FROM discovery_revisions x WHERE x.lead_id=l.id)`).bind(key,key).first();
 if(!r)return null;if(r.request_hash!==hash)fail('This request key already belongs to a different review.',409);return {lead:parse(r),replayed:true};
}
async function targetJob(env,id,now){
 const current=currentJobs(now,'j');
 return env.DB.prepare(`SELECT j.* FROM jobs j WHERE j.id=? AND ${current.sql} AND ${sourceAllowed}`).bind(id,...current.values,...sourceValues()).first();
}
export async function saveDiscovery(env,input,actor,now=Date.now()){
 fields(input,['id','revision','request_key','source_url','source_kind','content']);
 if(!Number.isSafeInteger(input.revision)||input.revision<0||!uuid(input.request_key)||input.id&&!uuid(input.id)||!Object.hasOwn(DISCOVERY_KINDS,input.source_kind))fail('Refresh the lead before recording a decision.');
 if(!!input.id!==!!input.revision)fail('New leads start at revision zero.');
 text(actor,1,160,'Reviewer');
 const hash=await digest(canonical({actor,input})),prior=await replay(env,input.request_key,hash);if(prior)return prior;
 const content=validateDiscovery(input.content,now),sourceUrl=discoveryURL(input.source_url,input.source_kind),key=await digest(sourceUrl),at=iso(now);
 const existing=await env.DB.prepare('SELECT * FROM discovery_leads WHERE source_key=?').bind(key).first();
 if(existing&&existing.id!==input.id)fail('This source is already retained. Open its existing lead instead.',409,{existing_id:existing.id});
 if(input.id&&(!existing||existing.source_kind!==input.source_kind))fail('The original lead identity cannot change. Create a separate source lead.',409);
 const id=input.id||crypto.randomUUID(),revisionId=crypto.randomUUID(),job=content.state==='linked'?await targetJob(env,content.job_id,now):null;
 let proof=null;
 if(content.state==='linked'){
  if(!job||discoveryURL(job.apply_url)!==content.original_url||job.company!==content.employer||content.quote&&!normalize(job.description).includes(normalize(content.quote)))fail('The original link, employer or quotation does not match a current approved job. Refresh the advert before linking.',409);
  proof=Object.fromEntries(snapshotFields.map(k=>[k,job[k]??null]));
  proof.fingerprint=await digest(canonical(proof));proof.checked_at=at;
 }
 const current=currentJobs(now,'j');
 const jobGuard=job?` AND EXISTS(SELECT 1 FROM jobs j WHERE ${snapshotFields.map(k=>`j.${k} IS ?`).join(' AND ')} AND ${current.sql} AND ${sourceAllowed})`:'';
 const duplicateGuard=content.duplicate_of?` AND EXISTS(SELECT 1 FROM (${latest}) d WHERE d.lead_id=? AND d.first_recorded_at<? AND json_extract(d.content,'$.state')<>'duplicate')`:'';
 const statements=[
  ...(!input.id?[env.DB.prepare('INSERT INTO discovery_leads(id,source_key,source_url,source_kind,recorded_at) VALUES(?,?,?,?,?) ON CONFLICT(source_key) DO NOTHING').bind(id,key,sourceUrl,input.source_kind,at)]:[]),
  env.DB.prepare(`INSERT INTO discovery_revisions(id,lead_id,revision,content,job_proof,actor,recorded_at,request_key,request_hash)
   SELECT ?,l.id,?,?,?,?,?,?,? FROM discovery_leads l WHERE l.id=? AND l.source_key=?
   AND COALESCE((SELECT MAX(r.revision) FROM discovery_revisions r WHERE r.lead_id=l.id),0)=?${jobGuard}${duplicateGuard} RETURNING id`)
   .bind(revisionId,input.revision+1,JSON.stringify(content),proof?JSON.stringify(proof):null,actor,at,input.request_key,hash,id,key,input.revision,
    ...(job?[...snapshotFields.map(k=>job[k]??null),...current.values,...sourceValues()]:[]),...(content.duplicate_of?[content.duplicate_of,existing?.recorded_at||at]:[])),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT actor,'discovery-review',lead_id,recorded_at FROM discovery_revisions WHERE id=?").bind(revisionId),
  // An unsuccessful first decision must roll back its empty identity, not leave a stranded lead.
  env.DB.prepare(`INSERT INTO discovery_revisions(id,lead_id,revision,content,actor,recorded_at,request_key,request_hash)
   SELECT ?,?,0,'{}',?,?,?,? WHERE EXISTS(SELECT 1 FROM discovery_leads WHERE id=?) AND NOT EXISTS(SELECT 1 FROM discovery_revisions WHERE lead_id=?)`)
   .bind(crypto.randomUUID(),id,actor,at,crypto.randomUUID(),hash,id,id),
 ];
 let result;
 try{result=await env.DB.batch(statements);}catch(error){const saved=await replay(env,input.request_key,hash);if(saved)return saved;if(String(error.message).includes('CHECK constraint'))fail('The source or duplicate target changed. Refresh before saving.',409);throw error;}
 const inserted=result[input.id?0:1];
 if(!inserted.results?.length){const saved=await replay(env,input.request_key,hash);if(saved)return saved;const duplicate=await env.DB.prepare('SELECT id FROM discovery_leads WHERE source_key=?').bind(key).first();fail('This lead or its linked evidence changed in another session. Refresh before saving.',409,duplicate&&duplicate.id!==id?{existing_id:duplicate.id}:{});}
 return {lead:parse(await env.DB.prepare(`SELECT * FROM (${latest}) WHERE lead_id=?`).bind(id).first()),replayed:false};
}

const matchesProof=snapshotFields.map(k=>`j.${k} IS json_extract(r.job_proof,'$.${k}')`).join(' AND ');
function queryState(now){const current=currentJobs(now,'j');return {sql:`SELECT r.*,CASE WHEN json_extract(r.content,'$.state')='linked' THEN (json_extract(r.content,'$.deadline') IS NULL OR json_extract(r.content,'$.deadline')>?) AND EXISTS(SELECT 1 FROM jobs j WHERE ${matchesProof} AND ${current.sql} AND ${sourceAllowed}) ELSE NULL END linked_current FROM (${latest}) r`,values:[iso(now),...current.values,...sourceValues()]};}
export async function discoverySummary(env,now=Date.now()){
 const q=queryState(now),rows=await env.DB.batch([
  env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(json_extract(content,'$.state') IN ('pending','held')),0) unresolved,
   COALESCE(SUM(json_extract(content,'$.state') IN ('pending','held') AND json_extract(content,'$.follow_up_at')<=?),0) overdue,
   COALESCE(SUM(json_extract(content,'$.state')='linked' AND linked_current=0),0) changed_links,
   COUNT(DISTINCT CASE WHEN linked_current=1 THEN json_extract(content,'$.job_id') END) current_linked_jobs,
   MAX(recorded_at) last_recorded_at FROM (${q.sql})`).bind(iso(now),...q.values),
  env.DB.prepare(`SELECT source_kind,json_extract(content,'$.state') state,COUNT(*) total FROM (${latest}) GROUP BY source_kind,state`),
 ]);
 return {checked_at:iso(now),...rows[0].results[0],counts:rows[1].results,limitation:DISCOVERY_LIMITATION};
}
export function discoveryFindings(summary){
 const findings=[];
 if(summary?.overdue)findings.push({id:'discovery-overdue',category:'growth',severity:'normal',title:'Review overdue sourcing leads',detail:`${summary.overdue} unresolved leads have reached their recorded follow-up time.`,next_action:'Open the private Discovery queue, inspect the original evidence and append a decision. Do not republish stale posts or move dates forward without a real review.'});
 if(summary?.changed_links)findings.push({id:'discovery-changed-links',category:'quality',severity:'normal',title:'Recheck changed discovery evidence',detail:`${summary.changed_links} linked lead records no longer match a current approved vacancy. Earlier decisions remain historical.`,next_action:'Compare the original employer advert and retained decision. Record a new review or hold; the discovery queue cannot publish or withdraw public jobs.'});
 return findings;
}
export async function discoveryAPI(request,env,owner){
 const u=new URL(request.url),path=u.pathname;
 try{
  if(request.method==='GET'&&path==='/api/admin/discovery/jobs'){
   const q=text(u.searchParams.get('q')||'',2,120,'Job search'),current=currentJobs(Date.now(),'j');
   return reply({jobs:(await env.DB.prepare(`SELECT j.id,j.company,j.title,j.apply_url,j.sponsorship FROM jobs j WHERE ${current.sql} AND ${sourceAllowed} AND (INSTR(LOWER(j.title),LOWER(?))>0 OR INSTR(LOWER(j.company),LOWER(?))>0) ORDER BY j.company,j.title LIMIT 20`).bind(...current.values,...sourceValues(),q,q).all()).results});
  }
  if(request.method==='GET'&&path==='/api/admin/discovery'){
   const state=u.searchParams.get('state')||'',search=text(u.searchParams.get('q')||'',0,120,'Lead search'),page=Math.max(1,Math.min(10000,parseInt(u.searchParams.get('page')||'1')||1));
   if(state&&!Object.hasOwn(DISCOVERY_STATES,state))fail('Choose a valid lead state.');
   const q=queryState(Date.now()),where=`(?='' OR json_extract(content,'$.state')=?) AND (?='' OR INSTR(LOWER(content||source_url),LOWER(?))>0)`;
   const rows=await env.DB.batch([
    env.DB.prepare(`SELECT * FROM (${q.sql}) WHERE ${where} ORDER BY CASE WHEN json_extract(content,'$.state') IN ('pending','held') THEN json_extract(content,'$.follow_up_at') ELSE '9999' END,recorded_at DESC,lead_id LIMIT 25 OFFSET ?`).bind(...q.values,state,state,search,search,(page-1)*25),
    env.DB.prepare(`SELECT COUNT(*) total FROM (${latest}) WHERE ${where}`).bind(state,state,search,search),
   ]);
   return reply({summary:await discoverySummary(env),page,total:rows[1].results[0].total,leads:rows[0].results.map(r=>({...parse(r),linked_current:r.linked_current===null?null:!!r.linked_current}))});
  }
  const match=path.match(/^\/api\/admin\/discovery\/([a-f0-9-]{36})$/);
  if(request.method==='GET'&&match&&uuid(match[1])){
   const q=queryState(Date.now()),r=await env.DB.prepare(`SELECT * FROM (${q.sql}) WHERE lead_id=?`).bind(...q.values,match[1]).first();if(!r)return reply({error:'Lead not found.'},404);
   const before=Number(u.searchParams.get('before')||Number.MAX_SAFE_INTEGER);
   if(!Number.isSafeInteger(before)||before<1)fail('Invalid history position.');
   const history=(await env.DB.prepare('SELECT l.source_url,l.source_kind,l.recorded_at first_recorded_at,r.* FROM discovery_leads l JOIN discovery_revisions r ON r.lead_id=l.id WHERE l.id=? AND r.revision<? ORDER BY r.revision DESC LIMIT 21').bind(match[1],before).all()).results;
   return reply({lead:{...parse(r),linked_current:r.linked_current===null?null:!!r.linked_current},history:history.slice(0,20).map(parse),next_before:history.length>20?history[19].revision:null});
  }
  if(request.method!=='POST'||path!=='/api/admin/discovery')return reply({error:'Not found.'},404);
  if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
  if(!(await limit(env,'discovery:'+owner.user.id,60)))return reply({error:'Too many discovery updates. Please try later.'},429);
  let body;try{body=await bodyJSON(request,18000);}catch{return reply({error:'Send a bounded JSON discovery record.'},400);}
  return reply(await saveDiscovery(env,body,owner.user.id));
 }catch(error){return reply({error:error.status?error.message:'The discovery record could not be verified. Refresh before retrying.',...(error.existing_id?{existing_id:error.existing_id}:{})},error.status||500);}
}
