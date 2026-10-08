import React from 'react';
type LinkCheck={source_id:string;company:string;status:string;id:string|null;title:string|null;url:string|null;created_at:string|null;reason:string|null;advert_current:number;evidence:{chain?:{url:string;status:number}[];observed_heading?:string;closure_signal?:string}|null};
export type JobLinkHealth={enabled:boolean;checked_at:string;eligible_sources:number;sampled_sources:number;matched:number;needs_attention:number;awaiting:number;items:LinkCheck[]};
const stamp=(value:string)=>new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const labels:Record<string,string>={matched:'Page title matched',needs_attention:'Review needed',overdue:'Check overdue',awaiting:'Awaiting sample'};
export function JobLinkStatus({health}:{health?:JobLinkHealth}){
 return <section aria-labelledby="job-links-heading">
  <div className="business-section-heading"><h3 id="job-links-heading">Employer application links</h3><span>{health?.enabled?'Rotating daily sample':'Checks paused or unavailable'}</span></div>
  <p>Checks two employers each hourly run, with at most one advert per employer per UTC day. Previously unchecked employers and roles go first.</p>
  {!health?<p className="business-fine">No link-check receipt is available yet.</p>:<>
   <div className="business-metrics">{[[health.eligible_sources,'Eligible employers'],[health.matched,'Sample titles matched'],[health.needs_attention,'Need review'],[health.awaiting,'Awaiting sample']].map(([count,label])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
   <p className="business-fine">Coverage shown for the last 36 hours. Checked {stamp(health.checked_at)}. A new employer may wait for its place in the rotation.</p>
   <details className="business-history"><summary>Employer samples and evidence</summary><div className="business-issues">{health.items.map(item=><details key={item.source_id}><summary><strong>{item.company}</strong> · {labels[item.status]||'Unconfirmed'}</summary>
    {item.id?<><p>{item.title} · {item.created_at&&stamp(item.created_at)}</p>{!item.advert_current&&<p>This sampled role is no longer in the current set. Another current role awaits a check.</p>}
    {item.url&&/^https:\/\//.test(item.url)&&<a href={item.url} target="_blank" rel="noreferrer">Open the sampled employer page</a>}
    <p className="business-fine">Result: {item.reason?.replaceAll('_',' ')||'Check pending'} · Receipt: {item.id}</p>
    {item.evidence?.observed_heading&&<p>Observed heading: {item.evidence.observed_heading}</p>}{item.evidence?.closure_signal&&<p>Closure wording: {item.evidence.closure_signal}</p>}
    {item.evidence?.chain?.map((hop,index)=><p className="business-fine" key={index}>HTTP {hop.status} · {hop.url}</p>)}</>:<p>No sample has been checked yet.</p>}
   </details>)}</div></details>
  </>}
  <p className="business-fine">This checks initial page headings and response codes. It does not confirm every vacancy is open, that the application form works, or that sponsorship is offered. Failed checks flag review; they never silently remove a job. Requests use existing limits and stop when operations or the source is paused.</p>
 </section>;
}
