import {businessFindings as retainedBusinessFindings} from './business-operations.js';
import {registerFailureDetail} from './register-health.js';

// The research comparison pins business-operations.js, including its dispatcher.
// Extend operational health here without changing that reviewed research identity.
export function businessFindings(snapshot, now=Date.now()) {
  const findings=retainedBusinessFindings(snapshot,now);
  if(!snapshot.register?.refresh_error&&!snapshot.register?.refresh_failure)return findings;
  return [...findings.filter(x=>x.id!=='register-freshness'),{
    id:'register-freshness',category:'quality',severity:'high',title:'Restore sponsor register refresh',
    detail:registerFailureDetail(snapshot.register),
    next_action:'Inspect the original scheduled refresh, its failure stage and the saved snapshot. Preserve the source date and warning until a genuine successful check; do not force a retry or infer current licence coverage from advert wording.',
  }];
}

// Keep one atomic issue reconciliation, including the register failure, so an
// existing failure is never transiently resolved by the older timestamp rule.
export async function recordBusinessFindings(env,id,snapshot) {
  const findings=businessFindings(snapshot),now=new Date().toISOString();
  const ids=JSON.stringify(findings.map(x=>x.id));
  await env.DB.batch([
    ...findings.map(x=>env.DB.prepare(`INSERT INTO business_issues(id,category,severity,title,detail,next_action,state,first_seen,last_seen)
      VALUES(?,?,?,?,?,?,'open',?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category,severity=excluded.severity,
      title=excluded.title,detail=excluded.detail,next_action=excluded.next_action,state='open',last_seen=excluded.last_seen,resolved_at=NULL`)
      .bind(x.id,x.category,x.severity,x.title,x.detail,x.next_action,now,now)),
    env.DB.prepare("UPDATE business_issues SET state='resolved',resolved_at=? WHERE state='open' AND id NOT IN (SELECT value FROM json_each(?))").bind(now,ids),
  ]);
  return {findings:findings.length,high:findings.filter(x=>['critical','high'].includes(x.severity)).length};
}
