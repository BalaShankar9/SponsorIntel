import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('owner failure view distinguishes recovered, still-private and legacy receipts without rendering arbitrary error details',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'source-diagnostic-view-'));
 try{
  const output=join(dir,'view.cjs');
  await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {SourceDiagnostics} from './src/source-diagnostics';export const render=receipts=>renderToStaticMarkup(React.createElement(SourceDiagnostics,{receipts}));`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
  const {render}=createRequire(import.meta.url)(output);
  const base={run_id:'fictional-check',source_id:'fictional',company:'Fictional employer',state:'published',error_code:null,created_at:'2026-10-08T12:00:00Z',attempt_failures:[{attempt:1,checked_at:'2026-10-08T12:00:00Z',code:'invalid_sections',phase:'description',posting_ref:'744000100000001',requests:2,message:'PRIVATE_FIXTURE',url:'https://private.invalid'}]};
  const html=render([base]);assert.match(html,/Recovered within this run and published/);assert.match(html,/Advert sections are missing or unsupported/);assert.match(html,/744000100000001/);assert.ok(!html.includes('PRIVATE_FIXTURE'));assert.ok(!html.includes('private.invalid'));
  assert.match(render([{...base,state:'skipped',error_code:'details_pending'}]),/descriptions remain private/);
  assert.match(render([{...base,state:'failed',attempt_failures:[]}]),/cause is unconfirmed/);
  const hostile=render([{...base,company:'<script>alert(1)</script>',attempt_failures:[{...base.attempt_failures[0],code:'PRIVATE_FIXTURE',posting_ref:'<script>PRIVATE_FIXTURE</script>'}]}]);
  assert.ok(!hostile.includes('<script>'));assert.ok(!hostile.includes('PRIVATE_FIXTURE'));assert.match(hostile,/without a classified cause/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
