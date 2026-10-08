import {bodyJSON,digest,limit,reply,sameOrigin} from './auth.js';
import launch from '../shared/marketing-launch.json' with {type:'json'};
import approvedMedia from '../shared/marketing-media.json' with {type:'json'};
import {instagramWelcomeContent,WELCOME_TOPIC} from './marketing-welcome.js';

export const destinations=Object.freeze({
 'facebook-company':{label:'Facebook · Sponsor Intel',account:'1319703417896763',provider:'metricool',url:'https://www.facebook.com/profile.php?id=61595389821505'},
 'instagram-company':{label:'Instagram · Sponsor Intel',account:'sponsorintellondon',provider:'metricool',url:'https://www.instagram.com/sponsorintellondon/'},
 'linkedin-company':{label:'LinkedIn · Sponsor Intel',account:'146710167',provider:'linkedin-native',url:'https://www.linkedin.com/company/sponsorintellondon/'},
 'linkedin-personal':{label:'LinkedIn · Bala',account:'bala-sankar-bollineni-b246bb189',provider:'linkedin-native',url:'https://www.linkedin.com/in/bala-sankar-bollineni-b246bb189/'},
});
const stamp=(now=Date.now())=>new Date(now).toISOString();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const clean=(value,max,min=1)=>{
 if(typeof value!=='string'||value.trim().length<min||value.length>max) fail('Missing or oversized content.');
 return value.trim();
};
const time=(value,now)=>{
 const parsed=Date.parse(value);
 if(typeof value!=='string'||!Number.isFinite(parsed)||parsed>now+300000) fail('Use an observed timestamp, not a future check.');
 return stamp(parsed);
};
function publicURL(value){
 let u;try{u=new URL(value);}catch{fail('Use a public HTTPS source link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>1000||
    !['sponsorintel.london','www.gov.uk'].includes(u.hostname)||u.search||u.hash) fail('Use a clean Sponsor Intel or GOV.UK source link.');
 return u.href;
}
export function validateVersion(input,now=Date.now(),destination){
 const purpose=clean(input?.purpose,1000,20),text=clean(input?.text,3000,30);
 if(!Array.isArray(input.sources)||input.sources.length<1||input.sources.length>8) fail('Add one to eight public evidence sources.');
 const sources=input.sources.map(s=>({url:publicURL(s.url),title:clean(s.title,160),excerpt:clean(s.excerpt,1600,20),checked_at:time(s.checked_at,now)}));
 const expiry=Date.parse(input.expires_at);
 if(!Number.isFinite(expiry)||expiry<=now||expiry>now+7*86400000||sources.some(s=>Date.parse(s.checked_at)<now-7*86400000||expiry>Date.parse(s.checked_at)+7*86400000)) fail('Evidence must be current and expire within seven days of its oldest check.');
 const supplied=input.media??[];
 if(!Array.isArray(supplied)||supplied.length>10)fail('Use up to ten registered images.');
 const seen=new Set(),media=supplied.map(item=>{
  const asset=approvedMedia.find(a=>a.id===item?.asset_id);
  if(!asset||seen.has(asset.id)||Object.keys(item).some(k=>!['asset_id','alt'].includes(k)))fail('Use distinct registered images and their accessibility text.');
  seen.add(asset.id);
  return {...asset,alt:clean(item.alt,1000,20)};
 });
 if(destination==='instagram-company'&&(media.length<1||text.length>2200))fail('Instagram needs an image and a caption of at most 2,200 characters.');
 return {purpose,text,sources,expires_at:stamp(expiry),media};
}
async function existingEvent(env,key,hash){
 const event=await env.DB.prepare('SELECT brief_id,request_hash FROM marketing_events WHERE request_key=?').bind(key).first();
 if(!event)return null;
 if(event.request_hash!==hash)fail('This operation key already refers to different content.',409);
 return {id:event.brief_id,replayed:true};
}
// Internal callers supply the actor. HTTP callers cannot claim to be a different reviewer.
export async function createBrief(env,input,actor,now=Date.now()){
 const destination=clean(input.destination,60),topic=clean(input.topic_key,160),title=clean(input.title,160);
 if(!Object.hasOwn(destinations,destination)||!/^[a-zA-Z0-9:_-]+$/.test(topic))fail('Unknown destination or topic.');
 const version=validateVersion(input,now,destination),id=crypto.randomUUID(),event=crypto.randomUUID();
 const {media,...textVersion}=version;
 // Preserve replay hashes for existing text-only briefs across this release.
 const hash=await digest(JSON.stringify({topic,destination,title,...textVersion,...(media.length?{media}:{})}));
 const key='create:'+await digest(topic+':'+destination);
 const prior=await existingEvent(env,key,hash);if(prior)return prior;
 const sql=[
  env.DB.prepare("INSERT INTO marketing_briefs VALUES(?,?,?,?,'proposed',1,1,?,?,?)").bind(id,topic,destination,title,event,stamp(now),stamp(now)),
  env.DB.prepare('INSERT INTO marketing_versions VALUES(?,1,?,?,?,?,?,?)').bind(id,version.purpose,version.text,JSON.stringify(version.sources),version.expires_at,actor,stamp(now)),
  env.DB.prepare('INSERT INTO marketing_media_versions VALUES(?,1,?)').bind(id,JSON.stringify(version.media)),
  env.DB.prepare('INSERT INTO marketing_events VALUES(?,?,1,1,?,?,?,?,?,?)').bind(event,id,'proposed',actor,'Brief prepared. No review or delivery is implied.',stamp(now),key,hash),
 ];
 try{await env.DB.batch(sql);}catch(e){const replay=await existingEvent(env,key,hash);if(replay)return replay;throw e;}
 return {id,replayed:false};
}
function validateReceipt(input,brief,kind,now){
 const destination=destinations[brief.destination];
 if(input?.account!==destination.account||input.provider!==destination.provider)fail('Receipt account and provider must match the exact destination.');
 const external_id=clean(input.external_id,200),observed_at=time(input.observed_at,now),evidence=clean(input.evidence,1200,20);
 if(!/^[a-zA-Z0-9:_-]+$/.test(external_id))fail('Invalid provider receipt ID.');
 if(brief.media.length&&['scheduled','published'].includes(kind)&&
    JSON.stringify(input.media_sha256)!==JSON.stringify(brief.media.map(m=>m.sha256)))fail('Confirm the exact ordered images against the provider receipt.');
 let scheduled_at=null,post_url=null;
 if(kind==='scheduled'){
  const scheduled=Date.parse(input.scheduled_at);
  if(!Number.isFinite(scheduled)||scheduled<=now||scheduled>now+30*86400000)fail('The provider schedule must be in the next 30 days.');
  scheduled_at=stamp(scheduled);
 }
 if(kind==='published'){
  let u;try{u=new URL(input.post_url);}catch{fail('A published post URL is required.');}
  const valid=brief.destination==='facebook-company'
   ? u.hostname==='www.facebook.com'&&(/\/posts\/[^/]+/.test(u.pathname)||u.pathname==='/permalink.php'&&u.searchParams.has('story_fbid'))
   : brief.destination==='instagram-company'
    ? u.hostname==='www.instagram.com'&&/^\/p\/[A-Za-z0-9_-]+\/$/.test(u.pathname)&&!u.search&&!u.hash
    : u.hostname==='www.linkedin.com'&&(/^\/feed\/update\/urn:li:/.test(u.pathname)||/^\/posts\/.+/.test(u.pathname));
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>1000||!valid)fail('Use the actual post URL on the selected social network.');
  post_url=u.href;
 }
 return {external_id,observed_at,evidence,scheduled_at,post_url,provider:destination.provider};
}
export async function decideBrief(env,input,actor,now=Date.now()){
 const key=clean(input.request_key,100),hash=await digest(JSON.stringify({actor,input}));
 const replay=await existingEvent(env,key,hash);if(replay)return replay;
 const brief=await env.DB.prepare('SELECT b.*,v.writer,v.expires_at FROM marketing_briefs b JOIN marketing_versions v ON v.brief_id=b.id AND v.version=b.version WHERE b.id=?').bind(input.id).first();
 if(!brief)fail('Brief not found.',404);
 const storedMedia=await env.DB.prepare('SELECT assets FROM marketing_media_versions WHERE brief_id=? AND version=?').bind(brief.id,brief.version).first();
 brief.media=JSON.parse(storedMedia?.assets||'[]');
 if(input.revision!==brief.revision)fail('This brief changed. Refresh before deciding.',409);
 const kind=input.kind,note=clean(input.note,1600,20),event=crypto.randomUUID();
 if(['reviewed','scheduled'].includes(kind)&&brief.topic_key.startsWith('report:')){
  const publication=await env.DB.prepare("SELECT v.id FROM insight_versions v JOIN insight_publications p ON p.slug=v.slug WHERE v.id=? AND p.state='published' AND p.updated_at=v.created_at").bind(brief.topic_key.slice(7)).first();
  if(!publication)fail('This report was withdrawn or replaced. Prepare a brief for the current version.',409);
 }
 let next=kind,version=brief.version,draft=null,receipt=null;
 if(kind==='revise'){
  if(!['proposed','held','reviewed'].includes(brief.state))fail('Reconcile delivery before changing scheduled content.',409);
  draft=validateVersion(input.content,now,brief.destination);version++;next='proposed';
 }else if(kind==='held'){
  if(!['proposed','held','reviewed'].includes(brief.state))fail('Holding a brief does not cancel a provider schedule.',409);
 }else if(kind==='reviewed'){
  if(!['proposed','held'].includes(brief.state)||brief.writer===actor)fail('A different reviewer must assess the current version.',409);
  if(Date.parse(brief.expires_at)<=now)fail('Evidence expired. Revise with fresh sources before review.',409);
  if(!['claims','sources','destination','duplication'].every(k=>input.checks?.[k]===true))fail('Complete every review check.');
  if(brief.media.length&&input.checks?.media!==true)fail('Review the image, its claims and accessibility text.');
 }else if(['scheduled','published','failed','uncertain','cancelled'].includes(kind)){
  const allowed=kind==='scheduled'?['reviewed']:['scheduled','uncertain'];
  if(!allowed.includes(brief.state))fail('This delivery transition is not allowed.',409);
  if(kind==='scheduled'&&Date.parse(brief.expires_at)<=now)fail('Evidence expired before scheduling.',409);
  if(kind==='scheduled'&&brief.destination==='instagram-company'&&!brief.media.length)fail('Instagram needs reviewed image media.');
  receipt=validateReceipt(input.receipt,brief,kind,now);
  if(kind==='scheduled'&&Date.parse(receipt.scheduled_at)>Date.parse(brief.expires_at))fail('Schedule must be before evidence expires.');
  const previous=await env.DB.prepare('SELECT observed_at FROM marketing_receipts WHERE brief_id=? ORDER BY observed_at DESC LIMIT 1').bind(brief.id).first();
  if(previous&&receipt.observed_at<previous.observed_at)fail('An older receipt cannot replace newer evidence.',409);
  const duplicate=await env.DB.prepare('SELECT brief_id FROM marketing_receipts WHERE provider=? AND destination=? AND external_id=? AND brief_id<>? LIMIT 1').bind(receipt.provider,brief.destination,receipt.external_id,brief.id).first();
  if(duplicate)fail('This provider receipt already belongs to another brief.',409);
 }else fail('Unknown decision.');
 const sql=[env.DB.prepare('UPDATE marketing_briefs SET state=?,version=?,revision=revision+1,last_event=?,updated_at=? WHERE id=? AND revision=? RETURNING id').bind(next,version,event,stamp(now),brief.id,brief.revision)];
 if(draft)sql.push(env.DB.prepare('INSERT INTO marketing_versions SELECT id,?,?,?,?,?,?,? FROM marketing_briefs WHERE id=? AND last_event=?').bind(version,draft.purpose,draft.text,JSON.stringify(draft.sources),draft.expires_at,actor,stamp(now),brief.id,event));
 if(draft)sql.push(env.DB.prepare('INSERT INTO marketing_media_versions SELECT id,?,? FROM marketing_briefs WHERE id=? AND last_event=?').bind(version,JSON.stringify(draft.media),brief.id,event));
 sql.push(env.DB.prepare('INSERT INTO marketing_events SELECT ?,id,revision,version,?,?,?,?,?,? FROM marketing_briefs WHERE id=? AND last_event=?').bind(event,kind,actor,JSON.stringify({note,checks:kind==='reviewed'?input.checks:undefined,media_sha256:receipt&&['scheduled','published'].includes(kind)?brief.media.map(m=>m.sha256):undefined}),stamp(now),key,hash,brief.id,event));
 if(receipt)sql.push(env.DB.prepare('INSERT INTO marketing_receipts SELECT ?,id,version,destination,?,?,?,?,?,?,? FROM marketing_briefs WHERE id=? AND last_event=?').bind(event,receipt.provider,receipt.external_id,kind,receipt.scheduled_at,receipt.post_url,receipt.observed_at,receipt.evidence,brief.id,event));
 let results;try{results=await env.DB.batch(sql);}catch(e){const prior=await existingEvent(env,key,hash);if(prior)return prior;throw e;}
 if(!results[0].results?.length)fail('Another decision won the update. Refresh this brief.',409);
 return {id:brief.id,state:next,version};
}

