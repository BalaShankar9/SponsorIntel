import test from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { universityFeedSnapshot } from '../worker/jobs.js';
import { UNIVERSITY_FEEDS } from '../worker/job-sources.js';

// GHSA-474x-hrwr-fgx4 needs the non-default stopNodes option. The production
// university reader does not enable it. Exercise the dependency boundary here
// without turning that option on in the application or relying on CPU timings.
test('unterminated stop-node fragments take bounded linear character inspections', () => {
  for (const fragments of [32, 128, 512]) {
    const input = '<stop>' + '<a '.repeat(fragments);
    const original = String.prototype.charCodeAt;
    let inspections = 0;
    String.prototype.charCodeAt = function (index) {
      if (String(this) === input && index >= 6) inspections++;
      return original.call(this, index);
    };
    try {
      assert.throws(() => new XMLParser({ stopNodes: ['stop'] }).parse(input), /Unexpected end/);
    } finally {
      String.prototype.charCodeAt = original;
    }
    assert.ok(inspections > 0, 'the malformed stop-node scanning path was exercised');
    assert.ok(inspections <= input.length * 4,
      `${fragments} fragments required ${inspections} character inspections for ${input.length} characters`);
  }
});

test('well-formed stop nodes preserve raw content and their following sibling', () => {
  const raw = '<a key="one > two">unprocessed &amp; content</a>';
  const result = new XMLParser({ stopNodes: ['root.stop'], parseTagValue: false })
    .parse(`<root><stop>${raw}</stop><after>kept</after></root>`);
  assert.deepEqual(result, { root: { stop: raw, after: 'kept' } });
});

test('patched parser preserves complete university text, source dates, identity and exclusions', () => {
  const id = 'university-bath', feed = UNIVERSITY_FEEDS[id];
  const item = (ref, title, description) => `<item><title><![CDATA[${title}]]></title>` +
    `<link>${feed.origin}${feed.path}?ref=${ref}</link>` +
    `<description><![CDATA[${description}<p>Closing Date: 20 Nov 2026</p>]]></description>` +
    '<pubDate>Mon, 09 Nov 2026 00:00:00 GMT</pubDate></item>';
  const xml = `<rss><channel><title>${feed.title}</title>` +
    item('SEC-OPEN', 'Research Assistant — café team', '<p>We cannot provide visa sponsorship.</p><p>Salary: &#163;31,000 per annum</p>') +
    item('SEC-HELD', 'Administrator (Internal Only)', '<p>A staff-only opportunity.</p>') +
    '</channel></rss>';
  const snapshot = universityFeedSnapshot(xml, id, Date.parse('2026-11-11T12:00:00Z'));
  assert.equal(snapshot.jobs.length, 1);
  assert.deepEqual(snapshot.jobs[0], {
    id: 'SEC-OPEN', title: 'Research Assistant — café team', location: feed.location,
    country: 'GB', content: 'We cannot provide visa sponsorship.\n Salary: £31,000 per annum\n Closing Date: 20 Nov 2026',
    application_deadline: '2026-11-20', absolute_url: `${feed.origin}${feed.path}?ref=SEC-OPEN`,
    publishedAt: '2026-11-09T00:00:00.000Z',
  });
  assert.equal(snapshot.review.received, 2);
  assert.equal(snapshot.review.accepted, 1);
  assert.deepEqual(snapshot.review.excluded, [{ ref: 'SEC-HELD', reason: 'internal_only' }]);
  assert.throws(() => universityFeedSnapshot(xml.replace(feed.title, 'Foreign campus'), id), /identity/);
  assert.throws(() => universityFeedSnapshot(xml.slice(0, -6), id), /Invalid university feed/);
});
