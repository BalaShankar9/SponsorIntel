import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('real Worker/auth/D1 excludes signed-in owners and their first login, but counts fictional members and anonymous preparation', {timeout:60000}, async () => {
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import worker from './worker/index.js';
 export default { async fetch(request,env,ctx) {
   const pending=[];
   const response=await worker.fetch(request,env,{waitUntil(p){ctx.waitUntil(p);pending.push(p);}});
   await Promise.all(pending);
   return response;
 }};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',external:['cloudflare:*','node:*'],target:'es2022'});
 let outbound=0;
 const origin='http://127.0.0.1:8788';
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,
  d1Databases:{DB:'measurement-isolated'},bindings:{AUTH_SECRET:'fictional-local-test-secret-not-a-production-credential',APP_ORIGIN:origin},
  outboundService:async()=>{outbound++;throw Error('No external calls allowed in this isolated test');}
 }));
 try {
  const db=await mf.getD1Database('DB');
  // These fixed schema files have no triggers or embedded semicolons.
  for(const name of ['0001_initial','0002_career','0003_auth','0006_owner_analytics','0024_public_measurement']){
   const sql=await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8');
   for(const statement of sql.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(statement).run();
  }
  const post=(path,body,cookie='',extra={})=>mf.dispatchFetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-SI-Campaign':'fb-applications',Cookie:cookie,...extra},body:JSON.stringify(body)});
  const signup=async(name,email)=>{
   const r=await post('/api/auth/sign-up/email',{name,email,password:'Fictional-testing-237!'});
   assert.equal(r.status,200,await r.clone().text());
   const body=await r.json(),cookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
   assert.ok(cookie);return {id:body.user.id,cookie};
  };
  const owner=await signup('Fictional owner','owner@example.invalid');
  await db.prepare('INSERT INTO admin_members VALUES(?,?)').bind(owner.id,new Date().toISOString()).run();
  // Test-only baseline reset before assertions, in this disposable local D1.
  await db.prepare('DELETE FROM analytics_public_daily').run();
  const login=await post('/api/auth/sign-in/email',{email:'owner@example.invalid',password:'Fictional-testing-237!'});
  assert.equal(login.status,200);assert.ok((await login.json()).user.id);
  const page={page:'/jobs?email=PRIVATE_OWNER',campaign:'fb-applications'};
  assert.equal((await post('/api/metrics',page,owner.cookie)).status,200);
  const analysis={kind:'analysis',profile:{cv:'Fictional example candidate with Python and SQL skills. Built a fictional classroom reporting project using public example data.'},application:{id:'fictional-application',title:'Analyst',company:'Fictional employer',description:'Use Python and SQL to prepare research reports. This fictional job description is only for an isolated product test.'}};
  const ownerResult=await post('/api/career/generate',analysis,owner.cookie);
  assert.equal(ownerResult.status,200);assert.equal(ownerResult.headers.has('X-SI-Preparation-Kind'),false);assert.equal((await ownerResult.json()).kind,'analysis');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_public_daily').first()).n,0);
  const member=await signup('Fictional member','member@example.invalid');
  assert.equal((await post('/api/metrics',page,member.cookie)).status,200);
  assert.equal((await post('/api/metrics',page,'',{'X-SI-Metrics':'exclude'})).status,200);
  const result=await post('/api/career/generate',analysis);
  assert.equal(result.status,200);assert.ok((await result.json()).text);
  assert.equal((await post('/api/career/generate',{...analysis,kind:'cv',consent:true})).status,503);
  const rows=(await db.prepare('SELECT * FROM analytics_public_daily').all()).results;
  assert.equal(rows.find(r=>r.event==='account_created').count,1);
  assert.equal(rows.find(r=>r.event==='page_view').count,1);
  assert.equal(rows.find(r=>r.event==='preparation_completed').count,1);
  assert.equal(rows.find(r=>r.event==='campaign_preparation_completed').count,1);
  assert.equal(rows.find(r=>r.event==='document_prepared'),undefined);
  assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|Fictional|example.invalid|classroom/);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM analytics_daily').first()).n,0);
  assert.equal(outbound,0);
 } finally { await mf.dispose(); }
});
