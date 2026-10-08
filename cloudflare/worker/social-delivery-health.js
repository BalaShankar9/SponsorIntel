const DAY=86400000;
export const DELIVERY_GRACE_MS=30*60000;
const observed=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+5*60000;

export function summarizeSocialDelivery(rows,now=Date.now()){
  const summary={available:true,checked_at:new Date(now).toISOString(),records_checked:Math.min(rows.length,500),limited:rows.length>500,
    scheduled:0,awaiting_check:0,overdue:0,uncertain:0,failed_30d:0,published_30d:0,invalid_records:0,last_published_observation:null,next_scheduled_at:null};
  for(const row of rows.slice(0,500)){
    if(row.receipt_state!==row.state||row.receipt_version!==row.version||!observed(row.observed_at,now)||!row.external_id){summary.invalid_records++;continue;}
    if(row.state==='scheduled'){
      const due=Date.parse(row.scheduled_at);
      if(!Number.isFinite(due)){summary.invalid_records++;continue;}
      summary.scheduled++;
      if(due<=now){summary.awaiting_check++;if(now-due>=DELIVERY_GRACE_MS)summary.overdue++;}
      else if(!summary.next_scheduled_at||due<Date.parse(summary.next_scheduled_at))summary.next_scheduled_at=new Date(due).toISOString();
    }else if(row.state==='uncertain')summary.uncertain++;
    else if(row.state==='failed'&&Date.parse(row.observed_at)>=now-30*DAY)summary.failed_30d++;
    else if(row.state==='published'){
      if(!row.post_url){summary.invalid_records++;continue;}
      if(Date.parse(row.observed_at)<now-30*DAY)continue;
      summary.published_30d++;
      if(!summary.last_published_observation||row.observed_at>summary.last_published_observation)summary.last_published_observation=row.observed_at;
    }
  }
  return summary;
}

// Only delivery metadata is read. Copy, notes, account identifiers and customer
// data never enter the retained business snapshot. This checks recorded
// observations, not the external provider's current connection or live status.
export async function socialDeliveryHealth(env,now=Date.now()){
  try{
    const rows=await env.DB.prepare(`SELECT b.state,b.version,r.version receipt_version,r.state receipt_state,r.external_id,r.scheduled_at,r.post_url,r.observed_at
      FROM marketing_briefs b LEFT JOIN marketing_receipts r ON r.rowid=(SELECT rowid FROM marketing_receipts WHERE brief_id=b.id ORDER BY rowid DESC LIMIT 1)
      WHERE b.state IN ('scheduled','uncertain') OR (b.state IN ('published','failed') AND b.updated_at>=?)
      ORDER BY b.updated_at DESC LIMIT 501`).bind(new Date(now-30*DAY).toISOString()).all();
    return summarizeSocialDelivery(rows.results,now);
  }catch{return {available:false,checked_at:new Date(now).toISOString()};}
}

export function socialDeliveryFindings(health){
  if(!health)return []; // Historical snapshots predate this check.
  const issues=[];
  const add=(id,severity,title,detail)=>issues.push({id,category:'distribution',severity,title,detail,
    next_action:'Inspect the exact existing provider schedule and social account, then record the matching post URL or confirmed outcome in Marketing desk. A pending or missing receipt is not proof of failure. Do not repost, reschedule or cancel until the outcome is reconciled.'});
  if(!health.available||health.limited||health.invalid_records)add('social-delivery-records','high','Inspect incomplete delivery evidence','The delivery ledger could not be fully checked or contains missing, inconsistent or invalid receipts. No external delivery result was inferred.');
  if(health.overdue)add('social-delivery-overdue','high','Verify overdue social deliveries',health.overdue+(health.overdue===1?' scheduled post is':' scheduled posts are')+' at least 30 minutes past the recorded slot without a recorded outcome. This does not establish provider failure.');
  if(health.uncertain)add('social-delivery-uncertain','high','Reconcile uncertain social deliveries',health.uncertain+(health.uncertain===1?' post has':' posts have')+' an explicitly uncertain recorded outcome. Resolve the original provider job before any replacement.');
  if(health.failed_30d)add('social-delivery-failed','normal','Review recorded publishing failures',health.failed_30d+(health.failed_30d===1?' confirmed failed outcome was':' confirmed failed outcomes were')+' recorded in the last 30 days. These are terminal observations; no automatic retry is requested.');
  return issues;
}
