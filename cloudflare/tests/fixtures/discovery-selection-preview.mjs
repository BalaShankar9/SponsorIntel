// Actual owner component with fictional selection receipts; no live API requests.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'si-discovery-selection-'));
await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DiscoveryScoutStatus} from './src/discovery-scout';import './src/styles.css';import './src/business-operations.css';
const day='2026-10-18',at=day+'T10:00:00Z',run={day,run_id:'fictional-run',state:'completed',reason:'checked_advert_links_already_known',started_at:at,finished_at:at,retained:0,inspected:0,requests:1,reserved_requests:4,search_pages:1};
const health={enabled:true,latest:run,runs:[run],attribution:'Fictional demonstration. No actual source check or production record.',terms:'https://example.test/fictional-terms',items:[
{source_url:'https://example.test/fictional-one',state:'duplicate',reason:'school_already_configured',lead_id:null,evidence:{title:'Fictional teacher at a configured school',school_urn:'123456',selection:'known_advert_skipped',prior_observed_at:'2026-10-15T10:00:00Z'}},
{source_url:'https://example.test/fictional-two',state:'duplicate',reason:'advert_already_in_queue',lead_id:'fictional-lead',evidence:{title:'Fictional role already in review',selection:'known_advert_skipped',prior_recorded_at:'2026-10-14T10:00:00Z'}}]};
window.fetch=async()=>{throw Error('No network requests allowed in this fixture')};
createRoot(document.getElementById('root')).render(<main className="business-ops" style={{padding:20,maxWidth:900,margin:'auto'}}><h1>Fictional discovery QA</h1><p>No real candidates or source requests.</p><DiscoveryScoutStatus health={health}/></main>);`,loader:'tsx',resolveDir:root},bundle:true,outfile:join(dir,'app.js'),logLevel:'silent'});
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:5234');if(url.pathname==='/phone'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><html><body style="margin:0"><iframe title="Fictional 390px viewport" src="/" style="display:block;width:390px;height:844px;border:0;margin:auto"></iframe></body></html>');}if(['/app.js','/app.css'].includes(url.pathname)){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/css'});return res.end(await readFile(join(dir,url.pathname.slice(1))));}res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional discovery QA</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>');}catch{res.writeHead(500);res.end('Local fixture failed')}});
server.listen(5234,'127.0.0.1',()=>console.log('Fictional discovery preview: http://127.0.0.1:5234'));
process.on('SIGINT',async()=>{server.close();await rm(dir,{recursive:true,force:true});process.exit(0)});
