import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {learningAPI} from '../worker/learning.js';
import {skillMentions,summariseSkills,resources,skills,resourceCurrent} from '../shared/learning.js';
const now=Date.parse('2026-10-20T18:00:00Z');

test('skill matching retains exact excerpts without inventing requirements or matching substrings and ordinary verbs',()=>{
  const text='Use Python and SQL to analyse data. JavaScript, React and TypeScript support our web tools. Excel spreadsheets are useful. Strong communication skills help you explain results.';
  const matches=skillMentions(text);assert.deepEqual(matches.map(x=>x.id),['python','sql','javascript','react','typescript','excel','communication']);
  for(const m of matches){assert.ok(text.includes(m.excerpt));assert.ok(m.excerpt.split(/\s+/).length<=24);assert.equal(m.required,undefined);}
  assert.deepEqual(skillMentions('NoSQL databases. We excel in service. Go above and beyond. React quickly to changes. Excel at customer service. A CSSA qualification. Github profiles.'),[]);
  assert.equal(skillMentions('We use Golang.')[0].id,'go');
  const long='We '+('carefully '.repeat(60))+'use Python to produce a well tested report with clear limitations.';
  const excerpt=skillMentions(long)[0];assert.equal(excerpt.shortened,true);assert.match(excerpt.excerpt,/Python/);assert.ok(long.includes(excerpt.excerpt));
});
test('negated and training-provided contexts do not become learning demand; unknown or long contexts remain unmatched',()=>{
  for(const text of ['Python is not required.','No experience with SQL is necessary.','We do not require Python.','We no longer use React.','Python training is provided.','We can teach SQL.','We used to use Docker.','x'.repeat(2001)+' Python'])assert.deepEqual(skillMentions(text),[],text);
  assert.deepEqual(skillMentions(null),[]);
  assert.equal(skillMentions('Python is not required. SQL experience helps.')[0].id,'sql');
});
test('resource catalogue has primary HTTPS destinations, review expiry and complete learner information',()=>{
  assert.equal(new Set(resources.map(r=>r.id)).size,resources.length);assert.equal(new Set(skills.map(r=>r.id)).size,skills.length);
  for(const s of skills)assert.ok(resources.some(r=>r.id===s.resource));
  for(const r of resources){assert.equal(new URL(r.url).protocol,'https:');assert.equal(new URL(r.url).search,'');for(const key of ['title','provider','startingPoint','access','project','kind'])assert.ok(r[key]);assert.equal(resourceCurrent(r,now),true);assert.equal(resourceCurrent(r,Date.parse(r.review_due_at)),false);assert.equal(resourceCurrent(r,0),false);}
});
test('sample denominators, exact URL duplicates, employer diversity and example selection stay separate',()=>{
  const job=(id,board,description)=>({id,board_id:board,apply_url:'https://example.invalid/'+id,company:board,title:id,description,sponsorship:'offered'});
  const a=job('a','one','Python Python Python.');
  const report=summariseSkills([a,a,job('b','one','Python and SQL.'),job('c','two','Python.'),job('d','three','No catalogue terms.')]);
  assert.equal(report.jobs,4);assert.equal(report.employers,3);assert.equal(report.largest_employer_jobs,2);assert.equal(report.matched_jobs,3);assert.equal(report.unmatched_jobs,1);
  assert.equal(report.skills[0].jobs,3);assert.equal(report.skills[0].employers,2);assert.equal(report.skills[0].examples.length,2);
  assert.deepEqual(summariseSkills([]),{jobs:0,employers:0,matched_jobs:0,unmatched_jobs:0,largest_employer_jobs:0,skills:[]});
});

