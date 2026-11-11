import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {database} from './research-db.mjs';
import {getSponsorCities} from '../worker/sponsor-cities.js';
import {readCityFilters,cityDirectoryPath,readInitialCityDirectory} from '../shared/sponsor-cities.js';
const now=Date.parse('2026-10-15T23:00:00Z');
const meta={snapshot:'current',source_date:'2026-10-15',checked_at:'2026-10-15T07:17:00Z',routes:[{name:'Skilled Worker',count:2},{name:'Creative Worker',count:1}]};
let vite,render,metadata;
before(async()=>{vite=await createServer({server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});({cityHTML:render}=await vite.ssrLoadModule('/worker/sponsor-city-pages.tsx'));({cityPageMetadata:metadata}=await vite.ssrLoadModule('/src/seo.ts'));});
after(()=>vite?.close());
function seed(t) {
  const env=database(t);
  env.sql.prepare('INSERT INTO metadata(key,value) VALUES(?,?)').run('register',JSON.stringify(meta));
  const put=(id,name,city,skilled=1,county='',snapshot='current')=>env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run(id.padStart(24,'0'),snapshot,name,city,county,JSON.stringify(['Worker (A rating)']),JSON.stringify([skilled?'Skilled Worker':'Creative Worker']),skilled);
  put('1','Fictional Alpha','Cardiff');put('2','Fictional Beta','CARDIFF',0);put('3','Fictional Gamma','Cardiff Bay');put('4','Fictional Unknown','');put('5','Fictional Old','Cardiff',1,'','old');put('6','Fictional Wildcard','100% Town');put('7','Fictional Name','Same Town',1,'County A');put('8','Fictional Name','Same Town',1,'County B');
  return {env,put};
}
test('city directory counts only current listings, merges case only and keeps missing locations explicit',async t=>{
  const {env}=seed(t),r=await getSponsorCities(env,'',now);
  assert.deepEqual({...r.summary},{entries:7,locations:4,without_city:1});assert.equal(r.total,4);
  assert.equal(r.items.find(x=>x.city.toLowerCase()==='cardiff').count,2);
  assert.equal(r.items.find(x=>x.city==='Same Town').count,2);
  assert.equal(r.items.find(x=>x.city==='CARDIFF').skilled_worker,1);
  const selected=await getSponsorCities(env,'?city=cardiff',now);assert.equal(selected.total,2);assert.ok(selected.items.every(x=>x.city.toLowerCase()==='cardiff'));assert.ok(!selected.items.some(x=>x.name==='Fictional Old'));
});
test('route, literal search and exact place filters cannot broaden into nearby or wildcard matches',async t=>{
  const {env}=seed(t);
  const route=await getSponsorCities(env,'?city=Cardiff&route=Creative+Worker',now);assert.equal(route.total,1);assert.equal(route.items[0].name,'Fictional Beta');
  assert.equal((await getSponsorCities(env,'?q=%25',now)).total,1);
  assert.equal((await getSponsorCities(env,'?q=%27+OR+1%3D1',now)).total,0);
  assert.equal((await getSponsorCities(env,'?city=Cardiff&name=Gamma',now)).total,0);
  assert.equal((await getSponsorCities(env,'?route=Unknown',now)).total,0);
});
test('both directory and employer pagination are complete, deterministic and clamped after removals',async t=>{
  const {env,put}=seed(t);for(let i=10;i<50;i++)put(String(i),'Fictional '+i,'Place '+i);
  const a=await getSponsorCities(env,'?sort=az',now),b=await getSponsorCities(env,'?sort=az&page=2',now);
  assert.equal(a.total,44);assert.equal(a.items.length,36);assert.equal(b.items.length,8);assert.equal(new Set([...a.items,...b.items].map(x=>x.city)).size,44);
  for(let i=100;i<114;i++)put(String(i),'Fictional '+i,'Cardiff');
  const employers=await getSponsorCities(env,'?city=Cardiff&page=2',now);assert.equal(employers.items.length,4);assert.equal(employers.total,16);
  assert.equal((await getSponsorCities(env,'?city=Cardiff&page=99999',now)).page,2);
});
test('initial HTML has real counts, ordinary forms and links, escaped source text and evidence boundaries',async t=>{
  const {env,put}=seed(t);put('9','Fictional </script><img src=x>','Cardiff');
  const r=await getSponsorCities(env,'?city=Cardiff',now),html=render(r,'?city=Cardiff').replace(/<!--.*?-->/g,'');
  assert.match(html,/3 employer listings/);assert.match(html,/action="\/sponsors-by-city" method="get"/);
  assert.match(html,/name="city" value="Cardiff"/);assert.match(html,/name="route"/);assert.match(html,/name="name"/);
  const filtered=render(await getSponsorCities(env,'?city=Cardiff&route=Skilled+Worker&name=Alpha',now),'?city=Cardiff&route=Skilled+Worker&name=Alpha');assert.match(filtered,/href="\/sponsors-by-city\?city=Cardiff">Clear filters/);
  assert.match(html,/href="\/\?employer=000000000000000000000009"/);assert.match(html,/&lt;\/script&gt;&lt;img/);assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/may differ from the workplace/);assert.match(html,/does not confirm an open job/);
  const cities=render(await getSponsorCities(env,'',now),'').replace(/<!--.*?-->/g,'');assert.match(cities,/1 with no town or city supplied/);assert.match(cities,/Cardiff Bay/);
});
test('source failure stays distinct from an empty filter and stale data keeps its original date',async t=>{
  const {env}=seed(t);const empty=await getSponsorCities(env,'?q=Nowhere',now);assert.equal(empty.total,0);assert.match(render(empty,'?q=Nowhere'),/No matching/);
  env.sql.prepare('UPDATE metadata SET value=?').run(JSON.stringify({...meta,source_date:'2020-01-01',refresh_error:'old failure'}));
  const stale=await getSponsorCities(env,'',now);assert.equal(stale.stale,true);assert.equal(stale.source_date,'2020-01-01');assert.match(render(stale,''),/snapshot may be out of date/);
  env.sql.prepare('DELETE FROM metadata').run();await assert.rejects(getSponsorCities(env,'',now),/unavailable/);
});
test('share paths and bootstrap bind exact filters without copying private or campaign parameters',async t=>{
  const filters=readCityFilters('?city=Cardiff&name=Alpha&route=Skilled+Worker&page=2&email=private&utm_source=test');
  assert.equal(cityDirectoryPath(filters),'/sponsors-by-city?city=Cardiff&name=Alpha&route=Skilled+Worker&page=2');
  assert.equal(metadata(filters).indexable,false);assert.equal(metadata(readCityFilters('')).indexable,true);
  const {env}=seed(t),r=await getSponsorCities(env,'?city=Cardiff',now),raw=JSON.stringify({path:'/sponsors-by-city?city=Cardiff',result:r});
  assert.ok(readInitialCityDirectory(raw,'?city=Cardiff&utm_source=test',now));assert.equal(readInitialCityDirectory(raw,'?city=London',now),null);assert.equal(readInitialCityDirectory(raw,'?city=Cardiff',now+61000),null);
});
test('actual Worker SSR and D1 serve readable records, safe boot data, redirects and outage status',{timeout:60000},async()=>{
  const bundle=await build({stdin:{contents:`import {renderCityPage,cityUnavailable} from './worker/sponsor-city-pages.tsx';export default {async fetch(r,e){try{return await renderCityPage(r,e);}catch{return cityUnavailable();}}};`,resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022',loader:{'.css':'empty'}});
  let outbound=0;
  const template='<html><head><title>Directory</title><link rel="canonical" href="https://sponsorintel.london/sponsors-by-city"><meta name="robots" content="index,follow"><meta property="og:title" content="Directory"><meta property="og:url" content=""><meta name="twitter:title" content=""><script id="structured-data" type="application/ld+json">{}</script></head><body><noscript>Loading</noscript><section class="sponsor-city-page"></section></body></html>';
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'fictional-cities'},serviceBindings:{ASSETS:async()=>new Response(template)},outboundService:()=>{outbound++;throw Error('No external I/O');}}));
  try {
    const db=await mf.getD1Database('DB');await db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
    await db.prepare('INSERT INTO metadata VALUES(?,?)').bind('register',JSON.stringify(meta)).run();
    await db.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').bind('1'.repeat(24),'current','Fictional </script><img src=x>','Cardiff','',JSON.stringify(['Worker (A rating)']),JSON.stringify(['Skilled Worker']),1).run();
    const response=await mf.dispatchFetch('https://sponsorintel.london/sponsors-by-city?city=Cardiff'),html=await response.text();assert.equal(response.status,200);assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(html,/<h1>/);assert.match(html,/Fictional &lt;\/script&gt;/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/\\u003c\/script>/);assert.match(html,/id="city-directory-data"/);
    const redirect=await mf.dispatchFetch('https://sponsorintel.london/sponsors-by-city?city=Cardiff&page=999',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/sponsors-by-city?city=Cardiff');
    await db.prepare('DELETE FROM metadata').run();const failed=await mf.dispatchFetch('https://sponsorintel.london/sponsors-by-city');assert.equal(failed.status,503);assert.match(await failed.text(),/does not mean there are no sponsors/);assert.equal(outbound,0);
  }finally{await mf.dispose();}
});
