import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../',import.meta.url),manifest='worker/research-source.json';
const files=['migrations/0037_research_comparison.sql','worker/business-operations.js','worker/research-candidate.js','worker/research-contract.js','worker/research-model.js','worker/agent-research.js','worker/research-reference.js','worker/research-reference-controls.js','worker/research-workflow.js','worker/reference-manifest.js','shared/research-completion.js'].sort();
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function researchSource(directory=root){
  const digests={};for(const name of files)digests[name]=hash(await readFile(new URL(name,directory)));
  return {version:1,files:digests,sha256:hash(JSON.stringify(digests))};
}
export async function verifyResearchSource(directory=root){
  const actual=await researchSource(directory),saved=JSON.parse(await readFile(new URL(manifest,directory),'utf8'));
  if(JSON.stringify(actual)!==JSON.stringify(saved))throw Error('Research comparison source changed. Review and explicitly regenerate its source identity.');
  return actual;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--write'))await writeFile(new URL(manifest,root),JSON.stringify(await researchSource(),null,2)+'\n');
  else console.log(JSON.stringify({research_source_sha256:(await verifyResearchSource()).sha256}));
}
