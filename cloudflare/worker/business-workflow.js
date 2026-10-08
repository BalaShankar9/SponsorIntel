import { WorkflowEntrypoint } from 'cloudflare:workers';
import { controls,captureBusiness,recordBusinessFindings,housekeeping,publishInsight,scheduleBusinessResearch,finishBusiness } from './business-operations.js';
import {syncMarketing,reconcileOpportunities} from './marketing.js';
import {dispatchMarketingAgents} from './marketing-agents.js';
import {superviseAgents} from './agent-supervision.js';
import {syncSearchConsole} from './search-console.js';
import {dispatchApplicationEvaluation} from './application-evaluation.js';
import {planJobLinkChecks,checkJobLink} from './job-link-checks.js';
import {scoutTeachingVacancies} from './discovery-scout.js';

export class BusinessWorkflow extends WorkflowEntrypoint {
  async run(event,step) {
    const id=event.payload.runId;
    try {
      const enabled=await step.do('check-operations-switch',async()=>!!(await controls(this.env))?.enabled);
      if (!enabled) return await step.do('record-paused',async()=>{
        await this.env.DB.prepare("UPDATE business_runs SET state='paused',finished_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
        return {state:'paused'};
      });
      const supervision=await step.do('supervise-interrupted-agents',{retries:{limit:1,delay:'10 seconds'},timeout:'1 minute'},()=>superviseAgents(this.env,id));
      const search=await step.do('read-daily-google-search',{retries:{limit:0,delay:'1 second'},timeout:'3 minutes'},()=>syncSearchConsole(this.env));
      const linkIds=await step.do('plan-employer-link-checks',()=>planJobLinkChecks(this.env,id));
      const links=[];
      for(const checkId of linkIds)links.push(await step.do('check-employer-link-'+checkId,{retries:{limit:0,delay:'1 second'},timeout:'1 minute'},()=>checkJobLink(this.env,checkId)));
      const discovery=await step.do('discover-daily-education-leads',{retries:{limit:0,delay:'1 second'},timeout:'3 minutes'},()=>scoutTeachingVacancies(this.env,id));
      const opportunities=await step.do('recheck-vacancy-promotions',{retries:{limit:1,delay:'10 seconds'},timeout:'1 minute'},()=>reconcileOpportunities(this.env));
      const snapshot=await step.do('check-site-and-sources',{retries:{limit:1,delay:'30 seconds'},timeout:'2 minutes'},()=>captureBusiness(this.env,id,supervision));
      const health=await step.do('update-issues',()=>recordBusinessFindings(this.env,id,snapshot));
      const cleanup=await step.do('retire-stale-records',()=>housekeeping(this.env,id));
      const publication=await step.do('publish-evidence-report',()=>publishInsight(this.env,id,snapshot));
      const marketing=await step.do('reconcile-marketing-records',async()=> (await controls(this.env))?.enabled ? syncMarketing(this.env) : {state:'paused'});
      const editorial=await step.do('dispatch-daily-marketing-agents',()=>dispatchMarketingAgents(this.env));
      const research=await step.do('dispatch-daily-research',{retries:{limit:0,delay:'1 second'},timeout:'1 minute'},()=>scheduleBusinessResearch(this.env));
      const applications=await step.do('dispatch-application-evaluation',{retries:{limit:0,delay:'1 second'},timeout:'1 minute'},()=>dispatchApplicationEvaluation(this.env));
      return await step.do('record-completion',()=>finishBusiness(this.env,id,{health,supervision,search,links,discovery,opportunities,cleanup,publication,marketing,editorial,research,applications}));
    } catch {
      return await step.do('record-failure',()=>finishBusiness(this.env,id,{error:'Operations stopped. Inspect the workflow and latest successful step before recovering.'}));
    }
  }
}
