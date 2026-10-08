import React, { useEffect, useState } from 'react';
import { BrainCircuit, FlaskConical, SearchCheck } from 'lucide-react';

type Assessment = { job_id:string; verdict:string; quote:string; reason:string };
type SummaryClaim={claim_id:string;text:string;citations:{job_id:string;quote:string}[]};
type ReviewCheck={supported:boolean;reason:string};
type Report = {
  report:{ summary?:string;summary_claims?:SummaryClaim[]; assessments:Assessment[]; next_checks:string[] };
  review?:{ checks:({job_id:string}&ReviewCheck)[];summary_checks?:({claim_id:string}&ReviewCheck)[];next_check_checks?:({index:number}&ReviewCheck)[] };
  quality?:{review_complete:boolean;accepted:boolean;reviewed_items:number;unsupported_items:number};
  revision?:boolean; remembered_observations?:number;
  limitations?:string[];
  evidence?:{ id:string;title:string;company:string;url:string|null;observed_at:string;current:boolean;complete:boolean;stored_verdict?:string }[];
  decisions?:{ tool:string;purpose:string }[];
  evaluation?:{ target?:string;synthetic?:boolean;provisional?:boolean;ambiguous_cases?:number;limitation?:string;correct:number;total:number;dangerous_false_positives?:number;unsupported_refusals?:number;missed_unsupported?:number;incorrect_rejections?:number;cases:{id:string;correct:boolean|null;expected:string|boolean;actual:string|boolean}[] };
};
type Run = {id:string;kind:string;evaluation_suite?:string;reference_batch?:string|null;state:string;policy:string;created_at:string;calls:number;report:Report|null;error:string|null};
type Data = { enabled:boolean;policy:string;models:Record<string,{provider:string;model:string}>;
  budget:{runs:number;calls:number;run_limit:number;call_limit:number};runs:Run[];
  reference?:{state:string;snapshot_at:string;total_adverts:number;unique_descriptions:number;evaluated_adverts:number;completed_batches:number;total_batches:number;correct:number;scored:number;ambiguous:number;disputed_items:number;comparable:boolean;next_batch:string|null;limitation:string;batches:{id:string;state:string;adverts:number;run_id:string|null}[]};
  memories:{job_id:string;expires_at:string}[];steps:{name:string;role:string;state:string;duration_ms:number|null;failure?:string}[] };
