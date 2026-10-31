const DAY=86400000,iso=(n=Date.now())=>new Date(n).toISOString();
const ACCOUNT='b7d80aea8a0938fe6d92342fa1ac7ea6',ZONE='3b8b178dc365a000e9a7df52f909e966';
const QUEUE='sponsorintel-email-events';
const ranks={deferred:1,delivered:2,rejected:3,failed:4,bounced:5,complained:6};
const address=s=>typeof s==='string'&&s.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s);
export const messageKey=s=>typeof s==='string'&&s.length<=512&&/^[^\s<>]+$/.test(s.replace(/^<([^<>]+)>$/,'$1'))?s.replace(/^<([^<>]+)>$/,'$1'):null;
export async function emailRecipientKey(value){
 if(!address(value))throw Error('Invalid email recipient');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('sponsorintel-email-recipient:'+value.toLowerCase()));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function validate(body,env,now){
 if(!env.EMAIL_EVENT_SUBSCRIPTION||!body||JSON.stringify(body).length>16384)throw Error('Invalid email event');
 const p=body.payload,m=body.metadata,s=body.source,type=body.type?.replace(/^cf\.email\.sending\.message\./,'');
 const time=Date.parse(m?.eventTimestamp);
 if(!Object.hasOwn(ranks,type)||body.type!=='cf.email.sending.message.'+type||s?.type!=='email.sending'||s.domain!=='sponsorintel.london'||s.zoneId!==ZONE||m?.accountId!==ACCOUNT||m.eventSubscriptionId!==env.EMAIL_EVENT_SUBSCRIPTION||m.eventSchemaVersion!==1||!Number.isFinite(time)||time>now+300000||time<now-14*DAY||p?.sender!=='accounts@sponsorintel.london'||!address(p?.recipient)||!messageKey(p?.messageId)||typeof p?.eventId!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(p.eventId)||p.delivery?.status!==type||p.terminal!==(type!=='deferred')||(type==='bounced'&&!['hard','soft'].includes(p.bounce?.type)))throw Error('Invalid email event');
 return {id:p.eventId,message:messageKey(p.messageId),recipient:p.recipient,type,priority:ranks[type],bounce:type==='bounced'?p.bounce.type:null,occurred:iso(time)};
}
export async function recordEmailEvent(env,body,now=Date.now()){
 const v=validate(body,env,now),key=await emailRecipientKey(v.recipient);
 const old=await env.DB.prepare('SELECT * FROM email_delivery_events WHERE event_id=?').bind(v.id).first();
 if(old){
  if(old.message_id!==v.message||old.recipient_key!==key||old.event_type!==v.type||old.bounce_type!==v.bounce||old.occurred_at!==v.occurred)throw Error('Conflicting email event');
  return {duplicate:true};
 }
 const reason=v.type==='complained'?'complaint':v.bounce==='hard'?'hard_bounce':['bounced','failed','rejected'].includes(v.type)?'delivery_failure':null;
 const statements=[env.DB.prepare('INSERT OR IGNORE INTO email_delivery_events(event_id,message_id,recipient_key,event_type,priority,bounce_type,occurred_at,received_at) VALUES(?,?,?,?,?,?,?,?)').bind(v.id,v.message,key,v.type,v.priority,v.bounce,v.occurred,iso(now))];
 if(reason)statements.push(env.DB.prepare(`INSERT INTO email_alert_blocks(recipient_key,reason,occurred_at,expires_at) SELECT ?,?,?,?
  WHERE EXISTS(SELECT 1 FROM email_delivery_events WHERE event_id=? AND message_id=? AND recipient_key=? AND event_type=? AND occurred_at=? AND bounce_type IS ?)
  ON CONFLICT(recipient_key) DO UPDATE SET reason=excluded.reason,occurred_at=excluded.occurred_at,expires_at=excluded.expires_at
  WHERE (email_alert_blocks.expires_at IS NOT NULL AND (excluded.expires_at IS NULL OR excluded.occurred_at>email_alert_blocks.occurred_at))
   OR (excluded.reason='complaint' AND email_alert_blocks.reason<>'complaint')`).bind(key,reason,v.occurred,reason==='delivery_failure'?iso(Date.parse(v.occurred)+DAY):null,v.id,v.message,key,v.type,v.occurred,v.bounce));
 statements.push(env.DB.prepare("INSERT INTO metadata(key,value) VALUES('email_event_received',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(iso(now)));
 await env.DB.batch(statements);
 const saved=await env.DB.prepare('SELECT message_id,recipient_key,event_type,occurred_at,bounce_type FROM email_delivery_events WHERE event_id=?').bind(v.id).first();
 if(!saved||saved.message_id!==v.message||saved.recipient_key!==key||saved.event_type!==v.type||saved.occurred_at!==v.occurred||saved.bounce_type!==v.bounce)throw Error('Conflicting email event');
 return {duplicate:false};
}
export async function consumeEmailEvents(batch,env){
 if(batch.queue!==QUEUE)throw Error('Unexpected email queue');
 let accepted=0,retried=0;
 for(const message of batch.messages){
  try{await recordEmailEvent(env,message.body);message.ack();accepted++;}
  catch{message.retry({delaySeconds:60});retried++;}
 }
 // Never log the body, recipient, subject, SMTP response or exception payload.
 console.log(JSON.stringify({event:'email_event_batch',accepted,retried}));
}
export async function alertEmailBlock(env,email,now=Date.now()){
 return env.DB.prepare('SELECT reason,occurred_at,expires_at FROM email_alert_blocks WHERE recipient_key=? AND (expires_at IS NULL OR expires_at>?)').bind(await emailRecipientKey(email),iso(now)).first();
}
export async function emailReceiptStatuses(env,rows){
 if(!rows.length)return [];
 const queries=await Promise.all(rows.map(async r=>env.DB.prepare('SELECT event_type,occurred_at,bounce_type FROM email_delivery_events WHERE message_id=? AND recipient_key=? ORDER BY priority DESC,occurred_at DESC LIMIT 1').bind(messageKey(r.message_id)||'',await emailRecipientKey(r.destination))));
 const results=await env.DB.batch(queries);
 return rows.map(({destination,...row},i)=>({...row,provider_event:results[i].results[0]??null}));
}
export async function emailDeliveryHealth(env,now=Date.now()){
 const configured=!!env.EMAIL_EVENT_SUBSCRIPTION;
 const rows=await env.DB.batch([
  env.DB.prepare('SELECT COUNT(*) count,MAX(received_at) last_received FROM email_delivery_events WHERE received_at>=?').bind(iso(now-7*DAY)),
  env.DB.prepare("SELECT COUNT(*) count FROM email_delivery_events WHERE received_at>=? AND event_type IN ('bounced','failed','rejected','complained')").bind(iso(now-7*DAY)),
  env.DB.prepare('SELECT destination FROM operation_alert_settings WHERE enabled=1 LIMIT 5'),
 ]);
 let blocked=0;for(const row of rows[2].results)if(await alertEmailBlock(env,row.destination,now))blocked++;
 const queues={};
 if(configured)await Promise.all([['incoming',env.EMAIL_EVENT_QUEUE],['unprocessed',env.EMAIL_EVENT_DLQ]].map(async([name,binding])=>{
  let timer;
  try{
   const m=await Promise.race([binding.metrics(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Queue metrics unavailable')),5000);})]);
   const oldest=m.backlogCount===0?0:m.oldestMessageTimestamp;
   if(![m.backlogCount,m.backlogBytes,oldest].every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid queue metric');
   queues[name]={backlogCount:m.backlogCount,backlogBytes:m.backlogBytes,oldestMessageTimestamp:oldest,checked_at:iso(now)};
  }catch{queues[name]={unavailable:true};}finally{clearTimeout(timer);}
 }));
 return {configured,events_7d:rows[0].results[0].count,last_received:rows[0].results[0].last_received,failures_7d:rows[1].results[0].count,blocked_owners:blocked,queues};
}
export function emailDeliveryFindings(health,now=Date.now()){
 if(!health?.configured)return [];
 const issues=[],add=(id,severity,title,detail,next_action)=>issues.push({id,category:'delivery',severity,title,detail,next_action});
 const q=health.queues;
 if(q?.incoming?.unavailable||q?.unprocessed?.unavailable||q?.unprocessed?.backlogCount>0||(q?.incoming?.backlogCount>0&&(!q.incoming.oldestMessageTimestamp||q.incoming.oldestMessageTimestamp>now+300000||now-q.incoming.oldestMessageTimestamp>15*60000)))add('email-event-pipeline','high','Review email event processing','Email queue metrics are unavailable, delivery events are delayed, or unprocessed events need review.','Inspect the dedicated email event queue and dead letter queue. Preserve events and investigate before replaying; do not resend email as a pipeline test.');
 if(health.blocked_owners)add('owner-alert-delivery','high','Owner email alerts need attention',health.blocked_owners+' enabled owner destinations are held after a provider failure or complaint.','Check the recorded failure and the provider suppression list. Use the dashboard or another authorised channel; never clear a complaint or assume mailbox receipt from SMTP acceptance.');
 if(health.failures_7d)add('email-delivery-failures','normal','Review recent mail delivery failures',health.failures_7d+' failure or complaint events were received in the last seven days. Multiple events may concern one message.','Inspect provider records for the exact message. Do not expose account links, reset tokens or recipient data in public reports.');
 return issues;
}
export async function retainEmailEvents(env,now=Date.now()){
 await env.DB.batch([
  env.DB.prepare('DELETE FROM email_delivery_events WHERE received_at<?').bind(iso(now-90*DAY)),
  env.DB.prepare('DELETE FROM email_alert_blocks WHERE expires_at IS NOT NULL AND expires_at<=?').bind(iso(now)),
 ]);
}
