import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTeachingVacancy} from '../worker/teaching-vacancies.js';
import {sourceDiagnostic} from '../worker/source-errors.js';
import {normaliseBoardJobs} from '../worker/jobs.js';
import {parseTeachingCandidate} from '../worker/teaching-discovery.js';
import {school,vacancy,advert} from './fixtures/teaching-board.mjs';
const now=Date.now(),row=vacancy(1),caption='Fictional School, Cardiff, Wales, CF10 1AA';
const parse=html=>parseTeachingVacancy(html,school,row,now);
const campus='Rainham Training Campus, New Road, Rainham, Essex, RM13 8GP';
const atCampus=()=>advert(row,now).replace(caption,school.company+', '+campus);

test('visible campus survives normalization while the organisation metadata retains its main address',async()=>{
 const raw=parse(atCampus()),[job]=await normaliseBoardJobs([raw],school,now);
 assert.equal(raw.location,campus+', United Kingdom');assert.equal(job.location,raw.location);
 const old=parse(advert(row,now));assert.deepEqual({...raw,location:old.location},old);
 assert.equal(job.sponsorship,'conditional');assert.equal(raw.visa_wording,row.visa);
});

test('observed New City College header resolves Rainham, not Poplar, in a fictional complete advert',()=>{
 const header=readFileSync(new URL('./fixtures/teaching-campus-header.html',import.meta.url),'utf8');
 const candidate={...school,company:'New City College',board:'130418--new-city-college'};
 const r={...row,title:'Lecturer Carpentry'};
 const html=advert(r,now,{patch:{hiringOrganization:{name:candidate.company,identifier:'130418'},jobLocation:{address:{addressCountry:'GB',addressLocality:'London',addressRegion:'London',postalCode:'E14 0AF',streetAddress:'Poplar High Street'}}}}).replace(/<div class="header-with-logo-title">[\s\S]*?<\/div>/,header);
 const actual=parseTeachingVacancy(html,candidate,r,now);
 assert.equal(actual.location,'New City College Rainham Campus, New Road, Rainham, Essex, RM13 8GP, United Kingdom');
 assert.doesNotMatch(actual.location,/Poplar|E14 0AF/);
});

test('map and related-role captions cannot replace the caption paired with the title',()=>{
 const html=atCampus()+'<aside><span class="govuk-caption-l">Fictional School, London, E14 0AF</span></aside>';
 assert.equal(parse(html).location,campus+', United Kingdom');
});

test('unknown, duplicate, wrongly attached or mismatched employer captions fail closed',()=>{
 const html=advert(row,now),span=`<span class="govuk-caption-l">${caption}</span>`;
 const cases=[html.replace('header-with-logo-title','unknown-header'),html.replace(span,''),html.replace(span,span+span),html.replace(caption,'Another School, Cardiff, CF10 1AA'),html.replace('</h1>','</h1></div><div class="other">'),html+'<div class="header-with-logo-title"></div>'];
 for(const value of cases)assert.throws(()=>parse(value),e=>sourceDiagnostic(e).code==='posting_identity');
});

test('missing, foreign, multiple, oversized or trailing ambiguous addresses do not fall back to the main office',()=>{
 for(const location of ['Cardiff','Cardiff, unknown','Paris, 75001','Cardiff, CF10 1AA or Rainham, RM13 8GP','Rainham, RM13 8GP or another campus','x'.repeat(300)+', RM13 8GP','RM13 8GP'])assert.throws(()=>parse(advert(row,now).replace(caption,school.company+', '+location)),e=>sourceDiagnostic(e).code==='posting_identity');
 const abroad=atCampus().replace('"addressCountry":"GB"','"addressCountry":"FR"');assert.throws(()=>parse(abroad));
});

test('caption whitespace is normalised and valid UK postcode spelling is preserved',()=>{
 for(const code of ['SW1A 1AA','M1 1AE','B33 8TH','GIR 0AA','RM138GP','rm13 8gp'])assert.equal(parse(advert(row,now).replace(caption,'  Fictional School,\n Rainham,  '+code+'  ')).location,'Rainham, '+code+', United Kingdom');
});

test('automatic discovery shares the campus evidence and retains unknown original posting time',()=>{
 const result=parseTeachingCandidate(atCampus(),row,now);
 assert.equal(result.content.location,campus);assert.equal(result.content.posted_at,null);
 assert.equal(result.content.method,'automated_source');assert.equal(result.content.state,'pending');
 const original=parseTeachingCandidate(advert(row,now),row,now);
 assert.deepEqual({...result,content:{...result.content,location:original.content.location}},original);
 assert.throws(()=>parseTeachingCandidate(atCampus().replace('RM13 8GP','75001'),row,now),e=>e.reason==='advert_identity_changed');
});
