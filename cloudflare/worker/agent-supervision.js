import {decideBrief} from './marketing.js';

const HOUR=3600000,iso=n=>new Date(n).toISOString();
const ENDED=new Set(['complete','errored','terminated']);
const KNOWN=new Set([...ENDED,'queued','running','paused','waiting','waitingForPause','unknown']);
const AREAS=[{kind:'research',table:'agent_investigations',binding:'RESEARCH_WORKFLOW'},
 {kind:'marketing',table:'marketing_agent_runs',binding:'MARKETING_WORKFLOW'},
 {kind:'applications',table:'application_eval_runs',binding:'APPLICATION_EVAL_WORKFLOW'}];
async function enabled(env,kind){
 const business=await env.DB.prepare('SELECT enabled FROM business_controls WHERE singleton=1').first();
 if(!business?.enabled)return false;
 if(kind==='applications')return !!(await env.DB.prepare('SELECT enabled FROM application_eval_controls WHERE singleton=1').first())?.enabled;
 return kind!=='marketing'||!!(await env.DB.prepare('SELECT enabled FROM marketing_agent_controls WHERE singleton=1').first())?.enabled;
}
async function platformStatus(binding,id){
 let timer;
 try{return await Promise.race([(async()=>{const instance=await binding.get(id);return (await instance.status()).status;})(),
  new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Status deadline exceeded')),10000);})]);}
 finally{clearTimeout(timer);}
}
const readReceipt=(env,businessId,name)=>env.DB.prepare('SELECT result FROM business_steps WHERE run_id=? AND name=?').bind(businessId,name).first();
async function record(env,businessId,name,result,now){
 await env.DB.prepare('INSERT INTO business_steps(run_id,name,result,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(businessId,name,JSON.stringify(result),iso(now)).run();
 return JSON.parse((await readReceipt(env,businessId,name)).result);
}

// No restart, termination, model call, quota reset, memory approval or publication.
// A stopped platform instance and an active application record are distinct facts.
async function reconcileEnded(env,businessId,area,run,status,now){
 const name='supervise:'+area.kind;
 if(!await enabled(env,area.kind))return {kind:area.kind,run_id:run.id,action:'paused',platform_status:status};
 const current=await env.DB.prepare(`SELECT * FROM ${area.table} WHERE id=?`).bind(run.id).first();
 if(!['queued','running'].includes(current?.state))return {kind:area.kind,run_id:run.id,action:'already_finished',platform_status:status};
 let draft='none';
 if(area.kind==='marketing'&&current.brief_id){
  const brief=await env.DB.prepare('SELECT b.revision,b.state,v.writer FROM marketing_briefs b JOIN marketing_versions v ON v.brief_id=b.id AND v.version=b.version WHERE b.id=?').bind(current.brief_id).first();
  const writer='marketing-writer:'+JSON.parse(current.models).writer.model;
  draft='owner_decision_preserved';
  if(brief?.state==='proposed'&&brief.writer===writer){
   try{await decideBrief(env,{id:current.brief_id,revision:brief.revision,kind:'held',note:'Cloudflare confirmed that this editorial workflow ended without a final application receipt. Evidence and call reservations are preserved; inspect before further use.',request_key:'supervision:'+run.id},'agent-supervisor',now);draft='held';}
   catch{
    const after=await env.DB.prepare('SELECT revision FROM marketing_briefs WHERE id=?').bind(current.brief_id).first();
    if(after?.revision===brief.revision)throw Error('Draft hold could not be recorded.');
   }
  }
 }
 const result={kind:area.kind,run_id:run.id,action:'reconciled',platform_status:status,draft,
  reason:'Confirmed stopped workflow; closed its unfinished application record. Existing evidence, call reservations and owner decisions are retained. No paid call was repeated.'};
 const gate=area.kind==='marketing'?" AND (SELECT enabled FROM marketing_agent_controls WHERE singleton=1)=1":area.kind==='applications'?" AND (SELECT enabled FROM application_eval_controls WHERE singleton=1)=1":'';
 const update=area.kind==='research'
  ?env.DB.prepare("UPDATE agent_investigations SET state='failed',finished_at=?,error=? WHERE id=? AND state IN ('queued','running') AND (SELECT enabled FROM business_controls WHERE singleton=1)=1").bind(iso(now),result.reason,run.id)
  :area.kind==='applications'?env.DB.prepare("UPDATE application_eval_runs SET state='failed',finished_at=?,error=? WHERE id=? AND state IN ('queued','running') AND (SELECT enabled FROM business_controls WHERE singleton=1)=1"+gate).bind(iso(now),result.reason,run.id)
  :env.DB.prepare("UPDATE marketing_agent_runs SET state='held',finished_at=?,result=? WHERE id=? AND state IN ('queued','running') AND (SELECT enabled FROM business_controls WHERE singleton=1)=1"+gate).bind(iso(now),JSON.stringify({reason:result.reason,recovery:result,publication:'none',brief_id:current.brief_id}),run.id);
 // Closing the application record and retaining its recovery receipt are atomic.
 await env.DB.batch([update,env.DB.prepare('INSERT INTO business_steps(run_id,name,result,created_at) SELECT ?,?,?,? WHERE changes()=1 ON CONFLICT DO NOTHING').bind(businessId,name,JSON.stringify(result),iso(now))]);
 const saved=await readReceipt(env,businessId,name);
 return saved?JSON.parse(saved.result):{kind:area.kind,run_id:run.id,action:'changed_during_check',platform_status:status};
}

export async function superviseAgents(env,businessId,now=Date.now()){
 const prior=await readReceipt(env,businessId,'agent-supervision');
 if(prior)return {...JSON.parse(prior.result),replayed:true};
 const checks=[];
 for(const area of AREAS){
  const name='supervise:'+area.kind,done=await readReceipt(env,businessId,name);
  if(done){checks.push(JSON.parse(done.result));continue;}
  let result={kind:area.kind,action:'idle'};
  if(!await enabled(env,area.kind))result.action='paused';
  else{
   const run=await env.DB.prepare(`SELECT id,created_at FROM ${area.table} WHERE state IN ('queued','running') ORDER BY created_at LIMIT 1`).first();
   if(run){
    result.run_id=run.id;
    const age=now-Date.parse(run.created_at);
    if(!Number.isFinite(age)||age<0)result={...result,action:'uncertain',reason:'Invalid run timestamp; inspect the record before recovery.'};
    else if(age<=HOUR)result.action='within_window';
    else{
     try{
      const status=await platformStatus(env[area.binding],run.id);
      if(!KNOWN.has(status)||status==='unknown')throw Error('Unknown status');
      if(ENDED.has(status))result=await reconcileEnded(env,businessId,area,run,status,now);
      else result={...result,action:'still_active',platform_status:status,reason:'The platform has not confirmed a terminal outcome. The existing run is retained; inspect before recovery.'};
     }catch{result={...result,action:'uncertain',reason:'The platform status or recovery result could not be confirmed. Existing work is retained; no replacement or paid retry was started.'};}
    }
   }
  }
  // Do not discard a committed recovery receipt if its acknowledgement was lost.
  const committed=await readReceipt(env,businessId,name);
  checks.push(committed?JSON.parse(committed.result):await record(env,businessId,name,result,now));
 }
 return record(env,businessId,'agent-supervision',{checked_at:iso(now),checks,
  reconciled:checks.filter(x=>x.action==='reconciled').length,
  needs_attention:checks.filter(x=>['uncertain','still_active','changed_during_check'].includes(x.action)).length,
  model_calls:0,external_posts:0},now);
}

export function supervisionFindings(supervision){
 if(!supervision)return [];
 return supervision.checks.filter(x=>['uncertain','still_active','changed_during_check'].includes(x.action)).map(x=>({
  id:'supervision:'+x.kind,category:'reliability',severity:'high',title:'Inspect the '+x.kind+' workflow',
  detail:x.reason||'The run changed while supervision was checking it.',
  next_action:'Inspect run '+x.run_id+' and its Cloudflare status. Retain evidence and consumed allowance. Do not restart an uncertain model call or start an overlapping run.'}));
}
