import fixture from '../tests/fixtures/application-development-20.json' with {type:'json'};
import {writeCareerDraft,generationPrompt} from './career.js';
import {candidatePassages,reviewPrompt,validateReview} from './career-review.js';
import {candidateReviewPrompt,validateCandidateReview,CANDIDATE_REVIEW_POLICY} from './career-review-candidate.js';
import {cleanDraft,preserveCVContacts,draftWarnings} from './career-quality.js';
import {bodyJSON,digest,limit,reply,sameOrigin} from './auth.js';
import {applicationAssessmentDetails,applicationAssessmentSummary,recordApplicationAssessment} from './application-assessments.js';
export const APPLICATION_FIXTURE_HASH='5b8654502327fbff77608a48c42fc61d3acf786ea3ee43f42d90b97b5efd81c3';
export const APPLICATION_EVAL_POLICY='paired-application-development-v1';
const REVIEW_OPTIONS=Object.freeze({max_tokens:2700,temperature:.1,response_format:{type:'json_object'}});
const iso=(n=Date.now())=>new Date(n).toISOString(),HOUR=3600000;
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const enabled=async env=>!!(await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first())?.enabled&&!!(await env.DB.prepare('SELECT enabled FROM application_eval_controls WHERE singleton=1').first())?.enabled;
const rowFor=(env,id)=>env.DB.prepare('SELECT * FROM application_eval_runs WHERE id=?').bind(id).first();
export const applicationCases=()=>fixture.cases.map(c=>({id:c.id,kind:c.kind,title:c.application.title,review_question:c.review_questions}));
export function evaluationCase(id){const c=fixture.cases.find(x=>x.id===id);if(!c)throw Error('Unknown application test case');return c;}
export async function applicationProfile(env){
 if(await digest(canonical(fixture))!==APPLICATION_FIXTURE_HASH)throw Error('Application fixture changed');
 const c=fixture.cases[0],prompts=['cv','coverLetter'].map(kind=>[generationPrompt(kind,c.profile,c.application),reviewPrompt('fixed draft',c.profile,c.application,kind),candidateReviewPrompt('fixed draft',c.profile,c.application,kind)]);
 return {suite:fixture.version,fixture_hash:APPLICATION_FIXTURE_HASH,policy:APPLICATION_EVAL_POLICY,candidate_policy:CANDIDATE_REVIEW_POLICY,writer:env.AI_MODEL,reviewer:env.AI_REVIEW_MODEL,review_options:REVIEW_OPTIONS,
  implementation:await digest(JSON.stringify(prompts)+writeCareerDraft.toString()+validateReview.toString()+validateCandidateReview.toString()+candidatePassages.toString()+cleanDraft.toString()+preserveCVContacts.toString())};
}
export async function applicationProgress(env){
 const runs=(await env.DB.prepare('SELECT * FROM application_eval_runs ORDER BY created_at').all()).results;
 const attempted=runs.filter(r=>JSON.parse(r.case_ids).length),first=attempted[0];
 const completed=new Set(attempted.filter(r=>r.state==='completed').flatMap(r=>JSON.parse(r.case_ids)));
 const held=attempted.find(r=>!['completed','queued','running'].includes(r.state));
 const active=attempted.find(r=>['queued','running'].includes(r.state));
 const same=attempted.every(r=>r.profile===first?.profile);
 const next=!held&&!active&&same?fixture.cases.filter(c=>!completed.has(c.id)).slice(0,2).map(c=>c.id):[];
 return {total:fixture.cases.length,completed:completed.size,state:!same||held?'needs_attention':active?'running':completed.size===fixture.cases.length?'awaiting_independent_review':'ready',next,profile:first?JSON.parse(first.profile):null,runs};
}
export async function dispatchApplicationEvaluation(env,trigger='scheduled',now=Date.now()){
 if(!['scheduled','owner'].includes(trigger))throw Error('Unknown application trigger');
 if(!await enabled(env))return {state:'paused'};
 if(!env.APPLICATION_EVAL_WORKFLOW||!env.AI_MODEL||!env.AI_REVIEW_MODEL||env.AI_MODEL===env.AI_REVIEW_MODEL)return {state:'unavailable'};
 const day=iso(now).slice(0,10),id='application-eval-'+day;
 const prior=await rowFor(env,id);if(prior)return {id,state:prior.state,reused:true};
 const progress=await applicationProgress(env);if(!progress.next.length)return {state:progress.state};
 const profile=await applicationProfile(env),serial=JSON.stringify(profile);
 if(progress.profile&&JSON.stringify(progress.profile)!==serial)return {state:'needs_attention',reason:'The evaluation policy or models changed. Preserve this campaign and review a separate version.'};
 await env.DB.prepare('INSERT INTO agent_research_budget(day) VALUES(?) ON CONFLICT DO NOTHING').bind(day).run();
 let batch;
 try{batch=await env.DB.batch([
  env.DB.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,profile,case_ids) SELECT ?,?,?,'queued',?,?,? WHERE (SELECT runs<4 AND calls<=26 FROM agent_research_budget WHERE day=?) RETURNING id").bind(id,day,trigger,iso(now),serial,JSON.stringify(progress.next),day),
  env.DB.prepare('UPDATE agent_research_budget SET runs=runs+1 WHERE day=? AND EXISTS(SELECT 1 FROM application_eval_runs WHERE id=?)').bind(day,id)
 ]);}catch{const winner=await rowFor(env,id);if(winner)return {id,state:winner.state,reused:true};throw Error('Application reservation failed');}
 if(!batch[0].results?.length){
  await env.DB.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids,error) VALUES(?,?,?,'held',?,?,?,'[]',?) ON CONFLICT DO NOTHING").bind(id,day,trigger,iso(now),iso(now),serial,'Shared daily allowance unavailable. No model call made.').run();
  return {id,state:'held',calls:0};
 }
 try{await env.APPLICATION_EVAL_WORKFLOW.create({id,params:{runId:id}});}catch{
  // A lost create acknowledgement is not a reason to create a second workflow.
  try{await(await env.APPLICATION_EVAL_WORKFLOW.get(id)).status();}catch{return {id,state:'queued',reason:'Dispatch uncertain; existing reservation retained.'};}
 }
 return {id,state:'queued'};
}
export async function initialiseApplicationEvaluation(env,id){
 const row=await rowFor(env,id);if(!row||!['queued','running'].includes(row.state))throw Error('Application test is not active');
 if(!await enabled(env)||JSON.stringify(await applicationProfile(env))!==row.profile)throw Error('Application test paused or changed');
 await env.DB.prepare("UPDATE application_eval_runs SET state='running' WHERE id=? AND state='queued'").bind(id).run();
 return JSON.parse(row.case_ids);
}
const responseValue=r=>typeof r?.response==='string'||r?.response&&typeof r.response==='object'?r.response:r?.choices?.[0]?.message?.content;
export async function applicationModelStep(env,id,caseId,stage,now=Date.now()){
 if(!['write','baseline','candidate'].includes(stage))throw Error('Unknown application stage');
 const previous=await env.DB.prepare('SELECT * FROM application_eval_steps WHERE run_id=? AND case_id=? AND stage=?').bind(id,caseId,stage).first();
 if(previous&&['completed','rejected'].includes(previous.state))return {state:previous.state,output:previous.output?JSON.parse(previous.output):null,replayed:true};
 if(previous)throw Error('Application model outcome is uncertain; no duplicate call');
 const run=await rowFor(env,id),c=evaluationCase(caseId);
 const age=now-Date.parse(run?.created_at);
 if(!run||run.state!=='running'||!JSON.parse(run.case_ids).includes(caseId)||(!Number.isFinite(age)||age<0||age>HOUR)||!await enabled(env)||run.profile!==JSON.stringify(await applicationProfile(env)))throw Error('Application test expired, changed or paused');
 let draft;
 if(stage!=='write'){
  const writer=await env.DB.prepare("SELECT output,state FROM application_eval_steps WHERE run_id=? AND case_id=? AND stage='write'").bind(id,caseId).first();
  if(writer?.state!=='completed')throw Error('Application draft is unavailable');
  draft=JSON.parse(writer.output).text;
 }
 const day=iso(now).slice(0,10);
 // CHECK constraints atomically bound all agents to the existing 4-start/32-call
 // daily allowance. This run additionally has a six-call ceiling.
 await env.DB.batch([
  env.DB.prepare('INSERT INTO agent_research_budget(day) VALUES(?) ON CONFLICT DO NOTHING').bind(day),
  env.DB.prepare('UPDATE agent_research_budget SET calls=calls+1 WHERE day=?').bind(day),
  env.DB.prepare('UPDATE application_eval_runs SET calls=calls+1 WHERE id=?').bind(id),
  env.DB.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at) VALUES(?,?,?,'calling',?)").bind(id,caseId,stage,iso(now))
 ]);
 let response,raw=null,output=null,state='completed',error=null;
 try{
  if(stage==='write'){
   // Same writer and options used by the customer flow; synthetic inputs only.
   const wrapped={...env,AI:{run:async(model,input)=>{response=await env.AI.run(model,input);return response;}}};
   try{output={text:await writeCareerDraft(wrapped,c.kind,c.profile,c.application)};}catch(e){if(!response)throw e;state='rejected';error='Writer output did not meet the existing document contract.';}
  }else{
   const prompt=stage==='baseline'?reviewPrompt(draft,c.profile,c.application,c.kind):candidateReviewPrompt(draft,c.profile,c.application,c.kind);
   response=await env.AI.run(env.AI_REVIEW_MODEL,{messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],...REVIEW_OPTIONS});
   try{
    if(response.choices?.[0]?.finish_reason==='length')throw Error('Truncated review');
    const value=responseValue(response);
    if(stage==='candidate')output=validateCandidateReview(value,c.profile,c.application,c.kind);
    else{let text=validateReview(value,c.profile,c.kind);if(c.kind==='cv')text=preserveCVContacts(text,c.profile);output={text,semantic_verification:false,review_required:true};}
   }catch{state='rejected';error='Review output did not meet its document contract.';}
  }
  raw=JSON.stringify(responseValue(response)??null);
  if(raw.length>100000){raw=null;state='rejected';error='Model response exceeded the retained-output limit.';output=null;}
  await env.DB.prepare("UPDATE application_eval_steps SET state=?,finished_at=?,raw=?,output=?,usage=?,error=? WHERE run_id=? AND case_id=? AND stage=? AND state='calling'").bind(state,iso(),raw,output?JSON.stringify(output):null,JSON.stringify(response?.usage||null),error,id,caseId,stage).run();
  return {state,output};
 }catch{
  // Preserve an already-committed response if its acknowledgement was lost.
  const saved=await env.DB.prepare('SELECT state,output FROM application_eval_steps WHERE run_id=? AND case_id=? AND stage=?').bind(id,caseId,stage).first();
  if(saved&&['completed','rejected'].includes(saved.state))return {state:saved.state,output:saved.output?JSON.parse(saved.output):null,replayed:true};
  await env.DB.prepare("UPDATE application_eval_steps SET state='failed',finished_at=?,error='Model call or response retention could not be confirmed. No automatic retry.' WHERE run_id=? AND case_id=? AND stage=? AND state='calling'").bind(iso(),id,caseId,stage).run();
  throw Error('Application model outcome could not be confirmed');
 }
}
export function screenApplication(caseId,text){
 const c=evaluationCase(caseId);
 return {missing_anchors:c.screening.expected_anchors.filter(x=>!text.toLowerCase().includes(x.toLowerCase())),flagged_patterns:c.screening.forbidden_patterns.filter(x=>new RegExp(x,'i').test(text)),warnings:draftWarnings(text,c.profile.cv,c.kind),review_question:c.review_questions,interpretation:'Literal screening only; no semantic accuracy, suitability or promotion verdict.'};
}
export async function finishApplicationEvaluation(env,id,failure=null){
 const run=await rowFor(env,id);if(!run)throw Error('Application run missing');
 if(!['queued','running'].includes(run.state))return {id,state:run.state,replayed:true};
 const rows=(await env.DB.prepare('SELECT case_id,stage,state,output FROM application_eval_steps WHERE run_id=? ORDER BY case_id,stage').bind(id).all()).results;
 const cases=JSON.parse(run.case_ids).map(caseId=>{
  const stages=rows.filter(r=>r.case_id===caseId).map(r=>({stage:r.stage,state:r.state,...(r.output?{screening:screenApplication(caseId,JSON.parse(r.output).text)}:{})}));
  return {id:caseId,stages,assessment:'awaiting_independent_review'};
 });
 const completed=!failure&&cases.every(c=>{
  const writer=c.stages.find(s=>s.stage==='write');
  return writer?.state==='rejected'||writer?.state==='completed'&&['baseline','candidate'].every(stage=>c.stages.some(s=>s.stage===stage&&['completed','rejected'].includes(s.state)));
 });
 const state=completed?'completed':'failed',result={cases,interpretation:'Development comparison only. Completion describes execution, not acceptable writing quality. Customer generation remains on the existing reviewer.',automatic_promotion:false};
 await env.DB.prepare("UPDATE application_eval_runs SET state=?,finished_at=?,result=?,error=? WHERE id=? AND state IN ('queued','running')").bind(state,iso(),JSON.stringify(result),completed?null:'Evaluation stopped. Retain its evidence and reservations; inspect the exact workflow before any follow-up.',id).run();
 return {id,state};
}
export async function applicationEvaluationHealth(env){
 const progress=await applicationProgress(env);
 const changed=progress.profile&&JSON.stringify(progress.profile)!==JSON.stringify(await applicationProfile(env));
 return {state:changed?'needs_attention':progress.state,completed:progress.completed,total:progress.total,assessments:await applicationAssessmentSummary(env)};
}
export async function applicationEvaluationSnapshot(env){
 const progress=await applicationProgress(env),health=await applicationEvaluationHealth(env),budget=await env.DB.prepare('SELECT runs,calls FROM agent_research_budget WHERE day=?').bind(iso().slice(0,10)).first();
 return {enabled:await enabled(env),evaluation_enabled:!!(await env.DB.prepare('SELECT enabled FROM application_eval_controls WHERE singleton=1').first())?.enabled,state:health.state,total:progress.total,completed:progress.completed,next_cases:progress.next,profile:progress.profile,assessments:health.assessments,budget:{runs:budget?.runs||0,calls:budget?.calls||0,run_limit:4,call_limit:32},runs:progress.runs.slice(-12).reverse().map(r=>({...r,profile:JSON.parse(r.profile),case_ids:JSON.parse(r.case_ids),result:r.result?JSON.parse(r.result):null})),cases:applicationCases(),scope:'Twenty fictional CV/advert cases. No customer records, public output, application submission or automatic reviewer promotion. Two cases per eligible UTC day, at most six calls within the existing shared allowance.'};
}
export async function applicationEvaluationAPI(request,env,owner){
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/api/admin/application-evaluation')return reply(await applicationEvaluationSnapshot(env));
 if(request.method==='GET'&&url.pathname==='/api/admin/application-evaluation/case'){
  const id=url.searchParams.get('id');let c;try{c=evaluationCase(id);}catch{return reply({error:'Unknown test case.'},404);}
  return reply({case:c,...await applicationAssessmentDetails(env,id)});
 }
 if(request.method!=='POST'||!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!await limit(env,'application-eval-owner:'+owner.user.id,12))return reply({error:'Please try again later.'},429);
 let body;try{body=await bodyJSON(request,url.pathname==='/api/admin/application-evaluation/assessment'?14000:512);}catch{return reply({error:'Invalid request.'},400);}
 if(url.pathname==='/api/admin/application-evaluation/assessment'){
  try{return reply(await recordApplicationAssessment(env,body,owner.user.id));}catch(error){if(!error.status)throw error;return reply({error:error.message},error.status);}
 }
 if(url.pathname==='/api/admin/application-evaluation/run'&&body&&Object.keys(body).length===0)return reply(await dispatchApplicationEvaluation(env,'owner'));
 if(url.pathname==='/api/admin/application-evaluation/settings'&&typeof body?.enabled==='boolean'&&Object.keys(body).length===1){
  await env.DB.batch([env.DB.prepare('UPDATE application_eval_controls SET enabled=?,updated_at=?,actor=? WHERE singleton=1').bind(body.enabled?1:0,iso(),owner.user.id),env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(owner.user.id,'application-evaluation',String(body.enabled),iso())]);return reply({ok:true});
 }
 return reply({error:'Invalid request.'},400);
}
