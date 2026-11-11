// Owner-only, read-only diagnostics. An application receipt is not provider status.
// Read unfinished runs independently of the recent-history window so a newer
// completion cannot hide an older reservation that still blocks dispatch.
export async function businessDispatchHealth(env, now = Date.now()) {
  const checked = new Date(now).toISOString();
  const rows = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) total FROM business_runs WHERE state IN ('queued','running')"),
    env.DB.prepare(`SELECT r.id,r.state,r.created_at,r.trigger_kind,
      (SELECT COUNT(*) FROM business_steps s WHERE s.run_id=r.id) recorded_steps
      FROM business_runs r WHERE r.state IN ('queued','running')
      ORDER BY CASE WHEN julianday(r.created_at) IS NULL OR julianday(r.created_at)>julianday(?)+5.0/1440 THEN 0 ELSE 1 END,
      r.created_at,r.id LIMIT 5`).bind(checked),
  ]);
  const unfinished = rows[1].results.map(row => {
    const started = Date.parse(row.created_at);
    const valid = Number.isFinite(started) && started <= now + 300000;
    return {...row, age_seconds:valid ? Math.max(0, Math.floor((now-started)/1000)) : null,
      timing:!valid ? 'invalid' : now-started>3600000 ? 'overdue' : 'within_window'};
  });
  return {checked_at:checked, basis:'application_receipts', provider_status_checked:false,
    unfinished_count:rows[0].results[0].total, unfinished,
    state:unfinished.some(x=>x.timing!=='within_window') ? 'needs_review' : unfinished.length ? 'pending' : 'clear',
    // Zero steps cannot establish that no external action happened before a save.
    execution_outcome:'not_determined'};
}
