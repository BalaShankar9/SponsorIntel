import {bodyJSON,limit,reply,sameOrigin} from './auth.js';
import pages from '../shared/pages.json' with {type:'json'};
import {JOB_ORIGIN} from '../shared/job-detail.js';

export const SEARCH_PROPERTY=JOB_ORIGIN+'/';
export const SEARCH_SCOPE='https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const API='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(SEARCH_PROPERTY);
const INSPECT='https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const INSPECTION_PATHS=['/','/jobs','/updates','/guides/check-uk-sponsor'];
const PUBLIC_PATHS=new Set([...Object.values(pages).map(p=>p.path),'/insights','/insights/uk-sponsorship-jobs-report']);
const iso=(now=Date.now())=>new Date(now).toISOString();
const DAY=86400000;
const fail=code=>{throw Object.assign(new Error(code),{searchCode:code});};
const codeOf=error=>['paused','invalid_credentials','permission_denied','rate_limited','google_unavailable','invalid_response','response_too_large','network_unavailable'].includes(error?.searchCode)?error.searchCode:'read_failed';
const enabled=async env=>!!(await env.DB.prepare('SELECT enabled FROM search_controls WHERE singleton=1').first())?.enabled && !!(await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first())?.enabled;
const configured=env=>typeof env.SEARCH_CONSOLE_SERVICE_ACCOUNT==='string'&&env.SEARCH_CONSOLE_SERVICE_ACCOUNT.length>0;

