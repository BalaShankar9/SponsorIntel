// Job identity is a guard, never evidence of sponsorship or employer identity.
export function jobIdentity(value, base) {
  let url; try { url = new URL(value, base); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    const id = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1] || url.searchParams.get('currentJobId');
    return /^\d+$/.test(id || '') ? {provider:'linkedin', id, key:`linkedin:${id}`, url:`https://www.linkedin.com/jobs/view/${id}/`} : null;
  }
  if (host === 'indeed.com' || host.endsWith('.indeed.com')) {
    const id = url.searchParams.get('jk') || url.searchParams.get('vjk');
    return /^[a-zA-Z0-9_-]{4,80}$/.test(id || '') ? {provider:'indeed', id, key:`indeed:${id}`, url:`${url.origin}/viewjob?jk=${encodeURIComponent(id)}`} : null;
  }
  if (!/\/(jobs?|careers?|positions?|opportunities)\/.+\w/i.test(url.pathname)) return null;
  url.hash='';
  // Do not collapse query-addressed jobs into one role or carry session links.
  for(const name of [...url.searchParams.keys()]) {
    if(/token|session|password|secret|signature|auth/i.test(name))return null;
    if(/^utm_|^(source|ref|referrer|trackingId|trk|lever-source|lever-origin)$/i.test(name))url.searchParams.delete(name);
  }
  url.searchParams.sort();
  const id=url.pathname.replace(/\/$/,'')+url.search;
  return {provider:'original', id, key:url.origin+id,url:url.href};
}

export function sameJob(a,b) { return !!a && !!b && a.key === b.key; }

export function nextStep(status) {
  return ({offered:'Read the quoted conditions and confirm they apply to this vacancy before preparing an application.',conditional:'Check the conditions in the quote. An invitation to apply is not confirmation that you personally qualify.',unavailable:'This advert explicitly refuses sponsorship. Check the original if the wording may have changed.',unclear:'Look for the complete sponsorship section. Missing wording is not a refusal.'})[status];
}
