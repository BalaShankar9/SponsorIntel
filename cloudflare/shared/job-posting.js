// Deliberately narrow Google Jobs rollout. Other feeds' update/republication
// times and our observation times are not evidence of original publication.
export function originalJobPublication(job, now = Date.now()) {
  const value = job.source_first_published_at;
  if (job.provider !== 'greenhouse' || typeof value !== 'string') return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value && time <= now ? value : null;
}

const cities = 'London|Leeds|Wallingford|Cardiff|Manchester|Edinburgh|Glasgow|Birmingham|Bristol|Belfast|Nottingham|Sheffield|Oxford|Cambridge|Southampton|Liverpool|Leicester|Coventry|Swansea|Aberdeen|Dundee|Newcastle upon Tyne|Brighton|Reading|Derby|Warwick|Motherwell';
const physicalUK = new RegExp('^(' + cities + '), (?:UK|United Kingdom|GB)$', 'i');
const escapeHTML = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Called only for a current advert. Require an explicit country and one known
// city; ambiguous, multiple-location and remote roles need a separate reviewed
// mapping. Never infer remote applicant geography from a UK employer address.
export function qualifiedJobPosting(job, url, now = Date.now()) {
  const datePosted = originalJobPublication(job, now);
  const place = typeof job.location === 'string' && job.location.match(physicalUK);
  if (!datePosted || !place || !job.title?.trim() || job.title.length >= 240 || !job.company?.trim() ||
      typeof job.description !== 'string' || !job.description.trim() ||
      job.description.trim() === job.title.trim() || job.description.length > 80000 ||
      /\bremote\b|\bwork(?:ing)? from home\b|\bhome[- ]based\b|\btelecommut/i.test([job.workplace,job.description].join(' '))) return null;
  let application;
  try { application = new URL(job.apply_url); } catch { return null; }
  if (application.protocol !== 'https:' || application.username || application.password) return null;
  const posting = {
    '@type': 'JobPosting', '@id': url + '#vacancy', url,
    title: job.title, datePosted,
    // Exactly the visible employer text, escaped into paragraphs. No summaries,
    // inferred visa claims, guessed salaries or application eligibility added.
    description: job.description.split(/\n+/).map(line => '<p>' + escapeHTML(line) + '</p>').join(''),
    hiringOrganization: { '@type': 'Organization', name: job.company },
    jobLocation: { '@type': 'Place', address: {
      '@type': 'PostalAddress', addressLocality: place[1], addressCountry: 'GB',
    } },
  };
  if (job.closes_at) posting.validThrough = job.closes_at;
  return posting;
}
