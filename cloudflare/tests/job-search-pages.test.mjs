import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { database } from './research-db.mjs';
import { jobsAPI } from '../worker/jobs.js';
import { readJobSearch, jobSearchPath, readInitialJobs } from '../shared/job-search.js';
import { jobSearchPageHealth } from '../worker/job-search-health.js';

let vite, render, unavailable, metadata;
before(async () => {
  vite = await createServer({server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
  ({jobSearchHTML:render,jobSearchUnavailable:unavailable}=await vite.ssrLoadModule('/worker/job-search-pages.tsx'));
  ({jobsPageMetadata:metadata}=await vite.ssrLoadModule('/src/seo.ts'));
});
after(() => vite?.close());
function seed(t, count=14) {
  const env=database(t), now=Date.now(), stamp=new Date(now).toISOString();
  const insert=env.sql.prepare("INSERT INTO jobs(id,board_id,company,title,location,description,apply_url,provider,sponsorship,evidence,level,first_seen,last_seen,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)");
  for(let i=1;i<=count;i++) insert.run(i.toString(16).padStart(24,'0'),'monzo','Fictional QA Employer','Role '+String(i).padStart(2,'0'),'London','Fictional test vacancy','https://example.invalid/role/'+i,'greenhouse',i%2?'conditional':'not_stated','Source wording','early_career',stamp,stamp);
  return {env,now};
}
const result=(env,search='',now=Date.now())=>jobsAPI(new URL('https://sponsorintel.london/api/jobs'+search),env,now).then(r=>r.json());

test('initial collection HTML contains exact API roles and ordinary role/pagination links',async t=>{
  const {env,now}=seed(t), data=await result(env,'',now), html=render(data,'');
  assert.equal(data.total,14);assert.equal(data.items.length,12);
  assert.equal((html.match(/class="vacancy-card"/g)||[]).length,12);
  for(const item of data.items) assert.ok(html.includes('href="/jobs/'+item.id+'"'));
  assert.match(html,/14 matching roles/);assert.match(html,/href="\/jobs\?page=2"/);
  assert.match(html,/<form id="job-search" action="\/jobs" method="get"/);
  for(const key of ['licence','sponsorship','level','sector','salary'])assert.ok(html.includes('form="job-search" name="'+key+'"'));
  assert.doesNotMatch(html,/Finding roles|job-skeleton|JobPosting/);
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.match(html,/Save search<\/button>/);assert.match(html,/disabled=""/);
});
test('filter and pagination responses retain matching records and sequential self-canonical URLs',async t=>{
  const {env,now}=seed(t,28), data=await result(env,'?sponsorship=mentioned&page=2',now);
  assert.equal(data.total,14);assert.equal(data.items.length,2);assert.equal(data.page,2);
  const html=render(data,'?sponsorship=mentioned&page=2');
  assert.match(html,/href="\/jobs\?sponsorship=mentioned"/);assert.match(html.replace(/<!--.*?-->/g,''),/Page 2 of 2/);
  assert.ok(data.items.every(j=>j.sponsorship==='conditional'));
  assert.equal(metadata(readJobSearch('?page=2&utm_source=facebook'),2).path,'/jobs?page=2');
  assert.equal(metadata(readJobSearch('?page=2'),2).indexable,true);
  assert.equal(metadata(readJobSearch('?sponsorship=mentioned&page=2'),2).indexable,false);
});
test('each server read excludes newly closed, stale and passed-deadline roles without changing observation dates',async t=>{
  const {env,now}=seed(t,4);const before=await result(env,'',now);
  const one='1'.padStart(24,'0'),two='2'.padStart(24,'0'),three='3'.padStart(24,'0');
  env.sql.prepare('UPDATE jobs SET active=0 WHERE id=?').run(one);
  env.sql.prepare("UPDATE jobs SET last_seen='2000-01-01T00:00:00.000Z' WHERE id=?").run(two);
  env.sql.prepare('UPDATE jobs SET closes_at=? WHERE id=?').run(new Date(now-1).toISOString(),three);
  const after=await result(env,'',now),html=render(after,'');
  assert.equal(after.total,1);assert.equal(after.items[0].last_seen,before.items[0].last_seen);
  for(const id of [one,two,three])assert.ok(!html.includes('/jobs/'+id));
});
test('snapshot validity ends at the earliest collection deadline or observation expiry',async t=>{
  const {env,now}=seed(t,2);
  env.sql.prepare('UPDATE jobs SET closes_at=? WHERE id=?').run(new Date(now+1000).toISOString(),'1'.padStart(24,'0'));
  let data=await result(env,'',now);assert.equal(Date.parse(data.valid_until),now+1000);
  env.sql.prepare('UPDATE jobs SET closes_at=NULL,last_seen=? WHERE id=?').run(new Date(now-3*86400000+500).toISOString(),'1'.padStart(24,'0'));
  data=await result(env,'',now);assert.equal(Date.parse(data.valid_until),now+500);
});
test('browser bootstrap expires, binds the search, and cannot revive an expired role',async t=>{
  const {env,now}=seed(t,1), data=await result(env,'',now), raw=JSON.stringify({path:'/jobs',result:data});
  assert.ok(readInitialJobs(raw,'?utm_source=facebook',now));
  assert.equal(readInitialJobs(raw,'?q=other',now),null);
  assert.equal(readInitialJobs(raw,'?page=2',now),null);
  assert.equal(readInitialJobs(raw,'',now+60000),null);
  assert.equal(readInitialJobs(raw,'',now-5001),null);
  data.items[0].closes_at=new Date(now-1).toISOString();
  assert.equal(readInitialJobs(JSON.stringify({path:'/jobs',result:data}),'',now),null);
  assert.equal(readInitialJobs('{bad','',now),null);
});
test('a fresh but unavailable register never creates licence claims in initial HTML',async t=>{
  const {env,now}=seed(t,1), data=await result(env,'',now), html=render(data,'');
  assert.equal(data.licence_register.available,false);
  assert.match(html,/Licence links are temporarily hidden/);
  assert.doesNotMatch(html,/class="employer-licence-tag"/);
  assert.match(html,/Conditional sponsorship/);
  assert.match(html,/A sponsor licence and a sponsored vacancy are different/);
});
test('source and search text are escaped and unknown/tracking fields cannot enter generated links',async t=>{
  const {env,now}=seed(t,1), data=await result(env,'',now);
  data.items[0].title='Role </a><script>alert(1)</script> $&';
  const html=render(data,'?q=%22%3E%3Cimg%20src%3Dx%3E');
  assert.doesNotMatch(html,/<script>alert|<img src=x/);assert.match(html,/&lt;script&gt;alert/);
  const filters=readJobSearch('?q=engineer&utm_source=facebook&email=private&licence=invalid&sponsorship=fake');
  assert.equal(jobSearchPath(filters,2),'/jobs?q=engineer&page=2');
});
test('empty collections are truthful and failures are retryable rather than an indexable zero-jobs page',async t=>{
  const {env,now}=seed(t,0), data=await result(env,'',now),html=render(data,'');
  assert.equal(data.total,0);assert.match(html,/0 matching roles/);assert.match(html,/href="\/jobs"[^>]*>Clear filters/);
  const response=unavailable();assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('retry-after'),'60');assert.equal(response.headers.get('x-robots-tag'),'noindex');
  assert.match(await response.text(),/does not mean there are no jobs/);
});

test('hourly public-content check accepts current roles or a real empty result and catches regressions',async t=>{
  const {env,now}=seed(t,14), data=await result(env,'',now);
  const page = data => '<link rel="canonical" href="https://sponsorintel.london/jobs">'+render(data,'')+'<script type="application/json" id="jobs-data">'+JSON.stringify({path:'/jobs',result:data})+'</script>';
  const html=page(data), check=text=>jobSearchPageHealth(new Response(text),now);
  const receipt=await check(html);
  assert.deepEqual(receipt,{ok:true,visible_roles:12,matching_roles:14,generated_at:data.generated_at});
  assert.doesNotMatch(JSON.stringify(receipt),/Fictional|example.invalid/);
  for(const broken of ['',html.replace('class="vacancy-title"','class="broken-link"'),html.replace('href="/jobs?page=2"','href="#"'),html.replace('id="jobs-data"','id="missing"'),html.replace(data.generated_at,new Date(now-60001).toISOString())])assert.equal((await check(broken)).ok,false);
  assert.equal((await check('x'.repeat(2_000_001))).reason,'unreadable_or_oversized_response');
  env.sql.prepare('DELETE FROM jobs').run();
  assert.equal((await check(page(await result(env,'',now)))).ok,true);
});
