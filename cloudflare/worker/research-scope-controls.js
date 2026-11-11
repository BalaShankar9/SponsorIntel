import {scopeProfile,scopeSnapshot,preflightScope} from './research-scope.js';
import {referenceProgress} from './research-reference.js';
export async function reviewScope(env,actor,input){
 if(!input||!['prepare','resume','pause'].includes(input.action)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||!Number.isSafeInteger(input.expected_reference_revision)||input.expected_reference_revision<0||!/^[-a-f0-9]{36}$/i.test(input.request_id||'')||typeof input.reason!=='string'||input.reason.trim().length<30||input.reason.length>1200)throw Error('Provide a current revision and evidence-based review reason.');
 const payload=JSON.stringify({action:input.action,expected_revision:input.expected_revision,expected_reference_revision:input.expected_reference_revision,reason:input.reason.trim(),source_sha256:input.source_sha256||null});
 const prior=await env.DB.prepare('SELECT * FROM research_scope_reviews WHERE request_id=?').bind(input.request_id).first();
 if(prior){if(prior.payload!==payload||prior.actor!==actor)throw Error('This request already has different details.');return {revision:prior.revision,reused:true};}
 const control=await env.DB.prepare('SELECT * FROM research_scope_control WHERE singleton=1').first();
 if(!control||control.revision!==input.expected_revision)throw Error('Controls changed. Refresh before reviewing.');
 let profile=control.profile,prepared=control.prepared,enabled=0;
 if(input.action!=='pause'){
  const current=scopeProfile(env);if(current.source_sha256!==input.source_sha256)throw Error('The reviewed source identity changed.');
  if(await env.DB.prepare("SELECT id FROM agent_investigations WHERE state IN ('queued','running') UNION SELECT run_id FROM agent_research_steps WHERE state='calling' LIMIT 1").first())throw Error('Reconcile active or uncertain calls first.');
  if(input.action==='prepare'){
   if(prepared)throw Error('This campaign is already prepared and cannot be reset.');
   if(!['needs_attention','complete','awaiting_independent_review'].includes((await referenceProgress(env)).state))throw Error('Reconcile the original comparison first.');
   profile=JSON.stringify(current);prepared=1;
  }else{
   if(!prepared||profile!==JSON.stringify(current)||!['paused','ready'].includes((await scopeSnapshot(env)).state))throw Error('This campaign needs review and cannot resume.');
   const settings=await env.DB.prepare('SELECT enabled,research FROM business_controls WHERE singleton=1').first();if(!settings?.enabled||!settings.research)throw Error('The overall research control is paused.');
   enabled=1;
  }
  await preflightScope(env);
 }
 const at=new Date().toISOString(),revision=control.revision+1;
 const result=await env.DB.batch([
  env.DB.prepare("INSERT INTO research_scope_reviews(request_id,payload,revision,actor,created_at) SELECT ?,?,?,?,? WHERE (SELECT revision FROM research_scope_control WHERE singleton=1)=? AND (?='pause' OR ((SELECT revision FROM research_reference_control WHERE singleton=1)=? AND NOT EXISTS(SELECT 1 FROM agent_investigations WHERE state IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM agent_research_steps WHERE state='calling'))) RETURNING revision").bind(input.request_id,payload,revision,actor,at,control.revision,input.action,input.expected_reference_revision),
  env.DB.prepare('UPDATE research_scope_control SET prepared=?,enabled=?,profile=?,reason=?,revision=?,actor=?,updated_at=? WHERE singleton=1 AND revision=? AND EXISTS(SELECT 1 FROM research_scope_reviews WHERE request_id=? AND revision=?)').bind(prepared,enabled,profile,input.reason.trim(),revision,actor,at,control.revision,input.request_id,revision),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT ?,'research_scope_reviewed',?,? WHERE EXISTS(SELECT 1 FROM research_scope_reviews WHERE request_id=? AND revision=?)").bind(actor,input.action,at,input.request_id,revision),
 ]);
 if(!result[0].results?.length)throw Error('Controls changed. Refresh before reviewing.');
 return {revision,reused:false};
}
