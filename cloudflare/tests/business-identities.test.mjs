import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDatabase} from './helpers/source-d1.mjs';
import {saveBusinessIdentity,publicBusinessIdentities,businessIdentitySummary,businessIdentitiesAPI,businessQuerySpec} from '../worker/business-identities.js';
import {identityRegisterFresh} from '../shared/business-identities.js';
const now=Date.now(),iso=n=>new Date(n).toISOString(),sponsor='a'.repeat(24);
const input=(patch={})=>({identity_id:crypto.randomUUID(),revision:0,sponsor_id:sponsor,sponsor_name:'Fictional Legal Ltd',business_name:'Fictional Harbour',relationship:'trading_name',website:'https://fictional.example/',careers_url:'',activity:'Fictional software services',locations:'',official_identifier:'',evidence_url:'https://fictional.example/legal',evidence_summary:'Fictional primary source identifies this trading name and its legal operator.',rights_basis:'Fictional fixture permission only; no external source reused.',observed_at:iso(now),review_due_at:iso(now+86400000),state:'approved',review_method:'agent_assisted',note:'Private fictional review reason must never be returned publicly.',request_key:crypto.randomUUID(),...patch});
function setup(t){const env=sourceDatabase(t);const meta={snapshot:'fixture',source_date:iso(now).slice(0,10),checked_at:iso(now)};env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register',JSON.stringify(meta,null,2));env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run(sponsor,'fixture','Fictional Legal Ltd','Cardiff','',JSON.stringify(['Worker (A rating)']),JSON.stringify(['Skilled Worker']),1);return {...env,meta};}
function aliases(env,q,at=iso(now)){const s=businessQuerySpec(new URLSearchParams({q}),at);return env.sql.prepare('SELECT id FROM sponsors WHERE '+s.where).all('fixture',...s.values);}
test('reviewed alias is searchable, typed and public without private review or actor data',async t=>{
 const env=setup(t),f=input();const saved=await saveBusinessIdentity(env,f,'private-owner',now);assert.equal(saved.review.revision,1);assert.equal(saved.review.actor,undefined);
 const data=await publicBusinessIdentities(env,sponsor,now);assert.equal(data.items.length,1);assert.equal(data.items[0].relationship,'trading_name');assert.equal(data.items[0].review_method,'agent_assisted');assert.doesNotMatch(JSON.stringify(data),/Private fictional|private-owner|rights_basis|request_key|request_hash|business_key/);assert.equal(aliases(env,'Harbour').length,1);assert.equal(aliases(env,'Harbour',null).length,0);assert.equal(aliases(env,'Legal').length,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM employer_boards').get().n,0);
});
test('hold and withdrawal remove aliases and public profiles without losing history; replay cannot undo later decisions',async t=>{
 const env=setup(t),f=input();await saveBusinessIdentity(env,f,'owner',now);
 for(const [revision,state] of [[1,'held'],[2,'withdrawn']]){await saveBusinessIdentity(env,{...f,revision,state,request_key:crypto.randomUUID()},'owner',now+revision);assert.equal((await publicBusinessIdentities(env,sponsor,now+revision)).items.length,0);assert.equal(aliases(env,'Harbour').length,0);}
 const replay=await saveBusinessIdentity(env,f,'owner',now+10000);assert.equal(replay.replayed,true);assert.equal(replay.saved_revision,1);assert.equal(replay.review.state,'withdrawn');assert.equal(replay.review.revision,3);
 await assert.rejects(saveBusinessIdentity(env,{...f,business_name:'Changed same request'},'owner',now),{status:409});assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM admin_audit').get().n,3);
 assert.throws(()=>env.sql.exec("UPDATE business_identity_revisions SET state='approved'"),/append only/);assert.throws(()=>env.sql.exec('DELETE FROM business_identity_revisions'),/append only/);
});
test('expired evidence and missing or renamed register entries fail closed',async t=>{
 const env=setup(t);await saveBusinessIdentity(env,input(),'owner',now);
 assert.equal((await publicBusinessIdentities(env,sponsor,now+86400001)).items.length,0);assert.equal(aliases(env,'Harbour',iso(now+86400001)).length,0);assert.equal((await businessIdentitySummary(env,now+86400001)).overdue,1);
 env.sql.prepare('UPDATE sponsors SET name=?').run('Another legal entity');assert.equal((await publicBusinessIdentities(env,sponsor,now)).items.length,0);assert.equal(aliases(env,'Harbour').length,0);env.sql.exec('DELETE FROM sponsors');assert.equal((await publicBusinessIdentities(env,sponsor,now)).items.length,0);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM business_identity_revisions').get().n,1);
});
test('stale, erroneous or future register evidence prevents approval and public current claims',async t=>{
 const env=setup(t),f=input();await saveBusinessIdentity(env,f,'owner',now);
 for(const patch of [{checked_at:iso(now-3*86400000)},{checked_at:iso(now+3600000)},{source_date:iso(now-8*86400000).slice(0,10)},{refresh_error:'fixture error'}]){const meta={...env.meta,...patch};assert.equal(identityRegisterFresh(meta,now),false);env.sql.prepare("UPDATE metadata SET value=? WHERE key='register'").run(JSON.stringify(meta));assert.equal((await publicBusinessIdentities(env,sponsor,now)).status,'register_unavailable');await assert.rejects(saveBusinessIdentity(env,input({business_name:'Other Fictional'}),'owner',now),/fresh register/);}
});
test('duplicate business for the same sponsor conflicts atomically, but multiple businesses and entities are supported',async t=>{
 const env=setup(t),f=input();const results=await Promise.allSettled([saveBusinessIdentity(env,f,'owner',now),saveBusinessIdentity(env,input({business_name:' fictional   harbour '}),'owner',now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await saveBusinessIdentity(env,input({business_name:'Fictional Other Brand'}),'owner',now);const other='b'.repeat(24);env.sql.prepare('INSERT INTO sponsors SELECT ?,snapshot,?,city,county,ratings,routes,skilled FROM sponsors WHERE id=?').run(other,'Fictional Other Legal Ltd',sponsor);await saveBusinessIdentity(env,input({sponsor_id:other,sponsor_name:'Fictional Other Legal Ltd',relationship:'group_relationship'}),'owner',now);assert.equal(aliases(env,'Harbour').length,2);assert.equal((await publicBusinessIdentities(env,sponsor,now)).items.length,2);
});
test('stale writes, conflicting request reuse and legal-identity reassignment are rejected',async t=>{
 const env=setup(t),f=input();await saveBusinessIdentity(env,f,'owner',now);
 await assert.rejects(saveBusinessIdentity(env,{...f,request_key:crypto.randomUUID()},'owner',now),{status:409});await assert.rejects(saveBusinessIdentity(env,{...f,revision:1,sponsor_id:'b'.repeat(24),request_key:crypto.randomUUID()},'owner',now),/cannot be changed/);
 const two=await Promise.allSettled(['held','withdrawn'].map(state=>saveBusinessIdentity(env,{...f,revision:1,state,request_key:crypto.randomUUID()},'owner',now)));assert.equal(two.filter(x=>x.status==='fulfilled').length,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM business_identity_revisions').get().n,2);
});
test('fresh reapproval needs a new observation after the prior decision and bounds dates and evidence URLs',async t=>{
 const env=setup(t),f=input({state:'held'});await saveBusinessIdentity(env,f,'owner',now+1000);
 await assert.rejects(saveBusinessIdentity(env,{...f,revision:1,state:'approved',request_key:crypto.randomUUID()},'owner',now+2000),/newly observed/);
 for(const patch of [{observed_at:iso(now-4*86400000)},{review_due_at:iso(now+31*86400000)},{review_due_at:iso(now-1)},{website:'https://user:secret@public.example/'},{evidence_url:'https://public.example/?session=secret'},{relationship:'same_address'},{review_method:'independent_human'},{sponsor_name:'Close enough Ltd'},{actor:'spoof'}])await assert.rejects(saveBusinessIdentity(env,input(patch),'owner',now));
 await saveBusinessIdentity(env,{...f,revision:1,state:'approved',observed_at:iso(now+2000),request_key:crypto.randomUUID()},'owner',now+2000);assert.equal((await publicBusinessIdentities(env,sponsor,now+2000)).items.length,1);
});
test('audit failure rolls back the identity and name-search escapes wildcard characters',async t=>{
 const env=setup(t);env.sql.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'fictional failure'); END");await assert.rejects(saveBusinessIdentity(env,input(),'owner',now));assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM business_identity_revisions').get().n,0);env.sql.exec('DROP TRIGGER fixture_failure');await saveBusinessIdentity(env,input({business_name:'Fictional 50%_services'}),'owner',now);assert.equal(aliases(env,'%_').length,1);assert.equal(aliases(env,'50_services').length,0);
});
test('owner history has bounded pagination and same-origin writes; private reasons stay owner only',async t=>{
 const env=setup(t),f=input();await saveBusinessIdentity(env,f,'owner',now);
 const owner={user:{id:'owner'}},url='https://sponsorintel.london/api/admin/business-identities';const list=await(await businessIdentitiesAPI(new Request(url),env,owner)).json();assert.equal(list.summary.total,1);assert.equal(list.items[0].note,f.note);assert.equal(list.items[0].actor,undefined);
 const history=await(await businessIdentitiesAPI(new Request(url+'?id='+f.identity_id),env,owner)).json();assert.equal(history.history.length,1);assert.equal(history.history[0].request_key,undefined);assert.equal((await businessIdentitiesAPI(new Request(url+'?page=21'),env,owner)).status,400);
 assert.equal((await businessIdentitiesAPI(new Request(url,{method:'POST',headers:{Origin:'https://untrusted.example'},body:JSON.stringify(f)}),env,owner)).status,403);
});

test('withdrawing stale evidence needs no invented recent observation or future follow-up',async t=>{
 const env=setup(t),f=input();await saveBusinessIdentity(env,f,'owner',now);
 const withdrawal={...f,revision:1,state:'withdrawn',note:'The old fictional relationship is withdrawn without pretending to have reread its source.',request_key:crypto.randomUUID()};
 const saved=await saveBusinessIdentity(env,withdrawal,'owner',now+10*86400000);assert.equal(saved.review.state,'withdrawn');assert.equal(saved.review.observed_at,f.observed_at);assert.equal((await businessIdentitySummary(env,now+10*86400000)).overdue,0);
 await assert.rejects(saveBusinessIdentity(env,{...f,revision:2,request_key:crypto.randomUUID()},'owner',now+10*86400000),/last 72 hours/);
});
