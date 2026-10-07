import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUniversityFeed, normaliseBoardJobs, fetchBoard, BOARDS } from '../worker/jobs.js';
import { UNIVERSITY_FEEDS } from '../worker/job-sources.js';

const id = 'university-bath', board = BOARDS.find(b => b.id === id);
const now = Date.parse('2026-10-07T10:00:00Z');
const item = ({ref='TEST-1', close='20 Oct 2026', title='Graduate Research Assistant', text='We cannot provide visa sponsorship.', link=`https://www.bath.ac.uk/jobs/rss/click.aspx?ref=${ref}`}={}) => `<item><title><![CDATA[${title}]]></title><link>${link}</link><description><![CDATA[<p>${text}</p><p>Salary: &#163;31,000 per annum</p><p>Closing Date: ${close}</p>]]></description><pubDate>Mon, 05 Oct 2026 00:00:00 GMT</pubDate></item>`;
const feed = (items, title=UNIVERSITY_FEEDS[id].title) => `<?xml version="1.0"?><rss><channel><title>${title}</title>${items}</channel></rss>`;

test('university feeds preserve pay, negative sponsorship wording and a source publication date', async () => {
  const raw = parseUniversityFeed(feed(item()),id,now);
  const jobs = await normaliseBoardJobs(raw,board);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].location,'Bath, United Kingdom');
  assert.equal(jobs[0].salary_excerpt,'Salary: £31,000 per annum');
  assert.equal(jobs[0].sponsorship,'unavailable');
  assert.equal(jobs[0].source_updated_at,'2026-10-05T00:00:00.000Z');
  assert.equal(jobs[0].level,'early_career');
  assert.equal(jobs[0].apply_url,'https://www.bath.ac.uk/jobs/rss/click.aspx?ref=TEST-1');
});

test('RSS campus identity cannot silently widen to a whole-university or foreign campus feed', () => {
  for (const title of ['Jobs at Bath', 'Jobs at Bath | Overseas', 'Sign in'])
    assert.throws(()=>parseUniversityFeed(feed(item(),title),id,now), /identity/);
  assert.throws(()=>parseUniversityFeed(feed(item()),'unreviewed-university',now), /Invalid/);
});

test('closing dates expire by the UK calendar, including summer time and the autumn clock change', () => {
  const xml=feed(item({close:'24 Oct 2026'}));
  assert.equal(parseUniversityFeed(xml,id,Date.parse('2026-10-24T22:59:59Z')).length,1);
  assert.equal(parseUniversityFeed(xml,id,Date.parse('2026-10-24T23:00:00Z')).length,0);
  const winter=feed(item({close:'25 Oct 2026'}));
  assert.equal(parseUniversityFeed(winter,id,Date.parse('2026-10-25T23:59:59Z')).length,1);
  assert.equal(parseUniversityFeed(winter,id,Date.parse('2026-10-26T00:00:00Z')).length,0);
  assert.throws(()=>parseUniversityFeed(feed(item({close:'31 Nov 2026'})),id,now), /Invalid university closing/);
  assert.throws(()=>parseUniversityFeed(feed(item({close:'not supplied'})),id,now), /closing date/);
});

test('unsafe links, missing fields, duplicate records and future publication dates fail the whole RSS read', () => {
  const broken=[
    feed(item({link:'https://attacker.example/apply?ref=TEST-1'})),
    feed(item({link:'https://secret@www.bath.ac.uk/jobs/rss/click.aspx?ref=TEST-1'})),
    feed(item({link:'https://www.bath.ac.uk/jobs/rss/click.aspx?ref=../admin'})),
    feed(item()).replace(/<pubDate>.*?<\/pubDate>/,''),
    feed(item()).replace('Mon, 05 Oct 2026','Thu, 08 Oct 2026'),
    feed(item()+item()),
  ];
  for(const xml of broken) assert.throws(()=>parseUniversityFeed(xml,id,now));
});

test('malformed XML and entity declarations cannot masquerade as an empty successful refresh', () => {
  for(const xml of ['<html>blocked</html>',feed(item()).slice(0,-6),'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+feed(item())])
    assert.throws(()=>parseUniversityFeed(xml,id,now));
  assert.deepEqual(parseUniversityFeed(feed(''),id,now),[]);
  assert.throws(()=>parseUniversityFeed(feed(Array.from({length:201},(_,i)=>item({ref:'A'+i})).join('')),id,now),/limit/);
});

test('European Lever sources use the documented EU endpoint and still exclude overseas-only roles', async(t) => {
  const realFetch=globalThis.fetch; t.after(()=>globalThis.fetch=realFetch);
  let called;
  globalThis.fetch=async(url,options)=>{
    called=url;assert.equal(options.redirect,'manual');
    return Response.json([
      {id:'uk',text:'Clinical Product Lead',country:'GB',categories:{location:'London'},hostedUrl:'https://jobs.eu.lever.co/numan/uk',descriptionPlain:'A UK role.'},
      {id:'overseas',text:'Analyst',country:'PT',categories:{location:'Portugal'},hostedUrl:'https://jobs.eu.lever.co/numan/overseas',descriptionPlain:'A Portugal role.'},
    ]);
  };
  const jobs=await fetchBoard(BOARDS.find(b=>b.id==='numan'));
  assert.equal(called,'https://api.eu.lever.co/v0/postings/numan?mode=json');
  assert.equal(jobs.length,1);assert.equal(jobs[0].sponsorship,'not_stated');
});

test('RSS fetching uses only the configured campus URL, preserves source encoding and rejects non-200 responses', async(t)=>{
  const realFetch=globalThis.fetch; t.after(()=>globalThis.fetch=realFetch);
  let called;
  const xml=feed(item({text:'A café role. No visa sponsorship.',close:'20 Oct 2099'}));
  globalThis.fetch=async(url)=>{called=url;return new Response(Buffer.from(xml,'latin1'));};
  const jobs=await fetchBoard(board);
  assert.equal(called,UNIVERSITY_FEEDS[id].url);assert.match(jobs[0].description,/café/);
  const gm=BOARDS.find(b=>b.id==='university-greater-manchester');
  const gmXML=feed(item({text:'A café role.',close:'20 Oct 2099',link:'https://jobs.greatermanchester.ac.uk/RSS/click.aspx?ref=TEST-1'}),UNIVERSITY_FEEDS[gm.id].title);
  globalThis.fetch=async()=>new Response(gmXML);
  assert.match((await fetchBoard(gm))[0].description,/café/);
  globalThis.fetch=async()=>new Response('unavailable',{status:503});
  await assert.rejects(fetchBoard(board),/unavailable/);
  await assert.rejects(fetchBoard({...board,id:'attacker',url:'https://attacker.example'}),/Unreviewed/);
});