export function searchWindow(now=Date.now()) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 const end=Date.parse(today+'T12:00:00Z')-3*DAY;
 return {startDate:iso(end-27*DAY).slice(0,10),endDate:iso(end).slice(0,10),timeZone:'America/Los_Angeles',dataState:'final'};
}
export function searchPage(value) {
 try {
  const url=new URL(value);
  return url.origin===JOB_ORIGIN&&!url.username&&!url.password&&!url.search&&!url.hash&&(PUBLIC_PATHS.has(url.pathname)||/^\/jobs\/[a-f0-9]{24}$/.test(url.pathname))?url.href:null;
 }catch{return null;}
}
const text=(value,max=240)=>typeof value==='string'?value.slice(0,max):null;
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
function metrics(row) {
 if(!row||typeof row!=='object')fail('invalid_response');
 const {clicks,impressions,ctr,position}=row;
 if(![clicks,impressions].every(n=>Number.isSafeInteger(n)&&n>=0)||clicks>impressions||!Number.isFinite(ctr)||ctr<0||ctr>1||!Number.isFinite(position)||position<0)fail('invalid_response');
 return {clicks,impressions,ctr,position:impressions?position:null};
}
export function searchAnalytics(data,kind,window) {
 if(!data||typeof data!=='object'||Array.isArray(data))fail('invalid_response');
 const rows=data.rows??[];
 if(!Array.isArray(rows)||rows.length>(kind==='pages'?100:kind==='dates'?28:1)||data.metadata?.first_incomplete_date)fail('invalid_response');
 const seen=new Set();let excluded=0;
 const kept=rows.flatMap(row=>{
  const value=metrics(row);
  if(kind==='total'){
   if(row.keys?.length)fail('invalid_response');
   return [value];
  }
  if(!Array.isArray(row.keys)||row.keys.length!==1||typeof row.keys[0]!=='string'||seen.has(row.keys[0]))fail('invalid_response');
  seen.add(row.keys[0]);
  if(kind==='dates'){
   const date=row.keys[0];
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||iso(Date.parse(date)).slice(0,10)!==date||date<window.startDate||date>window.endDate)fail('invalid_response');
   return [{date,...value}];
  }
  const page=searchPage(row.keys[0]);
  if(!page){excluded++;return [];}
  return [{page,...value}];
 });
 return {state:rows.length?'available':'no_data',rows:kept,returned_rows:rows.length,excluded_rows:excluded,row_limit_reached:kind==='pages'&&rows.length===100,coverage:kind==='pages'?'Top returned pages only; not exhaustive. Unsafe or private URLs are excluded.':'Missing dates are not filled with zero.'};
}
export function searchSitemaps(data) {
 if(!data||typeof data!=='object'||Array.isArray(data)||data.sitemap!==undefined&&!Array.isArray(data.sitemap))fail('invalid_response');
 const entries=data.sitemap??[];
 if(entries.length>100)fail('invalid_response');
 const rows=entries.filter(x=>x.path===JOB_ORIGIN+'/sitemap.xml').map(x=>{
  const number=v=>/^\d+$/.test(String(v))&&Number.isSafeInteger(Number(v))?Number(v):null;
  return {url:x.path,last_downloaded:timestamp(x.lastDownloaded),last_submitted:timestamp(x.lastSubmitted),pending:x.isPending===true,errors:number(x.errors),warnings:number(x.warnings),submitted_pages:(x.contents||[]).filter(c=>c.type==='web').map(c=>number(c.submitted))[0]??null};
 });
 return {state:rows.length?'available':'no_data',rows};
}
export function searchInspection(data,path) {
 const item=data?.inspectionResult?.indexStatusResult;
 if(!item||typeof item!=='object')fail('invalid_response');
 return {state:'available',url:JOB_ORIGIN+path,verdict:text(item.verdict,40),coverage:text(item.coverageState),indexing_state:text(item.indexingState,80),fetch_state:text(item.pageFetchState,80),robots_state:text(item.robotsTxtState,80),last_crawl:timestamp(item.lastCrawlTime),google_canonical:searchPage(item.googleCanonical),user_canonical:searchPage(item.userCanonical)};
}
async function readJSON(response) {
 if(!response.ok){if(response.body)await response.body.cancel();fail(response.status===401||response.status===403?'permission_denied':response.status===429?'rate_limited':'google_unavailable');}
 if(Number(response.headers.get('content-length'))>262144){await response.body?.cancel();fail('response_too_large');}
 const reader=response.body?.getReader();if(!reader)fail('invalid_response');
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();fail('response_too_large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('invalid_response');}
}
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const encode=value=>b64(new TextEncoder().encode(JSON.stringify(value)));
export async function searchAssertion(secret,now=Date.now()) {
 let value;
 try {value=JSON.parse(secret);}catch{fail('invalid_credentials');}
 if(value?.type!=='service_account'||!/^[-a-z0-9]+@[-a-z0-9]+\.iam\.gserviceaccount\.com$/.test(value.client_email||'')||typeof value.private_key!=='string'||value.private_key.length>12000)fail('invalid_credentials');
 try {
  const pem=value.private_key.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const iat=Math.floor(now/1000);
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:value.client_email,scope:SEARCH_SCOPE,aud:TOKEN_URL,iat,exp:iat+3600});
  return unsigned+'.'+b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))));
 }catch{fail('invalid_credentials');}
}

