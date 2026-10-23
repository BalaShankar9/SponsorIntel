import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {database} from './research-db.mjs';
import fixture from './fixtures/immigration-guidance-2026-10-08.json' with {type:'json'};
import {WATCHED_SOURCES} from '../worker/immigration-content.js';
import {immigrationAPI} from '../worker/immigration.js';
let vite,render,readInitial,unavailable;
before(async()=>{
 vite=await createServer({server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
 ({immigrationHTML:render,immigrationUnavailable:unavailable}=await vite.ssrLoadModule('/worker/immigration-pages.tsx'));
 ({readInitialImmigrationFeed:readInitial}=await vite.ssrLoadModule('/src/updates.tsx'));
});
after(()=>vite?.close());
async function feed(t){
 const env=database(t),stamp=new Date().toISOString();
 const insert=env.sql.prepare('INSERT INTO immigration_sources(id,topic,title,url,kind,content_hash,content,checked_at,last_success,withdrawn) VALUES(?,?,?,?,?,?,?,?,?,?)');
 for(const s of fixture.sources)insert.run(s.id,WATCHED_SOURCES.find(w=>w.id===s.id).topic,s.title,s.url,'guidance',s.content_hash,s.body,stamp,stamp,0);
 return {env,data:await(await immigrationAPI(env)).json()};
}
test('initial HTML contains all current guidance and source excerpts without executing page scripts',async t=>{
 const {data}=await feed(t),html=render(data,null);
 assert.equal((html.match(/class="explanation-card /g)||[]).length,19);
 assert.match(html,/Student finances: course fees and living costs/);
 assert.match(html,/£1,529/);assert.match(html,/for at least 28 days in a row/);
 assert.match(html,/href="https:\/\/www.gov.uk\/student-visa\/money"/);
 assert.doesNotMatch(html,/Loading official updates|Report incorrect information/);
 assert.equal((html.match(/<h1>/g)||[]).length,1);
});
test('topic links work without scripts, preserve a selected topic and ignore unknown values',async t=>{
 const {data}=await feed(t),html=render(data,'student');
 assert.equal((html.match(/class="explanation-card /g)||[]).length,3);
 assert.match(html,/<a href="\/updates\?topic=student" aria-current="page"/);
 assert.match(html,/<a href="\/updates\?topic=business"/);
 assert.doesNotMatch(html,/<button[^>]*>Business/);
 assert.equal((render(data,'not-a-topic').match(/class="explanation-card /g)||[]).length,19);
});
test('server markup reflects changed and stale source holds on the very next read',async t=>{
 const {env,data}=await feed(t);
 assert.match(render(data,'student'),/£1,529/);
 env.sql.prepare("UPDATE immigration_sources SET content_hash='changed' WHERE id='student-money'").run();
 const changed=render(await(await immigrationAPI(env)).json(),'student');
 assert.doesNotMatch(changed,/£1,529/);assert.match(changed,/previous explanation is hidden/);
 env.sql.prepare("UPDATE immigration_sources SET last_success='2000-01-01T00:00:00Z' WHERE id='student-course'").run();
 const stale=render(await(await immigrationAPI(env)).json(),'student');
 assert.doesNotMatch(stale,/apply within six months of receiving it/);
 assert.match(stale,/could not confirm the latest official text recently/);
});
test('shared renderer escapes source text rather than executing markup',async t=>{
 const {data}=await feed(t);const s=data.sources.find(s=>s.id==='student-money');
 s.summary.points[0]='Text </li><script>window.bad=true</script> $&';
 s.summary.evidence[0]=['Text <img src=x onerror=alert(1)>'];
 const html=render(data,'student');assert.doesNotMatch(html,/<script>|<img src=x/);
 assert.match(html,/&lt;script&gt;window.bad=true/);assert.match(html,/&lt;img src=x/);
});
test('browser bootstrap is short-lived and cannot revive a now-expired explanation or comparison',async t=>{
 const {data}=await feed(t),now=Date.now();data.generated_at=new Date(now).toISOString();
 assert.ok(readInitial(JSON.stringify(data),now));
 assert.equal(readInitial(JSON.stringify(data),now+60001),null);
 assert.equal(readInitial(JSON.stringify(data),now-5001),null);
 assert.equal(readInitial('invalid json',now),null);
 const s=data.sources.find(s=>s.id==='student-money');s.last_success=new Date(now-3600001).toISOString();
 data.events=[{id:'local',source_id:s.id,review:{text:'Old wording comparison',evidence:[]}}];
 const fresh=readInitial(JSON.stringify(data),now);
 assert.equal(fresh.sources.find(s=>s.id==='student-money').summary,null);
 assert.equal(fresh.events[0].review,null);
 assert.equal(data.sources.find(s=>s.id==='student-money').summary!==null,true);
});
test('unavailable responses are retryable, non-indexable and link directly to official guidance',async()=>{
 const r=unavailable();assert.equal(r.status,503);assert.equal(r.headers.get('retry-after'),'60');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex');
 assert.match(await r.text(),/https:\/\/www.gov.uk\/browse\/visas-immigration/);
});
