import test from 'node:test';
import assert from 'node:assert/strict';
import { advertHTMLText, advertPlainText } from '../worker/advert-text.js';
import { advertText, normaliseBoardJobs } from '../worker/jobs.js';

test('quoted greater-than signs and encoded HTML do not leak source attributes into adverts', () => {
  const html = '<section class="[&:has([data-example])>*]:auto" data-turn="assistant"><h2>About the job</h2><p>We cannot offer visa sponsorship.</p></section>';
  const encoded = html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  for (const input of [html, encoded]) {
    const text = advertText({content:input}, 'greenhouse');
    assert.match(text, /^About the job/);
    assert.match(text, /We cannot offer visa sponsorship\./);
    assert.doesNotMatch(text, /data-turn|class=|:auto/);
  }
});

test('HTML text preserves comparisons, entities and inline words without reparsing text nodes', () => {
  assert.equal(advertHTMLText('<p>Salary &lt; £40,000 and target &gt; 2.5.</p>'), 'Salary < £40,000 and target > 2.5.');
  assert.equal(advertHTMLText('<p>Visa spon<strong>sor</strong>ship is unavailable.</p>'), 'Visa sponsorship is unavailable.');
  assert.equal(advertHTMLText('<p>Use &lt;example&gt; in documentation. R&amp;D costs &#163;30.</p>'), 'Use <example> in documentation. R&D costs £30.');
  assert.equal(advertPlainText('Use <example>; value < 3 and score > 2.5.'), 'Use <example>; value < 3 and score > 2.5.');
});

test('scripts, styles and comments cannot supply advert evidence, including malformed endings', () => {
  assert.equal(advertHTMLText('<p>Actual vacancy</p><script>We offer visa sponsorship.</script><style>secret</style><!-- ignore -->'), 'Actual vacancy');
  assert.equal(advertHTMLText('<p>Actual vacancy</p><script>We offer visa sponsorship.'), 'Actual vacancy');
  assert.match(advertHTMLText('<p>Requirements<ul><li>Python<li>SQL</ul><p>We cannot sponsor visas.'), /Python\n+SQL\n+/);
});

test('Lever plain text takes precedence while all HTML-only requirements and salary sections survive', () => {
  const text = advertText({descriptionPlain:'Use <example>; score > 2.5.',description:'Wrong',
    lists:[{text:'Requirements',content:'<li>SQL</li><li>No visa sponsorship.</li>'}],
    additional:'<p>London</p>',salaryDescription:'<p>Salary: &pound;35,000 per annum.</p>'}, 'lever');
  assert.match(text, /Use <example>/); assert.doesNotMatch(text, /Wrong/);
  for (const part of ['Requirements','SQL','No visa sponsorship.','London','Salary: £35,000 per annum.']) assert.ok(text.includes(part));
});

test('normalisation retains the exclusion after an encoded wrapper and extracts the pay statement', async () => {
  const [job] = await normaliseBoardJobs([{id:1,internal_job_id:2,title:'Engineer',location:{name:'London'},
    absolute_url:'https://example.com/jobs/1',content:'&lt;section class=&quot;a&gt;b&quot;&gt;&lt;p&gt;We cannot offer visa sponsorship.&lt;/p&gt;&lt;p&gt;Salary: &amp;pound;35,000 per annum.&lt;/p&gt;&lt;/section&gt;'}],
  {id:'example',company:'Example',provider:'greenhouse'});
  assert.equal(job.sponsorship,'unavailable');
  assert.equal(job.evidence,'We cannot offer visa sponsorship.');
  assert.match(job.salary_excerpt,/£35,000/);
  assert.doesNotMatch(job.description,/a>b|class=/);
});
