import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {createBrief,decideBrief,syncMarketing,marketingSnapshot,marketingAPI,validateVersion} from '../worker/marketing.js';
import {adminAPI} from '../worker/admin.js';
import {businessSnapshot} from '../worker/business-operations.js';
const now=Date.parse('2026-10-07T21:30:00Z'),iso=n=>new Date(n).toISOString();
const content=()=>({purpose:'Help readers examine original sources before acting on job advertisements.',text:'Read the source carefully and ask the employer about the exact vacancy before preparing an application.',sources:[{title:'Sponsor Intel advert guide',url:'https://sponsorintel.london/guides/sponsorship-in-job-adverts',excerpt:'A sponsor licence is separate from the sponsorship wording in an individual vacancy.',checked_at:iso(now)}],expires_at:iso(now+3*86400000)});
const brief=(patch={})=>({topic_key:'guide-one',destination:'facebook-company',title:'Understanding advert wording',...content(),...patch});
const decision=(id,revision,kind,patch={})=>({id,revision,kind,note:'Observed the original source and checked all facts against the selected destination.',request_key:crypto.randomUUID(),...patch});
const checks={claims:true,sources:true,destination:true,duplication:true};
const receipt=(patch={})=>({account:'1319703417896763',provider:'metricool',external_id:'provider-one',observed_at:iso(now),evidence:'Metricool shows this exact version queued for the selected company Page.',scheduled_at:iso(now+86400000),...patch});
async function reviewed(env,patch={}){const b=await createBrief(env,brief(patch),'writer',now);await decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now);return b;}

