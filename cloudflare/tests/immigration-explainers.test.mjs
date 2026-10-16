import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import fixtures from './fixtures/immigration-guidance-2026-10-08.json' with {type:'json'};
import {EXPLAINERS} from '../worker/immigration-explainers.js';
import {WATCHED_SOURCES,contentHash,explanationEvidenceValid,summaryState,reviewedChangeNote} from '../worker/immigration-content.js';
import CHANGE_NOTES from '../worker/immigration-change-notes.json' with {type:'json'};
import history from './fixtures/immigration-changes-2026-10-08.json' with {type:'json'};
import {immigrationAPI} from '../worker/immigration.js';
import {collectBusinessSnapshot,businessFindings,recordBusinessFindings} from '../worker/business-operations.js';
const now=Date.now(),stamp=new Date(now).toISOString();
const source=s=>({...s,content:s.body,kind:'guidance',last_success:stamp});
function seed(t){
 const env=database(t);
 const insert=env.sql.prepare('INSERT INTO immigration_sources(id,topic,title,url,kind,content_hash,content,source_updated_at,checked_at,last_success,withdrawn) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 for(const s of fixtures.sources)insert.run(s.id,WATCHED_SOURCES.find(w=>w.id===s.id).topic,s.title,s.url,'guidance',s.content_hash,s.body,s.updated,stamp,stamp,s.withdrawn?1:0);
 return env;
}
const fakeHTTP=async url=>new Response(null,{status:url.endsWith('/session')?403:200,headers:{'x-content-type-options':'nosniff','content-security-policy':"frame-ancestors 'none'"}});

function seedHistory(env){
 const insert=env.sql.prepare('INSERT INTO immigration_versions(id,source_id,content_hash,content,detected_at,source_updated_at,kind) VALUES(?,?,?,?,?,?,?)');
 for(const h of history.histories)for(const [i,v] of h.versions.entries())insert.run(`${h.source_id}-${i}`,h.source_id,v.content_hash,v.content,v.detected_at,v.source_updated_at,v.kind);
}
test('reviewed changes compare the actual retained versions and quote added wording',async t=>{
 const env=seed(t);seedHistory(env);
 for(const h of history.histories){
  const [before,after]=h.versions,note=CHANGE_NOTES[h.source_id];
  for(const v of h.versions)assert.equal(await contentHash({title:h.title,body:v.content,withdrawn:false}),v.content_hash);
  assert.equal(note.from_hash,before.content_hash);assert.equal(note.to_hash,after.content_hash);
  assert.equal(before.source_updated_at,after.source_updated_at);
  assert.ok(note.evidence.every(q=>after.content.includes(q)&&!before.content.includes(q)));
 }
 const data=await(await immigrationAPI(env)).json();
 assert.equal(data.events.length,2);assert.ok(data.events.every(e=>e.review&&!Object.hasOwn(e,'previous_hash')&&!Object.hasOwn(e,'content')));
 assert.ok(data.events.every(e=>!Object.hasOwn(e.review,'effective_date')));
 const before=env.sql.prepare('SELECT * FROM immigration_versions').all();
 await immigrationAPI(env);assert.deepEqual(env.sql.prepare('SELECT * FROM immigration_versions').all(),before);
});
test('change notes disappear for missing history, mismatched transitions, stale or changed guidance',async t=>{
 const env=seed(t);seedHistory(env);
 env.sql.prepare("DELETE FROM immigration_versions WHERE source_id='student' AND kind='baseline'").run();
 let data=await(await immigrationAPI(env)).json();
 assert.equal(data.events.find(e=>e.source_id==='student').review,null);
 assert.ok(data.events.find(e=>e.source_id==='student-course').review);
 for(const column of ['content_hash','last_success']){
  const old=env.sql.prepare(`SELECT ${column} value FROM immigration_sources WHERE id='student-course'`).get().value;
  env.sql.prepare(`UPDATE immigration_sources SET ${column}=? WHERE id='student-course'`).run(column==='content_hash'?'new':'2000-01-01T00:00:00Z');
  data=await(await immigrationAPI(env)).json();assert.equal(data.events.find(e=>e.source_id==='student-course').review,null);
  env.sql.prepare(`UPDATE immigration_sources SET ${column}=? WHERE id='student-course'`).run(old);
 }
 const s={...source(fixtures.sources.find(s=>s.id==='student')),status:'explained'},note=CHANGE_NOTES.student;
 const event={kind:'changed',content_hash:note.to_hash,previous_hash:note.from_hash};
 for(const e of [{...event,kind:'published'},{...event,previous_hash:'other'},{...event,content_hash:'other'}])assert.equal(reviewedChangeNote(e,s,note),null);
 assert.equal(reviewedChangeNote(event,s,{...note,evidence:['This quotation was not in the source.']}),null);
 assert.equal(reviewedChangeNote(event,s,{...note,from_hash:note.to_hash}),null);
});

test('all monitored guidance has dated, source-bound evidence for every point',async()=>{
 assert.deepEqual(Object.keys(EXPLAINERS).sort(),WATCHED_SOURCES.filter(s=>s.kind==='guidance').map(s=>s.id).sort());
 for(const s of fixtures.sources){
  assert.equal(await contentHash(s),s.content_hash,s.id);
  const summary=EXPLAINERS[s.id];assert.equal(summary.content_hash,s.content_hash,s.id);
  assert.equal(explanationEvidenceValid(source(s),summary),true,s.id);
  assert.equal(summaryState(source(s),summary,now).status,'explained',s.id);
  assert.equal(summary.prepared_at,'2026-10-08');
 }
 // This verifies literal provenance, not legal interpretation or semantic entailment.
});
test('missing or invented evidence hides an explanation even if its source hash was copied',()=>{
 const s=source(fixtures.sources[0]);
 for(const mutate of [b=>delete b.evidence,b=>b.evidence.pop(),b=>b.evidence[0]=[],b=>b.evidence[0]=['A source quotation that was never published.'],b=>b.evidence[0]=[' '],b=>b.points[0]='x']){
  const b=structuredClone(EXPLAINERS[s.id]);mutate(b);
  assert.equal(summaryState(s,b,now).status,'evidence_unavailable');assert.equal(summaryState(s,b,now).summary,null);
 }
});
test('the observed Student change is reviewed against current text, not its unchanged publication date',()=>{
 const s=source(fixtures.sources.find(s=>s.id==='student')),b=EXPLAINERS.student;
 assert.equal(s.updated,'2024-10-31T17:00:02+00:00');
 assert.match(s.body,/traineeship through the Erasmus\+ programme/);
 assert.equal(summaryState(s,b,now).status,'explained');
 assert.equal(summaryState({...s,content_hash:'d597add4320be4eebd482a9ab216c699c60f065fd10edf0ca50642d8e39e5307'},b,now).status,'source_changed');
 assert.equal(b.effective_date,null);
});
test('public responses include checked excerpts but never the complete stored source body',async t=>{
 const env=seed(t),r=await immigrationAPI(env),data=await r.json();
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(data.sources.length,19);
 assert.ok(data.sources.every(s=>s.status==='explained'&&s.summary.evidence&&!Object.hasOwn(s,'content')));
 env.sql.prepare("UPDATE immigration_sources SET content_hash='new',source_updated_at=source_updated_at WHERE id='student'").run();
 const changed=(await (await immigrationAPI(env)).json()).sources.find(s=>s.id==='student');
 assert.equal(changed.status,'source_changed');assert.equal(changed.summary,null);
 assert.equal(env.sql.prepare('SELECT COUNT(*) count FROM immigration_versions').get().count,0);
});
test('business monitoring opens and resolves explanation findings without changing sources or publishing text',async t=>{
 const env=seed(t);
 let snap=await collectBusinessSnapshot(env,fakeHTTP,now);
 assert.ok(snap.immigration.every(s=>s.explanation_status==='explained'&&!Object.hasOwn(s,'content')));
 assert.ok(!businessFindings(snap,now).some(f=>f.id==='immigration-explanations'));
 env.sql.prepare("UPDATE immigration_sources SET content_hash='changed' WHERE id='student'").run();
 snap=await collectBusinessSnapshot(env,fakeHTTP,now);
 assert.equal(businessFindings(snap,now).find(f=>f.id==='immigration-explanations').severity,'high');
 await recordBusinessFindings(env,'local',snap);
 assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='immigration-explanations'").get().state,'open');
 assert.equal(env.sql.prepare("SELECT content_hash FROM immigration_sources WHERE id='student'").get().content_hash,'changed');
 env.sql.prepare("UPDATE immigration_sources SET content_hash=? WHERE id='student'").run(EXPLAINERS.student.content_hash);
 await recordBusinessFindings(env,'local',await collectBusinessSnapshot(env,fakeHTTP,now));
 assert.equal(env.sql.prepare("SELECT state FROM business_issues WHERE id='immigration-explanations'").get().state,'resolved');
 assert.equal(env.sql.prepare('SELECT COUNT(*) count FROM agent_research_budget').get().count,0);
});
test('missing guidance and withdrawn evidence are distinct from healthy official publications',()=>{
 const base={checks:[],sources:[],immigration:[],register:{checked_at:stamp},metrics:[],held_batches:0,feedback_count:0};
 for(const [status,level] of [['awaiting_summary','normal'],['withdrawn','high'],['evidence_unavailable','high']]){
  const snap={...base,immigration:[{id:'guide',kind:'guidance',last_success:stamp,explanation_status:status},{id:'statement',kind:'publication',last_success:stamp,explanation_status:'official_publication'}]};
  const f=businessFindings(snap,now).find(f=>f.id==='immigration-explanations');assert.equal(f.severity,level);assert.doesNotMatch(f.detail,/statement/);
 }
});
