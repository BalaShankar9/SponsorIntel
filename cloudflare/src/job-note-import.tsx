import React,{useEffect,useRef,useState} from 'react';
import {readJobNote,type JobNote} from '../shared/job-note.js';
import {useCareer,stamp} from './career-data';

export function JobNoteImport({go}:{go:(view:string)=>void}){
 const c=useCareer(),serial=useRef(0);
 const [preview,setPreview]=useState<(JobNote&{id:string})|null>(null),[error,setError]=useState(''),[company,setCompany]=useState(''),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{serial.current++;setPreview(null);setConfirmed(false);},[c.user?.id]);
 useEffect(()=>()=>{serial.current++;},[]);
 async function select(file?:File){
  const token=++serial.current;setPreview(null);setConfirmed(false);setError('');if(!file)return;
  try{if(file.size>160000)throw Error('Choose a Job notes file smaller than 160 KB.');const note=await readJobNote(await file.text());if(token!==serial.current)return;setPreview(note);setCompany(note.source.company);}catch(e){if(token===serial.current)setError(e instanceof Error?e.message:'This file could not be reviewed.');}
 }
 function save(){
  if(!preview||!confirmed||!company.trim()||!c.ready)return;
  const existing=c.data.applications.find(a=>a.jobId===preview.id||a.url===preview.source.url);
  if(existing){c.setSelected(existing.id);setError('This advert already has a workspace. Open it to review changed source text; your existing documents have been kept.');return;}
  const id=c.saveJob({id:"manual-"+crypto.randomUUID(),company:company.trim(),title:preview.source.title,location:preview.source.location,description:preview.advert.text,apply_url:preview.source.url,provider:'manual',sponsorship:'not_stated',evidence:'',last_seen:'',first_seen:stamp(),level:'not_stated'});
  if(!id)return;
  c.updateApplication(id,{notes:`Imported external advert, observed ${preview.source.observedAt}. Source: ${preview.source.url}\nText SHA-256: ${preview.advert.sha256}\nLocal wording result: ${preview.wording.status}; not independently verified. Complete wording is retained in the job description. Original employer application route, vacancy freshness and legal-employer/licence identity require review. Import is preparation, not application submission.`});
  setPreview(null);go('studio');
 }
 return <details className="career-panel"><summary>Bring a role from Job notes</summary><p>Import the public advert and evidence from the browser companion. Review it before adding a role. Your CV and profile stay unchanged.</p><label>Choose Job notes file<input type="file" accept=".json,application/json" onChange={e=>{void select(e.target.files?.[0]);e.target.value='';}}/></label>{error&&<p role="alert">{error}</p>}{preview&&<section aria-label="Job notes import preview"><h2>{preview.source.title}</h2><p>{preview.source.location||'Location not supplied'} · observed {preview.source.observedAt}</p><a href={preview.source.url} target="_blank" rel="noopener noreferrer">Inspect original advert</a><label>Confirm the employer<input value={company} maxLength={200} onChange={e=>{setCompany(e.target.value);setConfirmed(false);}}/></label><details><summary>Complete captured description ({preview.advert.text.length.toLocaleString()} characters)</summary><pre style={{whiteSpace:'pre-wrap'}}>{preview.advert.text}</pre></details><p>Local wording: {preview.wording.status}. This is not independent verification or a licence match.</p>{preview.wording.evidence.map((e,i)=><blockquote key={i}>{e.quote}</blockquote>)}<label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this complete advert and employer. Add it for preparation; do not submit an application.</label><div className="document-actions"><button className="primary-button" disabled={!c.ready||!confirmed||!company.trim()} onClick={save}>Add role & open Application Studio</button><button className="secondary-button" onClick={()=>{serial.current++;setPreview(null);}}>Discard</button></div><p>Your workspace’s existing save/sync status applies. No model call, CV change or application send is triggered by importing.</p></section>}</details>;
}
