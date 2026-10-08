import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {BOARDS} from '../worker/job-sources.js';
import {approvedJobLink,inspectJobPage,planJobLinkChecks,checkJobLink,jobLinkHealth,jobLinkFindings} from '../worker/job-link-checks.js';
const now=Date.now(),stamp=new Date(now).toISOString(),day=stamp.slice(0,10),clock=()=>now;
const board=id=>BOARDS.find(b=>b.id===id);
function seed(env,id='job',source='monzo',extra={}){
 const b=board(source)||{company:'Fictional firm',provider:'greenhouse',board:source};
 const row={id,board_id:source,company:b.company,title:'Fictional Engineer',location:'London',description:'Fictional fixture only',apply_url:`https://job-boards.greenhouse.io/${b.board}/jobs/123`,provider:b.provider,sponsorship:'not_stated',level:'experienced',first_seen:stamp,last_seen:stamp,active:1,...extra};
 env.sql.prepare(`INSERT INTO jobs(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));return row;
}
async function plan(env,id='run',time=now){env.sql.prepare("UPDATE business_runs SET state='completed' WHERE state IN ('queued','running')").run();env.sql.prepare("INSERT INTO business_runs(id,state,created_at) VALUES(?,'queued',?)").run(id,new Date(time).toISOString());return planJobLinkChecks(env,id,time);}
const page=(html='<title>Fictional Engineer - careers</title>')=>new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
const checkRow=env=>env.sql.prepare('SELECT * FROM job_link_checks ORDER BY created_at DESC').get();

test('fixed destinations preserve exact employer and job through reviewed redirects',()=>{
 const original='https://boards.greenhouse.io/monzo/jobs/123';
 assert.equal(approvedJobLink(board('monzo'),'https://job-boards.greenhouse.io/monzo/jobs/123?tracking=drop#fragment',original),'https://job-boards.greenhouse.io/monzo/jobs/123');
 for(const url of ['http://boards.greenhouse.io/monzo/jobs/123','https://boards.greenhouse.io.evil.test/monzo/jobs/123','https://127.0.0.1/monzo/jobs/123','https://user:pass@boards.greenhouse.io/monzo/jobs/123','https://boards.greenhouse.io:8443/monzo/jobs/123','https://boards.greenhouse.io/other/jobs/123','https://boards.greenhouse.io/monzo/jobs/124','https://boards.greenhouse.io/monzo/jobs/%31%32%33'])assert.equal(approvedJobLink(board('monzo'),url,original),null,url);
 const stripe='https://stripe.com/jobs/search?gh_jid=7289456';
 assert.ok(approvedJobLink(board('stripe'),'https://stripe.com/careers/listing/example-role/7289456?gh_jid=7289456',stripe));
 assert.equal(approvedJobLink(board('stripe'),'https://stripe.com/careers/listing/example-role/7289457?gh_jid=7289456',stripe),null);
 const bath='https://www.bath.ac.uk/jobs/RSS/Click.aspx?ref=KD13917R';
 assert.ok(approvedJobLink(board('university-bath'),'https://www.bath.ac.uk/jobs/Vacancy.aspx?ref=KD13917R',bath));
 assert.equal(approvedJobLink(board('university-bath'),'https://www.bath.ac.uk/jobs/Vacancy.aspx?ref=OTHER',bath),null);
});
test('heading evidence decodes entities and university references but excludes scripts and unrelated text',()=>{
 const job={title:'Research & Development (AB-12)',provider:'university-rss',url:'https://example.invalid/?ref=AB-12'};
 assert.equal(inspectJobPage('<title>AB-12 Research &amp; Development - careers</title>',job).title_match,true);
 assert.equal(inspectJobPage('<script><h1>Research & Development</h1></script><p>Research & Development</p>',job).title_match,false);
 assert.equal(inspectJobPage('<title>Research &amp; Development</title><script>This job has closed</script>',job).closure_signal,null);
 assert.equal(inspectJobPage('<h1>Research &amp; Development</h1><p>This job has now closed</p>',job).closure_signal,'This job has now closed');
});
test('rotation samples two approved current employers, then remaining sources; day and workflow replays reuse records',async t=>{
 const env=database(t);seed(env,'a');seed(env,'b','cloudflare');seed(env,'c','figma');seed(env,'old','gocardless',{last_seen:new Date(now-73*3600000).toISOString()});seed(env,'closed','deliveroo',{closes_at:stamp});seed(env,'unapproved','fake');
 const first=await plan(env);assert.equal(first.length,2);assert.deepEqual(await planJobLinkChecks(env,'run',now),first.sort());
 assert.equal((await plan(env,'next')).length,1);assert.equal((await plan(env,'third')).length,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_link_checks').get().n,3);
});
test('a new day rotates to the least previously sampled role and paused sources are excluded',async t=>{
 const env=database(t);seed(env,'a');seed(env,'b');const first=await plan(env);assert.equal(checkRow(env).job_id,'a');
 const nextDay=now+86400000;await plan(env,'tomorrow',nextDay);assert.equal(checkRow(env).job_id,'b');
 env.sql.prepare("INSERT INTO agent_source_controls(source_id,paused,updated_at) VALUES('monzo',1,?)").run(stamp);
 assert.equal((await plan(env,'later',nextDay+86400000)).length,0);assert.equal((await jobLinkHealth(env)).eligible_sources,0);
});
test('matched pages retain evidence without changing jobs, and terminal replay performs no I/O',async t=>{
 const env=database(t);seed(env);const [id]=await plan(env);const before=env.sql.prepare('SELECT * FROM jobs').get();let calls=0;
 const fetcher=async(url,opts)=>{calls++;assert.equal(opts.redirect,'manual');assert.ok(opts.signal);return page();};
 assert.equal((await checkJobLink(env,id,fetcher,clock)).state,'checked');assert.equal((await checkJobLink(env,id,fetcher,clock)).replay,true);assert.equal(calls,1);
 assert.deepEqual(env.sql.prepare('SELECT * FROM jobs').get(),before);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,4);
 const row=checkRow(env),proof=JSON.parse(row.evidence);assert.equal(proof.body_sha256.length,64);assert.equal(proof.title_match,true);assert.ok(!('body' in proof));assert.equal(row.finished_at,stamp);
 assert.equal((await jobLinkHealth(env,now)).matched,1);
});
test('a concurrent attempt cannot fetch twice, overwrite a claim, or double-reserve the request budget',async t=>{
 const env=database(t);seed(env);const [id]=await plan(env);let calls=0,release;const blocked=new Promise(r=>release=r);
 const fetcher=async()=>{calls++;await blocked;return page();};
 const first=checkJobLink(env,id,fetcher,clock);while(!calls)await new Promise(r=>setTimeout(r,1));
 assert.equal((await checkJobLink(env,id,fetcher,clock)).reason,'prior_attempt_unresolved');release();assert.equal((await first).state,'checked');assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,4);
});
test('both request ceilings hold before fetch and exhausted records finish without resetting allowances',async t=>{
 for(const [global,links] of [[497,0],[0,157],[496,156]]){
  const env=database(t);seed(env);const [id]=await plan(env);env.sql.prepare('INSERT INTO agent_daily_budget(day,requests) VALUES(?,?)').run(day,global);env.sql.prepare('INSERT INTO job_link_daily_budget VALUES(?,?)').run(day,links);let calls=0;
  const result=await checkJobLink(env,id,async()=>{calls++;return page();},clock);const allowed=global===496;
  assert.equal(calls,allowed?1:0);assert.equal(result.state,allowed?'checked':'skipped');assert.equal(checkRow(env).state,result.state);
  assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget').get().requests,global+(allowed?4:0));assert.equal(env.sql.prepare('SELECT reserved_requests FROM job_link_daily_budget').get().reserved_requests,links+(allowed?4:0));
 }
});
test('redirects stay on the approved advert; HTTP failures, oversized pages and missing titles preserve uncertainty',async t=>{
 for(const [response,state,reason] of [
  [()=>new Response(null,{status:302,headers:{Location:'https://127.0.0.1/private'}}),'needs_review','unapproved_redirect'],
  [()=>new Response(null,{status:404}),'needs_review','http_404'],[()=>new Response(null,{status:429}),'uncertain','http_429'],
  [()=>new Response('{}',{headers:{'Content-Type':'application/json'}}),'uncertain','non_html_response'],
  [()=>page('x'.repeat(500001)),'uncertain','request_or_read_unavailable'],[()=>page('<title>Login</title>'),'needs_review','title_not_confirmed'],
  [()=>page('<title>Fictional Engineer</title><p>This vacancy has been filled</p>'),'needs_review','closure_wording'],
  [()=>{throw Error('timeout');},'uncertain','request_or_read_unavailable']]){
   const env=database(t);seed(env);const [id]=await plan(env);let calls=0;const result=await checkJobLink(env,id,async()=>{calls++;return response();},clock);
   assert.equal(result.state,state);assert.equal(result.reason,reason);assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT active FROM jobs').get().active,1);
 }
});
test('pause, advert change and UTC boundary stop a check before its next request or acceptance',async t=>{
 for(const kind of ['pause','job-change','day']){
  const env=database(t);seed(env);const [id]=await plan(env);let calls=0,time=now;
  const result=await checkJobLink(env,id,async()=>{calls++;if(kind==='pause')env.sql.prepare('UPDATE business_controls SET enabled=0').run();if(kind==='job-change')env.sql.prepare("UPDATE jobs SET title='Changed role'").run();if(kind==='day')time=now+86400000;return new Response(null,{status:301,headers:{Location:'https://boards.greenhouse.io/monzo/jobs/123'}});},()=>time);
  assert.equal(result.state,'skipped');assert.equal(calls,1);
 }
});
test('removing approval mid-check stops further requests to an additional employer',async t=>{
 const env=database(t);env.sql.prepare("INSERT INTO metadata VALUES('register',?)").run(JSON.stringify({snapshot:'fixture'}));env.sql.prepare("INSERT INTO sponsors VALUES('s','fixture','Fictional firm','London','','','',1)").run();
 env.sql.prepare("INSERT INTO employer_boards(id,company,provider,board,careers,sector,sponsor_id,evidence,state,created_at) VALUES('extra','Fictional firm','greenhouse','extra','https://example.invalid/','technology','s','Fictional evidence','approved',?)").run(stamp);
 seed(env,'a','extra');const [id]=await plan(env);let calls=0;
 const result=await checkJobLink(env,id,async()=>{calls++;env.sql.prepare("UPDATE employer_boards SET state='paused'").run();return page();},clock);
 assert.equal(result.state,'skipped');assert.equal(calls,1);
});
test('missing, unfinished and stale checks remain visible; expired problems cannot silently become healthy',async t=>{
 const env=database(t);seed(env);assert.equal((await jobLinkHealth(env,now)).awaiting,1);const [id]=await plan(env);
 await checkJobLink(env,id,async()=>new Response(null,{status:404}),clock);let health=await jobLinkHealth(env,now);assert.equal(health.needs_attention,1);assert.equal(jobLinkFindings(health).length,1);
 env.sql.prepare("UPDATE job_link_checks SET created_at='invalid'").run();health=await jobLinkHealth(env,now);assert.equal(health.overdue,1);assert.equal(jobLinkFindings(health).length,1);
 env.sql.prepare("UPDATE job_link_checks SET state='checking',created_at=?,started_at=?").run(stamp,new Date(now-120001).toISOString());health=await jobLinkHealth(env,now);assert.equal(health.needs_attention,1);
 env.sql.prepare('DELETE FROM business_runs').run();assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM job_link_checks').get().n,0);
});
