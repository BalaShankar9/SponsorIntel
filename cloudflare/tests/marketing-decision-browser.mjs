// Actual MarketingDesk and real local ledger, with only fictional records and loopback I/O.
// node tests/marketing-decision-browser.mjs --out /new/path/receipt.json [--playwright /existing/index.mjs] [--chrome /existing/Chrome]
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {startMarketingDecisionPreview} from './fixtures/marketing-decision-preview.mjs';

const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
if(!args.out)throw Error('Supply --out to a new receipt file. This test installs nothing.');
const playwright=args.playwright||'/Users/balabollineni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const chrome=args.chrome||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const {chromium}=await import(pathToFileURL(resolve(playwright)).href);
const checks=[],cases=[],externalRequests=[],browserErrors=[];
let fixture,browser,context,page,success=false,error=null;
const note='Fictional observed provider evidence: the exact account and original content were checked. No real post exists.';
const sourcePaths=['src/marketing-desk.tsx','src/marketing-schedule.tsx','shared/marketing-decision-save.js','shared/marketing-schedule-save.js','worker/marketing.js','tests/fixtures/marketing-decision-preview.mjs','tests/marketing-decision-browser.mjs'];
const hashes={};for(const p of sourcePaths)hashes[p]=createHash('sha256').update(await readFile(new URL('../'+p,import.meta.url))).digest('hex');
try{
 fixture=await startMarketingDecisionPreview();
 browser=await chromium.launch({headless:true,executablePath:chrome,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
 context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block',timezoneId:'Europe/London'});
 await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin!==fixture.origin){externalRequests.push(url);return route.abort();}return route.continue();});
 page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>browserErrors.push(e.message));
 const control=async(path,data)=>{const response=await fetch(fixture.origin+'/__qa/'+path,{method:'POST',headers:{Origin:fixture.origin,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(response.status,200);return response.json();};
 const evidence=async()=>{const response=await fetch(fixture.origin+'/__qa/evidence');assert.equal(response.status,200);return response.json();};
 const card=()=>page.locator('details.marketing-card');
 const decision=()=>card().locator('form.marketing-decision').first();
 const state=()=>card().locator(':scope > summary .marketing-state');
 async function setup(scenario,mode){await control('reset',{scenario,mode});await page.goto(fixture.origin);await page.waitForFunction(()=>document.querySelectorAll('details.marketing-card').length===1);await card().locator(':scope > summary').click();}
 async function prepare(kind){
  if(['published','uncertain'].includes(kind)){
   await decision().getByLabel('Observed result').selectOption(kind);
   if(kind==='published')await decision().getByLabel('Live post URL').fill('https://www.facebook.com/fictional/posts/local-recovery-only');
   await decision().getByLabel('What did the provider show?').fill(note);
  }else{
   await decision().getByLabel('Evidence and decision notes').fill(note);
   if(kind==='reviewed')await decision().getByLabel('I checked the claims, sources, destination and duplication.').check();
  }
 }
 const action=kind=>decision().getByRole('button',{name:kind==='held'?'Hold with reason':kind==='reviewed'?'Record review':'Save delivery observation',exact:true});
 async function savedState(kind){await page.waitForFunction(expected=>document.querySelector('.marketing-card > summary .marketing-state')?.classList.contains(expected),kind);}
 async function retain(name){const data=await evidence();cases.push({name,...data});assert.deepEqual(data.external_requests,[]);assert.deepEqual(data.fixture_errors,[]);return data;}

 for(const kind of ['held','reviewed','published','uncertain']){
  await setup(['published','uncertain'].includes(kind)?'scheduled':'proposed','drop-once');
  await prepare(kind);await action(kind).click();
  const retry=decision().getByRole('button',{name:'Retry this same decision',exact:true});await retry.waitFor({state:'visible'});
  let data=await evidence();assert.equal(data.requests.length,1);assert.equal(data.requests[0].acknowledgement,'dropped-after-commit');assert.equal(data.brief.state,kind);
  const originalBody=data.requests[0].body,original=JSON.parse(originalBody);
  assert.equal(await decision().locator('textarea').isDisabled(),true);
  const beforeGets=data.gets;
  await page.getByRole('button',{name:'Refresh marketing desk',exact:true}).click();
  await page.waitForFunction(async({origin,before})=>(await(await fetch(origin+'/__qa/evidence')).json()).gets>before,{origin:fixture.origin,before:beforeGets});
  assert.equal(await retry.isVisible(),true);assert.equal(await decision().locator('textarea').isDisabled(),true);
  assert.equal(await state().evaluate((el,expected)=>el.classList.contains(expected),['published','uncertain'].includes(kind)?'scheduled':'proposed'),true);
  await retry.focus();assert.equal(await retry.evaluate(el=>el===document.activeElement),true);await retry.press('Enter');
  await savedState(kind);await retry.waitFor({state:'hidden'});
  data=await retain('Lost acknowledgement and global refresh: '+kind);
  assert.equal(data.requests.length,2);assert.equal(data.requests[1].body,originalBody);assert.equal(data.requests[1].response.replayed,true);
  const events=data.events.filter(e=>e.request_key===original.request_key);assert.equal(events.length,1);assert.equal(events[0].kind,kind);
  assert.equal(data.events.length,data.initial_events+1);
  if(original.receipt){assert.equal(data.receipts.length,data.initial_receipts+1);const retained=data.receipts.at(-1);assert.equal(retained.observed_at,original.receipt.observed_at);assert.equal(retained.evidence,original.receipt.evidence);assert.equal(retained.external_id,original.receipt.external_id);}
  else assert.equal(data.receipts.length,data.initial_receipts);
  checks.push(kind+': committed lost acknowledgement retains exact request through global refresh, keyboard retry creates one event/receipt and preserves original observation');
 }

 await setup('scheduled','drop-omit-once');await prepare('published');await action('published').click();
 const omittedRetry=decision().getByRole('button',{name:'Retry this same decision',exact:true});await omittedRetry.waitFor({state:'visible'});
 await page.getByRole('button',{name:'Refresh marketing desk',exact:true}).click();
 await page.waitForFunction(async origin=>(await(await fetch(origin+'/__qa/evidence')).json()).omitted_gets===1,fixture.origin);
 assert.equal(await card().count(),1);assert.equal(await omittedRetry.isVisible(),true);await omittedRetry.click();await savedState('published');
 let data=await retain('Pending card omitted from refreshed latest-50 snapshot');assert.equal(data.requests.length,2);assert.equal(data.requests[0].body,data.requests[1].body);assert.equal(data.requests[1].response.replayed,true);assert.equal(data.events.length,data.initial_events+1);assert.equal(data.receipts.length,data.initial_receipts+1);
 checks.push('Pending decision remains available when refreshed latest-50 results omit its brief, and exact replay creates no duplicate');

 for(const status of [403,429]){
  await setup('scheduled','drop-'+status+'-once');await prepare('published');await action('published').click();
  const retry=decision().getByRole('button',{name:'Retry this same decision',exact:true});await retry.waitFor({state:'visible'});await retry.click();
  await decision().getByRole('alert').filter({hasText:'Fictional retry access or rate-limit rejection'}).waitFor({state:'visible'});
  assert.equal(await retry.isVisible(),true);assert.equal(await decision().locator('textarea').isDisabled(),true);
  await retry.click();await savedState('published');data=await retain('Lost acknowledgement followed by '+status+' retry rejection');
  assert.equal(data.requests.length,3);assert.equal(data.requests[1].status,status);assert.equal(data.requests[0].body,data.requests[1].body);assert.equal(data.requests[0].body,data.requests[2].body);assert.equal(data.requests[2].response.replayed,true);assert.equal(data.events.length,data.initial_events+1);assert.equal(data.receipts.length,data.initial_receipts+1);
  checks.push(status+': rejection of a later retry does not clear the earlier uncertain request; eventual replay retains the same bytes and one receipt');
 }

 await setup('proposed','refresh-fail-once');await prepare('reviewed');await action('reviewed').click();
 const refreshSaved=decision().getByRole('button',{name:'Refresh saved decision',exact:true});await refreshSaved.waitFor({state:'visible'});
 assert.match(await decision().innerText(),/decision was saved.*desk could not refresh/i);
 assert.equal(await decision().getByRole('button').count(),1);assert.equal(await decision().locator('textarea').isDisabled(),true);
 data=await evidence();assert.equal(data.requests.length,1);assert.equal(data.failed_gets,1);assert.equal(data.brief.state,'reviewed');
 await refreshSaved.focus();await refreshSaved.press('Enter');await savedState('reviewed');await refreshSaved.waitFor({state:'hidden'});
 data=await retain('Acknowledged save then desk refresh failure');assert.equal(data.requests.length,1);assert.equal(data.events.length,data.initial_events+1);
 checks.push('Acknowledged write plus failed GET offers only refresh; refresh sends no second POST');

 await setup('proposed','self-review-rejection');await prepare('reviewed');await action('reviewed').click();
 await decision().getByRole('alert').waitFor({state:'visible'});assert.match(await decision().getByRole('alert').innerText(),/different reviewer/);
 assert.equal(await decision().locator('textarea').isDisabled(),false);assert.equal(await decision().getByRole('button',{name:'Retry this same decision'}).count(),0);
 assert.equal(await decision().getByLabel('I checked the claims, sources, destination and duplication.').isChecked(),false);
 await decision().getByLabel('Evidence and decision notes').fill(note+' Corrected action: hold for another reviewer.');await action('held').click();await savedState('held');
 data=await retain('Real structured rejection followed by edited hold');assert.equal(data.requests.length,2);assert.equal(data.requests[0].status,409);assert.equal(data.requests[1].status,200);assert.notEqual(JSON.parse(data.requests[0].body).request_key,JSON.parse(data.requests[1].body).request_key);assert.equal(data.events.length,data.initial_events+1);
 checks.push('Real self-review rejection unlocks editing and a new corrected decision key');

 await setup('proposed','delay-once');await prepare('held');await action('held').evaluate(button=>{button.click();button.click();});
 await page.waitForFunction(async origin=>(await(await fetch(origin+'/__qa/evidence')).json()).requests.length===1,fixture.origin);
 data=await evidence();assert.equal(data.requests.length,1);assert.equal(await decision().locator('textarea').isDisabled(),true);assert.equal(await decision().getByRole('button').isDisabled(),true);
 await control('release',{});await savedState('held');data=await retain('Rapid duplicate clicks during one in-flight request');assert.equal(data.requests.length,1);assert.equal(data.events.length,data.initial_events+1);
 checks.push('Rapid double activation sends one in-flight request and one event');

 await setup('scheduled','drop-once');await prepare('published');await decision().getByLabel('Observed result').selectOption('uncertain');await action('uncertain').click();
 const newerRetry=decision().getByRole('button',{name:'Retry this same decision',exact:true});await newerRetry.waitFor({state:'visible'});await control('newer-uncertain',{});
 const beforeNewerRefresh=(await evidence()).gets,newerDeskRead=page.waitForResponse(response=>response.url()===fixture.origin+'/api/admin/marketing'&&response.request().method()==='GET'&&response.status()===200);await page.getByRole('button',{name:'Refresh marketing desk',exact:true}).click();
 const refreshedDesk=await(await newerDeskRead).json();assert.equal(refreshedDesk.items[0].receipts[0].external_id,'fictional-newer-reconciled-job');
 await page.waitForFunction(async({origin,before})=>(await(await fetch(origin+'/__qa/evidence')).json()).gets>before,{origin:fixture.origin,before:beforeNewerRefresh});
 await page.waitForFunction(()=>[...document.querySelectorAll('.marketing-metrics > div')].some(el=>el.querySelector('span')?.textContent==='Needs attention'&&el.querySelector('strong')?.textContent==='1'));
 assert.equal(await newerRetry.isVisible(),true);assert.equal(await decision().getByLabel('Provider post or schedule reference').inputValue(),'fictional-existing-provider-job');assert.equal(await decision().getByLabel('What did the provider show?').inputValue(),note);assert.equal(await decision().locator('textarea').isDisabled(),true);
 await newerRetry.click();await savedState('uncertain');await newerRetry.waitFor({state:'hidden'});
 assert.equal(await decision().getByLabel('Provider post or schedule reference').inputValue(),'fictional-newer-reconciled-job');assert.equal(await decision().getByLabel('Observed result').inputValue(),'uncertain');assert.equal(await decision().getByLabel('What did the provider show?').inputValue(),'');await decision().getByLabel('Observed result').selectOption('published');assert.equal(await decision().getByLabel('Live post URL').inputValue(),'');
 data=await retain('Newer concurrent uncertain receipt survives original replay');assert.equal(data.requests.length,2);assert.equal(data.requests[0].body,data.requests[1].body);assert.equal(data.requests[1].response.replayed,true);assert.equal(data.events.length,data.initial_events+2);assert.equal(data.receipts.length,data.initial_receipts+2);assert.equal(data.receipts.at(-1).external_id,'fictional-newer-reconciled-job');checks.push('Acknowledged replay resets inputs from the latest receipt, preserves a concurrent newer observation and clears stale URL/outcome');

 await setup('reviewed','normal');await card().locator('.marketing-schedule > summary').click();
 const schedule=card().locator('.marketing-schedule');
 // Chromium normalises zero seconds away; Playwright fill rejects a value that
 // differs from the resulting input string. Omit only :00, preserving the instant.
 const at=Date.now(),localDate=value=>new Date(value).toISOString().slice(0,19).replace(/:00$/,'');
 await schedule.getByLabel('Provider schedule reference').fill('fictional-saved-then-delivery');
 await schedule.getByLabel('Provider inspected at').fill(localDate(at-5000));await schedule.getByLabel('Provider scheduled for').fill(localDate(at+86400000));
 await schedule.getByLabel('Provider evidence and limitations').fill(note);await schedule.getByLabel('I checked the exact account, reviewed copy, evidence freshness, provider queue and posting allowance.').check();
 await schedule.getByRole('button',{name:'Save schedule record',exact:true}).click();await savedState('scheduled');
 assert.equal(await decision().getByLabel('Observed result').isEnabled(),true);assert.equal(await decision().getByLabel('What did the provider show?').isEnabled(),true);
 await prepare('uncertain');await action('uncertain').click();await savedState('uncertain');
 data=await retain('Schedule save unlocks later delivery controls');assert.equal(data.requests.length,2);assert.deepEqual(data.requests.map(r=>JSON.parse(r.body).kind),['scheduled','uncertain']);assert.equal(data.receipts.length,2);assert.equal(data.events.length,data.initial_events+2);
 checks.push('Existing schedule save transitions to enabled delivery controls and a distinct observation receipt');

 await setup('reviewed','normal');await card().locator('.marketing-schedule > summary').click();
 await schedule.getByLabel('Provider schedule reference').fill('fictional-unsent-old-version');await schedule.getByLabel('Provider inspected at').fill(localDate(Date.now()-5000));await schedule.getByLabel('Provider scheduled for').fill(localDate(Date.now()+86400000));await schedule.getByLabel('Provider evidence and limitations').fill(note);await schedule.getByLabel('I checked the exact account, reviewed copy, evidence freshness, provider queue and posting allowance.').check();
 await control('revise-reviewed',{});await page.getByRole('button',{name:'Refresh marketing desk',exact:true}).click();await page.waitForFunction(()=>document.querySelector('details.marketing-card > summary .marketing-version')?.textContent==='v2');
 await card().locator('.marketing-schedule > summary').click();assert.equal(await schedule.getByLabel('Provider schedule reference').inputValue(),'');assert.equal(await schedule.getByLabel('Provider inspected at').inputValue(),'');assert.equal(await schedule.getByLabel('Provider scheduled for').inputValue(),'');assert.equal(await schedule.getByLabel('Provider evidence and limitations').inputValue(),'');assert.equal(await schedule.getByLabel('I checked the exact account, reviewed copy, evidence freshness, provider queue and posting allowance.').isChecked(),false);
 data=await retain('Unsent schedule form after a newly reviewed content version');assert.equal(data.requests.length,0);assert.equal(data.receipts.length,0);checks.push('A changed reviewed revision clears unsent schedule input and attestations without recording a schedule');

 await page.setViewportSize({width:390,height:844});await setup('scheduled','drop-once');await prepare('published');await action('published').click();
 const mobileRetry=decision().getByRole('button',{name:'Retry this same decision',exact:true});await mobileRetry.waitFor({state:'visible'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await decision().evaluate(el=>el.scrollWidth<=el.clientWidth));
 await mobileRetry.focus();assert.equal(await mobileRetry.evaluate(el=>el===document.activeElement),true);
 if(args.screenshot)await page.screenshot({path:args.screenshot});
 await mobileRetry.press('Enter');await savedState('published');
 data=await retain('390px pending decision and keyboard recovery');assert.equal(data.requests.length,2);assert.equal(data.requests[0].body,data.requests[1].body);
 checks.push('390px pending decision has no horizontal overflow and the retry remains keyboard-focusable and operable');
 assert.deepEqual(externalRequests,[]);assert.deepEqual(browserErrors,[]);checks.push('No external page/server requests or browser exceptions');success=true;
}catch(e){error={name:e.name,message:e.message,stack:e.stack};if(fixture){try{cases.push({name:'Failure evidence',...await(await fetch(fixture.origin+'/__qa/evidence')).json()});}catch{}}}
finally{if(context)await context.close();if(browser)await browser.close();if(fixture)await fixture.close();}
const receipt={observed_at:new Date().toISOString(),scope:'fictional actual MarketingDesk and isolated SQLite ledger recovery',success,checks,cases,error,external_page_requests:externalRequests,browser_errors:browserErrors,source_sha256:hashes,...(args.screenshot?{fictional_mobile_screenshot:resolve(args.screenshot)}:{}),production_mutation:false,provider_calls:0};
await mkdir(dirname(resolve(args.out)),{recursive:true});await writeFile(args.out,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({success,checks,error,receipt:resolve(args.out)},null,2));if(!success)process.exitCode=1;
