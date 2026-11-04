// Fictional local UI preview; no production connection or provider request.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-reference-ui-'));
await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ResearchComparison} from './src/research-comparison';import './src/styles.css';
const p={total_adverts:50,total_batches:16,evaluated_adverts:0,completed_batches:0,correct:0,scored:0,ambiguous:0,disputed_items:0};
function Fixture(){const [data,setData]=useState({control:{campaign:'original',enabled:true,revision:0,reason:'',updated_at:null},available:true,source_sha256:'fictional-local-source',original:{...p,dataset:'original',state:'needs_attention',evaluated_adverts:3},candidate:{...p,dataset:'candidate',state:'not_prepared'}});return <main style={{padding:20,maxWidth:1000,margin:'auto'}}><p>FICTIONAL LOCAL PREVIEW. No provider calls.</p><ResearchComparison data={data} active={false} refresh={async()=>setData({...data,control:{...data.control,campaign:'candidate',enabled:false,revision:1,reason:'Fictional local comparison prepared and paused.'},candidate:{...data.candidate,state:'paused'}})}/></main>;}createRoot(document.getElementById('root')).render(<Fixture/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
let seen=null;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1:5217').pathname;
if(path==='/api/admin/agents/research/reference'){let body='';for await(const b of req)body+=b;const parsed=JSON.parse(body);if(!seen){seen=parsed;res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Fictional lost acknowledgement. Use the same request.'}));}if(JSON.stringify(parsed)!==JSON.stringify(seen)){res.writeHead(409,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Fixture expected exact replay'}));}res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({message:'Fictional comparison prepared and paused. Exact request replay confirmed.'}));}
if(['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,path.slice(1))));}
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional research comparison preview</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>');}catch{res.writeHead(500);res.end('Local fixture failed');}});
server.listen(5217,'127.0.0.1',()=>console.log('Fictional preview: http://127.0.0.1:5217'));
process.on('SIGINT',async()=>{server.close();await rm(dir,{recursive:true,force:true});process.exit(0);});
