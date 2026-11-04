import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual Worker/D1 preserves rejected completion metadata and replay charges without external I/O',{timeout:30000},async()=>{
  const bundle=await build({stdin:{contents:`import {startInvestigation,researchContext,modelStep,researchSnapshot} from './worker/agent-research.js';let calls=0;
    export default {async fetch(request,env){
      const fixture={...env,AI_MODEL:'fixture',AI_REVIEW_MODEL:'critic',RESEARCH_WORKFLOW:{create:async()=>({})},AI:{run:async()=>{calls++;return {response:'PRIVATE_PARTIAL',choices:[{finish_reason:'length',message:{reasoning_content:'PRIVATE_THINKING'}}],usage:{prompt_tokens:20,completion_tokens:8192,total_tokens:8212,debug:'PRIVATE_USAGE'}};}}};
      const {id}=await startInvestigation(fixture,'fictional-owner','evaluation');await researchContext(fixture,id);
      try{await modelStep(fixture,id,'analysis','investigator','fictional fixture',{},x=>x);}catch{}
      return Response.json({calls,snapshot:await researchSnapshot(fixture)});
    }};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'research-completion-isolated'},outboundService:()=>{assert.fail('External services are forbidden');}}));
  try {
    const db=await mf.getD1Database('DB'),schema=migrationSchema();
    for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
    const first=await(await mf.dispatchFetch('http://localhost/fixture')).json();
    assert.equal(first.calls,1);assert.equal(first.snapshot.steps[0].state,'failed');
    assert.deepEqual(first.snapshot.steps[0].completion,{version:1,provider:'cloudflare',failure_stage:'incomplete_response',finish_reason:'length',response_kind:'text',usage:{prompt_tokens:20,completion_tokens:8192,total_tokens:8212}});
    assert.ok(!JSON.stringify(first).includes('PRIVATE_'));
    const before=await db.prepare('SELECT * FROM agent_research_steps').first();
    const again=await(await mf.dispatchFetch('http://localhost/fixture')).json();
    assert.equal(again.calls,1);assert.deepEqual(await db.prepare('SELECT * FROM agent_research_steps').first(),before);
    const budget=await db.prepare('SELECT runs,calls FROM agent_research_budget').first();assert.deepEqual(budget,{runs:1,calls:1});
    assert.equal((await db.prepare('SELECT report FROM agent_investigations').first()).report,null);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM agent_research_memory').first()).n,0);
  } finally {await mf.dispose();}
});
