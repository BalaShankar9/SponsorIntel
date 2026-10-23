import {reply,bodyJSON,limit} from './auth.js';
import {validateWorkspace} from './career-validation.js';
import {batchHash,batchApplication,batchSelection,batchSelectionHash,BATCH_HISTORY_LIMIT} from '../shared/application-batch.js';
import {preparationSnapshots} from './preparation-availability.js';
import {savedAdvertState} from '../shared/advert-version.js';
import {preparationMessages} from '../shared/preparation-availability.js';
import {cvApplicationRestriction,applicationSourceURL} from '../shared/application-instructions.js';
import {factPacks,changeFacts} from './application-facts.js';
import {buildEvidenceReview} from './career-evidence.js';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(x);
const summary=row=>({id:row.id,state:row.state,revision:row.revision,created_at:row.created_at,updated_at:row.updated_at,count:row.count??JSON.parse(row.items).length});
const safeURL=value=>{const url=applicationSourceURL(value);return url?.startsWith('https://')?url:null;};
function readiness(profile,a,snapshot) {
  const state=savedAdvertState(a,snapshot),issues=[];
  if(!['current','manual'].includes(state))return {status:'blocked',issues:[preparationMessages[state]||'Check the latest advert in the application workspace.'],availability:state};
  if(['Applied','Interview','Offer','Closed'].includes(a.stage))issues.push('You already marked this role '+a.stage.toLowerCase()+'. Review its history before preparing another application.');
  if(profile.cv.trim().length<100)issues.push('Add your experience, education and skills in My CV & profile (at least 100 characters).');
  if(a.description.trim().length<80)issues.push('Add the employer’s responsibilities and requirements (at least 80 characters).');
  if(!profile.name.trim())issues.push('Add your name in My CV & profile.');
  if(!profile.email.trim())issues.push('Add your chosen application email in My CV & profile.');
  if(!safeURL(a.url))issues.push('Add a valid HTTPS employer application link.');
  const format=cvApplicationRestriction(snapshot.advert?.description)||cvApplicationRestriction(a.description);
  if(format)issues.push('The advert does not accept CVs. Use the employer’s requested format; these are evidence notes only.');
  if(state==='manual')issues.push('This role was added manually. Check the employer’s current advert and application route yourself.');
  return {status:issues.length?(profile.cv.trim().length<100||a.description.trim().length<80||!profile.name.trim()||!profile.email.trim()||!safeURL(a.url)?'needs_information':'needs_review'):'prepared',issues,availability:state};
}
async function workspace(env,userId) {
  const row=await env.DB.prepare('SELECT data,revision FROM career_workspaces WHERE user_id=?').bind(userId).first();
  return row?{data:validateWorkspace(JSON.parse(row.data)),revision:row.revision}:null;
}
async function rowFor(env,userId,id) {
  return env.DB.prepare('SELECT * FROM application_batches WHERE user_id=? AND id=?').bind(userId,id).first();
}
async function detail(env,userId,row) {
  const saved=JSON.parse(row.items),w=await workspace(env,userId),profileHash=w?await batchHash(w.data.profile):null;
  const apps=new Map((w?.data.applications||[]).map(a=>[a.id,a]));
  const current=await preparationSnapshots(saved.map(i=>i.jobId),env);
  const items=await Promise.all(saved.map(async item=>{
    const a=apps.get(item.id);
    const live=!a?{status:'missing',issues:['This saved role was removed. Its earlier evidence notes remain here.']}:
      profileHash!==row.profile_hash||await batchHash(batchApplication(a))!==item.input_hash?{status:'changed',issues:['Your CV, contact details, working advert, documents or stage changed. Create a new reviewed selection to prepare updated notes.']}:
      readiness(w.data.profile,a,current.get(item.jobId)||{state:'unavailable'});
    if(live.status==='prepared'&&!item.report){live.status='needs_review';live.issues=['Evidence notes were not prepared while this role was unavailable. Select it again to prepare a new batch after checking the advert.'];}
    return {...item,...live,url:safeURL(item.url),in_workspace:!!a};
  }));
  const history=(await env.DB.prepare('SELECT revision,state,recorded_at FROM application_batch_events WHERE batch_id=? ORDER BY revision').bind(row.id).all()).results;
  return {accountId:userId,workspace_hash:w?await batchHash(w.data):null,batch:{...summary(row),items,history,facts:await factPacks(env,row,profileHash,items)},submission_available:false};
}
async function create(env,userId,body) {
  if(!key(body.request_key)||!/^[a-f0-9]{64}$/.test(body.input_hash||''))fail('Choose your roles again before creating a batch.');
  const requestHash=await batchHash({ids:body.application_ids,input_hash:body.input_hash});
  const replay=await env.DB.prepare('SELECT * FROM application_batches WHERE user_id=? AND request_key=?').bind(userId,body.request_key).first();
  if(replay){if(replay.request_hash!==requestHash)fail('This request was already used for a different selection.',409);return detail(env,userId,replay);}
  const w=await workspace(env,userId);if(!w)fail('Save your workspace to your account first.',409);
  let selection;try{selection=batchSelection(w.data,body.application_ids);}catch(e){fail(e.message);}
  if(await batchSelectionHash(w.data,body.application_ids)!==body.input_hash)fail('Your selected roles or profile have unsynced changes. Wait for sync, then review the selection again.',409);
  const snapshots=await preparationSnapshots(selection.applications.map(a=>a.jobId),env);
  const identity=await batchHash({input:body.input_hash,availability:selection.applications.map(a=>({id:a.id,state:snapshots.get(a.jobId)?.state,version:snapshots.get(a.jobId)?.advert?.version||''}))});
  const duplicate=await env.DB.prepare('SELECT * FROM application_batches WHERE user_id=? AND input_hash=?').bind(userId,identity).first();
  if(duplicate)return {...await detail(env,userId,duplicate),duplicate:true};
  const items=[];
  for(const a of selection.applications){
    const check=readiness(selection.profile,a,snapshots.get(a.jobId)||{state:'unavailable'});
    const canPrepare=['current','manual'].includes(check.availability)&&selection.profile.cv.trim().length>=100&&a.description.trim().length>=80;
    items.push({id:a.id,jobId:a.jobId,company:a.company,title:a.title,location:a.location,url:safeURL(a.url),sponsorship:a.sponsorship,evidence:a.evidence,
      input_hash:await batchHash(batchApplication(a)),initial_status:check.status,report:canPrepare?buildEvidenceReview(selection.profile,a):''});
  }
  const payload=JSON.stringify(items);
  if(new TextEncoder().encode(payload).length>1500000)fail('These evidence notes are too large for one batch. Choose fewer roles; your workspace is unchanged.',413);
  const id=crypto.randomUUID(),now=new Date().toISOString(),profileHash=await batchHash(selection.profile);
  // The account, workspace revision and history ceiling are tested inside the
  // insert. A simultaneous save/deletion cannot attach the snapshot to new data.
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO application_batches(id,user_id,input_hash,profile_hash,items,state,revision,request_key,request_hash,last_request_key,created_at,updated_at)
      SELECT ?,?,?,?,?, 'active',1,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM user WHERE id=?)
      AND EXISTS(SELECT 1 FROM career_workspaces WHERE user_id=? AND revision=?)
      AND (SELECT COUNT(*) FROM application_batches WHERE user_id=?)<? ON CONFLICT DO NOTHING`)
      .bind(id,userId,identity,profileHash,payload,body.request_key,requestHash,body.request_key,now,now,userId,userId,w.revision,userId,BATCH_HISTORY_LIMIT),
    env.DB.prepare(`INSERT INTO application_batch_events(batch_id,revision,state,request_key,request_hash,recorded_at)
      SELECT id,revision,state,request_key,request_hash,created_at FROM application_batches WHERE id=? ON CONFLICT DO NOTHING`).bind(id)
  ]);
  const saved=await env.DB.prepare('SELECT * FROM application_batches WHERE user_id=? AND (id=? OR input_hash=?)').bind(userId,id,identity).first();
  if(!saved)fail('The workspace changed, your account is unavailable, or you have 20 retained batches. Refresh before trying again; no batch was added.',409);
  return detail(env,userId,saved);
}
async function change(env,userId,row,body) {
  if(!key(body.request_key)||!Number.isSafeInteger(body.revision))fail('Refresh the batch before changing it.');
  const target={pause:'paused',resume:'active',cancel:'cancelled'}[body.action];
  if(!target)fail('This preparation service cannot submit applications.');
  const hash=await batchHash({action:body.action,revision:body.revision});
  const replay=await env.DB.prepare('SELECT request_hash FROM application_batch_events WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
  if(replay){if(replay.request_hash!==hash)fail('This request was already used for a different action.',409);return detail(env,userId,row);}
  if(row.revision!==body.revision||row.state==='cancelled'||row.state===target||row.revision>=100)fail('This batch changed or is already ended. Refresh its history before continuing.',409);
  const now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE application_batches SET state=?,revision=revision+1,last_request_key=?,updated_at=? WHERE id=? AND user_id=? AND revision=? AND state!='cancelled'`)
      .bind(target,body.request_key,now,row.id,userId,body.revision),
    env.DB.prepare(`INSERT INTO application_batch_events(batch_id,revision,state,request_key,request_hash,recorded_at)
      SELECT id,revision,state,?,?,updated_at FROM application_batches WHERE id=? AND user_id=? AND revision=? AND last_request_key=? ON CONFLICT DO NOTHING`)
      .bind(body.request_key,hash,row.id,userId,body.revision+1,body.request_key)
  ]);
  const saved=await rowFor(env,userId,row.id);
  if(!saved||saved.last_request_key!==body.request_key)fail('Another session changed this batch. Refresh its current state.',409);
  return detail(env,userId,saved);
}
export async function applicationBatchesAPI(request,env,user) {
  if(!await limit(env,'application-batches:'+user.id,60,3600))return reply({error:'Please wait before checking more batches.'},429);
  const id=new URL(request.url).pathname.slice('/api/career/batches'.length).replace(/^\//,'');
  try {
    if(request.method==='GET'){
      if(id){const row=await rowFor(env,user.id,id);if(!row)fail('Batch not found.',404);return reply(await detail(env,user.id,row));}
      const rows=(await env.DB.prepare('SELECT id,state,revision,created_at,updated_at,json_array_length(items) count FROM application_batches WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(user.id).all()).results;
      return reply({accountId:user.id,batches:rows.map(summary),submission_available:false});
    }
    if(request.method!=='POST')return reply({error:'Method not allowed'},405);
    const body=await bodyJSON(request,16000);
    if(body.accountId!==user.id)fail('Your signed-in account changed. Reload before continuing.',409);
    if(!id)return reply(await create(env,user.id,body));
    const row=await rowFor(env,user.id,id);if(!row)fail('Batch not found.',404);
    if(['approve_facts','revoke_facts'].includes(body.action)){await changeFacts(env,user.id,row,await workspace(env,user.id),body);const saved=await rowFor(env,user.id,id);if(!saved)fail('This batch is no longer available.',409);return reply(await detail(env,user.id,saved));}
    return reply(await change(env,user.id,row,body));
  } catch(error) {
    if(error.status)return reply({error:error.message},error.status);
    if(error instanceof SyntaxError)return reply({error:'Please send a valid batch request.'},400);
    throw error;
  }
}
