// Review-only integration. No production route, schedule or publisher imports this.
// API reference: https://api.techmap.io/jobs-api (reviewed 2026-10-07).
import { boundedText, idFor } from '../../worker/data.js';
import { plainText, sponsorshipEvidence, salaryExcerpt, isTalentPool } from '../../worker/jobs.js';

const ENDPOINT = 'https://daily-international-job-postings.p.rapidapi.com/api/v2/jobs/search';
const DAY = 86400000;
const required = (v, max) => typeof v === 'string' && v.trim() && v.length <= max;
function dateOnly(value) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value || '')) throw Error('Use a valid date');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value)
    throw Error('Use a valid date');
  return time;
}
function sourceDate(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw Error('Invalid source date');
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) { dateOnly(value); return value; }
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw Error('Invalid source date');
  dateOnly(value.slice(0, 10));
  return value;
}

export function techmapQuery({ from, to, page = 1, company = '', title = '' }, now = Date.now()) {
  const start = dateOnly(from), end = dateOnly(to);
  if (start > end || end - start > 6 * DAY || end > now || now - start > 30 * DAY)
    throw Error('Pilot queries cover at most seven recent days');
  if (!Number.isInteger(page) || page < 1 || page > 10) throw Error('Pilot page limit exceeded');
  if (typeof company !== 'string' || company.length > 200 || typeof title !== 'string' || title.length > 200)
    throw Error('Invalid search filter');
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ countryCode: 'gb', portal: 'linkedin',
    dateCreatedMin: from, dateCreatedMax: to, isDuplicate: 'false',
    format: 'json', page: String(page) });
  if (company.trim()) url.searchParams.set('company', company.trim());
  if (title.trim()) url.searchParams.set('title', title.trim());
  // isActive/dateActive can mean a provider-inferred 30-day expiry, not a live check.
  return url;
}

export async function reserveTechmapRequest(DB, now = Date.now()) {
  // One atomic UPDATE across all callers; failed/ambiguous network calls stay charged.
  // Deliberately no CREATE/INSERT/reset here and no limit controlled by an LLM.
  const row = await DB.prepare(`UPDATE techmap_pilot_budget
    SET used_requests=used_requests+1 WHERE provider='techmap' AND enabled=1
    AND length(trim(approval_reference))>0 AND period_start<=? AND period_end>?
    AND max_requests BETWEEN 1 AND 80 AND used_requests<max_requests
    RETURNING used_requests,max_requests,period_end`).bind(now, now).first();
  if (!row) throw Error('Pilot is paused, unapproved, outside its billing period or out of requests');
  return row;
}

function linkedinURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port ||
        !/^(?:www\.|uk\.)?linkedin\.com$/.test(u.hostname)) return null;
    const match = u.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d{6,20})\/?$/);
    return match ? { id: match[1], url: `https://www.linkedin.com/jobs/view/${match[1]}/` } : null;
  } catch { return null; }
}

export async function parseTechmapPage(payload, now = Date.now()) {
  if (!payload || !Array.isArray(payload.result) || payload.result.length > 10 ||
      !Number.isSafeInteger(payload.totalCount) || payload.totalCount < payload.result.length)
    throw Error('Unexpected provider response');
  const candidates = [], rejected = [], seen = new Set();
  const todayUK = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  for (const [index, raw] of payload.result.entries()) {
    const reject = reason => rejected.push({ index, reason });
    if (!raw || typeof raw.countryCode !== 'string' || !/^(gb|uk)$/i.test(raw.countryCode) || raw.portal !== 'linkedin') {
      reject('Not a UK LinkedIn record'); continue;
    }
    if (raw.isDuplicate === true) { reject('Provider marked duplicate'); continue; }
    const link = linkedinURL(raw.jsonLD?.url);
    if (!link || !required(raw.title, 240) || !required(raw.company, 200) ||
        !required(raw.jsonLD?.description, 60000)) { reject('Missing or unsafe source fields'); continue; }
    if (seen.has(link.id)) { reject('Duplicate LinkedIn job ID'); continue; }
    const title = plainText(raw.title), company = plainText(raw.company), description = plainText(raw.jsonLD.description);
    if (!title || !company || description.length < 80 || isTalentPool(title)) {
      reject('Incomplete advert or speculative listing'); continue;
    }
    let published, closing, assumed;
    try {
      published = sourceDate(raw.dateCreated);
      closing = sourceDate(raw.dateExpired);
      assumed = sourceDate(raw.dateActive);
    } catch { reject('Invalid source dates'); continue; }
    if (!published || Date.parse(published) > now + 300000 || now - Date.parse(published) > 30 * DAY) {
      reject('Publication is missing, future-dated or too old'); continue;
    }
    if (closing && (closing.length === 10 ? closing < todayUK : Date.parse(closing) <= now)) {
      reject('Provider reports a past closing date'); continue;
    }
    seen.add(link.id);
    const evidence = sponsorshipEvidence(description);
    candidates.push({ id: await idFor('techmap-linkedin:' + link.id), provider: 'techmap',
      source_portal: 'linkedin', source_job_id: link.id, source_url: link.url,
      title, company, description, country: 'GB',
      location: typeof raw.city === 'string' && raw.city.trim() ? `${plainText(raw.city).slice(0, 200)}, United Kingdom` : 'United Kingdom — city not supplied',
      provider_received_at: new Date(now).toISOString(), source_published_at: published,
      provider_reported_closing_at: closing, provider_assumed_expiry_at: assumed,
      availability: 'unverified', state: 'needs_review', public_display: false,
      employer_licence: null, sponsorship: evidence.status, evidence: evidence.quote,
      salary_excerpt: salaryExcerpt(description),
    });
  }
  return { total_reported: payload.totalCount, candidates, rejected };
}

export async function readTechmapPilotPage({ enabled = false, apiKey, DB, query, now = Date.now(), fetcher = fetch }) {
  if (enabled !== true || !required(apiKey, 512)) throw Error('Pilot is disabled or has no credential');
  const url = techmapQuery(query, now);
  await reserveTechmapRequest(DB, now);
  let response;
  try {
    response = await fetcher(url.href, { method: 'GET', redirect: 'manual',
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': new URL(ENDPOINT).host, Accept: 'application/json' },
      signal: AbortSignal.timeout(25000) });
  } catch { throw Error('Provider connection failed; request allowance remains reserved'); }
  // Do not follow redirects with credentials, retry automatically, or log provider bodies.
  if (response.status !== 200) throw Error(`Provider HTTP ${response.status}; request allowance remains reserved`);
  let payload;
  const text = await boundedText(response, 2_000_000);
  try { payload = JSON.parse(text); } catch { throw Error('Invalid provider JSON; request allowance remains reserved'); }
  return parseTechmapPage(payload, now);
}
