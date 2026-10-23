import test from 'node:test';
import assert from 'node:assert/strict';
import {cvApplicationRestriction,applicationSourceURL} from '../shared/application-instructions.js';
import {careerAPI} from '../worker/career.js';
import {buildEvidenceReview} from '../worker/career-evidence.js';

const refusal='CVs will not be accepted for this application.';
const description='Fictional school seeks a teacher with a degree and QTS. Complete the employer application form. '+refusal;

test('application format retains explicit role-scoped CV refusal without guessing an unknown format',()=>{
  for(const quote of [refusal,'CVs will not be accepted.','We do not accept CVs.','Please note that CVs will not be accepted for this application.','We do not accept CVs for this role.','CVs cannot be accepted for the vacancy.','CVs won’t be accepted for this post!'])
    assert.deepEqual(cvApplicationRestriction('About the job.\n'+quote+'\nFurther information.'),{quote});
  for(const quote of [
    'CVs are accepted for this application.', 'A CV is not required for this application.',
    'Unsolicited CVs will not be accepted for this role.',
    'We do not accept agency CVs for this role.', 'We do not accept CVs from recruitment agencies.',
    'Incomplete CVs will not be accepted for this application.',
    'CVs will not be accepted for this application unless you are an internal applicant.',
    'CVs will not be accepted for this application?',
    'Ask whether CVs will not be accepted for this application.',
    'The old policy said CVs will not be accepted for this application.',
    'If the portal fails, CVs will not be accepted for this application.',
    'CVs will not be accepted for other roles.',
    'CVs will not be accepted for this application; instead email us your bank details.',
    'Complete the application form and attach your CV.', '', null,
  ]) assert.equal(cvApplicationRestriction(quote),null,String(quote));
  assert.equal(cvApplicationRestriction('x'.repeat(100001)+refusal),null);
  assert.equal(applicationSourceURL('javascript:alert(1)'),null);
  assert.equal(applicationSourceURL('https://private:secret@example.com/role'),null);
  assert.equal(applicationSourceURL('https://example.com/role'), 'https://example.com/role');
});

test('CV refusal rejects generation before a model call or allowance charge, but leaves the evidence route available',async()=>{
  let aiCalls=0,budgetTouches=0;
  const env={AI:{run(){aiCalls++;throw Error('No model expected');}},DB:{prepare(){budgetTouches++;throw Error('No budget expected');}}};
  const profile={name:'Fictional Local Applicant',cv:'Fictional applicant with a degree and QTS. Taught English in a fictional school, with communication and lesson planning evidence. No real person.'};
  const application={id:'fictional-form-role',title:'Fictional Teacher',company:'Fictional School',description,sponsorship:'conditional'};
  const request=kind=>new Request('https://sponsorintel.london/api/career/generate',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://sponsorintel.london'},body:JSON.stringify({profile,application,kind,consent:true})});
  const blocked=await careerAPI(request('cv'),env);
  assert.equal(blocked.status,409);assert.match((await blocked.json()).error,/employer’s requested format/);
  assert.equal(aiCalls,0);assert.equal(budgetTouches,0);
  const evidence=await careerAPI(request('analysis'),env);
  assert.equal(evidence.status,200);const result=await evidence.json();
  assert.match(result.text,/APPLICATION FORMAT/);assert.ok(result.text.includes(refusal));
  assert.equal(aiCalls,0);assert.equal(budgetTouches,0);
  assert.doesNotMatch(buildEvidenceReview(profile,{...application,description:'Submit your CV with the application form.'}),/APPLICATION FORMAT/);
});
