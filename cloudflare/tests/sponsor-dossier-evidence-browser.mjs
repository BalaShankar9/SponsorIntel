// Offline, fictional UI acceptance. Uses an already installed browser and Playwright.
// node tests/sponsor-dossier-evidence-browser.mjs --playwright /path/index.mjs --chrome /path/chrome --out /tmp/receipt.json
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const args={};
for(let i=2;i<process.argv.length;i+=2) args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
if(!args.playwright||!args.chrome||!args.out) throw new Error('Supply --playwright, --chrome and --out; no browser is downloaded by this test.');
const {chromium}=await import(pathToFileURL(path.resolve(args.playwright)).href);
const templatePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/sponsor-dossiers-template.html');
const template=await fs.readFile(templatePath,'utf8');
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'si-dossier-evidence-browser-'));
const badName='</script><img src=x onerror="window.__unsafe=true">';
const primary=['a'.repeat(64),'Fictional Register Organisation','Großstadt','Example County', [['Skilled Worker','Worker (A rating)'],['Creative Worker','Temporary Worker (A rating)']],[2,3],[['Fictional Register Organisation','Großstadt','Example County'],['FICTIONAL REGISTER ORGANISATION','GROSSSTADT','Example County']]];
const blank=['b'.repeat(64),'Fictional Blank Location','','',[['Charity Worker','Temporary Worker (A rating)']],[4],[['Fictional Blank Location','','']]];
const hostile=['c'.repeat(64),badName,'Testville','',[['Skilled Worker','Worker (A rating)']],[5],[[badName,'Testville','']]];
const observation={id:'fictional-old-receipt',url:'https://example.test/original',observed_at:'2026-10-23T01:55:17Z',evidence_kind:'retained_operator_observation',summary:'A retained summary, not a quotation. '+badName,receipt_reference:'fictional-public-receipt.json',receipt_sha256:'d'.repeat(64),attribution:'Agent-assisted operator observation; fictional QA'};
const unsafeObservation={...observation,id:'fictional-unsafe-source',url:'javascript:window.__unsafe=true',summary:'Unsafe link fixture; displayed without a clickable URL.'};
const claims=[
 {field:'business_name',value:'Alias excluded from register search',observation_ids:[observation.id]},
 {field:'business_name',value:'A conflicting historic name',observation_ids:[observation.id]},
 {field:'relationship',value:'trading_name',observation_ids:[observation.id]},
 {field:'website',value:'https://example.test/business',observation_ids:[observation.id]},
 {field:'careers_url',value:'https://user:secret@example.test/private',observation_ids:[unsafeObservation.id]},
 {field:'activity',value:badName,observation_ids:[observation.id]},
];
const evidence={schema_version:1,prepared_at:'2026-11-11T16:00:00Z',packet_sha256:'e'.repeat(64),observations:[observation,unsafeObservation],subjects:{[primary[0]]:{review_status:'owner_review_required',prior_review_due_at:'2026-10-30T12:00:00Z',claims}}};
const data={schema_version:1,columns:['id','name','city','county','licences','source_rows','variants'],meta:{source_date:'2026-11-11',observed_at:'2026-11-11T15:00:00Z',source_url:'https://assets.publishing.service.gov.uk/media/fictional/2026-11-11.csv',publication_url:'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',source_sha256:'f'.repeat(64),source_rows:4,grouped_entries:3,distinct_names:3,routes:[{name:'Skilled Worker',entries:2},{name:'Creative Worker',entries:1},{name:'Charity Worker',entries:1}],cities:[{name:'Großstadt',entries:1},{name:'Testville',entries:1}],coverage:{register_entries:'complete_for_supplied_snapshot',business_identity:'retained_evidence_requires_review',website:'retained_evidence_requires_review',careers:'retained_evidence_requires_review',jobs:'not_collected',retained_evidence_entries:1,retained_evidence_claims:6,newly_verified_businesses:0},limitations:['Fictional UI fixture only. No production data or source visits.']},entries:[primary,blank,hostile],evidence};
const embed=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
await fs.writeFile(path.join(fixture,'historical.html'),template.replace('__DOSSIER_DATA__',embed(data)));
const baseline=structuredClone(data); delete baseline.evidence;
await fs.writeFile(path.join(fixture,'baseline.html'),template.replace('__DOSSIER_DATA__',embed(baseline)));
const checks=[],externalRequests=[],browserErrors=[];
const browser=await chromium.launch({headless:true,executablePath:args.chrome,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
let success=false,error=null;
try{
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:true});
 await context.route(/^https?:/,route=>{externalRequests.push(route.request().url());return route.abort();});
 const page=await context.newPage(); page.on('pageerror',e=>browserErrors.push(e.message));
 await page.goto(pathToFileURL(path.join(fixture,'historical.html')).href);
 await page.waitForFunction(()=>document.querySelectorAll('.entry').length===3);
 assert.equal(await page.locator('.entry-evidence').count(),1);
 await page.locator('#has-evidence').check(); assert.equal(await page.locator('.entry').count(),1);
 checks.push('Retained-evidence filter and one card notice match actual attached subject');
 await page.locator('#search').fill('Alias excluded'); await page.locator('#search').press('Enter'); assert.equal(await page.locator('.entry').count(),0);
 checks.push('Unapproved alias is excluded from register search');
 await page.locator('#clear').click(); assert.equal(await page.locator('#has-evidence').isChecked(),false);
 await page.locator('#city').fill('GROSSSTADT'); await page.locator('#city').press('Enter'); assert.equal(await page.locator('.entry').count(),1);
 await page.locator('.entry').click();
 assert.equal(await page.locator('#historical-panel').isVisible(),true);
 assert.equal(await page.locator('#licences .licence-row').count(),2);
 assert.match(await page.locator('#historical-due').innerText(),/30 Oct 2026.*12:00 UTC.*unchanged/i);
 assert.match(await page.locator('#historical-claims').innerText(),/23 Oct 2026.*01:55 UTC/);
 assert.equal(await page.locator('.conflict').count(),1);
 assert.equal(await page.locator('.claim > .claim-state').count(),6);
 assert.equal(await page.locator('.claim-value').getByText('Trading name',{exact:true}).count(),1);
 assert.match(await page.locator('#business-facts').innerText(),/Not verified/);
 const currentFacts=await page.locator('#business-facts').evaluate(el=>Object.fromEntries([...el.querySelectorAll('dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent])));
 assert.equal(currentFacts['Official website'],'Not verified'); assert.equal(currentFacts['Public business contact'],'Not collected'); assert.equal(currentFacts['Current vacancies'],'Not collected'); assert.equal(currentFacts['Role sponsorship wording'],'Not collected');
 checks.push('Old observation and review due remain historical; six adjacent claim warnings, readable relationship label and explicit conflicts');
 const links=await page.locator('#historical-panel a').evaluateAll(nodes=>nodes.map(node=>node.href));
 assert.ok(links.includes('https://example.test/business')); assert.ok(links.includes('https://example.test/original'));
 assert.ok(links.every(url=>url.startsWith('https://')&&!url.includes('user:secret')));
 assert.equal(await page.locator('img').count(),0); assert.equal(await page.evaluate(()=>window.__unsafe),undefined);
 checks.push('Safe source links only; credential and script URLs not linked; hostile claims and summaries remain text');
 assert.equal(await page.locator('.claim-evidence[open]').count(),0);
 await page.locator('.claim-evidence').first().locator('summary').first().click();
 await page.locator('.receipt-details').first().locator('summary').click();
 assert.match(await page.locator('.receipt-details').first().innerText(),/2026-10-23T01:55:17Z/);
 assert.match(await page.locator('.receipt-details').first().innerText(),/not a source-page capture/);
 checks.push('Exact original timestamp and retained-receipt hash scope visible');
 const downloadEvent=page.waitForEvent('download'); await page.locator('#export-dossier').click(); const download=await downloadEvent;
 const saved=path.join(fixture,'selected-dossier.json'); await download.saveAs(saved); const exported=JSON.parse(await fs.readFile(saved,'utf8'));
 assert.equal(exported.business_profile.status,'not_collected'); assert.equal(exported.business_profile.website,null);
 assert.deepEqual(exported.retained_evidence.subject,evidence.subjects[primary[0]]);
 assert.deepEqual(exported.retained_evidence.observations,evidence.observations);
 assert.equal(exported.retained_evidence.review_status,'owner_review_required');
 assert.equal(exported.retained_evidence.prepared_at,evidence.prepared_at); assert.equal(exported.retained_evidence.packet_sha256,evidence.packet_sha256);
 checks.push('Actual JSON download preserves complete claims, references, original dates and candidate state; baseline website stays null');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); assert.ok(await page.locator('#dossier-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
 await page.screenshot({path:path.join(fixture,'historical-mobile.png')});
 await page.keyboard.press('Escape'); assert.equal(await page.locator('#dossier-dialog').getAttribute('open'),null); assert.equal(await page.locator('.entry').evaluate(el=>el===document.activeElement),true);
 checks.push('390px evidence dossier has no horizontal overflow; Escape closes and restores focus');
 await page.goto(pathToFileURL(path.join(fixture,'baseline.html')).href); await page.waitForFunction(()=>document.querySelectorAll('.entry').length===3);
 assert.equal(await page.locator('#evidence-filter-label').isVisible(),false);
 await page.locator('#search').fill('Fictional Blank'); await page.locator('#search').press('Enter'); await page.locator('.entry').click();
 assert.equal(await page.locator('#historical-panel').isVisible(),false); assert.match(await page.locator('#business-facts').innerText(),/Not collected/);
 assert.match(await page.locator('#research-plan').innerText(),/No Skilled Worker route is recorded/);
 checks.push('No-packet baseline remains usable with unknown business fields and original route caution');
 assert.deepEqual(externalRequests,[]); assert.deepEqual(browserErrors,[]); checks.push('No external page requests or browser errors');
 success=true;
}catch(e){error={name:e.name,message:e.message};}
finally{await browser.close();}
const receipt={observed_at:new Date().toISOString(),scope:'fictional offline historical-evidence UI',success,checks,error,external_page_requests:externalRequests,browser_errors:browserErrors,template_sha256:createHash('sha256').update(template).digest('hex'),fixture_directory:fixture,production_mutation:false};
await fs.writeFile(args.out,JSON.stringify(receipt,null,2)+'\n'); console.log(JSON.stringify(receipt,null,2)); if(!success)process.exitCode=1;
