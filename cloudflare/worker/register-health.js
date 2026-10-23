// Public/owner diagnostics use fixed vocabulary, never raw database/source errors.
const stages = Object.freeze({
  metadata:'reading the saved register', publication:'checking the official publication',
  download:'downloading the official register', validation:'validating the source rows',
  staging:'storing the candidate snapshot', verification:'verifying the stored row count',
  activation:'activating the complete snapshot', snapshot_cleanup:'cleaning up older snapshots',
  rate_limit_cleanup:'cleaning up expired request counters', unchanged_check:'recording the unchanged-source check',
});
export function registerFailureCode(error) {
  const message=error instanceof Error ? error.message : '';
  if(error?.name==='TimeoutError'||error?.name==='AbortError')return 'source_timeout';
  if(/^D1_|SQLITE_|database/i.test(message))return 'database_error';
  if(/^(Source unavailable|Register download failed)$/.test(message))return 'source_unavailable';
  if(/^(Official CSV not found|Unexpected source host|Source date not available)$/.test(message))return 'invalid_source';
  if(/^(Register schema changed|Unexpected register columns|Incomplete register row|Malformed CSV quotes)$/.test(message))return 'invalid_register';
  if(/^(Register size needs manual review|Unexpected register growth|Register exceeds permitted size|Oversized CSV row|Source exceeds permitted size)$/.test(message))return 'size_guard';
  if(message==='Incomplete imported register')return 'incomplete_snapshot';
  return 'unexpected_error';
}
export function registerFailureDetail(meta) {
  const failure=meta?.refresh_failure;
  const stage=stages[failure?.stage];
  if(!stage)return 'The latest sponsor-register refresh reports a failure, even though its last successful check may still be recent. The retained snapshot remains available.';
  const publication=failure.publication==='confirmed'
    ? 'The complete snapshot was activated before this later failure.'
    : failure.publication==='uncertain'
      ? 'Snapshot activation was attempted, but its acknowledgement is uncertain; reconcile the stored snapshot before any retry.'
      : 'This attempt did not reach snapshot activation.';
  return 'The latest sponsor-register attempt failed while '+stage+'. '+publication+' Inspect the original attempt; this diagnostic does not establish the underlying cause.';
}
