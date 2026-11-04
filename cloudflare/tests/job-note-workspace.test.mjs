import test from 'node:test';
import assert from 'node:assert/strict';
import {createJobNote} from '../shared/job-note.js';
import {planJobNoteImport} from '../shared/job-note-workspace.js';
import {manualApplicationId} from '../shared/preparation-availability.js';

const scope='3:fictional-applicant';
const note=await createJobNote({url:'https://example.test/jobs/engineer?job=17',title:'Fictional engineer',company:'Example Studio',location:'London',text:'Fictional engineering role. Build and test accessible software with a small product team. We may provide visa sponsorship, subject to eligibility.',confirmed:true,observedAt:'2026-11-03T20:00:00.000Z'});
const application={id:'saved-role',jobId:'existing-source-id',url:note.source.url+'&utm_source=test#details',description:'Earlier reviewed description',notes:'Private fictional notes',cv:'Existing fictional CV',coverLetter:'Existing fictional letter',stage:'Preparing',updatedAt:'2026-10-30T10:00:00.000Z'};
const workspace={profile:{cv:'Fictional master CV'},applications:[application],searches:[]};
const plan=(data=workspace,packet=note,expected=scope)=>planJobNoteImport(data,packet,'Example Studio',expected,scope);

test('tracked re-import reuses the existing role and changes no advert, notes, document or profile',()=>{
 const before=structuredClone(workspace);assert.deepEqual(plan(),{status:'existing',id:application.id});assert.deepEqual(workspace,before);
 const changed={...note,advert:{...note.advert,text:note.advert.text+' New requirements.'}};
 assert.deepEqual(plan(workspace,changed),{status:'existing',id:application.id});assert.deepEqual(workspace,before);
});
test('different role query values stay separate; only known tracking and fragments are ignored',()=>{
 const different={...note,source:{...note.source,url:'https://example.test/jobs/engineer?job=18'}};
 assert.equal(plan(workspace,different).status,'ready');
 for(const url of ['https://example.test/jobs/engineer?job=17&department=care','https://different.test/jobs/engineer?job=17'])
  assert.equal(plan(workspace,{...note,source:{...note.source,url}}).status,'ready');
});
test('multiple existing workspaces are held without choosing, merging or modifying one',()=>{
 const data={...workspace,applications:[application,{...application,id:'second-copy',url:note.source.url}]},before=structuredClone(data);
 assert.deepEqual(plan(data),{status:'ambiguous'});assert.deepEqual(data,before);
});
test('a full workspace can reopen a matching role but cannot add another',()=>{
 const data={...workspace,applications:Array.from({length:100},(_,i)=>({...application,id:'saved-'+i,url:i?'https://example.test/jobs/'+i:application.url}))};
 assert.deepEqual(plan(data),{status:'existing',id:'saved-0'});
 assert.deepEqual(plan(data,{...note,source:{...note.source,url:'https://example.test/jobs/new'}}),{status:'full'});
});
test('stale account or reload scope cannot import or select private work',()=>{
 for(const expected of ['', '2:fictional-applicant','3:another-applicant','3:'])assert.deepEqual(plan(workspace,note,expected),{status:'changed'});
});
test('malformed old links do not crash import or falsely match; private incoming links fail',()=>{
 assert.equal(plan({...workspace,applications:[{...application,url:'not a URL'}]}).status,'ready');
 assert.throws(()=>plan(workspace,{...note,source:{...note.source,url:'https://example.test/jobs/engineer?session=private'}}),/private session/);
});
test('a new role keeps the entire advert on the existing manual preparation route',()=>{
 const p=plan({...workspace,applications:[]});assert.equal(p.status,'ready');assert.equal(p.job.description,note.advert.text);assert.equal(p.job.apply_url,note.source.url);
 assert.equal(manualApplicationId(p.job.id),true);assert.equal(p.job.sponsorship,'not_stated');assert.equal(p.job.last_seen,'');assert.match(p.notes,/not independently verified/);
 assert.equal('sourceVersion' in p.job,false);assert.equal('cv' in p.job,false);assert.equal('stage' in p.job,false);
});
test('invalid or oversized imports fail without creating a partial role',()=>{
 assert.throws(()=>planJobNoteImport(workspace,note,'',scope,scope),/employer/);
 assert.throws(()=>plan(workspace,{...note,advert:{...note.advert,text:'x'.repeat(26001)}}),/complete advert/);
});
