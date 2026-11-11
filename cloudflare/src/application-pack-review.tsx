import React,{useState,useEffect,useRef} from 'react';
import {download} from './career-data';
import {packLabels,type PackDocument} from '../shared/application-pack.js';
import {factAnswerFields} from '../shared/application-facts.js';
import {DraftSourceComparison,type ComparisonProfile} from './draft-source-comparison';

export type PackReview={role_id:string;version:number;status:string;payload_hash:string;approved_at:string;request_key:string;revoke_request_key:string|null;revoked_at:string|null};
type Attempt={path:string;body:Record<string,unknown>};
type Payload={scope:string;role:{company:string;title:string;url:string;location:string;source_kind:string;sponsorship:string;evidence:string};facts:{version:number;hash:string;answers:Record<string,string|null>}|null;documents:PackDocument[]};
type Preview={comparison_source?:{profile:ComparisonProfile;version:number;hash:string;status:string}|null;payload:Payload|null;payload_hash:string;can_approve:boolean;previous_version:number;issues:string[];record?:PackReview;accountId:string;workspace_hash:string};
export function ApplicationPackReview({account,batch,roleId,reviews,blocked,busy,pending,onSend}:{account:string;batch:{id:string;revision:number};roleId:string;reviews:PackReview[];blocked:boolean;busy:boolean;pending:Attempt|null;onSend:(a:Attempt)=>Promise<void>}) {
 const [preview,setPreview]=useState<Preview|null>(null),[loading,setLoading]=useState(false),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 const serial=useRef(0),path='/api/career/batches/'+batch.id,latest=reviews[0];
 useEffect(()=>{serial.current++;setPreview(null);setConfirmed(false);setLoading(false);return()=>{serial.current++;};},[batch.id,batch.revision,JSON.stringify(reviews),blocked]);
 async function inspect(version?:number){const n=++serial.current;setLoading(true);setConfirmed(false);setError('');setPreview(null);try{
  const r=await fetch(path+'?pack_role='+encodeURIComponent(roleId)+(version?'&pack_version='+version:''),{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'The pack could not be loaded.');if(d.accountId!==account)throw Error('Your account changed. Reload before continuing.');if(n===serial.current)setPreview(d);
 }catch(e){if(n===serial.current)setError((e as Error).message);}finally{if(n===serial.current)setLoading(false);}}
 const locked=busy||loading||!!pending;
 const status=(r:PackReview)=>blocked&&r.status==='approved_content'?'inputs_changed':r.status;
 return <section className="batch-pack"><h5>Application pack</h5><p>Review the exact saved documents, your routine answers and the original link together. Approved content is kept privately. Automatic sending is not available.</p>
  {latest&&<p className="batch-boundary"><strong>{packLabels[status(latest)]} · version {latest.version}</strong><br/>Saved {new Date(latest.approved_at).toLocaleString()}</p>}
  <div className="batch-actions"><button className="secondary-button" disabled={locked||blocked} onClick={()=>void inspect()}>Review current application pack</button>{latest&&!latest.revoked_at&&<button className="secondary-button" disabled={locked} onClick={()=>void onSend({path,body:{action:'revoke_pack',role_id:roleId,version:latest.version,request_key:crypto.randomUUID()}})}>Revoke pack approval</button>}</div>
  {!!reviews.length&&<details><summary>Pack approval history · {reviews.length}</summary>{reviews.map(r=><p key={r.version}><button className="secondary-button" disabled={locked} onClick={()=>void inspect(r.version)}>Open saved version {r.version}</button> · {packLabels[status(r)]}{r.revoked_at?' · revoked '+new Date(r.revoked_at).toLocaleString():''}</p>)}</details>}
  {error&&<p role="alert" className="batch-error">{error}</p>}{loading&&<p role="status">Loading your private pack…</p>}
  {preview&&<div className="batch-pack-preview"><h5>{preview.record?'Saved pack version '+preview.record.version:'Review before approving'}</h5>
   {!!preview.issues.length&&<ul className="batch-error">{preview.issues.map(i=><li key={i}>{i}</li>)}</ul>}
   {preview.payload&&<>
    <h5>Role and destination</h5><p><strong>{preview.payload.role.title} · {preview.payload.role.company}</strong><br/>{preview.payload.role.location}</p><p className="batch-pack-url">{preview.payload.role.url||'Application link missing'}</p>{preview.payload.role.url&&<a href={preview.payload.role.url} target="_blank" rel="noopener noreferrer">Inspect original application route</a>}
    <p>{preview.payload.role.source_kind==='applicant_added'?'You added this role yourself; its availability and destination are not verified by the catalogue.':'This is the original URL retained with the catalogue advert. A current listing does not prove that the employer form is accepting submissions.'}</p>
    <h5>Documents in this exact version</h5><p>These are UTF-8 plain-text files. A regenerated PDF, Word file or uploaded attachment would need its own review. The master CV is never substituted for a missing role CV.</p>
    {!preview.payload.documents.some(d=>d.filename==='application-cv.txt')&&<p>No role CV saved.</p>}
    {!preview.payload.documents.some(d=>d.filename==='application-cover-letter.txt')&&<p>No cover letter included. Check whether this employer requires one.</p>}
    {preview.payload.documents.map(d=><details key={d.filename}><summary>{d.filename} · {d.bytes.toLocaleString()} bytes</summary><pre>{d.text}</pre><DraftSourceComparison text={d.text} kind={d.filename==='application-cv.txt'?'cv':'coverLetter'} profile={preview.comparison_source?.profile||null} sourceLabel={preview.comparison_source?'Compare with confirmed source CV · facts version '+preview.comparison_source.version+' · '+preview.comparison_source.status:'Source snapshot unavailable'}/><p className="batch-footnote">SHA-256: {d.sha256}</p><button className="secondary-button" onClick={()=>download(d.text,d.filename,d.type)}>Download this exact text</button></details>)}
    <h5>Routine answers · facts version {preview.payload.facts?.version||'not confirmed'}</h5><dl>{factAnswerFields.map(f=><React.Fragment key={f.key}><dt>{f.label}</dt><dd>{preview.payload?.facts?.answers[f.key]||'Unanswered — ask me'}</dd></React.Fragment>)}</dl>
    <p>No employer screening answers or declarations are included. Work permission, sensitive disclosures, unanswered questions and employer-specific requirements still need your own answers.</p>
    {preview.record?<><p role="status">{packLabels[status(preview.record)]}. This is a retained historical copy; downloading it does not send it to an employer.</p><button className="secondary-button" onClick={()=>download(JSON.stringify({version:1,approval:preview.record,pack:preview.payload},null,2),'sponsor-intel-approved-pack-'+roleId+'-v'+preview.record!.version+'.json','application/json')}>Download private pack and receipt</button></>:<><label className="batch-option"><input type="checkbox" disabled={locked||blocked||!preview.can_approve} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked the role, destination, complete documents and answers above. I approve this exact content for my own application preparation. This does not authorise automated submission. A sending provider, new attachments or additional answers need a new approval.</span></label><button className="primary-button" disabled={locked||blocked||!confirmed||!preview.can_approve||preview.previous_version>=10} onClick={()=>void onSend({path,body:{action:'review_pack',role_id:roleId,revision:batch.revision,previous_version:preview.previous_version,payload_hash:preview.payload_hash,confirmed:true,request_key:crypto.randomUUID()}})}>Approve this content</button></>}
    <p className="batch-footnote">Approval preserves the exact text and answer version. Changed facts, documents, employer evidence or batch state require review again. Revoking never withdraws an application you sent elsewhere. Up to ten versions per role and 5 MB of retained packs per batch; history is not deleted to make room.</p>
   </>}
  </div>}
 </section>;
}
