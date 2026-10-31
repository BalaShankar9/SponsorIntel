import test from 'node:test';
import assert from 'node:assert/strict';
import {advertSnapshot} from '../worker/advert-version.js';
import {savedAdvertState,acceptAdvertReview,workingAdvert} from '../shared/advert-version.js';
import {validateWorkspace} from '../worker/career-validation.js';

const job=()=>({id:'a'.repeat(24),company:'Fictional School',title:'Fictional Teacher',location:'London',description:'Fictional original. Teach English.',apply_url:'https://example.test/role',sponsorship:'conditional',evidence:'Fictional visa wording.',last_seen:'2026-10-18T12:00:00.000Z',application_deadline:'2026-11-01',closes_at:'2026-11-01T23:59:59Z',salary_excerpt:'Fictional salary',employment_type:'Full time',workplace:'On site'});
const app=(advert)=>({id:'private-fictional',jobId:advert.jobId,...workingAdvert(advert),sourceVersion:advert.version,notes:'My private notes',cv:'Keep my edited CV',coverLetter:'Keep my edited letter',analysis:'My own evidence notes',stage:'Applied',followUp:'2026-10-22',createdAt:'2026-10-01T00:00:00Z',preparedAt:'2026-10-17T00:00:00Z'});

test('advert versions ignore refresh times but include every substantive source fact and long-text tails',async()=>{
 const original=job(),snapshot=await advertSnapshot(original);
 assert.equal((await advertSnapshot({...original,last_seen:'2026-10-19T00:00:00Z',description_checked_at:'2026-10-19T00:00:00Z',active:0})).version,snapshot.version);
 for(const field of ['id','company','title','location','description','apply_url','sponsorship','evidence','application_deadline','closes_at','salary_excerpt','employment_type','workplace'])assert.notEqual((await advertSnapshot({...original,[field]:original[field]+' changed'})).version,snapshot.version,field);
 const long={...original,description:'x'.repeat(27000)+' old ending'};
 assert.notEqual((await advertSnapshot(long)).version,(await advertSnapshot({...long,description:'x'.repeat(27000)+' changed ending'})).version);
});

test('legacy, current, changed, malformed and held sources stay distinct without modifying saved work',async()=>{
 const advert=await advertSnapshot(job()),application=app(advert),snapshot={state:'current',advert};
 assert.equal(savedAdvertState(application,snapshot),'current');
 assert.equal(savedAdvertState({...application,description:'My deliberate edit'},snapshot),'current');
 assert.equal(savedAdvertState({...application,sourceVersion:'0'.repeat(64)},snapshot),'changed');
 const legacy={...application};delete legacy.sourceVersion;
 assert.equal(savedAdvertState(legacy,snapshot),'current');
 assert.equal(savedAdvertState({...legacy,description:'Old or edited text'},snapshot),'review_required');
 for(const state of ['held','expired','removed','stale','manual','unavailable'])assert.equal(savedAdvertState(application,{state,advert}),state);
 for(const broken of [undefined,{...advert,version:''},{...advert,description:null},{...advert,jobId:'b'.repeat(24)}])assert.equal(savedAdvertState(application,{state:'current',advert:broken}),'unavailable');
 assert.equal(application.cv,'Keep my edited CV');
});

test('explicit adoption preserves all private work and uses the newly reviewed metadata even when keeping edited text',async()=>{
 const old=await advertSnapshot(job()),expected=app(old),latest=await advertSnapshot({...job(),description:'Updated fictional requirements.',apply_url:'https://example.test/new-route',sponsorship:'unavailable',evidence:'Fictional refusal.'});
 for(const keep of [true,false]) {
  const data={version:2,profile:{cv:'PRIVATE FICTIONAL MASTER'},applications:[{...expected,notes:'A note added during review'}],searches:[{id:'saved-search'}]},before=structuredClone(data);
  const result=acceptAdvertReview(data,expected,latest,keep);
  assert.equal(result.status,'saved');assert.deepEqual(data,before);
  const accepted=result.data.applications[0];
  for(const key of ['notes','cv','coverLetter','analysis','stage','followUp','preparedAt','createdAt'])assert.equal(accepted[key],data.applications[0][key],key);
  assert.equal(accepted.description,keep?expected.description:latest.description);
  assert.equal(accepted.url,latest.url);assert.equal(accepted.sponsorship,'unavailable');assert.equal(accepted.sourceVersion,latest.version);
  assert.deepEqual(result.data.profile,data.profile);assert.deepEqual(result.data.searches,data.searches);
 }
 const long={...latest,description:'x'.repeat(27000)};
 assert.equal(acceptAdvertReview({applications:[expected]},expected,long,false).status,'too_long');
 for(const change of [{description:'New private edit'},{sourceVersion:'f'.repeat(64)},{jobId:'b'.repeat(24)}]) {
  const data={applications:[{...expected,...change}]};const result=acceptAdvertReview(data,expected,latest,false);assert.equal(result.status,'changed');assert.strictEqual(result.data,data);
 }
});

test('workspace save/import retains a valid reviewed source version without granting one to an older or malformed copy',async()=>{
 const application=app(await advertSnapshot(job()));
 for(const version of [undefined,'',123,'invalid',application.sourceVersion]) {
  const data=validateWorkspace({version:2,profile:{},applications:[{...application,sourceVersion:version}],searches:[]});
  assert.equal(data.applications[0].sourceVersion,version===application.sourceVersion?version:undefined);
  assert.equal(data.applications[0].cv,application.cv);
 }
});
