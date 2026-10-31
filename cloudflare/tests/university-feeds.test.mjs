import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUniversityFeed, universityFeedSnapshot, universityRestriction, normaliseBoardJobs, fetchBoard, BOARDS } from '../worker/jobs.js';
import { UNIVERSITY_FEEDS, universityFeedIds, sourceRequestCost } from '../worker/job-sources.js';

const id = 'university-bath', board = BOARDS.find(b => b.id === id);
const now = Date.parse('2026-10-07T10:00:00Z');
const item = ({ref='TEST-1', close='20 Oct 2026', title='Graduate Research Assistant', text='We cannot provide visa sponsorship.', link=`https://www.bath.ac.uk/jobs/rss/click.aspx?ref=${ref}`}={}) => `<item><title><![CDATA[${title}]]></title><link>${link}</link><description><![CDATA[<p>${text}</p><p>Salary: &#163;31,000 per annum</p><p>Closing Date: ${close}</p>]]></description><pubDate>Mon, 05 Oct 2026 00:00:00 GMT</pubDate></item>`;
const feed = (items, title=UNIVERSITY_FEEDS[id].title) => `<?xml version="1.0"?><rss><channel><title>${title}</title>${items}</channel></rss>`;

test('university feeds preserve pay, negative sponsorship wording and a source publication date', async () => {
  const raw = parseUniversityFeed(feed(item()),id,now);
  const jobs = await normaliseBoardJobs(raw,board,now);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].location,'Bath, United Kingdom');
  assert.equal(jobs[0].salary_excerpt,'Salary: £31,000 per annum');
  assert.equal(jobs[0].sponsorship,'unavailable');
  assert.equal(jobs[0].source_updated_at,'2026-10-05T00:00:00.000Z');
  assert.equal(jobs[0].level,'early_career');
  assert.equal(jobs[0].application_deadline,'2026-10-20');
  assert.equal(jobs[0].closes_at,'2026-10-20T23:00:00.000Z');
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


test('explicit staff-only vacancies are excluded without confusing secondment or external applicants',()=>{
 for(const [title,text] of [['Administrator (Internal Only)','A role.'],['Administrator','This role is restricted to current employees.'],['Administrator','This vacancy is open only to existing staff.'],['Administrator','The role is open to internal candidates only.']])assert.equal(universityRestriction(title,text),'internal_only');
 for(const [title,text] of [['Internal Auditor','Work with internal colleagues.'],['Administrator','Requests for secondment from internal candidates may be considered.'],['Administrator','This role is open to internal candidates and external applicants.'],['Administrator','This role is not restricted to current staff.']])assert.equal(universityRestriction(title,text),null);
 assert.equal(universityRestriction('Researcher','#INT',UNIVERSITY_FEEDS['university-nottingham']),'unreviewed_distribution_marker');
 assert.equal(universityRestriction('Researcher','#INT',UNIVERSITY_FEEDS[id]),null);
});

test('campus parsing retains separate exclusion reasons and never changes exclusions into sponsorship claims',()=>{
 const nid='university-nottingham',nf=UNIVERSITY_FEEDS[nid];
 const nitem=o=>item({...o,link:nf.origin+nf.path+'?ref='+o.ref});
 const xml=feed(nitem({ref:'OPEN',text:'Internal candidates may request a secondment.'})+nitem({ref:'STAFF',title:'Administrator (Internal Only)'})+nitem({ref:'OLD',close:'01 Oct 2026'})+nitem({ref:'MARKER',text:'Research role. #LI-DNI'}),nf.title);
 const snapshot=universityFeedSnapshot(xml,nid,now);assert.equal(snapshot.jobs.length,1);assert.equal(snapshot.review.received,4);assert.equal(snapshot.review.accepted,1);assert.deepEqual(snapshot.review.excluded.map(x=>x.reason),['internal_only','closing_date_passed','unreviewed_distribution_marker']);assert.equal(snapshot.jobs[0].location,'University Park, Nottingham, United Kingdom');
 for(const title of ['Jobs at the University of Nottingham','Jobs at the University of Nottingham | Ningbo'])assert.throws(()=>universityFeedSnapshot(xml.replace(nf.title,title),nid,now),/identity/);
 const sf=UNIVERSITY_FEEDS['university-southampton'];assert.throws(()=>parseUniversityFeed(feed(item(),sf.title),'university-southampton',now),/link/);
});

test('new campus fetches keep source bytes, stable links and private exclusion receipts',async t=>{
 const realFetch=globalThis.fetch;t.after(()=>globalThis.fetch=realFetch);
 for(const name of ['nottingham','southampton']){
  const bid='university-'+name,f=UNIVERSITY_FEEDS[bid],b=BOARDS.find(x=>x.id===bid);
  const xml=feed(item({ref:'NEW',close:'20 Oct 2099',text:'A café role – with original source details.',link:f.origin+f.path+'?ref=NEW'}),f.title).replace('<?xml version="1.0"?>','<?xml version="1.0" encoding="ISO-8859-1"?>');
  globalThis.fetch=async(url,options)=>{assert.equal(url,f.url);assert.equal(options.redirect,'manual');return new Response(new TextEncoder().encode(xml));};
  const jobs=await fetchBoard(b);assert.equal(jobs.length,1);assert.match(jobs[0].description,/café role –/);assert.equal(jobs[0].sponsorship,'not_stated');assert.equal(jobs.feed_review.received,1);assert.equal(jobs.feed_review.excluded.length,0);assert.doesNotMatch(JSON.stringify(jobs),/feed_review/);
 }
});

