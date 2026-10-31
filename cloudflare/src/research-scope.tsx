import React,{useRef,useState} from 'react';
export type ScopeComparison={dataset:string;reference_revision:number;state:string;available:boolean;source_sha256:string|null;control:{prepared:boolean;enabled:boolean;revision:number;reason:string;updated_at:string|null};evaluated_adverts:number;total_adverts:number;uncertain_calls:number;dangerous_false_positives:number;unsupported_refusals:number;disputed_items:number;batches:{id:string;state:string;run_id:string|null;calls:number}[]};
type Request={action:string;expected_revision:number;expected_reference_revision:number;request_id:string;reason:string;source_sha256:string|null};
export type ScopeCase={source:{job_id:string;title:string;source_blocks:{id:string;text:string}[]};extraction:{complete:boolean;provisional_label:string|null;facts:{id:string;subject:string;stance:string;scope:string;quotes:{id:string;text:string}[];reason:string}[]};review:{checks:{fact_id:string;supported:boolean;reason:string}[];coverage:{supported:boolean;reason:string};label:{supported:boolean;reason:string}};outcome:{accepted:boolean}};
export function ResearchScope({data,active,refresh}:{data:ScopeComparison;active:boolean;refresh:()=>Promise<void>}){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),pending=useRef<Request|null>(null);
 async function act(action:string){
  if(busy)return;setBusy(true);setNotice('');const body=pending.current||{action,expected_revision:data.control.revision,expected_reference_revision:data.reference_revision,request_id:crypto.randomUUID(),reason,source_sha256:data.source_sha256};pending.current=body;
  try{const response=await fetch('/api/admin/agents/research/scope',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await response.json();
   if(!response.ok){if(response.status<500){pending.current=null;setUncertain(false);}throw Error(result.error||'Review could not complete.');}
   pending.current=null;setUncertain(false);setReason('');setNotice(result.message);await refresh();
  }catch(e){setNotice((e as Error).message);if(pending.current)setUncertain(true);}finally{setBusy(false);}
 }
 const blocked=busy||uncertain||reason.trim().length<30;
 return <section className="agent-panel" aria-label="Scope comparison controls"><h3>Separate visa wording from other sponsorship</h3>
  <p>This comparison reads all 50 archived adverts in 25 pairs. It records what is sponsored, the conditions and which role each statement covers, then asks a different model to challenge the complete source.</p>
  <p><strong>{data.state.replaceAll('_',' ')}</strong> · {data.evaluated_adverts}/50 adverts with complete model reviews · {data.uncertain_calls} unresolved calls</p>
  <p className="fine-print">Earlier campaigns and failures remain separate. Preparing selects this campaign and leaves it paused; no model call is made. After a recorded resume, it uses the existing daily research opportunity and shared allowance, with at most four calls per pair. Failed or uncertain batches cannot be retried. No public labels or customer models change.</p>
  <p className="fine-print">Model agreement is provisional. Independent adjudication and a separate held-out test are still required. {data.dangerous_false_positives} provisional false positives · {data.unsupported_refusals} unsupported refusals · {data.disputed_items} disputed review items.</p>
  {data.source_sha256&&<p className="fine-print">Source version: {data.source_sha256.slice(0,16)}</p>}
  {data.control.reason&&<p>Last recorded review: {data.control.reason}</p>}
  <label>Evidence and reason for this decision<textarea value={reason} maxLength={1200} disabled={busy||uncertain} onChange={e=>setReason(e.target.value)} placeholder="Record original provider outcomes, evidence review and remaining limitations. Agent-assisted decisions must say so."/></label>
  <div className="agent-actions">
   {!data.control.prepared&&<button className="secondary-button" disabled={blocked||active||!data.available||!!data.uncertain_calls} onClick={()=>void act('prepare')}>Prepare separate campaign</button>}
   {data.control.prepared&&!data.control.enabled&&<button className="secondary-button" disabled={blocked||active||data.state!=='paused'} onClick={()=>void act('resume')}>Resume next eligible daily batch</button>}
   {data.control.prepared&&data.control.enabled&&<button className="secondary-button" disabled={blocked} onClick={()=>void act('pause')}>Pause scope campaign</button>}
   {uncertain&&<button className="secondary-button" disabled={busy} onClick={()=>void act(pending.current!.action)}>Recheck the same request</button>}
  </div>{notice&&<p role="status">{notice}</p>}
  <details><summary>Separate batch history</summary><ol>{data.batches.map((b,i)=><li key={b.id}>Pair {i+1}: {b.state.replaceAll('_',' ')} · {b.calls} calls</li>)}</ol></details>
 </section>;
}
export function ScopeEvidence({cases}:{cases:ScopeCase[]}){
 return <section aria-label="Detailed subject and scope evidence">{cases.map(c=><article className="agent-panel" key={c.source.job_id}><h4>{c.source.title}</h4>
  <p>Extraction coverage: {c.extraction.complete?'model claims complete':'incomplete — no label'} · Provisional label: {c.extraction.provisional_label??'unresolved'} · {c.outcome.accepted?'model reviewer accepts':'held for review'}</p>
  {c.extraction.facts.map(f=><div key={f.id}><strong>{f.subject.replaceAll('_',' ')} · {f.stance} · {f.scope.replaceAll('_',' ')}</strong><p>{f.reason}</p>{f.quotes.map(q=><blockquote key={q.id}>{q.text}</blockquote>)}<p>Reviewer: {c.review.checks.find(x=>x.fact_id===f.id)?.reason}</p></div>)}
  <p>Coverage challenge: {c.review.coverage.supported?'supported':'disputed'} — {c.review.coverage.reason}</p><p>Label challenge: {c.review.label.supported?'supported':'disputed'} — {c.review.label.reason}</p>
  <details><summary>Complete archived source</summary>{c.source.source_blocks.map(q=><span key={q.id}>{q.text}</span>)}</details>
 </article>)}</section>;
}
