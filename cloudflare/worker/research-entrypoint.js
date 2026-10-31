import {ResearchWorkflow as LegacyResearchWorkflow} from './research-workflow.js';
import {scopeRun,admitScope,scopeModelStep,failScope} from './research-scope-runtime.js';
import {scopeEvidence,scoreScope} from './research-scope.js';
export class ResearchWorkflow extends LegacyResearchWorkflow {
 async run(event,step){
  const id=event.payload.runId;
  const scope=await step.do('identify-scope-campaign',async()=>!!(await this.env.DB.prepare('SELECT scope_profile FROM agent_investigations WHERE id=?').bind(id).first())?.scope_profile);
  if(!scope)return super.run(event,step);
  const options={retries:{limit:0,delay:'5 seconds'},timeout:'3 minutes'};
  try{
   await step.do('scope-initialise',async()=>{
    const run=await scopeRun(this.env,id);
    if(run.state!=='queued')throw Error('The scope attempt cannot restart.');
    await admitScope(this.env,{...run,state:'running'});
    const saved=JSON.parse(run.context),evidence=await scopeEvidence(this.env,run.reference_batch);
    if(JSON.stringify(saved.evidence)!==JSON.stringify(evidence))throw Error('Archived evidence changed.');
    const moved=await this.env.DB.prepare("UPDATE agent_investigations SET state='running' WHERE id=? AND state='queued' RETURNING id").bind(id).first();if(!moved)throw Error('The scope attempt changed.');
   });
   const cases=[];
   for(let i=0;i<2;i++){
    const extraction=await step.do('scope-extract-'+i,options,()=>scopeModelStep(this.env,id,'extract-'+i,i,'investigator'));
    const judged=await step.do('scope-critic-'+i,options,()=>scopeModelStep(this.env,id,'critic-'+i,i,'reviewer',extraction));
    cases.push({extraction,...judged});
   }
   return await step.do('scope-finish',async()=>{
    const run=await scopeRun(this.env,id);await admitScope(this.env,run);
    const sources=await scopeEvidence(this.env,run.reference_batch),scope_cases=cases.map((c,i)=>({...c,source:sources[i]}));
    const quality={review_complete:true,accepted:cases.every(c=>c.outcome.accepted),reviewed_items:cases.reduce((n,c)=>n+c.review.checks.length+2,0),unsupported_items:cases.reduce((n,c)=>n+[...c.review.checks,c.review.coverage,c.review.label].filter(x=>!x.supported).length,0)};
    const report={scope_cases,quality,report:{summary_claims:[],next_checks:[],assessments:scope_cases.map(c=>({job_id:c.source.job_id,verdict:c.extraction.provisional_label??'unresolved',quote:'',reason:'Provisional label derived from the detailed subject, stance and role-scope assertions below.'}))},
     review:{checks:scope_cases.map(c=>({job_id:c.source.job_id,supported:c.outcome.accepted,reason:c.review.label.reason})),summary_checks:[],next_check_checks:[]},
     evidence:sources.map(s=>({id:s.job_id,title:s.title,company:s.company,url:s.original_url,complete:true,current:false,observed_at:s.historical_snapshot})),evaluation:scoreScope(scope_cases,run.reference_batch),
     publication:'none',human_review_required:true,limitations:['Historical development evidence only. Model agreement is not independent verification. No public labels, learning memory or customer models changed.']};
    const result=await this.env.DB.prepare("UPDATE agent_investigations SET state='review',report=?,finished_at=? WHERE id=? AND state='running' AND EXISTS(SELECT 1 FROM research_scope_control WHERE prepared=1 AND enabled=1 AND profile=?) AND EXISTS(SELECT 1 FROM business_controls WHERE singleton=1 AND enabled=1 AND research=1) RETURNING id").bind(JSON.stringify(report),new Date().toISOString(),id,run.scope_profile).first();
    if(!result)throw Error('Scope completion was paused or changed.');
    return {state:'review',accepted:quality.accepted,publication:'none'};
   });
  }catch{return step.do('scope-record-failure',()=>failScope(this.env,id));}
 }
}
