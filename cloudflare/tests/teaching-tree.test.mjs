import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument} from 'htmlparser2';
import {findTeachingNodes} from '../worker/teaching-tree.js';
import {parseTeachingCatalogue,parseTeachingVacancy} from '../worker/teaching-vacancies.js';
import {sourceDiagnostic} from '../worker/source-errors.js';
import {school,vacancy,advert,catalogue} from './fixtures/teaching-board.mjs';

test('matching ancestors do not hide nested duplicates, text or later siblings',()=>{
  const tree=parseDocument('<section id="outer"><p id="first">one<!--note--><b id="nested">two</b></p><p id="last">three</p></section>');
  const all=findTeachingNodes(tree,()=>true);
  assert.deepEqual(all.map(n=>n.attribs?.id||n.data||n.type),['root','outer','first','one','note','nested','two','last','three']);
  assert.deepEqual(findTeachingNodes(tree,n=>!!n.attribs?.id).map(n=>n.attribs.id),['outer','first','nested','last']);
  assert.strictEqual(all[0],tree);
  assert.strictEqual(findTeachingNodes(tree,n=>n.attribs?.id==='nested')[0],tree.children[0].children[0].children[2]);
});

test('a deeply nested irrelevant page section cannot exhaust the traversal call stack',()=>{
  const tree=parseDocument('<div>'.repeat(12000)+'<h2>Nested</h2>'+'</div>'.repeat(12000));
  assert.equal(findTeachingNodes(tree,n=>n.name==='div').length,12000);
  assert.equal(findTeachingNodes(tree,n=>n.name==='h2')[0].children[0].data,'Nested');
});

test('large page surroundings preserve complete role output and still reject later conflicting identity',()=>{
  const now=Date.now(),row=vacancy(1),html=advert(row,now),noise='<nav>'+('<div><span>Other page content</span></div>'.repeat(2500))+'</nav>';
  assert.deepEqual(parseTeachingVacancy(noise+html+noise,school,row,now),parseTeachingVacancy(html,school,row,now));
  for(const addition of ['<h1>Another title</h1>','<section id="job-details"></section>','<input name="vacancy_id" value="00000000-0000-4000-8000-999999999999">','<div class="header-with-logo-title"></div>']){
    assert.throws(()=>parseTeachingVacancy(noise+html+noise+addition,school,row,now),e=>['posting_identity','invalid_sections'].includes(sourceDiagnostic(e).code));
  }
  const nested=html.replace('<section id="job-details">','<section id="job-details"><section id="job-details"></section>');
  assert.throws(()=>parseTeachingVacancy(nested,school,row,now),e=>sourceDiagnostic(e).code==='invalid_sections');
});

test('catalogue ordering, all twenty originals and duplicate checks survive large surroundings',()=>{
  const rows=Array.from({length:20},(_,i)=>vacancy(i+1)),noise='<nav>'+'<span>Other links</span>'.repeat(5000)+'</nav>';
  for(const page of [1,2]){
    const html=catalogue(rows,page);
    assert.deepEqual(parseTeachingCatalogue(noise+html+noise,school,page),parseTeachingCatalogue(html,school,page));
    assert.throws(()=>parseTeachingCatalogue(noise+html+noise+'<input name="organisation_slug" value="another-school">',school,page),e=>sourceDiagnostic(e).code==='incomplete_catalogue');
  }
});
