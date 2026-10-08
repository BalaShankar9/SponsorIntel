import {WorkflowEntrypoint} from 'cloudflare:workers';
import {captureMarketingContext,planMarketing,writeMarketing,critiqueMarketing,storeMarketingDraft,concludeMarketing,finishMarketingAgent,failMarketingAgent,accepted,prepareExistingMarketing,critiqueExistingMarketing,concludeExistingMarketing} from './marketing-agents.js';

export class MarketingWorkflow extends WorkflowEntrypoint {
 async run(event,step){
  const id=event.payload.runId;
  const modelOptions={retries:{limit:0,delay:'1 second'},timeout:'2 minutes'};
  try{
   const context=await step.do('capture-fresh-guide-evidence',{retries:{limit:1,delay:'10 seconds'},timeout:'1 minute'},()=>captureMarketingContext(this.env,id));
   if(context.existing_review){
    await step.do('refresh-existing-welcome-evidence',()=>prepareExistingMarketing(this.env,id));
    const review=await step.do('review-existing-caption-and-artwork',modelOptions,()=>critiqueExistingMarketing(this.env,id));
    return await step.do('recheck-existing-review',{retries:{limit:1,delay:'10 seconds'},timeout:'1 minute'},()=>concludeExistingMarketing(this.env,id,review));
   }
   const plan=await step.do('editorial-plan',modelOptions,()=>planMarketing(this.env,id));
   if(plan.decision==='no_post')return await step.do('record-no-post',()=>finishMarketingAgent(this.env,id,'no_post',plan));
   let copy=await step.do('write-evidenced-copy',modelOptions,()=>writeMarketing(this.env,id,plan));
   await step.do('save-first-version',()=>storeMarketingDraft(this.env,id,plan,copy));
   let review=await step.do('independent-paragraph-review',modelOptions,()=>critiqueMarketing(this.env,id,plan,copy));
   if(!accepted(review)&&context.candidates.find(source=>source.id===plan.source_id)?.kind!=='opportunity'){
    const previous={copy,review};
    copy=await step.do('one-bounded-revision',modelOptions,()=>writeMarketing(this.env,id,plan,previous));
    await step.do('save-revised-version',()=>storeMarketingDraft(this.env,id,plan,copy,true));
    review=await step.do('review-revised-copy',modelOptions,()=>critiqueMarketing(this.env,id,plan,copy,true));
   }
   return await step.do('recheck-and-record-decision',{retries:{limit:1,delay:'10 seconds'},timeout:'1 minute'},()=>concludeMarketing(this.env,id,plan,copy,review));
  }catch{return await step.do('hold-stopped-run',()=>failMarketingAgent(this.env,id));}
 }
}
