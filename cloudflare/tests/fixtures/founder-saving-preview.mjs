// Disposable actual Worker/auth/D1 + built React UI. All identities are fictional;
// no remote bindings, personal browser state, model or external API is used.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../../scripts/recovery-status.mjs';
import {emptyWorkbook} from '../../shared/founder.js';
const origin='http://127.0.0.1:5219',root=resolve(fileURLToPath(new URL('../../dist/',import.meta.url))),requests=[];
const bundle=await build({entryPoints:[fileURLToPath(new URL('../../worker/index.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-founder-browser'},bindings:{AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),APP_ORIGIN:origin,FOUNDER_SAVING_ENABLED:'true'},outboundService:()=>{throw Error('External requests forbidden');}}));
const db=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>db.prepare(x.sql));if(statements.length)await db.batch(statements);}
const accounts={};for(const id of ['a','b']){const r=await mf.dispatchFetch(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-SI-Metrics':'exclude'},body:JSON.stringify({name:'Fictional Founder '+id.toUpperCase(),email:`fictional-founder-${id}@example.invalid`,password:crypto.randomUUID()})});if(!r.ok)throw Error('Fixture signup failed');accounts[id]={user:(await r.json()).user,cookies:r.headers.getSetCookie()};}
let lose=false,offline=false;
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,origin);res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/fixture/login'){const a=accounts[u.searchParams.get('account')||'a'];if(!a)throw Error('Unknown fictional account');res.setHeader('Set-Cookie',a.cookies);res.writeHead(303,{Location:'/innovator-founder'});return res.end();}
 if(u.pathname==='/fixture/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({requests,offline,lose,workbooks:(await db.prepare('SELECT revision FROM founder_workspaces').all()).results,receipts:(await db.prepare('SELECT COUNT(*) n FROM founder_save_receipts').first()).n}));}
 if(u.pathname==='/fixture/control'&&req.method==='POST'){
  const action=u.searchParams.get('action');if(action==='lost')lose=true;if(action==='offline')offline=true;if(action==='online')offline=false;
  if(action==='change'){
   const a=accounts.a,cookie=a.cookies.map(x=>x.split(';')[0]).join('; '),old=await db.prepare('SELECT revision FROM founder_workspaces WHERE user_id=?').bind(a.user.id).first();
   const workbook=emptyWorkbook();workbook.notes.fit_questions='Fictional other-device route question';
   const r=await mf.dispatchFetch(origin+'/api/career/founder-workspace',{method:'PUT',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-SI-Metrics':'exclude'},body:JSON.stringify({accountId:a.user.id,revision:old?.revision||0,request_key:crypto.randomUUID(),workbook})});if(!r.ok)throw Error('Fictional competing save failed '+r.status);
  }
  res.writeHead(303,{Location:'/fixture'});return res.end();
 }
 if(u.pathname==='/fixture'){
  res.setHeader('Content-Type','text/html');return res.end(`<h1>Fictional Founder saving fixture</h1><p>Offline: ${offline}; lose next acknowledgement: ${lose}</p><a href="/fixture/login?account=a">Sign in as fictional A</a> <a href="/fixture/login?account=b">Sign in as fictional B</a> <a href="/innovator-founder">Open founder workbook</a>${['lost','offline','online','change'].map(x=>`<form method="POST" action="/fixture/control?action=${x}"><button>${x}</button></form>`).join('')}`);
 }
 if(u.pathname.startsWith('/api/')){
  requests.push({method:req.method,path:u.pathname});
  if(offline&&u.pathname==='/api/career/founder-workspace'){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"error":"Fictional network unavailable"}');}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers=new Headers(req.headers);headers.set('Origin',origin);headers.set('X-SI-Metrics','exclude');
  const response=await mf.dispatchFetch(origin+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  if(lose&&u.pathname==='/api/career/founder-workspace'&&req.method==='PUT'&&response.ok){lose=false;await response.arrayBuffer();res.writeHead(503,{'Content-Type':'application/json'});return res.end('{"error":"Fictional lost save acknowledgement"}');}
  for(const[k,v]of response.headers)if(k!=='set-cookie')res.setHeader(k,v);if(response.headers.getSetCookie().length)res.setHeader('Set-Cookie',response.headers.getSetCookie());res.statusCode=response.status;return res.end(Buffer.from(await response.arrayBuffer()));
 }
 const path=resolve(root,'.'+decodeURIComponent(u.pathname));if(!path.startsWith(root+sep)&&path!==root){res.writeHead(400);return res.end();}
 let body;try{body=await readFile(path);}catch{try{body=await readFile(resolve(path,'index.html'));}catch{body=await readFile(resolve(root,'index.html'));}}
 res.setHeader('Content-Type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'text/html');res.end(body);
 }catch{res.writeHead(500);res.end('Fictional local fixture error');}});
server.listen(5219,'127.0.0.1',()=>console.log('Fictional real Worker/UI fixture: '+origin+'/fixture'));
process.on('SIGINT',async()=>{server.close();await mf.dispose();process.exit(0);});
