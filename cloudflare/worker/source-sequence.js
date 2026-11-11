import {initialiseRun,executeSourceTask,markTaskFailure,completeRun} from './agent-operations.js';

const terminal = new Set(['published','needs_review','failed','skipped']);
const singleAttempt = {retries:{limit:0,delay:'30 seconds',backoff:'exponential'},timeout:'2 minutes'};

// This read never acquires, removes or extends a lease and reserves no requests.
// A terminal receipt is replayed before considering another operation's lease.
export async function sourceAdmission(DB,runId,sourceId,now=Date.now()) {
  const task=await DB.prepare(`SELECT t.state,r.created_at FROM agent_tasks t
    JOIN agent_runs r ON r.id=t.run_id WHERE t.run_id=? AND t.source_id=?`)
    .bind(runId,sourceId).first();
  if(!task)throw Error('Unknown source task.');
  if(terminal.has(task.state))return {terminal:true,state:task.state};
  const deadline=Date.parse(task.created_at)+2*3600000;
  if(!Number.isFinite(deadline))throw Error('Source run date needs review.');
  // executeSourceTask records the existing run-expiry outcome without a fetch.
  if(now>deadline)return {ready:true};
  const lease=await DB.prepare("SELECT expires FROM feed_locks WHERE name='jobs'").first();
  if(!lease || lease.expires<now)return {ready:true};
  if(!Number.isSafeInteger(lease.expires))throw Error('Source lease date needs review.');
  return {ready:false,wake_at:Math.min(lease.expires+1000,deadline+1)};
}

export async function runSourceSequence(env,event,step,operations={initialiseRun,executeSourceTask,markTaskFailure,completeRun,sourceAdmission}) {
  const runId=event.payload.runId;
  const sources=await step.do('load-approved-sources',()=>operations.initialiseRun(env,runId));
  for(const sourceId of sources) {
    let completed=false;
    // Same three execution opportunities, with no nested automatic retries.
    for(let attempt=1;attempt<=3;attempt++) {
      try {
        let admission=await step.do(`source-admission-${sourceId}-${attempt}`,singleAttempt,
          ()=>operations.sourceAdmission(env.DB,runId,sourceId));
        if(admission.terminal){completed=true;break;}
        if(!admission.ready) {
          await step.sleepUntil(`source-lease-wait-${sourceId}-${attempt}`,admission.wake_at);
          admission=await step.do(`source-readmission-${sourceId}-${attempt}`,singleAttempt,
            ()=>operations.sourceAdmission(env.DB,runId,sourceId));
          if(admission.terminal){completed=true;break;}
          // The owner/expiry may have changed during sleep. Do not bypass it or
          // loop indefinitely; the next bounded opportunity reads it afresh.
          if(!admission.ready)throw Error('Source operation remains active.');
        }
        await step.do(`collect-check-publish-${sourceId}-attempt-${attempt}`,singleAttempt,
          ()=>operations.executeSourceTask(env,runId,sourceId));
        completed=true;
        break;
      } catch {
        if(attempt<3)await step.sleep(`source-retry-delay-${sourceId}-${attempt}`,attempt*30000);
      }
    }
    if(!completed)await step.do(`record-failure-${sourceId}`,()=>operations.markTaskFailure(env.DB,runId,sourceId));
  }
  return step.do('finish-run',()=>operations.completeRun(env.DB,runId));
}