const cardiff = BOARDS.find(b=>b.id==='university-cardiff-met');
function campusXML(feedId, records) {
 const campus=UNIVERSITY_FEEDS[feedId];
 return feed(records.map(record=>item({...record,close:record.close||'20 Oct 2099',link:campus.origin+campus.path+'?ref='+record.ref})).join(''),campus.title);
}
function campusFetch(t, responses) {
 const real=globalThis.fetch;t.after(()=>globalThis.fetch=real);
 const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');
  if(!Object.hasOwn(responses,url))throw Error('unreviewed destination');
  const response=responses[url]; return typeof response==='string'?new Response(response):response;
 };
 return calls;
}

test('only-available staff/student restrictions are retained without inventing visa exclusions',()=>{
 assert.equal(universityRestriction('Researcher','This opportunity is only available to current employees and students at the University'),'internal_only');
 assert.equal(universityRestriction('Researcher','Applications are exclusively open to existing employees.'),'internal_only');
 for(const text of ['This opportunity is not only available to current employees; external applicants are welcome.','This opportunity is available to current employees and external applicants.','Students and employees contribute to this research.'])
  assert.equal(universityRestriction('Researcher',text),null);
});

test('two reviewed campuses produce one employer with exact source text, one shared vacancy and two reserved requests',async t=>{
 const ids=universityFeedIds(cardiff.id), [a,b]=ids, responses={};
 const shared={ref:'SHARED',text:'A café role – salary and visa details are in the advert.'};
 responses[UNIVERSITY_FEEDS[a].url]=campusXML(a,[shared,{ref:'COACH',title:'Sports Coach',text:'If your visa restricts employment as a professional sports coach, you are unlikely to be eligible for this role.'}]);
 responses[UNIVERSITY_FEEDS[b].url]=campusXML(b,[shared,{ref:'STAFF',text:'This opportunity is only available to current employees and students at the University.'}]);
 const calls=campusFetch(t,responses), jobs=await fetchBoard(cardiff);
 assert.equal(sourceRequestCost(cardiff),2);assert.equal(sourceRequestCost(board),1);assert.equal(calls.length,2);
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.board_id===cardiff.id&&j.company===cardiff.company&&j.sponsorship==='not_stated'));
 const sharedJob=jobs.find(j=>j.apply_url.endsWith('SHARED'));
 assert.match(sharedJob.location,/Cyncoed Campus.*Llandaff Campus/);assert.match(sharedJob.description,/café role –/);
 assert.match(jobs.find(j=>j.apply_url.endsWith('COACH')).description,/visa restricts employment/);
 assert.equal(jobs.feed_review.received,4);assert.equal(jobs.feed_review.accepted,2);assert.equal(jobs.feed_review.duplicate_refs,1);
 assert.deepEqual(jobs.feed_review.excluded,[{ref:'STAFF',reason:'internal_only',feed_id:b}]);
 assert.equal(jobs.feed_review.feeds.length,2);assert.doesNotMatch(JSON.stringify(jobs),/feed_review/);
});

test('a failed or swapped second campus cannot publish a partial employer snapshot',async t=>{
 const [a,b]=universityFeedIds(cardiff.id), responses={};
 responses[UNIVERSITY_FEEDS[a].url]=campusXML(a,[{ref:'FIRST'}]);
 responses[UNIVERSITY_FEEDS[b].url]=new Response('Unavailable',{status:503});
 const calls=campusFetch(t,responses);
 await assert.rejects(fetchBoard(cardiff),/unavailable/);assert.equal(calls.length,2);
 responses[UNIVERSITY_FEEDS[b].url]=campusXML(a,[{ref:'WRONG-CAMPUS'}]);
 await assert.rejects(fetchBoard(cardiff),/identity/);
 await assert.rejects(fetchBoard({...cardiff,id:'unreviewed'}),/Unreviewed/);
});

test('shared campus records with conflicting content, closing dates or restrictions fail the collection',async t=>{
 const [a,b]=universityFeedIds(cardiff.id), responses={};
 responses[UNIVERSITY_FEEDS[a].url]=campusXML(a,[{ref:'SAME',text:'A public role.'}]);
 campusFetch(t,responses);
 for(const change of [{text:'Different advert wording.'},{close:'21 Oct 2099',text:'A public role.'},{text:'This opportunity is only available to current employees.'}]){
  responses[UNIVERSITY_FEEDS[b].url]=campusXML(b,[{ref:'SAME',...change}]);
  await assert.rejects(fetchBoard(cardiff),/Conflicting campus/);
 }
});
