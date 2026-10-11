import {bodyJSON,digest,limit,reply,sameOrigin} from './auth.js';
import {destinations} from './marketing.js';
import {campaignFromSearch} from '../shared/campaigns.js';

const DAY=86400000;
export const PERFORMANCE_METRICS=['impressions','reach','clicks','link_clicks','reactions','comments','shares','saves'];
export const PERFORMANCE_LIMIT='Owner-observed platform aggregates, not an independently connected provider feed. Missing figures are unknown. Windows, post ages and metric definitions can differ; do not sum overlapping reach, infer unique customers or causal conversions, or declare a winning campaign from sparse observations. Observations cannot authorise publication or clear a hold.';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(v,max,min=1)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)fail('Missing or oversized observation field.');return v.trim();};
function date(v,now){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)>now+300000)fail('Use a valid observed UTC timestamp, not a future time.');
 const canonical=new Date(v).toISOString();if(canonical!==v.replace(/(\d{2})Z$/,'$1.000Z')&&canonical!==v)fail('Use a real calendar timestamp.');return canonical;
}
function publicLink(v){
 let u;try{u=new URL(text(v,1000));}catch{fail('Use the exact public post URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)fail('Use a clean public URL without credentials or tracking parameters.');
 u.hostname=u.hostname.replace(/^www\./,'');return u;
}
export function validatePerformance(input,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('An observation is required.');
 const d=typeof input.destination==='string'&&Object.hasOwn(destinations,input.destination)?destinations[input.destination]:null;
 if(!d||input.account!==d.account||input.provider!==d.provider||input.identity_checked!==true)fail('Confirm the exact authorised account and provider.');
 const post=publicLink(input.post_url),network=input.destination.split('-')[0];
 const valid=network==='facebook'?post.hostname==='facebook.com'&&/^\/[^/]+\/posts\/\d+\/?$/.test(post.pathname):
  network==='instagram'?post.hostname==='instagram.com'&&/^\/(?:p|reel)\/[A-Za-z0-9_-]+\/?$/.test(post.pathname):
  post.hostname==='linkedin.com'&&/^\/feed\/update\/urn:li:(?:share|activity):\d+\/?$/.test(post.pathname);
 if(!valid)fail('Use the actual post permalink on the selected network.');
 const post_url='https://www.'+post.hostname+post.pathname.replace(/\/$/,'')+'/';
 const source=publicLink(input.evidence_url);
 if(input.provider==='metricool'?source.hostname!=='app.metricool.com':source.hostname!=='linkedin.com')fail('Use the native analytics or Metricool evidence page.');
 const observed_at=date(input.observed_at,now),window_end=date(input.window_end,now);
 if(window_end>observed_at)fail('The reporting period cannot end after observation.');
 if(!['lifetime','period'].includes(input.window_type))fail('Select lifetime-to-date or a reporting period.');
 const window_start=input.window_type==='period'?date(input.window_start,now):null;
 if(window_start&&window_start>=window_end)fail('The reporting period must start before it ends.');
 if(input.window_type==='lifetime'&&input.window_start)fail('Lifetime observations do not have a reporting-period start.');
 const timezone=text(input.timezone,80);try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{fail('Use the provider reporting timezone.');}
 const published_at=input.published_at?date(input.published_at,now):null;
 if(published_at&&published_at>window_end)fail('Publication cannot follow the measurement.');
 if(!['reported','unavailable'].includes(input.availability)||!['agent_assisted','owner'].includes(input.assessment_type))fail('Select metric availability and who observed it.');
 if(!input.metrics||typeof input.metrics!=='object'||Array.isArray(input.metrics)||Object.keys(input.metrics).some(k=>!PERFORMANCE_METRICS.includes(k)))fail('Use only supported post metrics.');
 const metrics=Object.fromEntries(PERFORMANCE_METRICS.map(k=>{
  const n=input.metrics[k]??null;if(n!==null&&(!Number.isSafeInteger(n)||n<0||n>10000000000))fail('Metrics must be non-negative whole numbers, or unknown.');return [k,n];
 }));
 const count=Object.values(metrics).filter(n=>n!==null).length;
 if(input.availability==='reported'?!count:count>0)fail('Reported observations need a number; unavailable observations keep every figure unknown.');
 let campaign_id=null,campaign_url=null;
 if(input.campaign_url){
  let u;try{u=new URL(input.campaign_url);}catch{fail('Use the exact campaign destination copied from the post.');}
  const c=campaignFromSearch(u.search);
  if(u.protocol!=='https:'||u.hostname!=='sponsorintel.london'||u.username||u.password||u.port||u.hash||u.href.length>1000||!c||c.source!==network||[...u.searchParams.keys()].some(k=>!['utm_source','utm_medium','utm_campaign','utm_content'].includes(k))||
   (input.destination==='linkedin-personal')!==(c.id==='li-founder'))fail('The campaign destination must match this account and a recognised campaign.');
  campaign_id=c.id;campaign_url=u.href;
 }
 return {version:1,destination:input.destination,account:d.account,provider:d.provider,post_url,title:text(input.title,160),observed_at,
  window_type:input.window_type,window_start,window_end,timezone,published_at,availability:input.availability,metrics,
  campaign_id,campaign_url,assessment_type:input.assessment_type,evidence_url:source.href,note:text(input.note,1000,20)};
}
const decode=row=>({...JSON.parse(row.payload),id:row.id,supersedes:row.supersedes,created_at:row.created_at});
export async function recordPerformance(env,input,actor,now=Date.now()){
 const key=text(input.request_key,100);if(!/^[a-zA-Z0-9:_-]+$/.test(key))fail('Invalid observation request key.');
 const value=validatePerformance(input,now),supersedes=input.supersedes||null,hash=await digest(JSON.stringify({actor,value,supersedes}));
 const replay=async()=>{const r=await env.DB.prepare('SELECT id,request_hash FROM marketing_performance WHERE request_key=?').bind(key).first();if(r&&r.request_hash!==hash)fail('This request key already belongs to different evidence.',409);return r?{id:r.id,replayed:true}:null;};
 const old=await replay();if(old)return old;
 if(supersedes){
  const prior=await env.DB.prepare('SELECT * FROM marketing_performance WHERE id=?').bind(text(supersedes,100)).first();
  if(!prior||prior.destination!==value.destination||prior.post_url!==value.post_url||prior.observed_at>value.observed_at)fail('A correction must refer to an earlier observation of this exact post.',409);
 }
 const id=crypto.randomUUID();
 try{await env.DB.batch([
  env.DB.prepare('INSERT INTO marketing_performance VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,key,hash,value.destination,value.post_url,value.observed_at,supersedes,JSON.stringify(value),actor,new Date(now).toISOString()),
  env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(actor,'marketing-performance-observed',id,new Date(now).toISOString()),
 ]);}catch{const prior=await replay();if(prior)return prior;fail('The observation could not be saved, or another correction won. Refresh before retrying.',409);}
 return {id,replayed:false};
}
export async function performanceSnapshot(env,now=Date.now()){
 const rows=(await env.DB.prepare('SELECT p.*,EXISTS(SELECT 1 FROM marketing_performance n WHERE n.supersedes=p.id) corrected FROM marketing_performance p ORDER BY observed_at DESC,created_at DESC,id DESC LIMIT 100').all()).results;
 return {items:rows.map(r=>({...decode(r),corrected:!!r.corrected})),limit:PERFORMANCE_LIMIT,destinations,observed_at:new Date(now).toISOString()};
}
export async function performanceContext(env,now=Date.now()){
 const cutoff=new Date(now-7*DAY).toISOString(),end=new Date(now).toISOString();
 const rows=(await env.DB.prepare('SELECT p.* FROM marketing_performance p WHERE observed_at>=? AND observed_at<=? AND NOT EXISTS(SELECT 1 FROM marketing_performance n WHERE n.supersedes=p.id) ORDER BY observed_at DESC,created_at DESC,id DESC LIMIT 100').bind(cutoff,end).all()).results;
 const seen=new Set(),items=[];
 for(const row of rows){
  const p=decode(row);if(p.window_end<cutoff||p.window_end>end)continue;
  const key=JSON.stringify([p.destination,p.post_url,p.window_type,p.window_start,p.window_type==='period'?p.window_end:null,p.timezone]);
  if(seen.has(key))continue;seen.add(key);
  // Exclude free-text operator notes, identities and arbitrary input URLs from model context.
  const {id,destination,post_url,title,observed_at,window_type,window_start,window_end,timezone,published_at,availability,metrics,campaign_id,assessment_type}=p;
  items.push({id,destination,post_url,title,observed_at,window_type,window_start,window_end,timezone,published_at,availability,metrics,campaign_id,assessment_type});
  if(items.length===20)break;
 }
 return {version:1,items,limit:PERFORMANCE_LIMIT,comparison:'No automatic winner, conversion rate or summed reach is calculated. A null publication time means post age is unknown.'};
}
// adminAPI verifies the owner before routing here. No provider request or model call.
export async function marketingPerformanceAPI(request,env,owner){
 if(request.method==='GET')return reply(await performanceSnapshot(env));
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!await limit(env,'marketing-performance:'+owner.user.id,20))return reply({error:'Please try later.'},429);
 try{return reply(await recordPerformance(env,await bodyJSON(request,8000),'owner:'+owner.user.id),201);}
 catch(e){return reply({error:e.status?e.message:'The observation could not be saved. Refresh before retrying.'},e.status||400);}
}
