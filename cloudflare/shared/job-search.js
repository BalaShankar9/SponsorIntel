import { jobAvailability } from './job-detail.js';

// Only these public filters participate in links, metadata and bootstraps.
// Campaign parameters stay in the original browser URL until a search action.
export function readJobSearch(search) {
  const p = new URLSearchParams(search);
  const choice = (key, values) => values.includes(p.get(key)) ? p.get(key) : '';
  return {
    q: (p.get('q') || '').trim().slice(0, 150),
    location: (p.get('location') || '').trim().slice(0, 80),
    sponsorship: choice('sponsorship', ['offered', 'conditional', 'not_stated', 'unavailable', 'mentioned']),
    level: choice('level', ['early_career']), salary: choice('salary', ['listed']),
    sector: (p.get('sector') || '').trim().slice(0, 40), licence: choice('licence', ['matched']),
    page: Math.max(1, parseInt(p.get('page') || '1') || 1),
  };
}

export function jobSearchPath(filters, page = 1) {
  const p = new URLSearchParams();
  for (const key of ['q','location','sponsorship','level','salary','sector','licence']) {
    if (filters[key]) p.set(key, filters[key]);
  }
  if (page > 1) p.set('page', String(page));
  return '/jobs' + (p.size ? '?' + p : '');
}

export function readInitialJobs(raw, search, now = Date.now()) {
  try {
    const data = JSON.parse(raw), result = data.result;
    const age = now - Date.parse(result?.generated_at);
    if (!(age >= -5000 && age < 60000) || !(Date.parse(result?.valid_until) > now)) return null;
    const filters = readJobSearch(search);
    if (data.path !== jobSearchPath(filters, filters.page)) return null;
    if (!Array.isArray(result.items) || result.items.length > 12 || !Array.isArray(result.sources) || !result.collections || !result.sectors) return null;
    if (!Number.isInteger(result.page) || result.page !== filters.page || !Number.isInteger(result.total) || result.total < 0) return null;
    if (result.items.some(job => !/^[a-f0-9]{24}$/.test(job.id) || jobAvailability({...job, active:1},now) !== 'current')) return null;
    return data;
  } catch { return null; }
}
