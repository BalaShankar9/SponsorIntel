// Public, finite campaign vocabulary. Never persist arbitrary URL values.
export const campaigns = Object.freeze([
  ['fb-welcome', 'facebook', 'social_launch', 'company_welcome', 'Facebook · Welcome'],
  ['li-welcome', 'linkedin', 'social_launch', 'company_welcome', 'LinkedIn · Welcome'],
  ['li-founder', 'linkedin', 'social_launch', 'founder_intro', 'LinkedIn · Founder introduction'],
  ['fb-evidence', 'facebook', 'launch_week', 'evidence_snapshot', 'Facebook · Evidence report'],
  ['li-evidence', 'linkedin', 'launch_week', 'evidence_snapshot', 'LinkedIn · Evidence report'],
  ['fb-adverts', 'facebook', 'launch_week', 'advert_wording', 'Facebook · Reading adverts'],
  ['fb-applications', 'facebook', 'launch_week', 'application_review', 'Facebook · Application review'],
].map(([id, source, campaign, content, label]) => Object.freeze({id, source, campaign, content, label, medium: 'organic_social'})));

export function campaignById(id) {
  return typeof id === 'string' ? campaigns.find(c => c.id === id) || null : null;
}

export function campaignFromSearch(search) {
  if (typeof search !== 'string' || search.length > 4096) return null;
  const params = new URLSearchParams(search);
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  if (keys.some(key => params.getAll(key).length !== 1)) return null;
  return campaigns.find(c => c.source === params.get('utm_source') &&
    c.medium === params.get('utm_medium') && c.campaign === params.get('utm_campaign') &&
    c.content === params.get('utm_content')) || null;
}

// Only a known campaign is forwarded, to selected first-party destination pages.
// Never add attribution to recovery links, external sites, API calls or owner pages.
export function campaignLink(href, origin, id) {
  const campaign = campaignById(id);
  if (!campaign || typeof href !== 'string' || href.startsWith('#')) return href;
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin || url.username || url.password ||
      !['/', '/jobs', '/signup', '/studio', '/guides', '/updates', '/about', '/insights', '/insights/uk-sponsorship-jobs-report'].includes(url.pathname) ||
      [...url.searchParams.keys()].some(key => key.startsWith('utm_'))) return href;
    for (const key of ['source', 'medium', 'campaign', 'content']) url.searchParams.set('utm_' + key, campaign[key]);
    return url.pathname + url.search + url.hash;
  } catch { return href; }
}

// One document's memory only: no storage, cookie, visitor ID or cross-tab state.
export function createCampaignContext(search, startedAt = Date.now()) {
  const campaign = campaignFromSearch(search);
  return { id(now = Date.now()) {
    return campaign && now >= startedAt && now - startedAt < 30 * 60 * 1000 ? campaign.id : null;
  }};
}
