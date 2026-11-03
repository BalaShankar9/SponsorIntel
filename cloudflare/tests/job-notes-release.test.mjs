import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publishJobNotes} from '../scripts/publish-job-notes.mjs';
import {pageResponse} from '../worker/pages.js';
test('release code and permissions match the installed candidate; only packaging changes',()=>{
  const base=new URL('../store/job-notes/',import.meta.url);
  const files=['popup.html','popup.css','popup.js','companion.js','icon-16.png','icon-48.png','icon-128.png'];
  for(const f of files)assert.deepEqual(readFileSync(new URL('0.2.1/'+f,base)),readFileSync(new URL('0.2.0/'+f,base)),f);
  const before=JSON.parse(readFileSync(new URL('0.2.0/manifest.json',base))),after=JSON.parse(readFileSync(new URL('0.2.1/manifest.json',base)));
  after.version=before.version;assert.deepEqual(after,before);
});
test('publication rejects changed source or existing archive without moving metadata',t=>{
  const root=mkdtempSync(join(tmpdir(),'si-notes-publish-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'store/job-notes'),{recursive:true});cpSync(new URL('../store/job-notes/0.2.1',import.meta.url),join(root,'store/job-notes/0.2.1'),{recursive:true});
  const receipt=publishJobNotes({projectRoot:root});assert.deepEqual(publishJobNotes({projectRoot:root}),receipt);
  const metadata=join(root,'public/downloads/sponsor-intel-job-notes.json'),before=readFileSync(metadata);
  writeFileSync(join(root,'public/downloads',receipt.filename),'different existing bytes');
  assert.throws(()=>publishJobNotes({projectRoot:root}),/Refusing to replace/);assert.deepEqual(readFileSync(metadata),before);
  writeFileSync(join(root,'store/job-notes/0.2.1/popup.js'),'changed code');
  assert.throws(()=>publishJobNotes({projectRoot:root}),/differs from the reviewed archive/);assert.deepEqual(readFileSync(metadata),before);
});
test('public notes downloads and policy are available without private database access',async()=>{
  const env={ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname)}};
  for(const path of ['/job-notes-privacy.html','/downloads/sponsor-intel-job-notes-0.2.1.zip','/downloads/sponsor-intel-job-notes.json']){
    const r=await pageResponse(new Request('https://sponsorintel.london'+path),env);assert.equal(r.status,200);assert.equal(await r.text(),path);
  }
  assert.equal((await pageResponse(new Request('https://sponsorintel.london/downloads/sponsor-intel-job-notes-0.2.0.zip'),env)).status,404);
});
