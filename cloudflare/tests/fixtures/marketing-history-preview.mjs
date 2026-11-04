// Fictional local preview. Read-only history API, no credentials or provider I/O.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from '../research-db.mjs';
import {marketingAgentHistory} from '../../worker/marketing-agents.js';
const cleanups=[],env=database({after:f=>cleanups.push(f)}),root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-history-ui-'));
for(let n=0;n<23;n++){
 const stamp=new Date(Date.UTC(2026,9,13-n)).toISOString(),day=stamp.slice(0,10),id='marketing-'+day,state=n===0?'no_post':'held';
 env.sql.prepare('INSERT INTO marketing_agent_runs(id,day,state,created_at,finished_at,policy,models,context,result,calls) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,day,state,stamp,stamp,'fictional-policy-'+day,JSON.stringify({writer:{provider:'cloudflare',model:'fictional-writer-'+day},reviewer:{provider:'cloudflare',model:'fictional-critic-'+day}}),JSON.stringify({observed_at:stamp,sources:[{facts:['Fictional source for '+day]}],measurement:{completed_days:n===0?1:0,evidence_checks:n===0?0:null},performance:{items:[],limitation:'No observed growth'}}),JSON.stringify({reason:n===0?'Fictional newest run has no eligible slot.':'Fictional historical attempt held; no automatic retry.'}),n===0?0:1);
 if(n)env.sql.prepare("INSERT INTO marketing_agent_steps(run_id,name,role,state,created_at,output,usage) VALUES(?,'plan','writer','failed',?,?,?)").run(id,stamp,JSON.stringify(n===1?{failure:'Fictional legacy failure without diagnostics.'}:{failure:'Fictional incomplete result.',failure_stage:'incomplete_response',completion:{finish_reason:'length'}}),n===1?null:JSON.stringify({total_tokens:100}));
}
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingAgentHistory} from './src/marketing-agent-history';import './src/marketing-desk.css';createRoot(document.getElementById('root')).render(<MarketingAgentHistory/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5201');
  if(url.pathname==='/api/admin/marketing/agents/history'){
   if(req.method!=='GET'){res.writeHead(405);return res.end();}
   // Deliberately return this old selection late to exercise stale-response handling.
   if(url.searchParams.get('id')==='marketing-2026-10-12')await new Promise(resolve=>setTimeout(resolve,1400));
   const r=await marketingAgentHistory(new Request(url),env);res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());
  }
  if(['/app.js','/app.css'].includes(url.pathname)){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,url.pathname.slice(1))));}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fictional local editorial history</title><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;margin:0;padding:16px;color:#25382b;background:#fafbf6}main{max-width:900px;margin:auto}button{font:inherit}button,summary{cursor:pointer}.fixture{padding:14px;background:#ffe9c4}h1{font-size:24px}</style><main><p class="fixture">FICTIONAL LOCAL QA · No real model, customer data or external post.</p><h1>Editorial attempt history</h1><div id="root"></div></main><script src="/app.js"></script></html>');
 }catch(e){res.writeHead(500);res.end('Fictional fixture error');console.error(e);}
});
server.listen(5201,'127.0.0.1',()=>console.log('Fictional local history: http://127.0.0.1:5201'));
process.on('SIGINT',async()=>{server.close();for(const f of cleanups)f();await rm(dir,{recursive:true,force:true});process.exit(0);});
