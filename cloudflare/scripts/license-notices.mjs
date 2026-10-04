import {readFile, readdir, writeFile} from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
let output='Sponsor Intel — open-source notices\n\n'+await readFile('THIRD_PARTY_NOTICES.md','utf8');
for(const [path,entry] of Object.entries(lock.packages).sort()){
 if(!path||entry.dev)continue;
 try{
  const p=JSON.parse(await readFile(path+'/package.json','utf8'));
  const files=(await readdir(path)).filter(n=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(n));
  output+='\n\n==================================================\n'+p.name+' '+p.version+' — '+(p.license||'See upstream')+'\n';
  for(const file of files)try{output+='\n'+await readFile(path+'/'+file,'utf8');}catch{}
 }catch{}
}
output+='\n\nNoto Sans (unmodified), SIL Open Font License 1.1\n'+await readFile('public/fonts/OFL.txt','utf8');
output=output.replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n');
await writeFile('public/open-source-notices.txt',output);console.log('Open-source notices generated.');
