// Optional local-only QA. Supply an already built --pack and existing Playwright/Chrome.
// No installation, profile credentials, website requests or production mutations.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
const index = process.argv.indexOf('--pack');
if (index < 0 || !process.argv[index + 1]) throw new Error('Supply --pack <existing directory>');
const pack = resolve(process.argv[index + 1]);
const data = JSON.parse(await readFile(join(pack, 'data.json'), 'utf8'));
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE});
const context = await browser.newContext({viewport:{width:1360,height:960},acceptDownloads:true});
const errors = [], unexpectedRequests = [], checks = [];
const qa = join(pack, 'qa');
await mkdir(qa, {recursive:true});
await context.route('**/*', route => {
  if (/^(file:|blob:|data:)/.test(route.request().url())) return route.continue();
  unexpectedRequests.push(route.request().url()); return route.abort();
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
try {
  const start = performance.now();
  await page.goto(pathToFileURL(join(pack,'index.html')).href, {waitUntil:'load'});
  await page.locator('.entry').first().waitFor();
  const loadMs = Math.round(performance.now()-start);
  check('complete embedded entry count', await page.locator('#entry-count').innerText() === data.meta.grouped_entries.toLocaleString('en-GB'));
  check('only one page rendered', await page.locator('.entry').count() === Math.min(30,data.entries.length));
  check('paired source row denominator shown', await page.locator('#source-row-count').innerText() === data.meta.source_rows.toLocaleString('en-GB'));
  const firstName = await page.locator('.entry-name').first().innerText();
  await page.locator('#next').click();
  check('pagination changes entries', await page.locator('.entry-name').first().innerText() !== firstName);
  await page.locator('#previous').click();
  check('pagination restores first page', await page.locator('.entry-name').first().innerText() === firstName);
  await page.screenshot({path:join(qa,'desktop.png'),fullPage:false});
  const sample = data.entries.find(row => row[2] && row[4].length > 1) || data.entries[0];
  await page.locator('#search').fill(sample[1]);
  await page.locator('#city').fill(sample[2]);
  await page.locator('#route').selectOption(sample[4][0][0]);
  await page.locator('#search').press('Enter');
  const norm = value => value.trim().replace(/\s+/g,' ').toLowerCase();
  const words = norm(sample[1]).split(' ');
  const expected = data.entries.filter(row => (!sample[2] || norm(row[2]) === norm(sample[2])) && row[4].some(pair=>pair[0]===sample[4][0][0]) && words.every(word => norm(row.slice(1,4).join(' ')).includes(word)));
  check('combined filters match independent data calculation', (await page.locator('#result-count').innerText()).includes('of '+expected.length.toLocaleString('en-GB')+' entries'));
  const card = page.locator('.entry').filter({has:page.locator('.entry-name').getByText(sample[1],{exact:true})}).first();
  await card.click();
  check('selected dossier names exact entry', await page.locator('#dossier-name').innerText() === sample[1]);
  const renderedPairs = await page.locator('.licence-row').evaluateAll(rows=>rows.map(row=>[row.querySelector('strong').textContent,row.querySelector('span').textContent]));
  assert.deepEqual(renderedPairs,sample[4]); checks.push('route-rating pairs survive display');
  check('unverified business fields stay unknown', (await page.locator('#business-facts').innerText()).includes('Not collected'));
  check('research plan uses exact organisation', (await page.locator('#research-plan').innerText()).includes(sample[1]));
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-dossier').click();
  const download = await downloadPromise;
  const exportPath = join(qa,'downloaded-dossier.json'); await download.saveAs(exportPath);
  const exported = JSON.parse(await readFile(exportPath,'utf8'));
  assert.equal(exported.register_entry.local_record_key,sample[0]);
  assert.deepEqual(exported.register_entry.licences,sample[4].map(([route,rating])=>({route,rating})));
  assert.equal(exported.business_profile.status,'not_collected');
  checks.push('actual saved dossier export retains source and unknown state');
  await page.keyboard.press('Escape');
  check('Escape closes dialog and restores focus', await page.locator('#dossier-dialog').evaluate(el=>!el.open) && await card.evaluate(el=>el===document.activeElement));
  await page.locator('#search').fill('NO_MATCH_FICTIONAL_QA_592ef');
  await page.locator('#search').press('Enter');
  check('empty results are explicit', await page.locator('#result-count').innerText() === '0 matching entries');
  await page.locator('#clear').click();
  check('clear restores directory', await page.locator('.entry').count() === Math.min(30,data.entries.length));
  const historicalSubjects = Object.entries(data.evidence?.subjects || {});
  if (historicalSubjects.length) {
    await page.locator('#has-evidence').check();
    check('historical filter count matches supplied subjects', (await page.locator('#result-count').innerText()).endsWith('of '+historicalSubjects.length.toLocaleString('en-GB')+' entries'));
    for (const [key,subject] of historicalSubjects) {
      const row=data.entries.find(entry=>entry[0]===key); assert.ok(row,'evidence has an exact register entry');
      await page.locator('#clear').click(); await page.locator('#search').fill(row[1]); await page.locator('#city').fill(row[2]); await page.locator('#search').press('Enter');
      await page.locator('.entry').filter({has:page.locator('.entry-name').getByText(row[1],{exact:true})}).filter({hasText:[row[2],row[3]].filter(Boolean).join(' · ')}).first().click();
      assert.equal(await page.locator('#dossier-name').innerText(),row[1]);
      assert.equal(await page.locator('.claim > .claim-state').count(),subject.claims.length);
      assert.equal(await page.locator('.claim-evidence[open]').count(),0);
      const labels={trading_name:'Trading name',website_operator:'Website operated by the licence holder',operating_organisation:'Operating organisation',subsidiary:'Subsidiary relationship',group_relationship:'Group relationship'};
      const visibleValues=await page.locator('.claim-value').allTextContents();
      for (const claim of subject.claims) assert.ok(visibleValues.includes(claim.field==='relationship'?labels[claim.value]:claim.value),'every supplied claim is visible');
      const sourceIds=new Set(subject.claims.flatMap(claim=>claim.observation_ids));
      const expectedObservations=data.evidence.observations.filter(observation=>sourceIds.has(observation.id));
      const links=await page.locator('#historical-panel a').evaluateAll(nodes=>nodes.map(node=>node.href));
      for (const observation of expectedObservations) assert.ok(links.includes(observation.url),'original source link retained');
      await page.locator('.claim-evidence').first().locator('summary').first().click();
      const pending=page.waitForEvent('download'); await page.locator('#export-dossier').click();
      const saved=join(qa,'historical-dossier-'+key.slice(0,16)+'.json'); await (await pending).saveAs(saved);
      const actual=JSON.parse(await readFile(saved,'utf8'));
      assert.equal(actual.register_entry.local_record_key,key);
      assert.equal(actual.source.sha256,data.meta.source_sha256);
      assert.deepEqual(actual.retained_evidence.subject,subject);
      assert.deepEqual(actual.retained_evidence.observations,expectedObservations);
      assert.equal(actual.retained_evidence.review_status,'owner_review_required');
      assert.equal(actual.retained_evidence.prepared_at,data.evidence.prepared_at);
      assert.equal(actual.retained_evidence.packet_sha256,data.evidence.packet_sha256);
      assert.equal(actual.business_profile.current_vacancies,null); assert.equal(actual.business_profile.role_sponsorship,null);
      await page.keyboard.press('Escape');
    }
    checks.push('every real historical dossier displays all claims and exports exact source/date/follow-up evidence without current-job claims');
    await page.locator('#clear').click();
  }
  await page.setViewportSize({width:390,height:844});
  check('mobile page has no horizontal overflow', await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:join(qa,'mobile.png'),fullPage:false});
  await page.locator('.entry').first().click();
  check('mobile dossier fits viewport', await page.locator('#dossier-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth));
  await page.screenshot({path:join(qa,'mobile-dossier.png'),fullPage:false});
  if (historicalSubjects.length) {
    await page.keyboard.press('Escape'); await page.locator('#has-evidence').check(); await page.locator('.entry').first().click();
    check('real historical mobile dossier fits viewport', await page.locator('#dossier-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth));
    await page.screenshot({path:join(qa,'historical-mobile.png'),fullPage:false});
    const desktopPage=await context.newPage(); desktopPage.on('pageerror',error=>errors.push(error.message));
    try {
      await desktopPage.goto(pathToFileURL(join(pack,'index.html')).href,{waitUntil:'load'});
      await desktopPage.locator('#has-evidence').check(); await desktopPage.locator('.entry').first().click();
      await desktopPage.screenshot({path:join(qa,'historical-desktop.png'),fullPage:false});
    } finally { await desktopPage.close(); }
  }
  check('no page errors', errors.length===0); check('no background network requests', unexpectedRequests.length===0);
  const receipt={observed_at:new Date().toISOString(),scope:'local offline generated register pack',source_sha256:data.meta.source_sha256,entries:data.entries.length,historical_subjects:historicalSubjects.length,historical_claims:historicalSubjects.reduce((sum,[,subject])=>sum+subject.claims.length,0),newly_verified_businesses:0,load_ms_local:loadMs,checks,errors,unexpected_requests:unexpectedRequests,production_requests:0};
  await writeFile(join(qa,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
} finally { await context.close(); await browser.close(); }
