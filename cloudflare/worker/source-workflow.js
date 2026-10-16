import { WorkflowEntrypoint } from "cloudflare:workers";
import {
  initialiseRun,
  executeSourceTask,
  markTaskFailure,
  completeRun,
} from "./agent-operations.js";

// Steps store small receipts only. Job batches are published atomically in D1.
export class SourceWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const runId = event.payload.runId;
    const sources = await step.do("load-approved-sources", () =>
      initialiseRun(this.env, runId),
    );
    for (const sourceId of sources) {
      try {
        await step.do(
          `collect-check-publish-${sourceId}`,
          {
            retries: { limit: 2, delay: "30 seconds", backoff: "exponential" },
            timeout: "2 minutes",
          },
          () => executeSourceTask(this.env, runId, sourceId),
        );
      } catch {
        await step.do(`record-failure-${sourceId}`, () =>
          markTaskFailure(this.env.DB, runId, sourceId),
        );
      }
    }
    return step.do("finish-run", () => completeRun(this.env.DB, runId));
  }
}
