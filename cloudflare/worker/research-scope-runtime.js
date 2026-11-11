import {scopeProfile,scopeSnapshot,scopeEvidence,SCOPE_POLICY} from './research-scope.js';
import {proposalRequests,resolveExtraction,evaluateReview} from './research-scope-contract.js';
import {callResearchModel,researchResponseFailure} from './research-model.js';
import {scheduleBusinessResearch as legacySchedule} from './business-operations.js';
const iso=()=>new Date().toISOString();
export async function failScope(env,id){
 await env.DB.prepare("UPDATE agent_investigations SET state='failed',finished_at=?,error='Scope comparison stopped. Preserve original call receipts and reservations; no automatic retry or public change.' WHERE id=? AND scope_profile IS NOT NULL AND state IN ('queued','running')").bind(iso(),id).run();
 return {state:'failed'};
}
export async function scopeRun(env,id){
 const run=await env.DB.prepare('SELECT * FROM agent_investigations WHERE id=?').bind(id).first();
 if(!run||run.policy!==SCOPE_POLICY||run.scope_profile!==JSON.stringify(scopeProfile(env)))throw Error('Scope run identity changed.');
 return run;
}
export async function admitScope(env,run){
 const settings=await env.DB.prepare('SELECT enabled,research FROM business_controls WHERE singleton=1').first();
 const control=await env.DB.prepare('SELECT * FROM research_scope_control WHERE singleton=1').first();
 if(run.state!=='running'||Date.now()-Date.parse(run.created_at)>3600000||run.created_at.slice(0,10)!==iso().slice(0,10)||!settings?.enabled||!settings.research||!control?.enabled||!control.prepared||control.profile!==run.scope_profile)throw Error('Scope execution paused, expired or changed.');
}
// Reservation precedes I/O. Prior calling/failed/late receipts never trigger I/O.
export async function scopeModelStep(env,id,name,caseIndex,role,extraction=null){
 const run=await scopeRun(env,id);await admitScope(env,run);
 const evidence=await scopeEvidence(env,run.reference_batch),source=evidence[caseIndex];
 if(!source||!['investigator','reviewer'].includes(role)||name!==(role==='investigator'?'extract-':'critic-')+caseIndex)throw Error('Unknown scope step.');
 if(role==='reviewer'){
  const saved=await env.DB.prepare("SELECT output FROM agent_research_steps WHERE run_id=? AND name=? AND state='completed'").bind(id,'extract-'+caseIndex).first();
  if(!saved||JSON.stringify(JSON.parse(saved.output).value)!==JSON.stringify(extraction))throw Error('Review requires the exact completed extraction.');
 }
 const request=proposalRequests(source,extraction);
 if(request.role!==role)throw Error('Scope request role changed.');
 const validate=value=>role==='investigator'?resolveExtraction(value,source):({review:value,outcome:evaluateReview(value,extraction,source)});
 const prior=await env.DB.prepare('SELECT state,output FROM agent_research_steps WHERE run_id=? AND name=?').bind(id,name).first();
 if(prior){if(prior.state==='completed')return JSON.parse(prior.output).value;throw Error('Existing call outcome prevents a retry.');}
 const day=iso().slice(0,10),at=iso();
 const reserved=await env.DB.batch([
  env.DB.prepare("UPDATE agent_research_budget SET calls=calls+1 WHERE day=? AND calls<32 AND EXISTS(SELECT 1 FROM agent_investigations WHERE id=? AND state='running' AND calls<4) AND NOT EXISTS(SELECT 1 FROM agent_research_steps WHERE run_id=? AND name=?) RETURNING day").bind(day,id,id,name),
  env.DB.prepare("UPDATE agent_investigations SET calls=calls+1 WHERE id=? AND state='running' AND calls<4 AND changes()=1").bind(id),
  env.DB.prepare("INSERT INTO agent_research_steps(run_id,name,role,state,created_at) SELECT ?,?,?,'calling',? WHERE changes()=1 RETURNING name").bind(id,name,role,at),
 ]);
 if(!reserved[2].results?.length)throw Error('The shared allowance or call reservation is unavailable.');
 const started=Date.now();let output,usage=null,failed=false;
 try{
  const response=await callResearchModel(env,JSON.parse(run.models)[role],request.parameters.messages[0].content,JSON.parse(request.parameters.messages[1].content),request.parameters.response_format);
  usage=response.usage;output={value:validate(response.value),completion:response.completion};
 }catch(error){failed=true;const completion=researchResponseFailure(error);usage=completion?.usage||usage;output={failure:'The response did not complete or validate. No retry is permitted.',completion};}
 // A late answer is evidence, not authority to revive a failed investigation.
 const current=await env.DB.prepare('SELECT state FROM agent_investigations WHERE id=?').bind(id).first();
 const late=current?.state!=='running'||Date.now()-started>=170000||iso().slice(0,10)!==day;
 const state=late?(failed?'late_failed':'late_completed'):(failed?'failed':'completed');
 const receipt=await env.DB.prepare("UPDATE agent_research_steps SET state=CASE WHEN EXISTS(SELECT 1 FROM agent_investigations WHERE id=? AND state='running') THEN ? ELSE ? END,output=?,usage=?,duration_ms=? WHERE run_id=? AND name=? AND state='calling' RETURNING state")
  .bind(id,state,failed?'late_failed':'late_completed',JSON.stringify(output),usage?JSON.stringify(usage):null,Date.now()-started,id,name).first();
 if(!receipt||receipt.state!=='completed'){await failScope(env,id);throw Error('The scope response was rejected or arrived after execution ended.');}
 return output.value;
}
export async function scheduleScopeResearch(env,now=Date.now()){
 const control=await env.DB.prepare('SELECT prepared FROM research_scope_control WHERE singleton=1').first();
 if(!control?.prepared)return legacySchedule(env,now);
 const settings=await env.DB.prepare('SELECT enabled,research FROM business_controls WHERE singleton=1').first();
 if(!settings?.enabled||!settings.research)return {state:'paused'};
 const day=new Date(now).toISOString().slice(0,10);
 if(day!==iso().slice(0,10))throw Error('Scope dispatch cannot use a fabricated day.');
 const reserved=await env.DB.prepare("INSERT INTO business_daily(day,research_state) VALUES(?,'reserved') ON CONFLICT DO NOTHING RETURNING day").bind(day).first();
 if(!reserved)return env.DB.prepare('SELECT research_state state,research_id,detail FROM business_daily WHERE day=?').bind(day).first();
 let id=null;
 try{
  const progress=await scopeSnapshot(env);if(progress.state!=='ready'||!progress.next_batch)throw Error('Scope comparison is held.');
  const profile=scopeProfile(env),evidence=await scopeEvidence(env,progress.next_batch);
  id='research-'+crypto.randomUUID();
  await env.DB.prepare('INSERT INTO agent_research_budget(day,runs,calls) VALUES(?,0,0) ON CONFLICT DO NOTHING').bind(day).run();
  const batch=await env.DB.batch([
   env.DB.prepare("INSERT INTO agent_investigations(id,kind,state,actor,created_at,policy,models,context,calls,evaluation_suite,reference_batch,scope_profile) SELECT ?,'evaluation','queued','scheduled-business',?,?,?,?,0,'end_to_end',?,? WHERE (SELECT runs FROM agent_research_budget WHERE day=?)<4 AND (SELECT calls FROM agent_research_budget WHERE day=?)<=28 AND NOT EXISTS(SELECT 1 FROM agent_investigations WHERE state IN ('queued','running')) RETURNING id").bind(id,iso(),SCOPE_POLICY,JSON.stringify(profile.models),JSON.stringify({evidence}),progress.next_batch,JSON.stringify(profile),day,day),
   env.DB.prepare('UPDATE agent_research_budget SET runs=runs+1 WHERE day=? AND changes()=1').bind(day),
   env.DB.prepare("UPDATE business_daily SET research_state='started',research_id=?,detail='Separate scope comparison. Historical development evidence only.' WHERE day=? AND EXISTS(SELECT 1 FROM agent_investigations WHERE id=?)").bind(id,day,id),
  ]);
  if(!batch[0].results?.length){id=null;throw Error('Scope reservation unavailable.');}
  try{await env.RESEARCH_WORKFLOW.create({id,params:{runId:id,scope:true}});}catch{return {state:'started',id,uncertain:true};}
  return {state:'started',id};
 }catch{
  // Never reinterpret an uncertain workflow creation as permission to replace it.
  if(id&&await env.DB.prepare('SELECT id FROM agent_investigations WHERE id=?').bind(id).first())return {state:'started',id,uncertain:true};
  await env.DB.prepare("UPDATE business_daily SET research_state='held',detail='Scope comparison unavailable, paused or needs review. No automatic retry today.' WHERE day=? AND research_state='reserved'").bind(day).run();
  return {state:'held'};
 }
}
