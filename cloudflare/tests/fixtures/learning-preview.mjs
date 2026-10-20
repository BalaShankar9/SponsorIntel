// Actual learning components + read-only API over isolated fictional D1.
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {migrationSchema} from '../../scripts/recovery-status.mjs';
import {learningAPI} from '../../worker/learning.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='http://127.0.0.1:5212';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-04',cf:false,d1Databases:{DB:'fictional-learning-browser'}}));
const DB=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const statements=migrationSchema().objects.filter(x=>x.type===type).map(x=>DB.prepare(x.sql));if(statements.length)await DB.batch(statements);}
const now=new Date().toISOString();for(const [id,board,description] of [['a','monzo','Python and SQL experience. Strong communication skills.'],['b','cloudflare','Use Python and Docker.']])await DB.prepare('INSERT INTO jobs(id,board_id,provider,company,title,location,description,apply_url,sponsorship,evidence,level,first_seen,last_seen,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(id.repeat(24),board,'greenhouse','Fictional '+board,'Fictional analyst','Cardiff',description,'https://example.invalid/'+id,'offered','Visa sponsorship offered.','not_stated',now,now).run();
const ui=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {LearningPage} from './src/learning-entry';import {RoleLearning} from './src/learning-ui';import './src/styles.css';import './src/career.css';import './src/job-detail.css';
createRoot(document.getElementById('root')).render(<main style={{maxWidth:1200,margin:'24px auto',padding:16}}><p>Fictional isolated learning QA. No customer or external service.</p><button onClick={()=>fetch('/fixture/fail',{method:'POST'}).then(()=>location.reload())}>Fictional: fail snapshot</button><LearningPage/><RoleLearning description="Use Python and SQL. No React experience is required. Strong communication skills."/></main>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'esm',platform:'browser',outfile:'fixture.js',define:{'process.env.NODE_ENV':'"production"'}});
const assets=new Map(ui.outputFiles.map(f=>[f.path.split('/').pop(),f.contents]));let failed=false;
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);let response;
 if(url.pathname==='/fixture/fail'&&req.method==='POST'){failed=!failed;response=new Response('toggled');}
 else if(url.pathname==='/api/learning-skills')response=failed?Response.json({error:'Fictional snapshot unavailable.'},{status:503}):await learningAPI(new Request(url.href),{DB});
 if(response){res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));}
 if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional skills and learning</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');}
 if(assets.has(url.pathname.slice(1))){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':'application/javascript'});return res.end(assets.get(url.pathname.slice(1)));}res.writeHead(404);res.end('Not a fixture route');
 }catch(e){console.error(e.message);res.writeHead(500);res.end('Local fixture error');}});
server.listen(5212,'127.0.0.1',()=>console.log('Fictional learning preview: '+origin));
process.on('SIGINT',async()=>{server.close();await mf.dispose();process.exit(0);});
