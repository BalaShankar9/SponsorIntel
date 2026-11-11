// Fictional, offline acceptance for exact observation times versus retained review dates.
// --out /tmp/unique-receipt.json [--playwright /existing/index.mjs] [--chrome /existing/chrome]
// No installation, website visits, provider calls or production mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
if(!args.out)throw new Error('Supply a new --out receipt path. No browser is installed by this test.');
await fs.access(args.out).then(()=>{throw new Error('Receipt exists; choose a new path to preserve prior attempts.');},error=>{if(error.code!=='ENOENT')throw error;});
const modulePath=args.playwright||process.env.SI_PLAYWRIGHT_MODULE||process.env.PLAYWRIGHT_MODULE||'/Users/balabollineni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
const templatePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts/sponsor-dossiers-template.html');
const template=await fs.readFile(templatePath,'utf8');
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'si-review-date-browser-'));
const badText='</script><img src=x onerror="window.__reviewDateUnsafe=true">';
const record=['a'.repeat(64),'Fictional Mixed Evidence Company','Bath','', [['Skilled Worker','Worker (A rating)']],[2],[['Fictional Mixed Evidence Company','Bath','']]];
const blank=['b'.repeat(64),'Fictional Unresearched Company','','',[['Charity Worker','Temporary Worker (A rating)']],[3],[['Fictional Unresearched Company','','']]];
const exact={id:'exact-observation',url:'https://example.test/exact',evidence_kind:'retained_operator_observation',observed_at:'2026-10-23T01:55:17Z',summary:'Fictional exact-timestamp retained summary.',receipt_reference:'fictional-exact-receipt.json',receipt_sha256:'c'.repeat(64),attribution:'Agent-assisted fictional observation'};
const review={id:'calendar-review',url:'https://example.test/review',evidence_kind:'retained_operator_review',observed_at:null,reviewed_on:'2026-10-25',summary:'Fictional retained review summary. '+badText,receipt_reference:'fictional-review-receipt.md',receipt_sha256:'d'.repeat(64),attribution:'Agent-assisted fictional retained review'};
const unsafe={...review,id:'unsafe-review-link',url:'javascript:window.__reviewDateUnsafe=true'};
const claims=[{field:'business_name',value:'Historical candidate business name',observation_ids:[exact.id,review.id]},{field:'website',value:'https://example.test/historical-site',observation_ids:[review.id]},{field:'activity',value:badText,observation_ids:[unsafe.id]}];
const packet={schema_version:2,prepared_at:'2026-11-11T18:00:00Z',packet_sha256:'e'.repeat(64),observations:[exact,review,unsafe],subjects:{[record[0]]:{review_status:'owner_review_required',prior_review_due_at:'2026-10-30T12:00:00Z',claims}}};
const data={schema_version:1,columns:['id','name','city','county','licences','source_rows','variants'],entries:[record,blank],meta:{source_date:'2026-11-11',observed_at:'2026-11-11T15:46:45Z',source_url:'https://example.test/register.csv',publication_url:'https://example.test/publication',source_sha256:'f'.repeat(64),source_rows:2,grouped_entries:2,distinct_names:2,routes:[{name:'Skilled Worker',entries:1},{name:'Charity Worker',entries:1}],cities:[{name:'Bath',entries:1}],coverage:{newly_verified_businesses:0},limitations:['Fictional offline browser acceptance only.']},evidence:packet};
const embed=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
async function fixture(name,value){const file=path.join(artifacts,name+'.html');await fs.writeFile(file,template.replace('__DOSSIER_DATA__',embed(value)));return pathToFileURL(file).href;}
const mixedURL=await fixture('mixed-evidence',data);
const version1=structuredClone(data);version1.evidence={...packet,schema_version:1,observations:[exact],subjects:{[record[0]]:{...packet.subjects[record[0]],claims:[{field:'business_name',value:'Old schema candidate',observation_ids:[exact.id]}]}}};
const v1URL=await fixture('version-one',version1);
const noPacket=structuredClone(data);delete noPacket.evidence;const baselineURL=await fixture('baseline',noPacket);
const checks=[],externalRequests=[],browserErrors=[];
const browser=await chromium.launch({headless:true,executablePath:args.chrome||process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Pacific/Honolulu',serviceWorkers:'block',acceptDownloads:true});
await context.route('**/*',route=>{if(/^(file:|blob:|data:)/.test(route.request().url()))return route.continue();externalRequests.push(route.request().url());return route.abort();});
const page=await context.newPage();page.on('pageerror',error=>browserErrors.push(error.message));
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);};
let success=false,error=null;
async function download(name){const pending=page.waitForEvent('download');await page.locator('#export-dossier').click();const saved=path.join(artifacts,name+'.json');await(await pending).saveAs(saved);return JSON.parse(await fs.readFile(saved,'utf8'));}
try{
 await page.goto(mixedURL);await page.locator('.entry').first().waitFor();assert.equal(await page.locator('.entry-evidence').count(),1);
 await page.locator('#has-evidence').check();assert.equal(await page.locator('.entry').count(),1);const trigger=page.locator('.entry');await trigger.click();
 assert.equal(await page.locator('.claim-state').count(),3);assert.match(await page.locator('#historical-due').innerText(),/30 Oct 2026.*12:00 UTC.*unchanged/);
 const summaries=await page.locator('.claim-evidence > summary').allTextContents();
 assert.match(summaries[0],/observed 23 Oct 2026.*01:55 UTC/);
 const required='Retained review dated 25 October 2026; original source observation time not recorded';
 assert.ok(summaries[0].includes(required));assert.ok(summaries[1].includes(required));assert.ok(summaries[2].includes(required));
 assert.ok(!summaries[1].includes('00:00'));assert.ok(!summaries[1].includes('UTC'));assert.ok(!summaries[1].includes('1970'));
 check('Mixed-kind claim summary distinguishes the exact observation from the unchanged calendar review date, without time-zone or midnight invention');
 await page.locator('.claim-evidence').first().locator('summary').first().click();
 const timings=await page.locator('.claim').first().locator('.observation-timing').allTextContents();
 assert.match(timings[0],/^Original observation: 23 Oct 2026.*01:55 UTC$/);assert.equal(timings[1],required);
 const mixedReceipts=page.locator('.claim').first().locator('.receipt-details');await mixedReceipts.nth(0).locator('summary').click();await mixedReceipts.nth(1).locator('summary').click();
 assert.match(await mixedReceipts.nth(0).innerText(),/Recorded timestamp\s+2026-10-23T01:55:17Z/);
 const reviewReceipt=await mixedReceipts.nth(1).innerText();assert.match(reviewReceipt,/Retained review date\s+2026-10-25/);assert.match(reviewReceipt,/Original source observation time\s+Not recorded/);assert.match(reviewReceipt,/Evidence kind\s+Retained operator review/);assert.ok(!reviewReceipt.includes('Recorded timestamp'));assert.ok(!reviewReceipt.includes('00:00'));
 check('Expanded evidence uses the correct review label and exact calendar date; timestamped evidence remains exact');
 assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.__reviewDateUnsafe),undefined);
 assert.ok((await page.locator('#historical-claims').textContent()).includes(badText));
 const links=await page.locator('#historical-panel a').evaluateAll(nodes=>nodes.map(node=>node.href));assert.ok(links.includes(review.url));assert.ok(links.includes(exact.url));assert.ok(links.every(url=>url.startsWith('https://')));
 check('Hostile review summaries and claim text remain literal; unsafe source URL is not linked');
 const exported=await download('mixed-kind-dossier');assert.equal(exported.retained_evidence.schema_version,2);assert.deepEqual(exported.retained_evidence.subject,packet.subjects[record[0]]);assert.deepEqual(exported.retained_evidence.observations,packet.observations);
 const retainedReview=exported.retained_evidence.observations.find(item=>item.id===review.id);assert.equal(retainedReview.observed_at,null);assert.equal(retainedReview.reviewed_on,'2026-10-25');assert.equal(retainedReview.evidence_kind,'retained_operator_review');
 assert.equal(exported.retained_evidence.review_status,'owner_review_required');assert.equal(exported.retained_evidence.prepared_at,packet.prepared_at);assert.equal(exported.business_profile.status,'not_collected');assert.ok(Object.entries(exported.business_profile).filter(([key])=>key!=='status').every(([,value])=>value===null));
 check('Actual saved schema 2 download preserves null/date/kind, old due date and every evidence reference without promoting business fields');
 const facts=await page.locator('#business-facts').evaluate(node=>Object.fromEntries([...node.querySelectorAll('dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent])));
 assert.equal(facts['Official website'],'Not verified');assert.equal(facts['Current vacancies'],'Not collected');assert.equal(facts['Public business contact'],'Not collected');
 await page.locator('.claim-evidence').first().evaluate(node=>{node.open=false;});
 await page.locator('.claim-evidence').nth(1).locator('summary').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(artifacts,'mixed-kind-desktop.png'),fullPage:false});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#dossier-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth));
 await page.locator('.claim-evidence').nth(1).locator('summary').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(artifacts,'mixed-kind-mobile.png'),fullPage:false});await page.keyboard.press('Escape');assert.equal(await page.locator('#dossier-dialog').getAttribute('open'),null);assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
 check('390px mixed evidence has no horizontal overflow and Escape restores trigger focus');
 await page.goto(v1URL);await page.locator('.entry').first().waitFor();await page.locator('.entry').first().click();
 assert.match(await page.locator('.claim-evidence > summary').innerText(),/observed 23 Oct 2026.*01:55 UTC/);assert.ok(!(await page.locator('#historical-panel').textContent()).includes('Retained review dated'));
 await page.locator('.claim-evidence > summary').click();assert.match(await page.locator('.observation-timing').innerText(),/^Original observation: 23 Oct 2026.*01:55 UTC$/);
 const oldExport=await download('version-one-dossier');assert.equal(oldExport.retained_evidence.schema_version,1);assert.deepEqual(oldExport.retained_evidence.observations,[exact]);assert.equal(Object.hasOwn(oldExport.retained_evidence.observations[0],'reviewed_on'),false);
 check('Schema 1 retains its original observation display and exact timestamp-only saved payload');
 await page.goto(baselineURL);await page.locator('.entry').first().waitFor();assert.equal(await page.locator('#evidence-filter-label').isVisible(),false);await page.locator('.entry').first().click();assert.equal(await page.locator('#historical-panel').isVisible(),false);assert.ok((await page.locator('#business-facts').innerText()).includes('Not collected'));
 check('No-evidence baseline remains uncollected and usable');
 assert.deepEqual(externalRequests,[]);assert.deepEqual(browserErrors,[]);check('No external page requests or browser errors');success=true;
}catch(caught){error={name:caught.name,message:caught.message,stack:caught.stack};try{await page.screenshot({path:path.join(artifacts,'failure.png')});}catch{}}
finally{await context.close();await browser.close();}
const receipt={observed_at:new Date().toISOString(),scope:'fictional offline review-date versus observation-timestamp UI',success,checks,error,template_sha256:createHash('sha256').update(template).digest('hex'),artifacts,browser_timezone:'Pacific/Honolulu',external_requests:externalRequests,browser_errors:browserErrors,production_reads:0,production_writes:0};
await fs.writeFile(args.out,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt,null,2));if(!success)process.exitCode=1;
