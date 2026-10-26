import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {directory,stages,sources,REVIEWED_AT,REVIEW_DUE,reviewCurrent,feeIllustration,emptyWorkbook,hasWork,parseWorkbook,exportWorkbook,workbookReport,filterDirectory,MAX_IMPORT_BYTES} from '../shared/founder.js';
const now=Date.parse('2026-10-26T13:00:00Z');
test('founder fees separate actual route charges from maintenance, and fail closed on invalid date, region and review expiry',()=>{
 const a=feeIllustration('outside',now),b=feeIllustration('inside',now);assert.equal(a.total,6462);assert.equal(b.total,6798);assert.equal(a.total,a.visa+a.ihs+a.endorsement+a.meetings);assert.equal(a.maintenance,1270);assert.equal(a.ihs,3*1035);
 for(const at of [NaN,Infinity,0,Date.parse(REVIEWED_AT)-1,Date.parse(REVIEW_DUE),Date.parse(REVIEW_DUE)+1]){assert.equal(reviewCurrent(at),false);assert.equal(feeIllustration('inside',at),null);}
 assert.equal(reviewCurrent(Date.parse(REVIEWED_AT)),true);assert.equal(reviewCurrent(Date.parse(REVIEW_DUE)-1),true);assert.equal(feeIllustration('other',now),null);
});
test('workbook round-trip retains truthful Unicode notes, shortlist and self marks without adding executable keys',()=>{
 const a=emptyWorkbook();assert.equal(hasWork(a),false);a.notes.innovation='Fictional café: test a hypothesis. <script>not executable</script>\nతెలుగు';a.checks=['case'];a.shortlist=['ukes','wales'];a.location='inside';assert.equal(hasWork(a),true);assert.deepEqual(parseWorkbook(exportWorkbook(a)),a);
 const restored=parseWorkbook(exportWorkbook(a));restored.notes.innovation='other';assert.notEqual(restored.notes.innovation,a.notes.innovation);
 const text=workbookReport(a,now);assert.match(text,/self-authored preparation/);assert.match(text,/Fictional café/);assert.match(text,/UK Endorsing Services — Endorser/);assert.match(text,/No fee amount is frozen/);assert.ok(!text.includes('£6,798'));assert.match(workbookReport(a,Date.parse(REVIEW_DUE)),/Review overdue/);
});
test('import rejects unsupported, oversized, nested, unknown and prototype-shaped input without changing existing notes',()=>{
 const a=emptyWorkbook(),raw=exportWorkbook(a);
 for(const value of [null,[],{},'{',raw+'x',JSON.stringify({...a,version:2}),JSON.stringify({...a,format:'different'}),JSON.stringify({...a,secret:'no'}),JSON.stringify({...a,notes:[]}),JSON.stringify({...a,notes:{...a.notes,extra:'no'}}),JSON.stringify({...a,notes:{...a.notes,innovation:{value:'no'}}}),JSON.stringify({...a,notes:{...a.notes,innovation:'x'.repeat(4001)}}),JSON.stringify({...a,notes:{...a.notes,innovation:'a\u0000b'}}),JSON.stringify({...a,shortlist:['unknown']}),JSON.stringify({...a,shortlist:['ukes','ukes']}),JSON.stringify({...a,checks:['false-stage']}),JSON.stringify({...a,checks:[1]}),JSON.stringify({...a,location:'anywhere'}),' '.repeat(MAX_IMPORT_BYTES+1),raw.replace('"notes": {','"notes": {"__proto__": {},')])assert.throws(()=>parseWorkbook(value));
 assert.deepEqual(a,emptyWorkbook());assert.equal({}.polluted,undefined);
 const unicode={...a,notes:Object.fromEntries(Object.keys(a.notes).map(k=>[k,'界'.repeat(3900)]))};assert.deepEqual(parseWorkbook(exportWorkbook(unicode)),unicode);
 assert.throws(()=>parseWorkbook('界'.repeat(MAX_IMPORT_BYTES/2)),/300 KB/);
});
test('source and directory roles remain explicit, primary-linked and searchable without inventing provider availability',()=>{
 assert.equal(directory.filter(d=>d.kind==='Endorser').length,3);assert.equal(directory.filter(d=>d.kind==='Invitation-only programme').length,1);
 assert.match(directory.find(d=>d.id==='gep').role,/already invited/);assert.match(directory.find(d=>d.id==='envestors').availability,/could not be verified/);
 assert.match(directory.find(d=>d.id==='advisers').role,/not a named adviser/);
 for(const s of Object.values(sources))assert.equal(new URL(s.url).protocol,'https:');
 for(const d of directory)for(const key of ['url','proof'])assert.equal(new URL(d[key]).protocol,'https:');
 assert.deepEqual(filterDirectory('WALES','Business support','Wales').map(d=>d.id),['wales']);assert.equal(filterDirectory('not-a-real-provider').length,0);assert.equal(filterDirectory('','Endorser').length,3);
 assert.equal(new Set(stages.flatMap(s=>s.fields.map(f=>f.id))).size,Object.keys(emptyWorkbook().notes).length);assert.equal(stages.length,6);for(const s of stages)assert.ok(sources[s.source]);
});
test('founder entry is integrated with public metadata; private notes have no persistence, network or HTML rendering path',async()=>{
 const ui=await readFile(new URL('../src/founder-ui.tsx',import.meta.url),'utf8');assert.doesNotMatch(ui,/\bfetch\s*\(|localStorage|sessionStorage|dangerouslySetInnerHTML|navigator\.sendBeacon/);assert.match(ui,/beforeunload/);assert.match(ui,/setPending\(parsed\)/);assert.match(ui,/Replace with this workbook/);
 const pages=JSON.parse(await readFile(new URL('../shared/pages.json',import.meta.url),'utf8'));assert.equal(pages['innovator-founder'].path,'/innovator-founder');
 const main=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');assert.match(main,/view === 'innovator-founder' && <FounderPage/);assert.match(main,/label: "Founder hub"/);assert.match(main,/view === 'innovator-founder' \? <p[\s\S]*Founder notes stay in this tab[\s\S]*: <CareerAccountLink/);
});
