import {batchHash,batchApplication} from '../shared/application-batch.js';
import {PACK_SCOPE,PACK_BYTES_LIMIT,packDocument} from '../shared/application-pack.js';
import {preparationSnapshot} from './preparation-availability.js';
import {cvApplicationRestriction,applicationSourceURL} from '../shared/application-instructions.js';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const joins=`FROM application_pack_reviews p LEFT JOIN application_pack_revocations r ON r.batch_id=p.batch_id AND r.role_id=p.role_id AND r.version=p.version`;
export async function packReviews(env,row,items,facts) {
 const records=(await env.DB.prepare(`SELECT p.role_id,p.version,p.batch_revision,p.facts_version,p.facts_hash,p.payload_hash,p.request_key,p.approved_at,r.revoked_at,r.request_key revoke_request_key ${joins} WHERE p.batch_id=? ORDER BY p.role_id,p.version DESC`).bind(row.id).all()).results;
 const latest=new Set(),byId=new Map(items.map(i=>[i.id,i]));
 return records.map(p=>{
  const old=latest.has(p.role_id);latest.add(p.role_id);const item=byId.get(p.role_id);
  return {...p,status:p.revoked_at?'revoked':old?'superseded':row.state!=='active'||p.batch_revision!==row.revision?'batch_changed':!item||!['prepared','needs_review'].includes(item.status)?'inputs_changed':!facts[0]||facts[0].status!=='current'||facts[0].version!==p.facts_version||facts[0].payload_hash!==p.facts_hash?'facts_changed':'approved_content'};
 });
}
// Return only the immutable fact snapshot named by this pack, never a current-CV fallback.
function comparisonSource(batch,facts){
 const source=facts&&batch.facts.find(f=>f.version===facts.version&&f.payload_hash===facts.hash);
 return source?{profile:source.profile,version:source.version,hash:source.payload_hash,status:source.status}:null;
}
export async function packPreview(env,row,w,batch,roleId,version=null) {
 const item=batch.items.find(i=>i.id===roleId);if(!item)fail('This role is not in the selected batch.',404);
 if(version!==null){
  if(!Number.isInteger(version)||version<1)fail('Choose a saved pack version.',400);
  const record=await env.DB.prepare('SELECT payload,payload_hash FROM application_pack_reviews WHERE batch_id=? AND role_id=? AND version=?').bind(row.id,roleId,version).first();
  if(!record)fail('Saved pack not found.',404);
  const payload=JSON.parse(record.payload);
  return {payload,comparison_source:comparisonSource(batch,payload.facts),payload_hash:record.payload_hash,record:batch.pack_reviews.find(p=>p.role_id===roleId&&p.version===version),can_approve:false,issues:[]};
 }
 const a=w?.data.applications.find(a=>a.id===roleId),fact=batch.facts[0],issues=[];
 if(row.state!=='active')issues.push('Reopen the batch or prepare a new selection.');
 if(!fact||fact.status!=='current')issues.push('Confirm your current facts and routine answers first.');
 if(!a||!['prepared','needs_review'].includes(item.status))issues.push('Sync and recheck this role. Changed inputs need a new selection.');
 if(!a)return {payload:null,payload_hash:null,can_approve:false,issues};
 if(await batchHash(batchApplication(a))!==item.input_hash||await batchHash(w.data.profile)!==row.profile_hash)issues.push('The saved documents or profile changed. Prepare a new selection.');
 if(!a.cv.trim())issues.push('Save the final CV for this role in Application Studio, then prepare a new selection. The master CV is not substituted.');
 if(['Applied','Interview','Offer','Closed'].includes(a.stage))issues.push('This role is already marked '+a.stage.toLowerCase()+'. Review its history before preparing another application.');
 const snapshot=await preparationSnapshot(a.jobId,env),url=applicationSourceURL(a.url);
 if(!url?.startsWith('https://'))issues.push('Use a valid HTTPS application link without embedded credentials.');
 if(!['current','manual'].includes(snapshot.state))issues.push('The original advert is no longer available for preparation.');
 if(snapshot.advert&&(a.sourceVersion&&a.sourceVersion!==snapshot.advert.version||url!==snapshot.advert.url||a.company!==snapshot.advert.company||a.title!==snapshot.advert.title))issues.push('The employer, role or destination differs from the current original. Review the advert in Application Studio.');
 if(cvApplicationRestriction(snapshot.advert?.description)||cvApplicationRestriction(a.description))issues.push('This employer does not accept CVs. Use its required application format instead.');
 const payload={scope:PACK_SCOPE,role:{id:a.id,jobId:a.jobId,company:a.company,title:a.title,location:a.location,url,source_version:snapshot.advert?.version||null,source_kind:snapshot.state==='manual'?'applicant_added':'catalogue',sponsorship:a.sponsorship,evidence:a.evidence},facts:fact?{version:fact.version,hash:fact.payload_hash,answers:fact.answers}:null,
  documents:[...(a.cv?[await packDocument(a.cv,'application-cv.txt')]:[]),...(a.coverLetter?[await packDocument(a.coverLetter,'application-cover-letter.txt')]:[])],screening_answers:[],delivery:{automated_submission:false,permitted_provider:null,requires_new_dispatch_approval:true}};
 const bytes=new TextEncoder().encode(JSON.stringify(payload)).length;
 if(bytes>300000)issues.push('This pack exceeds the 300,000-byte limit. Nothing was truncated or saved.');
 return {payload,comparison_source:comparisonSource(batch,payload.facts),payload_hash:await batchHash(payload),can_approve:issues.length===0,issues,previous_version:batch.pack_reviews.find(p=>p.role_id===roleId)?.version||0};
}
export async function changePackReview(env,userId,row,w,batch,body) {
 if(!key(body.request_key)||typeof body.role_id!=='string'||!batch.items.some(i=>i.id===body.role_id))fail('Choose a role in this batch before continuing.',400);
 if(body.action==='revoke_pack'){
  if(!Number.isInteger(body.version)||body.version<1)fail('Choose a saved approval.',400);
  const requestHash=await batchHash({role_id:body.role_id,version:body.version});
  const replay=await env.DB.prepare('SELECT request_hash FROM application_pack_revocations WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
  if(replay){if(replay.request_hash!==requestHash)fail('This request already belongs to another pack.');return;}
  await env.DB.prepare(`INSERT INTO application_pack_revocations(batch_id,role_id,version,request_key,request_hash,revoked_at) SELECT batch_id,role_id,version,?,?,? FROM application_pack_reviews WHERE batch_id=? AND role_id=? AND version=? AND EXISTS(SELECT 1 FROM application_batches WHERE id=? AND user_id=?) ON CONFLICT DO NOTHING`).bind(body.request_key,requestHash,new Date().toISOString(),row.id,body.role_id,body.version,row.id,userId).run();
  const saved=await env.DB.prepare('SELECT request_key FROM application_pack_revocations WHERE batch_id=? AND role_id=? AND version=?').bind(row.id,body.role_id,body.version).first();
  if(!saved||saved.request_key!==body.request_key)fail('This pack is already revoked or unavailable. Recheck its history.');return;
 }
 if(body.confirmed!==true||!hash(body.payload_hash)||!Number.isInteger(body.previous_version)||body.previous_version<0||body.previous_version>=10||!Number.isInteger(body.revision))fail('Review the exact documents, answers and destination before approving. Up to ten versions per role.',400);
 const requestHash=await batchHash({role_id:body.role_id,payload_hash:body.payload_hash,previous_version:body.previous_version,revision:body.revision,confirmed:true,scope:PACK_SCOPE});
 const replay=await env.DB.prepare('SELECT request_hash FROM application_pack_reviews WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
 if(replay){if(replay.request_hash!==requestHash)fail('This request already belongs to different content.');return;}
 const preview=await packPreview(env,row,w,batch,body.role_id);
 if(!preview.can_approve||row.revision!==body.revision||preview.payload_hash!==body.payload_hash)fail(preview.issues[0]||'The documents, answers, original advert or batch changed. Review them again.');
 const p=preview.payload,json=JSON.stringify(p),bytes=new TextEncoder().encode(json).length;
 // Repeat material catalogue and availability checks at the actual insert. A
 // close, hold or changed original while the request waits cannot win approval.
 let sourceSQL='',sourceValues=[];
 if(p.role.source_kind==='catalogue'){
  const snap=await preparationSnapshot(p.role.jobId,env);if(!snap.advert||snap.advert.version!==p.role.source_version)fail('The original advert changed. Recheck it before approving.');
  const fields={company:'company',title:'title',location:'location',description:'description',apply_url:'url',sponsorship:'sponsorship',evidence:'evidence',application_deadline:'deadline',closes_at:'closesAt',salary_excerpt:'salary',employment_type:'employment',workplace:'workplace'};
  sourceSQL=`AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=? AND j.active=1 AND ${Object.keys(fields).map(k=>`COALESCE(j.${k},'')=?`).join(' AND ')} AND julianday(j.last_seen)>julianday('now','-3 days') AND julianday(j.last_seen)<=julianday('now','+5 minutes') AND (j.closes_at IS NULL OR julianday(j.closes_at)>julianday('now')) AND NOT EXISTS(SELECT 1 FROM job_review_holds h JOIN job_review_targets t ON t.source_id=h.source_id AND t.apply_url=h.apply_url WHERE t.job_id=j.id AND h.source_id=j.board_id AND (h.state='held' OR h.recorded_at>=j.last_seen)))`;
  sourceValues=[p.role.jobId,...Object.values(fields).map(k=>snap.advert[k])];
 }
 await env.DB.prepare(`INSERT INTO application_pack_reviews(batch_id,role_id,version,batch_revision,facts_version,facts_hash,payload,payload_hash,payload_bytes,request_key,request_hash,approved_at)
 SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM application_batches WHERE id=? AND user_id=? AND state='active' AND revision=?)
 AND EXISTS(SELECT 1 FROM career_workspaces WHERE user_id=? AND revision=?)
 AND (SELECT COALESCE(MAX(version),0) FROM application_pack_reviews WHERE batch_id=? AND role_id=?)=?
 AND (SELECT COALESCE(SUM(payload_bytes),0) FROM application_pack_reviews WHERE batch_id=?)+?<=?
 AND (SELECT MAX(version) FROM application_fact_packs WHERE batch_id=?)=?
 AND NOT EXISTS(SELECT 1 FROM application_fact_revocations WHERE batch_id=? AND version=?) ${sourceSQL} ON CONFLICT DO NOTHING`)
 .bind(row.id,body.role_id,body.previous_version+1,row.revision,p.facts.version,p.facts.hash,json,preview.payload_hash,bytes,body.request_key,requestHash,new Date().toISOString(),row.id,userId,body.revision,userId,w.revision,row.id,body.role_id,body.previous_version,row.id,bytes,PACK_BYTES_LIMIT,row.id,p.facts.version,row.id,p.facts.version,...sourceValues).run();
 const saved=await env.DB.prepare('SELECT request_hash FROM application_pack_reviews WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
 if(!saved||saved.request_hash!==requestHash)fail('The account, facts, role or batch changed, or this batch has reached its 5 MB retained-pack limit. Recheck before continuing; nothing was approved.');
}
