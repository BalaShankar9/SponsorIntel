// Read-only operator receipt. No dispatch, reconciliation write or recovery action.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const target=Object.freeze({name:'sponsorintel-db',id:'f51fb6a9-1278-4643-a49f-30c2e52c6313',workflow:'sponsorintel-business'});
export const receiptQuery=`SELECT COUNT(*) unfinished FROM business_runs WHERE state IN ('queued','running');
WITH selected AS (
 SELECT id FROM (SELECT id FROM business_runs WHERE state IN ('queued','running') ORDER BY created_at,id LIMIT 5)
 UNION SELECT id FROM (SELECT id FROM business_runs ORDER BY created_at DESC,id DESC LIMIT 1)
)
SELECT r.id,r.state,r.created_at,r.finished_at,r.trigger_kind,
 (SELECT COUNT(*) FROM business_steps s WHERE s.run_id=r.id) recorded_steps
FROM business_runs r JOIN selected s ON s.id=r.id ORDER BY r.created_at,r.id;`;
const states=new Set(['queued','running','completed','attention','failed','paused']);
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const idPattern=/^business-[0-9]{1,12}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readApplication(response){
  if(!Array.isArray(response)||response.length!==2||response.some(x=>x?.success!==true||!Array.isArray(x.results)))throw Error('Application receipt unavailable.');
  const count=response[0].results;
  if(count.length!==1||!Number.isSafeInteger(count[0].unfinished)||count[0].unfinished<0)throw Error('Invalid unfinished count.');
  const rows=response[1].results;
  if(rows.length>6||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Ambiguous application receipts.');
  const runs=rows.map(r=>{
    if(!idPattern.test(r.id)||!states.has(r.state)||typeof r.created_at!=='string'||!(r.finished_at===null||typeof r.finished_at==='string')||!['scheduled','owner','unknown'].includes(r.trigger_kind)||!Number.isSafeInteger(r.recorded_steps)||r.recorded_steps<0)throw Error('Invalid application receipt.');
    // Project only aggregate operational fields, never snapshot/result/actor data.
    return {id:r.id,state:r.state,created_at:r.created_at,finished_at:r.finished_at,trigger_kind:r.trigger_kind,recorded_steps:r.recorded_steps};
  });
  if(runs.filter(x=>['queued','running'].includes(x.state)).length!==Math.min(count[0].unfinished,5))throw Error('Incomplete unfinished selection.');
  return {unfinished_count:count[0].unfinished,selection_limited:count[0].unfinished>5,runs};
}

export function describeReceipt(raw,id,observedAt){
  if(raw?.id!==id||raw?.params?.runId!==id||!uuid.test(raw?.versionId||''))throw Error('Provider identity mismatch.');
  for(const key of ['queued','start','end'])if(raw[key]!=null&&(!date(raw[key])||Date.parse(raw[key])>Date.parse(observedAt)+300000))throw Error('Invalid provider timing.');
  if(!date(raw.queued)||!(raw.success===null||typeof raw.success==='boolean'))throw Error('Incomplete provider receipt.');
  const ended=date(raw.end),start=date(raw.start);
  if((start&&Date.parse(raw.start)<Date.parse(raw.queued))||(ended&&(!start||Date.parse(raw.end)<Date.parse(raw.start))))throw Error('Conflicting provider timing.');
  // Preserve what describe actually proves; do not invent running/paused status.
  const outcome=ended&&raw.success===true?'ended_successfully':ended&&raw.success===false?'ended_unsuccessfully':'no_terminal_receipt';
  return {observed_at:observedAt,lookup:'found',id,version_id:raw.versionId,
    queued_at:raw.queued,started_at:raw.start??null,ended_at:raw.end??null,success:raw.success,
    execution_outcome:outcome,application_output_state:states.has(raw.output?.state)?raw.output.state:null};
}

export function providerError(error){
  // Never retain raw CLI errors, output, parameters, logs or arbitrary text.
  const text=String(error?.stderr||'')+'\n'+String(error?.stdout||'');
  const code=text.match(/\[code:\s*(\d+)\]/)?.[1];
  return {lookup:code==='10400'?'not_found':'unavailable',error_code:code?Number(code):null,execution_outcome:'unknown'};
}

async function cli(args){
  const {stdout}=await promisify(execFile)(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),...args,'--config',resolve(root,'wrangler.jsonc')],{cwd:root,timeout:45000,maxBuffer:4*1024*1024});
  return JSON.parse(stdout);
}

