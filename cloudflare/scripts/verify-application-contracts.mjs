// Fail builds on edited historical validators, helpers or an expanded import graph.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../worker/application-contracts/2026-10-08-v1/',import.meta.url);
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function verifyApplicationContracts(directory=root){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
 const names=['career-quality.js','career-review-candidate.js','career-review.js'];
 if(JSON.stringify(Object.keys(manifest.source_files).sort())!==JSON.stringify(names))throw Error('Historical application dependency list changed');
 for(const name of names){
  const bytes=await readFile(new URL(name,directory));
  if(digest(bytes)!==manifest.source_files[name])throw Error('Historical application source changed: '+name);
  for(const match of bytes.toString().matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)){
   if(!names.some(n=>match[1]==='./'+n))throw Error('Historical application dependency escaped archive');
  }
 }
 const sourceHash=digest(JSON.stringify(Object.fromEntries(names.map(n=>[n,manifest.source_files[n]]))));
 if(sourceHash!==manifest.source_sha256)throw Error('Historical application source identity changed');
 return {id:manifest.id,source_sha256:sourceHash,files:names.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await verifyApplicationContracts()));
