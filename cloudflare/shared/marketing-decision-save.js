// Hold the serialized body unchanged while a decision's acknowledgement is unknown.
// This helper records an editorial decision or an observed delivery; it never publishes.
const decisions = new Set(['held', 'reviewed', 'published', 'failed', 'uncertain', 'cancelled']);
const deliveryDecisions = new Set(['published', 'failed', 'uncertain', 'cancelled']);

export function prepareDecisionSave(brief, destination, form, kind, now = Date.now(), key = crypto.randomUUID()) {
  if (!decisions.has(kind)) throw Error('Use an editorial decision or delivery observation, not a schedule or content revision.');
  if (typeof brief.id !== 'string' || !brief.id || !Number.isInteger(brief.revision) || brief.revision < 1 || !Array.isArray(brief.media)) throw Error('Refresh the exact brief before recording a decision.');
  if (typeof key !== 'string' || !key.trim() || key.length > 100 || !Number.isFinite(now)) throw Error('The decision request could not be prepared.');
  if (typeof form.note !== 'string' || form.note.trim().length < 20 || form.note.length > 1200) throw Error('Use 20–1,200 characters to describe the evidence and decision.');
  const allowed = kind === 'held' ? ['proposed', 'held', 'reviewed'] : kind === 'reviewed' ? ['proposed', 'held'] : ['scheduled', 'uncertain'];
  if (!allowed.includes(brief.state)) throw Error('This brief cannot receive that decision. Refresh its current record.');
  if (kind === 'reviewed') {
    if (!form.checked || (brief.media.length && !form.mediaChecked)) throw Error('Check the claims, sources, destination, duplication and any artwork first.');
    const expiry = Date.parse(brief.expires_at);
    if (!Number.isFinite(expiry) || expiry <= now) throw Error('The evidence expired. A fresh version and review are required.');
  }
  let receipt;
  if (deliveryDecisions.has(kind)) {
    if (typeof destination.account !== 'string' || !destination.account || typeof destination.provider !== 'string' || !destination.provider) throw Error('Refresh the exact destination before recording delivery.');
    if (typeof form.external !== 'string' || !/^[a-zA-Z0-9:_-]{1,200}$/.test(form.external.trim())) throw Error('Copy the existing provider reference, not a URL.');
    if (typeof form.postURL !== 'string') throw Error('Use the observed post address, or leave it blank when unavailable.');
    if (kind === 'published') {
      let url; try { url = new URL(form.postURL); } catch { throw Error('Enter the actual public post URL.'); }
      if (url.protocol !== 'https:' || url.username || url.password || url.port || url.href.length > 1000) throw Error('Enter the actual public HTTPS post URL.');
      if (brief.media.length && !form.mediaChecked) throw Error('Verify the exact caption, ordered images and accessibility text first.');
    }
    receipt = {account: destination.account, provider: destination.provider, external_id: form.external,
      observed_at: new Date(now).toISOString(), post_url: form.postURL, evidence: form.note,
      ...(form.mediaChecked ? {media_sha256: brief.media.map(item => item.sha256)} : {})};
  }
  return JSON.stringify({id: brief.id, revision: brief.revision, kind, note: form.note, request_key: key,
    ...(kind === 'reviewed' ? {checks: {claims: form.checked, sources: form.checked, destination: form.checked, duplication: form.checked, media: form.mediaChecked}} : {}),
    ...(receipt ? {receipt} : {})});
}

export class DecisionSaveError extends Error {
  constructor(message, uncertain) { super(message); this.name = 'DecisionSaveError'; this.uncertain = uncertain; }
}

export async function sendDecisionSave(serialized, fetcher = fetch) {
  let request;
  try {
    request = JSON.parse(serialized);
    if (typeof request?.id !== 'string' || !request.id || !decisions.has(request.kind)) throw Error();
  } catch { throw new DecisionSaveError('The retained decision request is invalid. No request was sent.', false); }
  let response, data;
  try {
    response = await fetcher('/api/admin/marketing/decide', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: serialized});
    data = await response.json();
  } catch {
    throw new DecisionSaveError('The save could not be confirmed. Keep this form open and retry only this same decision record. Do not send or schedule another post.', true);
  }
  if (!response.ok) {
    const rejected = [400, 401, 403, 404, 409, 410, 422, 429].includes(response.status) && typeof data?.error === 'string'
      && data.error !== 'The record could not be saved. Refresh before retrying.';
    throw new DecisionSaveError(rejected ? data.error : 'The server did not confirm the save. Keep the original decision and reconcile it before making another.', !rejected);
  }
  if (data?.id !== request.id || !(data.state === request.kind || data.replayed === true)) {
    throw new DecisionSaveError('The acknowledgement did not identify this decision. Inspect the ledger or retry this same record.', true);
  }
  return data;
}
