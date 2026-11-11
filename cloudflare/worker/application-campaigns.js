import {applicationProfile,profileDigest,canonical} from './application-profile.js';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
export async function activeApplicationCampaign(env){return env.DB.prepare('SELECT c.* FROM application_eval_campaigns c JOIN application_eval_campaign_control a ON a.campaign_id=c.id WHERE a.singleton=1').first();}
const unsafeSQL="NOT EXISTS(SELECT 1 FROM application_eval_runs WHERE state IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM application_eval_steps WHERE state IN ('calling','failed'))";
export async function applicationCampaignProposal(env){
 const active=await activeApplicationCampaign(env),profile=await applicationProfile(env),serial=JSON.stringify(profile);
 const paused=!(await env.DB.prepare('SELECT enabled FROM application_eval_controls WHERE singleton=1').first())?.enabled;
 const safe=await env.DB.prepare('SELECT '+unsafeSQL+' safe').first();
 const existing=await env.DB.prepare('SELECT id FROM application_eval_campaigns WHERE profile=?').bind(serial).first();
 return {active:{id:active.id,created_at:active.created_at,reason:active.reason,profile:active.profile?JSON.parse(active.profile):null},proposal:{profile,fingerprint:await profileDigest(serial),can_prepare:paused&&!!safe?.safe&&!existing,reason:!paused?'Pause application tests before preparing a separate comparison.':!safe?.safe?'An active or uncertain earlier model result needs reconciliation first.':existing?'This exact comparison version is already retained; it cannot be restarted.':'The separate comparison can be prepared. It will remain paused.',change:'Requests a bounded JSON schema from the candidate reviewer; the current writer, current reviewer and semantic validation stay unchanged. The source identity is independent of bundler names. Provider compliance and writing quality are not yet proven.'}};
}
export async function prepareApplicationCampaign(env,input,actor,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='expected_campaign,fingerprint,reason,request_key'||typeof actor!=='string'||!actor||typeof input.reason!=='string'||input.reason.trim().length<80||input.reason.length>2000||!/^[a-f0-9]{64}$/.test(input.fingerprint)||typeof input.expected_campaign!=='string'||input.expected_campaign.length>100||typeof input.request_key!=='string'||!/^[\w-]{16,100}$/.test(input.request_key))fail('Include the reviewed change, current version and request reference.',400);
 const requestHash=await profileDigest(canonical({actor,input}));
 const replay=async()=>{const row=await env.DB.prepare('SELECT id,request_hash FROM application_eval_campaigns WHERE request_key=?').bind(input.request_key).first();if(!row)return null;if(row.request_hash!==requestHash)fail('This request already records a different review.');return {id:row.id,paused:!(await env.DB.prepare('SELECT enabled FROM application_eval_controls WHERE singleton=1').first())?.enabled,prepared_paused:true,replayed:true};};
 const prior=await replay();if(prior)return prior;
 const proposal=await applicationCampaignProposal(env);
 if(proposal.active.id!==input.expected_campaign||proposal.proposal.fingerprint!==input.fingerprint||!proposal.proposal.can_prepare){const retained=await replay();if(retained)return retained;fail('The comparison or control changed. Refresh and review it before preparing another version.');}
 const profile=JSON.stringify(proposal.proposal.profile),id='comparison-'+input.fingerprint.slice(0,24),stamp=new Date(now).toISOString();
 let saved;try{saved=await env.DB.batch([
  env.DB.prepare(`INSERT INTO application_eval_campaigns(id,profile,created_at,actor,reason,request_key,request_hash)
   SELECT ?,?,?,?,?,?,? WHERE (SELECT campaign_id FROM application_eval_campaign_control WHERE singleton=1)=?
   AND (SELECT enabled FROM application_eval_controls WHERE singleton=1)=0 AND ${unsafeSQL} RETURNING id`).bind(id,profile,stamp,actor,input.reason.trim(),input.request_key,requestHash,input.expected_campaign),
  env.DB.prepare('UPDATE application_eval_campaign_control SET campaign_id=? WHERE singleton=1 AND changes()=1 AND campaign_id=? AND EXISTS(SELECT 1 FROM application_eval_campaigns WHERE id=? AND request_key=?)').bind(id,input.expected_campaign,id,input.request_key),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT actor,'application-campaign-prepared',id,created_at FROM application_eval_campaigns WHERE changes()=1 AND id=? AND request_key=?").bind(id,input.request_key)
 ]);}catch(error){const retained=await replay();if(retained)return retained;if(await env.DB.prepare('SELECT id FROM application_eval_campaigns WHERE profile=?').bind(profile).first())fail('This comparison version was already prepared. Refresh to inspect it.');throw error;}
 if(!saved[0].results?.length){const retained=await replay();if(retained)return retained;fail('The pause, active comparison or earlier run changed before saving. Refresh before proceeding.');}
 return {id,paused:true,prepared_paused:true,replayed:false};
}
