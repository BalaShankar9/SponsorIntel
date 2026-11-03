import test from 'node:test';import assert from 'node:assert/strict';
import {jobIdentity,sameJob,nextStep} from '../extension-companion/identity.js';
test('LinkedIn job identities survive slugs/tracking but never cross jobs',()=>{
 const a=jobIdentity('https://www.linkedin.com/jobs/view/backend-engineer-1234567890/?trackingId=x');
 assert.equal(a.key,'linkedin:1234567890');
 assert.ok(sameJob(a,jobIdentity('https://www.linkedin.com/jobs/search/?currentJobId=1234567890')));
 assert.equal(sameJob(a,jobIdentity('https://www.linkedin.com/jobs/view/1234567891/')),false);
 assert.equal(jobIdentity('https://linkedin.com.evil.example/jobs/view/1234567890').provider,'original');
 assert.equal(jobIdentity('https://www.linkedin.com/feed/'),null);
});
test('Indeed split and original links match the same exact key',()=>{
 const a=jobIdentity('https://uk.indeed.com/jobs?q=nurse&vjk=a123bc45');
 assert.equal(a.key,'indeed:a123bc45');assert.equal(a.url,'https://uk.indeed.com/viewjob?jk=a123bc45');
 assert.ok(sameJob(a,jobIdentity('https://uk.indeed.com/viewjob?jk=a123bc45&from=web')));
 assert.equal(sameJob(a,jobIdentity('https://uk.indeed.com/viewjob?jk=bbbb9999')),false);
});
test('original query identities stay separate; token links and non-http targets are refused',()=>{
 const a=jobIdentity('https://example.test/jobs/detail?id=1&utm_source=demo');
 assert.equal(a.url,'https://example.test/jobs/detail?id=1');
 assert.equal(sameJob(a,jobIdentity('https://example.test/jobs/detail?id=2')),false);
 assert.equal(jobIdentity('https://example.test/jobs/detail?session=private'),null);
 for(const value of ['javascript:alert(1)','file:///jobs/test','chrome://jobs/view/1','https://example.test/careers/'])assert.equal(jobIdentity(value),null);
 assert.equal(sameJob(null,null),false);
});
test('next actions do not turn wording into personal eligibility',()=>{
 assert.match(nextStep('offered'),/conditions/);assert.match(nextStep('conditional'),/not confirmation/);assert.match(nextStep('unclear'),/not a refusal/);
});
