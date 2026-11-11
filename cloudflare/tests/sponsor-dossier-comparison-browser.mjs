// Local-only comparison acceptance against an existing pack plus adversarial fixtures.
// --pack /path/to/pack --out /tmp/unique-receipt.json [--playwright /existing/index.mjs] [--chrome /existing/chrome]
// No installation, credentials, external requests, production reads or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const args={};
for(let i=2;i<process.argv.length;i+=2) args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
if(!args.pack||!args.out) throw new Error('Supply --pack and --out. An existing local browser and Playwright are required.');
const pack=path.resolve(args.pack), output=path.resolve(args.out);
await fs.access(output).then(()=>{throw new Error('Receipt already exists; use a new --out path to retain prior attempts.');},error=>{if(error.code!=='ENOENT')throw error;});
const data=JSON.parse(await fs.readFile(path.join(pack,'data.json'),'utf8'));
const html=await fs.readFile(path.join(pack,'index.html'),'utf8');
assert.ok(data.comparison?.schema_version===1,'The supplied pack must include the optional comparison.');
const modulePath=args.playwright||process.env.SI_PLAYWRIGHT_MODULE||process.env.PLAYWRIGHT_MODULE||'/Users/balabollineni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
const chrome=args.chrome||process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'si-register-comparison-browser-'));
const checks=[],externalRequests=[],browserErrors=[];
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
const context=await browser.newContext({viewport:{width:1360,height:960},acceptDownloads:true,serviceWorkers:'block'});
await context.route('**/*',route=>{
 const url=route.request().url();
 if(/^(file:|blob:|data:)/.test(url)) return route.continue();
 externalRequests.push(url);return route.abort();
});
const page=await context.newPage(); page.on('pageerror',error=>browserErrors.push(error.message));
let success=false,error=null;
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);};
const number=value=>value.toLocaleString('en-GB');
const normal=value=>String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
const provenance=source=>Object.fromEntries(['source_date','observed_at','source_url','publication_url','source_sha256','source_bytes','source_rows','grouped_entries','attribution','licence_url'].filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]]));
const changed=diff=>diff[1]==='present_both'&&(diff[2].length>0||diff[3].length>0||diff[4]);
const embed=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const cardFor=row=>page.locator('.entry[data-record-key="'+row[0]+'"]');
async function selectView(value){await page.locator('#snapshot-view').selectOption(value);await page.locator('#clear').click();}
async function findCard(row){
 await page.locator('#search').fill(row[1]);await page.locator('#city').fill(row[2]);await page.locator('#search').press('Enter');
 await cardFor(row).waitFor({state:'visible'}); return cardFor(row);
}
async function openRow(row){const card=await findCard(row);await card.click();assert.equal(await page.locator('#dossier-name').innerText(),row[1]);return card;}
async function exported(row,label){
 const event=page.waitForEvent('download');await page.locator('#export-dossier').click();const download=await event;
 const filename=path.join(artifacts,label+'-'+row[0].slice(0,12)+'.json');await download.saveAs(filename);
 return JSON.parse(await fs.readFile(filename,'utf8'));
}
async function pairValues(selector){return page.locator(selector).evaluateAll(nodes=>nodes.map(node=>[node.querySelector('strong').textContent,node.querySelector('span').textContent]));}
async function closeAndCheck(card){await page.keyboard.press('Escape');assert.equal(await page.locator('#dossier-dialog').getAttribute('open'),null);assert.equal(await card.evaluate(node=>node===document.activeElement),true);}
async function assertDownload(payload,row,dataset){
 const comp=dataset.comparison,old=comp.earlier.entries.find(item=>item[0]===row[0])||null,latest=dataset.entries.find(item=>item[0]===row[0])||null;
 assert.equal(payload.register_entry.local_record_key,row[0]);
 assert.deepEqual(payload.register_entry.licences,row[4].map(([route,rating])=>({route,rating})));
 assert.equal(payload.source.sha256,(latest?dataset.meta:comp.earlier.meta).source_sha256);
 assert.equal(payload.source.observed_at,(latest?dataset.meta:comp.earlier.meta).observed_at);
 assert.deepEqual(payload.snapshot_comparison.columns,comp.columns);
 assert.deepEqual(payload.snapshot_comparison.record_columns,dataset.columns);
 assert.deepEqual(payload.snapshot_comparison.entry,comp.entries.find(item=>item[0]===row[0]));
 assert.deepEqual(payload.snapshot_comparison.earlier,{source:provenance(comp.earlier.meta),entry:old});
 assert.deepEqual(payload.snapshot_comparison.latest,{source:provenance(dataset.meta),entry:latest});
 assert.equal(payload.snapshot_comparison.selected_snapshot,latest?'latest_supplied':'earlier');
 assert.equal(payload.business_profile.status,'not_collected');assert.equal(payload.business_profile.current_vacancies,null);
 if(!latest)assert.equal(payload.retained_evidence,undefined);
}
try{
 const comparison=data.comparison,oldByKey=new Map(comparison.earlier.entries.map(row=>[row[0],row])),newByKey=new Map(data.entries.map(row=>[row[0],row]));
 await page.goto(pathToFileURL(path.join(pack,'index.html')).href,{waitUntil:'load'});
 await page.locator('.entry').first().waitFor();
 assert.equal(await page.locator('#snapshot-view').inputValue(),'latest');
 assert.equal(await page.locator('#entry-count').innerText(),number(data.meta.grouped_entries));
 assert.equal(await page.locator('#source-row-count').innerText(),number(data.meta.source_rows));
 assert.equal(await page.locator('.entry').count(),Math.min(30,data.entries.length));
 assert.match(await page.locator('#snapshot-summary').innerText(),new RegExp(number(data.entries.length)+' matching of '+number(data.entries.length)));
 check('Latest supplied snapshot remains the default with unchanged baseline denominators and only one rendered page');
 await page.screenshot({path:path.join(artifacts,'comparison-desktop.png'),fullPage:false});
 for(const [view,expected] of [['changed',comparison.entries.filter(changed)],['current_only',comparison.entries.filter(diff=>diff[1]==='current_only')],['earlier_only',comparison.entries.filter(diff=>diff[1]==='earlier_only')]]){
   await selectView(view);
   assert.match(await page.locator('#snapshot-summary').innerText(),new RegExp(number(expected.length)+' matching of '+number(expected.length)));
   const actual=await page.locator('.entry').evaluateAll(nodes=>nodes.map(node=>node.dataset.recordKey));const keys=new Set(expected.map(row=>row[0]));assert.ok(actual.every(key=>keys.has(key)));
   assert.equal(await page.locator('.entry').count(),Math.min(30,expected.length));
   assert.equal(await page.locator('#entry-count').innerText(),number(data.meta.grouped_entries));
 }
 check('Changed, latest-only and earlier-only views match independent comparison counts without changing latest totals');
 const pairChange=comparison.entries.find(diff=>diff[1]==='present_both'&&(diff[2].length||diff[3].length));assert.ok(pairChange);
 await selectView('changed');const pairRow=newByKey.get(pairChange[0]);let card=await openRow(pairRow);
 assert.deepEqual(await pairValues('#licences .licence-row'),pairRow[4]);
 assert.deepEqual(await pairValues('[data-snapshot="earlier"] .comparison-pair'),oldByKey.get(pairRow[0])[4]);
 assert.deepEqual(await pairValues('[data-snapshot="latest"] .comparison-pair'),pairRow[4]);
 for(const pair of [...pairChange[2],...pairChange[3]])assert.ok((await page.locator('#comparison-deltas').innerText()).includes(pair[0]+' — '+pair[1]));
 await assertDownload(await exported(pairRow,'real-pair-change'),pairRow,data);await closeAndCheck(card);
 check('Real paired route/rating differences, isolated primary pair class and complete two-source download agree with source rows');
 const variantChange=comparison.entries.find(diff=>diff[1]==='present_both'&&diff[4]);assert.ok(variantChange);
 await selectView('changed');const variantRow=newByKey.get(variantChange[0]);card=await openRow(variantRow);
 assert.match(await page.locator('#comparison-deltas').innerText(),/Recorded spelling variants differ/);
 for(const side of ['earlier','latest']){
   const expected=(side==='earlier'?oldByKey:newByKey).get(variantRow[0])[6].map(variant=>variant.map(value=>value||'(not supplied)').join(' · '));
   assert.deepEqual(await page.locator('[data-snapshot="'+side+'"] .comparison-variants li').allTextContents(),expected);
 }
 await closeAndCheck(card);check('Both exact recorded spelling sets are retained for a real variant difference');
 const countOnly=comparison.entries.find(diff=>diff[1]==='present_both'&&!changed(diff)&&oldByKey.get(diff[0])[5].length!==newByKey.get(diff[0])[5].length);assert.ok(countOnly);
 await selectView('changed');await page.locator('#search').fill(newByKey.get(countOnly[0])[1]);await page.locator('#search').press('Enter');assert.equal(await cardFor(newByKey.get(countOnly[0])).count(),0);
 await selectView('latest');const countRow=newByKey.get(countOnly[0]);card=await openRow(countRow);
 assert.match(await page.locator('#comparison-status').innerText(),/unchanged/);assert.match(await page.locator('#comparison-deltas').innerText(),/Count-only differences are not/);
 await assertDownload(await exported(countRow,'real-count-only'),countRow,data);await closeAndCheck(card);
 check('Recording-count-only differences stay outside changed view and remain separately inspectable/exportable');
 const oldOnlyDiff=comparison.entries.find(diff=>diff[1]==='earlier_only');assert.ok(oldOnlyDiff);const oldRow=oldByKey.get(oldOnlyDiff[0]);
 await selectView('earlier_only');assert.equal(await page.locator('#snapshot-boundary').isVisible(),true);assert.equal(await page.locator('#evidence-filter-label').isVisible(),false);
 card=await openRow(oldRow);assert.match(await page.locator('#dossier-status').innerText(),/EARLIER SNAPSHOT ONLY/);
 assert.match(await page.locator('#dossier-warning').innerText(),/Revocation, closure or a rename cannot be inferred/);
 assert.equal(await page.locator('#record-original').getAttribute('href'),comparison.earlier.meta.source_url);
 assert.equal(await page.locator('#historical-panel').isVisible(),false);
 assert.deepEqual(await pairValues('#licences .licence-row'),oldRow[4]);assert.match(await page.locator('#research-plan').innerText(),/Re-establish the register baseline/);
 await assertDownload(await exported(oldRow,'real-earlier-only'),oldRow,data);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#dossier-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth));
 await page.screenshot({path:path.join(artifacts,'comparison-earlier-mobile.png'),fullPage:false});
 await closeAndCheck(card);check('Earlier-only historical dossier uses its original source, excludes current evidence and preserves export, mobile layout and Escape focus');
 await selectView('current_only');const newOnlyDiff=comparison.entries.find(diff=>diff[1]==='current_only');assert.ok(newOnlyDiff);const newRow=newByKey.get(newOnlyDiff[0]);card=await openRow(newRow);
 assert.match(await page.locator('#comparison-status').innerText(),/no exact match in the earlier file/);
 assert.equal(await page.locator('[data-snapshot="earlier"] .comparison-pair').count(),0);
 await assertDownload(await exported(newRow,'real-latest-only'),newRow,data);await closeAndCheck(card);
 check('Latest-only dossier preserves an absent earlier row without inventing a licence issue event');
 await selectView('earlier_only');const route=oldRow[4][0][0];await page.locator('#search').fill(oldRow[1]);await page.locator('#city').fill(oldRow[2]);await page.locator('#route').selectOption(route);await page.locator('#search').press('Enter');
 const words=normal(oldRow[1]).split(' ').filter(Boolean);const expectedOld=comparison.earlier.entries.filter(row=>!newByKey.has(row[0])&&(!oldRow[2]||row[6].some(variant=>normal(variant[1])===normal(oldRow[2])))&&row[4].some(pair=>pair[0]===route)&&words.every(word=>normal(row[6].flat().join(' ')).includes(word)));
 assert.ok((await page.locator('#result-count').innerText()).includes('of '+number(expectedOld.length)+' entries'));
 check('Historical search, exact-town variants and route filter use the earlier-only view denominator');
 // A small controlled fixture exercises differences that cannot be assumed in a live-sized snapshot.
 const row=(key,name,city,pairs,refs,variants)=>[key.repeat(64),name,city,'',pairs,refs,variants||[[name,city,'']]];
 const skill=[['Skilled Worker','Worker (A rating)']],charity=[['Charity Worker','Temporary Worker (A rating)']];
 const hostile='</script><img src=x onerror="window.__comparisonUnsafe=true">';
 const earlier=[row('a','Fictional Pair','Bath',skill,[2]),row('b','FICTIONAL VARIANT','Bath',skill,[3]),row('c','Fictional Count','Bath',skill,[4]),row('d','Fictional Order','Bath',skill,[9,8]),row('e','Fictional Moved','Cardiff',skill,[10]),row('f',hostile,'',charity,[11])];
 const latest=[row('a','Fictional Pair','Bath',charity,[2]),row('b','Fictional Variant','Bath',skill,[3]),row('c','Fictional Count','Bath',skill,[4,5]),row('d','Fictional Order','Bath',skill,[8,9]),row('7','Fictional Moved','London',skill,[12])];
 const makeMeta=(sourceDate,rows,sha)=>({source_date:sourceDate,observed_at:sourceDate+'T12:34:56Z',source_url:'https://example.test/'+sourceDate+'.csv',publication_url:'https://example.test/register',source_sha256:sha.repeat(64),source_rows:rows.reduce((n,item)=>n+item[5].length,0),grouped_entries:rows.length,distinct_names:rows.length,routes:[...new Set(rows.flatMap(item=>item[4].map(pair=>pair[0])))].map(name=>({name,entries:rows.filter(item=>item[4].some(pair=>pair[0]===name)).length})),cities:[...new Set(rows.map(item=>item[2]).filter(Boolean))].map(name=>({name,entries:rows.filter(item=>item[2]===name).length})),coverage:{newly_verified_businesses:0},limitations:['Fictional browser acceptance only.']});
 const fixtureData={schema_version:1,columns:data.columns,meta:makeMeta('2026-11-11',latest,'8'),entries:latest,comparison:{schema_version:1,match_basis:'normalized_name_city_county_exact',columns:comparison.columns,current_source_sha256:'8'.repeat(64),earlier:{meta:makeMeta('2026-10-02',earlier,'9'),entries:earlier},counts:{present_both:4,current_only:1,earlier_only:2,changed_matched:2,matched_source_row_count_changed:1,matched_duplicate_count_changed:1},entries:[['a'.repeat(64),'present_both',charity,skill,false],['b'.repeat(64),'present_both',[],[],true],['c'.repeat(64),'present_both',[],[],false],['d'.repeat(64),'present_both',[],[],false],['e'.repeat(64),'earlier_only',[],skill,false],['f'.repeat(64),'earlier_only',[],charity,false],['7'.repeat(64),'current_only',skill,[],false]]}};
 const fixtureFile=path.join(artifacts,'comparison-fixture.html');
 const fixtureHTML=value=>html.replace(/(<script type="application\/json" id="dossier-data">)[\s\S]*?(<\/script>)/,(_match,start,end)=>start+embed(value)+end);
 await fs.writeFile(fixtureFile,fixtureHTML(fixtureData));await page.goto(pathToFileURL(fixtureFile).href);await page.locator('.entry').first().waitFor();
 await selectView('changed');assert.deepEqual(await page.locator('.entry').evaluateAll(nodes=>nodes.map(node=>node.dataset.recordKey)),['a'.repeat(64),'b'.repeat(64)]);
 await selectView('latest');card=await openRow(latest[3]);assert.match(await page.locator('#comparison-status').innerText(),/unchanged/);assert.match(await page.locator('#comparison-deltas').innerText(),/Source-record positions may differ/);await closeAndCheck(card);
 check('Fictional row ordering and duplicate-only changes do not become content changes');
 await selectView('current_only');card=await openRow(latest[4]);const moved=await exported(latest[4],'fixture-moved');assert.equal(moved.snapshot_comparison.earlier.entry,null);await closeAndCheck(card);
 await selectView('earlier_only');card=await openRow(earlier[4]);const oldMoved=await exported(earlier[4],'fixture-old-moved');assert.equal(oldMoved.snapshot_comparison.latest.entry,null);await closeAndCheck(card);
 check('Same-named records in different towns remain two one-sided entries without inferred relocation');
 await selectView('earlier_only');card=await openRow(earlier[5]);assert.equal(await page.locator('#dossier-name').textContent(),hostile);assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.__comparisonUnsafe),undefined);
 assert.match(await page.locator('#research-plan').innerText(),/No Skilled Worker route is recorded/);assert.match(await page.locator('#dossier-location').innerText(),/not supplied/);
 await assertDownload(await exported(earlier[5],'fixture-hostile-earlier'),earlier[5],fixtureData);await closeAndCheck(card);
 check('Hostile earlier name stays text; blank location and no-Skilled-Worker caution survive source-correct export');
 const noComparison=structuredClone(fixtureData);delete noComparison.comparison;const baselineFile=path.join(artifacts,'baseline-fixture.html');await fs.writeFile(baselineFile,fixtureHTML(noComparison));await page.goto(pathToFileURL(baselineFile).href);await page.locator('.entry').first().waitFor();
 assert.equal(await page.locator('#snapshot-controls').isVisible(),false);await page.locator('.entry').first().click();assert.equal(await page.locator('#comparison-panel').isVisible(),false);assert.equal(await page.locator('#historical-panel').isVisible(),false);
 assert.deepEqual(await pairValues('#licences .licence-row'),latest[0][4]);
 check('Optional-comparison absence preserves the baseline directory and dossier');
 assert.deepEqual(externalRequests,[]);assert.deepEqual(browserErrors,[]);check('No external page requests or browser errors across real pack and fictional fixtures');
 success=true;
}catch(caught){error={name:caught.name,message:caught.message,stack:caught.stack};try{await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:false});}catch{}}
finally{await context.close();await browser.close();}
const receipt={observed_at:new Date().toISOString(),scope:'offline supplied-register comparison UI plus fictional edge cases',success,checks,error,source_sha256:data.meta.source_sha256,earlier_source_sha256:data.comparison.earlier.meta.source_sha256,counts:data.comparison.counts,html_sha256:createHash('sha256').update(html).digest('hex'),artifacts,external_requests:externalRequests,browser_errors:browserErrors,production_reads:0,production_writes:0};
await fs.writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt,null,2));if(!success)process.exitCode=1;
