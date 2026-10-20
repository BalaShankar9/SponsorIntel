import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';

test('actual MarketingWorkflow/D1 reviews a fictional unchanged company report once without a provider send',{timeout:60000},async()=>{
 const bundle=await build({stdin:{contents:`import {MarketingWorkflow} from './worker/marketing-workflow.js';
 import {dispatchMarketingAgents} from './worker/marketing-agents.js';
 import {publishInsight,insightSocialCopy} from './worker/insights.js';
 import {createBrief} from './worker/marketing.js';
 export class ReportFixture extends MarketingWorkflow {constructor(ctx,env){super(ctx,{...env,AI:{run:async(model,request)=>{
  const input=JSON.parse(request.messages[1].content);await env.DB.prepare('INSERT INTO fictional_calls(model,input,format) VALUES(?,?,?)').bind(model,JSON.stringify(input),JSON.stringify(request.response_format)).run();
  return {response:{checks:input.units.map(u=>({index:u.index,supported:true,reason:'Fictional runtime response tests execution, not model judgement.',evidence:u.claim?input.sources.map(s=>({source_id:s.id,quote:s.excerpt})):[]})),publishable:true,reason:'Fictional acceptance tests retained receipts and does not authorise a real post.'},usage:{total_tokens:1}};
 }}});}}
 export default {async fetch(r,env){const path=new URL(r.url).pathname,now=Date.now();
  if(path==='/start'){
   if(!await env.DB.prepare('SELECT id FROM insight_versions').first()){
    const stamp=new Date(now-86400000).toISOString(),s={measured_at:stamp,jobs:{total:20,employers:1,offered:2,conditional:3,unavailable:4,not_stated:11,early_career:6,salary:8},sources:[{id:'fixture',company:'Fictional employer',careers_url:'https://example.com/careers',last_success:stamp,roles:20}],held_batches:0,checks:Array.from({length:5},()=>({ok:true,security:true}))};
    await publishInsight(env,'fictional-report',s,now-86400000);
    for(const audience of ['company','personal'])await createBrief(env,{topic_key:'report:fictional-report',destination:'linkedin-'+audience,title:'Fictional report',purpose:'Fictional runtime company report test, no real customers or provider calls.',text:insightSocialCopy(s,audience),expires_at:new Date(now+6*86400000).toISOString(),sources:[{url:'https://sponsorintel.london/insights/uk-sponsorship-jobs-report',title:'Fictional evidence',excerpt:'A dated fictional report snapshot for isolated execution tests.',checked_at:stamp}]},'report-template',now);
   }
   return Response.json(await dispatchMarketingAgents(env));
  }
  const id='marketing-'+new Date().toISOString().slice(0,10);return Response.json(await(await env.MARKETING_WORKFLOW.get(id)).status());
 }};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'report-review-isolated'},workflows:{MARKETING_WORKFLOW:{name:'report-review-isolated',className:'ReportFixture'}},bindings:{AI_MODEL:'@cf/zai-org/glm-4.7-flash',AI_REVIEW_MODEL:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'},outboundService:()=>{outbound++;throw Error('External I/O forbidden');}}));
 try{
  const db=await mf.getD1Database('DB'),schema=migrationSchema();
  for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
  await db.batch([db.prepare("INSERT INTO business_controls(singleton,updated_at) VALUES(1,'2026-10-18')"),db.prepare("INSERT INTO marketing_agent_controls(singleton,updated_at) VALUES(1,'2026-10-18')"),db.prepare('CREATE TABLE fictional_calls(model TEXT,input TEXT,format TEXT)')]);
  const start=await mf.dispatchFetch('http://localhost/start');assert.equal(start.status,200,await start.clone().text());
  let state;for(let i=0;i<200;i++){state=await(await mf.dispatchFetch('http://localhost/status')).json();if(['complete','errored','terminated'].includes(state.status))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(state?.status,'complete',JSON.stringify(state));
  const run=await db.prepare('SELECT state,calls,result FROM marketing_agent_runs').first();assert.equal(run.state,'reviewed',run.result);assert.equal(run.calls,1);assert.equal(JSON.parse(run.result).publication,'none');
  const company=await db.prepare("SELECT * FROM marketing_briefs WHERE destination='linkedin-company'").first();assert.equal(company.state,'reviewed');assert.equal(company.version,2);assert.equal(company.revision,3);
  const versions=(await db.prepare('SELECT text,expires_at FROM marketing_versions WHERE brief_id=? ORDER BY version').bind(company.id).all()).results;assert.deepEqual(versions[0],versions[1]);
  assert.equal((await db.prepare("SELECT state FROM marketing_briefs WHERE destination='linkedin-personal'").first()).state,'proposed');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM marketing_receipts').first()).n,0);assert.equal((await db.prepare('SELECT runs,calls FROM agent_research_budget').first()).calls,1);
  const calls=(await db.prepare('SELECT * FROM fictional_calls').all()).results;assert.equal(calls.length,1);assert.match(calls[0].model,/llama/);assert.equal(JSON.parse(calls[0].input).units.length,2);assert.equal(outbound,0);
  const captured=JSON.parse((await db.prepare('SELECT context FROM marketing_agent_runs').first()).context).report_review;
  assert.equal(JSON.parse(calls[0].format).type,'json_schema');assert.deepEqual(JSON.parse(calls[0].format),captured.request.response_format);
  const replay=await(await mf.dispatchFetch('http://localhost/start')).json();assert.equal(replay.reused,true);assert.equal((await db.prepare('SELECT COUNT(*) n FROM fictional_calls').first()).n,1);
 }finally{await mf.dispose();}
});
