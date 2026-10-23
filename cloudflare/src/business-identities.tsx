import React,{useEffect,useState} from 'react';
import {businessRelationships} from '../shared/business-identities.js';
const labels:Record<string,string>=businessRelationships;
const when=(s:string)=>new Date(s).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
type PublicIdentity={identity_id:string;revision:number;sponsor_id:string;sponsor_name:string;business_name:string;relationship:string;website:string;careers_url:string;activity:string;locations:string;official_identifier:string;evidence_url:string;evidence_summary:string;observed_at:string;review_due_at:string;review_method:string;recorded_at:string};
export function BusinessIdentityCards({sponsorId}:{sponsorId:string}){
 const [data,setData]=useState<{id:string;items:PublicIdentity[];status:string}|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setData(null);setError(false);fetch('/api/business-identities?sponsor_id='+encodeURIComponent(sponsorId)).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(active)setData({...d,id:sponsorId});}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[sponsorId,retry]);
 const current=data?.id===sponsorId?data:null;
 return <section className="business-identities" style={{marginBlock:24,minWidth:0}} aria-label="Businesses behind this licence">
 <h3 style={{fontSize:18}}>Businesses behind this licence</h3>
 {error?<p role="status">Business evidence could not be loaded. <button type="button" className="text-button" onClick={()=>setRetry(x=>x+1)}>Try again</button></p>:!current?<p>Loading business evidence…</p>:current.status==='register_unavailable'?<p>Business links are waiting for a fresh register check.</p>:!current.items.length?<p>We have not published a current business relationship for this entry yet. A missing profile does not mean the business is inactive.</p>:<>
 <p className="fine-print">Reviewed relationships to this register entry. They do not identify the employing or sponsoring entity for a particular vacancy.</p>
 {current.items.map(r=><article className="business-identity-card role-panel" style={{marginBlock:14,padding:18}} key={r.identity_id}>
 <span className="eyebrow">{labels[r.relationship]}</span><h4 style={{fontSize:18,marginBlock:8}}>{r.business_name}</h4>
 {r.activity&&<p>{r.activity}</p>}{r.locations&&<p><strong>Operating locations:</strong> {r.locations}</p>}{r.official_identifier&&<p><strong>Public identifier:</strong> {r.official_identifier}</p>}
 <p>{r.evidence_summary}</p><p className="fine-print">{r.review_method==='agent_assisted'?'Agent-assisted owner review':'Owner review'} · Evidence observed {when(r.observed_at)} · Review due {when(r.review_due_at)}</p>
 <div className="role-licence-links"><a href={r.website} target="_blank" rel="noopener noreferrer">Business website ↗</a>{r.careers_url&&<a href={r.careers_url} target="_blank" rel="noopener noreferrer">Careers ↗</a>}<a href={r.evidence_url} target="_blank" rel="noopener noreferrer">Relationship evidence ↗</a></div>
 </article>)}</>}
 </section>;
}