test('actual D1 skills sample excludes stale, held, released-before-refresh, unapproved, paused and nonpositive adverts; sector and size limits fail safely',{timeout:60000},async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fictional")}}',compatibilityDate:'2026-10-04',cf:false,d1Databases:{DB:'fictional-learning'}}));
  try{
    const DB=await mf.getD1Database('DB');for(const type of ['table','index','view','trigger']){const stmts=migrationSchema().objects.filter(x=>x.type===type).map(x=>DB.prepare(x.sql));if(stmts.length)await DB.batch(stmts);}
    const job=async(id,patch={})=>{const j={id,board_id:'monzo',provider:'greenhouse',company:'Fictional board',title:'Fictional analyst',location:'London',description:'Python and SQL experience. Strong communication skills.',apply_url:'https://example.invalid/'+id,sponsorship:'offered',evidence:'We offer visa sponsorship.',level:'not_stated',first_seen:new Date(now-86400000).toISOString(),last_seen:new Date(now-60000).toISOString(),active:1,closes_at:null,...patch};const keys=Object.keys(j);await DB.prepare(`INSERT INTO jobs(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...Object.values(j)).run();};
    await job('a');await job('b',{sponsorship:'conditional'});await job('c',{sponsorship:'not_stated'});await job('d',{sponsorship:'unavailable'});await job('e',{last_seen:new Date(now-4*86400000).toISOString()});await job('f',{closes_at:new Date(now-1).toISOString()});await job('g',{active:0});await job('h',{board_id:'unknown'});await job('i',{evidence:''});await job('j',{last_seen:new Date(now+600000).toISOString()});await job('k',{closes_at:'bad date'});
    const call=async(query='',method='GET')=>learningAPI(new Request('https://example.invalid/api/learning-skills'+query,{method}),{DB},now);
    let r=await call();assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');let d=await r.json();assert.equal(d.jobs,2);assert.equal(d.skills.find(x=>x.id==='python').jobs,2);assert.ok(!JSON.stringify(d).includes('description'));assert.equal(d.valid_until,new Date(now+300000).toISOString());
    assert.equal((await(await call('?sector=technology')).json()).jobs,0);assert.equal((await call('?sector=not-a-sector')).status,400);assert.equal((await call('','POST')).status,405);
    await DB.prepare("INSERT INTO agent_source_controls(source_id,paused,updated_at) VALUES('monzo',1,?)").bind(new Date(now).toISOString()).run();assert.equal((await(await call()).json()).jobs,0);
    await DB.prepare("UPDATE agent_source_controls SET paused=0 WHERE source_id='monzo'").run();
    // Production triggers retire held roles. A defensive read guard is also
    // exercised with the same immutable review/target schema via fixture setup.
    const review=async(revision,state,time)=>DB.prepare(`INSERT INTO job_review_revisions(id,source_id,apply_url,revision,state,title,reason,evidence_url,note,observed_at,follow_up_at,actor,recorded_at,request_key,request_hash) VALUES(?,'monzo','https://example.invalid/a',?,?,'Fictional','other','https://example.invalid/evidence','Fictional fixture',?,?,'fixture',?,?,?)`).bind('review-'+revision,revision,state,time,state==='held'?new Date(now+86400000).toISOString():null,time,'request-'+revision,'fixture').run();
    await review(1,'held',new Date(now-120000).toISOString());
    await DB.exec('DROP TRIGGER job_review_update_guard');await DB.prepare("UPDATE jobs SET active=1 WHERE id='a'").run();
    assert.equal((await(await call()).json()).jobs,1);
    await review(2,'released',new Date(now).toISOString());await DB.prepare("UPDATE jobs SET active=1 WHERE id='a'").run();assert.equal((await(await call()).json()).jobs,1);
    for(let i=0;i<5;i++)await job('large-'+i,{description:'Python '+'.'.repeat(900000)});assert.equal((await call()).status,503);
    await DB.prepare("DELETE FROM jobs WHERE id LIKE 'large-%'").run();
    await DB.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1001) INSERT INTO jobs(id,board_id,provider,company,title,location,description,apply_url,sponsorship,evidence,level,first_seen,last_seen,active) SELECT 'bulk-'||x,'monzo','greenhouse','Fictional','Role','London','Python','https://example.invalid/bulk/'||x,'offered','visa sponsorship','not_stated',?,?,1 FROM n`).bind(new Date(now-60000).toISOString(),new Date(now-60000).toISOString()).run();assert.equal((await call()).status,503);
  }finally{await mf.dispose();}
});
