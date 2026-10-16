// Fictional local register only. Uses the built app and the real directory query/render.
import {createServer as httpServer} from 'node:http';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import {database} from '../research-db.mjs';
import {getSponsorCities} from '../../worker/sponsor-cities.js';
import {cityDirectoryPath} from '../../shared/sponsor-cities.js';
const cleanups=[],env=database({after:f=>cleanups.push(f)}),origin='http://127.0.0.1:5203';
const now=new Date().toISOString(),meta={snapshot:'fictional',source_date:now.slice(0,10),checked_at:now,employers:82,cities:42,routes:[{name:'Skilled Worker',count:80},{name:'Creative Worker',count:2}]};
env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register',JSON.stringify(meta));
for(let i=0;i<82;i++)env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run(String(i).padStart(24,'0'),'fictional','Fictional QA Employer '+String(i).padStart(2,'0'),i<40?'Cardiff':i===40?'Sheffield':i===41?'Manchester':'Fictional Place '+i,'',JSON.stringify(['Worker (A rating)']),JSON.stringify([i%7?'Skilled Worker':'Creative Worker']),i%7?1:0);
const vite=await createServer({server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
const {cityHTML}=await vite.ssrLoadModule('/worker/sponsor-city-pages.tsx');
const server=httpServer(async(req,res)=>{try{
 const url=new URL(req.url,origin),p=url.pathname;
 const json=data=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(p==='/api/sponsor-cities')return json(await getSponsorCities(env,url.search));
 if(p==='/api/meta')return json(meta);
 if(p==='/api/featured')return json({items:[]});
 if(p==='/api/cities')return json([]);
 if(p==='/api/auth/get-session')return json(null);
 if(p.startsWith('/api/'))return json({});
 if(p==='/sponsors-by-city'){
  const result=await getSponsorCities(env,url.search),path=cityDirectoryPath(result.filters);
  let html=await readFile(new URL('../../dist/sponsors-by-city/index.html',import.meta.url),'utf8');
  html=html.replace(/<section class="sponsor-city-page">[\s\S]*?<\/section>/,()=>cityHTML(result,url.search)).replace('</body>',()=>'<script type="application/json" id="city-directory-data">'+JSON.stringify({path,result}).replace(/</g,'\\u003c')+'</script></body>');
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return res.end(html);
 }
 if(/^\/(assets|fonts)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..')){res.writeHead(200,{'Content-Type':p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'font/woff2'});return res.end(await readFile(new URL('../../dist'+p,import.meta.url)));}
 res.writeHead(404);res.end('Local fixture supports only the city directory.');
}catch(e){console.error(e);res.writeHead(500);res.end('Fictional preview error');}});
server.listen(5203,'127.0.0.1',()=>console.log('Fictional city directory: '+origin+'/sponsors-by-city'));
process.on('SIGINT',async()=>{server.close();for(const f of cleanups)f();await vite.close();process.exit(0);});