const label = (s:string) => s.replaceAll('_',' ');
async function api(path='',body?:unknown) {
  const r = await fetch('/api/admin/agents/research'+path,body === undefined ? {} : { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) });
  const d = await r.json(); if(!r.ok) throw Error(d.error || 'Research could not load.'); return d;
}
export function AgentResearch() {
  const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[selected,setSelected]=useState('');
  async function load() { try { setData(await api()); } catch(e) {setError((e as Error).message);} }
  useEffect(()=>{void load();},[]);
  const active=data?.runs.some(r=>['queued','running'].includes(r.state));
  useEffect(()=>{ if(!active) return;const id=setInterval(()=>{if(document.visibilityState==='visible') void load();},10000);return()=>clearInterval(id);},[active]);
  async function act(path:string,body:unknown) {
    setBusy(true);setError('');setMessage('');
    try { const r=await api(path,body);setMessage(r.message);if(path==='/start') setSelected(''); }
    catch(e){setError((e as Error).message);} finally {await load();setBusy(false);}
  }
  const run=data?.runs.find(r=>r.id===selected)||data?.runs[0];
  const result=run?.report;
  const premium=data && Object.values(data.models).some(m=>m.provider!=='cloudflare');
  return <section className="research-lab" aria-labelledby="research-title">
    <div className="agent-heading"><div><span className="eyebrow">INVESTIGATE · CHALLENGE · LEARN</span><h2 id="research-title"><BrainCircuit size={27}/> Research lab</h2>
    <p>An investigator chooses evidence to inspect. A different model challenges its conclusions. You review what it learns.</p></div>
    <span className="agent-pill">{premium?'Premium model configuration':'Cloudflare models connected'}</span></div>
    {error&&<p className="career-error" role="alert">{error}</p>}{message&&<p className="agent-message" role="status">{message}</p>}
    {!data&&<p>Loading research records…</p>}
    {data&&<>
      <div className="research-models">{Object.entries(data.models).map(([role,m])=><div key={role}><strong>{label(role)}</strong><span>{m.model}</span></div>)}</div>
      <div className="agent-actions">
        <button className="primary-button" disabled={busy||active||!data.enabled||data.budget.runs>=data.budget.run_limit} onClick={()=>void act('/start',{kind:'research'})}><SearchCheck size={17}/>{active?'Investigation running…':'Investigate job quality'}</button>
        <button className="secondary-button" disabled={busy||active||!data.enabled||data.budget.runs>=data.budget.run_limit} onClick={()=>void act('/start',{kind:'evaluation'})}><FlaskConical size={17}/>Run capability test</button>
        <button className="secondary-button" disabled={busy||active||!data.enabled||data.budget.runs>=data.budget.run_limit} onClick={()=>void act('/start',{kind:'evaluation',evaluation_suite:'critic'})}>Test reviewer</button>
        <button className="secondary-button" disabled={busy} onClick={()=>void load()}>Refresh research</button>
      </div>
      <p className="fine-print">{data.budget.runs}/{data.budget.run_limit} shared research and marketing attempts · {data.budget.calls}/{data.budget.call_limit} reserved model calls today (UTC). Only public adverts, guides and operational data are used. No CVs or account details.</p>
      {!premium&&<p className="fine-print">Frontier model connections are prepared but not enabled. These models have not yet passed a representative real-advert benchmark.</p>}
      {data.reference&&<section className="agent-panel" aria-label="Real advert evaluation">
        <div className="agent-heading"><h3>Testing against real adverts</h3><span className="agent-pill">{data.reference.state==='ready'&&data.budget.runs>=data.budget.run_limit?'Waiting for the next daily allowance':label(data.reference.state)}</span></div>
        <p>{data.reference.evaluated_adverts}/{data.reference.total_adverts} archived adverts evaluated · {data.reference.completed_batches}/{data.reference.total_batches} batches complete. Snapshot: {new Date(data.reference.snapshot_at).toLocaleDateString('en-GB')}.</p>
        <p className="fine-print">{data.reference.unique_descriptions} unique advert texts. Expected interpretations were frozen before comparison and remain outside model input. They are AI-assisted provisional annotations; independent human review is still required.</p>
        {data.reference.scored>0&&<p>{data.reference.correct}/{data.reference.scored} single-label provisional agreements · {data.reference.ambiguous} ambiguous cases excluded · {data.reference.disputed_items} items disputed by the reviewer.{!data.reference.comparable&&' Mixed model or policy versions: these totals are not a comparable score.'}</p>}
        <p className="fine-print">{data.reference.limitation}</p>
        <button className="secondary-button" disabled={busy||active||!data.enabled||!data.reference.next_batch||data.budget.runs>=data.budget.run_limit} onClick={()=>void act('/start',{kind:'evaluation',reference_batch:'next'})}>Evaluate next advert batch</button>
        <details><summary>Batch progress</summary><ol>{data.reference.batches.map((b,i)=><li key={b.id}>Batch {i+1}: {b.adverts} adverts · {label(b.state)}</li>)}</ol></details>
      </section>}
      {data.runs.length>0&&<label className="research-history">Investigation history<select value={run?.id||''} onChange={e=>setSelected(e.target.value)}>{data.runs.map(r=><option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString('en-GB')} · {r.kind} · {r.state}</option>)}</select></label>}
      {run&&<article className="research-result"><div className="agent-heading"><h3>{run.reference_batch?'Real advert evaluation':run.kind==='evaluation'?(run.evaluation_suite==='critic'?'Reviewer challenge':'Capability test'):'Job quality investigation'}</h3><span className="agent-pill">{label(run.state)} · {run.calls} model {run.calls===1?'call':'calls'}</span></div>
        {run.reference_batch&&<p className="fine-print">Archived employer text from the fixed reference snapshot. These results assess historical wording and do not confirm that the jobs remain open.</p>}
        {run.evaluation_suite==='critic'&&<p className="fine-print">Synthetic proposals below contain deliberate errors and valid controls. This test evaluates the reviewer; these are not factual job recommendations.</p>}
        {run.error&&<p className="career-error">{run.error}</p>}
        {run.policy===data.policy&&run.state==='failed'&&run.calls<=6&&Date.now()-Date.parse(run.created_at)<3600000&&<button className="secondary-button" disabled={busy||active} onClick={()=>void act('/recover',{run_id:run.id})}>Recover this investigation</button>}
        {['queued','running'].includes(run.state)&&<><p>The investigation continues on Cloudflare when you leave this page.</p><button className="secondary-button" disabled={busy} onClick={()=>void act('/reconcile',{run_id:run.id})}>Check execution status</button></>}
        {result&&<>
          <p>{run.evaluation_suite==='critic'?`This test supplies ${result.report.assessments.length} synthetic advert assessments, including deliberate errors. Review decisions are shown below.`:`The investigator assessed ${result.report.assessments.length} ${result.report.assessments.length===1?'advert':'adverts'}. Its classifications and supporting evidence are shown below.`}</p>
          {result.report.summary_claims?<section className="research-claim-review" aria-label="Research claim review">
            <p className="fine-print">{result.quality?.review_complete?`${result.quality.reviewed_items} items reviewed · ${result.quality.unsupported_items} disputed · ${run.evaluation_suite==='critic'?'Synthetic reviewer challenge':result.quality.accepted?'Ready for owner review':'Hold for corrections'}`:'Claim review is incomplete.'} Labels, explanations, summary claims and follow-up questions each require review.</p>
            <details className="agent-panel"><summary>Summary claims · {result.quality?.review_complete?'model review recorded':'review pending'}</summary>
              {result.report.summary_claims.map(c=>{const check=result.review?.summary_checks?.find(x=>x.claim_id===c.claim_id);return <article key={c.claim_id}><p><strong>{c.claim_id}</strong> · {c.text}</p>{c.citations.map(ref=><blockquote key={ref.job_id}>{ref.quote||'No quoted statement: review the complete advert or recorded evidence limitation.'}<small>Source: {result.evidence?.find(e=>e.id===ref.job_id)?.title||ref.job_id}</small></blockquote>)}<p className={check?.supported?'research-supported':'career-error'}><strong>{check?check.supported?'Reviewer supports':'Reviewer disagrees':'Review pending'}:</strong> {check?.reason||'This claim is not ready for use.'}</p></article>;})}
              <p className="fine-print">Exact quotes and model agreement do not prove an inference is correct. Summaries remain private and cannot enter learning memory.</p>
            </details>
          </section>:<details className="agent-panel"><summary>Earlier draft summary · not independently verified</summary><p>{result.report.summary}</p><p className="fine-print">This older policy did not review summary claims separately. Start a fresh investigation to use the current review process.</p></details>}
          {result.limitations?.map((s,i)=><p className="career-error" key={i}>{s}</p>)}
          <p className="fine-print">{!result.review?'Incomplete draft — independent review has not completed. ':result.revision?'Revised after independent criticism. ':'Independent review recorded. '}Model agreement is not proof of correctness. Public job labels are unchanged.</p>
          {result.evaluation&&<div className="research-score"><strong>{result.evaluation.total?`${result.evaluation.correct}/${result.evaluation.total}`:'—'}</strong><span>{result.evaluation.provisional?'Single-label provisional agreements':result.evaluation.target==='review'?'Synthetic reviewer decisions correct':'Synthetic advert labels correct'}</span>{result.evaluation.target==='review'?<><span>{result.evaluation.missed_unsupported} unsupported claims missed</span><span>{result.evaluation.incorrect_rejections} valid items rejected</span></>:<span>{result.evaluation.dangerous_false_positives} false sponsorship positives</span>}{result.evaluation.unsupported_refusals!==undefined&&<span>{result.evaluation.unsupported_refusals} unsupported refusals</span>}{result.evaluation.provisional&&<span>{result.evaluation.ambiguous_cases} ambiguous cases excluded</span>}<p>{result.evaluation.limitation||'This small authored test measures specific failure cases. It is not a real-world accuracy score.'}</p></div>}
          {result.decisions&&result.decisions.length>0&&<details className="agent-panel"><summary>What the investigator chose to check</summary><ol>{result.decisions.map((d,i)=><li key={i}><strong>{label(d.tool)}</strong> — {d.purpose}</li>)}</ol></details>}
          <div className="research-assessments">{result.report.assessments.map(a=>{
            const evidence=result.evidence?.find(e=>e.id===a.job_id),review=result.review?.checks.find(c=>c.job_id===a.job_id),memory=data.memories.find(m=>m.job_id===a.job_id);
            return <article key={a.job_id}><div className="agent-heading"><h4>{evidence?.title||a.job_id}</h4><span className="agent-pill">{label(a.verdict)}</span></div>
              {evidence&&<p className="fine-print">{evidence.company}{evidence.stored_verdict&&` · Current site label: ${label(evidence.stored_verdict)}`}</p>}
              {a.quote&&<blockquote>{a.quote}</blockquote>}<p>{a.reason}</p>
              {review&&<p className={review.supported?'research-supported':'career-error'}><strong>{review.supported?'Reviewer supports':'Reviewer disagrees'}:</strong> {review.reason}</p>}
              {evidence?.url&&<a href={evidence.url} target="_blank" rel="noreferrer">Read the employer’s original advert ↗</a>}
              {run.kind==='research'&&<div className="agent-actions"><button className="secondary-button" disabled={busy||run.state!=='review'||run.policy!==data.policy||!result.quality?.accepted||!!memory||!review?.supported||!evidence?.complete||!evidence.current} onClick={()=>void act('/remember',{run_id:run.id,job_id:a.job_id,confirmed:true})}>{memory?'Observation remembered':'I checked this label and quote — remember them'}</button></div>}
            </article>;
          })}</div>
          {result.report.next_checks.length>0&&<><h4>Still needs investigation</h4><ul>{result.report.next_checks.map((s,i)=>{const check=result.review?.next_check_checks?.find(x=>x.index===i);return <li key={i}>{s}{result.report.summary_claims&&<p className={check?.supported?'research-supported':'career-error'}>{check?(check.supported?'Reviewer supports: ':'Reviewer disagrees: ')+check.reason:'Review pending'}</p>}</li>;})}</ul></>}
        </>}
      </article>}
      <details className="agent-panel"><summary>Learning and execution records</summary><p>{data.memories.length} approved observations with unexpired retention. They are reused only after a fresh advert fetch matches the saved content exactly. Each expires after seven days.</p><p>Learning does not alter model weights, grant new permissions or deploy code. Model and prompt upgrades require new test results and a reviewed release.</p>
      {data.steps.length>0&&<><h4>Latest investigation’s execution records</h4><ul>{data.steps.map(s=><li key={s.name}>{label(s.name)} · {s.role} · {s.state}{s.duration_ms!==null&&` · ${(s.duration_ms/1000).toFixed(1)}s`}{s.failure&&` — ${s.failure}`}</li>)}</ul></>}</details>
    </>}
  </section>;
}
