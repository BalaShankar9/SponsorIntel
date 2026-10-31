import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('preparation requirements match each document and show only the missing actions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'studio-readiness-'));
  try {
    const output=join(dir,'view.cjs');
    await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {StudioReadiness,studioReadiness} from './src/studio-readiness';export {studioReadiness};export const render=p=>renderToStaticMarkup(React.createElement(StudioReadiness,{busy:false,onCV:()=>{},onAdvert:()=>{},...p}));`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
    const {studioReadiness:ready,render}=createRequire(import.meta.url)(output);
    const cv='c'.repeat(100),description='d'.repeat(80);
    assert.equal(ready('analysis',cv,description,false).ready,true);
    assert.equal(ready('analysis',' '.repeat(100),description,false).ready,false);
    assert.equal(ready('analysis',cv,'d'.repeat(79),false).ready,false);
    assert.equal(ready('companyResearch','',description,false).ready,true);
    assert.equal(ready('followup','','',false).ready,true);
    for(const kind of ['cv','coverLetter','interview','portfolio','learningPlan']) {
      assert.equal(ready(kind,cv,description,false).ready,false,kind);
      assert.equal(ready(kind,cv,description,true).ready,true,kind);
      assert.equal(ready(kind,cv.slice(1),description,true).ready,false,kind);
    }
    const empty=render({kind:'analysis',cv:'',description:'',consent:false});
    assert.match(empty,/Add my CV/);assert.match(empty,/Add job description/);
    assert.doesNotMatch(empty,/consent below/);
    const consentOnly=render({kind:'cv',cv,description,consent:false});
    assert.match(consentOnly,/consent below/);assert.doesNotMatch(consentOnly,/Add my CV|Add job description/);
    assert.equal(render({kind:'analysis',cv,description,consent:false}),'');
    assert.equal(render({kind:'companyResearch',cv:'',description,consent:false}),'');
    assert.equal(render({kind:'followup',cv:'',description:'',consent:false}),'');
    const short=render({kind:'analysis',cv:'<script>private CV</script>',description:'Short advert',consent:false});
    assert.match(short,/Complete my CV/);assert.match(short,/100 characters/);assert.match(short,/80 characters/);
    assert.doesNotMatch(short,/private CV|Short advert/);
    const formAdvert='Complete the application form and describe your actual experience. CVs will not be accepted for this application.';
    assert.equal(ready('cv',cv,formAdvert,true).ready,false);
    assert.equal(ready('cv',cv,formAdvert,true).cvRestricted,true);
    assert.equal(ready('analysis',cv,formAdvert,false).ready,true);
    assert.equal(ready('interview',cv,formAdvert,true).ready,true);
    assert.equal(ready('cv',cv,description,true).ready,true);
    const format=render({kind:'cv',cv,description:formAdvert,consent:false});
    assert.match(format,/CV generation is paused/);assert.match(format,/Existing drafts remain editable/);
    assert.doesNotMatch(format,/consent below/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
