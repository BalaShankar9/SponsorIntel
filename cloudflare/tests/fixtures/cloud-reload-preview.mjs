// Fictional account journey; requests are served locally and never reach providers.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-reload-ui-'));
await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {CareerProvider,useCareer,emptyData} from './src/career-data';import {CareerTools} from './src/career';import './src/styles.css';
const user={id:'fictional-reload',name:'Fictional Candidate',email:'fixture@example.invalid',emailVerified:true};
const local={...emptyData(),profile:{...emptyData().profile,cv:'PRIVATE FICTIONAL UNSYNCED CV: valuable local changes',name:'Fictional Local'}};
const remote={...emptyData(),profile:{...emptyData().profile,cv:'OLDER FICTIONAL CLOUD CV',name:'Fictional Remote'}};
let puts=0,downloads=0,failCloud=false,failStorage=false;
const originalSet=Storage.prototype.setItem,originalGet=Storage.prototype.getItem;
Storage.prototype.getItem=function(k){if(new URLSearchParams(location.search).has('unavailable')&&k.startsWith('si.career.'))throw Error('Fictional device read denied');return originalGet.call(this,k);};
Storage.prototype.setItem=function(k,v){if(failStorage&&k.startsWith('si.career.reload-backup.'))throw Error('Fictional quota exceeded');return originalSet.call(this,k,v);};
if(!sessionStorage.getItem('seeded')){localStorage.setItem('si.career.user.'+user.id,JSON.stringify({data:local,revision:1,dirty:true}));sessionStorage.setItem('seeded','yes');}
HTMLAnchorElement.prototype.click=function(){downloads++;document.getElementById('download-count').textContent=String(downloads);};
window.fetch=async(url,init={})=>{const path=String(url);if(path==='/api/auth/get-session')return Response.json({user});if(path==='/api/career/workspace'){if(init.method==='PUT'){puts++;return Response.json({error:'Fictional concurrent edit: reload cloud workspace'},{status:409});}if(failCloud)return Response.json({error:'Fictional network failure'},{status:503});return Response.json({data:remote,revision:2,accountId:user.id});}return Response.json({error:'No fixture route or external request allowed'},{status:400});};
function View(){const c=useCareer(),[mode,setMode]=useState('account'),[tick,setTick]=useState(0);return <main style={{padding:20,maxWidth:1100,margin:'auto'}}><h1>Fictional recovery QA</h1><p>Downloads deliberately blocked. No production account or provider.</p><div>Download requests: <span id="download-count">{downloads}</span></div><button onClick={()=>{failCloud=!failCloud;setTick(tick+1)}}>Cloud failure: {String(failCloud)}</button><button onClick={()=>{failStorage=!failStorage;setTick(tick+1)}}>Backup storage failure: {String(failStorage)}</button><button onClick={()=>{c.setData(local);setTick(tick+1)}}>Edit local fictional CV</button><button onClick={()=>setMode('account')}>QA account</button><pre style={{whiteSpace:"pre-wrap"}} aria-label="Current fictional CV">{c.data.profile.cv}</pre><p aria-label="Provider error">{c.error}</p><p>Ready: {String(c.ready)}; PUT attempts: {puts}</p><CareerTools mode={mode} go={setMode}/></main>;}createRoot(document.getElementById('root')).render(<CareerProvider><View/></CareerProvider>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1:5226').pathname;if(['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,path.slice(1))));}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional workspace recovery</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>');}catch{res.writeHead(500);res.end('Local fixture failed');}});
server.listen(5226,'127.0.0.1',()=>console.log('Fictional recovery preview: http://127.0.0.1:5226'));
process.on('SIGINT',async()=>{server.close();await rm(dir,{recursive:true,force:true});process.exit(0);});
