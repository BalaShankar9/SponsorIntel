import test from 'node:test';import assert from 'node:assert/strict';
import {jobIdentity,sameJob,nextStep} from '../extension-companion/identity.js';
import {leverAdvertURL} from '../extension-companion/lever.js';
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
test('Lever cards retain exact employer and role identity without accepting forms or lookalikes',()=>{
 const url='https://jobs.lever.co/example-studio/66a6c9f0-b504-4942-af22-b555969564e5';
 const a=jobIdentity(url+'?lever-source=example');
 assert.equal(a.url,url);assert.equal(a.provider,'original');
 assert.ok(sameJob(a,jobIdentity(url+'/')));
 assert.equal(sameJob(a,jobIdentity(url.replace('example-studio','other-employer'))),false);
 assert.equal(sameJob(a,jobIdentity(url.replace('66a6c9f0','66a6c9f1'))),false);
 for(const bad of [url+'/apply',url+'/apply/extra',url+'?session=private',url.replace('https:','http:'),url.replace('jobs.lever.co','jobs.lever.co.evil.example'),url.replace('https://','https://user:pass@'),'https://jobs.lever.co/example-studio','https://jobs.lever.co/jobs/catalogue'])assert.equal(jobIdentity(bad),null,bad);
 assert.equal(leverAdvertURL(url+'/apply',true),url);
 assert.equal(leverAdvertURL(url+'/apply'),null);
 assert.equal(leverAdvertURL(url.replace('jobs.lever.co','jobs.eu.lever.co')),url.replace('jobs.lever.co','jobs.eu.lever.co'));
});
