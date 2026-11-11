import React,{useId,useMemo} from 'react';
import {draftSourceChecks} from '../shared/draft-source-check.js';
import './draft-source-comparison.css';
export type ComparisonProfile={name?:string;email?:string;phone?:string;cv?:string};
export function DraftSourceComparison({text,kind,profile,sourceLabel,onLocate}:{text:string;kind:string;profile:ComparisonProfile|null;sourceLabel:string;onLocate?:(offset:number,length:number)=>void}){
 const id=useId(),check=useMemo(()=>draftSourceChecks(text,kind),[text,kind]);
 if(check.state==='not_applicable'||check.state==='empty')return null;
 return <section className="draft-source-comparison" aria-labelledby={id}>
  <h3 id={id}>Check this draft against your source</h3>
  <p>Compare every claim, date, qualification and project with your own evidence. These reading prompts run in your browser and do not send another AI request or verify accuracy.</p>
  <p className="draft-source-status">{check.state==='too_long'?'This document is outside the reading-prompt size limit. No phrase checks were run; review the complete document yourself.':check.total?`${check.total} wording ${check.total===1?'prompt':'prompts'} to review${check.limited?' · first 24 shown':''}. A prompt is a question, not proof of an error.`:'No phrases matched these limited checks. This is not an all-clear: unsupported skills, dates or other claims can still be present.'}</p>
  {check.matches.length>0&&<details><summary>Inspect wording prompts · {check.matches.length}{check.limited?' of '+check.total:''}</summary><ol>{check.matches.map(m=><li key={m.id+':'+m.offset}><strong>{m.label}</strong><blockquote>{m.excerpt_start>0?'…':''}{m.excerpt}{m.excerpt_end<text.length?'…':''}</blockquote><p>{m.question}</p>{onLocate&&<button type="button" className="text-button" onClick={()=>onLocate(m.offset,m.length)}>Find this wording in the draft</button>}</li>)}</ol></details>}
  <details><summary>{sourceLabel}</summary>{profile?<><dl>{[['Name',profile.name],['Email',profile.email],['Phone',profile.phone]].filter(([,v])=>v).map(([label,value])=><React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl><pre>{profile.cv||'No source CV is available for this comparison.'}</pre></>:<p>The matching source snapshot is unavailable. Do not substitute your current CV for this historical version.</p>}</details>
  <p className="draft-source-note">A matching phrase does not prove the claim. Check personal versus workplace projects, individual versus team contributions, and planned versus completed work. Leave unknown answers unknown. A short truthful letter is better than padding to meet a word target. Edit your document in Studio; this view never rewrites or approves it.</p>
 </section>;
}
