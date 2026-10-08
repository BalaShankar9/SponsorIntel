import { bodyJSON, limit, reply, sameOrigin } from './auth.js';
import { JOB_FRESHNESS_MS, JOB_ORIGIN } from '../shared/job-detail.js';
import { startInvestigation } from './agent-research.js';
import { publishInsight } from './insights.js';
import { supervisionFindings } from './agent-supervision.js';
import {searchSnapshot,searchFindings} from './search-console.js';

const iso = (time = Date.now()) => new Date(time).toISOString();
// Invalid dates produce NaN, which does not satisfy an overdue comparison.
// Allow only a small clock skew; future timestamps must not look healthy forever.
const currentTimestamp = (value, now, maxAge) => {
  const time = typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= now + 300000 && now - time <= maxAge;
};
export const businessRunId = (time) => 'business-' + Math.floor(time / 3600000);
export const controls = (env) => env.DB.prepare('SELECT * FROM business_controls WHERE singleton=1').first();
const terminal = new Set(['complete', 'completed', 'errored', 'terminated']);

export async function dispatchBusiness(env, time = Date.now(), trigger = 'owner') {
  if (!['owner','scheduled'].includes(trigger)) throw Error('Unknown business dispatcher.');
  if (!(await controls(env))?.enabled) return { state: 'paused' };
  const id = businessRunId(time);
  const prior = await env.DB.prepare('SELECT id,state FROM business_runs WHERE id=?').bind(id).first();
  if (prior) return prior;
  const active = await env.DB.prepare("SELECT id,created_at FROM business_runs WHERE state IN ('queued','running')").first();
  if (active) {
    // A timeout is not proof the old workflow stopped. Reconcile only a known
    // terminal instance, preserving uncertainty and avoiding overlapping work.
    if (Date.now() - Date.parse(active.created_at) > 3600000) {
      try {
        const instance = await env.BUSINESS_WORKFLOW.get(active.id);
        const status = await instance.status();
        if (terminal.has(status.status)) await env.DB.prepare("UPDATE business_runs SET state='failed',finished_at=?,result=? WHERE id=? AND state IN ('queued','running')")
          .bind(iso(), JSON.stringify({ error: 'Workflow ended without an application receipt.' }), active.id).run();
        else return { id: active.id, state: 'running' };
      } catch { return { id: active.id, state: 'uncertain' }; }
    } else return { id: active.id, state: 'running' };
  }
  try {
    await env.DB.prepare("INSERT INTO business_runs(id,state,created_at,trigger_kind) VALUES(?,'queued',?,?)").bind(id, iso(time),trigger).run();
  } catch {
    const winner = await env.DB.prepare("SELECT id,state FROM business_runs WHERE id=? OR state IN ('queued','running') LIMIT 1").bind(id).first();
    if (winner) return winner;
    throw Error('Business run could not be reserved.');
  }
  try {
    await env.BUSINESS_WORKFLOW.create({ id, params: { runId: id } });
  } catch {
    // Retry only the same workflow ID. A lost response must not duplicate a run.
    try { await env.BUSINESS_WORKFLOW.get(id).then(x => x.status()); }
    catch { return { id, state: 'uncertain' }; }
  }
  return { id, state: 'queued' };
}

