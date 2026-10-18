import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('actual Worker guards saved roles, retains reservations during races and keeps private work untouched', {timeout:30000}, async()=>{
  const bundle=await build({stdin:{contents:`import {careerAPI} from './worker/career.js';
    export default {async fetch(request,env){let calls=0;
      const response=await careerAPI(request,{...env,AI:{async run(){calls++;
        if(calls===Number(request.headers.get('X-Fictional-Hold-Stage'))){
          await env.DB.prepare("UPDATE jobs SET active=0 WHERE id=?").bind('a'.repeat(24)).run();
          await env.DB.prepare("INSERT INTO job_review_holds VALUES('fictional','https://example.test/role','held',?,'PRIVATE FICTIONAL REVIEW NOTE')").bind(new Date().toISOString()).run();
        }
        const text='Fictional Applicant\\nPrepared classroom lessons. Taught English at a fictional school. Used communication to explain lesson activities and answer student questions.';
        return {response:calls===1?text:JSON.stringify({text,checks:[{claim:'Prepared classroom lessons',source_ids:['C1']},{claim:'Taught English',source_ids:['C1']},{claim:'explain lesson activities',source_ids:['C1']}]})};
      }}});
      response.headers.set('X-Fictional-Model-Calls',String(calls));return response;
    }};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'saved-role-preparation-isolated'},outboundService:()=>assert.fail('No external service permitted')}));
  try {
    const db=await mf.getD1Database('DB');
    await db.exec("CREATE TABLE ai_usage(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER); CREATE TABLE jobs(id TEXT PRIMARY KEY,board_id TEXT,active INTEGER,last_seen TEXT,closes_at TEXT); CREATE TABLE job_review_holds(source_id TEXT,apply_url TEXT,state TEXT,recorded_at TEXT,notes TEXT); CREATE TABLE job_review_targets(source_id TEXT,apply_url TEXT,job_id TEXT); CREATE TABLE career_workspaces(user_id TEXT,data TEXT,revision INTEGER);");
    await db.prepare("INSERT INTO career_workspaces VALUES('fictional-owner','PRIVATE FICTIONAL SAVED DRAFT',7)").run();
    await db.prepare("INSERT INTO job_review_targets VALUES('fictional','https://example.test/role',?)").bind('a'.repeat(24)).run();
    const privateBefore=(await db.prepare('SELECT * FROM career_workspaces').all()).results;
    const body={kind:'cv',consent:true,profile:{name:'Fictional Applicant',cv:'Prepared classroom lessons. Taught English at a fictional school. Used communication to explain lesson activities and answer student questions.'},application:{id:'saved-fictional',jobId:'a'.repeat(24),title:'Fictional Teacher',company:'Fictional School',description:'Fictional advert. Prepare classroom lessons, teach English and communicate clearly with students. This is not a real vacancy.'}};
    const send=(data=body,stage=0)=>mf.dispatchFetch('http://localhost/api/career/generate',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json','X-Fictional-Hold-Stage':String(stage)},body:JSON.stringify(data)});
    const usage=async()=>(await db.prepare('SELECT * FROM ai_usage ORDER BY key').all()).results;
    async function current(){
      await db.prepare('DELETE FROM job_review_holds').run();
      await db.prepare("INSERT OR REPLACE INTO jobs VALUES(?,'fictional',1,?,NULL)").bind('a'.repeat(24),new Date(Date.now()-1000).toISOString()).run();
    }
    for (const state of ['held','awaiting_refresh','expired','removed','stale','missing']) {
      await current();
      if(['held','awaiting_refresh'].includes(state))await db.prepare("INSERT INTO job_review_holds VALUES('fictional','https://example.test/role',?,?,'PRIVATE FICTIONAL REVIEW NOTE')").bind(state==='held'?'held':'released',new Date().toISOString()).run();
      if(state==='expired')await db.prepare('UPDATE jobs SET closes_at=?').bind(new Date(Date.now()-1).toISOString()).run();
      if(state==='removed')await db.prepare('UPDATE jobs SET active=0').run();
      if(state==='stale')await db.prepare('UPDATE jobs SET last_seen=?').bind(new Date(Date.now()-4*86400000).toISOString()).run();
      if(state==='missing')await db.prepare('DELETE FROM jobs').run();
      const before=await usage();
      for(const kind of ['cv','coverLetter','analysis','interview','portfolio','learningPlan','companyResearch']) {
        const r=await send({...body,kind});
        assert.equal(r.status,409,state+' '+kind);assert.equal(r.headers.get('X-Fictional-Model-Calls'),'0');
        const result=await r.json();assert.equal(result.availability,state);assert.match(result.error,/existing documents remain editable/);assert.equal(result.text,undefined);
      }
      const status=await mf.dispatchFetch('http://localhost/api/career/availability?job='+'a'.repeat(24));
      assert.deepEqual(await status.json(),{jobId:'a'.repeat(24),state});
      assert.deepEqual(await usage(),before,'Blocked requests do not consume allowance');
    }
    await current();
    for(const holdStage of [1,2]) {
      await current(); const before=(await usage()).reduce((s,r)=>s+r.count,0);
      const r=await send(body,holdStage);
      assert.equal(r.status,409);assert.equal(r.headers.get('X-Fictional-Model-Calls'),String(holdStage));
      assert.equal((await r.json()).text,undefined);
      assert.equal((await usage()).reduce((s,r)=>s+r.count,0),before+3,'Started attempts retain every reservation');
    }
    await current();
    const accepted=await send();assert.equal(accepted.status,200);assert.equal(accepted.headers.get('X-Fictional-Model-Calls'),'2');assert.match((await accepted.json()).text,/Prepared classroom lessons/);
    // An old release no longer holds a later complete refresh.
    await db.prepare("INSERT INTO job_review_holds VALUES('fictional','https://example.test/role','released',?,'PRIVATE NOTE')").bind(new Date(Date.now()-10000).toISOString()).run();
    assert.equal((await send({...body,kind:'analysis'})).status,200);
    await db.exec('DROP TABLE jobs;');
    const before=await usage();const unavailable=await send();assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).availability,'unavailable');assert.deepEqual(await usage(),before);
    // A genuinely manual application has no catalogue identity to check.
    const manual=await send({...body,kind:'analysis',application:{...body.application,jobId:''}});assert.equal(manual.status,200);assert.equal(manual.headers.get('X-Fictional-Model-Calls'),'0');
    const invalid=await send({...body,application:{...body.application,jobId:'invalid'}});assert.equal(invalid.status,409);assert.equal((await invalid.json()).availability,'missing');
    assert.deepEqual((await db.prepare('SELECT * FROM career_workspaces').all()).results,privateBefore);
  } finally { await mf.dispose(); }
});
