import test from 'node:test';
import assert from 'node:assert/strict';
import {draftSourceChecks} from '../shared/draft-source-check.js';

test('retained availability, negative experience and degree-timing failures become reading prompts, not verdicts',()=>{
 const examples=[['I am eager to contribute and am available to start immediately.','availability'],['Regarding this requirement, I have not performed this specific task in my professional history.','absence'],['During my BA Geography, I developed a project named Weather Table.','timeline']];
 for(const [text,id] of examples){const result=draftSourceChecks(text,'coverLetter');assert.equal(result.state,'checked');assert.equal(result.matches[0].id,id);assert.equal(result.verified,false);assert.ok(result.matches[0].excerpt.includes(text));}
});
test('source-like and negated wording remains a question; keywords cannot approve the claim',()=>{
 for(const text of ['I am not available to start immediately.','I am available for an interview after notice.','I have no prior professional experience.','As part of my degree, I built a personal project.'])assert.ok(draftSourceChecks(text).matches.length,text);
 const r=draftSourceChecks('Skilled in maintaining simple web pages using HTML and CSS.');assert.equal(r.total,0);assert.equal(r.verified,false); // Known semantic error deliberately outside finite phrase coverage.
 for(const text of ['Interview scheduling tools using local fictional data.','The employer requires experience.','Personal project: a local Python CSV exercise.'])assert.equal(draftSourceChecks(text).total,0);
});
test('Unicode and line endings preserve exact offsets for editor selection without rewriting',()=>{
 const text='Éva — fictional\r\nDuring my BSc, I built a sample.\r\nI am available to start immediately.';
 const r=draftSourceChecks(text);assert.equal(r.total,2);
 for(const m of r.matches){assert.equal(m.excerpt,text.slice(m.excerpt_start,m.excerpt_end));assert.ok(m.excerpt.includes(text.slice(m.offset,m.offset+m.length)));}
 assert.equal(text.slice(r.matches[1].offset,r.matches[1].offset+r.matches[1].length),'available to start');
 assert.deepEqual(draftSourceChecks(text),r); // No stateful global-regex carry-over.
});
test('long, empty, unsupported and crowded inputs report their bounds without a false all-clear',()=>{
 assert.equal(draftSourceChecks('','cv').state,'empty');assert.equal(draftSourceChecks('Available to start immediately.','interview').state,'not_applicable');assert.equal(draftSourceChecks('x'.repeat(40001)).state,'too_long');assert.equal(draftSourceChecks(null).state,'too_long');
 const r=draftSourceChecks('I am available to start immediately.\n'.repeat(30));assert.equal(r.total,30);assert.equal(r.matches.length,24);assert.equal(r.limited,true);assert.equal(r.verified,false);
 const long=draftSourceChecks('x'.repeat(39000)+' During my degree, I built a prototype.');assert.equal(long.total,1);assert.ok(long.matches[0].excerpt.length<400);
});
