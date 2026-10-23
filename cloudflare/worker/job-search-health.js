import { boundedText } from './data.js';
import { readInitialJobs } from '../shared/job-search.js';

// Inspect the same public response visitors receive. Retain only an aggregate
// receipt, never the HTML, search text or advert content in operations records.
export async function jobSearchPageHealth(response, now = Date.now()) {
  try {
    const html = await boundedText(response, 2_000_000);
    const raw = html.match(/<script type="application\/json" id="jobs-data">([^<]*)<\/script>/)?.[1];
    const data = raw && readInitialJobs(raw, '', now);
    if (!data) return { ok:false, reason:'missing_or_expired_snapshot' };
    const {items,total} = data.result;
    const ids = [...html.matchAll(/<a class="vacancy-title" href="\/jobs\/([a-f0-9]{24})"/g)].map(x=>x[1]);
    const expected = Math.min(total,12);
    if (items.length !== expected || ids.length !== expected || items.some((item,i)=>item.id!==ids[i]))
      return { ok:false, reason:'role_links_do_not_match_snapshot' };
    if (!html.includes('rel="canonical" href="https://sponsorintel.london/jobs"') || (total>12 && !html.includes('href="/jobs?page=2"')))
      return { ok:false, reason:'search_navigation_missing' };
    return { ok:true, visible_roles:ids.length, matching_roles:total, generated_at:data.result.generated_at };
  } catch { return { ok:false, reason:'unreadable_or_oversized_response' }; }
}
