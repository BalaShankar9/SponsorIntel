import {campaignById} from '../shared/campaigns.js';
const DAY=86400000;
export const BROWSER_EVIDENCE_ACTION='local_evidence_check';
export const BROWSER_EVIDENCE_LIMIT='Browser-reported evidence checks, collected separately from server preparation responses. Known signed-in owners and declared QA are excluded. Delivery may fail; repeated actions, signed-out operators and bots may remain. These are not unique people, cloud saves, AI quality judgments, downloads, applications or conversions. Earlier local use was not collected.';

async function boundary(env,now,days){
 const row=await env.DB.prepare("SELECT value FROM metadata WHERE key='analytics_browser_evidence_v1'").first();
 let data;try{data=row?JSON.parse(row.value):null;}catch{return null;}
 if(data?.version!==1||typeof data.enabled_at!=='string'||!Number.isFinite(Date.parse(data.enabled_at))||new Date(data.enabled_at).toISOString()!==data.enabled_at||Date.parse(data.enabled_at)>now)return null;
 const firstFullDay=new Date(Date.parse(data.enabled_at.slice(0,10))+DAY).toISOString().slice(0,10);
 const to=new Date(now).toISOString().slice(0,10),windowStart=new Date(now-days*DAY).toISOString().slice(0,10);
 const from=firstFullDay>windowStart?firstFullDay:windowStart;
 return {enabled_at:data.enabled_at,first_full_day:firstFullDay,from:from>to?to:from,to,completed_days:Math.max(0,(Date.parse(to)-Date.parse(from))/DAY)};
}

export async function recordBrowserEvidence(env,campaign,now=Date.now()){
 if(!await boundary(env,now,14))return false;
 const day=new Date(now).toISOString().slice(0,10);
 const statement=dimension=>env.DB.prepare('INSERT INTO analytics_evidence_daily(day,dimension,count) VALUES(?,?,1) ON CONFLICT(day,dimension) DO UPDATE SET count=count+1').bind(day,dimension);
 const writes=[statement('')];
 if(campaignById(campaign))writes.push(statement(campaign));
 await env.DB.batch(writes);
 return true;
}

export async function browserEvidenceMeasurement(env,now=Date.now(),days=14){
 const span=await boundary(env,now,days);
 const result={version:1,kind:'browser_reported',state:span?.completed_days?'collecting':span?'waiting_for_complete_day':'unavailable',...(span||{enabled_at:null,first_full_day:null,from:null,to:null,completed_days:0}),evidence_checks:null,campaigns:[],limitation:BROWSER_EVIDENCE_LIMIT};
 if(!span?.completed_days)return result;
 const rows=(await env.DB.prepare('SELECT dimension,SUM(count) count FROM analytics_evidence_daily WHERE day>=? AND day<? GROUP BY dimension').bind(span.from,span.to).all()).results;
 result.evidence_checks=rows.find(x=>x.dimension==='')?.count||0;
 result.campaigns=rows.filter(x=>campaignById(x.dimension)).map(x=>({id:x.dimension,label:campaignById(x.dimension).label,count:x.count}));
 return result;
}
