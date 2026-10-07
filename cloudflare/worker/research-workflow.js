import { WorkflowEntrypoint } from 'cloudflare:workers';
import { researchContext,chooseResearchTool,executeResearchTool,analyseResearch,reviewResearch,finishResearch,stopWithEvidence } from './agent-research.js';

// Dynamic decisions are checkpointed. Model calls have durable reservations and are
// never blindly retried after an uncertain outcome. Public jobs are read-only here.
export class ResearchWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const id = event.payload.runId;
    const options = { retries:{ limit:0,delay:'5 seconds' }, timeout:'3 minutes' };
    try {
      const mode = await step.do('initialise', async () => {
        await researchContext(this.env,id);
        const run = await this.env.DB.prepare('SELECT kind FROM agent_investigations WHERE id=?').bind(id).first();
        return { evaluation:run.kind === 'evaluation' };
      });
      let repaired = false;
      if (!mode.evaluation) for (let turn=0; turn<3; turn++) {
        try {
          let choice = await step.do('choose-'+turn,options,() => chooseResearchTool(this.env,id,turn));
          if (choice.tool_error) {
            if (repaired) throw Error('Tool repair allowance used.');
            const invalid = choice;
            choice = await step.do('repair-choice-'+turn,options,() => chooseResearchTool(this.env,id,turn,invalid));
            repaired = true;
            if (choice.tool_error) throw Error('Tool repair did not validate.');
          }
          const result = await step.do('tool-'+turn,options,() => executeResearchTool(this.env,id,turn,choice));
          if (result.done) break;
        } catch (error) {
          // Do not issue the unknown call again. A bounded partial report may use
          // already persisted evidence, with the early stop disclosed explicitly.
          const usable = await step.do('stop-tools-'+turn,() => stopWithEvidence(this.env,id));
          if (!usable) throw error;
          break;
        }
      }
      await step.do('analyse',options,() => analyseResearch(this.env,id));
      const review = await step.do('critique',options,() => reviewResearch(this.env,id));
      if (review.revise) {
        await step.do('revise',options,() => analyseResearch(this.env,id,true));
        await step.do('critique-revision',options,() => reviewResearch(this.env,id,true));
      }
      return step.do('finish',() => finishResearch(this.env,id));
    } catch {
      return step.do('record-failure', async () => {
        await this.env.DB.prepare("UPDATE agent_investigations SET state='failed',finished_at=?,error='Research did not produce a fully validated report. Inspect the step records; no public content changed.' WHERE id=? AND state IN ('queued','running')")
          .bind(new Date().toISOString(),id).run();
        return { state:'failed' };
      });
    }
  }
}
