import {querySpec} from './data.js';
import {bodyJSON,digest,limit,reply,sameOrigin} from './auth.js';
import {reviewEvidenceURL} from './job-reviews.js';
import {businessRelationships,identityRegisterFresh} from '../shared/business-identities.js';
const iso=n=>new Date(n).toISOString();
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const clean=r=>r?Object.fromEntries(Object.entries(r).filter(([k])=>!['actor','request_key','request_hash','business_key'].includes(k))):null;
const fields=['identity_id','revision','sponsor_id','sponsor_name','business_name','relationship','website','careers_url','activity','locations','official_identifier','evidence_url','evidence_summary','rights_basis','observed_at','review_due_at','state','review_method','note','request_key'];
const publicFields=['identity_id','revision','sponsor_id','sponsor_name','business_name','relationship','website','careers_url','activity','locations','official_identifier','evidence_url','evidence_summary','observed_at','review_due_at','review_method','recorded_at'];
const text=(v,min,max,label)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\u0000-\u001f\u007f]/.test(v.replaceAll('\n','')))fail(label+' is missing or too long.');return v.trim();};
const canonicalDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&iso(Date.parse(s))===s;
async function register(env){const r=await env.DB.prepare("SELECT value FROM metadata WHERE key='register'").first();return r?JSON.parse(r.value):null;}
async function replay(env,key,hash){
 const r=await env.DB.prepare('SELECT * FROM business_identity_revisions WHERE request_key=?').bind(key).first();
 if(!r)return null;if(r.request_hash!==hash)fail('This request key belongs to a different review.',409);
 const current=await env.DB.prepare('SELECT * FROM business_identities WHERE identity_id=?').bind(r.identity_id).first();
 return {review:clean(current),saved_revision:r.revision,replayed:true};
}
export async function saveBusinessIdentity(env,input,actor,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k))||!uuid(input.request_key)||!uuid(input.identity_id)||!Number.isSafeInteger(input.revision)||input.revision<0)fail('Refresh the business record before saving.');
 text(actor,1,160,'Reviewer');const hash=await digest(JSON.stringify([actor,fields.map(k=>input[k]??null)])),prior=await replay(env,input.request_key,hash);if(prior)return prior;
 const old=await env.DB.prepare('SELECT * FROM business_identities WHERE identity_id=?').bind(input.identity_id).first();
 if((old?.revision||0)!==input.revision)fail('This business has a newer review. Refresh before saving.',409);
 if(!/^[a-f0-9]{24}$/.test(input.sponsor_id)||!Object.hasOwn(businessRelationships,input.relationship)||!['approved','held','withdrawn'].includes(input.state)||!['agent_assisted','owner_review'].includes(input.review_method))fail('Choose the exact sponsor, relationship, decision and review method.');
 const sponsor_name=text(input.sponsor_name,1,250,'Exact register name'),business_name=text(input.business_name,2,200,'Business name');
 if(old&&(input.sponsor_id!==old.sponsor_id||sponsor_name!==old.sponsor_name))fail('The legal register identity cannot be changed. Withdraw this record and review a separate relationship.');
 const website=reviewEvidenceURL(input.website),careers_url=input.careers_url===''?'':reviewEvidenceURL(input.careers_url),evidence_url=reviewEvidenceURL(input.evidence_url);
 const activity=text(input.activity,0,400,'Activity'),locations=text(input.locations,0,400,'Operating locations'),official_identifier=text(input.official_identifier,0,150,'Official identifier');
 const evidence_summary=text(input.evidence_summary,30,1000,'Public evidence summary'),rights_basis=text(input.rights_basis,20,1000,'Source rights review'),note=text(input.note,30,2000,'Private review reason');
 if(!canonicalDate(input.observed_at)||Date.parse(input.observed_at)>now+300000||(!old||input.state==='approved')&&Date.parse(input.observed_at)<now-72*3600000)fail('Use an actual evidence observation. New records and approvals require evidence from the last 72 hours.');
 if(!canonicalDate(input.review_due_at)||input.state!=='withdrawn'&&(Date.parse(input.review_due_at)<=now||Date.parse(input.review_due_at)>now+30*86400000))fail('Set a review date within 30 days. Elapsed dates never approve a record.');
 if(old&&(input.observed_at<old.observed_at||input.state==='approved'&&input.observed_at<old.recorded_at))fail('Use newly observed evidence before approving this relationship.');
 const meta=await register(env),sponsor=meta&&await env.DB.prepare('SELECT name FROM sponsors WHERE snapshot=? AND id=?').bind(meta.snapshot,input.sponsor_id).first();
 if(input.state==='approved'&&(!identityRegisterFresh(meta,now)||sponsor?.name!==sponsor_name))fail('Approval needs a fresh register and this exact legal name. Keep uncertain relationships held.');
 if(!old&&sponsor?.name!==sponsor_name)fail('Choose an exact entry in the current register.');
 const business_key=business_name.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 const at=iso(now),id=crypto.randomUUID();
 const columns=['id','identity_id','revision','sponsor_id','sponsor_name','business_name','business_key','relationship','website','careers_url','activity','locations','official_identifier','evidence_url','evidence_summary','rights_basis','observed_at','review_due_at','state','review_method','note','actor','recorded_at','request_key','request_hash'];
 const values=[id,input.identity_id,input.revision+1,input.sponsor_id,sponsor_name,business_name,business_key,input.relationship,website,careers_url,activity,locations,official_identifier,evidence_url,evidence_summary,rights_basis,input.observed_at,input.review_due_at,input.state,input.review_method,note,actor,at,input.request_key,hash];
 let result;
 try{result=await env.DB.batch([
  env.DB.prepare(`INSERT INTO business_identity_revisions(${columns.join(',')}) SELECT ${columns.map(()=>'?').join(',')}
   WHERE COALESCE((SELECT MAX(revision) FROM business_identity_revisions WHERE identity_id=?),0)=?
   AND NOT EXISTS(SELECT 1 FROM business_identities WHERE sponsor_id=? AND business_key=? AND identity_id<>?)
   AND (? > 0 OR (SELECT COUNT(*) FROM business_identities)<500)
   AND (?<>'approved' OR EXISTS(SELECT 1 FROM sponsors JOIN metadata m ON m.key='register' WHERE sponsors.snapshot=json_extract(m.value,'$.snapshot') AND sponsors.snapshot=? AND sponsors.id=? AND sponsors.name=? AND json(m.value)=json(?))) RETURNING id`)
   .bind(...values,input.identity_id,input.revision,input.sponsor_id,business_key,input.identity_id,input.revision,input.state,meta?.snapshot||'',input.sponsor_id,sponsor_name,JSON.stringify(meta)),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT actor,'business-identity-review',id,recorded_at FROM business_identity_revisions WHERE id=?").bind(id),
 ]);}catch(error){const saved=await replay(env,input.request_key,hash);if(saved)return saved;throw error;}
 if(!result[0].results?.length){const saved=await replay(env,input.request_key,hash);if(saved)return saved;fail('The register or record changed, this relationship already exists, or the review queue is full. Refresh before saving.',409);}
 return {review:clean(await env.DB.prepare('SELECT * FROM business_identities WHERE identity_id=?').bind(input.identity_id).first()),saved_revision:input.revision+1,replayed:false};
}
export async function publicBusinessIdentities(env,sponsorId,now=Date.now()){
 if(!/^[a-f0-9]{24}$/.test(sponsorId||''))fail('Choose a sponsor record.');
 const meta=await register(env);
 if(!identityRegisterFresh(meta,now))return {items:[],status:'register_unavailable'};
 const rows=(await env.DB.prepare(`SELECT b.* FROM business_identities b JOIN sponsors s ON s.id=b.sponsor_id AND s.name=b.sponsor_name AND s.snapshot=? WHERE b.sponsor_id=? AND b.state='approved' AND b.observed_at<=? AND b.review_due_at>? ORDER BY b.business_name COLLATE NOCASE,b.identity_id LIMIT 500`).bind(meta.snapshot,sponsorId,iso(now+300000),iso(now)).all()).results;
 return {items:rows.map(r=>Object.fromEntries(publicFields.map(k=>[k,r[k]]))),status:rows.length?'reviewed':'no_current_review'};
}
export async function businessIdentitySummary(env,now=Date.now()){
 return env.DB.prepare("SELECT COUNT(*) total,COALESCE(SUM(state='approved'),0) approved,COALESCE(SUM(state<>'withdrawn' AND review_due_at<=?),0) overdue FROM business_identities").bind(iso(now)).first();
}
// The caller has already checked immutable owner membership.
export async function businessIdentitiesAPI(request,env,owner){
 const u=new URL(request.url);
 try{
  if(request.method==='GET'){
   if(u.searchParams.has('id')){
    const id=u.searchParams.get('id'),before=Number(u.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!uuid(id)||!Number.isSafeInteger(before)||before<1)fail('Choose a business review.');
    const review=await env.DB.prepare('SELECT * FROM business_identities WHERE identity_id=?').bind(id).first();if(!review)return reply({error:'Business review not found.'},404);
    const history=(await env.DB.prepare('SELECT * FROM business_identity_revisions WHERE identity_id=? AND revision<? ORDER BY revision DESC LIMIT 21').bind(id,before).all()).results;
    return reply({review:clean(review),history:history.slice(0,20).map(clean),next_before:history.length>20?history[19].revision:null});
   }
   const page=Number(u.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>20)fail('Invalid page.');
   return reply({page,summary:await businessIdentitySummary(env),items:(await env.DB.prepare('SELECT * FROM business_identities ORDER BY recorded_at DESC,identity_id LIMIT 25 OFFSET ?').bind((page-1)*25).all()).results.map(clean)});
  }
  if(request.method!=='POST')return reply({error:'Not found.'},404);
  if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
  if(!await limit(env,'business-identities:'+owner.user.id,30))return reply({error:'Please wait before another review.'},429);
  let input;try{input=await bodyJSON(request,12000);}catch{fail('Send a bounded business review.');}
  return reply(await saveBusinessIdentity(env,input,owner.user.id));
 }catch(error){return reply({error:error.status?error.message:'This review could not be verified. Refresh before retrying.'},error.status||500);}
}

// Keep the protected source/parser module unchanged. Alias expansion is a
// separate public-directory concern with the same existing filters and bounds.
export function businessQuerySpec(params,businessAt=null){
 const base=querySpec(params);if(!base.q||!businessAt)return base;
 const plain=new URLSearchParams(params);plain.delete('q');const filter=querySpec(plain);
 const term='%'+base.q.replace(/[\\%_]/g,'\\$&')+'%';
 return {...filter,q:base.q,where:filter.where+" AND (name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR (id,name) IN (SELECT b.sponsor_id,b.sponsor_name FROM business_identities b WHERE b.state='approved' AND b.review_due_at>? AND b.observed_at<=? AND b.business_name LIKE ? ESCAPE '\\'))",values:[...filter.values,term,term,businessAt,iso(Date.parse(businessAt)+300000),term]};
}
