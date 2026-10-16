import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {discoveryURL,validateDiscovery,saveDiscovery,discoverySummary,discoveryFindings,discoveryAPI} from '../worker/discovery.js';
import {adminAPI} from '../worker/admin.js';
import {BOARDS} from '../worker/job-sources.js';
const now=Date.now(),at=t=>new Date(t).toISOString(),jobId='1234567890abcdef12345678';
function input(patch={},content={}){return {id:null,revision:0,request_key:crypto.randomUUID(),source_kind:'linkedin_job',source_url:'https://uk.linkedin.com/jobs/view/example-engineer-1234567890?trk=foo',content:{title:'Fictional engineer in London',employer:'Fictional employer',location:'London',observed_at:at(now),posted_at:null,posted_evidence:'',deadline:null,deadline_evidence:'',original_url:'',identity_url:'',identity_note:'',quote:'Visa sponsorship is available.',state:'pending',reason:'An illustrative source lead is awaiting original employer and current-opening verification.',follow_up_at:at(now+86400000),job_id:null,duplicate_of:null,method:'agent_assisted',...content},...patch};}
function job(env,patch={}){const j={id:jobId,board_id:BOARDS[0].id,company:'Fictional employer',title:'Fictional engineer',location:'London',description:'An illustrative engineering role. Visa sponsorship is available. This is a fictional local fixture.',apply_url:'https://example.com/careers/engineer',provider:'ashby',level:'experienced',sponsorship:'offered',evidence:'Visa sponsorship is available.',first_seen:at(now),last_seen:at(now),active:1,...patch};env.sql.prepare(`INSERT INTO jobs(${Object.keys(j).join(',')}) VALUES(${Object.keys(j).map(()=>'?').join(',')})`).run(...Object.values(j));}
function linked(patch={},content={}){return input(patch,{state:'linked',original_url:'https://example.com/careers/engineer',identity_url:'https://example.com/legal',identity_note:'The fictional employer identity matches this fictional original employer page.',job_id:jobId,follow_up_at:null,...content});}
function revised(result,patch={}){return input({id:result.lead.id,revision:result.lead.revision,source_url:result.lead.source_url,source_kind:result.lead.source_kind,content:{...result.lead.content,...patch}});}

test('LinkedIn jobs and ordinary posts deduplicate by stable source IDs; unsafe or nonindividual links fail',()=>{
 assert.equal(discoveryURL('https://uk.linkedin.com/jobs/view/role-1234567890?trk=a&refId=b','linkedin_job'),'https://www.linkedin.com/jobs/view/1234567890/');
 assert.equal(discoveryURL('https://www.linkedin.com/posts/person_hiring-activity-7399740184361336832-abcd','linkedin_post'),discoveryURL('https://www.linkedin.com/feed/update/urn:li:activity:7399740184361336832/','linkedin_post'));
 assert.equal(discoveryURL('https://example.com/jobs?id=1&utm_source=a&utm_medium=b'),'https://example.com/jobs?id=1');
 for(const url of ['http://example.com','https://person:secret@example.com','https://127.0.0.1/a','https://example.internal/a','https://example.com:1234/a','https://example.com/?token=secret','https://example.com/?email=private@example.com'])assert.throws(()=>discoveryURL(url));
 for(const url of ['https://linkedin.com.evil.example/posts/123','https://www.linkedin.com/company/example/','https://www.linkedin.com/jobs/search/?keywords=visa'])assert.throws(()=>discoveryURL(url,'linkedin_job'));
});

test('unknown source dates stay unknown; future, unsupported, overlong and contradictory evidence is rejected',()=>{
 assert.equal(validateDiscovery(input().content,now).posted_at,null);
 const mutations=[c=>c.posted_at=at(now-86400000),c=>c.observed_at=at(now+3600000),c=>c.deadline=at(now-3600000),c=>c.follow_up_at=at(now),c=>c.follow_up_at=at(now+31*86400000),c=>c.title='x'.repeat(181),c=>c.actor='forged',c=>c.method='independent_human',c=>c.state='published',c=>c.job_id=jobId,c=>c.state='rejected'];
 for(const mutate of mutations){const c=input().content;mutate(c);assert.throws(()=>validateDiscovery(c,now));}
 assert.throws(()=>validateDiscovery(linked({}, {observed_at:at(now-73*3600000)}).content,now));
});

