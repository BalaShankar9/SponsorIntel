import React,{useState,useRef} from 'react';
type Progress={dataset:string;state:string;evaluated_adverts:number;total_adverts:number;completed_batches:number;total_batches:number;correct:number;scored:number;ambiguous:number;disputed_items:number};
export type ReferenceComparison={control:{campaign:string;enabled:boolean;revision:number;reason:string;updated_at:string|null};available:boolean;source_sha256:string|null;original:Progress;candidate:Progress};
type Review={source_sha256:string|null;action:string;expected_revision:number;request_id:string;reason:string};
export function ResearchComparison({data,active,refresh}:{data:ReferenceComparison;active:boolean;refresh:()=>Promise<void>}) {
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false);
  const pending=useRef<Review|null>(null),prepared=data.control.campaign===data.candidate.dataset;
  async function act(action:string){
    if(busy)return;setBusy(true);setNotice('');
    const request=pending.current||{action,expected_revision:data.control.revision,request_id:crypto.randomUUID(),reason,source_sha256:data.source_sha256};pending.current=request;
    try{
      const response=await fetch('/api/admin/agents/research/reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
      const result=await response.json();
      if(!response.ok){if(response.status<500){pending.current=null;setUncertain(false);}throw Error(result.error||'The comparison could not be reviewed.');}
      pending.current=null;setUncertain(false);setReason('');setNotice(result.message);await refresh();
    }catch(e){setNotice((e as Error).message);if(pending.current)setUncertain(true);}
    finally{setBusy(false);}
  }
  return <section className="agent-panel" aria-label="Research comparison controls">
    <h3>Review the research improvement</h3>
    <p>The compact comparison reads the same 50 complete archived adverts in the same 16 batches. It sends each advert once, keeps reasoning enabled, and asks the different-model reviewer for a bounded format. Its quality is unproven.</p>
    <p className="fine-print">Original results remain separate, including failed attempts. Models, call limits and the daily schedule stay the same. Preparing the comparison leaves it paused and makes no model call. Resuming does not retry an already held day.</p>
    {data.source_sha256&&<p className="fine-print">Comparison version: {data.source_sha256.slice(0,16)} · complete source identity retained with each attempt.</p>}
    <dl>{[["Original comparison",data.original],["Compact comparison",data.candidate]].map(([name,item])=>{const p=item as Progress;return <React.Fragment key={name as string}><dt><strong>{name as string}</strong></dt><dd>{p.evaluated_adverts}/{p.total_adverts} adverts · {p.state.replaceAll('_',' ')}{p.scored>0&&` · ${p.correct}/${p.scored} provisional agreements · ${p.disputed_items} disputed items`}</dd></React.Fragment>;})}</dl>
    {data.control.reason&&<p className="fine-print">Last recorded review: {data.control.reason}</p>}
    <label>Evidence and reason for this change<textarea maxLength={1200} value={reason} disabled={busy||uncertain} onChange={e=>setReason(e.target.value)} placeholder="Record the diagnosis, checked evidence and why this comparison should be prepared, resumed or paused."/></label>
    <div className="agent-actions">{uncertain?<button className="secondary-button" disabled={busy} onClick={()=>void act(pending.current!.action)}>Recheck the same review request</button>:<>
      {!prepared?<button className="secondary-button" disabled={busy||active||!data.available||reason.trim().length<30||!['needs_attention','complete'].includes(data.original.state)} onClick={()=>void act('prepare')}>Prepare separate paused comparison</button>:<>
        <button className="secondary-button" disabled={busy||active||data.control.enabled||!data.available||reason.trim().length<30||!['paused','ready'].includes(data.candidate.state)} onClick={()=>void act('resume')}>Resume reviewed comparison</button>
        <button className="secondary-button" disabled={busy||!data.control.enabled||reason.trim().length<30} onClick={()=>void act('pause')}>Pause comparison</button>
      </>}
    </>}</div>
    {notice&&<p role="status">{notice}</p>}
    {uncertain&&<p className="fine-print">The outcome is not confirmed. Rechecking uses the identical request; it cannot create a second review or model call.</p>}
  </section>;
}
