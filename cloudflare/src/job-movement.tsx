import React from 'react';
type Counts={total:number;employers:number;offered:number;conditional:number;unavailable:number;not_stated:number};
type Changes={entered:number;returned:number;left:number;sponsorship_changed:number;evidence_changed:number;stated_gained:number;stated_lost:number};
type Run={id:string;observed_at:string;previous_at:string|null;trigger_kind:string;baseline:number;before_counts:Counts;counts:Counts;changes:Changes};
type Event={run_id:string;job_id:string;company:string;title:string;kind:string;reason:string;observed_at:string;before_sponsorship:string|null;after_sponsorship:string|null;before_evidence:string|null;after_evidence:string|null};
export type JobMovementHealth={enabled:boolean;status:string;started_at:string|null;latest:Run|null;employers:{board_id:string;company:string;total:number;offered:number;conditional:number}[];days:(Changes&{day:string;observations:number})[];events:Event[];limitation:string};
const stamp=(value:string)=>new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
const labels:Record<string,string>={entered:'Entered the current list',returned:'Returned to the current list',left:'Left the current list',sponsorship_changed:'Sponsorship label changed',evidence_changed:'Supporting wording changed',offered:'Offered wording',conditional:'Conditional wording',unavailable:'Sponsorship unavailable',not_stated:'Not stated'};
const reasons:Record<string,string>={deadline_passed:'The stated deadline passed.',source_stale:'Source evidence passed the freshness limit.',inactive_record:'The source record is inactive. This alone does not prove the employer closed the role.',not_current:'The record no longer meets current-list checks.',record_missing:'The job record is no longer available.',current_at_observation:'Current at this observation; this is not its publication date.',source_wording_changed:'The retained source wording or its extracted label changed.'};
export function JobMovementStatus({health}:{health?:JobMovementHealth}){
 const run=health?.latest,c=run?.counts,b=run?.before_counts,d=run?.changes;
 return <section aria-labelledby="job-movement-heading">
  <div className="business-section-heading"><h3 id="job-movement-heading">Job movement</h3><span>{!health?.enabled?'Observations paused or unavailable':health.status==='overdue'?'Observation overdue':run?.baseline?'First baseline recorded':run?'Hourly observations':'Awaiting the first baseline'}</span></div>
  <p>See why the sponsorship count changed, and which employers contribute opportunities.</p>
  {!run||!c||!b||!d?<p className="business-fine">The next eligible hourly business run will establish a baseline. Existing jobs will not be counted as newly discovered.</p>:<>
   <div className="business-metrics">{[[c.total,'Current jobs'],[c.offered,'Offered wording'],[c.conditional,'Conditional wording'],[c.employers,'Employers']].map(([count,label])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
   <p className="business-fine">Observed {stamp(run.observed_at)} · {run.trigger_kind==='scheduled'?'Scheduled cloud run':run.trigger_kind==='owner'?'Owner-triggered run':'Origin not recorded'}. {run.baseline?'This is the starting baseline; no change history is inferred.':`Compared with ${stamp(run.previous_at!)}.`}</p>
   {!run.baseline&&<><p><strong>Sponsorship-stated total: {b.offered+b.conditional} → {c.offered+c.conditional}</strong> · {d.stated_gained} gained · {d.stated_lost} lost. Offered and conditional wording are combined here.</p><p>{d.entered} entered · {d.returned} returned · {d.left} left · {d.sponsorship_changed} sponsorship labels changed · {d.evidence_changed} evidence-only changes.</p></>}
   <details className="business-history"><summary>Daily movement and employer coverage</summary>
    <p className="business-fine">UTC observation dates; today may be partial. A job can enter and leave more than once. Counts are observed changes, not unique new adverts.</p>
    {health.days.map(day=><p key={day.day}><strong>{day.day}</strong> · {day.observations} observations · {day.entered} entered · {day.returned} returned · {day.left} left · {day.sponsorship_changed} labels changed · Sponsorship-stated: +{day.stated_gained} / −{day.stated_lost}</p>)}
    <h4>Largest sources in the latest observation</h4>{health.employers.map(employer=><p key={employer.board_id}><strong>{employer.company}</strong> · {employer.total} current jobs · {employer.offered} offered · {employer.conditional} conditional</p>)}
   </details>
   <details className="business-history"><summary>Recent changes and their evidence</summary>
    {!health.events.length?<p>No changes have been recorded since the baseline.</p>:<><p className="business-fine">Latest 50 changes. Daily totals include all recorded changes.</p><div className="business-issues">{health.events.map(event=><details key={event.run_id+':'+event.job_id}><summary>{labels[event.kind]} · {event.company} · {event.title}</summary>
     <p>{stamp(event.observed_at)} · {reasons[event.reason]||'Inspect the original advert.'}</p>
     <p>{event.before_sponsorship?labels[event.before_sponsorship]:'Outside the observed current list'} → {event.after_sponsorship?labels[event.after_sponsorship]:'Outside the observed current list'}</p>
     {event.before_evidence&&<p><strong>Before:</strong> {event.before_evidence}</p>}{event.after_evidence&&<p><strong>After:</strong> {event.after_evidence}</p>}
     <a href={'/jobs/'+encodeURIComponent(event.job_id)} target="_blank" rel="noreferrer">Inspect the role</a>
    </details>)}</div></>}
   </details>
  </>}
  <p className="business-fine">{health?.limitation||'Hourly observations can miss changes between checks. A licence does not establish sponsorship for a vacancy.'} {health?.started_at?'History begins '+stamp(health.started_at)+'.':''}</p>
 </section>;
}
