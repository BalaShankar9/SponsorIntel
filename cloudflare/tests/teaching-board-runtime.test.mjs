import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {school,provider,seedSchool} from './fixtures/teaching-board.mjs';

test('actual SourceWorkflow publishes a school with a separate legal trust and retains a bounded receipt',{timeout:60000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {dispatchSources} from './worker/agent-operations.js';
 export {SourceWorkflow} from './worker/source-workflow.js';
 export default {async fetch(request,env){if(new URL(request.url).pathname==='/start')return Response.json(await dispatchSources(env,{id:'school-runtime',sourceId:'${school.id}'}));return Response.json(await(await env.SOURCE_WORKFLOW.get('school-runtime')).status());}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 const fixture=provider(),mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'teaching-source-isolated'},workflows:{SOURCE_WORKFLOW:{name:'teaching-source-isolated',className:'SourceWorkflow'}},outboundService:r=>fixture.fetcher(r.url)}));
 try{
 const db=await mf.getD1Database('DB'),schema=migrationSchema();for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}await seedSchool(db);
 assert.equal((await mf.dispatchFetch('http://localhost/start')).status,200);let result;for(let i=0;i<150;i++){result=await(await mf.dispatchFetch('http://localhost/status')).json();if(['complete','errored','terminated'].includes(result.status))break;await new Promise(r=>setTimeout(r,200));}assert.equal(result?.status,'complete',JSON.stringify(result));
 const task=await db.prepare('SELECT * FROM agent_tasks').first(),evidence=JSON.parse(task.evidence);assert.equal(task.state,'published');assert.equal(evidence.feed_review.advert_count,2);assert.equal(evidence.licence_id,school.sponsor_id);
 const jobs=(await db.prepare('SELECT company,sponsorship FROM jobs').all()).results;assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.company===school.company));assert.deepEqual(jobs.map(j=>j.sponsorship).sort(),['conditional','unavailable']);assert.equal(fixture.calls.length,4);assert.equal((await db.prepare('SELECT requests FROM agent_daily_budget').first()).requests,24);
 await mf.dispatchFetch('http://localhost/start');assert.equal(fixture.calls.length,4);
 }finally{await mf.dispose();}
});
