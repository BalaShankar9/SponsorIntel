import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareCase, resolveExtraction, evaluateReview, proposalRequests, analystSchema, reviewerSchema} from '../experiments/research-scope-v3/contract.mjs';
import {proposalPreflight} from '../experiments/research-scope-v3/preflight.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const record = (description, id='fictional') => ({id, title: 'Fictional engineer', company: 'Example', description, apply_url: `https://example.test/${id}`,
  accepted_labels: ['ANSWER_KEY'], stored_verdict: 'SECRET', private_notes: 'DO NOT INCLUDE', expected: 'HIDDEN'});
const source = description => prepareCase(record(description), '2026-10-08T00:16:21Z');
const fact = (subject='work_visa', stance='offered', scope='this_role', id='f1') => ({id, subject, stance, scope, quote_ids:['q1'], reason:'Fictional proposed statement.'});
const extract = (s, facts, complete=true) => resolveExtraction({job_id:s.job_id, complete, facts}, s);
const review = e => ({job_id:e.job_id, checks:e.facts.map(f=>({fact_id:f.id, supported:true, reason:'Synthetic assertion, not a model judgment.'})),
  coverage:{supported:true,reason:'Synthetic complete-source check.'}, label:{supported:true,reason:'Synthetic label check.'}});

test('proposal preserves complete Unicode/CRLF/whitespace sources and removes answer-key fields', () => {
  const description='x'.repeat(599)+'🧪\r\n'+' '.repeat(600)+'Final refusal.';
  const s=source(description);
  assert.equal(s.source_blocks.map(q=>q.text).join(''),description);
  const request=proposalRequests(s), serialized=JSON.stringify(request);
  for(const hidden of ['ANSWER_KEY','SECRET','DO NOT INCLUDE','HIDDEN','accepted_labels','stored_verdict']) assert.ok(!serialized.includes(hidden));
  assert.equal(request.parameters.max_tokens,8192); assert.equal(request.parameters.response_format.type,'json_object');
  assert.deepEqual(request.parameters.chat_template_kwargs,{enable_thinking:true});
  assert.equal(request.network_enabled,false); assert.equal(request.scheduled,false);
  assert.equal(analystSchema(s).properties.facts.maxItems,4);
  assert.throws(()=>source('a'.repeat(16001)),/bounded/);
  assert.throws(()=>proposalRequests({...s,current:true}),/historical/);
});

test('non-visa subjects and other-role promises cannot derive a visa refusal or offer', () => {
  const s=source('Export authorisation without sponsorship. We fund professional training. A different role offers visa sponsorship.');
  for(const subject of ['export_authorisation','professional_training','commercial','unspecified'])
    for(const stance of ['offered','conditional','refused','mentioned']) assert.equal(extract(s,[fact(subject,stance)]).provisional_label,'not_stated');
  for(const scope of ['other_role_or_group','unspecified']) assert.equal(extract(s,[fact('work_visa','offered',scope)]).provisional_label,'not_stated');
  assert.equal(extract(s,[]).provisional_label,'not_stated');
  assert.equal(extract(s,[fact('work_visa','mentioned')]).provisional_label,'not_stated');
});

test('distinct visa statements remain decisive beside export and training text; incomplete coverage has no label', () => {
  const s=source('Fictional mixed subjects and conditions, all require actual semantic review.');
  assert.equal(extract(s,[fact('export_authorisation','refused'),fact('work_visa','offered','this_role','f2')]).provisional_label,'offered');
  assert.equal(extract(s,[fact(),fact('work_visa','conditional','this_role','f2')]).provisional_label,'conditional');
  assert.equal(extract(s,[fact(),fact('work_visa','refused','this_role','f2')]).provisional_label,'unavailable');
  const e=extract(s,[fact()],false);
  assert.equal(e.provisional_label,null);assert.equal(evaluateReview(review(e),e,s).accepted,false);
});

test('quotation identity, order, cardinality and bounded text fail without weakening original source', () => {
  const s=source('Fictional visa sponsorship available.');
  for(const facts of [[{...fact(),quote_ids:['q99']}],[{...fact(),quote_ids:['q1','q1']}],[fact('work_visa','offered','this_role','f2')],
    [{...fact(),quote:'invented'}],[{...fact(),subject:'anything'}],[{...fact(),reason:'x'.repeat(241)}],Array.from({length:5},(_,i)=>fact('work_visa','offered','this_role',`f${i+1}`))])
    assert.throws(()=>extract(s,facts));
  assert.throws(()=>resolveExtraction({job_id:'another',complete:true,facts:[]},s),/identity/);
  const e=extract(s,[fact()]);
  const changed=structuredClone(e);changed.facts[0].quotes[0].text='Changed source';
  assert.throws(()=>proposalRequests(s,changed),/changed/);
  assert.throws(()=>proposalRequests(s,{...e,provisional_label:'not_stated'}),/changed/);
});

