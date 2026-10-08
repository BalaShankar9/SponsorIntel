import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { database } from './research-db.mjs';
import { BOARDS, normaliseBoardJobs, storeBoardJobs, getJobDetail } from '../worker/jobs.js';
import { jobStructuredData } from '../shared/job-detail.js';
import { originalJobPublication } from '../shared/job-posting.js';
import { advertHTMLText } from '../worker/advert-text.js';

const now = Date.parse('2026-10-08T15:00:00Z');
const board = BOARDS.find(b => b.id === 'gocardless');
const first = '2026-08-03T09:30:00.000Z';
const raw = patch => ({id:1234,internal_job_id:5678,title:'Graduate systems engineer',
  location:{name:'Leeds, UK'},content:'<p>Build useful tools &amp; maintain reliable systems.</p><p>Requirements: explain your experience with tests, monitoring and documentation. The expression x &lt; y is part of our example.</p>',
  absolute_url:'https://job-boards.greenhouse.io/gocardless/jobs/1234',
  first_published:'2026-08-03T10:30:00+01:00',updated_at:'2026-10-07T10:30:00+01:00',...patch});
async function record(patch = {}) {
  return {...(await normaliseBoardJobs([raw(patch)],board,now))[0],active:1,
    first_seen:new Date(now-86400000).toISOString(),last_seen:new Date(now).toISOString()};
}
const posting = j => jobStructuredData(j,now)['@graph'].find(x => x['@type']==='JobPosting');

test('original publication comes only from explicit valid Greenhouse first_published', async () => {
  const j = await record();
  assert.equal(j.source_first_published_at,first);
  assert.equal(originalJobPublication(j,now),first);
  for(const v of [null,undefined,'','2026-02-30T10:00:00Z','2027-01-01T10:00:00Z','2026-10-07','2026-10-07T10:00','2026-10-07T25:00:00Z',42,{}])
    assert.equal((await record({first_published:v})).source_first_published_at,null);
  for(const provider of ['ashby','lever','university-rss']) {
    const [other] = await normaliseBoardJobs([raw({publishedAt:first,descriptionPlain:'A complete source advert.'})],{...board,provider},now);
    assert.equal(other.source_first_published_at,null);
    assert.equal(originalJobPublication({...j,provider},now),null);
  }
});

test('atomic refresh preserves the original date across edits and never substitutes observation dates', async t => {
  const env=database(t); const j=await record();
  await storeBoardJobs(env.DB,board,[j],new Date(now).toISOString());
  const edited=await record({updated_at:new Date(now).toISOString(),content:raw().content+'<p>Additional requirement.</p>'});
  await storeBoardJobs(env.DB,board,[edited],new Date(now+1000).toISOString());
  assert.equal((await getJobDetail(j.id,env)).source_first_published_at,first);
  const missing=await record({first_published:null});
  await storeBoardJobs(env.DB,board,[missing],new Date(now+2000).toISOString());
  const read=await getJobDetail(j.id,env);
  assert.equal(read.source_first_published_at,null);
  assert.equal(posting(read),undefined);
  assert.equal(read.first_seen,new Date(now).toISOString());
});

test('qualified schema uses full visible employer text, exact source date and explicit UK city only', async () => {
  const j=await record({application_deadline:'2026-10-09'}); const p=posting(j);
  assert.ok(p); assert.equal(p.datePosted,first); assert.equal(p.title,j.title);
  assert.equal(p.hiringOrganization.name,board.company);
  assert.deepEqual(p.jobLocation.address,{'@type':'PostalAddress',addressLocality:'Leeds',addressCountry:'GB'});
  assert.equal(advertHTMLText(p.description),j.description);
  assert.match(p.description,/x &lt; y/);
  assert.equal(p.validThrough,j.closes_at);
  for(const key of ['baseSalary','jobLocationType','directApply','applicantLocationRequirements','employmentType']) assert.equal(p[key],undefined);
  assert.equal(posting(await record()).validThrough,undefined);
});

test('incomplete, ambiguous, remote, expired and unsafe records receive no JobPosting', async () => {
  const j=await record();
  for(const patch of [
    {source_first_published_at:null},{source_first_published_at:'bad'},
    {source_first_published_at:'2026-10-08T15:00:01.000Z'},
    {source_first_published_at:'2026-02-30T12:00:00.000Z'},
    {active:0},{last_seen:'2026-10-01T00:00:00.000Z'},
    {closes_at:new Date(now).toISOString()},{closes_at:'invalid'},
    {id:'invalid'},{title:''},{company:''},{description:''},{description:j.title},
    {apply_url:'javascript:alert(1)'},{apply_url:'https://user:secret@example.com'},
    ...['London','London, Ontario','London, UK; Leeds, UK','Remote (UK)','London or Remote, UK','United Kingdom','Unknown, UK'].map(location=>({location})),
    {workplace:'Remote'},{description:j.description+' Work from home.'},
  ]) assert.equal(posting({...j,...patch}),undefined,JSON.stringify(patch));
  assert.equal(jobStructuredData(j,now,false)['@graph'].some(x=>x['@type']==='JobPosting'),false);
});

test('server metadata, visible source date and hydrated metadata agree; expiry removes schema', async t => {
  const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
  t.after(()=>vite.close());
  const {renderJobPage}=await vite.ssrLoadModule('/worker/job-pages.tsx');
  const template='<html><head><title>Test</title><link rel="canonical" href="https://sponsorintel.london" /><meta name="robots" content="index" /><script id="structured-data" type="application/ld+json">{}</script></head><body><div id="root"></div></body></html>';
  const assets={fetch:async()=>new Response(template)};
  const j={...await record(),last_seen:new Date().toISOString(),description:'Source statement: </script><script>alert(1)</script>\nFinal fact retained.'};
  const parse=html=>JSON.parse(html.match(/id="structured-data">([^]*?)<\/script>/)[1]);
  const html=await (await renderJobPage(new Request('https://sponsorintel.london/jobs/'+j.id+'?utm_source=test'),assets,j)).text();
  assert.deepEqual(parse(html),jobStructuredData(j));
  assert.match(html,/Originally published by the employer/);
  assert.match(html,new RegExp('datetime="'+first+'"','i'));
  assert.match(html,/Final fact retained/);
  assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
  assert.ok(!html.match(/rel="canonical"[^>]+/)[0].includes('utm_source'));
  const expired=await (await renderJobPage(new Request('https://sponsorintel.london/jobs/'+j.id),assets,{...j,closes_at:'2020-01-01T00:00:00.000Z'})).text();
  assert.equal(parse(expired)['@graph'].some(x=>x['@type']==='JobPosting'),false);
  const fallback=await renderJobPage(new Request('https://example.workers.dev/jobs/'+j.id),assets,j);
  assert.match(fallback.headers.get('x-robots-tag'),/noindex/);
  assert.equal(parse(await fallback.text())['@graph'].some(x=>x['@type']==='JobPosting'),false);
});
