import {batchHash,batchApplication} from '../shared/application-batch.js';
import {validateFactAnswers} from '../shared/application-facts.js';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(x);
export async function factPacks(env,row,profileHash,items) {
 const records=(await env.DB.prepare(`SELECT p.*,r.revoked_at,r.request_key revoke_request_key FROM application_fact_packs p LEFT JOIN application_fact_revocations r ON r.batch_id=p.batch_id AND r.version=p.version WHERE p.batch_id=? ORDER BY p.version DESC`).bind(row.id).all()).results;
 return records.map((p,index)=>({version:p.version,approved_at:p.approved_at,revoked_at:p.revoked_at,request_key:p.request_key,revoke_request_key:p.revoke_request_key,payload_hash:p.payload_hash,...JSON.parse(p.payload),
  status:p.revoked_at?'revoked':index?'superseded':row.state!=='active'||p.batch_revision!==row.revision?'batch_changed':profileHash!==p.profile_hash||items.some(i=>['missing','changed','blocked','needs_information'].includes(i.status))?'inputs_changed':'current'}));
}
export async function changeFacts(env,userId,row,w,body) {
 if(!key(body.request_key))fail('Refresh before recording your facts.',400);
 if(body.action==='revoke_facts') {
  if(!Number.isInteger(body.version)||body.version<1)fail('Choose a saved confirmation.',400);
  const hash=await batchHash({version:body.version});
  const replay=await env.DB.prepare('SELECT request_hash FROM application_fact_revocations WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
  if(replay){if(replay.request_hash!==hash)fail('This request already belongs to another confirmation.');return;}
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO application_fact_revocations(batch_id,version,request_key,request_hash,revoked_at) SELECT batch_id,version,?,?,? FROM application_fact_packs WHERE batch_id=? AND version=? AND EXISTS(SELECT 1 FROM application_batches WHERE id=? AND user_id=?) ON CONFLICT DO NOTHING`).bind(body.request_key,hash,now,row.id,body.version,row.id,userId).run();
  const saved=await env.DB.prepare('SELECT request_key FROM application_fact_revocations WHERE batch_id=? AND version=?').bind(row.id,body.version).first();
  if(!saved||saved.request_key!==body.request_key)fail('This confirmation changed or is already revoked. Refresh its history.');
  return;
 }
 if(body.confirmed!==true||!Number.isInteger(body.previous_version)||body.previous_version<0||body.previous_version>=20||!Number.isInteger(body.revision)||!/^[a-f0-9]{64}$/.test(body.profile_hash||''))fail('Review the complete profile and answers before confirming. Up to 20 versions can be retained per batch.',400);
 let answers;try{answers=validateFactAnswers(body.answers);}catch(e){fail(e.message,400);}
 if(await batchHash(answers)!==body.answers_hash)fail('These answers differ from the pending request. Restore the exact answers before retrying.',409);
 const requestHash=await batchHash({profile_hash:body.profile_hash,answers,revision:body.revision,previous_version:body.previous_version,confirmed:true});
 const replay=await env.DB.prepare('SELECT request_hash FROM application_fact_packs WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
 if(replay){if(replay.request_hash!==requestHash)fail('This request already belongs to different facts or answers.');return;}
 if(!w||row.state!=='active'||row.revision!==body.revision||await batchHash(w.data.profile)!==body.profile_hash||body.profile_hash!==row.profile_hash)fail('Your profile or batch changed. Sync and prepare a new selection before confirming.');
 const savedItems=JSON.parse(row.items),apps=new Map(w.data.applications.map(a=>[a.id,a]));
 for(const item of savedItems){const a=apps.get(item.id);if(!a||await batchHash(batchApplication(a))!==item.input_hash)fail('A selected role changed. Prepare a new selection before confirming.');}
 const p=w.data.profile;
 if(!p.name.trim()||!p.email.trim()||p.cv.trim().length<100)fail('Add your name, application email and CV before confirming your facts.');
 const payload=JSON.stringify({profile:p,answers,scope:'preparation_only'}),version=body.previous_version+1;
 await env.DB.prepare(`INSERT INTO application_fact_packs(batch_id,version,batch_revision,profile_hash,payload,payload_hash,request_key,request_hash,approved_at)
 SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM application_batches WHERE id=? AND user_id=? AND revision=? AND state='active')
 AND EXISTS(SELECT 1 FROM career_workspaces WHERE user_id=? AND revision=?)
 AND (SELECT COALESCE(MAX(version),0) FROM application_fact_packs WHERE batch_id=?)=? ON CONFLICT DO NOTHING`)
 .bind(row.id,version,row.revision,body.profile_hash,payload,await batchHash(JSON.parse(payload)),body.request_key,requestHash,new Date().toISOString(),row.id,userId,body.revision,userId,w.revision,row.id,body.previous_version).run();
 const result=await env.DB.prepare('SELECT request_hash FROM application_fact_packs WHERE batch_id=? AND request_key=?').bind(row.id,body.request_key).first();
 if(!result||result.request_hash!==requestHash)fail('Your account, workspace, batch or confirmation changed in another session. Recheck before continuing.');
}
