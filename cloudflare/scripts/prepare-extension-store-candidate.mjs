// Prepare an immutable, non-public store candidate from the exact current package sources.
// This renders the existing vector brand mark; it never edits a published ZIP or image.
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {packageExtension} from './package-extension.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[require.resolve('miniflare')]}));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const version=process.argv[2];
assert.match(version||'',/^\d+\.\d+\.\d+$/,'Supply the new candidate version');
const output=resolve(process.argv[3]||join(root,'store/advert-check',version));
assert.ok(!existsSync(output),'Candidate directory already exists; preserve it and choose a new version');
const baseline=JSON.parse(readFileSync(join(root,'public/downloads/sponsor-intel-extension.json')));
const newer=(a,b)=>{for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;};
assert.ok(newer(version.split('.').map(Number),baseline.version.split('.').map(Number)),'Candidate must be newer than the public baseline');
assert.equal(hash(readFileSync(join(root,'public/downloads',baseline.filename))),baseline.sha256);
for(const file of baseline.files) {
  assert.match(file.name,/^[\w.-]+$/);
  assert.equal(hash(readFileSync(join(root,'extension',file.name))),file.sha256,`Baseline source drift: ${file.name}`);
}

const vector=readFileSync(join(root,'public/favicon.svg'),'utf8').trim();
assert.ok(vector.startsWith('<svg ')&&vector.endsWith('</svg>'));
assert.match(vector,/viewBox="0 0 64 64"/);
assert.ok(!/<(?:script|image|foreignObject)\b|(?:href|on\w+)\s*=/i.test(vector),'Expected self-contained vector logo');
const nested=vector.replace('<svg ','<svg x="16" y="16" width="96" height="96" ');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${nested}</svg>\n`;
const icon=await sharp(Buffer.from(svg)).png().toBuffer();
const {data,info}=await sharp(icon).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(info.width,128);assert.equal(info.height,128);assert.equal(info.channels,4);
const bounds={left:128,top:128,right:-1,bottom:-1};
let opaque=0;
for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
  const alpha=data[(y*128+x)*4+3];
  if(x<16||x>=112||y<16||y>=112)assert.equal(alpha,0,'Padding must be entirely transparent');
  if(alpha){opaque++;bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,y);}
}
assert.deepEqual(bounds,{left:16,top:16,right:111,bottom:111});
assert.ok(opaque>7000,'Expected visible brand artwork');

const temporary=mkdtempSync(join(tmpdir(),'si-store-candidate-'));
try {
  mkdirSync(join(temporary,'extension'));
  for(const file of baseline.files)cpSync(join(root,'extension',file.name),join(temporary,'extension',file.name));
  const manifest=JSON.parse(readFileSync(join(temporary,'extension/manifest.json')));
  manifest.version=version;
  writeFileSync(join(temporary,'extension/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const readme=readFileSync(join(temporary,'extension/README.txt'),'utf8');
  assert.ok(readme.split('\n')[0].includes(baseline.version));
  writeFileSync(join(temporary,'extension/README.txt'),readme.replace(baseline.version,version));
  writeFileSync(join(temporary,'extension/icon-128.png'),icon);
  const candidate=packageExtension({projectRoot:temporary});
  const changed=candidate.files.filter(f=>f.sha256!==baseline.files.find(b=>b.name===f.name)?.sha256).map(f=>f.name);
  assert.deepEqual(changed,['manifest.json','README.txt','icon-128.png']);
  const previousManifest=JSON.parse(readFileSync(join(root,'extension/manifest.json')));
  assert.deepEqual({...manifest,version:baseline.version},previousManifest);
  mkdirSync(dirname(output),{recursive:true});
  mkdirSync(output); // Exclusive directory creation also rejects competing preparations.
  cpSync(join(temporary,'public/downloads',candidate.filename),join(output,candidate.filename));
  writeFileSync(join(output,'icon-128.png'),icon);
  writeFileSync(join(output,'icon-source.svg'),svg);
  const receipt={preparedAt:new Date().toISOString(),status:'prepared_only_not_installed_uploaded_or_public',
    baseline:{version:baseline.version,sha256:baseline.sha256},candidate,changedFiles:changed,
    artwork:{source:'public/favicon.svg',sourceSha256:hash(Buffer.from(vector+'\n')),renderedSvgSha256:hash(Buffer.from(svg)),
      iconSha256:hash(icon),width:128,height:128,transparentPadding:16,alphaBounds:bounds},
    toolchain:{node:process.version,sharp:sharp.versions.sharp,rsvg:sharp.versions.rsvg},
    unchanged:'All executable code, popup HTML/CSS, smaller icons, permissions and CSP match the verified baseline.',
    remaining:['Installed candidate acceptance','Actual-experience store-size screenshot','Publisher fields and declarations','Manual store submission and approval','Consumer installation','Independent semantic and external-site compatibility evidence']};
  writeFileSync(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({output,...receipt}));
} finally {rmSync(temporary,{recursive:true,force:true});}
