// Fictional localhost-only UI harness. No production data or outbound provider call.
// Run from cloudflare: node tests/fixtures/marketing-performance-preview.mjs
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from '../research-db.mjs';
import {marketingPerformanceAPI} from '../../worker/marketing-performance.js';
const cleanups=[],env=database({after:f=>cleanups.push(f)}),root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-performance-ui-'));
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingPerformance} from './src/marketing-performance';import './src/marketing-desk.css';import './src/business-operations.css';createRoot(document.getElementById('root')).render(<MarketingPerformance/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1:5200').pathname;
  if(path==='/api/admin/marketing/performance'){
   let text='';for await(const b of req)text+=b;
   const r=await marketingPerformanceAPI(new Request('http://127.0.0.1:5200'+path,{method:req.method,headers:req.headers,...(text?{body:text}: {})}),env,{user:{id:'fictional-local-owner'}});
   res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());
  }
  if(['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,path.slice(1))));}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fictional local marketing performance preview</title><link rel="stylesheet" href="/app.css"><style>body{font-family:system-ui;background:#f6f8f1;color:#20362a;margin:0;padding:20px}main{max-width:1000px;margin:auto}.fixture{padding:14px;background:#ffe9c4;border-radius:10px}button,summary{cursor:pointer}button{padding:10px}h3{font-size:24px}input,select,textarea{max-width:100%}</style><main class="marketing-desk"><p class="fixture">FICTIONAL LOCAL PREVIEW · No real posts, customer records or provider calls.</p><div id="root"></div></main><script src="/app.js"></script></html>');
 }catch(e){res.writeHead(500);res.end('Fictional fixture error');console.error(e);}
});
server.listen(5200,'127.0.0.1',()=>console.log('Fictional local marketing performance UI: http://127.0.0.1:5200'));
process.on('SIGINT',async()=>{server.close();for(const f of cleanups)f();await rm(dir,{recursive:true,force:true});process.exit(0);});
