import {publicJobURL} from './job-note.js';

// Only already-reviewed files reach this planner. Work from the provider's
// current snapshot, not the render that started reading the file.
export function planJobNoteImport(data, note, company, expectedScope, currentScope) {
  if (!expectedScope || expectedScope !== currentScope) return {status:'changed'};
  const employer = typeof company === 'string' ? company.trim() : '';
  if (!employer || employer.length > 200) throw Error('Confirm an employer name of at most 200 characters.');
  if (typeof note?.advert?.text !== 'string' || note.advert.text.length < 80 || note.advert.text.length > 26000)
    throw Error('Review the complete advert before importing it.');
  const url = publicJobURL(note.source.url);
  const matches = data.applications.filter(application => {
    try { return publicJobURL(application.url) === url; }
    catch { return false; } // An older malformed link cannot match a new import.
  });
  if (matches.length > 1) return {status:'ambiguous'};
  if (matches.length === 1) return {status:'existing', id:matches[0].id};
  if (data.applications.length >= 100) return {status:'full'};
  return {
    status:'ready',
    job:{id:'manual-'+crypto.randomUUID(), company:employer, title:note.source.title,
      location:note.source.location, description:note.advert.text, apply_url:url,
      provider:'manual', sponsorship:'not_stated', evidence:'', last_seen:'',
      first_seen:new Date().toISOString(), level:'not_stated'},
    notes:`Imported external advert, observed ${note.source.observedAt}. Source: ${url}\nText SHA-256: ${note.advert.sha256}\nLocal wording result: ${note.wording.status}; not independently verified. Complete wording is retained in the job description. Original employer application route, vacancy freshness and legal-employer/licence identity require review. Import is preparation, not application submission.`,
  };
}
