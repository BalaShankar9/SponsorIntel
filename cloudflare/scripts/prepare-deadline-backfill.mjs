import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { universityClosingDate } from '../worker/job-deadlines.js';
import { UNIVERSITY_FEEDS } from '../worker/job-sources.js';
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";

// Derive deadlines only from already stored, reviewed university adverts.
// Compare the exact input text before updating, so concurrent source refreshes
// win. This never refreshes observation dates or mutates application workspaces.
export function deadlineBackfill(rows) {
  const statements = [], records = [];
  for (const row of rows) {
    if (row.provider !== 'university-rss' || !UNIVERSITY_FEEDS[row.board_id] || !/^[a-f0-9]{24}$/.test(row.id))
      throw Error('Unexpected backfill source');
    const deadline = universityClosingDate(row.description);
    statements.push(`UPDATE jobs SET application_deadline=${quote(deadline.application_deadline)},closes_at=${quote(deadline.closes_at)} WHERE id=${quote(row.id)} AND board_id=${quote(row.board_id)} AND provider='university-rss' AND description=${quote(row.description)} AND application_deadline IS NULL AND closes_at IS NULL;`);
    records.push({id:row.id,board_id:row.board_id,...deadline});
  }
  return { sql:statements.join('\n')+'\n', records };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input,output] = process.argv.slice(2);
  if (!input || !output) throw Error('Usage: node scripts/prepare-deadline-backfill.mjs public-job-export.json output.sql');
  const response = JSON.parse(readFileSync(input,'utf8'));
  const rows = response.flatMap(x=>x.results || []);
  if (!rows.length || rows.length>1000) throw Error('Unexpected backfill size');
  const plan = deadlineBackfill(rows);
  writeFileSync(output,plan.sql,{mode:0o600});
  writeFileSync(output+'.review.json',JSON.stringify(plan.records,null,2)+'\n');
  console.log(JSON.stringify({reviewed:plan.records.length,sources:[...new Set(plan.records.map(x=>x.board_id))],sql:output}));
}
