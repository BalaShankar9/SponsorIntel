// Actual owner component and source-control API with disposable fictional D1-compatible storage.
// Loopback only; no credentials, customer data, source fetch or model call.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceDatabase} from '../helpers/source-d1.mjs';
import {agentOperationsAPI} from '../../worker/agent-api.js';
import {BOARDS} from '../../worker/job-sources.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-source-controls-')),callbacks=[];
const env=sourceDatabase({after:fn=>callbacks.push(fn)}),owner={user:{id:'fictional-owner'}},source=BOARDS[0].id,requests=[];
let dropped=false;
const act=body=>agentOperationsAPI(new Request('https://sponsorintel.london/api/admin/agents/source',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify(body)}),env,owner);
await act({source_id:source,paused:true,reason:'Fictional earlier evidence needs review.',expected_revision:0,request_key:crypto.randomUUID()});
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {AgentOperations} from './src/agent-operations';import './src/styles.css';import './src/career.css';import './src/platform.css';createRoot(document.getElementById('root')).render(<AgentOperations/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://127.0.0.1:5204'),json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(url.pathname==='/api/admin/agents'&&req.method==='GET'){
  const result=await(await agentOperationsAPI(new Request('https://sponsorintel.london/api/admin/agents'),env,owner)).json();
  result.sources=result.sources.filter(s=>s.id===source).map(s=>({...s,company:'Fictional employer — local test'}));
  return json(200,result);
 }
 if(url.pathname==='/api/admin/agents/source'&&req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),r=await act(body),data=await r.json();requests.push({body,status:r.status,result:data});
  if(r.ok&&!body.paused&&!dropped){dropped=true;return json(503,{error:'Fictional connection interrupted after saving. Retry the same change to retrieve its receipt.'});}
  return json(r.status,data);
 }
 if(url.pathname==='/fictional/race'&&req.method==='POST'){
  const c=env.sql.prepare('SELECT control_revision FROM agent_source_controls WHERE source_id=?').get(source);
  const r=await act({source_id:source,paused:true,reason:'Fictional newer owner hold: identity conflict remains unresolved.',expected_revision:c.control_revision,request_key:crypto.randomUUID()});
  return json(r.status,{message:'A newer fictional owner pause was saved.'});
 }
 if(url.pathname==='/receipt')return json(200,{requests,reviews:env.sql.prepare('SELECT revision,paused,reason FROM source_control_reviews ORDER BY revision').all(),audit:env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,external_calls:0});
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/fictional/'))return json(405,{error:'Unrelated actions are unavailable in this fixture.'});
 if(['/app.js','/app.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/css');return res.end(await readFile(join(dir,url.pathname.slice(1))));}
 res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','no-store');
 if(url.pathname==='/mobile')return res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>390px source-control preview</title><body style="margin:16px;background:#ecefeb"><p>Fictional source controls · 390px frame</p><iframe title="390px source controls" src="/" style="width:390px;height:1250px;border:0;display:block"></iframe></body></html>');
 if(url.pathname!=='/'){res.writeHead(404);return res.end();}
 res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional source-control QA</title><link rel="stylesheet" href="/app.css"><main style="max-width:1080px;margin:auto;padding:16px"><h1>Fictional source-control QA</h1><p>Local test records only. No real source or provider action.</p><button id="race">Simulate a newer owner pause</button><p id="race-status"></p><div id="root"></div></main><script>document.getElementById("race").onclick=async()=>{const r=await fetch("/fictional/race",{method:"POST"});document.getElementById("race-status").textContent=(await r.json()).message;};</script><script src="/app.js"></script></html>');
 }catch(error){res.writeHead(500);res.end('Fictional fixture failed');console.error(error);}
});
server.listen(5204,'127.0.0.1',()=>console.log('Fictional source controls: http://127.0.0.1:5204'));
process.on('SIGINT',async()=>{server.close();for(const fn of callbacks)fn();await rm(dir,{recursive:true,force:true});process.exit(0);});
