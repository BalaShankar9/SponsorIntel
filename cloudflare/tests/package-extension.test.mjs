import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,statSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {packageExtension} from '../scripts/package-extension.mjs';

const execute=promisify(execFile);
const packageModule=new URL('../scripts/package-extension.mjs',import.meta.url).href;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=version=>({manifest_version:3,version,permissions:['activeTab','scripting']});
function temporary(t){
  const path=mkdtempSync(join(tmpdir(),'si-package-test-'));
  t.after(()=>rmSync(path,{recursive:true,force:true}));return path;
}
function source(path,variant='one'){
  mkdirSync(join(path,'extension'),{recursive:true});
  writeFileSync(join(path,'extension/manifest.json'),JSON.stringify(manifest('0.0.1')));
  // Fictional bytes exercise publication behavior, not installed-extension/image acceptance.
  for(const name of ['popup.html','popup.css','popup.js','analyse.js','capture.js','README.txt','icon-16.png','icon-48.png','icon-128.png'])
    writeFileSync(join(path,'extension',name),`${name}: fictional fixture ${variant}`);
  return path;
}
function outputs(root){
  const dir=join(root,'public/downloads');
  return Object.fromEntries(readdirSync(dir).sort().map(name=>[name,readFileSync(join(dir,name))]));
}

test('identical extension rebuild keeps existing archive bytes and file identity',t=>{
  const root=source(temporary(t)),first=packageExtension({projectRoot:root});
  const path=join(root,'public/downloads',first.filename),inode=statSync(path).ino,before=outputs(root);
  assert.deepEqual(packageExtension({projectRoot:root}),first);
  assert.equal(statSync(path).ino,inode);
  assert.deepEqual(outputs(root),before);
});

test('changed bytes under an existing version fail without touching archive or download metadata',t=>{
  const root=source(temporary(t));packageExtension({projectRoot:root});const before=outputs(root);
  writeFileSync(join(root,'extension/README.txt'),'A changed fictional package, with no version bump.');
  assert.throws(()=>packageExtension({projectRoot:root}),/Refusing to replace.*Bump the extension version/);
  assert.deepEqual(outputs(root),before);
});

test('a new version publishes a separate archive and preserves the prior download',t=>{
  const root=source(temporary(t)),first=packageExtension({projectRoot:root});
  const oldPath=join(root,'public/downloads',first.filename),oldBytes=readFileSync(oldPath);
  writeFileSync(join(root,'extension/manifest.json'),JSON.stringify(manifest('0.0.2')));
  writeFileSync(join(root,'extension/README.txt'),'Fictional new version.');
  const second=packageExtension({projectRoot:root});
  assert.equal(second.version,'0.0.2');assert.notEqual(second.filename,first.filename);
  assert.deepEqual(readFileSync(oldPath),oldBytes);
  assert.equal(hash(readFileSync(join(root,'public/downloads',second.filename))),second.sha256);
  assert.deepEqual(JSON.parse(readFileSync(join(root,'public/downloads/sponsor-intel-extension.json'))),second);
  assert.deepEqual(readdirSync(join(root,'public/downloads')).sort(),[first.filename,second.filename,'sponsor-intel-extension.json'].sort());
});

test('concurrent different contents for one version retain one complete archive and its matching receipt',async t=>{
  const parent=temporary(t),shared=join(parent,'shared');mkdirSync(shared);
  const roots=['one','two'].map(variant=>{
    const root=source(join(parent,variant),variant);mkdirSync(join(root,'public'));
    symlinkSync(shared,join(root,'public/downloads'),'dir');return root;
  });
  const code=`import {packageExtension} from ${JSON.stringify(packageModule)};console.log(JSON.stringify(packageExtension({projectRoot:process.argv[1]})));`;
  const results=await Promise.allSettled(roots.map(root=>execute(process.execPath,['--input-type=module','-e',code,root])));
  const completed=results.filter(r=>r.status==='fulfilled'),rejected=results.filter(r=>r.status==='rejected');
  assert.equal(completed.length,1);assert.equal(rejected.length,1);
  assert.match(rejected[0].reason.stderr,/Refusing to replace.*Bump the extension version/);
  const winner=JSON.parse(completed[0].value.stdout),stored=JSON.parse(readFileSync(join(shared,'sponsor-intel-extension.json')));
  assert.deepEqual(stored,winner);assert.equal(hash(readFileSync(join(shared,winner.filename))),winner.sha256);
  assert.deepEqual(readdirSync(shared).sort(),[winner.filename,'sponsor-intel-extension.json'].sort());
});
