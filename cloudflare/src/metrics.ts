import { createCampaignContext } from '../shared/campaigns.js';

// SSR never captures a visitor's context. Browser state is document-local only.
const context = typeof window === 'undefined' ? null : createCampaignContext(window.location.search);
let lastPage = '';
export function campaignHeaders(): Record<string, string> {
  const id = context?.id();
  return id ? {'X-SI-Campaign': id} : {};
}
export function trackPage(page: string) {
  // React's repeated initial effect must not double-count a page open.
  if (page === lastPage) return;
  lastPage = page;
  if (page === '/admin' || page === '/reset-password') return;
  void fetch('/api/metrics', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({page, campaign: context?.id() || null}), keepalive: true,
  }).catch(() => {});
}
