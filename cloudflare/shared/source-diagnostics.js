// Server-owned vocabulary. Never render a provider's exception or response body.
export const SOURCE_DIAGNOSTICS = Object.freeze({
  unreviewed_source: {title:'Source configuration needs review', action:'Check the fixed employer identity and approved source configuration.'},
  request_failed: {title:'Source request did not finish', action:'Check provider availability and the existing retry or cooldown receipt.'},
  request_timeout: {title:'Source request timed out', action:'Check whether the provider is slow. Preserve the previous publication and request limits.'},
  http_error: {title:'Source returned an unsuccessful response', action:'Check the recorded response status and the provider; do not bypass access restrictions.'},
  redirected: {title:'Source redirected unexpectedly', action:'Review the new destination before changing the approved source.'},
  invalid_payload: {title:'Source response could not be read', action:'Inspect the public response format privately; never copy a raw response into the dashboard.'},
  oversized_payload: {title:'Source response exceeded its size limit', action:'Review pagination and content size without silently truncating advert restrictions.'},
  incomplete_catalogue: {title:'Vacancy catalogue was incomplete', action:'Check page totals, page sizes and source changes; keep partial results private.'},
  duplicate_posting: {title:'Vacancy catalogue repeated a posting', action:'Review pagination and source changes before publishing another snapshot.'},
  posting_identity: {title:'Posting identity or public fields changed', action:'Compare the public catalogue and original advert for this reference.'},
  posting_changed: {title:'Advert consistency check did not pass', action:'Compare the current public catalogue and original advert. This error alone does not prove an edit or closure.'},
  invalid_destination: {title:'Advert destination needs review', action:'Verify the exact employer destination; do not follow an unreviewed link.'},
  invalid_sections: {title:'Advert sections are missing or unsupported', action:'Inspect every original advert section and preserve all restrictions before changing the parser.'},
  oversized_advert: {title:'Advert text exceeded its supported size', action:'Review the complete original; do not cut away eligibility restrictions to make it fit.'},
  collection_limit: {title:'Collection reached its work limit', action:'Inspect saved progress and continue through the scheduled bounded process.'},
  lease_ended: {title:'Collection no longer held its write lock', action:'Check the current operation and preserve its writes; never force an older result to publish.'},
  storage_failed: {title:'Collection progress could not be stored', action:'Inspect database availability and the current source operation.'},
  execution_failed: {title:'Source workflow did not finish', action:'Inspect the actual platform execution before recovery; completion or a timeout alone is not publication.'},
  unclassified: {title:'Source check failed without a classified cause', action:'Inspect the source privately. Older or unclassified failures do not establish a specific cause.'},
});
const phases=new Set(['configuration','catalogue','description','cache','execution']);
// Names only: provider values, advert text and arbitrary object paths must never
// enter the operational receipt. Order is fixed even for an untrusted saved row.
export const SOURCE_CHANGED_FIELDS=Object.freeze({
  posting_id:'Posting ID',posting_uuid:'Posting UUID',advert_id:'Advert ID',title:'Title',
  release_date:'Release date',city:'City',country:'Country',region:'Region',
  address:'Address',postal_code:'Postcode',remote:'Remote status',hybrid:'Hybrid status',
  employment_type:'Employment type',active_status:'Active status',
});
export function safeSourceDiagnostic(value){
  const code=typeof value?.code==='string'&&Object.hasOwn(SOURCE_DIAGNOSTICS,value.code)?value.code:'unclassified';
  const result={code};
  if(phases.has(value?.phase))result.phase=value.phase;
  if(typeof value?.posting_ref==='string'&&/^[0-9]{6,25}$/.test(value.posting_ref))result.posting_ref=value.posting_ref;
  if(Number.isInteger(value?.page_offset)&&value.page_offset>=0&&value.page_offset<=400&&value.page_offset%100===0)result.page_offset=value.page_offset;
  if(Number.isInteger(value?.requests)&&value.requests>=0&&value.requests<=50)result.requests=value.requests;
  if(Number.isInteger(value?.http_status)&&value.http_status>=300&&value.http_status<=599)result.http_status=value.http_status;
  if(code==='posting_changed'&&Array.isArray(value?.changed_fields)){
    const supplied=new Set(value.changed_fields.slice(0,32).filter(x=>typeof x==='string'));
    const fields=Object.keys(SOURCE_CHANGED_FIELDS).filter(x=>supplied.has(x));
    if(fields.length)result.changed_fields=fields;
  }
  return result;
}
export function sourceFailureHistory(raw){
  try {
    const data=typeof raw==='string'?JSON.parse(raw):raw;
    if(!Array.isArray(data?.attempt_failures))return [];
    const seen=new Set();
    return data.attempt_failures.slice(0,3).filter(x=>Number.isInteger(x?.attempt)&&x.attempt>=1&&x.attempt<=3&&
      typeof x.checked_at==='string'&&Number.isFinite(Date.parse(x.checked_at))&&!seen.has(x.attempt)&&seen.add(x.attempt))
      .map(x=>({attempt:x.attempt,checked_at:new Date(x.checked_at).toISOString(),...safeSourceDiagnostic(x)}));
  } catch {return [];}
}
