import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildEvidenceReview} from '../worker/career-evidence.js';

test('fictional examples use the real local check, preserve provenance and never infer eligibility', async () => {
  const dir=await mkdtemp(join(tmpdir(),'si-evidence-example-'));
  try {
    const file=join(dir,'example.cjs');
    await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {EvidenceExample,EVIDENCE_EXAMPLES} from './src/evidence-example';export {EVIDENCE_EXAMPLES};export const render=()=>renderToStaticMarkup(React.createElement(EvidenceExample,{onChooseRole:()=>{throw Error('No navigation during render');}}));`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',outfile:file,loader:{'.css':'empty'},logLevel:'silent'});
    const {EVIDENCE_EXAMPLES:examples,render}=createRequire(import.meta.url)(file);
    const before=JSON.stringify(examples);
    const project=buildEvidenceReview({cv:examples[0].cv},examples[0]);
    assert.match(project,/Python\n  Your CV:/);
    assert.match(project,/Excel\n  Your CV:/);
    assert.match(project,/but your CV does not: SQL/);
    assert.doesNotMatch(project,/SQL\n  Your CV:/);
    assert.match(project,/Python study project/);
    const service=buildEvidenceReview({cv:examples[1].cv},examples[1]);
    assert.match(service,/customer service\n  Your CV:/);
    assert.match(service,/communication\n  Your CV:/);
    assert.match(service,/but your CV does not: Excel/);
    assert.match(service,/Weekend availability is essential/);
    for(const result of [project,service]) {
      assert.match(result,/NOT YET VERIFIED/);
      assert.match(result,/work authorisation has not been verified/);
      assert.match(result,/No clear sponsorship statement/);
    }
    assert.equal(JSON.stringify(examples),before);
    const html=render();
    assert.match(html,/made-up examples/);assert.match(html,/use no AI calls/);
    assert.match(html,/Fictional CV/);assert.match(html,/not a vacancy/);
    assert.match(html,/coursework, not paid employment/);
    assert.doesNotMatch(html,/textarea|type="file"|Example check ready|What to take from this example/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
