import test from 'node:test';import assert from 'node:assert/strict';
import {createJobNote,readJobNote,publicJobURL} from '../shared/job-note.js';
const input={url:'https://example.test/jobs/engineer?utm_source=demo',title:'Fictional engineer',company:'Example Studio',location:'London',text:'Fictional London engineering role. Build and test software with the product team. We may provide visa sponsorship, subject to eligibility.',confirmed:true,observedAt:'2026-11-03T20:00:00.000Z'};
test('job note roundtrip retains exact public text and provenance, with no applicant profile',async()=>{
 const packet=await createJobNote(input),read=await readJobNote(JSON.stringify(packet));assert.equal(read.advert.text,input.text);assert.equal(read.source.url,'https://example.test/jobs/engineer');assert.equal(read.source.observedAt,input.observedAt);assert.equal(read.wording.status,'conditional');assert.equal(read.wording.evidence[0].quote,'We may provide visa sponsorship, subject to eligibility.');assert.match(read.id,/^external-[a-f0-9]{24}$/);assert.equal('cv' in read,false);
});
test('import recomputes a forged verdict and refuses changed body or a workspace backup',async()=>{
 const packet=await createJobNote(input);packet.wording={status:'offered',evidence:[{quote:'FAKE OFFER'}]};assert.equal((await readJobNote(JSON.stringify(packet))).wording.status,'conditional');packet.advert.text+=' Changed.';await assert.rejects(readJobNote(JSON.stringify(packet)),/changed/);await assert.rejects(readJobNote(JSON.stringify({schema:'workspace',cv:'private'})),/Job notes/);
});
test('long descriptions fail without truncation; incomplete consent and private URLs fail',async()=>{
 await assert.rejects(createJobNote({...input,text:'a'.repeat(26001)}),/too long/);await assert.rejects(createJobNote({...input,confirmed:false}),/Confirm/);
 for(const url of ['https://user:secret@example.test/jobs/a','https://example.test/jobs/a?session=secret','javascript:alert(1)','http://example.test/jobs/a'])assert.throws(()=>publicJobURL(url));
 await assert.rejects(readJobNote('x'.repeat(160001)),/160 KB/);
});
test('duplicate identity uses source URL; changed text cannot silently become a second role',async()=>{
 const first=await readJobNote(JSON.stringify(await createJobNote(input))),second=await readJobNote(JSON.stringify(await createJobNote({...input,text:input.text+' Updated requirements.'})));assert.equal(first.id,second.id);assert.notEqual(first.advert.sha256,second.advert.sha256);
 const other=await readJobNote(JSON.stringify(await createJobNote({...input,url:'https://example.test/jobs/other'})));assert.notEqual(first.id,other.id);
});
