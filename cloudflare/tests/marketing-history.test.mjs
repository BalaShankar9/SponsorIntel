import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {marketingAgentHistory} from '../worker/marketing-agents.js';
const base='https://sponsorintel.london/api/admin/marketing/agents/history';
const request=query=>new Request(base+query);
function seed(env,day,state='held',created=day+'T00:47:00Z'){
 const id='marketing-'+day;
 env.sql.prepare('INSERT INTO marketing_agent_runs(id,day,state,created_at,finished_at,policy,models,context,result,calls) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,day,state,created,created,'historical-policy-'+day,JSON.stringify({writer:{provider:'cloudflare',model:'old-writer'},reviewer:{provider:'cloudflare',model:'old-critic'}}),JSON.stringify({observed_at:created,measurement:{count:null},sources:[{facts:['Original fictional fact']}]}),JSON.stringify({reason:'Original fictional decision'}),state==='no_post'?0:1);
 return id;
}
test('history keyset pages every retained run once, including tied times and a newer insertion',async t=>{
 const env=database(t);for(let day=1;day<=25;day++)seed(env,'2026-09-'+String(day).padStart(2,'0'),'held','2026-10-01T00:00:00Z');
 const first=await(await marketingAgentHistory(request(''),env)).json();assert.equal(first.runs.length,10);assert.equal(first.runs[0].id,'marketing-2026-09-25');assert.equal(first.next_before,'marketing-2026-09-16');assert.ok(first.runs.every(x=>!('context'in x)&&!('models'in x)&&!('result'in x)));
 seed(env,'2026-10-13','no_post');
 const second=await(await marketingAgentHistory(request('?before='+first.next_before),env)).json();assert.equal(second.runs[0].id,'marketing-2026-09-15');
 const third=await(await marketingAgentHistory(request('?before='+second.next_before),env)).json();assert.equal(third.runs.length,5);assert.equal(third.next_before,null);
 assert.equal(new Set([...first.runs,...second.runs,...third.runs].map(r=>r.id)).size,25);
});
test('selected evidence and diagnostics stay attached to the historical run and reads preserve all state',async t=>{
 const env=database(t),old=seed(env,'2026-10-12'),latest=seed(env,'2026-10-13','no_post');
 env.sql.prepare("INSERT INTO marketing_agent_steps(run_id,name,role,state,created_at,output,usage) VALUES(?,'plan','writer','failed',?,?,?)").run(old,'2026-10-12T00:47:00Z',JSON.stringify({failure:'Historical failure with no completion metadata.'}),JSON.stringify({total_tokens:8,arbitrary_secret:'not a token counter'}));
 const before=env.sql.prepare('SELECT total_changes() n').get().n;
 const historical=await(await marketingAgentHistory(request('?id='+old),env)).json();assert.equal(historical.run.id,old);assert.equal(historical.run.models.writer.model,'old-writer');assert.equal(historical.run.policy,'historical-policy-2026-10-12');assert.equal(historical.run.context.measurement.count,null);assert.equal(historical.steps.length,1);assert.equal(historical.steps[0].state,'failed');assert.equal(historical.steps[0].output.failure_stage,undefined);assert.deepEqual(historical.steps[0].usage,{total_tokens:8});
 const current=await(await marketingAgentHistory(request('?id='+latest),env)).json();assert.equal(current.run.id,latest);assert.deepEqual(current.steps,[]);assert.equal(env.sql.prepare('SELECT total_changes() n').get().n,before);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM agent_research_budget').get().n,0);
});
test('malformed, duplicate, mixed and missing history selections fail without guessing a run',async t=>{
 const env=database(t);for(const query of ['?id=', '?before=', '?id=marketing-2026-02-30','?id=marketing-2026-10-12&id=marketing-2026-10-13','?id=marketing-2026-10-12&before=marketing-2026-10-11','?before=marketing-2026-10-11&before=marketing-2026-10-10','?id=anything%27%20OR%201%3D1','?limit=999'])assert.equal((await marketingAgentHistory(request(query),env)).status,400,query);
 for(const query of ['?id=marketing-2026-10-12','?before=marketing-2026-10-12'])assert.equal((await marketingAgentHistory(request(query),env)).status,404);
 const empty=await(await marketingAgentHistory(request(''),env)).json();assert.deepEqual(empty,{runs:[],next_before:null});
});
