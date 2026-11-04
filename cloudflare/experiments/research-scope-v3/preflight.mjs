import {readFile, writeFile, chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {REFERENCE_SET} from '../../worker/reference-manifest.js';
import {prepareCase, proposalRequests, analystSchema, resolveExtraction, PROPOSAL} from './contract.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');

export async function proposalPreflight(rows, manifest = REFERENCE_SET) {
  if (!Array.isArray(rows) || rows.length !== 50 || new Set(rows.map(r => r.job_id)).size !== 50 || manifest.cases.length !== 50)
    throw Error('Expected the complete frozen 50-record cohort.');
  const cases = [];
  for (const item of manifest.cases) {
    const row = rows.find(r => r.job_id === item.id);
    if (!row || row.dataset !== manifest.id || typeof row.record !== 'string' || sha(row.record) !== item.record_hash)
      throw Error('Reference record identity or hash changed.');
    const record = JSON.parse(row.record);
    if (record.id !== item.id || sha(record.description) !== item.content_hash) throw Error('Reference content changed.');
    const source = prepareCase(record, manifest.snapshot_at), request = proposalRequests(source);
    if (source.source_blocks.map(q => q.text).join('') !== record.description) throw Error('Original text lost.');
    analystSchema(source);
    // Worst-size valid shape only, not a judgment about these real adverts.
    const quotes = source.source_blocks.slice(0, 2).map(q => q.id);
    const shape = resolveExtraction({job_id: source.job_id, complete: false, facts:
      Array.from({length: 4}, (_, i) => ({id: `f${i + 1}`, subject: 'unspecified', stance: 'mentioned', scope: 'unspecified',
        quote_ids: quotes, reason: 'x'.repeat(240)}))}, source);
    const criticRequest = proposalRequests(source, shape);
    // Only aggregates/identifiers/hashes leave this private local read.
    cases.push({id: item.id, record_sha256: item.record_hash, description_sha256: item.content_hash,
      description_characters: record.description.length, blocks: source.source_blocks.length,
      request_characters: JSON.stringify(request.parameters).length,
      critic_max_shape_request_characters: JSON.stringify(criticRequest.parameters).length});
  }
  const batches = Array.from({length: 25}, (_, i) => ({id: `${PROPOSAL}-${String(i + 1).padStart(2, '0')}`,
    cases: cases.slice(i * 2, i * 2 + 2).map(c => c.id), planned_max_calls: 4}));
  return {observed_at: new Date().toISOString(), proposal: PROPOSAL, stage: 'offline_contract_preflight_only',
    contract_sha256: sha(await readFile(new URL('./contract.mjs', import.meta.url))),
    cohort: manifest.id, snapshot_at: manifest.snapshot_at, cases, batches,
    source_records_verified: 50, description_characters_preserved: true,
    maximum_request_characters: Math.max(...cases.map(c => c.request_characters)),
    maximum_critic_shape_request_characters: Math.max(...cases.map(c => c.critic_max_shape_request_characters)),
    existing_input_ceiling: 90000, existing_output_ceiling_per_call: 8192,
    proposal_calls_per_case: 2, proposal_max_calls_per_batch: 4, existing_max_calls_per_investigation: 8,
    proposed_batch_count: 25, existing_batch_count: manifest.batches.length,
    existing_starts_per_day: 4, existing_calls_per_day: 32,
    model_calls: 0, source_requests: 0, production_writes: 0, scheduled: false, quality_verified: false,
    limitations: ['No model has executed this proposal. A complete preflight is not semantic or provider validation.',
      'The previous token-limit failure can recur; full records remain untruncated and the output limit is unchanged.',
      'New 25 two-case batches differ from the old 16. Scores and receipts cannot be mixed or old failed attempts replaced.',
      'Subject assertions and quotations may still be wrong. Independent adjudication and a separately held-out evaluation remain required.',
      'Scheduling, immutable controls, budget admission, provider execution and owner UI integration are not implemented for this proposal.']};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw Error('Usage: preflight.mjs PRIVATE_REFERENCE_EXPORT.json AGGREGATE_RECEIPT.json');
  const input = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
  const receipt = await proposalPreflight(input[0]?.results || input);
  const output = resolve(process.argv[3]);
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600});
  await chmod(output, 0o600);
  console.log(JSON.stringify({source_records_verified: receipt.source_records_verified, batches: receipt.batches.length,
    maximum_request_characters: receipt.maximum_request_characters, model_calls: 0, production_writes: 0, scheduled: false}));
}
