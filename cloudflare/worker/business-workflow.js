import { WorkflowEntrypoint } from 'cloudflare:workers';
import { controls,captureBusiness,recordBusinessFindings,housekeeping,publishInsight,scheduleBusinessResearch,finishBusiness } from './business-operations.js';

export class BusinessWorkflow extends WorkflowEntrypoint {
  async run(event,step) {
    const id=event.payload.runId;
    try {
      const enabled=await step.do('check-operations-switch',async()=>!!(await controls(this.env))?.enabled);
      if (!enabled) return await step.do('record-paused',async()=>{
        await this.env.DB.prepare("UPDATE business_runs SET state='paused',finished_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
        return {state:'paused'};
      });
      const snapshot=await step.do('check-site-and-sources',{retries:{limit:1,delay:'30 seconds'},timeout:'2 minutes'},()=>captureBusiness(this.env,id));
      const health=await step.do('update-issues',()=>recordBusinessFindings(this.env,id,snapshot));
      const cleanup=await step.do('retire-stale-records',()=>housekeeping(this.env,id));
      const publication=await step.do('publish-evidence-report',()=>publishInsight(this.env,id,snapshot));
      const research=await step.do('dispatch-daily-research',{retries:{limit:0,delay:'1 second'},timeout:'1 minute'},()=>scheduleBusinessResearch(this.env));
      return await step.do('record-completion',()=>finishBusiness(this.env,id,{health,cleanup,publication,research}));
    } catch {
      return await step.do('record-failure',()=>finishBusiness(this.env,id,{error:'Operations stopped. Inspect the workflow and latest successful step before recovering.'}));
    }
  }
}
