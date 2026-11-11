import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {completeCVText,readJSONResume,importProfileDetails,applyCVPreview,profileSignature} from '../shared/cv-import.js';
let vite,importCV;
before(async()=>{
  vite=await createServer({server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
  ({importCV}=await vite.ssrLoadModule('/src/cv-import.ts'));
});
after(async()=>{await vite?.close();});
const cv='Fictional Example\nA fictional library assistant who organised catalogue records and helped visitors.\nFINAL SOURCE FACT';
test('text import retains final source facts and never silently truncates a long CV',async()=>{
  const exact='Fictional CV\n'+'x'.repeat(29980)+'\nEND-CV';assert.equal(exact.length,30000);
  assert.equal((await importCV(new File([exact],'cv.txt'))).text,exact);
  await assert.rejects(importCV(new File([exact+' OMITTED FACT'],'cv.txt')),/more than 30,000/);
  assert.equal((await importCV(new File(['\uFEFF'+cv+'\n'],'CV.TXT'))).text,cv);
});
test('invalid, empty, too-large and unreadable file inputs fail before a profile can change',async()=>{
  for(const [file,error] of [[new File([],'empty.txt'),/containing your CV/],[new File(['x'.repeat(5000001)],'big.txt'),/smaller than 5 MB/],[new File([cv],'cv.exe'),/PDF, DOCX/],[new File(['short'],'cv.txt'),/not enough/],[new File([cv+'\u0000'],'cv.txt'),/read reliably/],[new File([new Uint8Array([255,255]),cv],'cv.txt'),/read reliably/]])await assert.rejects(importCV(file),error);
});
test('JSON Resume retains contact fields, all standard sections and textual extensions',()=>{
  const source={basics:{name:'Fictional Example',email:'fictional@example.invalid',summary:cv,location:{city:'Cardiff'},profiles:[{network:'Example',url:'https://example.invalid/profile'}]},work:[{name:'Example employer',position:'Assistant',startDate:'2023',endDate:'2024',highlights:['SOURCE WORK FACT']}],volunteer:[{organization:'Example Charity',summary:'SOURCE VOLUNTEER FACT'}],education:[{institution:'Example College',courses:['SOURCE COURSE FACT']}],certificates:[{name:'SOURCE CERTIFICATE FACT'}],awards:[{title:'SOURCE AWARD FACT'}],publications:[{name:'SOURCE PUBLICATION FACT'}],languages:[{language:'Telugu',fluency:'SOURCE LANGUAGE FACT'}],interests:[{name:'SOURCE INTEREST FACT'}],references:[{reference:'SOURCE REFERENCE FACT'}],projects:[{name:'SOURCE PROJECT FACT',roles:['Contributor']}],skills:[{name:'SQL',keywords:['Reporting']}],extension:{note:'SOURCE EXTENSION FACT'},meta:{private:'IGNORED METADATA'},$schema:'IGNORED SCHEMA'};
  const result=readJSONResume(JSON.stringify(source));
  for(const phrase of ['fictional@example.invalid','https://example.invalid/profile','2023','2024','SOURCE WORK FACT','SOURCE VOLUNTEER FACT','SOURCE COURSE FACT','SOURCE CERTIFICATE FACT','SOURCE AWARD FACT','SOURCE PUBLICATION FACT','SOURCE LANGUAGE FACT','SOURCE INTEREST FACT','SOURCE REFERENCE FACT','SOURCE PROJECT FACT','SOURCE EXTENSION FACT','Contributor','Telugu'])assert.ok(result.text.includes(phrase),phrase);
  assert.doesNotMatch(result.text,/IGNORED/);assert.equal(result.profile.city,'Cardiff');assert.equal(result.profile.skills,'SQL, Reporting');assert.match(result.warnings[0],/metadata/);
});
test('JSON limits reject the complete import rather than dropping later fields',()=>{
  assert.throws(()=>readJSONResume(JSON.stringify({basics:{summary:'x'.repeat(30000)},certificates:[{name:'REQUIRED END FACT'}]})),/more than 30,000/);
  assert.throws(()=>readJSONResume('{'),/valid JSON/);
  for(const value of [null,[],{basics:[]},{basics:null}])assert.throws(()=>readJSONResume(JSON.stringify(value)),/basics/);
  assert.throws(()=>readJSONResume(JSON.stringify({basics:{}})),/no CV text/);
  let nested='source';for(let i=0;i<15;i++)nested={child:nested};
  assert.throws(()=>readJSONResume(JSON.stringify({basics:{summary:cv},extension:nested})),/too complex/);
  assert.throws(()=>readJSONResume(JSON.stringify({basics:{summary:cv},extension:Array(2100).fill(null)})),/too complex/);
  const named=readJSONResume('{"basics":{"summary":"'+cv.replaceAll('\n','\\n')+'"},"constructor":"SOURCE CONSTRUCTOR FACT","__proto__":{"note":"SOURCE PROTOTYPE FACT"}}');
  assert.match(named.text,/SOURCE CONSTRUCTOR FACT/);assert.match(named.text,/SOURCE PROTOTYPE FACT/);assert.doesNotMatch(named.text,/\[object Object\]|function Object/);
});
test('overlong profile fields remain in the source preview but are not clipped into contact details',async()=>{
  const name='N'.repeat(101),source={basics:{name,summary:cv,email:'fictional@example.invalid'}};
  const result=await importCV(new File([JSON.stringify(source)],'cv.json'));
  assert.ok(result.text.includes(name));assert.equal(result.profile.name,undefined);assert.equal(result.profile.email,'fictional@example.invalid');assert.match(result.warnings.join(' '),/name is too long/);
});
test('applying a preview requires the unchanged profile, keeps details by default and preserves other workspace data',()=>{
  const data={profile:{cv:'Original master CV',name:'Existing Name',email:'existing@example.invalid',phone:'07123456789',city:'Cardiff',goal:'Analyst',sponsorship:'later',skills:'Existing skills'},applications:[{id:'saved'}]};
  const baseline=profileSignature(data.profile),parsed={text:cv,profile:{name:'Fictional Example',email:'',sponsorship:'not_needed',goal:'forged'}};
  const onlyText=applyCVPreview(data,baseline,parsed,false);assert.deepEqual(onlyText.profile,{...data.profile,cv});assert.equal(onlyText.applications,data.applications);assert.equal(data.profile.cv,'Original master CV');
  const withDetails=applyCVPreview(data,baseline,parsed,true);assert.equal(withDetails.profile.name,'Fictional Example');assert.equal(withDetails.profile.email,'existing@example.invalid');assert.equal(withDetails.profile.sponsorship,'later');assert.equal(withDetails.profile.goal,'Analyst');
  const changed={...data,profile:{...data.profile,cv:'Newer source'}};assert.equal(applyCVPreview(changed,baseline,parsed,true),changed);
  assert.deepEqual(importProfileDetails({name:'',email:'',cv:'not a detail',skills:'x'.repeat(2001)}).details,{});
});