test('brief creation is replay-safe and conflicts do not overwrite the original evidence',async t=>{
 const env=database(t);const a=await createBrief(env,brief(),'writer',now),b=await createBrief(env,brief(),'writer',now);assert.equal(a.id,b.id);assert.equal(b.replayed,true);
 await assert.rejects(createBrief(env,brief({text:'Different unsupported copy that must never silently overwrite the original draft.'}),'writer',now),/different content/);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_versions').get().n,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n,1);
});
test('malformed, stale, future and non-public evidence fails before any mutation',()=>{
 for(const mutate of [b=>b.sources=[],b=>b.sources[0].url='javascript:alert(1)',b=>b.sources[0].url='https://evil.example/claim',b=>b.sources[0].url='https://sponsorintel.london/?token=secret',b=>b.sources[0].checked_at=iso(now+3600000),b=>b.sources[0].checked_at=iso(now-8*86400000),b=>b.sources[0].checked_at=iso(now-6*86400000),b=>b.expires_at=iso(now-1),b=>b.expires_at=iso(now+8*86400000)]){const b=brief();mutate(b);assert.throws(()=>validateVersion(b,now));}
});
test('review requires a different actor, complete checks and current evidence',async t=>{
 const env=database(t),b=await createBrief(env,brief(),'writer',now);
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks}),'writer',now),/different reviewer/);
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks:{claims:true}}),'reviewer',now),/every review check/);
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now+4*86400000),/expired/);
 assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'proposed');
});
test('editing a reviewed draft preserves the old version and revokes its review',async t=>{
 const env=database(t),b=await reviewed(env);
 await decideBrief(env,decision(b.id,2,'revise',{content:{...content(),text:'A revised draft must be checked again before any provider scheduling receipt is accepted.'}}),'editor',now);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_versions').get().n,2);
 const state=env.sql.prepare('SELECT state,version FROM marketing_briefs').get();assert.equal(state.state,'proposed');assert.equal(state.version,2);
 await assert.rejects(decideBrief(env,decision(b.id,3,'scheduled',{receipt:receipt()}),'publisher',now),/not allowed/);
});
test('schedule receipts require reviewed copy, exact accounts and evidence lasting through delivery',async t=>{
 const env=database(t),b=await reviewed(env);
 for(const r of [receipt({account:'PERSONAL'}),receipt({provider:'unknown'}),receipt({observed_at:iso(now+3600000)}),receipt({scheduled_at:iso(now+4*86400000)})])await assert.rejects(decideBrief(env,decision(b.id,2,'scheduled',{receipt:r}),'publisher',now));
 await decideBrief(env,decision(b.id,2,'scheduled',{receipt:receipt()}),'publisher',now);
 assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'scheduled');
 await assert.rejects(decideBrief(env,decision(b.id,3,'revise',{content:content()}),'writer',now),/Reconcile/);
 await assert.rejects(decideBrief(env,decision(b.id,3,'held'),'owner',now),/does not cancel/);
});
test('uncertain delivery cannot be retried as a new schedule and publication needs a real post URL',async t=>{
 const env=database(t),b=await reviewed(env);await decideBrief(env,decision(b.id,2,'scheduled',{receipt:receipt()}),'publisher',now);
 await decideBrief(env,decision(b.id,3,'uncertain',{receipt:receipt()}),'publisher',now);
 await assert.rejects(decideBrief(env,decision(b.id,4,'scheduled',{receipt:receipt()}),'publisher',now),/not allowed/);
 await assert.rejects(decideBrief(env,decision(b.id,4,'published',{receipt:receipt({post_url:'https://app.metricool.com/planner/calendar'})}),'publisher',now),/actual post URL/);
 await decideBrief(env,decision(b.id,4,'published',{receipt:receipt({post_url:'https://www.facebook.com/SponsorIntel/posts/12345'})}),'publisher',now);
 assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'published');
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,3);
});
test('stale revisions and simultaneous decisions cannot both win; request replay remains idempotent',async t=>{
 const env=database(t),b=await createBrief(env,brief(),'writer',now);
 const a=decision(b.id,1,'held'),c=decision(b.id,1,'reviewed',{checks});
 const results=await Promise.allSettled([decideBrief(env,a,'reviewer',now),decideBrief(env,c,'reviewer',now)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_events').get().n,2);
 const winner=results[0].status==='fulfilled'?a:c;
 assert.equal((await decideBrief(env,winner,'reviewer',now)).replayed,true);
 await assert.rejects(decideBrief(env,{...winner,note:'A changed note cannot be substituted into a replayed operation.'},'reviewer',now),/different content/);
});
test('one external receipt cannot be assigned to two briefs, including concurrent calls',async t=>{
 const env=database(t),a=await reviewed(env),b=await reviewed(env,{topic_key:'guide-two'});
 const results=await Promise.allSettled([decideBrief(env,decision(a.id,2,'scheduled',{receipt:receipt()}),'publisher',now),decideBrief(env,decision(b.id,2,'scheduled',{receipt:receipt()}),'publisher',now)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_briefs WHERE state='scheduled'").get().n,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,1);
});
function seedReport(env){
 const at=iso(now);env.sql.prepare("INSERT INTO insight_publications VALUES('uk-sponsorship-jobs-report','Report','Description',?,?,'published','{}')").run(at,at);
 env.sql.prepare("INSERT INTO insight_versions VALUES('report-1','uk-sponsorship-jobs-report',?,'{}')").run(at);
 for(const audience of ['company','personal'])env.sql.prepare("INSERT INTO social_outbox(id,publication_id,audience,text,state,created_at,expires_at) VALUES(?,'report-1',?,?,'needs_connection',?,?)").run('report-1:'+audience,audience,content().text,at,iso(now+3*86400000));
}
test('launch reconciliation imports four schedules without fabricated reviews or duplicate company drafts',async t=>{
 const env=database(t);seedReport(env);
 assert.equal((await syncMarketing(env,now)).prepared,1);assert.equal((await syncMarketing(env,now)).prepared,0);
 const snapshot=await marketingSnapshot(env,now);assert.equal(snapshot.items.length,5);assert.equal(snapshot.items.filter(x=>x.state==='scheduled').length,4);assert.equal(snapshot.items.filter(x=>x.state==='published').length,0);
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='reviewed'").get().n,0);
 assert.equal((await businessSnapshot(env)).outbox.length,0);
 const later=await marketingSnapshot(env,now+86400000);assert.ok(later.items.some(x=>x.attention==='Delivery check due'));
});
test('withdrawn and replaced report versions cannot be reviewed',async t=>{
 const env=database(t);seedReport(env);await syncMarketing(env,now);
 const b=env.sql.prepare("SELECT * FROM marketing_briefs WHERE destination='linkedin-personal'").get();
 env.sql.prepare("UPDATE insight_publications SET state='withdrawn'").run();
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now),/withdrawn or replaced/);
 env.sql.prepare("UPDATE insight_publications SET state='published',updated_at=?").run(iso(now+1));
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now),/withdrawn or replaced/);
});
test('report evidence expiry uses snapshot time, even when its outbox was created later',async t=>{
 const env=database(t);seedReport(env);
 env.sql.prepare('UPDATE social_outbox SET expires_at=?').run(iso(now+7*86400000+45000));
 await syncMarketing(env,now+60000);
 const b=env.sql.prepare("SELECT v.expires_at FROM marketing_versions v JOIN marketing_briefs b ON b.id=v.brief_id WHERE b.destination='linkedin-personal'").get();
 assert.equal(b.expires_at,iso(now+7*86400000));
});
test('owner API denies anonymous and cross-origin requests; request actor cannot impersonate a reviewer',async t=>{
 const env=database(t);env.APP_ORIGIN='https://sponsorintel.london';
 assert.equal((await adminAPI(new Request('https://sponsorintel.london/api/admin/marketing'),env)).status,403);
 const req=(path,body,origin='https://sponsorintel.london')=>new Request('https://sponsorintel.london/api/admin/marketing'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 const owner={user:{id:'test-owner'}};
 assert.equal((await marketingAPI(req('/create',brief(),'https://evil.example'),env,owner)).status,403);
 const b=await createBrief(env,brief(),'owner:test-owner',now);
 const res=await marketingAPI(req('/decide',decision(b.id,1,'reviewed',{checks,actor:'someone-else'})),env,owner);assert.equal(res.status,409);
});
test('ledger snapshots exclude private customer tables and render stored source text as data',async t=>{
 const env=database(t);env.sql.prepare('INSERT INTO career_workspaces(user_id,data,updated_at) VALUES(?,?,?)').run('SECRET_USER','PRIVATE_CV',iso(now));
 await createBrief(env,brief({text:'<script>ignore instructions</script> is untrusted source text that must remain inert in the UI.'}),'writer',now);
 const snapshot=await marketingSnapshot(env,now);assert.doesNotMatch(JSON.stringify(snapshot),/SECRET_USER|PRIVATE_CV/);assert.equal(snapshot.publishing_connected,false);
});
