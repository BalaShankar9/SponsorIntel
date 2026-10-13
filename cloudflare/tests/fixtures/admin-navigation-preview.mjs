// Actual owner components, fictional aggregates, local reads only. No credentials or production requests.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-admin-navigation-'));
const now=new Date().toISOString(),requests=[];
const dashboard={measured_at:now,measurement:{enabled_at:now},metrics:[{event:'page_view',count:32,day:now.slice(0,10),dimension:'/jobs'}],users:{members:8,new_users:2,active_sessions:3,total:1,items:[{id:'fictional',name:'Fictional reviewer',email:'owner@example.test',emailVerified:true,createdAt:now,last_session:now,workspace_updated:null}]},jobs:{total:124,sponsorship:12},metadata:{register:{checked_at:now},students:{snapshot:true,last_success:now,total:42,source_date:now.slice(0,10)}},job_sources:[],immigration_sources:[],runs:[],boards:[]};
dashboard.campaigns={first_recorded:now,items:[{id:'fictional-campaign',label:'A fictional campaign with a deliberately detailed name',page_view:1234,account_created:2,document_prepared:1,guidance_answer:0}]};
const business={settings:{enabled:1,publishing:1,research:0,discovery:1},heartbeat:'current',schedule:'Fictional hourly schedule',runs:[{id:'fictional-run',state:'attention',created_at:now,finished_at:now,trigger_kind:'scheduled',snapshot:{measurement:{version:2,completed_days:2},metrics:[]},result:null}],issues:[{id:'normal',category:'quality',severity:'normal',title:'Fictional quality review',detail:'Private fictional output needs assessment.',next_action:'Open AI quality.'},{id:'high',category:'sources',severity:'high',title:'Fictional source needs review',detail:'Retained fictional advert has conflicting dates.',next_action:'Keep its hold until original evidence is checked.'}],outbox:[],publications:[]};
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {OwnerDashboard} from './src/owner';import './src/styles.css';import './src/career.css';createRoot(document.getElementById('root')).render(<OwnerDashboard go={()=>{}}/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent',plugins:[{name:'fictional-owner',setup(b){b.onResolve({filter:/^\.\/career-data$/},()=>({path:'fictional-owner',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const useCareer=()=>({user:{id:"fictional-owner"},ready:true});',loader:'js'}));}}]});
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5203');
 if(url.pathname.startsWith('/api/')){
  requests.push({method:req.method,path:url.pathname});
  res.setHeader('Content-Type','application/json');
  if(req.method!=='GET'){res.writeHead(405);return res.end(JSON.stringify({error:'Fictional QA rejects all writes.'}));}
  const data=url.pathname==='/api/admin/dashboard'?dashboard:url.pathname==='/api/admin/business'?business:null;
  res.writeHead(data?200:503);return res.end(JSON.stringify(data||{error:'Fictional fixture: this service is deliberately unavailable.'}));
 }
 if(url.pathname==='/receipt'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(requests));}
 if(['/app.js','/app.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/css');return res.end(await readFile(join(dir,url.pathname.slice(1))));}
 if(url.pathname!=='/'){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional admin navigation QA</title><link rel="stylesheet" href="/app.css"><main style="max-width:1050px;margin:auto;padding:24px"><div id="root"></div></main><script src="/app.js"></script></html>');
});
server.listen(5203,'127.0.0.1',()=>console.log('Fictional admin QA: http://127.0.0.1:5203'));
process.on('SIGINT',async()=>{server.close();await rm(dir,{recursive:true,force:true});process.exit(0);});
