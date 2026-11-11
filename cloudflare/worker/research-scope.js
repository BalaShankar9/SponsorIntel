import {REFERENCE_SET} from './reference-manifest.js';
import {researchModels} from './research-model.js';
import {prepareCase} from './research-scope-contract.js';
import source from './research-scope-source.json' with {type:'json'};
export const SCOPE_DATASET='real-adverts-2026-10-08-scope-v3';
export const SCOPE_POLICY='investigator-v5-subject-scope';
export const scopeBatches=Array.from({length:25},(_,i)=>({id:SCOPE_DATASET+'-'+String(i+1).padStart(2,'0'),job_ids:REFERENCE_SET.cases.slice(i*2,i*2+2).map(c=>c.id)}));
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function scopeProfile(env){
 const models=researchModels(env);
 if(models.investigator.provider!=='cloudflare'||models.investigator.model!=='@cf/zai-org/glm-4.7-flash'||models.reviewer.provider!=='cloudflare'||models.reviewer.model!=='@cf/meta/llama-3.3-70b-instruct-fp8-fast')throw Error('The reviewed scope model configuration changed.');
 return {version:1,dataset:SCOPE_DATASET,policy:SCOPE_POLICY,source_sha256:source.sha256,models,max_tokens:8192,temperature:0.1,thinking:true,analyst_format:'json_object',reviewer_format:'json_schema',revision_limit:0,batches:25,cases:50,calls_per_batch:4};
}
export async function scopeEvidence(env,batchId){
 const batch=scopeBatches.find(b=>b.id===batchId);if(!batch)throw Error('Unknown scope batch.');
 const rows=await env.DB.prepare('SELECT job_id,record FROM agent_reference_cases WHERE dataset=? AND job_id IN (?,?)').bind(REFERENCE_SET.id,...batch.job_ids).all();
 const result=[];
 for(const id of batch.job_ids){
  const row=rows.results.find(r=>r.job_id===id),expected=REFERENCE_SET.cases.find(c=>c.id===id);
  if(!row||await sha(row.record)!==expected.record_hash)throw Error('The frozen record changed or is missing.');
  const record=JSON.parse(row.record);if(record.id!==id||await sha(record.description)!==expected.content_hash)throw Error('The frozen advert changed.');
  result.push(prepareCase(record,REFERENCE_SET.snapshot_at));
 }
 return result;
}
export async function preflightScope(env){for(const batch of scopeBatches)await scopeEvidence(env,batch.id);}
export function scoreScope(cases,batchId){
 const batch=scopeBatches.find(b=>b.id===batchId);if(!batch||cases.length!==2||batch.job_ids.some(id=>cases.filter(c=>c.source.job_id===id).length!==1))throw Error('Incomplete scope results.');
 const items=cases.map(c=>{const expected=REFERENCE_SET.cases.find(x=>x.id===c.source.job_id).accepted_labels,actual=c.extraction.provisional_label??'unresolved';return {id:c.source.job_id,actual,expected:expected.join(' or '),correct:expected.length===1?actual===expected[0]:null,ambiguous:expected.length!==1};});
 const single=items.filter(c=>!c.ambiguous);
 return {dataset:SCOPE_DATASET,batch:batchId,synthetic:false,provisional:true,human_adjudicated:false,cases:items,correct:single.filter(c=>c.correct).length,total:single.length,ambiguous_cases:items.length-single.length,
 dangerous_false_positives:single.filter(c=>['not_stated','unavailable'].includes(c.expected)&&['offered','conditional'].includes(c.actual)).length,
 unsupported_refusals:single.filter(c=>c.expected==='not_stated'&&c.actual==='unavailable').length,
 limitation:'Same frozen development cohort, new 25 paired batches. Agent-assisted provisional expectations only. Scores cannot be pooled with earlier campaigns; independent adjudication and held-out validation are required.'};
}
export async function scopeSnapshot(env){
 const control=await env.DB.prepare('SELECT * FROM research_scope_control WHERE singleton=1').first();
 let profile=null;try{profile=scopeProfile(env);}catch{}
 const [settings,rows,budget,uncertain,legacy]=await Promise.all([
  env.DB.prepare('SELECT enabled,research FROM business_controls WHERE singleton=1').first(),
  env.DB.prepare("SELECT id,reference_batch,state,scope_profile,report,calls FROM agent_investigations WHERE scope_profile IS NOT NULL ORDER BY created_at").all(),
  env.DB.prepare('SELECT runs,calls FROM agent_research_budget WHERE day=?').bind(new Date().toISOString().slice(0,10)).first(),
  env.DB.prepare("SELECT COUNT(*) n FROM agent_research_steps WHERE state='calling'").first(),
  env.DB.prepare('SELECT revision FROM research_reference_control WHERE singleton=1').first(),
 ]);
 const batches=scopeBatches.map(b=>{const r=rows.results.find(r=>r.reference_batch===b.id);let result=null;try{result=JSON.parse(r?.report||'null');}catch{}
  let score=null;try{if(r?.state==='review'&&r.scope_profile===JSON.stringify(profile)&&result?.scope_cases?.every(c=>c.outcome.contract_complete))score=scoreScope(result.scope_cases,b.id);}catch{}
  return {id:b.id,run_id:r?.id||null,state:!r?'pending':score?'reviewed':['queued','running'].includes(r.state)?'running':'needs_attention',calls:r?.calls||0,score,disputed_items:result?.quality?.unsupported_items||0,accepted:result?.quality?.accepted??false};});
 const invalid=!!control?.prepared&&control.profile!==JSON.stringify(profile);
 const state=!control?.prepared?'not_prepared':invalid||uncertain?.n||batches.some(b=>b.state==='needs_attention'||b.score?.dangerous_false_positives||b.score?.unsupported_refusals||b.disputed_items||(b.state==='reviewed'&&!b.accepted))?'needs_attention':batches.some(b=>b.state==='running')?'running':batches.every(b=>b.state==='reviewed')?'awaiting_independent_review':!control.enabled||!settings?.enabled||!settings.research?'paused':'ready';
 return {dataset:SCOPE_DATASET,reference_revision:legacy?.revision??0,state,available:!!profile,source_sha256:profile?.source_sha256||null,control:{prepared:!!control?.prepared,enabled:!!control?.enabled,revision:control?.revision||0,reason:control?.reason||'',updated_at:control?.updated_at||null},
  next_batch:state==='ready'?batches.find(b=>b.state==='pending')?.id:null,evaluated_adverts:batches.filter(b=>b.state==='reviewed').length*2,total_adverts:50,batches,
  budget:{runs:budget?.runs||0,calls:budget?.calls||0},uncertain_calls:uncertain?.n||0,
  dangerous_false_positives:batches.reduce((n,b)=>n+(b.score?.dangerous_false_positives||0),0),unsupported_refusals:batches.reduce((n,b)=>n+(b.score?.unsupported_refusals||0),0),disputed_items:batches.reduce((n,b)=>n+b.disputed_items,0)};
}
