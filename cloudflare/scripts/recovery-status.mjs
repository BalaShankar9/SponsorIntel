// Read-only production recovery inspection. This module has no restore/export/delete command.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const target = Object.freeze({ name: 'sponsorintel-db', id: 'f51fb6a9-1278-4643-a49f-30c2e52c6313' });
export const schemaQuery = "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name NOT GLOB 'd1_*' ORDER BY type,name";
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = rows => rows.map(({type,name,tbl_name,sql})=>({type,name,tbl_name,sql})).sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));

export function migrationSchema(directory = resolve(root, 'migrations')) {
  const db = new DatabaseSync(':memory:');
  try {
    const files = readdirSync(directory).filter(n=>n.endsWith('.sql')).sort();
    for (const name of files) db.exec(readFileSync(resolve(directory,name),'utf8'));
    return { files, objects: canonical(db.prepare(schemaQuery).all()) };
  } finally { db.close(); }
}

export function assessRecovery(info, point, response, expected, now = new Date().toISOString()) {
  if (info?.uuid !== target.id || info?.name !== target.name) throw Error('Recovery inspection returned the wrong database. Stop before taking any action.');
  if (!/^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{32}$/.test(point?.bookmark || '')) throw Error('No valid current Time Travel bookmark was returned.');
  if (!Array.isArray(response) || response.length!==1 || response[0]?.success!==true || !Array.isArray(response[0]?.results)) throw Error('The production schema could not be read.');
  const objects = response[0].results;
  if (!objects.length || objects.some(x=>!['table','index','trigger','view'].includes(x.type)||typeof x.name!=='string'||typeof x.tbl_name!=='string'||typeof x.sql!=='string')) throw Error('The schema response is incomplete or invalid.');
  const actual = canonical(objects), anticipated = canonical(expected.objects);
  const byKey = rows=>new Map(rows.map(x=>[x.type+':'+x.name,x]));
  const a=byKey(actual), e=byKey(anticipated);
  if (a.size!==actual.length || e.size!==anticipated.length) throw Error('Duplicate schema objects make this inspection ambiguous.');
  const missing=[...e.keys()].filter(k=>!a.has(k)), extra=[...a.keys()].filter(k=>!e.has(k));
  const changed=[...e.keys()].filter(k=>a.has(k)&&JSON.stringify(a.get(k))!==JSON.stringify(e.get(k)));
  return {
    observed_at:now, database:target.name, database_id:target.id,
    status:missing.length||extra.length||changed.length?'schema_drift':'available',
    current_recovery_point_available:true, bookmark_sha256:hash(point.bookmark),
    database_size_bytes:info.database_size, region:info.running_in_region,
    schema:{expected_objects:anticipated.length,actual_objects:actual.length,migration_files:expected.files.length,
      expected_sha256:hash(JSON.stringify(anticipated)),actual_sha256:hash(JSON.stringify(actual)),missing,extra,changed},
    production_data_exported:false, production_restore_performed:false,
    retention_window_verified:false, customer_data_restoration_verified:false,
  };
}

export async function inspectRecovery(run = async args => {
  const {stdout}=await promisify(execFile)(resolve(root,'node_modules/.bin/wrangler'),[...args,'--config',resolve(root,'wrangler.jsonc')],{cwd:root,timeout:45000,maxBuffer:4*1024*1024});
  return JSON.parse(stdout);
}) {
  const expected=migrationSchema();
  const info=await run(['d1','info',target.name,'--json']);
  if(info?.uuid!==target.id||info?.name!==target.name)throw Error('The database identity did not match. No further inspection was attempted.');
  const point=await run(['d1','time-travel','info',target.name,'--json']);
  const schema=await run(['d1','execute',target.name,'--remote','--command',schemaQuery,'--json']);
  return assessRecovery(info,point,schema,expected);
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if (args.length && (args.length!==2||args[0]!=='--out')) throw Error('Usage: node scripts/recovery-status.mjs [--out receipt.json]');
  try {
    const receipt=await inspectRecovery();
    const output=JSON.stringify(receipt,null,2)+'\n';
    if (args.length) writeFileSync(resolve(args[1]),output,{mode:0o600});
    process.stdout.write(output);
    if (receipt.status!=='available') process.exitCode=1;
  } catch {
    // CLI errors can include provider responses. Avoid copying those into shared automation messages.
    process.stderr.write('Recovery inspection failed. Inspect Cloudflare access and the exact Sponsor Intel database; no restore or data export was attempted.\n');
    process.exitCode=1;
  }
}
