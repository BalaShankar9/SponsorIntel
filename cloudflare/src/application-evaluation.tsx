import React,{useEffect,useRef,useState} from 'react';
import {FlaskConical,RefreshCw} from 'lucide-react';
import './application-evaluation.css';
import {ApplicationAssessment,ApplicationAssessmentSummary,type AssessmentSummary} from './application-assessments';
type Snapshot={enabled:boolean;evaluation_enabled:boolean;state:string;total:number;completed:number;scope:string;budget:{runs:number;calls:number;run_limit:number;call_limit:number};cases:{id:string;kind:string;title:string;review_question:string}[];runs:{id:string;day:string;state:string;trigger_kind:string;calls:number;case_ids:string[];error:string|null;created_at:string;result:{cases:{id:string;assessment:string;stages:{stage:string;state:string;screening?:{missing_anchors:string[];flagged_patterns:string[]}}[]}[]}|null}[]};
// This panel displays only authored fictional fixtures and private evaluation results.
async function api(path='',body?:unknown){const r=await fetch('/api/admin/application-evaluation'+path,body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const v=await r.json();if(!r.ok)throw Error(v.error||'The evaluation action could not be confirmed.');return v;}
const label=(s:string)=>s.replaceAll('_',' ');
export function ApplicationEvaluation(){
 const [data,setData]=useState<(Snapshot&{assessments:AssessmentSummary})|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[detail,setDetail]=useState<any>(null),[detailError,setDetailError]=useState('');
 const selectedRef=useRef(selected);selectedRef.current=selected;
 const refresh=async()=>{setBusy(true);setError('');try{setData(await api());if(selected){const current=await api('/case?id='+encodeURIComponent(selected));if(selectedRef.current===selected)setDetail(current);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 useEffect(()=>{refresh();},[]);
 useEffect(()=>{let active=true;setDetail(null);setDetailError('');if(selected)api('/case?id='+encodeURIComponent(selected)).then(d=>{if(active)setDetail(d);}).catch(e=>{if(active)setDetailError(e.message);});return()=>{active=false;};},[selected]);
 async function action(path:string,body:unknown){setBusy(true);setError('');try{await api(path,body);setData(await api());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const attemptedToday=data?.runs.some(r=>r.day===new Date().toISOString().slice(0,10));
 const allowanceUsed=!!data&&(data.budget.runs>=data.budget.run_limit||data.budget.calls>26);
 const displayState=!data?.enabled?'paused':data.state==='ready'&&allowanceUsed?'waiting for allowance':data.state;
 return <section className="career-panel application-evaluation" aria-label="Application quality lab">
  <div className="support-heading"><div><p className="eyebrow">CHECK THE WRITING, NOT JUST THE COUNTERS</p><h2><FlaskConical size={22}/> Application quality lab</h2></div><button className="secondary-button" disabled={busy} onClick={refresh}><RefreshCw size={15}/> Refresh application tests</button></div>
  <p>The replacement reviewer is being compared with the current reviewer on the same draft. It is not used for customer applications until its quality is independently reviewed.</p>
  {error&&<p role="alert" className="career-error">{error}</p>}
  {!data?<p>Loading application evaluation…</p>:<>
   <div className="support-totals"><div><strong>{data.completed}/{data.total}</strong><span>Cases with execution receipts</span></div><div><strong>{label(displayState)}</strong><span>Evaluation status, not writing quality</span></div><div><strong>{data.budget.calls}/{data.budget.call_limit}</strong><span>Shared model calls today</span></div><div><strong>Off</strong><span>Automatic reviewer promotion</span></div></div>
   <p className="fine-print">Shared agent starts today: {data.budget.runs}/{data.budget.run_limit}. {allowanceUsed?"Today’s remaining allowance cannot start this paired test; it waits for an eligible UTC day. ":""}{data.scope} Completed cases still need factual, omission and writing-quality review. Literal screening can miss wrong implications or flag a valid phrasing; zero flags do not prove accuracy.</p>
   <div className="support-heading"><button className="secondary-button" disabled={busy||!data.enabled||data.state!=='ready'||attemptedToday||data.budget.runs>=data.budget.run_limit||data.budget.calls>26} onClick={()=>action('/run',{})}>Run today’s paired test</button><button className="secondary-button" disabled={busy} onClick={()=>action('/settings',{enabled:!data.evaluation_enabled})}>{data.evaluation_enabled?'Pause application tests':'Resume application tests'}</button></div>
   {data.assessments&&<ApplicationAssessmentSummary data={data.assessments}/>}
   <details className="application-test-details"><summary>Run receipts and limits</summary>{data.runs.length?data.runs.map(r=><article className="support-report" key={r.id}><strong>{r.day} · {label(r.state)}</strong><p>{r.trigger_kind} trigger · {r.calls}/6 reserved calls · {r.case_ids.length} cases</p>{r.error&&<p>{r.error}</p>}<p className="fine-print">{r.id}</p></article>):<p>No model comparison has run yet.</p>}<p className="fine-print">Each run keeps its actual origin, input fingerprint, both reviewers and failed outcomes. Unknown model outcomes halt progression. Pausing business operations also pauses new evaluation calls.</p></details>
   <details className="application-test-details"><summary>Inspect the 20 fictional cases and their drafts</summary><label>Case<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a case</option>{data.cases.map(c=><option key={c.id} value={c.id}>{c.title} · {c.kind==='cv'?'CV':'letter'} · {c.id}</option>)}</select></label>
    {detailError&&<p role="alert">{detailError}</p>}{selected&&!detail&&!detailError&&<p>Loading case…</p>}
    {detail&&<div className="support-report"><h3>{detail.case.application.title}</h3><p>{detail.case.review_questions}</p><h4>Original fictional CV</h4><pre>{detail.case.profile.cv}</pre><h4>Fictional advert</h4><pre>{detail.case.application.description}</pre><h4>Retained drafts</h4><p className="fine-print">Up to 30 recent outputs are shown, with the latest ten assessments per output.</p>{detail.steps.length?detail.steps.map((s:any)=><div key={s.run_id+':'+s.stage}><strong>{{write:'Original draft',baseline:'Current reviewer',candidate:'Candidate reviewer'}[s.stage as string]||s.stage} · {s.state}</strong>{s.output?.text&&<pre>{s.output.text}</pre>}{s.error&&<p>{s.error}</p>}<small>{s.run_id}</small><ApplicationAssessment step={s} caseId={detail.case.id} onSaved={async()=>{const caseId=detail.case.id;const current=await api('/case?id='+encodeURIComponent(caseId));if(selectedRef.current===caseId)setDetail(current);setData(await api());}}/></div>):<p>No model output yet.</p>}</div>}
   </details>
  </>}
 </section>;
}
