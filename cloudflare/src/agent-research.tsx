import React, { useEffect, useState } from 'react';
import { BrainCircuit, FlaskConical, SearchCheck } from 'lucide-react';

type Assessment = { job_id:string; verdict:string; quote:string; reason:string };
type Report = {
  report:{ summary:string; assessments:Assessment[]; next_checks:string[] };
  review?:{ checks:{ job_id:string; supported:boolean; reason:string }[] };
  revision?:boolean; remembered_observations?:number;
  limitations?:string[];
  evidence?:{ id:string;title:string;company:string;url:string|null;observed_at:string;current:boolean;complete:boolean;stored_verdict?:string }[];
  decisions?:{ tool:string;purpose:string }[];
  evaluation?:{ correct:number;total:number;dangerous_false_positives:number;cases:{id:string;correct:boolean;expected:string;actual:string}[] };
};
type Run = {id:string;kind:string;state:string;created_at:string;calls:number;report:Report|null;error:string|null};
type Data = { enabled:boolean;models:Record<string,{provider:string;model:string}>;
  budget:{runs:number;calls:number;run_limit:number;call_limit:number};runs:Run[];
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
        <button className="secondary-button" disabled={busy} onClick={()=>void load()}>Refresh research</button>
      </div>
      <p className="fine-print">{data.budget.runs}/{data.budget.run_limit} shared research and marketing attempts · {data.budget.calls}/{data.budget.call_limit} reserved model calls today (UTC). Only public adverts, guides and operational data are used. No CVs or account details.</p>
      {!premium&&<p className="fine-print">Frontier model connections are prepared but not enabled. These models have not yet passed a representative real-advert benchmark.</p>}
      {data.runs.length>0&&<label className="research-history">Investigation history<select value={run?.id||''} onChange={e=>setSelected(e.target.value)}>{data.runs.map(r=><option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString('en-GB')} · {r.kind} · {r.state}</option>)}</select></label>}
      {run&&<article className="research-result"><div className="agent-heading"><h3>{run.kind==='evaluation'?'Capability test':'Job quality investigation'}</h3><span className="agent-pill">{label(run.state)} · {run.calls} model calls</span></div>
        {run.error&&<p className="career-error">{run.error}</p>}
        {run.state==='failed'&&run.calls<=6&&Date.now()-Date.parse(run.created_at)<3600000&&<button className="secondary-button" disabled={busy||active} onClick={()=>void act('/recover',{run_id:run.id})}>Recover this investigation</button>}
        {['queued','running'].includes(run.state)&&<><p>The investigation continues on Cloudflare when you leave this page.</p><button className="secondary-button" disabled={busy} onClick={()=>void act('/reconcile',{run_id:run.id})}>Check execution status</button></>}
        {result&&<>
          <p>The investigator assessed {result.report.assessments.length} {result.report.assessments.length===1?'advert':'adverts'}. Its classifications and supporting evidence are shown below.</p>
          <details className="agent-panel"><summary>Investigator’s draft summary · not independently verified</summary><p>{result.report.summary}</p><p className="fine-print">The separate reviewer checks the advert assessments below. This narrative is a draft and cannot be added to learning memory.</p></details>
          {result.limitations?.map((s,i)=><p className="career-error" key={i}>{s}</p>)}
          <p className="fine-print">{!result.review?'Incomplete draft — independent review has not completed. ':result.revision?'Revised after independent criticism. ':'Independent review recorded. '}Model agreement is not proof of correctness. Public job labels are unchanged.</p>
          {result.evaluation&&<div className="research-score"><strong>{result.evaluation.correct}/{result.evaluation.total}</strong><span>Synthetic challenges correct</span><span>{result.evaluation.dangerous_false_positives} false sponsorship positives</span><p>This small authored test measures specific failure cases. It is not a real-world accuracy score.</p></div>}
          {result.decisions&&result.decisions.length>0&&<details className="agent-panel"><summary>What the investigator chose to check</summary><ol>{result.decisions.map((d,i)=><li key={i}><strong>{label(d.tool)}</strong> — {d.purpose}</li>)}</ol></details>}
          <div className="research-assessments">{result.report.assessments.map(a=>{
            const evidence=result.evidence?.find(e=>e.id===a.job_id),review=result.review?.checks.find(c=>c.job_id===a.job_id),memory=data.memories.find(m=>m.job_id===a.job_id);
            return <article key={a.job_id}><div className="agent-heading"><h4>{evidence?.title||a.job_id}</h4><span className="agent-pill">{label(a.verdict)}</span></div>
              {evidence&&<p className="fine-print">{evidence.company}{evidence.stored_verdict&&` · Current site label: ${label(evidence.stored_verdict)}`}</p>}
              {a.quote&&<blockquote>{a.quote}</blockquote>}<p>{a.reason}</p>
              {review&&<p className={review.supported?'research-supported':'career-error'}><strong>{review.supported?'Reviewer supports':'Reviewer disagrees'}:</strong> {review.reason}</p>}
              {evidence?.url&&<a href={evidence.url} target="_blank" rel="noreferrer">Read the employer’s original advert ↗</a>}
              {run.kind==='research'&&<div className="agent-actions"><button className="secondary-button" disabled={busy||!!memory||!review?.supported||!evidence?.complete||!evidence.current} onClick={()=>void act('/remember',{run_id:run.id,job_id:a.job_id,confirmed:true})}>{memory?'Observation remembered':'I checked this label and quote — remember them'}</button></div>}
            </article>;
          })}</div>
          {result.report.next_checks.length>0&&<><h4>Still needs investigation</h4><ul>{result.report.next_checks.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
        </>}
      </article>}
      <details className="agent-panel"><summary>Learning and execution records</summary><p>{data.memories.length} approved observations with unexpired retention. They are reused only after a fresh advert fetch matches the saved content exactly. Each expires after seven days.</p><p>Learning does not alter model weights, grant new permissions or deploy code. Model and prompt upgrades require new test results and a reviewed release.</p>
      {data.steps.length>0&&<><h4>Latest investigation’s execution records</h4><ul>{data.steps.map(s=><li key={s.name}>{label(s.name)} · {s.role} · {s.state}{s.duration_ms!==null&&` · ${(s.duration_ms/1000).toFixed(1)}s`}{s.failure&&` — ${s.failure}`}</li>)}</ul></>}</details>
    </>}
  </section>;
}
