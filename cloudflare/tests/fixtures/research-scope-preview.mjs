// Fictional local browser exercise. No provider, production or model connection.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-scope-ui-'));
await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ResearchScope,ScopeEvidence} from './src/research-scope';import './src/styles.css';
const initial={dataset:'fictional-scope',reference_revision:2,state:'not_prepared',available:true,source_sha256:'fictional-local-source',control:{prepared:false,enabled:false,revision:0,reason:'',updated_at:null},evaluated_adverts:0,total_adverts:50,uncertain_calls:0,dangerous_false_positives:0,unsupported_refusals:0,disputed_items:0,batches:Array.from({length:25},(_,i)=>({id:'pair-'+i,state:'not_started',calls:0,run_id:null}))};
const example={source:{job_id:'fictional',title:'Fictional evidence example',source_blocks:[{id:'q1',text:'We cannot sponsor export authorisation. Visa sponsorship is available for this role.'}]},extraction:{complete:true,provisional_label:'offered',facts:[{id:'f1',subject:'work_visa',stance:'offered',scope:'this_role',quotes:[{id:'q1',text:'We cannot sponsor export authorisation. Visa sponsorship is available for this role.'}],reason:'Fictional extraction separates export authorisation from work visa support.'}]},review:{checks:[{fact_id:'f1',supported:true,reason:'Fictional example only.'}],coverage:{supported:true,reason:'Fixture only; no model ran.'},label:{supported:true,reason:'Fixture only; no quality claim.'}},outcome:{accepted:true}};
function Fixture(){const[data,setData]=useState(initial);return <main style={{padding:20,maxWidth:1000,margin:'auto'}}><p>FICTIONAL LOCAL PREVIEW. No provider calls.</p><ResearchScope data={data} active={false} refresh={async()=>setData(await(await fetch('/fixture/state')).json())}/><ScopeEvidence cases={[example]}/></main>;}createRoot(document.getElementById('root')).render(<Fixture/>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
let pending=null,revision=0,prepared=false,enabled=false,reason='';
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1:5217').pathname;
if(path==='/api/admin/agents/research/scope'){
 let body='';for await(const b of req)body+=b;const p=JSON.parse(body);
 if(!pending&&revision===0){pending=body;res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Fictional lost acknowledgement. Recheck the same request.'}));}
 if(pending&&pending!==body)throw Error('Fixture expected exact replay');pending=null;
 if(p.expected_revision!==revision||p.expected_reference_revision!==2)throw Error('Fixture expected exact revision');
 revision++;prepared=true;enabled=p.action==='resume';reason=p.reason;
 res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({message:'Fictional '+p.action+' recorded; no model call.'}));
}
if(path==='/fixture/state'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({dataset:'fictional-scope',reference_revision:2,state:enabled?'ready':'paused',available:true,source_sha256:'fictional-local-source',control:{prepared,enabled,revision,reason,updated_at:new Date().toISOString()},evaluated_adverts:0,total_adverts:50,uncertain_calls:0,dangerous_false_positives:0,unsupported_refusals:0,disputed_items:0,batches:Array.from({length:25},(_,i)=>({id:'pair-'+i,state:'not_started',calls:0,run_id:null}))}));}
if(['/app.js','/app.css'].includes(path)){res.writeHead(200,{'Content-Type':path.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,path.slice(1))));}
res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional scope comparison</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>');}catch{res.writeHead(409);res.end(JSON.stringify({error:'Fictional request mismatch'}));}});
server.listen(5217,'127.0.0.1',()=>console.log('Fictional scope preview at http://127.0.0.1:5217'));
process.on('SIGINT',async()=>{server.close();await rm(dir,{recursive:true,force:true});process.exit(0);});
