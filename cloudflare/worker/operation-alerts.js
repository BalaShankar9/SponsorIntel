import {bodyJSON,limit,reply,sameOrigin} from './auth.js';
const iso=(n=Date.now())=>new Date(n).toISOString(),DAY=86400000;
const error=(message,status=409)=>Object.assign(Error(message),{status});
const validAddress=email=>typeof email==='string'&&email.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email);
async function verifiedOwner(env,userId){
 const user=await env.DB.prepare('SELECT u.id,u.email,u.emailVerified FROM user u JOIN admin_members a ON a.user_id=u.id WHERE u.id=?').bind(userId).first();
 return user?.emailVerified&&validAddress(user.email)?user:null;
}
const mailAvailable=env=>!!env.EMAIL&&env.EMAIL_VERIFICATION_ENABLED==='true';

export async function configureOperationAlerts(env,userId,body,now=Date.now()){
 if(typeof body?.enabled!=='boolean'||!(body.revision===null||Number.isSafeInteger(body.revision)))throw error('Reload the alert setting.',400);
 const user=await env.DB.prepare('SELECT u.id,u.email,u.emailVerified FROM user u JOIN admin_members a ON a.user_id=u.id WHERE u.id=?').bind(userId).first();
 if(!user||(body.enabled&&(!user.emailVerified||!validAddress(user.email))))throw error('A verified owner email is required.',403);
 if(body.enabled&&!mailAvailable(env))throw error('Operational email is unavailable.');
 const row=await env.DB.prepare('SELECT * FROM operation_alert_settings WHERE user_id=?').bind(userId).first();
 if((row?.revision??null)!==body.revision)throw error('The alert setting changed. Reload before saving.');
 if(body.enabled){
  const n=await env.DB.prepare('SELECT COUNT(*) n FROM operation_alert_settings WHERE enabled=1 AND user_id<>?').bind(userId).first();
  if(n.n>=5)throw error('Five owners already receive operational alerts.');
 }
 const result=await env.DB.prepare(`INSERT INTO operation_alert_settings(user_id,enabled,destination,updated_at) VALUES(?,?,?,?)
  ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,destination=excluded.destination,revision=revision+1,updated_at=excluded.updated_at,
   last_fingerprint=CASE WHEN destination=excluded.destination THEN last_fingerprint ELSE NULL END,
   last_alert_at=CASE WHEN destination=excluded.destination THEN last_alert_at ELSE NULL END,
   last_count=CASE WHEN destination=excluded.destination THEN last_count ELSE 0 END
  WHERE revision=? RETURNING revision`).bind(userId,+body.enabled,user.email,iso(now),body.revision).first();
 if(!result)throw error('The alert setting changed. Reload before saving.');
 await env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(userId,'operation-alert-setting',String(body.enabled),iso(now)).run();
 return {ok:true};
}

// Fixed counts and links only. Never interpolate incident details, user reports or URLs.
export function operationAlertEmail(to,kind,counts,stamp,id){
 if(!validAddress(to)||!['incident','recovery','test'].includes(kind)||!Number.isFinite(Date.parse(stamp))||!/^[-a-f0-9]{36}$/.test(id)||![counts.critical,counts.high].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=251))throw Error('Invalid operational message');
 const heading=kind==='test'?'Check your Sponsor Intel alert connection':kind==='recovery'?'Sponsor Intel: reported findings cleared':'Sponsor Intel needs your attention';
 const context=kind==='test'?'This is the alert-connection test you requested. No outage is being reported.':kind==='recovery'?'The high-priority findings previously reported to you are no longer present in the latest checks. This does not establish that every service or security control is healthy.':`${counts.critical} critical and ${counts.high} high-priority findings need review. Open the operating desk for the recorded evidence and next actions.`;
 const text=`${context}\n\nChecked: ${stamp}\nReceipt: ${id}\n\nOperating desk: https://sponsorintel.london/admin#operation-alerts\n\nYou enabled these operational alerts for your verified owner account. Turn them off in the operating desk. At most four messages per UTC day, including tests; unchanged incidents are reminded at most daily. No CVs or customer details are included.\n\nChecks run on Cloudflare and cannot independently detect a complete Cloudflare outage.`;
 return {from:{email:'accounts@sponsorintel.london',name:'Sponsor Intel operations'},to,subject:heading,text,html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#183d32"><h1>${heading}</h1><p>${context}</p><p>Checked: ${stamp}</p><p>Receipt: ${id}</p><p><a href="https://sponsorintel.london/admin#operation-alerts">Open the operating desk</a></p><p>You enabled these operational alerts for your verified owner account. Turn them off in the operating desk. At most four messages per UTC day, including tests; unchanged incidents are reminded at most daily. No CVs or customer details are included.</p><p>Checks run on Cloudflare and cannot independently detect a complete Cloudflare outage.</p></div>`};
}

