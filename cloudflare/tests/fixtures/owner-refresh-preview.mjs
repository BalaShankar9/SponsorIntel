// Real owner components, fictional data, loopback only. No credentials or provider calls.
// Scenarios: normal, dashboard-error, review-error, denied, denied-html, race.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-owner-refresh-'));
const now=new Date().toISOString(),sessions=new Map();
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {OwnerDashboard} from './src/owner';import './src/styles.css';import './src/career.css';createRoot(document.getElementById('root')).render(<OwnerDashboard go={()=>{}}/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent',plugins:[{name:'fictional-owner',setup(b){b.onResolve({filter:/^\.\/career-data$/},()=>({path:'fictional-owner',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const useCareer=()=>({user:{id:"fictional-owner"},ready:true});',loader:'js'}));}}]});
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5204'),referer=new URL(req.headers.referer||url.origin),scenario=referer.searchParams.get('scenario')||url.searchParams.get('scenario')||'normal';
  if(!sessions.has(scenario))sessions.set(scenario,{requests:[],dashboard:0,reviews:0,discovery:0});
  const state=sessions.get(scenario);
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname.startsWith('/api/')){
   state.requests.push({method:req.method,path:url.pathname,query:url.search});
   if(req.method!=='GET')return json(405,{error:'Fictional fixture rejects all writes.'});
   if(url.pathname==='/api/admin/dashboard'){
    const n=++state.dashboard;
    if(n===2&&scenario==='denied-html'){res.writeHead(401,{'Content-Type':'text/html'});return res.end('Fictional signed-out response.');}
    if(n===2&&['dashboard-error','denied'].includes(scenario))return json(scenario==='denied'?403:503,{error:scenario==='denied'?'Fictional owner access denied.':'Fictional temporary dashboard error.'});
    return json(200,{measured_at:now,measurement:{enabled_at:now},metrics:[],users:{members:0,new_users:0,active_sessions:0,total:0,items:[]},jobs:{total:120+n,sponsorship:12},metadata:{register:{checked_at:now},students:{snapshot:true,last_success:now,total:0}},job_sources:[],immigration_sources:[],runs:[],boards:[]});
   }
   if(url.pathname==='/api/admin/job-reviews'){
    const n=++state.reviews;
    if(n===2&&scenario==='review-error')return json(503,{error:'Fictional temporary advert-list error.'});
    if(n===2&&scenario==='race')await new Promise(resolve=>setTimeout(resolve,2500));
    return json(200,{page:Number(url.searchParams.get('page')||1),summary:{total:n,held:n,overdue:0},sources:[{id:'old-source',company:'Fictional original employer'},...(n>1?[{id:'new-source',company:'Fictional newly configured school'}]:[])],items:[]});
   }
   if(url.pathname==='/api/admin/discovery'){
    const n=++state.discovery;
    return json(200,{summary:{total:n,unresolved:n,overdue:0,changed_links:0,current_linked_jobs:0},page:1,total:0,leads:[]});
   }
   return json(503,{error:'Unrelated fictional service is unavailable.'});
  }
  if(url.pathname==='/receipt')return json(200,Object.fromEntries(sessions));
  if(['/app.js','/app.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/css');return res.end(await readFile(join(dir,url.pathname.slice(1))));}
  if(url.pathname!=='/'){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional owner refresh QA</title><link rel="stylesheet" href="/app.css"><main style="max-width:1050px;margin:auto;padding:24px"><h1>Fictional owner refresh QA</h1><p>Local records only. All writes rejected.</p><div id="root"></div></main><script src="/app.js"></script></html>');
 }catch(error){res.writeHead(500);res.end('Local fixture failed');console.error(error);}
});
server.listen(5204,'127.0.0.1',()=>console.log('Fictional refresh QA: http://127.0.0.1:5204/?scenario=normal#admin-jobs'));
process.on('SIGINT',async()=>{server.close();await rm(dir,{recursive:true,force:true});process.exit(0);});
