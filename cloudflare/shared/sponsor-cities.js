export const CITY_DIRECTORY_PATH = '/sponsors-by-city';
const clean = value => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
export function readCityFilters(search = '') {
  const p = new URLSearchParams(search);
  const city = clean(p.get('city'));
  return { city, q: city ? '' : clean(p.get('q')), employer: city ? clean(p.get('name')) : '',
    route: clean(p.get('route')), sort: p.get('sort') === 'az' ? 'az' : 'count',
    page: Math.min(30000, Math.max(1, parseInt(p.get('page') || '1', 10) || 1)) };
}
export function cityDirectoryPath(filters, page = filters.page || 1) {
  const p = new URLSearchParams();
  for (const key of ['city', 'q', 'employer', 'route']) if (filters[key]) p.set(key === 'employer' ? 'name' : key, filters[key]);
  if (filters.sort === 'az' && !filters.city) p.set('sort', 'az');
  if (page > 1) p.set('page', String(page));
  return CITY_DIRECTORY_PATH + (p.size ? '?' + p : '');
}
export function readInitialCityDirectory(raw, search, now = Date.now()) {
  try {
    const data = JSON.parse(raw);
    if (data.path !== cityDirectoryPath(readCityFilters(search)) ||
      !Array.isArray(data.result?.items) || !Array.isArray(data.result?.routes) ||
      !Number.isFinite(Date.parse(data.result.generated_at)) ||
      now - Date.parse(data.result.generated_at) > 60000 || now < Date.parse(data.result.generated_at) - 5000) return null;
    return data.result;
  } catch { return null; }
}
