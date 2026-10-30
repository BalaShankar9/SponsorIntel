import { WorkflowEntrypoint } from 'cloudflare:workers';
import { runSourceSequence } from './source-sequence.js';

// Durable admission/waits preserve the original run and bounded source attempts.
// Steps retain small receipts only; publication remains one D1 transaction.
export class SourceWorkflow extends WorkflowEntrypoint {
  async run(event,step) {
    return runSourceSequence(this.env,event,step);
  }
}
