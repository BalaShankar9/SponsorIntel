import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {migrationSchema} from '../scripts/recovery-status.mjs';
import {saveDiscovery,discoverySummary} from '../worker/discovery.js';
import {saveJobReview} from '../worker/job-reviews.js';
import {parseTeachingVacancy} from '../worker/teaching-vacancies.js';
import {normaliseBoardJobs} from '../worker/jobs.js';
import {TEACHING_ORIGIN,TEACHING_UNAVAILABLE} from '../worker/teaching-source.js';
import {sourceDiagnostic} from '../worker/source-errors.js';
import {school,vacancy,advert,provider,seedSchool} from './fixtures/teaching-board.mjs';
// Original public DfE Job role DOM, observed 11 October 2026. OGL v3.
// The surrounding identity and every test role are fictional.
const roleRow=readFileSync(new URL('./fixtures/teaching-role-row.html',import.meta.url),'utf8');
const withRow=(html,row=roleRow)=>html.replace('<dl>','<dl>'+row);
const now=Date.now(),row=vacancy(1),parse=html=>parseTeachingVacancy(html,school,row,now);

test('changing only the official ECT navigation count keeps the role evidence stable and retains suitability',()=>{
 const original=advert(row,now,{body:'Salary £38,812. Deadline instructions: use the school form. Degree and QTS required. CVs will not be accepted for this application.'});
 const before=parse(withRow(original,roleRow.replace('809','812'))),after=parse(withRow(original));
 assert.deepEqual(before,after);
 assert.match(after.descriptionPlain,/Teacher or lecturer/);assert.match(after.descriptionPlain,/Suitable for early career teachers/);
 assert.match(after.descriptionPlain,/Salary £38,812/);assert.match(after.descriptionPlain,/Degree and QTS required/);assert.match(after.descriptionPlain,/CVs will not be accepted/);
 assert.doesNotMatch(after.descriptionPlain,/View all|809/);
 for(const count of ['0','1','999','1,234','123456'])assert.deepEqual(parse(withRow(original,roleRow.replace('809',count))),after);
 assert.deepEqual(parse(withRow(original,roleRow.replace('href="/ect-suitable-jobs"',`href="${TEACHING_ORIGIN}/ect-suitable-jobs"`))),after);
});

test('unfamiliar links, contexts and substantive additions remain verbatim and detectable',()=>{
 const raw=advert(row,now),expected=parse(withRow(raw));
 const changedRows=[
  roleRow.replace('href="/ect-suitable-jobs"','href="https://other.example/ect-suitable-jobs"'),
  roleRow.replace('/ect-suitable-jobs','/ect-suitable-jobs?filter=restricted'),
  roleRow.replace('/ect-suitable-jobs','/ect-suitable-jobs#conditions'),
  roleRow.replace('/ect-suitable-jobs','/other-jobs'),
  roleRow.replace('Job role','Application instructions'),
  roleRow.replace('govuk-summary-list__row','unfamiliar-layout'),
  roleRow.replace('</a>',' — applicants need QTS</a>'),
  roleRow.replace('Suitable for early career teachers','Not suitable for early career teachers'),
  roleRow.replace('View all ','Read all '),
 ];
 for(const changed of changedRows){const actual=parse(withRow(raw,changed));assert.match(actual.descriptionPlain,/809/);assert.notDeepEqual(actual.descriptionPlain,expected.descriptionPlain);}
 const duplicateText=advert(row,now,{body:'The role has 809 pupils and closes in 8 days. View all Suitable for early career teachers (809) jobs. Do not replace this sentence.'});
 assert.match(parse(withRow(duplicateText)).descriptionPlain,/809 pupils/);assert.match(parse(withRow(duplicateText)).descriptionPlain,/View all Suitable for early career teachers \(809\) jobs/);
 const outside=raw.replace('</section>',roleRow+'</section>');assert.match(parse(outside).descriptionPlain,/Suitable for early career teachers/);
});

test('visa conflicts, application restrictions and closure changes cannot disappear inside a navigation link',async()=>{
 const body='Applicants must use the application form; CVs are not accepted. Closing evidence is attached. QTS and two years of experience are required.';
 const valid=parse(withRow(advert(row,now,{body})));assert.match(valid.descriptionPlain,/CVs are not accepted/);assert.match(valid.descriptionPlain,/two years/);
 const conflict=parse(withRow(advert(row,now),roleRow.replace('</a>',' We cannot provide visa sponsorship for this role.</a>')));
 await assert.rejects(normaliseBoardJobs([conflict],school,now),/conflicting/);
 assert.throws(()=>parse(withRow(advert(row,now),roleRow.replace('</a>',' This vacancy has closed.</a>'))),e=>sourceDiagnostic(e).code==='posting_changed');
 assert.throws(()=>parse(withRow(advert(row,now,{quote:TEACHING_UNAVAILABLE}))),e=>sourceDiagnostic(e).code==='posting_changed');
});