// Reconcile previously observed schedules without inventing retrospective reviews.
// These fixed records cannot be supplied by an HTTP caller or used to send a post.
async function importLaunch(env,now){
 const report=await env.DB.prepare('SELECT id FROM insight_versions ORDER BY created_at LIMIT 1').first();
 for(const item of launch){
  const topic=item.report&&report?'report:'+report.id:item.topic_key;
  const id='launch-'+item.id,event=id+':import',at=stamp(now);
  await env.DB.batch([
   env.DB.prepare("INSERT OR IGNORE INTO marketing_briefs VALUES(?,?,?,?,'scheduled',1,1,?,?,?)").bind(id,topic,item.destination,item.title,event,at,at),
   env.DB.prepare('INSERT OR IGNORE INTO marketing_versions SELECT id,1,?,?,?,?,?,? FROM marketing_briefs WHERE id=?').bind(item.purpose,item.text,JSON.stringify(item.sources),item.expires_at,'launch-operator',at,id),
   env.DB.prepare("INSERT OR IGNORE INTO marketing_events SELECT ?,id,1,1,'imported_schedule','launch-import',?,?,?,? FROM marketing_briefs WHERE id=?").bind(event,'Historical schedule observation from 7 October. No independent review or publication receipt is claimed.',at,event,event,id),
   env.DB.prepare("INSERT OR IGNORE INTO marketing_receipts SELECT ?,id,1,destination,?,?,'scheduled',?,NULL,?,? FROM marketing_briefs WHERE id=?").bind(event,destinations[item.destination].provider,item.external_id,item.scheduled_at,'2026-10-07',item.evidence,id),
  ]);
 }
}
export async function syncMarketing(env,now=Date.now()){
 await importLaunch(env,now);
 const drafts=await env.DB.prepare("SELECT o.*,v.created_at evidence_at FROM social_outbox o JOIN insight_versions v ON v.id=o.publication_id WHERE o.state='needs_connection' AND o.expires_at>? ORDER BY o.created_at DESC LIMIT 10").bind(stamp(now)).all();
 let prepared=0;
 for(const d of drafts.results){
  const destination='linkedin-'+(d.audience==='personal'?'personal':'company'),topic='report:'+d.publication_id;
  if(await env.DB.prepare('SELECT id FROM marketing_briefs WHERE topic_key=? AND destination=?').bind(topic,destination).first())continue;
  // The report snapshot predates outbox creation by a few seconds. Its source
  // date, rather than the later enqueue time, controls the evidence lifetime.
  const expiry=Math.min(Date.parse(d.expires_at),Date.parse(d.evidence_at)+7*86400000);
  if(!Number.isFinite(expiry)||expiry<=now)continue;
  try{
   await createBrief(env,{topic_key:topic,destination,title:'Dated sponsorship evidence report',purpose:'Explain the dated selected-board evidence and its limitations; help readers inspect the original report.',text:d.text,expires_at:stamp(expiry),sources:[{title:'Published Sponsor Intel evidence report',url:'https://sponsorintel.london/insights/uk-sponsorship-jobs-report',checked_at:d.evidence_at,excerpt:'Counts and limitations were compiled from the stored publication snapshot. Recheck the public report before scheduling.'}]},'report-template',now);prepared++;
  }catch(e){if(e.status!==409)throw e;}
 }
 return {prepared,external_posts_sent:0};
}
export async function marketingSnapshot(env,now=Date.now()){
 const recent='SELECT id FROM marketing_briefs ORDER BY updated_at DESC LIMIT 50';
 const records=await env.DB.batch([
  env.DB.prepare('SELECT b.*,v.purpose,v.text,v.sources,v.expires_at,v.writer FROM marketing_briefs b JOIN marketing_versions v ON v.brief_id=b.id AND v.version=b.version ORDER BY b.updated_at DESC LIMIT 50'),
  env.DB.prepare(`SELECT brief_id,revision,version,kind,actor,detail,created_at FROM marketing_events WHERE brief_id IN (${recent}) ORDER BY created_at DESC,revision DESC LIMIT 500`),
  env.DB.prepare(`SELECT brief_id,version,provider,external_id,state,scheduled_at,post_url,observed_at,evidence FROM marketing_receipts WHERE brief_id IN (${recent}) ORDER BY rowid DESC LIMIT 200`),
  env.DB.prepare(`SELECT m.brief_id,m.assets FROM marketing_media_versions m JOIN marketing_briefs b ON b.id=m.brief_id AND b.version=m.version WHERE b.id IN (${recent})`),
 ]);
 const items=[];
 for(const b of records[0].results){
  const receipts=records[2].results.filter(r=>r.brief_id===b.id).slice(0,10),last=receipts[0];
  items.push({...b,sources:JSON.parse(b.sources),media:JSON.parse(records[3].results.find(m=>m.brief_id===b.id)?.assets||'[]'),events:records[1].results.filter(e=>e.brief_id===b.id).sort((a,b)=>b.revision-a.revision).slice(0,30),receipts,
   attention:b.state==='scheduled'&&last?.scheduled_at&&Date.parse(last.scheduled_at)<=now?'Delivery check due':
    b.state==='uncertain'?'Reconcile before retry':!['published','cancelled','failed'].includes(b.state)&&Date.parse(b.expires_at)<=now?'Evidence expired':null});
 }
 return {items,destinations,measured_at:stamp(now),publishing_connected:false};
}
// Authentication is enforced by adminAPI before this handler is invoked.
export async function marketingAPI(request,env,owner){
 const path=new URL(request.url).pathname;
 if(request.method==='GET'&&path==='/api/admin/marketing')return reply(await marketingSnapshot(env));
 if(request.method!=='POST')return reply({error:'Not found'},404);
 if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!(await limit(env,'marketing-owner:'+owner.user.id,30)))return reply({error:'Try again later.'},429);
 try{
  const body=await bodyJSON(request,20000),actor='owner:'+owner.user.id;
  if(path==='/api/admin/marketing/instagram-welcome'){
   const prior=await env.DB.prepare('SELECT id FROM marketing_briefs WHERE topic_key=? AND destination=?').bind(WELCOME_TOPIC,'instagram-company').first();
   if(prior)return reply({...prior,replayed:true});
   const content=await instagramWelcomeContent(env);
   return reply(await createBrief(env,content,'template:'+WELCOME_TOPIC+':requested-by:'+owner.user.id),201);
  }
  if(path==='/api/admin/marketing/sync')return reply(await syncMarketing(env));
  if(path==='/api/admin/marketing/create')return reply(await createBrief(env,body,actor),201);
  if(path==='/api/admin/marketing/decide')return reply(await decideBrief(env,body,actor));
  return reply({error:'Not found'},404);
 }catch(e){return reply({error:e.status?e.message:'The record could not be saved. Refresh before retrying.'},e.status||400);}
}