test('realistic private lead saves create an audit, preserve revision history and never publish or call a service',async t=>{
 const env=database(t);env.AI={run:()=>{throw Error('No model call');}};env.SOURCE_WORKFLOW.create=()=>{throw Error('No publication');};
 const a=await saveDiscovery(env,input(),'owner',now);
 assert.equal(a.lead.revision,1);assert.equal(a.lead.content.state,'pending');assert.equal(a.lead.first_recorded_at,at(now));
 const b=await saveDiscovery(env,revised(a,{state:'held',reason:'The original employer is still unknown, so this lead is held pending clear identity evidence.'}),'owner',now+1);
 assert.equal(b.lead.revision,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_revisions').get().n,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,2);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
 assert.throws(()=>env.sql.exec("UPDATE discovery_revisions SET content='{}'"),/immutable/);assert.throws(()=>env.sql.exec('DELETE FROM discovery_leads'),/retained/);
});

test('duplicates, concurrent saves, request-key reuse and lost acknowledgements do not duplicate history',async t=>{
 const env=database(t),a=input();const result=await saveDiscovery(env,a,'owner',now);
 assert.equal((await saveDiscovery(env,a,'owner',now+1)).replayed,true);
 await assert.rejects(saveDiscovery(env,{...a,content:{...a.content,title:'Changed title'}},'owner',now),{status:409});
 await assert.rejects(saveDiscovery(env,input({source_url:'https://www.linkedin.com/jobs/view/1234567890/'}),'owner',now),e=>e.status===409&&e.existing_id===result.lead.id);
 const results=await Promise.allSettled([saveDiscovery(env,revised(result),'owner',now+1),saveDiscovery(env,revised(result,{reason:'A competing review which must not overwrite another owner session.'}),'owner',now+2)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_revisions').get().n,2);
 const env2=database(t),batch=env2.DB.batch;let once=true;env2.DB.batch=async s=>{const r=await batch(s);if(once){once=false;throw Error('Lost commit acknowledgement');}return r;};
 assert.equal((await saveDiscovery(env2,input(),'owner',now)).replayed,true);assert.equal(env2.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,1);
});

test('linking requires exact original destination, employer, quoted evidence and current approved source',async t=>{
 const mutations=[e=>e.sql.exec('UPDATE jobs SET active=0'),e=>e.sql.prepare('UPDATE jobs SET last_seen=?').run(at(now-74*3600000)),e=>e.sql.prepare('UPDATE jobs SET closes_at=?').run(at(now)),e=>e.sql.exec("UPDATE jobs SET board_id='unapproved'"),e=>e.sql.prepare('INSERT INTO agent_source_controls(source_id,paused,updated_at,actor) VALUES(?,1,?,?)').run(BOARDS[0].id,at(now),'owner')];
 for(const mutate of mutations){const env=database(t);job(env);mutate(env);await assert.rejects(saveDiscovery(env,linked(),'owner',now),{status:409});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_leads').get().n,0);}
 for(const content of [{original_url:'https://example.com/another-role'},{employer:'Different employer'},{quote:'This sentence does not occur in the original role.'}]){const env=database(t);job(env);await assert.rejects(saveDiscovery(env,linked({},content),'owner',now),{status:409});}
 const env=database(t);job(env);const result=await saveDiscovery(env,linked(),'owner',now);assert.equal(result.lead.job_proof.sponsorship,'offered');assert.equal(result.lead.job_proof.description,undefined);assert.equal((await discoverySummary(env,now)).current_linked_jobs,1);
});

test('an advert changing during a first link rolls back the entire record',async t=>{
 const env=database(t);job(env);const batch=env.DB.batch;env.DB.batch=async statements=>{env.sql.exec("UPDATE jobs SET description='Changed source wording' WHERE id='1234567890abcdef12345678'");return batch(statements);};
 await assert.rejects(saveDiscovery(env,linked(),'owner',now),{status:409});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_leads').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,0);
});

test('a later source change marks link evidence historical without rewriting or withdrawing public jobs',async t=>{
 const env=database(t);job(env);const a=await saveDiscovery(env,linked(),'owner',now);
 env.sql.exec("UPDATE jobs SET sponsorship='unavailable',description='Visa sponsorship is unavailable.',evidence='Visa sponsorship is unavailable.'");
 const summary=await discoverySummary(env,now+1);assert.equal(summary.changed_links,1);assert.equal(summary.current_linked_jobs,0);assert.ok(discoveryFindings(summary).some(f=>f.id==='discovery-changed-links'));
 const response=await discoveryAPI(new Request('https://sponsorintel.london/api/admin/discovery/'+a.lead.id),env,{user:{id:'owner'}}),detail=await response.json();assert.equal(detail.lead.linked_current,false);assert.equal(detail.history[0].job_proof.sponsorship,'offered');assert.equal(env.sql.prepare('SELECT active FROM jobs').get().active,1);
});

test('multiple leads for one published role count one opportunity; exact duplicates require an earlier retained nonduplicate',async t=>{
 const env=database(t);job(env);const a=await saveDiscovery(env,linked(),'owner',now);
 const b=await saveDiscovery(env,linked({source_kind:'employer',source_url:'https://example.com/careers/engineer'}),'owner',now+1);
 assert.equal((await discoverySummary(env,now+2)).current_linked_jobs,1);
 const c=await saveDiscovery(env,input({source_kind:'linkedin_post',source_url:'https://www.linkedin.com/feed/update/urn:li:activity:7399740184361336832/'},{state:'duplicate',follow_up_at:null,duplicate_of:a.lead.id}),'owner',now+2);assert.equal(c.lead.content.duplicate_of,a.lead.id);
 await assert.rejects(saveDiscovery(env,revised(a,{state:'duplicate',job_id:null,duplicate_of:c.lead.id}),'owner',now+3),{status:409});
 await assert.rejects(saveDiscovery(env,input({source_url:'https://www.linkedin.com/jobs/view/2234567890/'},{state:'duplicate',follow_up_at:null,duplicate_of:crypto.randomUUID()}),'owner',now+4),{status:409});
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM discovery_leads').get().n,3);assert.equal(b.lead.job_proof.sponsorship,'offered');
});

test('overdue reviews enter hourly findings, list filters and complete paginated history retain decisions',async t=>{
 const env=database(t);let a=await saveDiscovery(env,input(),'owner',now);
 for(let i=1;i<23;i++)a=await saveDiscovery(env,revised(a,{reason:'A retained fictional review decision with source evidence number '+i}),'owner',now+i);
 const summary=await discoverySummary(env,now+2*86400000);assert.equal(summary.overdue,1);assert.ok(discoveryFindings(summary).some(f=>f.id==='discovery-overdue'));
 const owner={user:{id:'owner'}},get=async path=>(await discoveryAPI(new Request('https://sponsorintel.london/api/admin/discovery'+path),env,owner)).json();
 const first=await get('/'+a.lead.id);assert.equal(first.history.length,20);assert.equal(first.next_before,4);const older=await get('/'+a.lead.id+'?before=4');assert.deepEqual(older.history.map(x=>x.revision),[3,2,1]);assert.equal(older.next_before,null);
 assert.equal((await get('?state=held')).total,0);assert.equal((await get('?q=Fictional')).total,1);assert.equal((await get('?q=notfound')).total,0);
});

test('owner routes deny anonymous access, foreign origins, forged actor fields and oversized requests',async t=>{
 const env=database(t),owner={user:{id:'owner'}},origin='https://sponsorintel.london';
 assert.equal((await adminAPI(new Request(origin+'/api/admin/discovery'),env)).status,403);
 const post=(body,source=origin)=>new Request(origin+'/api/admin/discovery',{method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await discoveryAPI(post(input(),'https://foreign.example'),env,owner)).status,403);
 assert.equal((await discoveryAPI(post({...input(),actor:'forged'}),env,owner)).status,400);
 assert.equal((await discoveryAPI(post({text:'x'.repeat(19000)}),env,owner)).status,400);
 const response=await discoveryAPI(post(input()),env,owner);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(env.sql.prepare('SELECT actor FROM discovery_revisions').get().actor,'owner');
});


test('a reviewer-recorded deadline also expires a linked lead without inventing an employer withdrawal',async t=>{
 const env=database(t);job(env);await saveDiscovery(env,linked({}, {deadline:at(now+60000),deadline_evidence:'Illustrative closing time explicitly stated in the fixture.'}),'owner',now);
 assert.equal((await discoverySummary(env,now)).current_linked_jobs,1);const later=await discoverySummary(env,now+60001);assert.equal(later.current_linked_jobs,0);assert.equal(later.changed_links,1);assert.equal(env.sql.prepare('SELECT active FROM jobs').get().active,1);
});