export async function syncSearchConsole(env,trigger='scheduled',now=Date.now(),fetcher=fetch) {
 if(!['scheduled','owner'].includes(trigger))throw Error('Unknown search trigger.');
 if(!await enabled(env))return {state:'paused'};
 if(!configured(env))return {state:'not_configured'};
 const day=iso(now).slice(0,10);
 const reserved=await env.DB.prepare("INSERT INTO search_runs(day,state,trigger_kind,created_at) VALUES(?,'running',?,?) ON CONFLICT DO NOTHING RETURNING day").bind(day,trigger,iso(now)).first();
 if(!reserved){const old=await env.DB.prepare('SELECT day,state,requests FROM search_runs WHERE day=?').bind(day).first();return {...old,reused:true};}
 const request=async(url,options={})=>{
  if(!await enabled(env))fail('paused');
  // A consumed reservation is not released after an unknown network outcome.
  const allowed=await env.DB.prepare("UPDATE search_runs SET requests=requests+1 WHERE day=? AND state='running' AND requests<10 RETURNING requests").bind(day).first();
  if(!allowed)fail('read_failed');
  // This deployed Workerd version only accepts manual/follow. Never follow a
  // redirect with an assertion or bearer token; readJSON rejects every 3xx.
  let response;try{response=await fetcher(url,{...options,redirect:'manual',signal:AbortSignal.timeout(8000)});}catch{fail('network_unavailable');}
  return readJSON(response);
 };
 try {
  const assertion=await searchAssertion(env.SEARCH_CONSOLE_SERVICE_ACCOUNT,now);
  const token=await request(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>8192)fail('invalid_response');
  const headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'};
  const site=await request(API,{headers});
  if(site.siteUrl!==SEARCH_PROPERTY||!['siteOwner','siteFullUser','siteRestrictedUser'].includes(site.permissionLevel))fail('permission_denied');
  const window=searchWindow(now),result={property:SEARCH_PROPERTY,observed_at:iso(now),window,permission:site.permissionLevel,parts:{},inspections:[]};
  const part=async(fn)=>{try{return await fn();}catch(error){if(codeOf(error)==='paused')throw error;return {state:'error',error:codeOf(error)};}};
  for(const [kind,dimensions] of [['total',[]],['dates',['date']],['pages',['page']]]){
   result.parts[kind]=await part(async()=>searchAnalytics(await request(API+'/searchAnalytics/query',{method:'POST',headers,body:JSON.stringify({startDate:window.startDate,endDate:window.endDate,dataState:'final',type:'web',dimensions,aggregationType:kind==='pages'?'byPage':'byProperty',rowLimit:kind==='pages'?100:kind==='dates'?28:1})}),kind,window));
  }
  result.parts.sitemaps=await part(async()=>searchSitemaps(await request(API+'/sitemaps',{headers})));
  for(const path of INSPECTION_PATHS){const read=await part(async()=>searchInspection(await request(INSPECT,{method:'POST',headers,body:JSON.stringify({inspectionUrl:JOB_ORIGIN+path,siteUrl:SEARCH_PROPERTY,languageCode:'en-GB'})}),path));result.inspections.push({url:JOB_ORIGIN+path,...read});}
  if(!await enabled(env))fail('paused');
  const all=[...Object.values(result.parts),...result.inspections],errors=all.filter(x=>x.state==='error').length;
  const state=errors===all.length?'failed':errors?'partial':'completed';
  await env.DB.prepare("UPDATE search_runs SET state=?,finished_at=?,result=? WHERE day=? AND state='running'").bind(state,iso(),JSON.stringify(result),day).run();
  return {day,state,errors};
 }catch(error){
  // If the final write committed before its acknowledgement was lost, keep it.
  const prior=await env.DB.prepare('SELECT state FROM search_runs WHERE day=?').bind(day).first();
  if(prior?.state!=='running')return {day,state:prior?.state||'uncertain',reused:true};
  const code=codeOf(error),state=code==='paused'?'paused':'failed';
  await env.DB.prepare("UPDATE search_runs SET state=?,finished_at=?,result=? WHERE day=? AND state='running'").bind(state,iso(),JSON.stringify({error:code}),day).run();
  return {day,state,error:code};
 }
}
export async function searchSnapshot(env,now=Date.now(),{compact=false}={}) {
 const latestRow=await env.DB.prepare('SELECT day,state,trigger_kind,created_at,finished_at,requests,result FROM search_runs ORDER BY day DESC LIMIT 1').first();
 const latest=latestRow?{...latestRow,result:latestRow.result?JSON.parse(latestRow.result):null}:null;
 const runs=compact?[]:(await env.DB.prepare('SELECT day,state,trigger_kind,created_at,finished_at,requests FROM search_runs ORDER BY day DESC LIMIT 7').all()).results;
 if(compact&&latest?.result?.parts){delete latest.result.parts.pages;delete latest.result.parts.dates;}
 const readingEnabled=!!(await env.DB.prepare('SELECT enabled FROM search_controls WHERE singleton=1').first())?.enabled;
 const businessEnabled=!!(await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first())?.enabled;
 const active=readingEnabled&&businessEnabled,hasCredentials=configured(env),age=now-Date.parse(latest?.created_at);
 const status=!active?'paused':!hasCredentials?'not_configured':!latest?'awaiting_first_read':!Number.isFinite(age)||age< -300000?'invalid_timestamp':age>36*3600000?'overdue':latest.state==='running'&&age>600000?'interrupted':latest.state;
 return {property:SEARCH_PROPERTY,enabled:active,reading_enabled:readingEnabled,business_enabled:businessEnabled,configured:hasCredentials,status,latest,runs,schedule:'Once per UTC day through the hourly business workflow.',scope:'Read-only Google search data for this property; no raw search queries or customer records.',limits:{requests_daily:10,inspection_urls:4,page_rows:100},connected:active&&hasCredentials&&latest?.state==='completed'&&status==='completed'};
}
export function searchFindings(search) {
 const item=(id,title,detail,severity='normal')=>({id,category:'growth',severity,title,detail,next_action:'Inspect the private Search performance desk and the exact Google property. Keep source dates and missing-data states; do not infer rankings or request mass indexing.'});
 if(!search||search.status==='not_configured')return [item('search-console','Connect read-only Google search data','The cloud search reader is not connected. A browser observation is not a persistent API connection.')];
 if(search.status==='paused')return [];
 if(search.status!=='completed')return [item('search-console-read','Inspect the Google search read',`Latest search state: ${search.status}. Previous evidence is retained; missing results are not zero traffic.`)];
 const result=search.latest?.result;
 const issues=[];
 if(result?.parts?.total?.state==='no_data')issues.push(item('search-baseline','Collect a search baseline','Google returned no finalized rows for the requested window. No traffic or ranking improvement is demonstrated.'));
 const notIndexed=result?.inspections?.filter(x=>x.state==='available'&&x.verdict==='NEUTRAL')||[];
 if(notIndexed.length)issues.push(item('search-indexing','Review sampled pages not indexed by Google',notIndexed.length+' of the four inspected URLs are not indexed in Google’s stored inspection result. This is not site-wide index coverage.'));
 const failed=result?.inspections?.filter(x=>x.state==='available'&&x.verdict==='FAIL')||[];
 if(failed.length)issues.push(item('search-inspection','Review failed Google indexing inspections',failed.length+' sampled URLs have failed indexing verdicts. Check their stored crawl details.'));
 if(result?.parts?.sitemaps?.rows?.some(x=>(x.errors||0)>0))issues.push(item('search-sitemap','Investigate Google sitemap errors','Google reports errors for the submitted primary sitemap.'));
 return issues;
}
// adminAPI authenticates the owner before reaching this handler.
export async function searchAPI(request,env,owner) {
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&path==='/api/admin/search')return reply(await searchSnapshot(env));
 if(request.method!=='POST')return reply({error:'Not found'},404);
 if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!await limit(env,'search-owner:'+owner.user.id,6))return reply({error:'Try again later.'},429);
 let body;try{body=await bodyJSON(request,512);}catch{return reply({error:'Invalid request.'},400);}
 if(path==='/api/admin/search/run')return reply(await syncSearchConsole(env,'owner'));
 if(path==='/api/admin/search/settings'&&typeof body?.enabled==='boolean'&&Object.keys(body).length===1){
  await env.DB.batch([
   env.DB.prepare('UPDATE search_controls SET enabled=?,updated_at=?,actor=? WHERE singleton=1').bind(body.enabled?1:0,iso(),owner.user.id),
   env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(owner.user.id,'search-reading',String(body.enabled),iso())
  ]);return reply({ok:true});
 }
 return reply({error:'Invalid request.'},400);
}