test('actual repeated SourceWorkflow ignores only count noise; holds, discovery history and genuine changes remain effective',{timeout:60000},async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const bundle=await build({stdin:{contents:`import {dispatchSources} from './worker/agent-operations.js'; export {SourceWorkflow} from './worker/source-workflow.js'; export default {async fetch(r,e){const u=new URL(r.url),id=u.searchParams.get('id');if(u.pathname==='/start')return Response.json(await dispatchSources(e,{id,sourceId:'${school.id}'}));return Response.json(await(await e.SOURCE_WORKFLOW.get(id)).status());}};`,resolveDir:root},bundle:true,format:'esm',write:false,platform:'browser',conditions:['workerd','worker','browser'],external:['cloudflare:*','node:*'],target:'es2022'});
 let count='812',addition='',deadlineShift=0,refusal=false;
 const fixture=provider([vacancy(1),vacancy(2)],{now,alter:(html,url)=>{
  if(!url.includes('/jobs/fictional-teacher-'))return refusal?html.replaceAll(row.visa,TEACHING_UNAVAILABLE):html;
  let result=withRow(html,roleRow.replace('809',count)).replace('</section>',`<p>${addition}</p></section>`);
  if(deadlineShift)result=result.replace(new Date(now+5*86400000).toISOString(),new Date(now+(5+deadlineShift)*86400000).toISOString());
  if(refusal)result=result.replaceAll(row.visa,TEACHING_UNAVAILABLE);
  return result;
 }});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'teaching-navigation-isolated'},workflows:{SOURCE_WORKFLOW:{name:'teaching-navigation-isolated',className:'SourceWorkflow'}},outboundService:r=>fixture.fetcher(r.url)}));
 try{
  const DB=await mf.getD1Database('DB'),schema=migrationSchema();for(const type of ['table','index','view','trigger']){const statements=schema.objects.filter(x=>x.type===type).map(x=>DB.prepare(x.sql));if(statements.length)await DB.batch(statements);}await seedSchool(DB,now);
  await saveJobReview({DB},{source_id:school.id,apply_url:vacancy(2).url,revision:0,state:'held',title:vacancy(2).title,reason:'deadline_conflict',evidence_url:'https://employer.example/careers',note:'Fictional original source has a deadline conflict; preserve this hold.',observed_at:new Date(now).toISOString(),follow_up_at:new Date(now+86400000).toISOString(),request_key:crypto.randomUUID()},'fixture-owner');
  let pass=0;async function collect(){const id='navigation-runtime-'+(++pass);assert.equal((await mf.dispatchFetch('http://localhost/start?id='+id)).status,200);let result;for(let i=0;i<150;i++){result=await(await mf.dispatchFetch('http://localhost/status?id='+id)).json();if(['complete','errored','terminated'].includes(result.status))break;await new Promise(r=>setTimeout(r,200));}assert.equal(result?.status,'complete',JSON.stringify(result));assert.equal((await DB.prepare('SELECT state FROM agent_tasks WHERE run_id=?').bind(id).first()).state,'published');assert.equal((await DB.prepare('SELECT COUNT(*) n FROM jobs WHERE active=1').first()).n,1);assert.equal((await DB.prepare('SELECT active FROM jobs WHERE apply_url=?').bind(vacancy(2).url).first()).active,0);return DB.prepare('SELECT * FROM jobs WHERE apply_url=?').bind(row.url).first();}
  const first=await collect();
  let review=await saveDiscovery({DB},{revision:0,request_key:crypto.randomUUID(),source_kind:'teaching_vacancy',source_url:row.url,content:{title:row.title,employer:school.company,location:'Cardiff',observed_at:new Date(now).toISOString(),posted_at:null,posted_evidence:'',deadline:null,deadline_evidence:'',original_url:row.url,identity_url:school.careers,identity_note:'Fictional school identity and reviewed trust relationship.',quote:row.visa,state:'linked',reason:'Fictional exact original advert and current approved school role match.',follow_up_at:null,job_id:first.id,duplicate_of:null,method:'agent_assisted'}},'fixture-owner',now);
  const originalProof=await DB.prepare('SELECT job_proof FROM discovery_revisions WHERE lead_id=? AND revision=1').bind(review.lead.id).first();
  count='809';const repeated=await collect();assert.equal(first.description,repeated.description);assert.equal((await discoverySummary({DB},Date.now())).changed_links,0);assert.equal((await discoverySummary({DB},Date.now())).current_linked_jobs,1);
  async function relink(){review=await saveDiscovery({DB},{id:review.lead.id,revision:review.lead.revision,request_key:crypto.randomUUID(),source_kind:'teaching_vacancy',source_url:row.url,content:{...review.lead.content,observed_at:new Date().toISOString()}},'fixture-owner');}
  addition='QTS and two years of teaching experience are now required. CVs will not be accepted; use the school application form.';await collect();assert.equal((await discoverySummary({DB})).changed_links,1);await relink();
  deadlineShift=1;await collect();assert.equal((await discoverySummary({DB})).changed_links,1);await relink();
  refusal=true;const last=await collect();assert.equal(last.sponsorship,'unavailable');assert.equal((await discoverySummary({DB})).changed_links,1);
  assert.deepEqual(await DB.prepare('SELECT job_proof FROM discovery_revisions WHERE lead_id=? AND revision=1').bind(review.lead.id).first(),originalProof);
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM discovery_revisions').first()).n,3);assert.equal((await DB.prepare('SELECT requests FROM agent_daily_budget').first()).requests,5*24);assert.equal(fixture.calls.length,5*4);
 }finally{await mf.dispose();}
});
