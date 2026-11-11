import React from 'react';
export type SocialDeliveryHealth={available:boolean;checked_at:string;records_checked?:number;limited?:boolean;scheduled?:number;awaiting_check?:number;overdue?:number;uncertain?:number;failed_30d?:number;published_30d?:number;invalid_records?:number;last_published_observation?:string|null;next_scheduled_at?:string|null};
const date=(value:string)=>new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
export function SocialDeliveryStatus({health}:{health?:SocialDeliveryHealth}){
 return <section aria-labelledby="social-delivery-heading">
  <div className="business-section-heading"><h3 id="social-delivery-heading">Social delivery records</h3><a href="#marketing-heading">Open Marketing desk</a></div>
  {!health?.available?<p className="business-fine">Delivery evidence is unavailable. This does not mean a post failed; refresh or inspect the original provider job before retrying.</p>:<>
   <div className="business-metrics">{[[health.published_30d,'Recorded published · 30 days'],[health.scheduled,'Scheduled'],[health.overdue,'Overdue observations'],[health.uncertain,'Uncertain outcomes']].map(([count,label])=><div key={label}><strong>{count??0}</strong><span>{label}</span></div>)}</div>
   <p className="business-fine">Checked {date(health.checked_at)}. {health.last_published_observation?'Latest publication observation '+date(health.last_published_observation)+'. ':'No publication observation in the last 30 days. '}{health.next_scheduled_at?'Next recorded slot '+date(health.next_scheduled_at)+'.':''}</p>
   {!!health.failed_30d&&<p>{health.failed_30d} confirmed failed {health.failed_30d===1?'outcome':'outcomes'} recorded in the last 30 days. Review the evidence in Marketing desk.</p>}
   {!!health.awaiting_check&&<p>{health.awaiting_check} due {health.awaiting_check===1?'post awaits':'posts await'} a recorded outcome. Hourly monitoring flags unresolved deliveries after a 30-minute grace period.</p>}
   {(health.limited||!!health.invalid_records)&&<p role="status">Some records could not be checked completely. Inspect Marketing desk before another schedule.</p>}
  </>}
  <p className="business-fine">These counts use recorded observations, not a live provider connection, reach or engagement. Metricool and native LinkedIn perform publication; the connected Codex routine verifies the exact post and records its outcome. Uncertain deliveries must be reconciled before any retry.</p>
 </section>;
}
