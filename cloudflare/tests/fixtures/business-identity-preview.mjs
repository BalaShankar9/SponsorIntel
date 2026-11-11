// Local-only functional browser fixture. Identity methods use real D1-shaped SQLite.
import {fileURLToPath} from 'node:url';
import {createServer as httpServer} from 'node:http';
import {build} from 'esbuild';
import {sourceDatabase} from '../helpers/source-d1.mjs';
import {businessIdentitiesAPI,publicBusinessIdentities,businessQuerySpec} from '../../worker/business-identities.js';
const cleanups=[],env=sourceDatabase({after:f=>cleanups.push(f)}),origin='http://127.0.0.1:5207',at=new Date().toISOString();
env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register',JSON.stringify({snapshot:'fictional',source_date:at.slice(0,10),checked_at:at}));
env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run('a'.repeat(24),'fictional','Fictional Harbour Legal Ltd','Cardiff','',JSON.stringify(['Worker (A rating)']),JSON.stringify(['Skilled Worker']),1);
const bundle=await build({entryPoints:[fileURLToPath(new URL('./business-identity-preview.tsx',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',outfile:'fixture.js',define:{'process.env.NODE_ENV':'"production"'}});
const assets=new Map(bundle.outputFiles.map(f=>[f.path.split('/').pop(),f.contents]));
const server=httpServer(async(req,res)=>{try{
 const u=new URL(req.url,origin),p=u.pathname;let response;
 if(p==='/api/admin/business-identities'){
  const chunks=[];for await(const c of req)chunks.push(c);
  response=await businessIdentitiesAPI(new Request(u,{method:req.method,headers:{Origin:origin,'Content-Type':'application/json'},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),env,{user:{id:'fictional-owner'}});
 }else if(p==='/api/business-identities')response=Response.json(await publicBusinessIdentities(env,u.searchParams.get('sponsor_id')));
 else if(p==='/api/sponsors'){const q=businessQuerySpec(u.searchParams,new Date().toISOString());response=Response.json({items:env.sql.prepare('SELECT id,name,city FROM sponsors WHERE '+q.where).all('fictional',...q.values)});}
 else if(p.startsWith('/api/'))response=Response.json({error:'Unsupported fictional fixture route'}, {status:404});
 if(response){res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());}
 if(p==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional business identity review</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');}
 if(assets.has(p.slice(1))){res.writeHead(200,{'Content-Type':p.endsWith('.css')?'text/css':'application/javascript'});return res.end(assets.get(p.slice(1)));}
 res.writeHead(404);res.end('Fictional preview route not found');
 }catch(e){console.error(e);res.writeHead(500);res.end('Fictional preview failed');}});
server.listen(5207,'127.0.0.1',()=>console.log('Local fictional review: '+origin));
process.on('SIGINT',async()=>{server.close();for(const f of cleanups)f();process.exit(0);});
