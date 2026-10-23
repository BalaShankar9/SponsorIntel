import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('owner completion view distinguishes received, rejected, unconfirmed and legacy evidence',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'research-completion-view-'));
  try {
    const output=join(dir,'view.cjs');await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {ResearchCompletionNote} from './src/research-completion';export const render=value=>renderToStaticMarkup(React.createElement(ResearchCompletionNote,{value}));`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
    const {render}=createRequire(import.meta.url)(output);
    const base={version:1,provider:'cloudflare',failure_stage:'incomplete_response',finish_reason:'length',response_kind:'text',usage:{completion_tokens:8192}};
    assert.match(render(base),/incomplete response/);assert.match(render(base),/8,192/);assert.match(render(base),/not a billing receipt/);assert.match(render(base),/does not authorize a retry/);
    assert.match(render({...base,failure_stage:'invalid_json'}),/JSON could not be read/);
    assert.match(render({...base,failure_stage:'contract_validation'}),/evidence or structure checks rejected/);
    assert.match(render({...base,failure_stage:'retention_unconfirmed'}),/saving its result could not be confirmed/);
    assert.match(render(null),/not been reconstructed/);
    const hostile=render({...base,finish_reason:'PRIVATE_REASON',response_kind:'<script>PRIVATE_KIND</script>',usage:{total_tokens:'PRIVATE_USAGE'},raw:'PRIVATE_MODEL'});assert.ok(!hostile.includes('PRIVATE'));assert.match(hostile,/unknown/);
    assert.match(render({...base,usage:{completion_tokens:0}}),/output 0/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