export async function inspectBusiness(run=cli,clock=()=>new Date().toISOString()){
  const started=clock();
  const info=await run(['d1','info',target.name,'--json']);
  if(info?.uuid!==target.id||info?.name!==target.name)throw Error('Wrong database; inspection stopped.');
  const query=['d1','execute',target.name,'--remote','--command',receiptQuery,'--json'];
  const before=readApplication(await run(query));
  const providers=[];
  for(const row of before.runs){
    try{
      const raw=await run(['workflows','instances','describe',target.workflow,row.id,'--json']);
      try{providers.push(describeReceipt(raw,row.id,clock()));}
      catch{providers.push({id:row.id,observed_at:clock(),lookup:'invalid_response',execution_outcome:'unknown'});}
    }catch(error){providers.push({id:row.id,observed_at:clock(),...providerError(error)});}
  }
  let after=null;
  try{after=readApplication(await run(query));}catch{/* Retain the first observation without claiming a stable current state. */}
  const stable=after!==null&&JSON.stringify(before)===JSON.stringify(after);
  const now=clock();
  const issues=[];
  if(!stable)issues.push('application_changed_or_unavailable_during_inspection');
  if(before.selection_limited)issues.push('unfinished_selection_limited');
  const latest=before.runs.at(-1);
  if(!latest)issues.push('no_application_receipts');
  else if(date(latest.created_at)&&Date.parse(now)-Date.parse(latest.created_at)>2*3600000)issues.push('latest_application_over_two_hours_old');
  for(const row of before.runs){
    if(!date(row.created_at)||Date.parse(row.created_at)>Date.parse(now)+300000)issues.push('invalid_application_time:'+row.id);
    if(row.finished_at!==null&&(!date(row.finished_at)||Date.parse(row.finished_at)<Date.parse(row.created_at)||Date.parse(row.finished_at)>Date.parse(now)+300000))issues.push('invalid_application_time:'+row.id);
    if(['queued','running'].includes(row.state))issues.push('unfinished_application:'+row.id);
    const provider=providers.find(x=>x.id===row.id);
    if(provider.lookup!=='found')issues.push('provider_'+provider.lookup+':'+row.id);
    else if(!['queued','running'].includes(row.state)&&provider.execution_outcome==='no_terminal_receipt')issues.push('application_provider_mismatch:'+row.id);
    else if(provider.application_output_state!==null&&provider.application_output_state!==row.state)issues.push('application_provider_mismatch:'+row.id);
  }
  return {started_at:started,observed_at:now,database:target.name,database_id:target.id,workflow:target.workflow,
    status:issues.length?'needs_review':'receipts_observed',issues,application_before:before,application_after:after,
    application_stable_during_inspection:stable,providers,actions_performed:[],
    execution_success_is_business_acceptance:false,missing_instance_is_terminal_proof:false,
    zero_recorded_steps_proves_no_external_action:false,automatic_recovery_authorized:false};
}

export function saveReceipt(path,receipt){
  writeFileSync(resolve(path),JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--out')throw Error('Usage: node scripts/business-status.mjs --out new-receipt.json');
  try{
    const receipt=await inspectBusiness();saveReceipt(args[1],receipt);
    process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
    if(receipt.status!=='receipts_observed')process.exitCode=1;
  }catch{
    process.stderr.write('Business inspection failed or the receipt path already exists. No dispatch, recovery or data change was attempted. Inspect exact provider/access evidence; do not retry external actions.\n');process.exitCode=1;
  }
}
