import assert from 'node:assert/strict';
import { readInitialJobs,readJobSearch,jobSearchPath } from '../shared/job-search.js';
import { jobSearchPageHealth } from '../worker/job-search-health.js';

const origin=(process.argv[2]||'http://127.0.0.1:8799').replace(/\/$/,'');
const get=path=>fetch(origin+path,{headers:{'User-Agent':'SponsorIntel-public-search-check/1.0'},signal:AbortSignal.timeout(15000)});
const checks=[];
for(const search of ['', '?page=2', '?sponsorship=mentioned', '?q=SponsorIntelNoMatchingRoleQA']) {
  const response=await get('/jobs'+search),html=await response.text();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('etag'),null);
  const actualSearch=new URL(response.url).search;
  const data=readInitialJobs(html.match(/id="jobs-data">([^<]*)<\/script>/)?.[1],actualSearch);
  assert.ok(data,'fresh, query-bound initial snapshot');
  const {items,total,page}=data.result;
  const ids=[...html.matchAll(/<a class="vacancy-title" href="\/jobs\/([a-f0-9]{24})"/g)].map(x=>x[1]);
  assert.deepEqual(ids,items.map(x=>x.id));
  assert.equal(ids.length,Math.min(12,Math.max(0,total-(page-1)*12)));
  const api=await(await get('/api/jobs'+actualSearch)).json();
  assert.deepEqual(ids,api.items.map(x=>x.id),'initial response matches the current public API');
  assert.equal(total,api.total);
  const path=jobSearchPath(readJobSearch(actualSearch),page).replace(/&/g,'&amp;');
  assert.ok(html.includes('rel="canonical" href="https://sponsorintel.london'+path+'"'));
  if(search.includes('sponsorship=')||search.includes('q='))assert.match(response.headers.get('x-robots-tag'),/noindex/);
  assert.match(html,/<form id="job-search" action="\/jobs" method="get"/);
  for(const name of ['licence','sponsorship','level','sector','salary'])assert.ok(html.includes('form="job-search" name="'+name+'"'));
  assert.doesNotMatch(html,/Finding roles|job-skeleton|"@type":"JobPosting"/);
  const ownerPreloads=[...html.matchAll(/<link[^>]+modulepreload[^>]+>/g)].filter(x=>/owner-/.test(x[0]));
  assert.equal(ownerPreloads.length,0);
  if(!search)assert.equal((await jobSearchPageHealth(new Response(html))).ok,true);
  checks.push({path:'/jobs'+search,status:response.status,total,visible_roles:ids.length,page,canonical:'https://sponsorintel.london'+jobSearchPath(readJobSearch(actualSearch),page),cache:'no-store',html_api_agree:true});
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),origin,checks},null,2));
