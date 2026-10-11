// Explicitly regenerate only as part of a reviewed contract change; builds verify.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../',import.meta.url),manifest='worker/application-source.json';
const files=['worker/application-profile.js','worker/career-writer.js','worker/career-review.js','worker/career-review-candidate.js','worker/career-quality.js','tests/fixtures/application-development-20.json'].sort();
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function applicationSource(directory=root){
 const digests={};
 for(const name of files){
  const bytes=await readFile(new URL(name,directory));digests[name]=hash(bytes);
  if(name.endsWith('.js')){
   const text=bytes.toString();if(/\b(?:import|require)\s*\(/.test(text))throw Error('Dynamic application contract dependency');
   for(const m of text.matchAll(/(?:\bfrom\s+|\bimport\s*)['"]([^'"]+)['"]/g)){
    const path=fileURLToPath(new URL(m[1],new URL(name,directory))),relative=path.slice(fileURLToPath(directory).length);
    if(!files.includes(relative)&&relative!==manifest)throw Error('Untracked application contract dependency: '+relative);
   }
  }
 }
 return {version:1,files:digests,sha256:hash(JSON.stringify(digests))};
}
export async function verifyApplicationSource(directory=root){const actual=await applicationSource(directory),saved=JSON.parse(await readFile(new URL(manifest,directory),'utf8'));if(JSON.stringify(actual)!==JSON.stringify(saved))throw Error('Application contract source changed. Review the new version and regenerate its source identity explicitly.');return actual;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--write'))await writeFile(new URL(manifest,root),JSON.stringify(await applicationSource(),null,2)+'\n');
 else console.log(JSON.stringify({application_source_sha256:(await verifyApplicationSource()).sha256}));
}
