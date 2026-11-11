import {WorkflowEntrypoint} from 'cloudflare:workers';
import {initialiseApplicationEvaluation,applicationModelStep,finishApplicationEvaluation} from './application-evaluation.js';
export class ApplicationEvaluationWorkflow extends WorkflowEntrypoint {
 async run(event,step){
  const id=event.payload.runId,options={retries:{limit:0,delay:'1 second'},timeout:'3 minutes'};
  try{
   const cases=await step.do('initialise',()=>initialiseApplicationEvaluation(this.env,id));
   for(const caseId of cases){
    const draft=await step.do(caseId+'-write',options,()=>applicationModelStep(this.env,id,caseId,'write'));
    if(draft.state==='rejected')continue;
    await step.do(caseId+'-baseline',options,()=>applicationModelStep(this.env,id,caseId,'baseline'));
    await step.do(caseId+'-candidate',options,()=>applicationModelStep(this.env,id,caseId,'candidate'));
   }
   return await step.do('finish',()=>finishApplicationEvaluation(this.env,id));
  }catch{return await step.do('record-failure',()=>finishApplicationEvaluation(this.env,id,true));}
 }
}
