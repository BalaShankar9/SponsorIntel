// Fictional browser QA. Actual component; no production binding or external request.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=await mkdtemp(join(tmpdir(),'si-app-control-'));
const snapshot={control:{enabled:false,revision:0,reason:'',updated_at:null},campaigns:{active:{id:'fictional-comparison',reason:'Fictional prepared comparison. Keep the original failed evidence.'},proposal:{fingerprint:'a'.repeat(64),can_prepare:false,reason:'This exact comparison version is already retained; it cannot be restarted.',change:'A bounded candidate schema with the same complete fictional source.'}},enabled:false,evaluation_enabled:false,business_enabled:true,pause_reason:'evaluation',progress_state:'ready',state:'paused',total:20,completed:0,scope:'Fictional preview only. No production model, customer data or external action.',budget:{runs:1,calls:0,run_limit:4,call_limit:32},cases:[],runs:[],assessments:null};
const receipts=new Map(),requests=[];let dropped=false;
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ApplicationEvaluation} from './src/application-evaluation';import './src/styles.css';import './src/career.css';import './src/platform.css';import './src/support-desk.css';createRoot(document.getElementById('root')).render(<ApplicationEvaluation/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(directory,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5204');res.setHeader('Cache-Control','no-store');
 if(url.pathname.startsWith('/api/')){
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET'&&url.pathname==='/api/admin/application-evaluation')return res.end(JSON.stringify(snapshot));
  if(req.method==='POST'&&url.pathname==='/api/admin/application-evaluation/settings'){
   let text='';for await(const chunk of req)text+=chunk;const input=JSON.parse(text);requests.push(input);
   const existing=receipts.get(input.request_key);if(existing){if(existing.body!==text){res.writeHead(409);return res.end(JSON.stringify({error:'Fictional request changed.'}));}return res.end(JSON.stringify({...existing.result,replayed:true,current_enabled:snapshot.enabled,current_revision:snapshot.control.revision}));}
   if(input.expected_revision!==snapshot.control.revision){res.writeHead(409);return res.end(JSON.stringify({error:'Fictional stale revision.'}));}
   snapshot.enabled=snapshot.evaluation_enabled=snapshot.control.enabled=input.action==='resume';snapshot.control.revision++;snapshot.control.reason=input.reason;snapshot.pause_reason=snapshot.enabled?null:'evaluation';snapshot.state=snapshot.enabled?'ready':'paused';
   const result={revision:snapshot.control.revision,current_revision:snapshot.control.revision,current_enabled:snapshot.enabled,replayed:false};receipts.set(input.request_key,{body:text,result});
   if(!dropped){dropped=true;res.writeHead(503);return res.end(JSON.stringify({error:'Fictional lost acknowledgement. Retry the same saved request.'}));}
   return res.end(JSON.stringify(result));
  }
  res.writeHead(405);return res.end(JSON.stringify({error:'This fictional preview supports no other action.'}));
 }
 if(url.pathname==='/receipt'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({requests,unique_reviews:receipts.size,control:snapshot.control,budget:snapshot.budget,external_calls:0}));}
 if(['/app.js','/app.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/css');return res.end(await readFile(join(directory,url.pathname.slice(1))));}
 if(url.pathname!=='/'){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional application-control QA</title><link rel="stylesheet" href="/app.css"><main style="max-width:1080px;margin:auto;padding:16px"><div id="root"></div></main><script src="/app.js"></script></html>');
});
server.listen(5204,'127.0.0.1',()=>console.log('Fictional application control QA: http://127.0.0.1:5204'));
process.on('SIGINT',async()=>{server.close();await rm(directory,{recursive:true,force:true});process.exit(0);});