export async function operationAlertSnapshot(env,now=Date.now()){
 const run=await env.DB.prepare('SELECT id,state,created_at FROM business_runs ORDER BY created_at DESC LIMIT 1').first();
 const items=(await env.DB.prepare("SELECT id,severity,first_seen FROM business_issues WHERE state='open' AND severity IN ('critical','high') ORDER BY id LIMIT 250").all()).results;
 const age=now-Date.parse(run?.created_at);
 if(!run||!Number.isFinite(age)||age< -300000||age>2*3600000)
  items.push({id:'operations-overdue',severity:'critical',first_seen:'overdue'});
 else if(run.state==='failed')items.push({id:'operations-failed',severity:'critical',first_seen:run.created_at});
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(items)));
 return {fingerprint:Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join(''),critical:items.filter(x=>x.severity==='critical').length,high:items.filter(x=>x.severity==='high').length,run_id:run?.id??null};
}

async function deliver(env,settings,snapshot,kind,now){
 if(!mailAvailable(env))return {state:'unavailable'};
 const id=crypto.randomUUID(),stamp=iso(now),day=stamp.slice(0,10);
 // A durable reservation precedes the side effect. Lost responses never auto-retry.
 let reserved;
 try{reserved=await env.DB.prepare(`INSERT INTO operation_alert_deliveries(id,user_id,settings_revision,destination,kind,fingerprint,source_run,critical_count,high_count,state,created_at)
  SELECT ?,s.user_id,s.revision,s.destination,?,?,?,?,?,'reserved',? FROM operation_alert_settings s
  JOIN user u ON u.id=s.user_id JOIN admin_members a ON a.user_id=s.user_id
  WHERE s.user_id=? AND s.enabled=1 AND s.revision=? AND u.emailVerified=1 AND u.email=s.destination
   AND s.last_fingerprint IS ? AND s.last_alert_at IS ?
   AND (?='test' OR (SELECT enabled FROM business_controls WHERE singleton=1)=1)
   AND NOT EXISTS(SELECT 1 FROM operation_alert_deliveries WHERE user_id=s.user_id AND state IN ('reserved','uncertain'))
   AND (SELECT COUNT(*) FROM operation_alert_deliveries WHERE user_id=s.user_id AND substr(created_at,1,10)=?)<4
   AND (SELECT COUNT(*) FROM operation_alert_deliveries WHERE substr(created_at,1,10)=?)<20
   AND (?<>'test' OR NOT EXISTS(SELECT 1 FROM operation_alert_deliveries WHERE user_id=s.user_id AND kind='test' AND substr(created_at,1,10)=?))
  RETURNING id`).bind(id,kind,snapshot.fingerprint,snapshot.run_id,snapshot.critical,snapshot.high,stamp,settings.user_id,settings.revision,settings.last_fingerprint,settings.last_alert_at,kind,day,day,kind,day).first();}
 catch(e){if(/UNIQUE constraint failed/i.test(String(e)))return {state:'held'};throw e;}
 if(!reserved)return {state:'held'};
 const still=await env.DB.prepare(`SELECT s.enabled FROM operation_alert_settings s JOIN user u ON u.id=s.user_id JOIN admin_members a ON a.user_id=s.user_id
  WHERE s.user_id=? AND s.revision=? AND s.enabled=1 AND u.emailVerified=1 AND u.email=s.destination
  AND (?='test' OR (SELECT enabled FROM business_controls WHERE singleton=1)=1)`).bind(settings.user_id,settings.revision,kind).first();
 if(!still){await env.DB.prepare("UPDATE operation_alert_deliveries SET state='cancelled',finished_at=? WHERE id=? AND state='reserved'").bind(iso(),id).run();return {state:'cancelled',id};}
 let timer;
 try{
  const receipt=await Promise.race([
   env.EMAIL.send(operationAlertEmail(settings.destination,kind,snapshot,stamp,id)),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Provider outcome unknown')),15000);}),
  ]);
  if(typeof receipt?.messageId!=='string'||!receipt.messageId||receipt.messageId.length>512)throw Error('Missing provider receipt');
  await env.DB.batch([
   env.DB.prepare("UPDATE operation_alert_deliveries SET state=CASE WHEN received_at IS NULL THEN 'accepted' ELSE 'confirmed' END,message_id=?,finished_at=? WHERE id=?").bind(receipt.messageId,iso(),id),
   env.DB.prepare("UPDATE operation_alert_settings SET last_fingerprint=?,last_alert_at=?,last_count=? WHERE user_id=? AND revision=? AND ?<>'test'").bind(snapshot.fingerprint,stamp,snapshot.critical+snapshot.high,settings.user_id,settings.revision,kind),
  ]);
  return {state:'accepted',id};
 }catch{
  await env.DB.prepare("UPDATE operation_alert_deliveries SET state='uncertain',finished_at=? WHERE id=? AND state='reserved'").bind(iso(),id).run();
  return {state:'uncertain',id};
 }finally{clearTimeout(timer);}
}

