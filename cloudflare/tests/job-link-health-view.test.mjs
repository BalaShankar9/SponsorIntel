import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('owner page distinguishes a bounded read from an unknown historical failure without treating HTTP 200 as success',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'job-link-view-'));
 try{
  const output=join(dir,'view.cjs');
  await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {JobLinkStatus} from './src/job-link-health';export const render=reason=>renderToStaticMarkup(React.createElement(JobLinkStatus,{health:{enabled:true,checked_at:'2026-10-11T12:00:00Z',eligible_sources:1,matched:0,needs_attention:1,awaiting:0,items:[{source_id:'fixture',company:'Fictional employer',status:'needs_attention',id:'fixture-receipt',title:'Fictional role',url:'https://example.invalid/job',created_at:'2026-10-11T12:00:00Z',reason,advert_current:1,evidence:{chain:[{url:'https://example.invalid/job',status:200}]}}]}}));`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
  const {render}=createRequire(import.meta.url)(output);
  const limited=render('response_body_limit');assert.match(limited,/500,000-byte check limit/);assert.match(limited,/complete page was not inspected/);assert.match(limited,/does not show that it has closed/);assert.match(limited,/HTTP 200/);assert.doesNotMatch(limited,/Page title matched/);
  const legacy=render('request_or_read_unavailable');assert.match(legacy,/exact cause was not retained/);assert.doesNotMatch(legacy,/500,000-byte/);assert.match(legacy,/HTTP 200 alone does not confirm/);
  const missing=render('response_body_missing');assert.match(missing,/no page body to inspect/);assert.match(missing,/availability is unconfirmed/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
