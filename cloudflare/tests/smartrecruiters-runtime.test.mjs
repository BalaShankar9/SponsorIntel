import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {posting,provider} from './fixtures/smartrecruiters.mjs';

test('actual SourceWorkflow resumes private paged cache, atomically publishes and replays without network', {timeout:60000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {dispatchSources} from './worker/agent-operations.js';
 export {SourceWorkflow} from './worker/source-workflow.js';
 export default {async fetch(request,env){const u=new URL(request.url);if(u.pathname==='/start')return Response.json(await dispatchSources(env,{id:u.searchParams.get('id'),sourceId:'portmandentex',trigger:'owner'}));return Response.json(await env.DB.prepare('SELECT * FROM agent_runs WHERE id=?').bind(u.searchParams.get('id')).first());}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const fixture=provider(Array.from({length:41},(_,i)=>posting(i+1)));
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'smartrecruiters-isolated'},workflows:{SOURCE_WORKFLOW:{name:'smartrecruiters-isolated',className:'SourceWorkflow'}},outboundService:request=>fixture.fetcher(request.url)}));
 try{
  const db=await mf.getD1Database('DB');
  const schema=migrationSchema();
  // Complete post-migration schema in an empty disposable D1, with no customer data.
  for(const type of ['table','index','view','trigger'])for(const object of schema.objects.filter(x=>x.type===type))await db.prepare(object.sql).run();
  async function start(id){const r=await mf.dispatchFetch('http://localhost/start?id='+id);assert.equal(r.status,200);let run;for(let i=0;i<120;i++){run=await(await mf.dispatchFetch('http://localhost/status?id='+id)).json();if(run&&['completed','attention','failed'].includes(run.state))break;await new Promise(r=>setTimeout(r,200));}assert.equal(run?.state,'completed',JSON.stringify(run));return run;}
  const first=await start('fictional-first');assert.equal(JSON.parse(first.summary).collecting,1);assert.equal(fixture.calls.length,42);assert.equal((await db.prepare('SELECT COUNT(*) n FROM jobs').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM job_sources').first()).n,0);
  const second=await start('fictional-second');assert.equal(JSON.parse(second.summary).published,1);assert.equal((await db.prepare('SELECT COUNT(*) n FROM jobs WHERE active=1').first()).n,41);assert.equal(fixture.calls.length,45);assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,100);
  const jobs=(await db.prepare('SELECT sponsorship,description_checked_at,source_first_published_at,description FROM jobs').all()).results;assert.ok(jobs.every(j=>j.sponsorship==='offered'&&j.description_checked_at&&j.source_first_published_at===null&&!j.description.includes('PRIVATE_FIXTURE')));
  await start('fictional-second');assert.equal(fixture.calls.length,45);assert.equal((await db.prepare('SELECT COUNT(*) n FROM source_runs').first()).n,1);
 }finally{await mf.dispose();}
});
