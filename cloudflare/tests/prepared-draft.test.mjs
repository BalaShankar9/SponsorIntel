import test from 'node:test';
import assert from 'node:assert/strict';
import {beginPreparedDraft,acceptPreparedDraft} from '../shared/prepared-draft.js';

const fixture=()=>({version:2,profile:{cv:'Fictional training exercise, not employment.',skills:'Planning'},applications:[{id:'a',jobId:'job-a',title:'Coordinator',company:'Fictional employer',description:'A complete fictional advert.',sponsorship:'not_stated',evidence:'',url:'https://example.test/a',cv:'Keep my existing draft',coverLetter:'Existing letter',notes:'Old note',stage:'Preparing',createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z'}],searches:[]});
const result={text:'Fictional prepared draft',generatedAt:'2026-10-11T14:00:00.000Z'};
const begin=d=>beginPreparedDraft(d,'a','cv','session-a',1);
const finish=(d,t,r=result)=>acceptPreparedDraft(d,t,r,'session-a',1);

test('an unchanged preparation saves only its target document and retains intervening unrelated work',()=>{
 const d=fixture(),ticket=begin(d),current=structuredClone(d);
 Object.assign(current.applications[0],{notes:'Keep this new note',stage:'Interview',coverLetter:'A manually revised letter'});
 current.searches.push({id:'new-search'});
 const accepted=finish(current,ticket);
 assert.equal(accepted.status,'saved');
 assert.deepEqual(accepted.data.applications[0],{...current.applications[0],cv:result.text,preparedAt:result.generatedAt,updatedAt:result.generatedAt});
 assert.deepEqual(accepted.data.searches,current.searches);
 assert.equal(current.applications[0].cv,'Keep my existing draft');
 assert.equal(d.applications[0].notes,'Old note');
});

test('a response from earlier CV, advert, sponsorship evidence or target text cannot overwrite current work',()=>{
 const edits=[d=>d.profile.cv='Corrected fictional source',d=>d.profile.skills='Corrected skill',...['jobId','title','company','description','sponsorship','evidence','url','sourceVersion','location','cv'].map(key=>d=>d.applications[0][key]='Changed value'),d=>d.applications=[]];
 for(const edit of edits){const d=fixture(),ticket=begin(d);edit(d);const before=structuredClone(d);const accepted=finish(d,ticket);assert.equal(accepted.status,'changed');assert.strictEqual(accepted.data,d);assert.deepEqual(d,before);}
});

test('workspace reload, sign out and newer requests supersede an earlier result without changing data',()=>{
 const d=fixture(),ticket=begin(d);
 for(const [scope,id] of [['session-b',1],['session-a',2],['session-a',undefined]]){
  const accepted=acceptPreparedDraft(d,ticket,result,scope,id);assert.equal(accepted.status,'superseded');assert.strictEqual(accepted.data,d);
 }
 const newer=beginPreparedDraft(d,'a','cv','session-a',2);
 assert.equal(acceptPreparedDraft(d,newer,result,'session-a',2).status,'saved');
});

test('empty, malformed and undated returned documents preserve the existing draft',()=>{
 for(const r of [null,{}, {...result,text:''},{...result,text:'  '},{...result,text:42},{...result,generatedAt:''},{...result,generatedAt:'not a date'}]){
  const d=fixture(),accepted=finish(d,begin(d),r);assert.equal(accepted.status,'invalid');assert.strictEqual(accepted.data,d);
 }
});

test('all supported documents protect their own text and only capture the intended generation inputs',()=>{
 for(const kind of ['analysis','cv','coverLetter','interview','companyResearch','portfolio','learningPlan']){
  const d=fixture(),ticket=beginPreparedDraft(d,'a',kind,'session-a',1);
  assert.deepEqual(Object.keys(ticket.input.application),['id','jobId','title','company','location','url','description','sponsorship','evidence','sourceVersion']);
  d.applications[0][kind]='My manual revision';
  assert.equal(finish(d,ticket).status,'changed');
 }
 assert.throws(()=>beginPreparedDraft(fixture(),'missing','cv','session-a',1));
 assert.throws(()=>beginPreparedDraft(fixture(),'a','notes','session-a',1));
 const d=fixture(),ticket=begin(d);d.profile.cv='New source';assert.notEqual(ticket.input.profile.cv,d.profile.cv);
});
