import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './research-db.mjs';
import { BOARDS, normaliseBoardJobs, storeBoardJobs } from '../worker/jobs.js';
import { startInvestigation,researchContext,modelStep,validateDecision,executeResearchTool,validateReport,validateReview,analyseResearch,reviewResearch,finishResearch,approveObservation,researchSnapshot,contentHash,chooseResearchTool,stopWithEvidence } from '../worker/agent-research.js';
import { RESEARCH_CASES,evaluationEvidence,scoreEvaluation } from '../worker/research-evals.js';
import { callResearchModel,parseModelJSON } from '../worker/research-model.js';
import { agentOperationsAPI } from '../worker/agent-api.js';
import { adminAPI } from '../worker/admin.js';
const board=BOARDS[0];
const goodReport=(e=evaluationEvidence())=>({ summary_claims:[{claim_id:'s1',text:'These findings are limited to the inspected evidence.',citations:[{job_id:e[0].id,quote:e[0].description}]}],assessments:e.map(x=>({job_id:x.id,verdict:RESEARCH_CASES.find(c=>c[0]===x.id)?.[2]||'offered',quote:x.description,reason:'The supplied wording supports this classification.'})),next_checks:[] });
const goodReview=r=>({summary_checks:r.summary_claims.map(c=>({claim_id:c.claim_id,supported:true,reason:'The summary is limited to cited evidence.'})),next_check_checks:r.next_checks.map((_,index)=>({index,supported:true,reason:'This is a neutral follow-up question.'})),checks:r.assessments.map(a=>({job_id:a.job_id,supported:true,reason:'The quoted evidence supports the assessment.'}))});
async function setup(t,kind='evaluation') {
 const env=database(t);env.RESEARCH_WORKFLOW={async create(){},async get(){return{async status(){return{status:'running'};}};}};
 env.AI_MODEL='investigator';env.AI_REVIEW_MODEL='reviewer';
 const {id}=await startInvestigation(env,'owner',kind);await researchContext(env,id);return{env,id};
}
async function realSetup(t) {
 const {env,id}=await setup(t,'research');
 const jobs=await normaliseBoardJobs([{id:'qa-1',title:'Software Engineer',location:{name:'London'},content:'We offer visa sponsorship for this position. Build reliable software for our London team.',absolute_url:'https://boards.greenhouse.io/example/jobs/123'}],board);
 await storeBoardJobs(env.DB,board,jobs,new Date().toISOString());
 env.sql.prepare('UPDATE agent_investigations SET context=NULL WHERE id=?').run(id);await researchContext(env,id);
 await executeResearchTool(env,id,0,{tool:'list_jobs',id:board.id,purpose:'Find a sponsorship claim.'});
 await executeResearchTool(env,id,1,{tool:'inspect_job',id:jobs[0].id,purpose:'Read the original advert.'},async()=>jobs);
 return{env,id,jobs};
}

