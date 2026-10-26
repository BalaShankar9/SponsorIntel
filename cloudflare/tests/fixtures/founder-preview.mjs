// Actual built app, isolated local origin. API requests are recorded as method/path only.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const root=resolve(fileURLToPath(new URL('../../dist/',import.meta.url))),requests=[];
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1:5218');
 if(u.pathname==='/fixture/requests'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(requests));}
 if(u.pathname.startsWith('/api/')){
  requests.push({method:req.method,path:u.pathname});res.setHeader('Content-Type','application/json');
  if(req.method!=='GET'){res.writeHead(405);return res.end('{"error":"Fictional local writes are disabled"}');}
  if(u.pathname==='/api/auth/get-session')return res.end('null');
  res.writeHead(503);return res.end('{"error":"Fictional local backend is unavailable"}');
 }
 const path=resolve(root,'.'+decodeURIComponent(u.pathname));if(!path.startsWith(root+sep)&&path!==root){res.writeHead(400);return res.end();}
 let body;try{body=await readFile(path);}catch{try{body=await readFile(resolve(path,'index.html'));}catch{body=await readFile(resolve(root,'index.html'));}}
 if(u.searchParams.has('fixture_expired')&&!path.endsWith('.js')&&!path.endsWith('.css'))body=Buffer.from(body.toString().replace('<head>','<head><script>Date.now=()=>1793577600000;</script>'));
 res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.json')?'application/json':'text/html');res.end(body);
 }catch{res.writeHead(500);res.end('Local fixture error');}});
server.listen(5218,'127.0.0.1',()=>console.log('Actual built founder app, fictional backend: http://127.0.0.1:5218/innovator-founder'));
process.on('SIGINT',()=>{server.close();process.exit(0);});
