import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { REFERENCE_SET } from '../worker/reference-manifest.js';

// This offline preparation command emits only a verified, idempotent import file.
// It never connects to D1, dispatches a workflow or sends an advert to a model.
const [input, annotations, output] = process.argv.slice(2);
if (!input || !annotations || !output) throw Error('Provide candidates.json, frozen annotations.json and the output SQL path.');
const source = JSON.parse(readFileSync(input, 'utf8'));
const hash = (s) => createHash('sha256').update(s).digest('hex');
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const frozenBytes=readFileSync(annotations);
if(hash(frozenBytes)!==REFERENCE_SET.annotation_sha256)throw Error('The annotation freeze changed.');
const frozen=JSON.parse(frozenBytes);
if (source.adverts.length !== REFERENCE_SET.cases.length) throw Error('Wrong reference cohort.');
const statements = REFERENCE_SET.cases.map(expected => {
  const labels=frozen.cases.filter(c=>c.id===expected.id);
  if(labels.length!==1 || JSON.stringify(labels[0].accepted_labels)!==JSON.stringify(expected.accepted_labels) || labels[0].content_hash!==expected.content_hash)throw Error('Expected interpretation differs from the frozen annotation.');
  const matches = source.adverts.filter(r => r.id === expected.id);
  if (matches.length !== 1) throw Error('Missing or duplicate reference advert.');
  const record = Object.fromEntries(['id','board_id','company','title','description','apply_url','last_seen','content_hash'].map(k => [k, matches[0][k]]));
  const encoded = JSON.stringify(record);
  if (hash(record.description) !== expected.content_hash || hash(encoded) !== expected.record_hash) throw Error('Frozen reference evidence changed.');
  return `INSERT INTO agent_reference_cases(dataset,job_id,record) VALUES(${quote(REFERENCE_SET.id)},${quote(expected.id)},${quote(encoded)}) ON CONFLICT(dataset,job_id) DO NOTHING;`;
});
writeFileSync(output, statements.join('\n') + '\n');
console.log(JSON.stringify({dataset:REFERENCE_SET.id,records:statements.length,output,remote_executed:false}));
