// Fictional, loopback-only UI fixture. Uses the real ledger functions and an isolated SQLite database.
// No publishing provider, model service, production account or production database is connected.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from '../research-db.mjs';
import {createBrief,decideBrief,marketingAPI,destinations} from '../../worker/marketing.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const iso=value=>new Date(value).toISOString();
const scenarios=new Set(['proposed','reviewed','scheduled']);
const modes=new Set(['normal','drop-once','drop-omit-once','drop-403-once','drop-429-once','refresh-fail-once','delay-once','self-review-rejection']);
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req,max=20000){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>max)throw Error('Fixture request exceeds its bound.');}return text;}

export async function startMarketingDecisionPreview({port=0}={}){
 const directory=await mkdtemp(join(tmpdir(),'si-marketing-decision-ui-'));
 let env,cleanups=[],origin='',current=null,requests=[],gets=0,failedGets=0,omittedGets=0,failNextGet=false,omitNextGet=false,mode='normal',faultUsed=false,releasePending=null;
 const externalRequests=[],fixtureErrors=[];
 const originalFetch=globalThis.fetch;
 // Any unexpected server-side provider call fails visibly. The test controller uses this exact loopback origin only.
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.origin!==origin){externalRequests.push(url.href);throw Error('External requests are forbidden in this fictional fixture.');}
  return originalFetch(input,init);
 };
 async function reset(input){
  if(!input||Object.keys(input).some(k=>!['scenario','mode'].includes(k))||!scenarios.has(input.scenario)||!modes.has(input.mode))throw Error('Use an allowlisted fictional scenario and fault mode.');
  if(releasePending)throw Error('Release the in-flight fictional acknowledgement before resetting.');
  for(const cleanup of cleanups)cleanup();cleanups=[];
  env=database({after:fn=>cleanups.push(fn)});env.APP_ORIGIN=origin;
  requests=[];gets=0;failedGets=0;omittedGets=0;failNextGet=false;omitNextGet=false;faultUsed=false;mode=input.mode;
  const now=Date.now(),note='Fictional review of exact copy, source, account and duplicate state. No external post exists.';
  const brief=await createBrief(env,{topic_key:'fictional-decision-recovery',destination:'facebook-company',title:'Fictional decision recovery guide',purpose:'Verify a local editorial decision and delivery receipt without contacting any provider.',text:'This fictional guide exists only for local recovery testing. No real marketing post is created or published.',sources:[{title:'Fictional retained source',url:'https://sponsorintel.london/guides/build-a-shortlist',excerpt:'Fictional source evidence retained only in this local database; no source page is fetched.',checked_at:iso(now-10000)}],expires_at:iso(now+3*86400000)},mode==='self-review-rejection'?'owner:fictional-owner':'fictional-writer',now);
  if(input.scenario!=='proposed')await decideBrief(env,{id:brief.id,revision:1,kind:'reviewed',request_key:'fixture-seed-review',note,checks:{claims:true,sources:true,destination:true,duplication:true}},'fictional-reviewer',now);
  if(input.scenario==='scheduled')await decideBrief(env,{id:brief.id,revision:2,kind:'scheduled',request_key:'fixture-seed-schedule',note,receipt:{account:destinations['facebook-company'].account,provider:'metricool',external_id:'fictional-existing-provider-job',observed_at:iso(now-1000),scheduled_at:iso(now+86400000),evidence:note}},'fictional-schedule-observer',now);
  current={id:brief.id,scenario:input.scenario,mode,seeded_at:iso(now),initial_events:env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n,initial_receipts:env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n};
  return current;
 }
 function evidence(){return {...current,gets,failed_gets:failedGets,omitted_gets:omittedGets,requests,brief:env.sql.prepare('SELECT id,state,revision,version FROM marketing_briefs WHERE id=?').get(current.id),events:env.sql.prepare('SELECT revision,kind,request_key,request_hash,detail,created_at FROM marketing_events ORDER BY revision').all(),receipts:env.sql.prepare('SELECT version,state,scheduled_at,observed_at,evidence,external_id,post_url FROM marketing_receipts ORDER BY rowid').all(),external_requests:externalRequests,fixture_errors:fixtureErrors};}
 const server=createServer(async(req,res)=>{
  try{
   if(!origin||req.headers.host!==new URL(origin).host)return json(res,{error:'Loopback fixture only.'},403);
   const url=new URL(req.url,origin),path=url.pathname;
   if(path.startsWith('/__qa/')){
    if(req.method==='GET'&&path==='/__qa/evidence')return json(res,evidence());
    if(req.method!=='POST'||req.headers.origin!==origin)return json(res,{error:'Local fixture control requires its exact origin.'},403);
    const text=await body(req,1000),input=text?JSON.parse(text):{};
    if(path==='/__qa/reset')return json(res,await reset(input));
    if(path==='/__qa/release'&&Object.keys(input).length===0){const pending=releasePending;releasePending=null;pending?.();return json(res,{released:!!pending});}
    if(path==='/__qa/revise-reviewed'&&Object.keys(input).length===0){
     const brief=env.sql.prepare('SELECT b.*,v.purpose,v.text,v.sources,v.expires_at FROM marketing_briefs b JOIN marketing_versions v ON v.brief_id=b.id AND v.version=b.version WHERE b.id=?').get(current.id);
     if(brief.state!=='reviewed'||releasePending)throw Error('Only an idle reviewed fictional brief can be revised.');
     const now=Date.now(),content={purpose:brief.purpose,text:brief.text+' This is a new fictional version.',sources:JSON.parse(brief.sources),expires_at:brief.expires_at};
     await decideBrief(env,{id:brief.id,revision:brief.revision,kind:'revise',request_key:'fixture-new-version',note:'Fictional changed content for a schedule-reset regression.',content},'fictional-writer',now);
     await decideBrief(env,{id:brief.id,revision:brief.revision+1,kind:'reviewed',request_key:'fixture-new-version-review',note:'Fictional independent review of the new complete version.',checks:{claims:true,sources:true,destination:true,duplication:true}},'fictional-reviewer',now);
     return json(res,{version:brief.version+1});
    }
    if(path==='/__qa/newer-uncertain'&&Object.keys(input).length===0){
     const brief=env.sql.prepare('SELECT id,revision,state FROM marketing_briefs WHERE id=?').get(current.id);
     if(brief.state!=='uncertain'||releasePending)throw Error('A newer fictional observation requires an uncertain brief.');
     const now=Date.now(),note='A second fictional observer retained a newer uncertain provider reference. No external job was changed.';
     await decideBrief(env,{id:brief.id,revision:brief.revision,kind:'uncertain',request_key:'fixture-newer-uncertain',note,receipt:{account:destinations['facebook-company'].account,provider:'metricool',external_id:'fictional-newer-reconciled-job',observed_at:iso(now),evidence:note}},'fictional-second-observer',now);
     return json(res,{external_id:'fictional-newer-reconciled-job'});
    }
    return json(res,{error:'Unknown fixture control.'},404);
   }
   if(path.startsWith('/api/admin/marketing')){
    if(req.method==='GET'&&path.endsWith('/agents'))return json(res,{enabled:false,business_enabled:false,models:{writer:{model:'fictional'},reviewer:{model:'fictional'}},budget:{runs:0,calls:0,run_limit:4,call_limit:32},runs:[],steps:[]});
    if(req.method==='GET'&&path.endsWith('/performance'))return json(res,{items:[],destinations,limit:'Fictional local QA only.'});
    if(!((req.method==='GET'&&path==='/api/admin/marketing')||(req.method==='POST'&&path==='/api/admin/marketing/decide')))return json(res,{error:'This fixture allows ledger reads and fictional decisions only.'},403);
    if(req.method==='GET'){
     gets++;
     if(failNextGet){failNextGet=false;failedGets++;return json(res,{error:'Fictional desk read failed after the decision was acknowledged.'},503);}
    }
    const text=await body(req),entry=req.method==='POST'?{body:text,received_at:iso(Date.now()),status:null,acknowledgement:'waiting'}:null;
    if(entry)requests.push(entry);
    if(entry&&requests.length===2&&['drop-403-once','drop-429-once'].includes(mode)){
     entry.status=mode==='drop-403-once'?403:429;entry.response={error:'Fictional retry access or rate-limit rejection; the earlier outcome is unchanged.'};entry.acknowledgement='delivered';return json(res,entry.response,entry.status);
    }
    const response=await marketingAPI(new Request(url,{method:req.method,headers:req.headers,...(text?{body:text}:{})}),env,{user:{id:'fictional-owner'}});
    let responseText=await response.text();
    if(req.method==='GET'&&response.ok&&omitNextGet){omitNextGet=false;omittedGets++;const snapshot=JSON.parse(responseText);snapshot.items=[];responseText=JSON.stringify(snapshot);}
    if(entry){
     entry.status=response.status;entry.response=JSON.parse(responseText);
     if(response.ok&&!faultUsed){
      faultUsed=true;
      // A gateway substitutes an unreadable acknowledgement after commit. A bare socket
      // reset is unsuitable here: Chrome can transparently repeat that HTTP request.
      if(['drop-once','drop-omit-once','drop-403-once','drop-429-once'].includes(mode)){omitNextGet=mode==='drop-omit-once';entry.acknowledgement='dropped-after-commit';res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Fictional gateway lost the ledger acknowledgement after commit.');return;}
      if(mode==='refresh-fail-once')failNextGet=true;
      if(mode==='delay-once')await new Promise(resolveGate=>{
       const timeout=setTimeout(()=>{releasePending=null;resolveGate();},10000);
       releasePending=()=>{clearTimeout(timeout);resolveGate();};
      });
     }
     entry.acknowledgement='delivered';
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(responseText);
   }
   if(req.method==='GET'&&['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css','Cache-Control':'no-store'});return res.end(await readFile(join(directory,path.slice(1))));}
   if(req.method!=='GET'||path!=='/')return json(res,{error:'Unknown fictional fixture route.'},404);
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fictional marketing decision recovery QA</title><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;margin:0;padding:16px;background:#f7f9f3;color:#263d29}main{max-width:1000px;margin:auto}button{font:inherit;padding:10px;cursor:pointer}.fixture{padding:14px;background:#ffe9c4}</style></head><body><main><p class="fixture">FICTIONAL LOCAL QA · No provider, real post or production account is connected.</p><div id="root"></div></main><script src="/app.js"></script></body></html>');
  }catch(error){fixtureErrors.push(error.message);if(!res.headersSent)json(res,{error:'Fictional fixture error.'},500);else res.destroy();}
 });
 try{
  await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingDesk} from './src/marketing-desk';import './src/business-operations.css';createRoot(document.getElementById('root')).render(<MarketingDesk/>);",loader:'tsx',resolveDir:root},bundle:true,outfile:join(directory,'app.js'),logLevel:'silent'});
  await new Promise((resolveListen,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolveListen);});
  origin='http://127.0.0.1:'+server.address().port;
  await reset({scenario:'proposed',mode:'normal'});
 }catch(error){globalThis.fetch=originalFetch;for(const cleanup of cleanups)cleanup();server.close();await rm(directory,{recursive:true,force:true});throw error;}
 return {origin,directory,async close(){releasePending?.();releasePending=null;server.closeAllConnections();await new Promise(resolveClose=>server.close(resolveClose));for(const cleanup of cleanups)cleanup();globalThis.fetch=originalFetch;await rm(directory,{recursive:true,force:true});}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const fixture=await startMarketingDecisionPreview({port:5203});
 console.log('Fictional marketing decision recovery QA: '+fixture.origin);
 const close=async()=>{await fixture.close();process.exit(0);};
 process.once('SIGINT',close);process.once('SIGTERM',close);
}
