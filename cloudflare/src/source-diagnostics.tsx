import React from 'react';
import {SOURCE_DIAGNOSTICS,sourceFailureHistory} from '../shared/source-diagnostics.js';

export type SourceCheckReceipt={run_id:string;source_id:string;company:string;state:string;error_code:string|null;created_at:string;attempt_failures:unknown[]};
const date=(value:string)=>new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const phase:Record<string,string>={configuration:'Source setup',catalogue:'Vacancy list',description:'Advert description',cache:'Saved collection',execution:'Workflow execution'};

export function SourceDiagnostics({receipts}:{receipts:SourceCheckReceipt[]}){
  return <details className="agent-panel">
    <summary>Recent source checks that needed attention · {receipts.length}</summary>
    <p>Up to ten checks from the last fifteen runs. A later recovery keeps the earlier failure record. Previous publication and freshness rules still apply.</p>
    {receipts.length===0&&<p className="fine-print">No failed attempts were recorded in these recent runs.</p>}
    {receipts.map(receipt=>{
      const failures=sourceFailureHistory(receipt),recovered=receipt.state==='published'||receipt.error_code==='details_pending';
      return <article className="agent-finding" key={receipt.run_id+':'+receipt.source_id}>
        <strong>{receipt.company}</strong>
        <p>{recovered?(receipt.state==='published'?'Recovered within this run and published.':'Collection resumed within this run; descriptions remain private.'):receipt.state==='running'?'Retry pending.':`Run result: ${receipt.state.replaceAll('_',' ')}.`}</p>
        <small>{date(receipt.created_at)} · {receipt.run_id}</small>
        {failures.length===0?<p>No detailed diagnostic was recorded for this check. Its cause is unconfirmed.</p>:
          <ol>{failures.map(f=>{const detail=SOURCE_DIAGNOSTICS[f.code];return <li key={f.attempt}>
            <strong>Attempt {f.attempt}: {detail.title}</strong>
            <p>{[phase[f.phase||''],f.posting_ref?'Advert reference '+f.posting_ref:'',f.page_offset!==undefined?'Page '+(1+f.page_offset/100):'',f.http_status?'Response '+f.http_status:'',f.requests!==undefined?f.requests+(f.requests===1?' request used':' requests used'):''].filter(Boolean).join(' · ')}</p>
            <small>{date(f.checked_at)}</small><p>{detail.action}</p>
          </li>;})}</ol>}
      </article>;
    })}
  </details>;
}
