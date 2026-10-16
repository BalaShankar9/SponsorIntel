import {bodyJSON,digest,limit,reply,sameOrigin} from './auth.js';
import {BOARDS} from './job-sources.js';
import {approvedJobLink} from './job-link-checks.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(s,min,max,label)=>{if(typeof s!=='string'||s.trim().length<min||s.length>max||/[\u0000-\u001f]/.test(s.replaceAll('\n','')))fail(label+' is missing or too long.');return s.trim();};
const iso=n=>new Date(n).toISOString();
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const stamp=(s,now)=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&iso(Date.parse(s))===s&&Date.parse(s)<=now+300000&&Date.parse(s)>=now-72*3600000;
const clean=row=>row?Object.fromEntries(Object.entries(row).filter(([k])=>!['actor','request_key','request_hash'].includes(k))):null;
export function reviewEvidenceURL(s){
 text(s,1,1500,'Evidence link');let u;try{u=new URL(s);}catch{fail('Use a public HTTPS evidence link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)||/(^|\.)(localhost|local|internal|invalid|test)$/.test(u.hostname)||/\\|[\r\n]/.test(s))fail('Use a public HTTPS evidence link without credentials.');
 // Review links are navigated manually, never fetched here. Preserve only
 // explicit public routing fields, not arbitrary tracking/session tokens.
 if([...u.searchParams.keys()].some(k=>!['ref','WVID','pid','title','file','type','gh_jid'].includes(k)))fail('Remove tracking, session or private fields from the evidence link.');
 u.hash='';return u.href;
}
export async function reviewSources(env){return [...BOARDS,...(await env.DB.prepare('SELECT * FROM employer_boards ORDER BY company LIMIT 100').all()).results];}
async function replay(env,key,hash){const row=await env.DB.prepare('SELECT * FROM job_review_revisions WHERE request_key=?').bind(key).first();if(!row)return null;if(row.request_hash!==hash)fail('This request key belongs to a different decision.',409);return {review:clean(row),replayed:true};}
export async function saveJobReview(env,input,actor,now=Date.now()){
 const keys=['source_id','apply_url','revision','state','title','reason','evidence_url','note','observed_at','follow_up_at','request_key'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!keys.includes(k))||!uuid(input.request_key)||!Number.isSafeInteger(input.revision)||input.revision<0)fail('Refresh the advert review before saving.');
 text(actor,1,160,'Reviewer');const hash=await digest(JSON.stringify([actor,keys.map(k=>input[k]??null)])),prior=await replay(env,input.request_key,hash);if(prior)return prior;
 const board=(await reviewSources(env)).find(b=>b.id===input.source_id);if(!board)fail('Choose a configured employer source.');
 text(input.apply_url,1,1500,'Original advert');const url=approvedJobLink(board,input.apply_url);if(!url||url!==input.apply_url)fail('Use the exact public advert link for this employer, without tracking or session fields.');
 if(!['held','released'].includes(input.state)||input.revision===0&&input.state!=='held')fail('An initial decision must hold the advert.');
 if(!['deadline_conflict','sponsorship_conflict','availability_conflict','other'].includes(input.reason))fail('Choose the evidence conflict.');
 const title=text(input.title,3,240,'Advert title'),note=text(input.note,30,2000,'Review evidence'),evidence=reviewEvidenceURL(input.evidence_url);
 if(!stamp(input.observed_at,now))fail('Review the original evidence within the last 72 hours.');
 if(input.state==='held'){
  const f=input.follow_up_at;if(typeof f!=='string'||!Number.isFinite(Date.parse(f))||iso(Date.parse(f))!==f||Date.parse(f)<=now||Date.parse(f)>now+7*86400000)fail('Set a follow-up within seven days. A due date never releases a hold.');
 }else if(input.follow_up_at!==null)fail('Released reviews have no follow-up date.');
 const old=await env.DB.prepare('SELECT * FROM job_review_holds WHERE source_id=? AND apply_url=?').bind(board.id,url).first();
 if((old?.revision||0)!==input.revision)fail('This advert has a newer review. Refresh before saving.',409);
 if(input.state==='released'&&old&&note===old.note)fail('Record the new evidence resolving this hold.');
 if(old&&input.observed_at<old.observed_at||input.state==='released'&&old&&input.observed_at<old.recorded_at)fail('Use newly observed evidence before changing this decision.');
 if(!old&&(await env.DB.prepare('SELECT COUNT(*) n FROM job_review_holds').first()).n>=500)fail('Review the existing advert holds before expanding the queue.',409);
 const id=crypto.randomUUID(),at=iso(now);
 let result;
 try{result=await env.DB.batch([
  env.DB.prepare(`INSERT INTO job_review_revisions(id,source_id,apply_url,revision,state,title,reason,evidence_url,note,observed_at,follow_up_at,actor,recorded_at,request_key,request_hash)
   SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE COALESCE((SELECT MAX(revision) FROM job_review_revisions WHERE source_id=? AND apply_url=?),0)=?
   AND (? > 0 OR (SELECT COUNT(*) FROM job_review_holds)<500) RETURNING id`).bind(id,board.id,url,input.revision+1,input.state,title,input.reason,evidence,note,input.observed_at,input.follow_up_at,actor,at,input.request_key,hash,board.id,url,input.revision,input.revision),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT actor,'job-evidence-review',id,recorded_at FROM job_review_revisions WHERE id=?").bind(id)
 ]);}catch(error){const saved=await replay(env,input.request_key,hash);if(saved)return saved;throw error;}
 if(!result[0].results?.length){const saved=await replay(env,input.request_key,hash);if(saved)return saved;fail('The advert changed in another session. Refresh before saving.',409);}
 return {review:clean(await env.DB.prepare('SELECT * FROM job_review_revisions WHERE id=?').bind(id).first()),replayed:false};
}
export async function jobReviewSummary(env,now=Date.now()){
 return env.DB.prepare("SELECT COUNT(*) total,COALESCE(SUM(state='held'),0) held,COALESCE(SUM(state='held' AND follow_up_at<=?),0) overdue FROM job_review_holds").bind(iso(now)).first();
}
export function jobReviewFindings(s){return s?.overdue?[{id:'job-review-overdue',category:'quality',severity:'normal',title:'Review disputed adverts',detail:s.overdue+' advert holds have reached their follow-up date. They remain outside current opportunities.',next_action:'Compare the original evidence in Advert reviews. Record a new decision; a due date or a successful feed refresh never clears the hold.'}]:[];}
// The caller has already checked the immutable owner identity.
export async function jobReviewsAPI(request,env,owner){
 const u=new URL(request.url);
 try{
  if(request.method==='GET'){
   if(u.searchParams.has('id')){
    const id=u.searchParams.get('id');if(!uuid(id))fail('Choose an advert review.');
    const row=await env.DB.prepare('SELECT * FROM job_review_revisions WHERE id=?').bind(id).first();if(!row)return reply({error:'Review not found.'},404);
    const before=Number(u.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)fail('Invalid history position.');
    const latest=await env.DB.prepare('SELECT * FROM job_review_holds WHERE source_id=? AND apply_url=?').bind(row.source_id,row.apply_url).first();
    const history=(await env.DB.prepare('SELECT * FROM job_review_revisions WHERE source_id=? AND apply_url=? AND revision<? ORDER BY revision DESC LIMIT 21').bind(row.source_id,row.apply_url,before).all()).results;
    return reply({review:clean(latest),history:history.slice(0,20).map(clean),next_before:history.length>20?history[19].revision:null});
   }
   const page=Number(u.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1||page>1000)fail('Invalid page.');
   return reply({page,summary:await jobReviewSummary(env),sources:(await reviewSources(env)).map(b=>({id:b.id,company:b.company})),items:(await env.DB.prepare('SELECT * FROM job_review_holds ORDER BY recorded_at DESC,id DESC LIMIT 25 OFFSET ?').bind((page-1)*25).all()).results.map(clean)});
  }
  if(request.method!=='POST')return reply({error:'Not found.'},404);
  if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
  if(!await limit(env,'job-reviews:'+owner.user.id,40))return reply({error:'Please wait before making another review.'},429);
  let input;try{input=await bodyJSON(request,7500);}catch{fail('Send a bounded advert review.');}
  return reply(await saveJobReview(env,input,owner.user.id));
 }catch(error){return reply({error:error.status?error.message:'This decision could not be verified. Refresh before retrying.'},error.status||500);}
}
