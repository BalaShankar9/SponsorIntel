import {referenceSet,candidateReferenceSet,referenceEvidence,referenceProgress} from './research-reference.js';
import {candidateReferenceProfile,RESEARCH_CANDIDATE_DATASET} from './research-candidate.js';
import {researchModels} from './research-model.js';

export async function referenceComparisonSnapshot(env) {
  const control=await env.DB.prepare('SELECT * FROM research_reference_control WHERE singleton=1').first();
  let available=!!control,source_sha256=null;try{source_sha256=candidateReferenceProfile(researchModels(env)).source_sha256;}catch{available=false;}
  return {control:{campaign:control?.campaign||referenceSet.id,enabled:!!control?.enabled,revision:control?.revision||0,reason:control?.reason||'',updated_at:control?.updated_at||null},available,source_sha256,
    original:await referenceProgress(env,referenceSet),candidate:await referenceProgress(env,candidateReferenceSet)};
}

export async function reviewReferenceComparison(env,actor,input) {
  if(!input||!['prepare','resume','pause'].includes(input.action)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||
    typeof input.request_id!=='string'||!/^[-a-f0-9]{36}$/i.test(input.request_id)||typeof input.reason!=='string'||input.reason.trim().length<30||input.reason.length>1200)
    throw Error('Provide a comparison action, current revision and evidence-based review reason.');
  const payload=JSON.stringify({action:input.action,expected_revision:input.expected_revision,reason:input.reason.trim(),source_sha256:input.source_sha256||null});
  const prior=await env.DB.prepare('SELECT payload,actor,revision FROM research_reference_reviews WHERE request_id=?').bind(input.request_id).first();
  if(prior){if(prior.payload!==payload||prior.actor!==actor)throw Error('This review request was already used with different details.');return {revision:prior.revision,reused:true};}
  const control=await env.DB.prepare('SELECT * FROM research_reference_control WHERE singleton=1').first();
  if(!control)throw Error('Reference comparison controls are unavailable.');
  if(control.revision!==input.expected_revision)throw Error('The comparison changed. Refresh and review its current state.');
  if(input.action!=='pause'&&await env.DB.prepare("SELECT id FROM agent_investigations WHERE state IN ('queued','running') LIMIT 1").first())throw Error('An investigation is still active. Reconcile it before changing the comparison.');
  let profile=control.profile,enabled=0;
  if(input.action!=='pause'&&input.source_sha256!==candidateReferenceProfile(researchModels(env)).source_sha256)throw Error('The proposed comparison source changed. Refresh and review the current proposal.');
  if(input.action==='prepare') {
    if(control.campaign===RESEARCH_CANDIDATE_DATASET)throw Error('The separate comparison is already prepared. Its attempts cannot be reset.');
    const original=await referenceProgress(env,referenceSet);
    if(!['needs_attention','complete'].includes(original.state))throw Error('Retain and reconcile the original comparison before preparing a follow-up.');
    profile=JSON.stringify(candidateReferenceProfile(researchModels(env)));
    for(const batch of candidateReferenceSet.batches)await referenceEvidence(env,batch.id);
  } else if(input.action==='resume') {
    if(control.campaign!==RESEARCH_CANDIDATE_DATASET||profile!==JSON.stringify(candidateReferenceProfile(researchModels(env))))throw Error('Prepare and review the exact current comparison before resuming.');
    const progress=await referenceProgress(env,candidateReferenceSet);
    if(!['paused','ready'].includes(progress.state))throw Error('This comparison is complete, unavailable or needs attention. Its attempts cannot be reset.');
    for(const batch of candidateReferenceSet.batches)await referenceEvidence(env,batch.id);
    enabled=1;
  }
  const campaign=input.action==='prepare'?RESEARCH_CANDIDATE_DATASET:control.campaign,at=new Date().toISOString(),revision=control.revision+1;
  const statements=[
    env.DB.prepare("INSERT INTO research_reference_reviews(request_id,payload,revision,actor,created_at) SELECT ?,?,?,?,? WHERE (SELECT revision FROM research_reference_control WHERE singleton=1)=? AND (?='pause' OR NOT EXISTS(SELECT 1 FROM agent_investigations WHERE state IN ('queued','running'))) RETURNING revision").bind(input.request_id,payload,revision,actor,at,control.revision,input.action),
    env.DB.prepare('UPDATE research_reference_control SET campaign=?,enabled=?,profile=?,reason=?,revision=?,actor=?,updated_at=? WHERE singleton=1 AND revision=? AND EXISTS(SELECT 1 FROM research_reference_reviews WHERE request_id=? AND revision=?)').bind(campaign,enabled,profile,input.reason.trim(),revision,actor,at,control.revision,input.request_id,revision),
    env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT ?,'research_comparison_reviewed',?,? WHERE EXISTS(SELECT 1 FROM research_reference_reviews WHERE request_id=? AND revision=?)").bind(actor,campaign,at,input.request_id,revision),
  ];
  const result=await env.DB.batch(statements);
  if(!result[0].results?.length)throw Error('The comparison changed. Refresh and review its current state.');
  return {revision,reused:false};
}
