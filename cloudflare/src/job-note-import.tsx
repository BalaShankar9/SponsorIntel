import React,{useEffect,useRef,useState} from 'react';
import {readJobNote,type JobNote} from '../shared/job-note.js';
import {useCareer} from './career-data';

export function JobNoteImport({go}:{go:(view:string)=>void}){
 const c=useCareer(),serial=useRef(0);
 const [preview,setPreview]=useState<(JobNote&{id:string;scope:string})|null>(null),[error,setError]=useState(''),[company,setCompany]=useState(''),[confirmed,setConfirmed]=useState(false),[existingId,setExistingId]=useState('');
 useEffect(()=>{serial.current++;setPreview(null);setConfirmed(false);setExistingId('');setError('');},[c.workspaceScope]);
 useEffect(()=>()=>{serial.current++;},[]);
 async function select(file?:File){
  const token=++serial.current,scope=c.workspaceScope;setPreview(null);setConfirmed(false);setError('');setExistingId('');if(!file)return;
  try{if(file.size>160000)throw Error('Choose a Job notes file smaller than 160 KB.');const note=await readJobNote(await file.text());if(token!==serial.current)return;setPreview({...note,scope});setCompany(note.source.company);}catch(e){if(token===serial.current)setError(e instanceof Error?e.message:'This file could not be reviewed.');}
 }
 function save(){
  if(!preview||!confirmed||!company.trim()||!c.ready)return;
  try {
   const result=c.importJobNote(preview,company,preview.scope);
   if(result.status==='added'){setPreview(null);go('studio');return;}
   setExistingId(result.status==='existing'?result.id:'');
   setError({existing:'This advert already has a workspace. Open it to review changed source text; your existing notes and documents have been kept.',changed:'Your workspace changed. Choose the file again and review it for this account.',ambiguous:'More than one saved role uses this advert link. Open your roles and choose the workspace to keep; nothing was changed.',full:'Your workspace holds 100 applications. Export a backup and remove finished entries to make room.',blocked:'Wait for your workspace to finish loading before importing.'}[result.status]);
  } catch(e) {setError(e instanceof Error?e.message:'This file could not be imported.');}
 }
 return <details className="career-panel"><summary>Bring a role from Job notes</summary><p>Import the public advert and evidence from the browser companion. Review it before adding a role. Your CV and profile stay unchanged.</p><label>Choose Job notes file<input type="file" accept=".json,application/json" onChange={e=>{void select(e.target.files?.[0]);e.target.value='';}}/></label>{error&&<div className="document-ready"><p role="alert">{error}</p>{existingId&&preview?.scope===c.workspaceScope&&<button className="secondary-button" onClick={()=>{if(c.data.applications.some(a=>a.id===existingId)){c.setSelected(existingId);go('studio');}else{setExistingId('');setError('This workspace changed. Review the import again.');}}}>Open existing workspace</button>}</div>}{preview&&<section aria-label="Job notes import preview"><h2>{preview.source.title}</h2><p>{preview.source.location||'Location not supplied'} · observed {preview.source.observedAt}</p><a href={preview.source.url} target="_blank" rel="noopener noreferrer">Inspect original advert</a><label>Confirm the employer<input value={company} maxLength={200} onChange={e=>{setCompany(e.target.value);setConfirmed(false);setExistingId('');setError('');}}/></label><details><summary>Complete captured description ({preview.advert.text.length.toLocaleString()} characters)</summary><pre style={{whiteSpace:'pre-wrap'}}>{preview.advert.text}</pre></details><p>Local wording: {preview.wording.status}. This is not independent verification or a licence match.</p>{preview.wording.evidence.map((e,i)=><blockquote key={i}>{e.quote}</blockquote>)}<label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this complete advert and employer. Add it for preparation; do not submit an application.</label><div className="document-actions"><button className="primary-button" disabled={!c.ready||!confirmed||!company.trim()} onClick={save}>Add role & open Application Studio</button><button className="secondary-button" onClick={()=>{serial.current++;setPreview(null);setExistingId('');setError('');}}>Discard</button></div><p>Your workspace’s existing save/sync status applies. No model call, CV change or application send is triggered by importing.</p></section>}</details>;
}
