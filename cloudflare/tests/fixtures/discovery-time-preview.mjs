// Local fictional browser regression; no production data or external services.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceDatabase} from '../helpers/source-d1.mjs';
import {saveDiscovery,discoveryAPI} from '../../worker/discovery.js';
const cleanup=[],env=sourceDatabase({after:f=>cleanup.push(f)}),now=Date.now();
await saveDiscovery(env,{id:null,revision:0,request_key:crypto.randomUUID(),source_kind:'employer',source_url:'https://employer.example/jobs/date-review',content:{title:'Fictional precision review',employer:'Fictional employer',location:'London',observed_at:'2026-10-19T15:43:14.127Z',posted_at:null,posted_evidence:'',deadline:null,deadline_evidence:'',original_url:'',identity_url:'',identity_note:'',quote:'',state:'held',reason:'Fictional source needs original-employer evidence; preserve this first decision.',follow_up_at:new Date(now+86400000).toISOString(),job_id:null,duplicate_of:null,method:'agent_assisted'}},'fictional-owner',now);
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-discovery-time-preview-'));
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DiscoveryDesk} from './src/discovery-desk';import './src/styles.css';createRoot(document.getElementById('root')).render(<DiscoveryDesk/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
let loseNext=false;const saves=[];
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5208');
  if(url.pathname==='/lose-next'&&req.method==='POST'){loseNext=true;res.writeHead(200);return res.end('Next save acknowledgement will be lost.');}
  if(url.pathname.startsWith('/api/admin/discovery')){
   let body='';for await(const part of req)body+=part;
   const request=new Request(url,{method:req.method,headers:{Origin:url.origin,'Content-Type':'application/json'},...(body?{body}:{})});
   const reply=await discoveryAPI(request,env,{user:{id:'fictional-owner'}}),text=await reply.text();
   if(req.method==='POST')saves.push({body:JSON.parse(body),status:reply.status,replayed:JSON.parse(text).replayed||false});
   if(req.method==='POST'&&reply.ok&&loseNext){loseNext=false;res.writeHead(502,{'Content-Type':'text/plain'});return res.end('Fictional lost acknowledgement');}
   res.writeHead(reply.status,Object.fromEntries(reply.headers));return res.end(text);
  }
  if(url.pathname==='/receipt'){
   const rows=env.sql.prepare('SELECT lead_id,revision,recorded_at,content FROM discovery_revisions ORDER BY recorded_at,revision').all().map(r=>({...r,content:JSON.parse(r.content)}));
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({rows,saves,audits:env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n},null,2));
  }
  if(['/app.js','/app.css'].includes(url.pathname)){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,url.pathname.slice(1))));}
  if(url.pathname!=='/'){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional discovery time QA</title><link rel="stylesheet" href="/app.css"><main style="padding:16px;max-width:900px;margin:auto"><h1>Fictional discovery time QA</h1><p>Local-only fictional records. No production or model calls.</p><button onclick="fetch(\'/lose-next\',{method:\'POST\'}).then(()=>this.textContent=\'Next save acknowledgement will be lost\')">Lose next save acknowledgement (fictional)</button><a href="/receipt">Inspect fictional saved dates</a><div id="root"></div></main><script src="/app.js"></script></html>');
 }catch(error){res.writeHead(500);res.end('Local fixture failed');console.error(error);}
});
server.listen(5208,'127.0.0.1',()=>console.log('Fictional discovery time QA: http://127.0.0.1:5208'));
process.on('SIGINT',async()=>{server.close();for(const f of cleanup)f();await rm(dir,{recursive:true,force:true});process.exit(0);});
