// Local-only fictional desk. No provider/model I/O. Drops one save acknowledgement after commit.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from '../research-db.mjs';
import {createBrief,decideBrief,marketingAPI,destinations} from '../../worker/marketing.js';
const cleanups=[],env=database({after:f=>cleanups.push(f)}),root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-schedule-ui-'));
const origin='http://127.0.0.1:5202';env.APP_ORIGIN=origin;
const now=Date.now(),iso=n=>new Date(n).toISOString();
const b=await createBrief(env,{topic_key:'fictional-receipt',destination:'facebook-company',title:'Fictional shortlist guide',purpose:'Test a receipt against the reviewed copy without creating an external post.',text:'This is fictional copy for local browser validation. No real marketing post is created.',sources:[{title:'Fictional source',url:'https://sponsorintel.london/guides/build-a-shortlist',excerpt:'Fictional source evidence for a local receipt only. No external source fetch.',checked_at:iso(now)}],expires_at:iso(now+3*86400000)},'fictional-writer',now);
await decideBrief(env,{id:b.id,revision:1,kind:'reviewed',request_key:'fictional-review',note:'Fictional independent review recorded only for local UI validation.',checks:{claims:true,sources:true,destination:true,duplication:true}},'fictional-reviewer',now);
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingDesk} from './src/marketing-desk';import './src/business-operations.css';createRoot(document.getElementById('root')).render(<MarketingDesk/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const requests=[];let drop=true;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,origin),path=url.pathname;
  if(path==='/evidence'){
   res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({requests:requests.length,identical:requests.length===2&&requests[0]===requests[1],receipts:env.sql.prepare('SELECT version,state,scheduled_at,observed_at,evidence,external_id FROM marketing_receipts').all(),events:env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='scheduled'").get().n}));
  }
  if(path.startsWith('/api/admin/marketing')){
   if(path.endsWith('/agents')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({enabled:false,business_enabled:false,models:{writer:{model:'fictional'},reviewer:{model:'fictional'}},budget:{runs:0,calls:0,run_limit:4,call_limit:32},runs:[],steps:[]}));}
   if(path.endsWith('/performance')){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({items:[],destinations,limit:'Fictional local QA only.'}));}
   if(req.method==='POST'&&!path.endsWith('/decide')){res.writeHead(403,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Only fictional receipt decisions are enabled.'}));}
   let text='';for await(const chunk of req)text+=chunk;
   const response=await marketingAPI(new Request(url,{method:req.method,headers:req.headers,...(text?{body:text}:{})}),env,{user:{id:'fictional-owner'}});
   if(req.method==='POST'){requests.push(text);if(response.ok&&drop){drop=false;res.writeHead(502,{'Content-Type':'text/plain'});res.end('Fictional gateway lost the acknowledgement after commit');return;}}
   res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());
  }
  if(['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,path.slice(1))));}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fictional schedule receipt QA</title><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;margin:0;padding:16px;background:#f7f9f3;color:#263d29}main{max-width:1000px;margin:auto}button{font:inherit;padding:10px;cursor:pointer}.fixture{padding:14px;background:#ffe9c4}h1{font-size:24px}</style><main><p class="fixture">FICTIONAL LOCAL QA · First save acknowledgement is deliberately lost. No external post.</p><div id="root"></div><p><a href="/evidence">Inspect fictional receipt evidence</a></p></main><script src="/app.js"></script></html>');
 }catch(e){res.writeHead(500);res.end('Fictional fixture error');console.error(e);}
});
server.listen(5202,'127.0.0.1',()=>console.log('Fictional schedule receipt QA: '+origin));
process.on('SIGINT',async()=>{server.close();for(const f of cleanups)f();await rm(dir,{recursive:true,force:true});process.exit(0);});
