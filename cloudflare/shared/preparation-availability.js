export const preparationMessages = {
  held: 'This advert is under review. New preparation is paused; your existing documents remain editable.',
  awaiting_refresh: 'This advert is waiting for a fresh employer check. New preparation is paused; your existing documents remain editable.',
  expired: 'The advertised deadline has passed. New preparation is paused; your existing documents remain editable.',
  removed: 'This role is outside our current collection. New preparation is paused; your existing documents remain editable.',
  stale: 'This advert needs a fresh source check. New preparation is paused; your existing documents remain editable.',
  missing: 'We could not find this linked role. New preparation is paused; your existing documents remain editable.',
  unavailable: 'We could not check this role right now. Try checking again before preparing a new draft. Your existing documents remain editable.',
};
export function preparationAllowed(state) { return state === 'current' || state === 'manual'; }
// Applications added through the manual form retain its UUID-prefixed identity.
// This distinguishes their declared, unverified source from a missing catalogue role.
export function manualApplicationId(jobId) {
  return !jobId || typeof jobId === 'string' && /^manual-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(jobId);
}
