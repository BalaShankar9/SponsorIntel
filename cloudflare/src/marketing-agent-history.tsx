import React,{useEffect,useState} from 'react';

type Summary={id:string;day:string;state:string;created_at:string;finished_at:string|null;calls:number;policy:string};
type Step={name:string;role:string;state:string;created_at:string;output:{reason?:string;failure?:string;failure_stage?:string}|null;usage:Record<string,number>|null};
type Detail={run:Summary&{models:Record<string,{provider:string;model:string}>;context:unknown;result:{reason?:string}|null};steps:Step[]};
const readable=(value:string)=>value.replaceAll('_',' ').replaceAll('-',' ');
const stamp=(value:string|null)=>value?new Date(value).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC':'Not recorded';
async function read(query:string,signal:AbortSignal){
 const response=await fetch('/api/admin/marketing/agents/history'+query,{signal});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Run history could not load.');return data;
}
export function MarketingAgentHistory(){
 const[cursors,setCursors]=useState<(string|null)[]>([null]),[page,setPage]=useState<{runs:Summary[];next_before:string|null}|null>(null),[selected,setSelected]=useState(''),[detail,setDetail]=useState<Detail|null>(null),[pageError,setPageError]=useState(''),[detailError,setDetailError]=useState(''),[refresh,setRefresh]=useState(0);
 const cursor=cursors[cursors.length-1];
 useEffect(()=>{
  const controller=new AbortController();let current=true;setPage(null);setPageError('');
  void read(cursor?'?before='+encodeURIComponent(cursor):'',controller.signal).then(data=>{if(current){setPage(data);setSelected(previous=>data.runs.some((r:Summary)=>r.id===previous)?previous:data.runs[0]?.id||'');}}).catch(error=>{if(current)setPageError(error.message);});
  return()=>{current=false;controller.abort();};
 },[cursor,refresh]);
 useEffect(()=>{
  const controller=new AbortController();let current=true;setDetail(null);setDetailError('');
  if(selected)void read('?id='+encodeURIComponent(selected),controller.signal).then(data=>{if(current){if(data.run?.id!==selected)throw Error('The returned evidence belongs to a different run. Refresh to inspect again.');setDetail(data);}}).catch(error=>{if(current)setDetailError(error.message);});
  return()=>{current=false;controller.abort();};
 },[selected,refresh]);
 // Never present an earlier response under a newly selected run or page.
 const visible=page?.runs.some(r=>r.id===selected)&&detail?.run.id===selected?detail:null;
 function changePage(next:(string|null)[]){setPage(null);setSelected('');setDetail(null);setCursors(next);}
 return <section className="marketing-agent-history" aria-label="Recorded editorial run history">
  <p>Inspect retained attempts without starting a model call or changing a hold. A completed workflow or model review does not prove publication or content quality.</p>
  <div className="marketing-history-actions"><button onClick={()=>setRefresh(n=>n+1)}>Refresh history</button><button disabled={cursors.length===1} onClick={()=>changePage([null])}>Newest runs</button></div>
  {pageError?<p className="career-error" role="alert">{pageError}</p>:!page?<p role="status">Loading recorded runs…</p>:!page.runs.length?<p>No editorial attempts are recorded.</p>:<>
   <label htmlFor="marketing-history-selection">Recorded attempt</label>
   <select id="marketing-history-selection" value={selected} onChange={event=>setSelected(event.target.value)}>{page.runs.map(run=><option key={run.id} value={run.id}>{run.day} · {readable(run.state)} · {run.calls} {run.calls===1?'call':'calls'}</option>)}</select>
   <div className="marketing-history-actions"><button disabled={cursors.length===1} onClick={()=>changePage(cursors.slice(0,-1))}>Newer runs</button><button disabled={!page.next_before} onClick={()=>changePage([...cursors,page.next_before])}>Older runs</button><span>Page {cursors.length} · up to 10 attempts</span></div>
   {detailError?<p className="career-error" role="alert">{detailError}</p>:!visible?<p role="status">Loading selected evidence…</p>:<article aria-label={'Evidence for '+visible.run.id}>
    <h4>{visible.run.day} · {readable(visible.run.state)}</h4>
    <p><strong>{visible.run.id}</strong><br/>Created {stamp(visible.run.created_at)}<br/>Finished {stamp(visible.run.finished_at)}<br/>{visible.run.calls} reserved model calls · policy {visible.run.policy}</p>
    <p>{visible.run.result?.reason||'No final outcome is recorded. This does not authorise a retry.'}</p>
    <details><summary>Models recorded for this attempt</summary>{Object.entries(visible.run.models).map(([role,model])=><p key={role}>{readable(role)}: {model.provider} · {model.model}</p>)}</details>
    {visible.steps.length?visible.steps.map(step=><section className="marketing-agent-step" key={step.name} aria-label={readable(step.name)+' step'}>
     <h5>{readable(step.name)} · {readable(step.state)}</h5><p>{step.role} · started {stamp(step.created_at)}</p>
     {(step.output?.reason||step.output?.failure)&&<p>{step.output.reason||step.output.failure}</p>}
     {step.state!=='completed'&&!step.output?.failure_stage&&<p>Detailed completion diagnostics were not retained for this step. The cause remains unknown in this record; inspect the original provider receipt. No automatic retry.</p>}
     {step.usage?<p>Reported tokens: {Object.entries(step.usage).map(([key,value])=>readable(key)+': '+value).join(' · ')}</p>:<p>Provider token usage was not recorded.</p>}
     <details><summary>Retained structured step result</summary><pre>{JSON.stringify(step.output,null,2)}</pre></details>
    </section>):<p>No model step is recorded for this attempt.</p>}
    <details><summary>Captured planning evidence and measurements</summary><p>This is the evidence retained at the time of this run. It may now be stale. Opening it does not refresh sources, recheck vacancies or approve content.</p><pre>{JSON.stringify(visible.run.context,null,2)}</pre></details>
    <details><summary>Retained final decision</summary><pre>{JSON.stringify(visible.run.result,null,2)}</pre></details>
   </article>}
  </>}
 </section>;
}
