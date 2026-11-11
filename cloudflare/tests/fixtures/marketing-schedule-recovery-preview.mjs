// Actual MarketingDesk and ledger with fictional records, isolated SQLite and loopback-only I/O.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from '../research-db.mjs';
import {createBrief,decideBrief,marketingAPI,destinations} from '../../worker/marketing.js';
import registeredMedia from '../../shared/marketing-media.json' with {type:'json'};

const root=fileURLToPath(new URL('../../',import.meta.url)),iso=value=>new Date(value).toISOString();
const modes=new Set(['normal','drop-once','drop-omit-once','drop-403-once','drop-429-once','drop-before-once','refresh-fail-once','delay-once','initial-rejection']);
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req,max=20000){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>max)throw Error('Fixture body exceeds its bound.');}return text;}

export async function startMarketingScheduleRecoveryPreview({port=0}={}){
 const directory=await mkdtemp(join(tmpdir(),'si-schedule-recovery-ui-'));
 let env,cleanups=[],origin='',current=null,requests=[],gets=0,failedGets=0,omittedGets=0,failNextGet=false,omitNextGet=false,mode='normal',faultUsed=false,releasePending=null;
 const externalRequests=[],fixtureErrors=[],originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(url.origin!==origin){externalRequests.push(url.href);throw Error('No external requests in this fictional fixture.');}return originalFetch(input,init);};
 async function reset(input){
  if(!input||Object.keys(input).some(key=>!['mode','media'].includes(key))||!modes.has(input.mode)||(input.media!==undefined&&typeof input.media!=='boolean'))throw Error('Use an allowlisted fictional mode.');
  if(releasePending)throw Error('Release the pending fictional response before reset.');
  for(const cleanup of cleanups)cleanup();cleanups=[];env=database({after:fn=>cleanups.push(fn)});env.APP_ORIGIN=origin;
  requests=[];gets=0;failedGets=0;omittedGets=0;failNextGet=false;omitNextGet=false;faultUsed=false;mode=input.mode;
  const now=Date.now(),media=input.media?[{asset_id:registeredMedia[0].id,alt:'Registered Sponsor Intel artwork included only to test fictional local review attestations.'}]:[];
  const created=await createBrief(env,{topic_key:'fictional-schedule-recovery',destination:'facebook-company',title:'Fictional schedule recovery guide',purpose:'Check an existing fictional schedule receipt without any publishing provider action.',text:'This fictional local guide is used only to test recovery of an observed schedule receipt. No external post is created.',sources:[{title:'Fictional retained guide',url:'https://sponsorintel.london/guides/build-a-shortlist',excerpt:'Fictional source evidence stored only in an isolated test database. No external page is fetched.',checked_at:iso(now-10000)}],expires_at:iso(now+3*86400000),media},'fictional-writer',now);
  await decideBrief(env,{id:created.id,revision:1,kind:'reviewed',request_key:'fixture-reviewed',note:'Fictional independent review of the local copy, source, account and artwork where present.',checks:{claims:true,sources:true,destination:true,duplication:true,media:true}},'fictional-reviewer',now);
  current={id:created.id,mode,media:!!input.media,seeded_at:iso(now),initial_events:env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n,initial_receipts:0};return current;
 }
 function evidence(){return {...current,gets,failed_gets:failedGets,omitted_gets:omittedGets,requests,brief:env.sql.prepare('SELECT id,state,revision,version FROM marketing_briefs WHERE id=?').get(current.id),latest_media:JSON.parse(env.sql.prepare('SELECT m.assets FROM marketing_media_versions m JOIN marketing_briefs b ON b.id=m.brief_id AND b.version=m.version WHERE b.id=?').get(current.id).assets),events:env.sql.prepare('SELECT revision,kind,request_key,request_hash,detail,created_at FROM marketing_events ORDER BY revision').all(),receipts:env.sql.prepare('SELECT version,state,scheduled_at,observed_at,evidence,external_id,post_url FROM marketing_receipts ORDER BY rowid').all(),external_requests:externalRequests,fixture_errors:fixtureErrors};}
 const server=createServer(async(req,res)=>{
  try{
   if(!origin||req.headers.host!==new URL(origin).host)return json(res,{error:'Exact loopback fixture only.'},403);
   const url=new URL(req.url,origin),path=url.pathname;
   if(path.startsWith('/__qa/')){
    if(req.method==='GET'&&path==='/__qa/evidence')return json(res,evidence());
    if(req.method!=='POST'||req.headers.origin!==origin)return json(res,{error:'Local controls require the exact origin.'},403);
    const text=await body(req,1000),input=text?JSON.parse(text):{};
    if(path==='/__qa/reset')return json(res,await reset(input));
    if(path==='/__qa/release'&&!Object.keys(input).length){const pending=releasePending;releasePending=null;pending?.();return json(res,{released:!!pending});}
    if(path==='/__qa/revise-reviewed'&&(!Object.keys(input).length||(Object.keys(input).length===1&&input.remove_media===true))){
     const brief=env.sql.prepare('SELECT b.*,v.purpose,v.text,v.sources,v.expires_at FROM marketing_briefs b JOIN marketing_versions v ON v.brief_id=b.id AND v.version=b.version WHERE b.id=?').get(current.id);
     if(brief.state!=='reviewed'||releasePending)throw Error('Revision requires an idle reviewed fixture.');
     const assets=JSON.parse(env.sql.prepare('SELECT assets FROM marketing_media_versions WHERE brief_id=? AND version=?').get(brief.id,brief.version).assets);
     const now=Date.now(),content={purpose:brief.purpose,text:brief.text+' A second fictional version.',sources:JSON.parse(brief.sources),expires_at:brief.expires_at,media:input.remove_media?[]:assets.map(asset=>({asset_id:asset.id,alt:asset.alt}))};
     await decideBrief(env,{id:brief.id,revision:brief.revision,kind:'revise',request_key:'fixture-revised',note:'Fictional changed copy for the unsent schedule reset check.',content},'fictional-writer',now);
     await decideBrief(env,{id:brief.id,revision:brief.revision+1,kind:'reviewed',request_key:'fixture-rereviewed',note:'Fictional independent review of the revised complete copy and artwork.',checks:{claims:true,sources:true,destination:true,duplication:true,media:true}},'fictional-reviewer',now);
     return json(res,{version:brief.version+1});
    }
    if(path==='/__qa/newer-published'&&!Object.keys(input).length){
     const brief=env.sql.prepare('SELECT id,revision,state,version FROM marketing_briefs WHERE id=?').get(current.id),last=env.sql.prepare('SELECT external_id FROM marketing_receipts WHERE brief_id=? ORDER BY rowid DESC LIMIT 1').get(current.id);
     if(brief.state!=='scheduled'||releasePending)throw Error('A newer publication needs a committed fictional schedule.');
     const assets=JSON.parse(env.sql.prepare('SELECT assets FROM marketing_media_versions WHERE brief_id=? AND version=?').get(brief.id,brief.version).assets),now=Date.now();
     const note='Fictional later observer checked the existing job and its matching public result. No external service was contacted.';
     await decideBrief(env,{id:brief.id,revision:brief.revision,kind:'published',request_key:'fixture-later-publication',note,receipt:{account:destinations['facebook-company'].account,provider:'metricool',external_id:last.external_id,observed_at:iso(now),post_url:'https://www.facebook.com/fictional/posts/schedule-recovery-only',evidence:note,...(assets.length?{media_sha256:assets.map(asset=>asset.sha256)}:{})}},'fictional-later-observer',now);
     return json(res,{state:'published',evidence:note});
    }
    return json(res,{error:'Unknown fictional control.'},404);
   }
   if(path.startsWith('/api/admin/marketing')){
    if(req.method==='GET'&&path.endsWith('/agents'))return json(res,{enabled:false,business_enabled:false,models:{writer:{model:'fictional'},reviewer:{model:'fictional'}},budget:{runs:0,calls:0,run_limit:4,call_limit:32},runs:[],steps:[]});
    if(req.method==='GET'&&path.endsWith('/performance'))return json(res,{items:[],destinations,limit:'Fictional local QA only.'});
    if(!((req.method==='GET'&&path==='/api/admin/marketing')||(req.method==='POST'&&path==='/api/admin/marketing/decide')))return json(res,{error:'Only fictional decisions and reads are available.'},403);
    if(req.method==='GET'){gets++;if(failNextGet){failNextGet=false;failedGets++;return json(res,{error:'Fictional read failed after the acknowledged schedule save.'},503);}}
    const text=await body(req),entry=req.method==='POST'?{body:text,received_at:iso(Date.now()),status:null,acknowledgement:'waiting'}:null;if(entry)requests.push(entry);
    if(entry&&mode==='initial-rejection'&&requests.length===1){entry.status=403;entry.response={error:'Fictional initial access rejection; no decision was attempted.'};entry.acknowledgement='delivered';return json(res,entry.response,403);}
    if(entry&&mode==='drop-before-once'&&requests.length===1){entry.status=502;entry.response={fixture_only:'This request never reached the ledger, but the browser cannot establish that from its gateway response.'};entry.acknowledgement='unknown-before-ledger-dispatch';faultUsed=true;res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end('Fictional gateway cannot confirm the request outcome.');}
    if(entry&&requests.length===2&&['drop-403-once','drop-429-once'].includes(mode)){entry.status=mode==='drop-403-once'?403:429;entry.response={error:'Fictional later access or rate-limit rejection; the original save remains unresolved.'};entry.acknowledgement='delivered';return json(res,entry.response,entry.status);}
    const response=await marketingAPI(new Request(url,{method:req.method,headers:req.headers,...(text?{body:text}:{})}),env,{user:{id:'fictional-owner'}});let responseText=await response.text();
    if(req.method==='GET'&&response.ok&&omitNextGet){omitNextGet=false;omittedGets++;const snapshot=JSON.parse(responseText);snapshot.items=[];responseText=JSON.stringify(snapshot);}
    if(entry){entry.status=response.status;entry.response=JSON.parse(responseText);if(response.ok&&!faultUsed){
     faultUsed=true;
     if(['drop-once','drop-omit-once','drop-403-once','drop-429-once'].includes(mode)){omitNextGet=mode==='drop-omit-once';entry.acknowledgement='dropped-after-commit';res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});return res.end('Fictional gateway lost the committed schedule acknowledgement.');}
     if(mode==='refresh-fail-once')failNextGet=true;
     if(mode==='delay-once')await new Promise(done=>{const timeout=setTimeout(()=>{releasePending=null;done();},10000);releasePending=()=>{clearTimeout(timeout);done();};});
    }entry.acknowledgement='delivered';}
    res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(responseText);
   }
   const asset=registeredMedia.find(media=>new URL(media.url).pathname===path);
   if(req.method==='GET'&&asset){res.writeHead(200,{'Content-Type':asset.type});return res.end(await readFile(join(root,'public',path.slice(1))));}
   if(req.method==='GET'&&['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css','Cache-Control':'no-store'});return res.end(await readFile(join(directory,path.slice(1))));}
   if(req.method!=='GET'||path!=='/')return json(res,{error:'Unknown fictional route.'},404);
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fictional schedule recovery QA</title><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;margin:0;padding:16px;background:#f7f9f3;color:#263d29}main{max-width:1000px;margin:auto}button{font:inherit;padding:10px;cursor:pointer}.fixture{padding:14px;background:#ffe9c4}</style></head><body><main><p class="fixture">FICTIONAL LOCAL QA · Existing schedule observations only. No provider, post or production account is connected.</p><div id="root"></div></main><script src="/app.js"></script></body></html>');
  }catch(error){fixtureErrors.push(error.message);if(!res.headersSent)json(res,{error:'Fictional fixture error.'},500);else res.destroy();}
 });
 try{await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingDesk} from './src/marketing-desk';import './src/business-operations.css';createRoot(document.getElementById('root')).render(<MarketingDesk/>);",loader:'tsx',resolveDir:root},bundle:true,outfile:join(directory,'app.js'),logLevel:'silent'});await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});origin='http://127.0.0.1:'+server.address().port;await reset({mode:'normal'});}
 catch(error){globalThis.fetch=originalFetch;for(const cleanup of cleanups)cleanup();server.close();await rm(directory,{recursive:true,force:true});throw error;}
 return {origin,directory,async close(){releasePending?.();releasePending=null;server.closeAllConnections();await new Promise(done=>server.close(done));for(const cleanup of cleanups)cleanup();globalThis.fetch=originalFetch;await rm(directory,{recursive:true,force:true});}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const fixture=await startMarketingScheduleRecoveryPreview({port:5222});console.log('Fictional schedule recovery: '+fixture.origin);const close=async()=>{await fixture.close();process.exit(0);};process.once('SIGINT',close);process.once('SIGTERM',close);}
