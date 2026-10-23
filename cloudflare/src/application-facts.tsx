import React,{useState,useEffect} from 'react';
import {batchHash} from '../shared/application-batch.js';
import {factAnswerFields,validateFactAnswers,factPackLabels} from '../shared/application-facts.js';

type Pack={version:number;status:string;approved_at:string;revoked_at:string|null;profile:Record<string,string>;answers:Record<string,string|null>;payload_hash:string;request_key:string;revoke_request_key:string|null};
type Attempt={path:string;body:Record<string,unknown>};
export function ApplicationFacts({batch,profile,blocked,busy,pending,onSend,onProfile}:{batch:{id:string;state:string;revision:number;facts:Pack[]};profile:Record<string,string>;blocked:boolean;busy:boolean;pending:Attempt|null;onSend:(a:Attempt)=>Promise<void>;onProfile:()=>void}) {
 const [answers,setAnswers]=useState<Record<string,string>>({notice_period:'',salary_expectation:'',interview_availability:''}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 useEffect(()=>setConfirmed(false),[JSON.stringify(profile),batch.revision]);
 const latest=batch.facts[0],restoring=pending?.path==='/api/career/batches/'+batch.id&&pending.body.action==='approve_facts'&&!pending.body.answers;
 const locked=busy||!!pending&&!restoring;
 const visibleStatus=(pack:Pack)=>pack.status==='current'&&blocked?'inputs_changed':pack.status;
 async function approve(){
  setError('');try{
   const clean=validateFactAnswers(answers),hash=await batchHash(clean);
   if(restoring&&hash!==pending!.body.answers_hash)throw Error('Re-enter the exact answers from the unconfirmed request. Blank fields must stay blank.');
   const attempt=restoring?{...pending!,body:{...pending!.body,answers:clean}}:{path:'/api/career/batches/'+batch.id,body:{action:'approve_facts',revision:batch.revision,previous_version:latest?.version||0,profile_hash:await batchHash(profile),answers:clean,answers_hash:hash,confirmed:true,request_key:crypto.randomUUID()}};
   await onSend(attempt);setConfirmed(false);
  }catch(e){setError((e as Error).message);}
 }
 return <section className="batch-facts" aria-labelledby="batch-facts-heading"><h3 id="batch-facts-heading">Your facts &amp; routine answers</h3><p>Review what you have told us before preparing applications. This confirmation stays in this batch. It does not permit sending information to employers or completing their declarations.</p>
  {latest&&<div className="batch-boundary" role="status"><strong>{factPackLabels[visibleStatus(latest)]||'Review this confirmation'} · version {latest.version}</strong><p>Confirmed {new Date(latest.approved_at).toLocaleString()}{latest.revoked_at?' · revoked '+new Date(latest.revoked_at).toLocaleString():''}</p>{!latest.revoked_at&&<button className="secondary-button" disabled={busy||!!pending} onClick={()=>void onSend({path:'/api/career/batches/'+batch.id,body:{action:'revoke_facts',version:latest.version,request_key:crypto.randomUUID()}})}>Revoke this confirmation</button>}</div>}
  <details><summary>Review and confirm your facts</summary>
   <p>Check every section of your saved profile below. Correct it in My CV &amp; profile first if needed, then prepare a new batch. We do not verify the truth of your statements.</p>
   <ProfileFacts profile={profile}/><button className="secondary-button" onClick={onProfile}>Edit my CV &amp; profile</button>
   <h4>Optional answers you choose</h4><p>Blank means “ask me”. These fields are not answers to an employer’s screening form. Right to work, visa eligibility, sensitive disclosures and personal declarations still need your own review for each employer.</p>
   {factAnswerFields.map(({key,label,hint})=><label className="batch-fact-field" key={key}><strong>{label}</strong><span>{hint}</span><textarea value={answers[key]} maxLength={1200} disabled={locked} onChange={e=>{setAnswers(a=>({...a,[key]:e.target.value}));setConfirmed(false);}} rows={2}/></label>)}
   <label className="batch-option"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e=>setConfirmed(e.target.checked)}/><span>I have reviewed the profile and these answers. They accurately describe my information and preferences. I confirm them for preparation only; unanswered fields must remain unanswered.</span></label>
   {restoring&&<p role="status">This request was interrupted. Re-enter its exact answers to retry, or recheck the batch to find the original saved confirmation. Answers were not copied into browser recovery storage.</p>}
   {error&&<p role="alert" className="batch-error">{error}</p>}
   {blocked&&!restoring&&<p className="batch-error">Sync and recheck your batch first. Changed or missing inputs need a new selection; paused or ended batches cannot receive new confirmations.</p>}
   <button className="primary-button" disabled={locked||!confirmed||blocked&&!restoring||(latest?.version||0)>=20&&!restoring} onClick={()=>void approve()}>{restoring?'Retry the same facts confirmation':'Confirm facts for preparation'}</button>
   <p className="batch-footnote">Up to 20 immutable versions per batch. Revoking keeps history; editing your profile or batch makes a previous confirmation unusable. Review destinations and final saved documents in each role’s Application pack below. Automated sending remains unavailable.</p>
  </details>
  {!!batch.facts.length&&<details><summary>Saved facts and answer history · {batch.facts.length} {batch.facts.length===1?'version':'versions'}</summary>{batch.facts.map(pack=><details key={pack.version}><summary>Version {pack.version} · {factPackLabels[visibleStatus(pack)]} · {new Date(pack.approved_at).toLocaleString()}</summary><ProfileFacts profile={pack.profile}/><dl>{factAnswerFields.map(({key,label})=><React.Fragment key={key}><dt>{label}</dt><dd>{pack.answers[key]||'Unanswered — ask me'}</dd></React.Fragment>)}</dl></details>)}</details>}
 </section>;
}
function ProfileFacts({profile}:{profile:Record<string,string>}) {
 const labels:Record<string,string>={name:'Name',email:'Application email',phone:'Phone',city:'City',headline:'Headline',cv:'CV / experience and qualifications',skills:'Skills you recorded',goal:'Career goal',sponsorship:'Your recorded sponsorship preference'};
 const sponsorship:Record<string,string>={now:'Sponsorship needed now',later:'Sponsorship may be needed later',unsure:'Unknown — ask me',not_needed:'You recorded sponsorship not needed'};
 return <dl className="batch-fact-profile">{Object.entries(labels).map(([key,label])=><React.Fragment key={key}><dt>{label}</dt><dd>{key==='sponsorship'?sponsorship[profile[key]]||'Unknown — ask me':profile[key]||'Not provided'}</dd></React.Fragment>)}<dt>Work permission and eligibility</dt><dd>Not established by this profile or sponsorship preference. Ask me for each application.</dd></dl>;
}