export async function scanOperationAlerts(env,now=Date.now()){
 if(!(await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first())?.enabled)return {state:'paused'};
 const owners=(await env.DB.prepare('SELECT * FROM operation_alert_settings WHERE enabled=1 ORDER BY user_id LIMIT 5').all()).results;
 const snapshot=owners.length?await operationAlertSnapshot(env,now):null;
 const results=[];
 for(const settings of owners){
  const count=snapshot.critical+snapshot.high;
  if(!count&&!settings.last_count)continue;
  if(snapshot.fingerprint===settings.last_fingerprint&&(!count||now-Date.parse(settings.last_alert_at)<DAY))continue;
  results.push(await deliver(env,settings,snapshot,count?'incident':'recovery',now));
 }
 const result={checked_at:iso(now),owners:owners.length,attempted:results.filter(r=>r.id).length,accepted:results.filter(r=>r.state==='accepted').length,held:results.filter(r=>['held','uncertain','unavailable'].includes(r.state)).length};
 await env.DB.prepare("INSERT INTO metadata(key,value) VALUES('operation_alerts',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(result)).run();
 await env.DB.prepare("DELETE FROM operation_alert_deliveries WHERE state IN ('accepted','confirmed','cancelled') AND created_at<?").bind(iso(now-90*DAY)).run();
 return result;
}

export async function operationAlertsStatus(env,userId){
 const user=await verifiedOwner(env,userId),settings=await env.DB.prepare('SELECT * FROM operation_alert_settings WHERE user_id=?').bind(userId).first();
 const deliveries=(await env.DB.prepare('SELECT id,kind,state,critical_count,high_count,source_run,created_at,finished_at,message_id,received_at FROM operation_alert_deliveries WHERE user_id=? ORDER BY created_at DESC LIMIT 12').bind(userId).all()).results;
 const pending=await env.DB.prepare("SELECT id FROM operation_alert_deliveries WHERE user_id=? AND state IN ('reserved','uncertain') LIMIT 1").bind(userId).first();
 const receipt=await env.DB.prepare("SELECT value FROM metadata WHERE key='operation_alerts'").first();
 return {enabled:!!settings?.enabled,revision:settings?.revision??null,destination:user?.email??null,verified:!!user,available:mailAvailable(env),address_changed:!!settings&&settings.destination!==user?.email,pending:pending?.id??null,deliveries,last_scan:receipt?JSON.parse(receipt.value):null};
}

export async function operationAlertsAPI(request,env,owner){
 const userId=owner.user.id,path=new URL(request.url).pathname;
 if(request.method==='GET'&&path==='/api/admin/business/alerts')return reply(await operationAlertsStatus(env,userId));
 if(request.method!=='POST')return reply({error:'Not found'},404);
 if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!(await limit(env,'operation-alert-owner:'+userId,8)))return reply({error:'Try again later.'},429);
 try{
  const body=await bodyJSON(request,1024);
  if(path.endsWith('/settings'))return reply(await configureOperationAlerts(env,userId,body));
  if(path.endsWith('/test')){
   const settings=await env.DB.prepare('SELECT * FROM operation_alert_settings WHERE user_id=?').bind(userId).first();
   if(!settings?.enabled||settings.revision!==body.revision)throw error('Enable alerts and reload the current setting first.');
   return reply(await deliver(env,settings,{fingerprint:'test',critical:0,high:0,run_id:null},'test',Date.now()));
  }
  if(path.endsWith('/received')){
   if(typeof body.id!=='string'||body.id.length>64)throw error('Choose a delivery receipt.',400);
   const row=await env.DB.prepare("SELECT * FROM operation_alert_deliveries WHERE id=? AND user_id=? AND state IN ('reserved','uncertain','accepted','confirmed')").bind(body.id,userId).first();
   if(!row)throw error('Delivery receipt not found.',404);
   await env.DB.batch([
    env.DB.prepare("UPDATE operation_alert_deliveries SET state='confirmed',received_at=COALESCE(received_at,?) WHERE id=? AND user_id=?").bind(iso(),row.id,userId),
    env.DB.prepare("UPDATE operation_alert_settings SET last_fingerprint=?,last_alert_at=?,last_count=? WHERE user_id=? AND revision=? AND ?<>'test' AND (last_alert_at IS NULL OR last_alert_at<=?)").bind(row.fingerprint,row.created_at,row.critical_count+row.high_count,userId,row.settings_revision,row.kind,row.created_at),
    env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(userId,'operation-alert-received',row.id,iso()),
   ]);return reply({ok:true});
  }
  return reply({error:'Not found'},404);
 }catch(e){return reply({error:e.status?e.message:'Alert request could not be completed.'},e.status||500);}
}
