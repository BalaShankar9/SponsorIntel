import React from 'react';
type Measurement={state:string;enabled_at:string|null;from:string|null;to:string|null;completed_days:number;evidence_checks:number|null;campaigns:{id:string;label:string;count:number}[];limitation:string};
export function BrowserEvidenceAnalytics({data}:{data?:Measurement}){
 if(!data)return null;
 return <section className="career-panel" aria-labelledby="browser-evidence-title">
  <span className="eyebrow">FIRST USE</span><h2 id="browser-evidence-title">Evidence checks prepared in the browser</h2>
  <p>“Evidence &amp; gaps” runs on the visitor’s device. These browser reports are measured separately from successful server preparation responses.</p>
  {data.evidence_checks===null?<p>{data.state==='unavailable'?'This measurement is not available.':'Waiting for the first complete UTC day of this measurement.'} Earlier use of this feature was not collected.</p>:<><div className="metric-list"><p><span>Browser-reported checks · {data.completed_days} complete UTC days</span><strong>{data.evidence_checks.toLocaleString('en-GB')}</strong></p>{data.campaigns.map(c=><p key={c.id}><span>{c.label}</span><strong>{c.count.toLocaleString('en-GB')}</strong></p>)}</div><p className="fine-print">From {data.from} up to {data.to} (excluding that day). Campaign counts are part of the total; do not add them to it.</p></>}
  <p className="fine-print">{data.limitation} A blocked or lost report does not mean the evidence check failed. No visitor identifier, CV text or vacancy details are collected here.</p>
  {data.enabled_at&&<p className="fine-print">Collection enabled: {data.enabled_at}.</p>}
 </section>;
}
