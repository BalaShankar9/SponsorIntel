import React,{useState} from 'react';
import {useCareer,download} from './career-data';
export function WorkspaceRecovery(){
 const c=useCareer(),[busy,setBusy]=useState(false),[show,setShow]=useState(false),[message,setMessage]=useState('');
 const copy=c.recoveryCopy,disabled=busy||!c.ready||c.status==='Saving…';
 async function run(action:()=>Promise<void>,success:string){setBusy(true);setMessage('');try{await action();setMessage(success);}catch(e){setMessage(e instanceof Error?e.message:'Your current work was kept.');}finally{setBusy(false);}}
 return <section className="workspace-recovery" aria-label="Cloud workspace recovery">
  <button className="text-button" disabled={disabled||!!copy} onClick={()=>void run(c.reloadCloud,'Latest cloud workspace loaded. Your previous copy is kept privately on this device below.')}>Keep recovery copy & load cloud workspace</button>
  <p className="fine-print">This replaces the workspace shown here. A private recovery copy is kept on this device first; no download is required. If it cannot be kept, the switch stops.</p>
  {message&&<p role="status" className="career-notice">{message}</p>}
  {copy&&<div className="career-panel">
   <h3>Your previous workspace is kept here</h3>
   <p>This recovery copy contains your private CV and applications. It stays on this browser until you remove it or delete your account. Save or restore it before another switch or sign-out.</p>
   {copy.snapshot&&<p className="fine-print">Kept {new Date(copy.snapshot.createdAt).toLocaleString()}</p>}
   <div className="document-actions">
    <button className="secondary-button" onClick={()=>{try{download(copy.snapshot?JSON.stringify(copy.snapshot.data,null,2):copy.raw,'sponsor-intel-recovery-copy.json','application/json');setMessage('Download requested. Check the saved file; the recovery copy remains here.');}catch{setShow(true);setMessage('Download unavailable. Copy the backup text below; the recovery copy remains here.');}}}>Download recovery copy</button>
    <button className="text-button" onClick={()=>setShow(!show)}>{show?'Hide recovery text':'View recovery text'}</button>
    <button className="secondary-button" disabled={disabled||!copy.snapshot} onClick={()=>{if(window.confirm('Replace the workspace shown here with this recovery copy? It will use the normal cloud save checks. The recovery copy remains available.'))void run(c.restoreRecovery,'Recovery copy restored in your workspace. Check the sync status; the recovery copy remains here.');}}>Restore recovery copy</button>
    <button className="text-button" disabled={disabled} onClick={()=>{if(window.confirm('Remove this device’s recovery copy? Check your downloaded file or restored workspace first. This does not delete your current workspace.')){try{c.removeRecovery();setMessage('Recovery copy removed from this device.');setShow(false);}catch(e){setMessage((e as Error).message);}}}}>Remove recovery copy</button>
   </div>
   {show&&<textarea aria-label="Private recovery backup JSON" readOnly rows={9} value={copy.snapshot?JSON.stringify(copy.snapshot.data,null,2):copy.raw}/>}
  </div>}
 </section>;
}
