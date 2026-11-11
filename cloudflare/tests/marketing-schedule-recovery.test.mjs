import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareScheduleSave,sendScheduleSave,ScheduleSaveError} from '../shared/marketing-schedule-save.js';
import {createBrief,decideBrief,destinations} from '../worker/marketing.js';
import {database} from './research-db.mjs';

const now=Date.parse('2026-11-11T18:00:00Z'),iso=value=>new Date(value).toISOString();
const destination=destinations['facebook-company'];
const note='Fictional provider observation of the exact reviewed guide, destination and queued job. No external post exists.';
async function setup(t){
 const env=database(t);
 const created=await createBrief(env,{topic_key:'fictional-schedule-recovery',destination:'facebook-company',title:'Fictional schedule recovery',purpose:'Exercise retained evidence in an isolated ledger without provider calls.',text:'Fictional guide copy for local schedule-receipt recovery; never published.',sources:[{title:'Fictional guide evidence',url:'https://sponsorintel.london/guides/build-a-shortlist',excerpt:'Fictional source quotation used only by the isolated test database.',checked_at:iso(now)}],expires_at:iso(now+86400000)},'fictional-writer',now);
 await decideBrief(env,{id:created.id,revision:1,kind:'reviewed',request_key:'fictional-review',note,checks:{claims:true,sources:true,destination:true,duplication:true}},'fictional-reviewer',now);
 const serialized=prepareScheduleSave({id:created.id,revision:2,state:'reviewed',expires_at:iso(now+86400000),media:[]},destination,{external:'fictional-original-job',observed:iso(now-1234),scheduled:iso(now+3600000+567),note,observer:'agent_assisted',checked:true,mediaChecked:false},now,'fictional-original-schedule-key');
 return {env,id:created.id,serialized};
}
function snapshot(env,id){return JSON.stringify({brief:env.sql.prepare('SELECT state,version,revision,last_event,updated_at FROM marketing_briefs WHERE id=?').get(id),events:env.sql.prepare('SELECT * FROM marketing_events WHERE brief_id=? ORDER BY revision').all(id),receipts:env.sql.prepare('SELECT * FROM marketing_receipts WHERE brief_id=? ORDER BY id').all(id)});}

test('original schedule survives denied retries and replays after newer delivery and expired evidence without rewriting history',async t=>{
 const {env,id,serialized}=await setup(t);let phase='commit-drop';const posted=[];
 const transport=async(path,init)=>{
  assert.equal(path,'/api/admin/marketing/decide');posted.push(init.body);
  if(phase==='403'||phase==='429')return Response.json({error:'Fictional request gate rejected this attempt.'},{status:Number(phase)});
  const result=await decideBrief(env,JSON.parse(init.body),'fictional-owner',phase==='commit-drop'?now:now+3*86400000);
  if(phase==='commit-drop')throw Error('Fictional acknowledgement lost after commit');
  return Response.json(result);
 };
 await assert.rejects(sendScheduleSave(serialized,transport),e=>e instanceof ScheduleSaveError&&e.uncertain);
 for(const status of ['403','429']){phase=status;await assert.rejects(sendScheduleSave(serialized,transport),e=>e instanceof ScheduleSaveError&&!e.uncertain);}
 // These later rejected requests say nothing about the already-committed first request.
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE brief_id=? AND kind='scheduled'").get(id).n,1);
 const publicationTime=now+2*3600000;
 await decideBrief(env,{id,revision:3,kind:'published',request_key:'fictional-later-delivery',note,receipt:{account:destination.account,provider:destination.provider,external_id:'fictional-original-job',post_url:'https://www.facebook.com/permalink.php?story_fbid=123456&id=1319703417896763',observed_at:iso(publicationTime),evidence:note}},'fictional-delivery-observer',publicationTime);
 const before=snapshot(env,id);phase='replay-after-expiry';assert.equal((await sendScheduleSave(serialized,transport)).replayed,true);
 assert.deepEqual(posted,[serialized,serialized,serialized,serialized]);assert.equal(snapshot(env,id),before);
 assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs WHERE id=?').get(id).state,'published');
 const receipt=env.sql.prepare("SELECT * FROM marketing_receipts WHERE brief_id=? AND state='scheduled'").get(id);
 assert.equal(receipt.observed_at,iso(now-1234));assert.equal(receipt.scheduled_at,iso(now+3600000+567));assert.equal(receipt.external_id,'fictional-original-job');assert.match(receipt.evidence,/^Agent-assisted observation/);
});

test('changed owner or changed schedule bytes cannot reuse the original key; the original identity still reconciles once',async t=>{
 const {env,id,serialized}=await setup(t),body=JSON.parse(serialized);
 await decideBrief(env,body,'fictional-owner',now);const before=snapshot(env,id);
 await assert.rejects(decideBrief(env,body,'different-fictional-owner',now+86400000),e=>e.status===409);
 const changed={...body,receipt:{...body.receipt,external_id:'different-fictional-job'}};
 await assert.rejects(decideBrief(env,changed,'fictional-owner',now+86400000),e=>e.status===409);
 assert.equal(snapshot(env,id),before);
 assert.equal((await decideBrief(env,body,'fictional-owner',now+3*86400000)).replayed,true);
 assert.equal(snapshot(env,id),before);
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_receipts WHERE brief_id=? AND state='scheduled'").get(id).n,1);
});
