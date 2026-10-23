import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import manifest from '../worker/application-contracts/2026-10-08-v1/manifest.json' with {type:'json'};

test('bundled Worker/auth/D1 inspects archived rejections across build modes without writes or outbound work',{timeout:60000},async()=>{
 const readings=[];
 for(const minify of [false,true]){
  const bundle=await build({stdin:{contents:`import {adminAPI} from './worker/admin.js';import {authFor} from './worker/auth.js';export default {fetch(r,e){return new URL(r.url).pathname.startsWith('/api/auth/')?authFor(r,e).handler(r):adminAPI(r,e);}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,minify,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
  let outbound=0;const origin='http://127.0.0.1:8788';
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'historical-inspection-fixture'},bindings:{AUTH_SECRET:'fictional-local-only-application-history-secret',APP_ORIGIN:origin,AI_MODEL:manifest.profile.writer,AI_REVIEW_MODEL:manifest.profile.reviewer},outboundService:()=>{outbound++;throw Error('External services prohibited');}}));
  try{
   const db=await mf.getD1Database('DB');
   for(const type of ['table','index','view','trigger']){const rows=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(rows.length)await db.batch(rows);}
   const signup=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional Owner',email:'owner@example.invalid',password:'Fictional-local-254!'})});
   assert.equal(signup.status,200);const owner=await signup.json(),cookie=signup.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),stamp=new Date().toISOString();
   await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.user.id,stamp).run();
   await db.batch([db.prepare("INSERT INTO application_eval_campaigns(id,created_at,reason) VALUES('legacy-v1',?,'Fictional migration boundary')").bind(stamp),db.prepare("INSERT INTO application_eval_campaign_control VALUES(1,'legacy-v1')"),db.prepare('INSERT INTO business_controls(singleton,enabled,updated_at) VALUES(1,0,?)').bind(stamp),db.prepare('INSERT INTO application_eval_controls(singleton,enabled) VALUES(1,0)'),db.prepare("INSERT INTO agent_research_budget(day,runs,calls) VALUES('2026-10-11',2,6)")]);
   await db.prepare("INSERT INTO application_eval_runs(id,day,trigger_kind,state,created_at,finished_at,profile,case_ids) VALUES('original','2026-10-10','scheduled','completed',?,?,?,?)").bind(stamp,stamp,JSON.stringify(manifest.profile),'["graduate-year"]').run();
   for(const stage of ['baseline','candidate'])await db.prepare("INSERT INTO application_eval_steps(run_id,case_id,stage,state,created_at,finished_at,raw,error) VALUES('original','graduate-year',?,'rejected',?,?,?,?)").bind(stage,stamp,stamp,JSON.stringify('PRIVATE_RAW_SENTINEL not valid JSON'),'Original rejection retained').run();
   const preserved=async()=>Promise.all(['application_eval_runs','application_eval_steps','application_eval_controls','agent_research_budget','application_assessments','admin_audit'].map(async table=>(await db.prepare('SELECT * FROM '+table).all()).results));
   const before=await preserved(),path='/api/admin/application-evaluation/case?id=graduate-year';
   assert.equal((await mf.dispatchFetch(origin+path)).status,403);
   for(let repeat=0;repeat<2;repeat++){
    const response=await mf.dispatchFetch(origin+path,{headers:{Cookie:cookie}});assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.steps.length,2);assert.doesNotMatch(JSON.stringify(data),/PRIVATE_RAW_SENTINEL/);
    for(const step of data.steps){assert.equal(step.state,'rejected');assert.equal(step.assessment_target,null);assert.equal(step.diagnostic.code,'invalid_json');assert.equal(step.diagnostic.method,'archived_response_recheck_v1');assert.equal(step.diagnostic.contract.id,manifest.id);}
    readings.push(data.steps.map(s=>s.diagnostic));
   }
   assert.deepEqual(await preserved(),before);assert.equal(outbound,0);
  }finally{await mf.dispose();}
 }
 for(const reading of readings)assert.deepEqual(reading,readings[0]);
});
