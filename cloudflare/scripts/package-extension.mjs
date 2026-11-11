import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,linkSync,renameSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['manifest.json','popup.html','popup.css','popup.js','analyse.js','capture.js','README.txt','icon-16.png','icon-48.png','icon-128.png'];
export function archive(entries){
  // Deterministic ZIP (stored entries, fixed DOS date). No shell/dependency or private files.
  const crc32=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  const local=[],central=[];let offset=0;
  for(const [name,data] of entries){
    if(!/^[a-zA-Z0-9.-]+$/.test(name)||data.length>500000)throw Error('Invalid extension entry');
    const path=Buffer.from(name),crc=crc32(data),h=Buffer.alloc(30),c=Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(33,12);
    h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(path.length,26);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(33,14);
    c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(path.length,28);c.writeUInt32LE(offset,42);
    local.push(h,path,data);central.push(c,path);offset+=h.length+path.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
export function packageExtension({projectRoot=root}={}){
  const manifest=JSON.parse(readFileSync(resolve(projectRoot,'extension/manifest.json')));
  if(manifest.manifest_version!==3||JSON.stringify(manifest.permissions)!=='["activeTab","scripting"]'||manifest.host_permissions||manifest.background||manifest.content_scripts)throw Error('Extension permissions changed; review required');
  if(!/^\d+\.\d+\.\d+$/.test(manifest.version))throw Error('Invalid extension version');
  const entries=files.map(name=>[name,readFileSync(resolve(projectRoot,'extension',name))]);
  const zip=archive(entries),hash=createHash('sha256').update(zip).digest('hex');
  const filename=`sponsor-intel-extension-${manifest.version}.zip`;
  const dir=resolve(projectRoot,'public/downloads');mkdirSync(dir,{recursive:true});
  const receipt={version:manifest.version,filename,bytes:zip.length,sha256:hash,files:entries.map(([name,data])=>({name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}))};
  const temporary=mkdtempSync(resolve(dir,'.extension-package-'));
  try{
    // Publish complete bytes without replacing an existing version, including racing builds.
    const stagedZip=resolve(temporary,'archive.zip'),target=resolve(dir,filename);
    writeFileSync(stagedZip,zip);
    try{linkSync(stagedZip,target);}catch(error){
      if(error.code!=='EEXIST')throw error;
      if(!readFileSync(target).equals(zip))throw Error(`Refusing to replace ${filename}: existing bytes differ. Bump the extension version and preserve the old archive.`);
    }
    // A rejected archive must never move the current-download receipt.
    const stagedReceipt=resolve(temporary,'receipt.json');
    writeFileSync(stagedReceipt,JSON.stringify(receipt,null,2)+'\n');
    renameSync(stagedReceipt,resolve(dir,'sponsor-intel-extension.json'));
  }finally{rmSync(temporary,{recursive:true,force:true});}
  return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(packageExtension()));
