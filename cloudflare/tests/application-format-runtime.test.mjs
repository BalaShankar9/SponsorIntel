import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('actual Worker retains the CV restriction across replay with zero model calls or budget changes',{timeout:30000},async()=>{
  const bundle=await build({stdin:{contents:`import {careerAPI} from './worker/career.js';let calls=0;export default {async fetch(request,env){const response=await careerAPI(request,{...env,AI:{run(){calls++;throw Error('No model expected');}}});response.headers.set('X-Local-Model-Calls',String(calls));return response;}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'application-format-isolated'},outboundService:()=>{assert.fail('No external service permitted');}}));
  try{
    const db=await mf.getD1Database('DB');
    await db.prepare('CREATE TABLE ai_usage(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER)').run();
    await db.prepare("INSERT INTO ai_usage VALUES('earlier-fictional-reservation',3,9999999999999)").run();
    const before=await db.prepare('SELECT * FROM ai_usage').all();
    const body={kind:'cv',consent:true,profile:{name:'Fictional Local Applicant',cv:'Fictional teacher with a degree and QTS. Taught English in a fictional school, with communication and lesson planning evidence. No real person.'},application:{id:'fictional-role',title:'Fictional Teacher',company:'Fictional School',description:'Fictional school: degree and QTS required. Complete the employer application form. CVs will not be accepted for this application.'}};
    for(let i=0;i<2;i++){
      const r=await mf.dispatchFetch('http://localhost/api/career/generate',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify(body)});
      assert.equal(r.status,409);assert.equal(r.headers.get('X-Local-Model-Calls'),'0');assert.match((await r.json()).error,/requested format/);
    }
    const evidence=await mf.dispatchFetch('http://localhost/api/career/generate',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({...body,kind:'analysis',consent:false})});
    assert.equal(evidence.status,200);assert.equal(evidence.headers.get('X-Local-Model-Calls'),'0');assert.match((await evidence.json()).text,/APPLICATION FORMAT/);
    assert.deepEqual((await db.prepare('SELECT * FROM ai_usage').all()).results,before.results);
  }finally{await mf.dispose();}
});
