import fixture from '../tests/fixtures/application-development-20.json' with {type:'json'};
import {digest} from './auth.js';
import {APPLICATION_ASSESSMENT_POLICY,APPLICATION_RUBRIC,ASSESSMENT_LIMITATION} from '../shared/application-assessment.js';

const iso=n=>new Date(n).toISOString(),normal=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const fields=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('Unexpected assessment fields.');};
const text=(s,min,max)=>{if(typeof s!=='string'||s.trim().length<min||s.length>max)fail('Assessment text is missing or too long.');return s.trim();};
const criteria=APPLICATION_RUBRIC.map(x=>x.id);
const selectTarget=`SELECT s.*,r.profile,r.state run_state,r.finished_at run_finished_at,r.case_ids,
 w.output writer_output,w.state writer_state,w.finished_at writer_finished_at
 FROM application_eval_steps s JOIN application_eval_runs r ON r.id=s.run_id
 LEFT JOIN application_eval_steps w ON w.run_id=s.run_id AND w.case_id=s.case_id AND w.stage='write'`;
const publicAssessment=row=>row?{id:row.id,revision:row.revision,output_fingerprint:row.output_fingerprint,created_at:row.created_at,content:JSON.parse(row.content),method:'owner_recorded'}:null;

async function targetFromRow(row,fixtureHash){
 const c=fixture.cases.find(c=>c.id===row?.case_id);
 if(!row||!c||!['completed','failed'].includes(row.run_state)||!row.run_finished_at||row.state!=='completed'||!row.finished_at||!JSON.parse(row.case_ids).includes(row.case_id))fail('Only completed outputs from a finished evaluation can be assessed.',409);
 let profile,output,draft;try{profile=JSON.parse(row.profile);output=JSON.parse(row.output);draft=JSON.parse(row.writer_output);}catch{fail('The retained output or profile could not be verified.',409);}
 if(row.writer_state!=='completed'||!row.writer_finished_at||typeof draft?.text!=='string')fail('The shared original draft could not be verified.',409);
 if(profile.fixture_hash!==fixtureHash||typeof output?.text!=='string'||!output.text.trim()||output.text.length>100000)fail('The original source and output could not be verified. Preserve the existing records.',409);
 const fingerprint=await digest(canonical({run:row.run_id,case:c,stage:row.stage,finished_at:row.finished_at,writer_finished_at:row.writer_finished_at,profile,draft,output}));
 return {row,c,output,fingerprint,profile_fingerprint:await digest(row.profile),profile};
}
export async function applicationAssessmentTarget(env,runId,caseId,stage){
 const row=await env.DB.prepare(selectTarget+' WHERE s.run_id=? AND s.case_id=? AND s.stage=?').bind(runId,caseId,stage).first();
 return targetFromRow(row,await digest(canonical(fixture)));
}
function assessmentContent(input,target){
 fields(input.ratings,criteria);
 if(criteria.some(k=>!['acceptable','needs_work','not_assessed'].includes(input.ratings[k]))||criteria.every(k=>input.ratings[k]==='not_assessed'))fail('Assess at least one criterion, leaving unknown areas explicitly unassessed.');
 const rationale=text(input.rationale,30,2000);
 if(!Array.isArray(input.evidence)||input.evidence.length<2||input.evidence.length>6)fail('Quote the draft and its CV or advert source.');
 const sources={output:target.output.text,cv:target.c.profile.cv,advert:target.c.application.description};
 const evidence=input.evidence.map(item=>{
  fields(item,['source','quote']);
  if(!Object.hasOwn(sources,item.source))fail('Use the retained draft, fictional CV or fictional advert.');
  const quote=text(item.quote,10,1500),haystack=normal(sources[item.source]),needle=normal(quote),offset=haystack.indexOf(needle);
  if(offset<0)fail('A quoted passage does not occur in the selected retained source.');
  return {source:item.source,quote,normalized_offset:offset};
 });
 if(!evidence.some(x=>x.source==='output')||!evidence.some(x=>x.source!=='output'))fail('Quote both the draft and a source; the advert is not evidence of candidate experience.');
 if(new Set(evidence.map(x=>x.source+':'+normal(x.quote))).size!==evidence.length)fail('Use distinct evidence passages.');
 const ratings=Object.fromEntries(criteria.map(k=>[k,input.ratings[k]]));
 const outcome=Object.values(ratings).includes('needs_work')?'needs_work':Object.values(ratings).includes('not_assessed')?'incomplete':'acceptable';
 return {policy:APPLICATION_ASSESSMENT_POLICY,ratings,rationale,evidence,outcome,method:'owner_recorded',independently_verified:false,automatic_promotion:false};
}
async function replay(env,key,hash){
 const row=await env.DB.prepare('SELECT * FROM application_assessments WHERE request_key=?').bind(key).first();
 if(!row)return null;if(row.request_hash!==hash)fail('This request already refers to a different assessment.',409);
 return {assessment:publicAssessment(row),replayed:true};
}
export async function recordApplicationAssessment(env,input,actor,now=Date.now()){
 fields(input,['run_id','case_id','stage','fingerprint','revision','ratings','rationale','evidence','request_key']);
 const runId=text(input.run_id,1,100),caseId=text(input.case_id,1,80),requestKey=text(input.request_key,16,100);
 if(!['write','baseline','candidate'].includes(input.stage)||!/^[a-f0-9]{64}$/.test(input.fingerprint)||!Number.isSafeInteger(input.revision)||input.revision<0)fail('Refresh the exact output before assessing it.');
 text(actor,1,160);
 const requestHash=await digest(canonical({actor,input})),prior=await replay(env,requestKey,requestHash);if(prior)return prior;
 const target=await applicationAssessmentTarget(env,runId,caseId,input.stage);
 if(target.fingerprint!==input.fingerprint)fail('The retained output changed. Refresh it before saving an assessment.',409);
 const content=assessmentContent(input,target),id=crypto.randomUUID(),stamp=iso(now),row=target.row;
 const statements=[
  env.DB.prepare(`INSERT INTO application_assessments
   SELECT ?,s.run_id,s.case_id,s.stage,?,?,?,?,?,?,?,? FROM application_eval_steps s JOIN application_eval_runs r ON r.id=s.run_id
   WHERE s.run_id=? AND s.case_id=? AND s.stage=? AND s.state='completed' AND s.output IS ? AND s.finished_at IS ?
   AND r.profile IS ? AND r.state IS ? AND r.finished_at IS ? AND r.case_ids IS ?
   AND EXISTS(SELECT 1 FROM application_eval_steps w WHERE w.run_id=s.run_id AND w.case_id=s.case_id AND w.stage='write' AND w.state='completed' AND w.output IS ? AND w.finished_at IS ?)
   AND COALESCE((SELECT MAX(a.revision) FROM application_assessments a WHERE a.run_id=s.run_id AND a.case_id=s.case_id AND a.stage=s.stage),0)=? RETURNING id`)
   .bind(id,input.revision+1,target.fingerprint,target.profile_fingerprint,JSON.stringify(content),actor,stamp,requestKey,requestHash,runId,caseId,input.stage,row.output,row.finished_at,row.profile,row.run_state,row.run_finished_at,row.case_ids,row.writer_output,row.writer_finished_at,input.revision),
  env.DB.prepare("INSERT INTO admin_audit(actor,action,target,created_at) SELECT actor,'application-assessment',id,created_at FROM application_assessments WHERE id=?").bind(id),
 ];
 let saved;try{saved=await env.DB.batch(statements);}catch(error){const existing=await replay(env,requestKey,requestHash);if(existing)return existing;throw error;}
 if(!saved[0].results?.length){const existing=await replay(env,requestKey,requestHash);if(existing)return existing;fail('This assessment or its source changed in another session. Refresh before saving.',409);}
 return {assessment:publicAssessment(await env.DB.prepare('SELECT * FROM application_assessments WHERE id=?').bind(id).first()),replayed:false};
}
export async function applicationAssessmentDetails(env,caseId){
 const rows=(await env.DB.prepare(selectTarget+' WHERE s.case_id=? ORDER BY s.created_at DESC,s.run_id DESC,s.stage LIMIT 30').bind(caseId).all()).results;
 const history=(await env.DB.prepare('SELECT * FROM (SELECT a.*,ROW_NUMBER() OVER(PARTITION BY run_id,stage ORDER BY revision DESC) position FROM application_assessments a WHERE case_id=?) WHERE position<=10 ORDER BY created_at DESC,revision DESC LIMIT 300').bind(caseId).all()).results;
 const fixtureHash=await digest(canonical(fixture)),steps=[];
 for(const row of rows){
  let target=null,unavailable=null;try{target=await targetFromRow(row,fixtureHash);}catch(error){if(error.status!==409)throw error;unavailable=error.message;}
  const revisions=history.filter(a=>a.run_id===row.run_id&&a.stage===row.stage).sort((a,b)=>b.revision-a.revision);
  const latest=revisions[0];
  steps.push({run_id:row.run_id,stage:row.stage,state:row.state,output:row.output?JSON.parse(row.output):null,error:row.error,created_at:row.created_at,
   assessment_target:target?{fingerprint:target.fingerprint,revision:latest?.revision||0}:null,assessment_unavailable:unavailable,
   assessment:publicAssessment(latest),assessment_current:!!target&&latest?.output_fingerprint===target.fingerprint,
   assessment_history:revisions.slice(0,10).map(publicAssessment)});
 }
 return {steps,rubric:APPLICATION_RUBRIC,assessment_limitation:ASSESSMENT_LIMITATION};
}
export async function applicationAssessmentSummary(env){
 const rows=(await env.DB.prepare(selectTarget+" WHERE s.state='completed' AND r.state IN ('completed','failed') ORDER BY s.created_at DESC LIMIT 121").all()).results;
 const latest=(await env.DB.prepare('SELECT a.* FROM application_assessments a WHERE a.revision=(SELECT MAX(b.revision) FROM application_assessments b WHERE b.run_id=a.run_id AND b.case_id=a.case_id AND b.stage=a.stage) ORDER BY a.created_at DESC LIMIT 121').all()).results;
 const fixtureHash=await digest(canonical(fixture)),groups=new Map(),pairs=new Map();let assessable=0,assessed=0,needsWork=0,incomplete=0,stale=0;
 for(const row of rows.slice(0,120)){
  let target;try{target=await targetFromRow(row,fixtureHash);}catch(error){if(error.status!==409)throw error;continue;}
  assessable++;
  const assessment=latest.find(a=>a.run_id===row.run_id&&a.case_id===row.case_id&&a.stage===row.stage);
  if(!assessment)continue;
  if(assessment.output_fingerprint!==target.fingerprint){stale++;continue;}
  const content=JSON.parse(assessment.content);assessed++;
  if(content.outcome==='needs_work')needsWork++;
  if(Object.values(content.ratings).includes('not_assessed'))incomplete++;
  if(!['baseline','candidate'].includes(row.stage)||row.run_state!=='completed')continue;
  const key=row.run_id+':'+row.case_id,pair=pairs.get(key)||{profile:target.profile,profile_fingerprint:target.profile_fingerprint};
  pair[row.stage]={...content,actor:assessment.actor};pairs.set(key,pair);
 }
 for(const pair of pairs.values()){
  if(!pair.baseline||!pair.candidate||pair.baseline.actor!==pair.candidate.actor||[...Object.values(pair.baseline.ratings),...Object.values(pair.candidate.ratings)].includes('not_assessed'))continue;
  const key=pair.profile_fingerprint,group=groups.get(key)||{profile_fingerprint:key,writer:pair.profile.writer,reviewer:pair.profile.reviewer,policy:pair.profile.policy,paired_cases:0,both_acceptable:0,candidate_only_acceptable:0,baseline_only_acceptable:0,both_need_work:0};
  group.paired_cases++;
  const baseline=pair.baseline.outcome==='acceptable',candidate=pair.candidate.outcome==='acceptable';
  group[baseline&&candidate?'both_acceptable':baseline?'baseline_only_acceptable':candidate?'candidate_only_acceptable':'both_need_work']++;
  groups.set(key,group);
 }
 return {assessable_outputs:assessable,assessed_outputs:assessed,unassessed_outputs:assessable-assessed,needs_work:needsWork,incomplete,stale,groups:[...groups.values()],limited:rows.length>120||latest.length>120,automatic_promotion:false,limitation:ASSESSMENT_LIMITATION};
}
