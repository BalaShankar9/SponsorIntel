// Fictional, local-only browser regression for the real advert-review form/API.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceDatabase} from '../helpers/source-d1.mjs';
import {school,seedSchool,vacancy} from './teaching-board.mjs';
import {saveJobReview,jobReviewsAPI} from '../../worker/job-reviews.js';
const cleanup=[],env=sourceDatabase({after:f=>cleanup.push(f)}),now=Date.now(),iso=n=>new Date(n).toISOString();
await seedSchool(env.DB,now);
await saveJobReview(env,{source_id:school.id,apply_url:vacancy(1).url,revision:0,state:'held',title:'Fictional date regression advert',reason:'deadline_conflict',evidence_url:'https://employer.example/careers',note:'Fictional original deadline conflict; preserve this first decision.',observed_at:iso(now-2*86400000),follow_up_at:iso(now-86400000),request_key:crypto.randomUUID()},'fictional-owner',now-2*86400000);
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-advert-dates-'));
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {JobReviews} from './src/job-reviews';import './src/styles.css';import './src/marketing-desk.css';createRoot(document.getElementById('root')).render(<JobReviews/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:5202');
  if(url.pathname==='/api/admin/job-reviews'){
   let body='';for await(const part of req)body+=part;
   const request=new Request(url,{method:req.method,headers:{Origin:url.origin,'Content-Type':'application/json'},...(body?{body}:{})});
   const reply=await jobReviewsAPI(request,env,{user:{id:'fictional-owner'}});
   res.writeHead(reply.status,Object.fromEntries(reply.headers));return res.end(await reply.text());
  }
  if(url.pathname==='/receipt'){
   res.writeHead(200,{'Content-Type':'text/plain'});
   return res.end(JSON.stringify(env.sql.prepare('SELECT revision,state,observed_at,follow_up_at FROM job_review_revisions ORDER BY revision').all(),null,2));
  }
  if(['/app.js','/app.css'].includes(url.pathname)){
   res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,url.pathname.slice(1))));
  }
  if(url.pathname!=='/'){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional advert date QA</title><link rel="stylesheet" href="/app.css"><main style="padding:16px;max-width:900px;margin:auto"><h1>Fictional advert date QA</h1><p>No production data, credentials or provider requests. Existing overdue hold is deliberately fictional.</p><a href="/receipt">Inspect fictional saved dates</a><div id="root"></div></main><script src="/app.js"></script></html>');
 }catch(error){res.writeHead(500);res.end('Local fixture failed');console.error(error);}
});
server.listen(5202,'127.0.0.1',()=>console.log('Fictional advert dates: http://127.0.0.1:5202'));
process.on('SIGINT',async()=>{server.close();for(const f of cleanup)f();await rm(dir,{recursive:true,force:true});process.exit(0);});
