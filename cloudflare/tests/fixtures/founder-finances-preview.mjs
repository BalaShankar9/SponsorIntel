// Actual built app and a small actual-provider account-switch shell. All identities and API replies are fictional.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json','.html':'text/html; charset=utf-8'};
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};

export async function startFounderFinancesPreview({port=0,dist=join(root,'dist')}={}){
 const directory=await mkdtemp(join(tmpdir(),'si-founder-finance-fixture-'));
 const apiRequests=[],fixtureErrors=[],sessionChanges=[],fontSuppressions=[];
 let origin='',identity=null;
 function localFontFallback(html,asset){
  return html.replace(/<link\b[^>]*>/gi,tag=>{
   const href=tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1],rel=tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];
   if(!href||!['stylesheet','preconnect'].includes(rel))return tag;
   let url;try{url=new URL(href);}catch{return tag;}
   if(url.protocol!=='https:'||!['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return tag;
   fontSuppressions.push({asset,url:href,kind:rel,reason:'Local fixture uses system-font fallback; production font sources are unchanged.'});
   return '';
  });
 }
 const shell=`import React from 'react';import {createRoot} from 'react-dom/client';import {CareerProvider,useCareer} from './src/career-data';import {FounderPage} from './src/founder-entry';import {finishFounderExit} from './shared/founder-workspace.js';import './src/styles.css';
 function QA(){
  const c=useCareer();const [busy,setBusy]=React.useState(false);const [cleanup,setCleanup]=React.useState('');
  async function change(identity){setBusy(true);try{const r=await fetch('/__qa/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity})});if(!r.ok)throw Error('Fictional session switch failed');await c.reload();}finally{setBusy(false);}}
  async function simulateDeletedCleanup(){const id=c.user?.id;if(!id)return;if(!finishFounderExit(localStorage,id,null,{deleted:true}))throw Error('Fictional local deletion cleanup did not finish');setCleanup('Local confirmed-deletion cleanup completed for '+id+'. No account deletion API was called.');await change(null);}
  return <><aside style={{padding:16,background:'#fff2d3'}} aria-label="Fictional account controls"><strong>FICTIONAL LOCAL ACCOUNT QA</strong><p role="status">Fixture account: {c.user?.id||'guest'}</p><button disabled={busy||!c.ready} onClick={()=>change('a')}>Use fictional account A</button><button disabled={busy||!c.ready} onClick={()=>change('b')}>Use fictional account B</button><button disabled={busy||!c.ready} onClick={()=>change(null)}>Use fictional guest</button><button disabled={busy||!c.ready||!c.user} onClick={simulateDeletedCleanup}>Simulate confirmed deletion cleanup (local fixture only)</button>{cleanup&&<p role="status">{cleanup}</p>}</aside><main style={{maxWidth:1100,margin:'auto',padding:20}}><FounderPage/></main></>;
 }createRoot(document.getElementById('root')).render(<CareerProvider><QA/></CareerProvider>);`;
 const server=createServer(async(req,res)=>{
  try{
   if(!origin||req.headers.host!==new URL(origin).host)return json(res,{error:'Exact loopback host required.'},403);
   const url=new URL(req.url,origin),path=url.pathname;
   if(path==='/__qa/evidence'&&req.method==='GET')return json(res,{api_requests:apiRequests,session_changes:sessionChanges,fixture_errors:fixtureErrors,font_policy:'known_google_font_links_removed_for_local_fallback',font_suppressions:fontSuppressions,business_mutations:0});
   if(path==='/__qa/session'&&req.method==='POST'){
    if(req.headers.origin!==origin)return json(res,{error:'Exact fixture origin required.'},403);
    let body='';for await(const chunk of req){body+=chunk;if(body.length>1000)throw Error('Fixture control too large.');}
    const value=JSON.parse(body);if(Object.keys(value).length!==1||!Object.hasOwn(value,'identity')||![null,'a','b'].includes(value.identity))throw Error('Unknown fictional identity.');
    identity=value.identity;sessionChanges.push(identity);return json(res,{identity});
   }
   if(path.startsWith('/api/')){
    const excluded=req.headers['x-si-metrics']==='exclude';apiRequests.push({method:req.method,path,metrics_excluded:excluded});
    if(path==='/api/metrics'&&req.method==='POST'&&excluded){res.writeHead(204,{'Cache-Control':'no-store'});return res.end();}
    if(req.method!=='GET')return json(res,{error:'All business mutation routes are disabled in this fictional fixture.'},405);
    if(path==='/api/auth/get-session')return json(res,identity?{user:{id:'fictional-founder-'+identity,name:'Fictional Founder '+identity.toUpperCase(),email:identity+'@example.invalid',emailVerified:true}}:null);
    if(path==='/api/career/workspace')return json(res,{accountId:identity?'fictional-founder-'+identity:null,revision:0,data:null});
    if(path==='/api/admin/session')return json(res,{error:'This fictional user is not an owner.'},403);
    if(path==='/api/meta')return json(res,{source_date:'2026-11-11',source_url:'https://www.gov.uk/',publication_url:'https://www.gov.uk/',employers:0,skilled_worker:0,source_rows:0,checked_at:'2026-11-11T00:00:00Z',cities:0,refresh_error:null,routes:[]});
    if(path==='/api/featured')return json(res,{items:[]});
    if(path==='/api/cities')return json(res,[]);
    return json(res,{error:'This fictional endpoint is unavailable.'},503);
   }
   if(req.method!=='GET')return json(res,{error:'Read-only fixture.'},405);
   if(path==='/__qa/accounts'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional Founder account isolation QA</title><link rel="stylesheet" href="/__qa/accounts.css"></head><body><div id="root"></div><script type="module" src="/__qa/accounts.js"></script></body></html>');
   }
   if(path==='/__qa/accounts.js'||path==='/__qa/accounts.css'){
    res.writeHead(200,{'Content-Type':types[extname(path)],'Cache-Control':'no-store'});return res.end(await readFile(join(directory,'accounts'+extname(path))));
   }
   const absoluteRoot=resolve(dist),file=resolve(absoluteRoot,'.'+decodeURIComponent(path));
   if(file!==absoluteRoot&&!file.startsWith(absoluteRoot+sep))return json(res,{error:'Path outside fixture.'},400);
   let actual=file,body;
   try{body=await readFile(actual);}catch{
    if(extname(path))return json(res,{error:'Missing built asset.'},404);
    actual=join(absoluteRoot,'index.html');body=await readFile(actual);
   }
   if(extname(actual)==='.html')body=Buffer.from(localFontFallback(body.toString('utf8'),path));
   res.writeHead(200,{'Content-Type':types[extname(actual)]||'application/octet-stream','Cache-Control':'no-store','X-SponsorIntel-QA':'fictional-local'});res.end(body);
  }catch(error){fixtureErrors.push(error.message);if(!res.headersSent)json(res,{error:'Fictional fixture error.'},500);else res.destroy();}
 });
 try{
  await readFile(join(resolve(dist),'index.html'));
  await build({stdin:{contents:shell,loader:'tsx',resolveDir:root},bundle:true,format:'esm',outfile:join(directory,'accounts.js'),logLevel:'silent'});
  await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',done);});
  origin='http://127.0.0.1:'+server.address().port;
 }catch(error){server.close();await rm(directory,{recursive:true,force:true});throw error;}
 return {origin,directory,async close(){server.closeAllConnections();await new Promise(done=>server.close(done));await rm(directory,{recursive:true,force:true});}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const fixture=await startFounderFinancesPreview({port:Number(process.env.SI_QA_PORT||5221)});
 console.log('Fictional Founder finance QA: '+fixture.origin+'/innovator-founder');
 const close=async()=>{await fixture.close();process.exit(0);};process.once('SIGINT',close);process.once('SIGTERM',close);
}
