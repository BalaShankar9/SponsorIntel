import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,linkSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {archive} from './package-extension.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['manifest.json','popup.html','popup.css','popup.js','companion.js','README.txt','icon-16.png','icon-48.png','icon-128.png'];
const expected='bffe815a988a9f1aed864eb2babb16c8b2ade7cf02b73ea1636cf5c9f442c98f';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function publishJobNotes({projectRoot=root}={}){
  const source=resolve(projectRoot,'store/job-notes/0.2.1'),filename='sponsor-intel-job-notes-0.2.1.zip';
  const entries=files.map(name=>[name,readFileSync(resolve(source,name))]);
  const zip=readFileSync(resolve(source,filename));
  if(sha(zip)!==expected||!archive(entries).equals(zip))throw Error('Job notes release differs from the reviewed archive');
  const manifest=JSON.parse(entries[0][1]);
  if(manifest.version!=='0.2.1'||JSON.stringify(manifest.permissions)!=='["activeTab","scripting"]')throw Error('Job notes version or permissions changed');
  const receipt={version:'0.2.1',filename,bytes:zip.length,sha256:expected,privacy:'/job-notes-privacy.html',files:entries.map(([name,data])=>({name,bytes:data.length,sha256:sha(data)}))};
  const dir=resolve(projectRoot,'public/downloads');mkdirSync(dir,{recursive:true});
  const temp=mkdtempSync(resolve(dir,'.job-notes-package-'));
  try{
    const staged=resolve(temp,'archive.zip'),target=resolve(dir,filename);writeFileSync(staged,zip);
    try{linkSync(staged,target);}catch(error){if(error.code!=='EEXIST')throw error;if(!readFileSync(target).equals(zip))throw Error('Refusing to replace immutable Job notes archive');}
    const metadata=resolve(temp,'receipt.json');writeFileSync(metadata,JSON.stringify(receipt,null,2)+'\n');
    renameSync(metadata,resolve(dir,'sponsor-intel-job-notes.json'));
  }finally{rmSync(temp,{recursive:true,force:true});}
  return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(publishJobNotes()));
