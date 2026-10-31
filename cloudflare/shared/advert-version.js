const fields = ['company', 'title', 'location', 'description', 'url', 'sponsorship', 'evidence'];
export function workingAdvert(application) {
  return Object.fromEntries(fields.map(key => [key, application?.[key] || (key === 'sponsorship' ? 'not_stated' : '')]));
}

// Refresh/observation times do not mean the employer changed the advert.
// Hash the complete source text, including content beyond the workspace limit.
export function sourceAdvert(job) {
  return {jobId: job.id, ...workingAdvert({...job, url: job.apply_url}),
    deadline: job.application_deadline || '', closesAt: job.closes_at || '',
    salary: job.salary_excerpt || '', employment: job.employment_type || '', workplace: job.workplace || ''};
}

export function validAdvert(advert) {
  return !!advert && /^[a-f0-9]{24}$/.test(advert.jobId || '') && /^[a-f0-9]{64}$/.test(advert.version || '') &&
    [...fields,'deadline','closesAt','salary','employment','workplace','checkedAt'].every(key => typeof advert[key] === 'string');
}

export function savedAdvertState(application, snapshot) {
  if (snapshot.state !== 'current') return snapshot.state;
  const advert = snapshot.advert;
  if (!validAdvert(advert) || advert.jobId !== application?.jobId) return 'unavailable';
  if (application.sourceVersion) return application.sourceVersion === advert.version ? 'current' : 'changed';
  // Legacy copies have no recorded version. Matching working text is usable;
  // differing text might be a personal edit, so do not call it an employer change.
  return JSON.stringify(workingAdvert(application)) === JSON.stringify(workingAdvert(advert)) ? 'current' : 'review_required';
}

export function acceptAdvertReview(data, expected, advert, keepText = false) {
  const current = data.applications.find(a => a.id === expected.id);
  if (!current || !validAdvert(advert) || current.jobId !== advert.jobId ||
      current.sourceVersion !== expected.sourceVersion ||
      JSON.stringify(workingAdvert(current)) !== JSON.stringify(workingAdvert(expected))) return {status: 'changed', data};
  if (!keepText && advert.description.length > 26000) return {status: 'too_long', data};
  const patch = {...workingAdvert(advert), description: keepText ? current.description : advert.description,
    sourceVersion: advert.version, checkedAt: advert.checkedAt, updatedAt: new Date().toISOString()};
  return {status: 'saved', data: {...data, applications: data.applications.map(a => a.id === current.id ? {...a, ...patch} : a)}};
}
