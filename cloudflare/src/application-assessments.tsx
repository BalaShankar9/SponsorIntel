import React,{useEffect,useRef,useState} from 'react';
import {APPLICATION_RUBRIC,ASSESSMENT_LIMITATION} from '../shared/application-assessment.js';
type Verdict='acceptable'|'needs_work'|'not_assessed';
type Content={ratings:Record<string,Verdict>;rationale:string;evidence:{source:string;quote:string}[];outcome:string};
type Assessment={id:string;revision:number;created_at:string;content:Content};
export type AssessmentStep={run_id:string;stage:string;assessment_target:{fingerprint:string;revision:number}|null;assessment_unavailable:string|null;assessment:Assessment|null;assessment_current:boolean;assessment_history:Assessment[]};
export type AssessmentSummary={assessable_outputs:number;assessed_outputs:number;unassessed_outputs:number;needs_work:number;incomplete:number;stale:number;limited:boolean;groups:{profile_fingerprint:string;writer:string;reviewer:string;policy:string;paired_cases:number;both_acceptable:number;candidate_only_acceptable:number;baseline_only_acceptable:number;both_need_work:number}[]};
const blank=()=>Object.fromEntries(APPLICATION_RUBRIC.map(c=>[c.id,'not_assessed' as Verdict]));
const label=(v:string)=>v.replaceAll('_',' ');
export function ApplicationAssessmentSummary({data}:{data:AssessmentSummary}){
 return <section aria-labelledby="application-assessment-heading" className="application-test-details"><h3 id="application-assessment-heading">Evidence assessments</h3>
  <p>{data.assessed_outputs} of {data.assessable_outputs} completed outputs have a current recorded assessment. {data.needs_work} need work; {data.incomplete} have unassessed criteria; {data.stale} refer to changed evidence.</p>
  <p className="fine-print">{ASSESSMENT_LIMITATION}</p>
  {!data.assessable_outputs&&<p>Assessments become available when a model test finishes and retains a draft. No quality result is inferred while waiting.</p>}
  {data.groups.length?<div className="application-assessment-comparisons">{data.groups.map((g,i)=><article key={g.profile_fingerprint}><h4>Comparison group {i+1} · {g.paired_cases} assessed pairs</h4><p>Both acceptable: {g.both_acceptable} · Candidate only acceptable: {g.candidate_only_acceptable} · Current reviewer only acceptable: {g.baseline_only_acceptable} · Both need work: {g.both_need_work}</p><details><summary>Comparison scope</summary><p>Each pair uses the same original draft and recorded assessor, with every criterion assessed. Different configurations stay separate. These counts describe judgments on this development set; they do not establish accuracy or a better model.</p><p className="fine-print">Writer: {g.writer}<br/>Reviewer: {g.reviewer}<br/>Policy: {g.policy}<br/>Configuration: {g.profile_fingerprint.slice(0,16)}</p></details></article>)}</div>:<p className="fine-print">A comparison needs both reviewer outputs assessed by the same recorded owner, with every criterion covered.</p>}
  {data.limited&&<p role="status">Only the most recent 120 outputs are included. Review the retained case history before drawing conclusions.</p>}
 </section>;
}
export function ApplicationAssessment({step,caseId,onSaved}:{step:AssessmentStep;caseId:string;onSaved:()=>Promise<void>}){
 const [ratings,setRatings]=useState<Record<string,Verdict>>(blank),[rationale,setRationale]=useState(''),[quote,setQuote]=useState(''),[source,setSource]=useState('cv'),[sourceQuote,setSourceQuote]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const attempt=useRef<Record<string,unknown>|null>(null);
 useEffect(()=>{const content=step.assessment_current?step.assessment?.content:null;setRatings(content?.ratings||blank());setRationale(content?.rationale||'');setQuote(content?.evidence.find(e=>e.source==='output')?.quote||'');const evidence=content?.evidence.find(e=>e.source!=='output');setSource(evidence?.source||'cv');setSourceQuote(evidence?.quote||'');setUncertain(false);attempt.current=null;},[step.assessment_target?.fingerprint,step.assessment_target?.revision,step.assessment_current]);
 async function save(event:React.FormEvent){
  event.preventDefault();if(!step.assessment_target||busy)return;
  setBusy(true);setError('');setMessage('');
  if(!attempt.current)attempt.current={run_id:step.run_id,case_id:caseId,stage:step.stage,fingerprint:step.assessment_target.fingerprint,revision:step.assessment_target.revision,ratings,rationale,evidence:[{source:'output',quote},{source,quote:sourceQuote}],request_key:crypto.randomUUID()};
  let confirmed=false;
  try{
   const response=await fetch('/api/admin/application-evaluation/assessment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.current)});
   const result=await response.json();
   if(!response.ok){if([400,403,409,429].includes(response.status)){attempt.current=null;setUncertain(false);}else setUncertain(true);throw Error(result.error||'The save could not be confirmed. Retry this same assessment request.');}
   confirmed=true;attempt.current=null;setUncertain(false);setMessage('Assessment saved. The original draft and earlier assessments are preserved.');
   try{await onSaved();}catch{setMessage('Assessment saved, but the refreshed view could not load. Refresh the case before another edit.');}
  }catch(e){if(!confirmed&&attempt.current)setUncertain(true);setError((e as Error).message||'Save not confirmed. Retry the same request or refresh its history.');}
  finally{setBusy(false);}
 }
 return <details className="application-assessment"><summary>{step.assessment_current?'Recorded assessment · '+label(step.assessment!.content.outcome):step.assessment?'Evidence changed · assessment needs review':'Assess this output'}</summary>
  {!step.assessment_target?<p>{step.assessment_unavailable||'A completed, retained output is required.'}</p>:<form onSubmit={save}>
   <p>Compare this output with the original fictional CV and advert above. Leave any criterion you have not checked as “Not assessed”. The record is attributed to the signed-in owner; it does not certify independent human review.</p>
   <fieldset disabled={busy||uncertain}><legend>Assess the writing</legend><div className="application-assessment-rubric">{APPLICATION_RUBRIC.map(c=><label key={c.id}>{c.label}<small>{c.help}</small><select value={ratings[c.id]} onChange={e=>setRatings({...ratings,[c.id]:e.target.value as Verdict})}><option value="not_assessed">Not assessed</option><option value="acceptable">Acceptable on this case</option><option value="needs_work">Needs work</option></select></label>)}</div>
    <label>Reason for this assessment<textarea required minLength={30} maxLength={2000} value={rationale} onChange={e=>setRationale(e.target.value)} placeholder="Explain the supported claims, omissions or corrections that led to your judgment."/></label>
    <label>Passage from this output<textarea required minLength={10} maxLength={1500} value={quote} onChange={e=>setQuote(e.target.value)} placeholder="Copy a short passage exactly from the retained draft."/></label>
    <label>Source to compare<select value={source} onChange={e=>setSource(e.target.value)}><option value="cv">Original fictional CV</option><option value="advert">Fictional advert</option></select></label>
    <label>Passage from the selected source<textarea required minLength={10} maxLength={1500} value={sourceQuote} onChange={e=>setSourceQuote(e.target.value)} placeholder="Copy its supporting or contradictory source passage."/></label>
    <p className="fine-print">Quotation matching checks the location of your evidence, not whether your reasoning is correct. An advert requirement is not a candidate qualification.</p>
   </fieldset>
   {error&&<p role="alert" className="career-error">{error}</p>}{message&&<p role="status">{message}</p>}
   {uncertain&&<p role="status">The save is unconfirmed. Retry reuses the exact same request to prevent duplicates; refresh the case to inspect its history before editing.</p>}
   <button className="secondary-button" disabled={busy||Object.values(ratings).every(v=>v==='not_assessed')} type="submit">{busy?'Saving…':uncertain?'Retry the same assessment':step.assessment?'Save a revised assessment':'Save assessment'}</button>
  </form>}
  {!!step.assessment_history.length&&<details><summary>Assessment history · latest {step.assessment_history.length}</summary>{step.assessment_history.map(a=><article key={a.id}><h5>Revision {a.revision} · {label(a.content.outcome)}</h5><p className="fine-print">Owner-recorded · {new Date(a.created_at).toLocaleString('en-GB')}</p><p>{a.content.rationale}</p><ul>{APPLICATION_RUBRIC.map(c=><li key={c.id}>{c.label}: {label(a.content.ratings[c.id])}</li>)}</ul>{a.content.evidence.map((e,i)=><blockquote key={i}>{e.quote}<small>Source: {e.source==='cv'?'fictional CV':e.source==='advert'?'fictional advert':'retained output'}</small></blockquote>)}</article>)}</details>}
 </details>;
}
