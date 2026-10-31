import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),target='worker/research-scope-source.json';
const files=['migrations/0046_research_scope.sql','worker/research-scope.js','worker/research-scope-contract.js','worker/research-scope-controls.js','worker/research-scope-runtime.js','worker/research-entrypoint.js','worker/research-scope-api.js','worker/research-model.js','shared/research-completion.js','worker/reference-manifest.js','worker/business-workflow.js','worker/business-health.js','worker/agent-api.js','worker/admin.js','worker/index.js','worker/research-source.json'].sort();
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function scopeSource(directory=root){const digests={};for(const name of files)digests[name]=hash(await readFile(new URL(name,directory)));return {version:1,files:digests,sha256:hash(JSON.stringify(digests))};}
export async function verifyScopeSource(directory=root){const actual=await scopeSource(directory),saved=JSON.parse(await readFile(new URL(target,directory),'utf8'));if(JSON.stringify(actual)!==JSON.stringify(saved))throw Error('Scope source changed: a separately reviewed version is required.');return actual;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.includes('--write'))await writeFile(new URL(target,root),JSON.stringify(await scopeSource(),null,2)+'\n');else console.log(JSON.stringify({scope_source_sha256:(await verifyScopeSource()).sha256}));}
