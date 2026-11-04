// Retain this serialized request unchanged until the ledger acknowledges it.
// This endpoint records evidence only; it never calls a publishing provider.
export function prepareScheduleSave(brief, destination, form, now = Date.now(), key = crypto.randomUUID()) {
  if (brief.state !== 'reviewed') throw Error('Only a reviewed version can receive a schedule record.');
  if (!form.checked || (brief.media.length && !form.mediaChecked)) throw Error('Check the exact account, version, queue and any artwork first.');
  const observed = Date.parse(form.observed), scheduled = Date.parse(form.scheduled), expiry = Date.parse(brief.expires_at);
  if (!Number.isFinite(observed) || observed > now) throw Error('Enter the actual observation time, which cannot be in the future.');
  if (!Number.isFinite(scheduled) || scheduled <= now || scheduled > now + 30 * 86400000 || scheduled > expiry) throw Error('The provider schedule must be in the future, within 30 days and before this evidence expires.');
  const reference = form.external.trim(), note = form.note.trim();
  if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(reference)) throw Error('Copy the provider schedule reference, not a URL.');
  if (note.length < 20 || note.length > 1000) throw Error('Use 20–1,000 characters to describe the provider evidence and limitations.');
  if (!['agent_assisted', 'owner'].includes(form.observer)) throw Error('Choose who inspected the provider.');
  const evidence = (form.observer === 'agent_assisted' ? 'Agent-assisted observation through owner account: ' : 'Owner observation: ') + note;
  return JSON.stringify({id: brief.id, revision: brief.revision, kind: 'scheduled', request_key: key, note: evidence,
    receipt: {account: destination.account, provider: destination.provider, external_id: reference,
      observed_at: new Date(observed).toISOString(), scheduled_at: new Date(scheduled).toISOString(), evidence,
      ...(brief.media.length ? {media_sha256: brief.media.map(m => m.sha256)} : {})}});
}

export class ScheduleSaveError extends Error {
  constructor(message, uncertain) { super(message); this.uncertain = uncertain; }
}

export async function sendScheduleSave(serialized, fetcher = fetch) {
  let response, data;
  try {
    response = await fetcher('/api/admin/marketing/decide', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: serialized});
    data = await response.json();
  } catch {
    throw new ScheduleSaveError('The save could not be confirmed. Keep this form open and inspect the existing provider job. Retry only this same ledger record; do not schedule another post.', true);
  }
  if (!response.ok) {
    // An unrecognised/gateway response is not proof that the write failed.
    const rejected = [400,401,403,404,409,410,422,429].includes(response.status) && typeof data?.error === 'string'
      && data.error !== 'The record could not be saved. Refresh before retrying.';
    throw new ScheduleSaveError(rejected ? data.error : 'The server did not confirm the save. Reconcile the existing job and retry this same ledger record.', !rejected);
  }
  const request = JSON.parse(serialized);
  if (data?.id !== request.id || !(data.state === 'scheduled' || data.replayed === true)) {
    throw new ScheduleSaveError('The acknowledgement did not identify this schedule record. Inspect the ledger before retrying this same record.', true);
  }
  return data;
}
