// Uses the actual built app; account-switch checks use the actual CareerProvider and FounderPage.
// SI_PLAYWRIGHT_MODULE=/existing/playwright/index.mjs node tests/founder-finances-browser.mjs --out /new/receipt.json [--base http://127.0.0.1:5221]
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {basename,dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {emptyWorkbook} from '../shared/founder.js';
import {financialScenarioSummary} from '../shared/founder-finances.js';
import {startFounderFinancesPreview} from './fixtures/founder-finances-preview.mjs';

const values={openingCash:'1000',startupPayments:'100',monthlyReceipts:'300',monthlyPayments:'250',months:'3',receiptsReduction:'50',paymentsIncrease:'20',receiptDelay:'1',evidenceNote:'Fictional assumptions only; supplier quote and customer receipts are unverified.'};
const labels={openingCash:'Available cash at the start',startupPayments:'Startup payments',monthlyReceipts:'Customer cash received each month',monthlyPayments:'Operating cash paid each month',months:'Months to compare',receiptsReduction:'Lower customer receipts',paymentsIncrease:'Higher operating payments',receiptDelay:'Delay before customer receipts begin',evidenceNote:'Evidence and uncertainties'};

export async function run(baseURL,{out,screenshotDir,playwright=process.env.SI_PLAYWRIGHT_MODULE,chrome=process.env.SI_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}={}){
 if(!out)throw Error('Supply a new receipt path; failed attempts are retained, not overwritten.');
 try{await stat(out);throw Error('The receipt path already exists. Choose a new path for this attempt.');}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!playwright)throw Error('Set SI_PLAYWRIGHT_MODULE to an existing Playwright module. No install is performed.');
 const base=new URL(baseURL);if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.protocol!=='http:')throw Error('Use a loopback HTTP fixture only.');
 const origin=base.origin,artifacts=resolve(screenshotDir||join(dirname(resolve(out)),basename(out,'.json')+'-artifacts'));
 await mkdir(artifacts,{recursive:true});
 const {chromium}=await import(pathToFileURL(resolve(playwright)).href);
 const checks=[],externalRequests=[],browserErrors=[],screenshots=[],cases=[];
 const source_sha256={};for(const path of ['shared/founder-finances.js','shared/founder-workspace.js','src/founder-finances.tsx','src/founder-ui.tsx','src/founder-finance-data.ts','src/founder-data.ts','tests/founder-finances-browser.mjs','tests/fixtures/founder-finances-preview.mjs','dist/index.html'])source_sha256[path]=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
 let browser,lastPage,success=false,error=null,fixtureEvidence=null;
 const contexts=[];
 const evidence=async()=>{const response=await fetch(origin+'/__qa/evidence',{headers:{'X-SI-Metrics':'exclude'}});assert.equal(response.status,200);return response.json();};
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
  async function newPage(viewport){
   const context=await browser.newContext({viewport,serviceWorkers:'block',timezoneId:'Europe/London',extraHTTPHeaders:{'X-SI-Metrics':'exclude'},userAgent:'SponsorIntel-QA fictional Founder cash plan'});contexts.push(context);
   await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin!==origin){externalRequests.push(url);return route.abort();}return route.continue();});
   const page=await context.newPage();lastPage=page;page.setDefaultTimeout(10000);page.on('pageerror',e=>browserErrors.push(e.message));return page;
  }
  const calc=page=>page.locator('.founder-finances');
  const field=(page,key)=>calc(page).getByLabel(labels[key],{exact:false});
  const note=page=>page.getByRole('textbox',{name:'Financial assumptions',exact:true});
  const preview=page=>calc(page).getByRole('button',{name:'Preview dated finance note',exact:true});
  const summary=page=>calc(page).getByLabel('Exact dated scenario summary',{exact:true});
  async function openCase(page){await page.getByRole('navigation',{name:'Founder hub sections',exact:true}).getByRole('button',{name:/^Workbook/}).click();await page.getByRole('navigation',{name:'Workbook stages',exact:true}).getByRole('button',{name:/Build the business case/}).click();await calc(page).waitFor({state:'visible'});}
  async function fill(page,input=values){for(const [key,value] of Object.entries(input))await field(page,key).fill(value);}
  async function focused(page,locator){
   await locator.waitFor({state:'visible'});const element=await locator.elementHandle();assert.ok(element);
   try{await page.waitForFunction(target=>target===document.activeElement,element,{timeout:3000});assert.equal(await locator.evaluate(target=>target===document.activeElement),true);}
   finally{await element.dispose();}
  }
  async function comparison(page,baseAmount,downsideAmount,negative){
   const cards=calc(page).locator('.founder-finance-result');await cards.first().waitFor({state:'visible'});
   assert.equal(await cards.nth(0).locator('.founder-finance-amount').textContent(),baseAmount);
   assert.equal(await cards.nth(1).locator('.founder-finance-amount').textContent(),downsideAmount);
   assert.equal(await cards.nth(1).locator('dl > div').filter({has:page.locator('dt',{hasText:'First balance below zero'})}).locator('dd').textContent(),negative);
  }
  async function prepare(page){await preview(page).click();await summary(page).waitFor({state:'visible'});return summary(page).textContent();}
  async function shot(page,name){const path=join(artifacts,name+'.png');await calc(page).screenshot({path});screenshots.push(path);}
  async function restore(page,book){await page.locator('.founder-tools input[type=file]').setInputFiles({name:'fictional-founder.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(book))});await page.getByRole('region',{name:'Confirm workbook replacement'}).waitFor({state:'visible'});}

  const page=await newPage({width:1440,height:1000});await page.goto(origin+'/innovator-founder');await openCase(page);
  assert.equal(await preview(page).isDisabled(),true);assert.equal(await calc(page).locator('.founder-finance-result').count(),0);assert.match(await calc(page).locator('.founder-finance-incomplete').innerText(),/7 inputs still needed/);assert.equal(await field(page,'months').inputValue(),'12');
  checks.push('Blank required assumptions remain unknown; comparison and preview stay unavailable.');

  const original='Fictional earlier finance note.\nKeep this exact text and spacing.  ';
  await note(page).fill(original);await fill(page);await comparison(page,'£1,050.00','£300.00','None within 3 months');
  await calc(page).locator('.founder-finance-months > summary').click();
  const rows=await calc(page).locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('th,td')].map(cell=>cell.textContent)));
  assert.deepEqual(rows,[['0 · startup','£0.00','£100.00','£900.00','£0.00','£100.00','£900.00'],['1','£300.00','£250.00','£950.00','£0.00','£300.00','£600.00'],['2','£300.00','£250.00','£1,000.00','£150.00','£300.00','£450.00'],['3','£300.00','£250.00','£1,050.00','£150.00','£300.00','£300.00']]);
  checks.push('Independent hand calculations match both cards and every exact monthly cash movement.');

  const pinned=await prepare(page),generated=pinned.match(/^Generated: ([^.]+\.\d{3}Z)/m)?.[1];assert.ok(generated);assert.equal(pinned,financialScenarioSummary(values,Date.parse(generated)));
  await focused(page,calc(page).locator('.founder-finance-preview'));
  await shot(page,'desktop-cash-plan');
  await calc(page).getByRole('button',{name:'Add scenario to finance note',exact:true}).evaluate(button=>{button.click();button.click();});
  const added=calc(page).getByRole('button',{name:'Summary added to finance note',exact:true});await added.waitFor({state:'visible'});assert.equal(await added.isDisabled(),true);assert.equal(await note(page).inputValue(),original+'\n\n'+pinned);
  cases.push({name:'Pinned summary append',generated,summary_sha256:createHash('sha256').update(pinned).digest('hex'),summary_characters:pinned.length});
  checks.push('Keyboard-focusable preview pins exact dated text; double activation preserves the original note and adds one summary, then disables repeat.');

  await field(page,'openingCash').fill('500');await comparison(page,'£550.00','-£200.00','Month 2');assert.equal(await summary(page).count(),0);assert.equal(await note(page).inputValue(),original+'\n\n'+pinned);
  checks.push('Changing an input invalidates its old preview; the new downside first becomes negative in month 2 and does not rewrite saved notes.');
  const long='Fictional preserved note.\n'+'x'.repeat(3960);await note(page).fill(long);const overflowSummary=await prepare(page);
  await calc(page).getByRole('button',{name:'Add scenario to finance note',exact:true}).click();await calc(page).getByRole('alert').filter({hasText:'4,000'}).waitFor({state:'visible'});assert.equal(await note(page).inputValue(),long);assert.equal(await summary(page).textContent(),overflowSummary);
  const downloading=page.waitForEvent('download');await calc(page).getByRole('button',{name:'Download scenario note',exact:true}).click();const download=await downloading;const downloaded=join(artifacts,'fictional-overflow-scenario-note.txt');await download.saveAs(downloaded);assert.equal(await readFile(downloaded,'utf8'),overflowSummary);assert.match(download.suggestedFilename(),/^sponsor-intel-cash-scenario-\d{4}-\d{2}-\d{2}\.txt$/);
  checks.push('An oversized append leaves the entire existing note and pinned preview intact; the separate downloaded text file matches the preview byte-for-byte.');

  const replacement=emptyWorkbook();replacement.notes.finances='Fictional replacement workbook note.';await restore(page,replacement);assert.equal(await note(page).inputValue(),long);await page.getByRole('button',{name:'Keep current work',exact:true}).click();assert.equal(await note(page).inputValue(),long);
  await restore(page,replacement);await page.getByRole('button',{name:'Replace with this workbook',exact:true}).click();assert.equal(await note(page).inputValue(),replacement.notes.finances);assert.equal(await field(page,'openingCash').inputValue(),'500');assert.equal(await preview(page).isDisabled(),true);assert.equal(await summary(page).count(),0);
  const adopt=calc(page).getByRole('button',{name:'Use with current workbook',exact:true});await adopt.focus();await adopt.press('Enter');assert.equal(await preview(page).isEnabled(),true);assert.equal(await note(page).inputValue(),replacement.notes.finances);
  checks.push('Restore cancellation preserves current notes; confirmed workbook replacement keeps raw scenario inputs and requires explicit keyboard adoption before another summary.');

  await page.getByRole('button',{name:'Clear current notes',exact:true}).click();await page.getByRole('button',{name:'Keep my work',exact:true}).click();assert.equal(await note(page).inputValue(),replacement.notes.finances);
  await page.getByRole('button',{name:'Clear current notes',exact:true}).click();await page.getByRole('button',{name:'Clear this workbook',exact:true}).click();assert.equal(await note(page).inputValue(),'');assert.equal(await field(page,'openingCash').inputValue(),'500');assert.equal(await preview(page).isDisabled(),true);await calc(page).getByRole('button',{name:'Use with current workbook',exact:true}).click();
  checks.push('Workbook clear cancellation is harmless; confirmed clear does not erase the scenario and requires explicit adoption.');

  await page.getByRole('navigation',{name:'Workbook stages',exact:true}).getByRole('button',{name:/Understand the route/}).click();await page.getByRole('navigation',{name:'Workbook stages',exact:true}).getByRole('button',{name:/Build the business case/}).click();assert.equal(await field(page,'openingCash').inputValue(),'500');
  const marker='same-fictional-document';await page.evaluate(value=>{document.documentElement.dataset.qaDocument=value;},marker);
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Explore visa routes',exact:true}).click();await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Founder hub',exact:true}).click();await openCase(page);assert.equal(await field(page,'openingCash').inputValue(),'500');assert.equal(await page.evaluate(()=>document.documentElement.dataset.qaDocument),marker);
  checks.push('Raw scenario inputs survive stage changes and genuine in-app route navigation without reloading the document.');

  const keep='Fictional finance note survives calculator clear.';await note(page).fill(keep);
  await calc(page).getByRole('button',{name:'Clear scenario inputs',exact:true}).click();await focused(page,calc(page).getByRole('button',{name:'Clear inputs',exact:true}));await calc(page).getByRole('button',{name:'Keep my inputs',exact:true}).click();assert.equal(await field(page,'openingCash').inputValue(),'500');
  await calc(page).getByRole('button',{name:'Clear scenario inputs',exact:true}).click();await calc(page).getByRole('button',{name:'Clear inputs',exact:true}).click();assert.equal(await field(page,'openingCash').inputValue(),'');assert.equal(await field(page,'months').inputValue(),'12');assert.equal(await note(page).inputValue(),keep);assert.equal(await preview(page).isDisabled(),true);
  checks.push('Calculator clear requires confirmation, supports cancellation and restores blank/default inputs while preserving workbook notes.');

  const mobile=await newPage({width:390,height:844});await mobile.goto(origin+'/innovator-founder');await openCase(mobile);await fill(mobile,{...values,openingCash:'500'});await comparison(mobile,'£550.00','-£200.00','Month 2');await calc(mobile).locator('.founder-finance-months > summary').click();
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await calc(mobile).evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  const table=calc(mobile).getByRole('region',{name:'Scrollable base and downside cash movements',exact:true});await table.focus();await focused(mobile,table);assert.equal(await table.evaluate(el=>el.scrollWidth>el.clientWidth),true);
  await preview(mobile).focus();await preview(mobile).press('Enter');await summary(mobile).waitFor({state:'visible'});await focused(mobile,calc(mobile).locator('.founder-finance-preview'));await shot(mobile,'mobile-cash-plan');
  checks.push('390px layout has no page/calculator overflow; the exact-values table scrolls within a focusable region and keyboard preview remains operable.');

  const accounts=await newPage({width:1280,height:950});await accounts.goto(origin+'/__qa/accounts');
  async function switchTo(letter){await accounts.getByRole('button',{name:'Use fictional account '+letter,exact:true}).click();await accounts.getByRole('status').filter({hasText:'Fixture account: fictional-founder-'+letter.toLowerCase()}).waitFor({state:'visible'});}
  await switchTo('A');await openCase(accounts);await fill(accounts,{...values,openingCash:'777',evidenceNote:'FICTIONAL A private scenario marker'});await note(accounts).fill('FICTIONAL A private note marker');const aSummary=await prepare(accounts);await calc(accounts).getByRole('button',{name:'Add scenario to finance note',exact:true}).click();await calc(accounts).getByRole('button',{name:'Summary added to finance note',exact:true}).waitFor({state:'visible'});const aNote=await note(accounts).inputValue();assert.equal(aNote,'FICTIONAL A private note marker\n\n'+aSummary);
  await switchTo('B');assert.equal(await field(accounts,'openingCash').inputValue(),'');assert.equal(await note(accounts).inputValue(),'');assert.doesNotMatch(await accounts.locator('body').innerText(),/FICTIONAL A private/);
  await fill(accounts,{...values,openingCash:'333',evidenceNote:'FICTIONAL B private scenario marker'});await note(accounts).fill('FICTIONAL B private note marker');const bSummary=await prepare(accounts);await calc(accounts).getByRole('button',{name:'Add scenario to finance note',exact:true}).click();await calc(accounts).getByRole('button',{name:'Summary added to finance note',exact:true}).waitFor({state:'visible'});const bNote=await note(accounts).inputValue();
  await switchTo('A');assert.equal(await field(accounts,'openingCash').inputValue(),'777');assert.equal(await note(accounts).inputValue(),aNote);assert.doesNotMatch(await accounts.locator('body').innerText(),/FICTIONAL B private/);assert.equal(await preview(accounts).isDisabled(),true);await calc(accounts).getByRole('button',{name:'Use with current workbook',exact:true}).click();assert.equal(await preview(accounts).isEnabled(),true);
  await switchTo('B');assert.equal(await field(accounts,'openingCash').inputValue(),'333');assert.equal(await note(accounts).inputValue(),bNote);assert.equal(await preview(accounts).isDisabled(),true);
  checks.push('Actual provider identity switches isolate raw inputs and appended tab-only notes; A and B recover only their own work and require adoption.');

  await accounts.getByRole('button',{name:'Use fictional guest',exact:true}).click();await accounts.getByRole('status').filter({hasText:'Fixture account: guest'}).waitFor({state:'visible'});
  assert.equal(await field(accounts,'openingCash').inputValue(),'');assert.equal(await field(accounts,'evidenceNote').inputValue(),'');assert.equal(await note(accounts).inputValue(),'');assert.doesNotMatch(await accounts.locator('body').innerText(),/FICTIONAL [AB] private/);
  const guestNote='FICTIONAL guest private note marker';await field(accounts,'openingCash').fill('99');await field(accounts,'evidenceNote').fill('FICTIONAL guest private scenario marker');await note(accounts).fill(guestNote);
  await switchTo('B');assert.equal(await field(accounts,'openingCash').inputValue(),'333');assert.equal(await note(accounts).inputValue(),bNote);assert.equal(await field(accounts,'evidenceNote').inputValue(),'FICTIONAL B private scenario marker');
  checks.push('Switching to a guest hides both accounts, and returning to B preserves B without copying the guest draft or note.');

  await accounts.getByRole('button',{name:'Simulate confirmed deletion cleanup (local fixture only)',exact:true}).click();await accounts.getByRole('status').filter({hasText:'Fixture account: guest'}).waitFor({state:'visible'});
  assert.match(await accounts.getByRole('status').filter({hasText:'Local confirmed-deletion cleanup completed'}).innerText(),/fictional-founder-b.*No account deletion API was called/);
  assert.equal(await field(accounts,'openingCash').inputValue(),'99');assert.equal(await note(accounts).inputValue(),guestNote);
  await switchTo('B');for(const key of Object.keys(values))assert.equal(await field(accounts,key).inputValue(),key==='months'?'12':'');assert.equal(await note(accounts).inputValue(),'');assert.equal(await preview(accounts).isDisabled(),true);
  await switchTo('A');assert.equal(await field(accounts,'openingCash').inputValue(),'777');assert.equal(await field(accounts,'evidenceNote').inputValue(),'FICTIONAL A private scenario marker');assert.equal(await note(accounts).inputValue(),aNote);assert.equal(await preview(accounts).isDisabled(),true);
  checks.push('The actual confirmed-deletion exit callback clears B raw inputs and appended notes only; same-ID B is empty, A remains intact, and the guest draft survives. No deletion API is invoked.');
  // Observe beyond the real CareerProvider's 900 ms save debounce, not only the instant switch result.
  await accounts.waitForTimeout(1100);
  const storage=await accounts.evaluate(()=>({local:Object.entries(localStorage),session:Object.entries(sessionStorage)}));assert.doesNotMatch(JSON.stringify(storage),/FICTIONAL (?:[AB]|guest) private|SPONSOR INTEL — CASH SCENARIO/);
  checks.push('No account or guest scenario/appended-note content enters localStorage or sessionStorage during the observed tab-only flows.');

  fixtureEvidence=await evidence();assert.deepEqual(fixtureEvidence.fixture_errors,[]);assert.equal(fixtureEvidence.business_mutations,0);
  assert.equal(fixtureEvidence.font_policy,'known_google_font_links_removed_for_local_fallback');
  for(const suppressed of fixtureEvidence.font_suppressions){assert.ok(['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(suppressed.url).hostname));assert.ok(['stylesheet','preconnect'].includes(suppressed.kind));}
  const mutationAttempts=fixtureEvidence.api_requests.filter(request=>!['GET','HEAD'].includes(request.method)&&request.path!=='/api/metrics');assert.deepEqual(mutationAttempts,[]);
  assert.equal(fixtureEvidence.api_requests.filter(request=>request.path==='/api/metrics').every(request=>request.metrics_excluded),true);
  assert.equal(fixtureEvidence.api_requests.filter(request=>request.path==='/api/career/founder-workspace').length,0);
  assert.deepEqual(externalRequests,[]);assert.deepEqual(browserErrors,[]);
  checks.push('No external request, Founder account-workspace request, business mutation attempt or browser exception; measurement POSTs are explicit excluded no-ops and known Google font links use a recorded fixture-only system-font fallback.');success=true;
 }catch(caught){error={name:caught.name,message:caught.message,stack:caught.stack};try{fixtureEvidence=await evidence();}catch{};if(lastPage){try{const path=join(artifacts,'failure.png');await lastPage.screenshot({path});screenshots.push(path);}catch{}}}
 finally{for(const context of contexts)await context.close();if(browser)await browser.close();}
 const receipt={observed_at:new Date().toISOString(),scope:'Fictional local cash-scenario UI and tab-only account isolation',success,checks,cases,error,fixture_evidence:fixtureEvidence,external_page_requests:externalRequests,browser_errors:browserErrors,screenshots,source_sha256,production_mutation:false,provider_calls:0};
 await mkdir(dirname(resolve(out)),{recursive:true});await writeFile(out,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args={};for(let index=2;index<process.argv.length;index+=2)args[process.argv[index].replace(/^--/,'')]=process.argv[index+1];
 let fixture;try{if(!args.base)fixture=await startFounderFinancesPreview();const receipt=await run(args.base||fixture.origin,{out:args.out,screenshotDir:args.screenshots,playwright:args.playwright||process.env.SI_PLAYWRIGHT_MODULE,chrome:args.chrome||process.env.SI_CHROME});console.log(JSON.stringify({success:receipt.success,checks:receipt.checks,error:receipt.error,receipt:resolve(args.out)},null,2));if(!receipt.success)process.exitCode=1;}finally{if(fixture)await fixture.close();}
}
