import {bodyJSON,limit,reply,sameOrigin} from './auth.js';
const iso=(n=Date.now())=>new Date(n).toISOString();
const states=['new','in_progress','resolved','closed'];
const queues=['engineering','evidence','product'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function supportSummaryStatement(DB,now=Date.now()) {
 return DB.prepare(`SELECT COUNT(*) total,
 COALESCE(SUM(support_state IN ('new','in_progress')),0) open,
 COALESCE(SUM(support_state='new'),0) new,
 COALESCE(SUM(support_state='in_progress'),0) in_progress,
 COALESCE(SUM(support_state='resolved'),0) resolved,
 COALESCE(SUM(support_state='closed'),0) closed,
 COALESCE(SUM(support_state IN ('new','in_progress') AND created_at<?),0) overdue,
 COALESCE(SUM(support_state IN ('new','in_progress') AND support_queue IN ('engineering','evidence') AND created_at<?),0) overdue_quality
 FROM feedback`).bind(iso(now-72*3600000),iso(now-72*3600000));
}
export async function supportSnapshot(env,params=new URLSearchParams(),now=Date.now()) {
 const state=params.get('state')||'open',queue=params.get('queue')||'all';
 if(!['all','open',...states].includes(state)||!['all',...queues].includes(queue))throw Error('Choose a supported queue and status.');
 const cursor=params.get('cursor');let after=null;
 if(cursor){
  try{after=JSON.parse(atob(cursor));}catch{throw Error('Invalid report cursor.');}
  if(!Array.isArray(after)||after.length!==2||typeof after[0]!=='string'||!Number.isFinite(Date.parse(after[0]))||typeof after[1]!=='string'||after[1].length>100)throw Error('Invalid report cursor.');
 }
 const clauses=[],values=[];
 if(state==='open')clauses.push("support_state IN ('new','in_progress')");
 else if(state!=='all'){clauses.push('support_state=?');values.push(state);}
 if(queue!=='all'){clauses.push('support_queue=?');values.push(queue);}
 if(after){clauses.push('(created_at>? OR (created_at=? AND id>?))');values.push(after[0],after[0],after[1]);}
 const rows=await env.DB.batch([
  supportSummaryStatement(env.DB,now),
  env.DB.prepare(`SELECT id,kind,message,context,app_version,created_at,support_queue,support_state,support_version,support_updated_at FROM feedback ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY created_at,id LIMIT 26`).bind(...values)
 ]);
 const items=rows[1].results.slice(0,25),last=items.at(-1);
 return {measured_at:iso(now),summary:rows[0].results[0],state,queue,items,
  next_cursor:rows[1].results.length>25?btoa(JSON.stringify([last.created_at,last.id])):null,
  policy:'Routes follow the report category. Unresolved reports remain open regardless of age; 72 hours is an internal review threshold, not a response promise. Messages and notes stay private and are not sent to AI.'};
}
export async function supportHistory(env,id) {
 const item=await env.DB.prepare('SELECT id,support_version FROM feedback WHERE id=?').bind(id).first();
 if(!item)return null;
 const events=(await env.DB.prepare('SELECT from_state,to_state,expected_version,note,created_at FROM support_events WHERE feedback_id=? ORDER BY expected_version DESC LIMIT 25').bind(id).all()).results;
 return {id,version:item.support_version,events,older_events:item.support_version>events.length};
}
function validUpdate(body) {
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','operation_id','version','state','note'].includes(k))||
  typeof body.id!=='string'||!uuid.test(body.id)||typeof body.operation_id!=='string'||!uuid.test(body.operation_id)||
  !Number.isSafeInteger(body.version)||body.version<0||!states.includes(body.state)||typeof body.note!=='string'||body.note.trim().length<10||body.note.length>1600)
  throw Error('Add a private review note of 10–1,600 characters and a valid report version.');
 if(['resolved','closed'].includes(body.state)&&body.note.trim().length<30)throw Error('Describe the verified fix, or why this report is closed without a fix, in at least 30 characters.');
 return {...body,note:body.note.trim()};
}
export async function updateSupport(env,input,actor,now=Date.now()) {
 const body=validUpdate(input);
 const replay=async()=>{
  const prior=await env.DB.prepare('SELECT feedback_id,actor,to_state,expected_version,note FROM support_events WHERE operation_id=?').bind(body.operation_id).first();
  if(!prior)return null;
  if(prior.feedback_id!==body.id||prior.actor!==actor||prior.to_state!==body.state||prior.expected_version!==body.version||prior.note!==body.note)
   return {error:'This action reference was already used for a different review.',status:409};
  return {ok:true,replayed:true,version:prior.expected_version+1};
 };
 const prior=await replay();if(prior)return prior;
 // The insert, state change and audit trigger are one transaction. The version
 // predicate prevents a stale browser or agent from overwriting another review.
 const saved=await env.DB.prepare(`INSERT INTO support_events(operation_id,feedback_id,actor,from_state,to_state,expected_version,note,created_at)
 SELECT ?,id,?,support_state,?,?,?,? FROM feedback WHERE id=? AND support_version=?
 ON CONFLICT DO NOTHING RETURNING operation_id`).bind(body.operation_id,actor,body.state,body.version,body.note,iso(now),body.id,body.version).first();
 if(saved)return {ok:true,version:body.version+1};
 return await replay()||{error:'The report changed or is no longer available. Refresh before reviewing it.',status:409};
}
// adminAPI authenticates the existing owner membership before dispatch.
export async function supportAPI(request,env,owner) {
 const url=new URL(request.url);
 if(request.method==='GET'&&url.pathname==='/api/admin/support'){
  try{return reply(await supportSnapshot(env,url.searchParams));}catch{return reply({error:'The support queue could not load. Check the filters and try again.'},400);}
 }
 if(request.method==='GET'&&url.pathname==='/api/admin/support/history'){
  const id=url.searchParams.get('id')||'';if(!uuid.test(id))return reply({error:'Invalid report reference.'},400);
  const result=await supportHistory(env,id);return result?reply(result):reply({error:'Report not found.'},404);
 }
 if(request.method!=='POST'||url.pathname!=='/api/admin/support/review')return reply({error:'Not found.'},404);
 if(!sameOrigin(request))return reply({error:'Use the owner dashboard.'},403);
 if(!await limit(env,'support-owner:'+owner.user.id,60))return reply({error:'Please try again later.'},429);
 let body;try{body=validUpdate(await bodyJSON(request,4000));}catch(e){return reply({error:e.message},400);}
 const result=await updateSupport(env,body,owner.user.id);return reply(result,result.status||200);
}
