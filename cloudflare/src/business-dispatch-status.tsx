import React from 'react';

export type BusinessDispatchHealth={checked_at:string;state:'clear'|'pending'|'needs_review';unfinished_count:number;
  unfinished:{id:string;state:string;created_at:string;recorded_steps:number;age_seconds:number|null;timing:string}[]};
const stamp=(x:string)=>Number.isFinite(Date.parse(x))?new Date(x).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Invalid recorded time';
export function BusinessDispatchStatus({health,paused=false,compact=false}:{health?:BusinessDispatchHealth;paused?:boolean;compact?:boolean}){
  if(!health?.unfinished_count)return null;
  const review=health.state==='needs_review';
  return <aside className={'business-dispatch-status '+(review?'attention':'')} aria-label="Unfinished business runs">
    <strong>{review?'An unfinished business run needs review':'A business run is still unfinished'}</strong>
    <p>{paused?'Operations are paused. ':''}{review?'Later business checks are waiting for the original workflow to be reconciled.':'The next business run waits for this receipt to finish.'} Job and immigration refresh schedules are separate.</p>
    <p className="business-fine">Read from application receipts {stamp(health.checked_at)}. Cloudflare execution status was not checked by this page.</p>
    {compact?<p><code>{health.unfinished[0]?.id}</code> · {health.unfinished_count} unfinished · <a href="#admin-operations">Inspect the blocking receipt</a></p>:<>
      <ul>{health.unfinished.map(run=><li key={run.id}><code>{run.id}</code> · {run.state}<br/>
        Recorded {stamp(run.created_at)} · {run.age_seconds===null?'Timing needs review':run.age_seconds<3600?'Less than one hour old':`${Math.floor(run.age_seconds/3600)} hours old`} · {run.recorded_steps} saved steps
      </li>)}</ul>
      {health.unfinished_count>health.unfinished.length&&<p>Showing {health.unfinished.length} of {health.unfinished_count} unfinished receipts, with invalid times and oldest records first.</p>}
      <details><summary>How to investigate safely</summary><p>Inspect the exact Cloudflare instance ID above and its original steps. A missing instance, a lookup error or zero saved steps does not prove that nothing ran. Keep unknown outcomes held; reconcile only a confirmed terminal outcome. Do not reset budgets, recreate the run or resend external actions.</p></details>
    </>}
  </aside>;
}