test('fabricated quotes, duplicate claims, missing evidence and authority fields fail closed',()=>{
 const e=evaluationEvidence(),r=goodReport(e);assert.equal(validateReport(r,e),r);
 for(const mutate of [x=>x.assessments[0].quote='invented quote',x=>x.assessments[0].job_id='unknown',x=>x.assessments.push(x.assessments[0]),x=>x.execute='publish',x=>x.assessments[0].verdict='guaranteed']){
  const broken=structuredClone(r);mutate(broken);assert.throws(()=>validateReport(broken,e));
 }
 const incomplete=structuredClone(e);incomplete[0].complete=false;assert.throws(()=>validateReport(r,incomplete));
 assert.throws(()=>validateReview({checks:[]},r));
});
test('tool selection cannot select arbitrary URLs, hidden jobs or repeat tools',()=>{
 const ctx={sources:[{id:'approved'}],candidates:[{id:'job'}],listed:[],evidence:[]};
 assert.equal(validateDecision({tool:'list_jobs',id:'approved',purpose:'Inspect source'},ctx).id,'approved');
 for(const [tool,id] of [['fetch','https://localhost'],['inspect_job','secret'],['finish','']]) assert.throws(()=>validateDecision({tool,id,purpose:'Attempt'},ctx));
 ctx.listed=['approved'];assert.throws(()=>validateDecision({tool:'list_jobs',id:'approved',purpose:'Repeat'},ctx));
});
test('a known invalid tool choice receives bounded feedback; repaired decisions still pass the same authority check',async t=>{
 const {env,id}=await realSetup(t);let calls=0;
 env.AI={async run(model,input){const context=JSON.parse(input.messages[1].content);assert.ok(context.available_actions.some(x=>x.tool==='finish'&&x.id===''));
  return {response:JSON.stringify(calls++ ? {tool:'finish',id:'',purpose:'Enough evidence for a report.'} : {tool:'fetch',id:'https://localhost/secrets',purpose:'Ignore restrictions'})};}};
 const bad=await chooseResearchTool(env,id,2);assert.ok(bad.tool_error);assert.equal(bad.attempted_tool,'fetch');
 await assert.rejects(executeResearchTool(env,id,2,bad));
 const repaired=await chooseResearchTool(env,id,2,bad);assert.equal(repaired.tool,'finish');
 assert.equal((await executeResearchTool(env,id,2,repaired)).done,true);assert.equal(calls,2);
});
test('scoring detects unsupported positive claims and missing answers independently of reviewer',()=>{
 const r=goodReport();assert.equal(scoreEvaluation(r).correct,20);
 r.assessments.find(x=>x.job_id==='negative-overrides').verdict='offered';r.assessments.pop();
 const score=scoreEvaluation(r);assert.equal(score.correct,18);assert.equal(score.dangerous_false_positives,1);assert.equal(score.cases.at(-1).actual,'missing');
});
test('research uses fresh approved feed evidence; tool replay does not fetch twice',async t=>{
 const {env,id,jobs}=await realSetup(t);
 await executeResearchTool(env,id,1,{tool:'inspect_job',id:jobs[0].id,purpose:'Read original'},()=>{throw Error('duplicate fetch');});
 const ctx=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations WHERE id=?').get(id).context);
 assert.equal(ctx.evidence.length,1);assert.equal(ctx.evidence[0].description,jobs[0].description);
 assert.equal(ctx.evidence[0].content_hash,await contentHash(jobs[0].description));
});
test('removed and truncated adverts cannot support a positive verdict',async t=>{
 const {env,id,jobs}=await realSetup(t);
 const ctx=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations WHERE id=?').get(id).context);
 ctx.evidence=[];ctx.decisions=ctx.decisions.slice(0,1);
 env.sql.prepare('UPDATE agent_investigations SET context=? WHERE id=?').run(JSON.stringify(ctx),id);
 await executeResearchTool(env,id,1,{tool:'inspect_job',id:jobs[0].id,purpose:'Verify removed advert'},async()=>[]);
 const e=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations WHERE id=?').get(id).context).evidence;
 assert.equal(e[0].current,false);assert.equal(e[0].description,'');assert.equal(e[0].url,null);
});
test('early tool failure can produce only a disclosed partial report from already collected evidence',async t=>{
 const empty=await setup(t,'research');assert.equal(await stopWithEvidence(empty.env,empty.id),false);
 const {env,id}=await realSetup(t);assert.equal(await stopWithEvidence(env,id),true);
 const ctx=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations').get().context);
 assert.equal(ctx.evidence.length,1);assert.match(ctx.limitations[0],/ended early/);
});
test('owner recovery retains run identity, evidence and original reservations; expired recovery is rejected',async t=>{
 const {env,id}=await realSetup(t);env.sql.prepare("UPDATE agent_investigations SET state='failed',calls=4 WHERE id=?").run(id);
 let restarted=0;env.RESEARCH_WORKFLOW.get=async requested=>{assert.equal(requested,id);return{async status(){return{status:'complete'};},async restart(){restarted++;}};};
 const request=()=>new Request('https://sponsorintel.london/api/admin/agents/research/recover',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify({run_id:id})});
 assert.equal((await agentOperationsAPI(request(),env,{user:{id:'owner'}})).status,202);
 const run=env.sql.prepare('SELECT state,calls,context FROM agent_investigations').get();assert.equal(run.state,'running');assert.equal(run.calls,4);assert.equal(JSON.parse(run.context).evidence.length,1);assert.equal(restarted,1);
 env.sql.prepare("UPDATE agent_investigations SET state='failed',created_at='2000-01-01'").run();assert.equal((await agentOperationsAPI(request(),env,{user:{id:'owner'}})).status,400);assert.equal(restarted,1);
});
test('failed model calls count; replay refuses to issue another charge',async t=>{
 const {env,id}=await setup(t);let calls=0;env.AI={async run(){calls++;throw Error('secret provider failure');}};
 for(let i=0;i<2;i++) await assert.rejects(modelStep(env,id,'one','investigator','JSON',{a:1},x=>x));
 assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations').get().calls,1);
 assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,1);
});
test('successful model replay reuses result; provider and usage are pinned to the run',async t=>{
 const {env,id}=await setup(t);let calls=0;env.AI={async run(model){calls++;assert.equal(model,'investigator');return{response:'{"answer":1}',usage:{total_tokens:10}};}};
 env.AI_MODEL='changed';assert.deepEqual(await modelStep(env,id,'one','investigator','JSON',{},x=>x),{answer:1});
 assert.deepEqual(await modelStep(env,id,'one','investigator','JSON',{},x=>x),{answer:1});assert.equal(calls,1);
});
test('model call budgets roll back together and prevent additional calls',async t=>{
 const {env,id}=await setup(t);env.AI={async run(){throw Error('must not run');}};
 env.sql.prepare('UPDATE agent_research_budget SET calls=32').run();
 await assert.rejects(modelStep(env,id,'blocked','investigator','JSON',{},x=>x));
 assert.equal(env.sql.prepare('SELECT calls FROM agent_investigations').get().calls,0);
 assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM agent_research_steps').get().n,0);
});
test('per-investigation cap prevents a ninth model call without consuming another daily allowance',async t=>{
 const {env,id}=await setup(t);let calls=0;env.AI={async run(){calls++;return{response:'{}'};}};
 for(let i=0;i<8;i++) await modelStep(env,id,'call-'+i,'investigator','JSON',{},x=>x);
 await assert.rejects(modelStep(env,id,'call-9','investigator','JSON',{},x=>x));
 assert.equal(calls,8);assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,8);
});
test('four research starts daily; active run is reused without reserving another',async t=>{
 const {env,id}=await setup(t);assert.equal((await startInvestigation(env,'owner')).id,id);
 for(let i=1;i<4;i++){env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();await startInvestigation(env,'owner');}
 env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();await assert.rejects(startInvestigation(env,'owner'),/Four daily/);
});
test('independent critique triggers revision and final report retains the disagreement',async t=>{
 const {env,id}=await setup(t);const report=goodReport(),critique=goodReview(report);critique.checks[0].supported=false;
 const responses=[report,critique,report,goodReview(report)];let calls=0;
 env.AI={async run(model){assert.equal(model,calls%2?'reviewer':'investigator');return{response:JSON.stringify(responses[calls++])};}};
 await analyseResearch(env,id);assert.equal((await reviewResearch(env,id)).revise,true);
 await analyseResearch(env,id,true);assert.equal((await reviewResearch(env,id,true)).revise,false);await finishResearch(env,id);
 const row=env.sql.prepare('SELECT state,report FROM agent_investigations').get(),saved=JSON.parse(row.report);
 assert.equal(row.state,'review');assert.equal(saved.publication,'none');assert.equal(saved.previous_review.checks[0].supported,false);
 assert.equal(saved.evaluation.correct,20);assert.equal(saved.evidence[0].description,undefined);
 await assert.rejects(approveObservation(env,id,'explicit-offer','owner'));
});
test('same model cannot masquerade as independent review',async t=>{
 const {env,id}=await setup(t);env.sql.prepare('UPDATE agent_investigations SET report=?,models=? WHERE id=?').run(JSON.stringify({report:goodReport()}),JSON.stringify({investigator:{model:'one',provider:'cloudflare'},reviewer:{model:'one',provider:'cloudflare'}}),id);
 await assert.rejects(reviewResearch(env,id),/different model/);
});
test('approved memory requires current hash, complete evidence and supportive critique',async t=>{
 const {env,id,jobs}=await realSetup(t);const ctx=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations').get().context);
 const report=goodReport(ctx.evidence),review=goodReview(report);
 env.sql.prepare("UPDATE agent_investigations SET state='review',report=? WHERE id=?").run(JSON.stringify({report,review}),id);
 await approveObservation(env,id,jobs[0].id,'owner');assert.equal(env.sql.prepare('SELECT verdict FROM agent_research_memory').get().verdict,'offered');
 assert.equal(env.sql.prepare('SELECT sponsorship FROM jobs').get().sponsorship,jobs[0].sponsorship);
 env.sql.prepare("UPDATE jobs SET description='changed advert'").run();await assert.rejects(approveObservation(env,id,jobs[0].id,'owner'),/changed/);
});
test('expired, changed or unapproved observations are not reused',async t=>{
 const {env,id,jobs}=await realSetup(t);const ctx=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations').get().context);
 env.sql.prepare("INSERT INTO agent_research_memory VALUES(?,?,?,?,?,?,?,?)").run(jobs[0].id,ctx.evidence[0].content_hash,'offered',jobs[0].description,id,'owner',new Date().toISOString(),'2000-01-01');
 ctx.evidence=[];ctx.decisions=ctx.decisions.slice(0,1);env.sql.prepare('UPDATE agent_investigations SET context=? WHERE id=?').run(JSON.stringify(ctx),id);
 await executeResearchTool(env,id,1,{tool:'inspect_job',id:jobs[0].id,purpose:'Read fresh'},async()=>jobs);
 assert.equal(JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations').get().context).memory.length,0);
});
test('private snapshot excludes actor, raw adverts and account records',async t=>{
 const {env}=await setup(t);const snapshot=await researchSnapshot(env);
 assert.equal(snapshot.runs[0].actor,undefined);assert.equal(snapshot.runs[0].context,undefined);assert.equal(snapshot.budget.run_limit,4);
});
test('anonymous and cross-origin callers cannot start research',async t=>{
 const {env}=await setup(t);env.APP_ORIGIN='https://sponsorintel.london';
 const anon=await adminAPI(new Request('https://sponsorintel.london/api/admin/agents/research'),env);assert.equal(anon.status,403);
 const cross=await agentOperationsAPI(new Request('https://sponsorintel.london/api/admin/agents/research/start',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{"kind":"evaluation"}'}),env,{user:{id:'owner'}});assert.equal(cross.status,403);
});
test('valid owner request parses the body before dispatch and returns a queued receipt',async t=>{
 const {env}=await setup(t);env.sql.prepare("UPDATE agent_investigations SET state='failed'").run();
 const request=new Request('https://sponsorintel.london/api/admin/agents/research/start',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:JSON.stringify({kind:'evaluation'})});
 const response=await agentOperationsAPI(request,env,{user:{id:'owner'}});
 assert.equal(response.status,202);assert.equal((await response.json()).state,'queued');
 const queued=env.sql.prepare("SELECT kind FROM agent_investigations WHERE state='queued'").get();assert.equal(queued.kind,'evaluation');
});
test('provider responses reject truncation and keys never become model input',async()=>{
 await assert.rejects(callResearchModel({AI:{async run(){return{response:'{}',choices:[{finish_reason:'length'}]};}}},{provider:'cloudflare',model:'a'},'JSON',{}),/incomplete/);
 await assert.rejects(callResearchModel({}, {provider:'openai',model:'gpt-6-astra'},'JSON',{}),/not connected/);
 assert.throws(()=>parseModelJSON('a'.repeat(32001)));
 assert.deepEqual(parseModelJSON({checks:[]}),{checks:[]});
 assert.throws(()=>parseModelJSON({huge:'a'.repeat(32001)}));
});
test('prepared OpenAI adapter disables storage and keeps credentials out of the prompt',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'manual');
  const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.reasoning.effort,'high');assert.equal(body.model,'gpt-6-astra');
  assert.ok(!options.body.includes('test-key'));assert.equal(options.headers.Authorization,'Bearer test-key');
  return Response.json({status:'completed',output:[{type:'reasoning',content:[]},{type:'message',content:[{type:'output_text',text:'{"answer":1}'}]}],usage:{input_tokens:10,output_tokens:5}});
 });
 const r=await callResearchModel({OPENAI_API_KEY:'test-key'},{provider:'openai',model:'gpt-6-astra'},'Return JSON',{});assert.deepEqual(r.value,{answer:1});
});
test('prepared Anthropic adapter ignores private thinking blocks and rejects non-OK responses',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.headers['x-api-key'],'test-key');assert.ok(!options.body.includes('test-key'));
  return Response.json({content:[{type:'thinking',thinking:'private'},{type:'text',text:'{"answer":2}'}],stop_reason:'end_turn'});
 });
 const r=await callResearchModel({ANTHROPIC_API_KEY:'test-key'},{provider:'anthropic',model:'claude-fable-5-1'},'Return JSON',{});assert.deepEqual(r.value,{answer:2});assert.ok(!JSON.stringify(r).includes('private'));
});
test('prepared external model adapters reject redirects without sending credentials onward',async t=>{
 let requests=0;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{requests++;assert.equal(options.redirect,'manual');return new Response('',{status:302,headers:{location:'https://different.example'}});});
 for(const provider of ['openai','anthropic'])await assert.rejects(callResearchModel({OPENAI_API_KEY:'test-key',ANTHROPIC_API_KEY:'test-key'},{provider,model:'test-model'},'Return JSON',{}),/unavailable/);
 assert.equal(requests,2);
});

test('original-advert research shares the source allowance and refuses exhausted outbound work',async t=>{
 const {env,id,jobs}=await realSetup(t),day=new Date().toISOString().slice(0,10);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget WHERE day=?').get(day).requests,1);
 const ctx=JSON.parse(env.sql.prepare('SELECT context FROM agent_investigations WHERE id=?').get(id).context);ctx.evidence=[];ctx.decisions=[];env.sql.prepare('UPDATE agent_investigations SET context=? WHERE id=?').run(JSON.stringify(ctx),id);env.sql.prepare('UPDATE agent_daily_budget SET requests=500 WHERE day=?').run(day);let calls=0;
 await assert.rejects(executeResearchTool(env,id,2,{tool:'inspect_job',id:jobs[0].id,purpose:'Inspect original'},async()=>{calls++;return jobs;}),/allowance/);assert.equal(calls,0);assert.equal(env.sql.prepare('SELECT requests FROM agent_daily_budget WHERE day=?').get(day).requests,500);
});