test('critic must cover every fact, omissions and derived label; acceptance never authorises publication', () => {
  const s=source('Fictional visa support for this role.'),e=extract(s,[fact()]);
  for(const change of [r=>r.checks.pop(),r=>r.checks.push(r.checks[0]),r=>r.checks[0].fact_id='f9',r=>r.coverage.supported='yes',r=>r.extra=true]) {
    const r=review(e);change(r);assert.throws(()=>evaluateReview(r,e,s));
  }
  for(const key of ['coverage','label']) {const r=review(e);r[key].supported=false;assert.equal(evaluateReview(r,e,s).accepted,false);}
  const r=review(e);r.checks[0].supported=false;assert.equal(evaluateReview(r,e,s).accepted,false);
  assert.throws(()=>evaluateReview(review(e),{...e,provisional_label:'not_stated'},s),/changed/);
  assert.throws(()=>evaluateReview(review(e),e,{...s,job_id:'other'}),/identity/);
  const pass=evaluateReview(review(e),e,s);assert.equal(pass.accepted,true);assert.equal(pass.publishable,false);assert.equal(pass.independently_adjudicated,false);
  const empty=extract(s,[]);assert.equal(reviewerSchema(empty).properties.checks.maxItems,0);
  const request=proposalRequests(s,e);assert.equal(request.parameters.response_format.type,'json_schema');
  assert.equal(request.model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.equal(request.revision_limit,0);
  assert.equal(JSON.parse(request.parameters.messages[1].content).evidence.source_blocks.map(q=>q.text).join(''),s.source_blocks.map(q=>q.text).join(''));
});

test('a wrong model-supplied subject can pass structure: retain the semantic counterexample explicitly', () => {
  const s=source('The offer may require authorisation under export laws without sponsorship for an export licence.');
  const falselyClassified=extract(s,[fact('work_visa','refused')]);
  assert.equal(falselyClassified.provisional_label,'unavailable');
  assert.equal(evaluateReview(review(falselyClassified),falselyClassified,s).accepted,true);
  assert.equal(evaluateReview(review(falselyClassified),falselyClassified,s).publishable,false);
  // An honest subject assertion avoids the conflation, but no parser can certify that assertion.
  assert.equal(extract(s,[fact('export_authorisation','refused')]).provisional_label,'not_stated');
});

test('complete frozen-cohort preflight verifies bytes, 25 distinct two-case batches and rejects missing/tampered data', async () => {
  const manifest={id:'fictional-cohort',snapshot_at:'2026-10-08T00:16:21Z',cases:[],batches:Array.from({length:16},()=>({}))};
  const rows=Array.from({length:50},(_,i)=>{const r=record(`FICTIONAL public advert ${i}. No visa statement.`,`fictional-${i}`),json=JSON.stringify(r);
    manifest.cases.push({id:r.id,record_hash:sha(json),content_hash:sha(r.description)});return {dataset:manifest.id,job_id:r.id,record:json};});
  const result=await proposalPreflight(rows,manifest);
  assert.equal(result.source_records_verified,50);assert.equal(result.batches.length,25);
  assert.equal(new Set(result.batches.flatMap(b=>b.cases)).size,50);
  assert.ok(result.batches.every(b=>b.cases.length===2&&b.planned_max_calls===4));
  assert.equal(result.model_calls,0);assert.equal(result.production_writes,0);assert.equal(result.quality_verified,false);
  assert.ok(!JSON.stringify(result).includes('FICTIONAL public advert'));
  await assert.rejects(()=>proposalPreflight(rows.slice(1),manifest),/50-record/);
  await assert.rejects(()=>proposalPreflight([rows[1],...rows.slice(1)],manifest),/50-record/);
  await assert.rejects(()=>proposalPreflight([{...rows[0],record:rows[0].record+' '},...rows.slice(1)],manifest),/hash changed/);
  await assert.rejects(()=>proposalPreflight([{...rows[0],dataset:'another'},...rows.slice(1)],manifest),/identity/);
});
