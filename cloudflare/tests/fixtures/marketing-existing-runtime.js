// Isolated Workerd/Workflow harness. Never deployed or imported by the app.
// A deterministic model adapter proves execution, not editorial judgement.
import {WorkflowEntrypoint} from 'cloudflare:workers';
import {MarketingWorkflow} from '../../worker/marketing-workflow.js';
import {dispatchMarketingAgents} from '../../worker/marketing-agents.js';
import {createBrief} from '../../worker/marketing.js';
import {instagramWelcomeContent} from '../../worker/marketing-welcome.js';

export class LocalMarketingWorkflow extends WorkflowEntrypoint {
 async run(event,step){
  const env={...this.env,AI:{run:async(model,request)=>{
   const input=JSON.parse(request.messages[1].content);
   await this.env.DB.prepare('INSERT INTO runtime_model_calls(model,units) VALUES(?,?)').bind(model,input.units.length).run();
   return {response:{checks:input.units.map(u=>({index:u.index,supported:true,
    reason:'Synthetic runtime response; this is not an independent quality assessment.',
    evidence:u.claim?input.sources.map(s=>({source_id:s.id,quote:s.excerpt})):[]})),
    accessibility_consistent:true,publishable:true,reason:'Synthetic decision verifies durable execution and receipt handling only.'},usage:{total_tokens:1}};
  }}};
  return MarketingWorkflow.prototype.run.call({env},event,step);
 }
}
export default {
 async fetch(request,env){
  if(env.RUNTIME_TEST!=='local-only'||!['localhost','127.0.0.1'].includes(new URL(request.url).hostname))return new Response('Local harness only',{status:403});
  const url=new URL(request.url),now=Date.now(),day=new Date(now).toISOString().slice(0,10),id='marketing-'+day;
  if(request.method==='POST'&&url.pathname==='/start'){
   await env.DB.prepare('CREATE TABLE IF NOT EXISTS runtime_model_calls(model TEXT,units INTEGER)').run();
   const prior=await env.DB.prepare('SELECT id FROM marketing_agent_runs WHERE id=?').bind(id).first();
   if(!prior){
    const stamp=new Date(now-86400000).toISOString();
    await env.DB.prepare("INSERT INTO jobs(id,board_id,company,title,location,description,apply_url,provider,sponsorship,level,first_seen,last_seen) VALUES('local','test','LOCAL synthetic employer','LOCAL synthetic role','London','Synthetic fixture','https://example.com/job','test','not_stated','professional',?,?)").bind(stamp,stamp).run();
    await createBrief(env,await instagramWelcomeContent(env,undefined,now-86400000),'template:instagram-welcome-v1:runtime-fixture',now-86400000);
   }
   return Response.json(await dispatchMarketingAgents(env));
  }
  if(url.pathname==='/state'){
   const run=await env.DB.prepare('SELECT * FROM marketing_agent_runs WHERE id=?').bind(id).first();
   const platform=run?await (await env.MARKETING_WORKFLOW.get(id)).status():null;
   const briefs=await env.DB.prepare('SELECT id,state,version,revision FROM marketing_briefs').all();
   const steps=await env.DB.prepare('SELECT name,role,state FROM marketing_agent_steps').all();
   const budget=await env.DB.prepare('SELECT * FROM agent_research_budget').all();
   const model=await env.DB.prepare('SELECT * FROM runtime_model_calls').all();
   const receipts=await env.DB.prepare('SELECT COUNT(*) count FROM marketing_receipts').first();
   return Response.json({platform,run:run?{id:run.id,state:run.state,calls:run.calls,result:JSON.parse(run.result||'null')}:null,briefs:briefs.results,steps:steps.results,budget:budget.results,model_calls:model.results,provider_receipts:receipts.count});
  }
  return new Response('Local synthetic marketing workflow test');
 }
};
