import React,{useRef,useState} from 'react';
import {prepareScheduleSave,sendScheduleSave,ScheduleSaveError,type ScheduleBrief,type ScheduleDestination,type ScheduleForm} from '../shared/marketing-schedule-save.js';

export function MarketingSchedule({brief,destination,onSaved,onLockChange,disabled=false}:{brief:ScheduleBrief;destination:ScheduleDestination;onSaved:()=>Promise<void>;onLockChange:(locked:boolean)=>void;disabled?:boolean}){
 const[form,setForm]=useState<ScheduleForm>({external:'',observed:'',scheduled:'',note:'',observer:'agent_assisted',checked:false,mediaChecked:false});
 const[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const request=useRef<string|null>(null),sending=useRef(false);
 const locked=pending||saved||busy,timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const update=(key:keyof ScheduleForm,value:string|boolean)=>setForm(f=>({...f,[key]:value}));
 async function save(event:React.FormEvent){
  event.preventDefault();if(sending.current||saved||disabled)return;
  sending.current=true;setBusy(true);setError('');
  try{
   request.current??=prepareScheduleSave(brief,destination,form);
   setPending(true);onLockChange(true);
   await sendScheduleSave(request.current);
   setSaved(true);setPending(false);
  }catch(e){
   setError((e as Error).message);
   if(!request.current||(e instanceof ScheduleSaveError&&!e.uncertain)){request.current=null;setPending(false);onLockChange(false);}
   return;
  }finally{sending.current=false;setBusy(false);}
  // A failed read after an acknowledged write must never offer another save.
  try{await onSaved();}catch{setError('The record was saved, but the desk could not refresh. Refresh the desk to view it; do not schedule or save another post.');}
 }
 function date(key:'observed'|'scheduled',label:string){return <label>{label}<input type="datetime-local" step="1" required value={form[key]} onInput={e=>update(key,e.currentTarget.value)} onChange={e=>update(key,e.target.value)}/></label>;}
 return <details className="marketing-schedule">
  <summary>Record an existing provider schedule</summary>
  <form className="marketing-decision" onSubmit={e=>void save(e)}>
   <h4>Save the provider’s schedule receipt</h4>
   <p className="business-fine">Use this after the provider confirms the exact reviewed copy is queued. This saves an observation only; it does not publish, schedule or cancel a post. Check the provider queue, duplication and the shared posting allowance first.</p>
   <p className="business-fine">Required provider: <strong>{destination.provider}</strong> · Account: <strong>{destination.account}</strong></p>
   <fieldset disabled={locked||disabled}>
    <label>Provider schedule reference<input required maxLength={200} value={form.external} onChange={e=>update('external',e.target.value)}/></label>
    <p className="business-fine">Enter the times actually shown or observed, in this browser’s timezone ({timezone}). A planner suggestion is not a confirmed provider schedule. Saved times use UTC.</p>
    <div className="performance-fields">{date('observed','Provider inspected at')}{date('scheduled','Provider scheduled for')}</div>
    <label>Observation made by<select value={form.observer} onChange={e=>update('observer',e.target.value)}><option value="agent_assisted">Agent-assisted through owner account</option><option value="owner">Owner personally</option></select></label>
    <label>Provider evidence and limitations<textarea required minLength={20} maxLength={1000} rows={3} value={form.note} onChange={e=>update('note',e.target.value)}/></label>
    <label className="marketing-check"><input type="checkbox" checked={form.checked} onChange={e=>update('checked',e.target.checked)}/>I checked the exact account, reviewed copy, evidence freshness, provider queue and posting allowance.</label>
    {!!brief.media.length&&<label className="marketing-check"><input type="checkbox" checked={form.mediaChecked} onChange={e=>update('mediaChecked',e.target.checked)}/>I verified the ordered images and accessibility text match this reviewed version.</label>}
   </fieldset>
   {pending&&!busy&&<p className="marketing-attention" role="status">Save outcome uncertain. The fields and original request are retained in this open page. Check the existing job; the retry below only repeats this ledger request. Reloading or leaving the page loses the pending request, so reconcile the saved ledger before starting again.</p>}
   {saved?<p role="status">Schedule record saved. No post was sent. Refresh the marketing desk to inspect its retained receipt.</p>:<button type="submit" disabled={busy||disabled||(!pending&&(!form.checked||(!!brief.media.length&&!form.mediaChecked)))}>{busy?'Saving schedule record…':pending?'Retry this same ledger record':'Save schedule record'}</button>}
   {error&&<p className="career-error" role="alert">{error}</p>}
  </form>
 </details>;
}