export async function collectBusinessSnapshot(env, fetcher = fetch, now = Date.now()) {
  const rows = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) total,COUNT(DISTINCT board_id) employers,
      COALESCE(SUM(sponsorship='offered'),0) offered,COALESCE(SUM(sponsorship='conditional'),0) conditional,
      COALESCE(SUM(sponsorship='unavailable'),0) unavailable,COALESCE(SUM(sponsorship='not_stated'),0) not_stated,
      COALESCE(SUM(level='early_career'),0) early_career,COALESCE(SUM(salary_excerpt<>''),0) salary
      FROM jobs WHERE active=1 AND last_seen>? AND last_seen<=?`).bind(iso(now-JOB_FRESHNESS_MS), iso(now+300000)),
    env.DB.prepare(`SELECT s.id,s.company,s.careers_url,s.last_success,s.error,
      COALESCE(c.paused,0) paused,(SELECT COUNT(*) FROM jobs j WHERE j.board_id=s.id AND j.active=1 AND j.last_seen>? AND j.last_seen<=?) roles
      FROM job_sources s LEFT JOIN agent_source_controls c ON c.source_id=s.id ORDER BY s.company LIMIT 60`).bind(iso(now-JOB_FRESHNESS_MS),iso(now+300000)),
    env.DB.prepare('SELECT id,title,checked_at,last_success,error,withdrawn FROM immigration_sources ORDER BY id LIMIT 100'),
    env.DB.prepare("SELECT value FROM metadata WHERE key='register'"),
    env.DB.prepare('SELECT day,event,SUM(count) count FROM analytics_daily WHERE day>=? AND day<? GROUP BY day,event ORDER BY day,event').bind(iso(now-14*86400000).slice(0,10),iso(now).slice(0,10)),
    env.DB.prepare("SELECT COUNT(*) total FROM agent_reviews WHERE state='open'"),
    env.DB.prepare('SELECT COUNT(*) total FROM feedback WHERE created_at>=?').bind(iso(now-7*86400000)),
    env.DB.prepare('SELECT MIN(day) started FROM analytics_daily'),
  ]);
  const checks = [];
  // Fixed first-party targets only: no URLs from models, adverts or feedback.
  for (const [path, expected] of [['/api/health',200],['/jobs',200],['/insights',200],['/sitemap.xml',200],['/api/admin/session',403]]) {
    try {
      const r = await fetcher(JOB_ORIGIN+path, { method:'HEAD', redirect:'manual', signal:AbortSignal.timeout(12000), headers:{'User-Agent':'SponsorIntel-Operations/1.0'} });
      checks.push({ path, status:r.status, ok:r.status===expected,
        security:r.headers.get('x-content-type-options')==='nosniff' && /frame-ancestors 'none'/.test(r.headers.get('content-security-policy')||'') });
      if (r.body) await r.body.cancel();
    } catch { checks.push({ path, status:null, ok:false, security:false }); }
  }
  const register = rows[3].results[0];
  return { measured_at:iso(now), jobs:rows[0].results[0], sources:rows[1].results,
    immigration:rows[2].results, register:register ? JSON.parse(register.value) : null,
    metrics:rows[4].results, held_batches:rows[5].results[0].total,
    feedback_count:rows[6].results[0].total, tracking_started:rows[7].results[0].started, checks, search:await searchSnapshot(env,now,{compact:true}) };
}

export function businessFindings(snapshot, now = Date.now()) {
  const issues = [];
  const add = (id,category,severity,title,detail,next_action) => issues.push({id,category,severity,title,detail,next_action});
  for (const c of snapshot.checks) {
    if (!c.ok) add('http:'+c.path,'health','critical','Investigate a failing site check',c.path+' returned '+(c.status ?? 'no response')+'.','Check the live route, recent release and error logs; verify a repair before closing.');
    if (!c.security) add('headers:'+c.path,'security','high','Restore expected browser protections',c.path+' did not return both checked protection headers.','Check deployment responses and restore the content policy and content-type protection. This is not a full security audit.');
  }
  if (!currentTimestamp(snapshot.register?.checked_at, now, 36*3600000))
    add('register-freshness','quality','high','Restore sponsor register refresh','The register timestamp is missing, invalid, in the future or older than 36 hours.','Inspect the official register refresh. Keep licence evidence separate from advert wording.');
  for (const source of snapshot.sources.filter(x=>!x.paused)) if (source.error || !currentTimestamp(source.last_success, now, 24*3600000))
    add('source:'+source.id,'quality','high','Check '+source.company+' feed','The source has an error, an invalid or future timestamp, or has not succeeded in 24 hours.','Inspect its original feed and the source operations queue. Do not refresh timestamps without fetching evidence.');
  const delayed = snapshot.immigration.filter(x=>x.error || !currentTimestamp(x.last_success, now, 3600000));
  if (delayed.length || !snapshot.immigration.length) add('immigration-freshness','quality','high','Check immigration source monitoring',snapshot.immigration.length ? delayed.length+' selected sources have failed, are overdue, or have missing, invalid or future check timestamps.' : 'No immigration source checks are available.','Inspect official-source refresh errors; do not publish new legal interpretations while source checks are missing.');
  if (snapshot.held_batches) add('held-batches','quality','high','Review held source batches',snapshot.held_batches+' source review records remain open.','Inspect the existing evidence queue before releasing held data.');
  if (snapshot.feedback_count) add('feedback','product','normal','Review recent user feedback',snapshot.feedback_count+' feedback submissions were received in the last seven days.','Read the owner feedback queue, reproduce bugs and fix the highest impact issue. Do not expose messages in public reports.');
  issues.push(...searchFindings(snapshot.search));
  add('social-connection','distribution','normal','Connect company and personal social destinations','Social posts are prepared; no publishing account is connected to this workflow.','Connect Metricool or an approved publishing API and verify the exact company and personal accounts before scheduling posts.');
  add('premium-validation','business','normal','Validate a premium offer with users','Payments, paid subscriptions and revenue measurement are not implemented.','Prioritise trustworthy job alerts, saved research and stronger application review. Validate willingness to pay before setting a price or opening checkout.');
  const totals = snapshot.metrics.reduce((a,x)=>(a[x.event]=(a[x.event]||0)+x.count,a),{});
  if (!(totals.application_generated>0)) add('activation','growth','normal','Improve the first useful application journey','No successful application generation was recorded in the available completed days of this 14-day window.','Verify the job-to-studio-to-export journey; improve the step where users get stuck. Event counts are not unique people.');
  return [...issues,...supervisionFindings(snapshot.supervision)];
}

export async function captureBusiness(env, id, supervision=null) {
  const run = await env.DB.prepare('SELECT snapshot FROM business_runs WHERE id=?').bind(id).first();
  if (!run) throw Error('Missing business run.');
  if (run.snapshot) return JSON.parse(run.snapshot);
  const snapshot = {...await collectBusinessSnapshot(env),supervision};
  await env.DB.prepare("UPDATE business_runs SET state='running',snapshot=? WHERE id=? AND state IN ('queued','running')").bind(JSON.stringify(snapshot),id).run();
  return snapshot;
}

export async function recordBusinessFindings(env, id, snapshot) {
  const findings = businessFindings(snapshot);
  const now=iso(), ids=JSON.stringify(findings.map(x=>x.id));
  await env.DB.batch([
    ...findings.map(x=>env.DB.prepare(`INSERT INTO business_issues(id,category,severity,title,detail,next_action,state,first_seen,last_seen)
      VALUES(?,?,?,?,?,?,'open',?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,severity=excluded.severity,
      title=excluded.title,detail=excluded.detail,next_action=excluded.next_action,state='open',last_seen=excluded.last_seen,resolved_at=NULL`)
      .bind(x.id,x.category,x.severity,x.title,x.detail,x.next_action,now,now)),
    env.DB.prepare("UPDATE business_issues SET state='resolved',resolved_at=? WHERE state='open' AND id NOT IN (SELECT value FROM json_each(?))").bind(now,ids),
  ]);
  return { findings:findings.length, high:findings.filter(x=>['critical','high'].includes(x.severity)).length };
}

export async function housekeeping(env, id, now=Date.now()) {
  const prior=await env.DB.prepare("SELECT result FROM business_steps WHERE run_id=? AND name='housekeeping'").bind(id).first();
  if (prior) return JSON.parse(prior.result);
  if (!(await controls(env))?.enabled) return {state:'paused'};
  const stale=await env.DB.prepare('SELECT COUNT(*) total FROM jobs WHERE active=1 AND last_seen<=?').bind(iso(now-JOB_FRESHNESS_MS)).first();
  const result={state:'completed',stale_roles:stale.total,policy:'Hide records last observed over 72 hours ago; retain the records, feedback and customer workspaces.'};
  await env.DB.batch([
    env.DB.prepare('UPDATE jobs SET active=0 WHERE active=1 AND last_seen<=? AND (SELECT enabled FROM business_controls WHERE singleton=1)=1').bind(iso(now-JOB_FRESHNESS_MS)),
    env.DB.prepare("INSERT INTO business_steps(run_id,name,result,created_at) VALUES(?,'housekeeping',json_set(?,'$.stale_roles',changes()),?)").bind(id,JSON.stringify(result),iso(now)),
    env.DB.prepare("UPDATE social_outbox SET state='superseded' WHERE state='needs_connection' AND expires_at<=?").bind(iso(now)),
    env.DB.prepare("DELETE FROM business_runs WHERE state NOT IN ('queued','running') AND created_at<?").bind(iso(now-90*86400000)),
    env.DB.prepare('DELETE FROM business_daily WHERE day<?').bind(iso(now-90*86400000).slice(0,10)),
  ]);
  return JSON.parse((await env.DB.prepare("SELECT result FROM business_steps WHERE run_id=? AND name='housekeeping'").bind(id).first()).result);
}

export async function scheduleBusinessResearch(env, now=Date.now()) {
  const settings=await controls(env);
  if (!settings?.enabled || !settings.research) return {state:'paused'};
  // One reserved dispatch per UTC day, independent of hourly retries. This
  // remains within the existing research budget; never reset a consumed cap.
  const day=iso(now).slice(0,10);
  const reserved=await env.DB.prepare("INSERT INTO business_daily(day,research_state) VALUES(?,'reserved') ON CONFLICT DO NOTHING RETURNING day").bind(day).first();
  if (!reserved) return await env.DB.prepare('SELECT research_state state,research_id,detail FROM business_daily WHERE day=?').bind(day).first();
  try {
    // Monday's run measures the fixed benchmark; other days inspect live data.
    const result=await startInvestigation(env,'scheduled-business',new Date(now).getUTCDay()===1?'evaluation':'research');
    await env.DB.prepare("UPDATE business_daily SET research_state='started',research_id=?,detail=? WHERE day=?").bind(result.id, 'Private research only; no automatic legal or advert-label changes.',day).run();
    return {state:'started',id:result.id};
  } catch {
    await env.DB.prepare("UPDATE business_daily SET research_state='held',detail=? WHERE day=?").bind('Research was held by its availability or budget controls. No automatic retry today.',day).run();
    return {state:'held'};
  }
}

export async function finishBusiness(env,id,result) {
  const state=result.error?'failed':result.health?.high?'attention':'completed';
  await env.DB.prepare('UPDATE business_runs SET state=?,finished_at=?,result=? WHERE id=?').bind(state,iso(),JSON.stringify(result),id).run();
  return {id,state,...result};
}

export async function businessSnapshot(env) {
  const results=await env.DB.batch([
    env.DB.prepare('SELECT * FROM business_runs ORDER BY created_at DESC LIMIT 12'),
    env.DB.prepare("SELECT * FROM business_issues WHERE state='open' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,first_seen LIMIT 80"),
    env.DB.prepare("SELECT id,audience,text,state,created_at,expires_at,destination,receipt FROM social_outbox o WHERE state<>'superseded' AND NOT EXISTS(SELECT 1 FROM marketing_briefs m WHERE m.topic_key='report:'||o.publication_id AND m.destination='linkedin-'||CASE o.audience WHEN 'personal' THEN 'personal' ELSE 'company' END) ORDER BY created_at DESC LIMIT 10"),
    env.DB.prepare('SELECT slug,title,published_at,updated_at,state FROM insight_publications'),
    env.DB.prepare('SELECT * FROM business_daily ORDER BY day DESC LIMIT 7'),
  ]);
  const latest=results[0].results[0];
  return {settings:await controls(env),measured_at:iso(),schedule:'Every hour at minute 45 UTC; research once per UTC day; evidence report at most once every 7 days.',
    heartbeat:!latest?'not_started':Date.now()-Date.parse(latest.created_at)>2*3600000?'overdue':latest.state,
    runs:results[0].results.map(x=>({...x,snapshot:x.snapshot?JSON.parse(x.snapshot):null,result:x.result?JSON.parse(x.result):null})),
    issues:results[1].results,outbox:results[2].results,publications:results[3].results,research:results[4].results,
    connections:{social:false,search_console:(await searchSnapshot(env,Date.now(),{compact:true})).connected,payments:false},
    limits:{hourly_runs:1,external_health_requests:5,research_runs_daily:1,publication_interval_days:7,customer_data_access:false}};
}

// The caller MUST already be the authenticated owner (adminAPI).
export async function businessAPI(request,env,owner) {
  const path=new URL(request.url).pathname;
  if (request.method==='GET' && path==='/api/admin/business') return reply(await businessSnapshot(env));
  if (request.method!=='POST') return reply({error:'Not found'},404);
  if (!sameOrigin(request)) return reply({error:'Use the owner dashboard.'},403);
  if (!(await limit(env,'business-owner:'+owner.user.id,12))) return reply({error:'Try again later.'},429);
  let body; try {body=await bodyJSON(request,1024);} catch {return reply({error:'Invalid request.'},400);}
  if (path==='/api/admin/business/run') return reply(await dispatchBusiness(env));
  if (path==='/api/admin/business/settings') {
    if (!['enabled','publishing','research'].includes(body?.setting) || typeof body.value!=='boolean') return reply({error:'Invalid setting.'},400);
    await env.DB.batch([
      env.DB.prepare(`UPDATE business_controls SET ${body.setting}=?,updated_at=?,actor=? WHERE singleton=1`).bind(body.value?1:0,iso(),owner.user.id),
      env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(owner.user.id,'business-setting',body.setting+':'+body.value,iso()),
    ]);
    return reply({ok:true});
  }
  if (path==='/api/admin/business/withdraw') {
    if (body.slug!=='uk-sponsorship-jobs-report') return reply({error:'Unknown publication.'},400);
    await env.DB.batch([
      env.DB.prepare("UPDATE insight_publications SET state='withdrawn' WHERE slug=?").bind(body.slug),
      env.DB.prepare('UPDATE business_controls SET publishing=0,updated_at=?,actor=? WHERE singleton=1').bind(iso(),owner.user.id),
      env.DB.prepare("UPDATE social_outbox SET state='superseded' WHERE state='needs_connection'"),
      env.DB.prepare('INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)').bind(owner.user.id,'withdraw-insight',body.slug,iso()),
    ]);
    return reply({ok:true});
  }
  return reply({error:'Not found'},404);
}

export { publishInsight };
