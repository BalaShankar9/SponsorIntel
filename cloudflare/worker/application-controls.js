import {applicationProfile,profileDigest,canonical} from './application-profile.js';
import {activeApplicationCampaign} from './application-campaigns.js';

const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const safeSQL="NOT EXISTS(SELECT 1 FROM application_eval_runs WHERE state IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM application_eval_steps WHERE state IN ('calling','failed'))";
export async function applicationControlSnapshot(env){
 const row=await env.DB.prepare('SELECT enabled,revision,reason,updated_at FROM application_eval_controls WHERE singleton=1').first();
 if(!row)fail('Application controls are unavailable.');
 return {...row,enabled:row.enabled===1};
}

// Reviewing changes a control only. Dispatch, daily receipts and reservations are untouched.
export async function reviewApplicationControl(env,input,actor,now=Date.now()){
 const keys='action,expected_campaign,expected_revision,fingerprint,reason,request_key';
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!==keys||
  !['resume','pause'].includes(input.action)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||
  typeof input.expected_campaign!=='string'||!input.expected_campaign||input.expected_campaign.length>100||
  (input.action==='resume'?(typeof input.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(input.fingerprint)):input.fingerprint!==null)||
  typeof input.reason!=='string'||input.reason.trim().length<80||input.reason.length>2000||
  typeof input.request_key!=='string'||!/^[-a-f0-9]{36}$/i.test(input.request_key)||typeof actor!=='string'||!actor)
  fail('Include the current comparison, control revision and evidence-based review reason.',400);
 const requestHash=await profileDigest(canonical({actor,input}));
 const replay=async()=>{
  const prior=await env.DB.prepare('SELECT revision,request_hash,action FROM application_eval_control_reviews WHERE request_key=?').bind(input.request_key).first();
  if(!prior)return null;
  if(prior.request_hash!==requestHash)fail('This request already records a different control review.');
  const current=await applicationControlSnapshot(env);
  return {revision:prior.revision,replayed:true,applied_enabled:prior.action==='resume',current_enabled:current.enabled,current_revision:current.revision};
 };
 const prior=await replay();if(prior)return prior;
 const control=await applicationControlSnapshot(env),campaign=await activeApplicationCampaign(env);
 if(control.revision!==input.expected_revision||campaign.id!==input.expected_campaign)fail('The comparison or controls changed. Refresh and review the current state.');
 const enable=input.action==='resume';
 if(control.enabled===enable)fail('The requested control state is already set. Refresh before reviewing another change.');
 let profile=campaign.profile;
 if(enable){
  const current=JSON.stringify(await applicationProfile(env));
  if(!profile||profile!==current||input.fingerprint!==await profileDigest(current))fail('The prepared source or model profile changed. Review a separate comparison before resuming.');
  if(!(await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first())?.enabled)fail('Business operations are paused. Preserve that hold.');
  if(!(await env.DB.prepare('SELECT '+safeSQL+' safe').first())?.safe)fail('An earlier run or model outcome is active or uncertain. Reconcile it before resuming.');
  const runs=(await env.DB.prepare('SELECT state,profile,case_ids FROM application_eval_runs WHERE campaign_id=?').bind(campaign.id).all()).results;
  const attempted=runs.filter(r=>JSON.parse(r.case_ids).length);
  if(attempted.some(r=>r.profile!==current||r.state!=='completed')||new Set(attempted.flatMap(r=>JSON.parse(r.case_ids))).size>=20)
   fail('This comparison needs attention or is complete. Its attempts cannot be reset.');
 }
 const revision=control.revision+1,stamp=new Date(now).toISOString(),reason=input.reason.trim();
 // Repeat mutable admission checks in the same D1 transaction as the review.
 const admission=`(?='pause' OR ((SELECT enabled FROM business_controls WHERE singleton=1)=1 AND ${safeSQL}
  AND NOT EXISTS(SELECT 1 FROM application_eval_runs WHERE campaign_id=? AND json_array_length(case_ids)>0 AND (state!='completed' OR profile!=?))
  AND (SELECT COUNT(DISTINCT j.value) FROM application_eval_runs r,json_each(r.case_ids) j WHERE r.campaign_id=? AND r.state='completed')<20))`;
 let result;
 try{result=await env.DB.batch([
  env.DB.prepare(`INSERT INTO application_eval_control_reviews(request_key,request_hash,revision,campaign_id,action,profile,reason,actor,created_at)
   SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT revision FROM application_eval_controls WHERE singleton=1)=?
   AND (SELECT enabled FROM application_eval_controls WHERE singleton=1)=?
   AND (SELECT campaign_id FROM application_eval_campaign_control WHERE singleton=1)=?
   AND EXISTS(SELECT 1 FROM application_eval_campaigns WHERE id=? AND profile IS ?) AND ${admission} RETURNING revision`)
   .bind(input.request_key,requestHash,revision,campaign.id,input.action,profile,reason,actor,stamp,control.revision,control.enabled?1:0,campaign.id,campaign.id,profile,input.action,campaign.id,profile,campaign.id),
  env.DB.prepare('UPDATE application_eval_controls SET enabled=?,revision=?,reason=?,actor=?,updated_at=? WHERE singleton=1 AND changes()=1 AND revision=?')
   .bind(enable?1:0,revision,reason,actor,stamp,control.revision),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT ?,'application-control-reviewed',?,? WHERE changes()=1")
   .bind(actor,campaign.id+':'+input.action+':'+revision,stamp)
 ]);}catch(error){const saved=await replay();if(saved)return saved;throw error;}
 if(!result[0].results?.length){const saved=await replay();if(saved)return saved;fail('The comparison, control or earlier outcome changed before saving. Refresh before proceeding.');}
 return {revision,replayed:false,applied_enabled:enable,current_enabled:enable,current_revision:revision};
}
