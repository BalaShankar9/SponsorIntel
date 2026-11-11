import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDecisionSave, sendDecisionSave, DecisionSaveError} from '../shared/marketing-decision-save.js';
import {createBrief, decideBrief, destinations} from '../worker/marketing.js';
import {database} from './research-db.mjs';

const now = Date.parse('2026-11-11T17:30:12.345Z');
const iso = value => new Date(value).toISOString();
const brief = {id:'fictional-decision-brief', revision:3, state:'scheduled', expires_at:iso(now+86400000), media:[]};
const destination = destinations['facebook-company'];
const form = {note:'  Fictional operator verified the original provider outcome and retained its limitations.  ', checked:true, mediaChecked:false, external:'fictional-original-reference', postURL:'https://www.facebook.com/permalink.php?story_fbid=123456&id=1319703417896763'};
const draft = {topic_key:'fictional-decision', destination:'facebook-company', title:'Fictional decision evidence', purpose:'Verify an isolated editorial decision without any provider or model action.', text:'Fictional source-backed copy in an isolated test database. It is never published.', sources:[{title:'Fictional guide source', url:'https://sponsorintel.london/guides/build-a-shortlist', excerpt:'Fictional retained evidence for a local test, with no claim about real content.', checked_at:iso(now)}], expires_at:iso(now+86400000)};

test('all six decisions preserve the existing request fields and generate a delivery time only once', () => {
  for (const kind of ['held','reviewed','published','failed','uncertain','cancelled']) {
    const current={...brief,state:['held','reviewed'].includes(kind)?'proposed':'scheduled',media:[{sha256:'second'},{sha256:'first'}]};
    const supplied={...form,mediaChecked:true};
    const serialized=prepareDecisionSave(current,destination,supplied,kind,now,'fixed-'+kind);
    const value=JSON.parse(serialized);
    assert.equal(value.id,brief.id); assert.equal(value.revision,3); assert.equal(value.kind,kind); assert.equal(value.request_key,'fixed-'+kind); assert.equal(value.note,form.note);
    if (['held','reviewed'].includes(kind)) assert.equal(value.receipt,undefined);
    else { assert.equal(value.receipt.observed_at,iso(now)); assert.equal(value.receipt.external_id,form.external); assert.equal(value.receipt.post_url,form.postURL); assert.equal(value.receipt.evidence,form.note); assert.equal(value.receipt.account,destination.account); assert.equal(value.receipt.provider,destination.provider); assert.deepEqual(value.receipt.media_sha256,['second','first']); }
    assert.deepEqual(value.checks,kind==='reviewed'?{claims:true,sources:true,destination:true,duplication:true,media:true}:undefined);
  }
});

test('unsupported actions, wrong transitions and incomplete review/delivery inputs fail before transport', () => {
  for(const kind of ['scheduled','revise','deleted']) assert.throws(()=>prepareDecisionSave(brief,destination,form,kind,now));
  for(const state of ['published','failed','cancelled','proposed','reviewed']) assert.throws(()=>prepareDecisionSave({...brief,state},destination,form,'published',now));
  const proposed={...brief,state:'proposed'};
  assert.throws(()=>prepareDecisionSave(proposed,destination,{...form,checked:false},'reviewed',now));
  assert.throws(()=>prepareDecisionSave({...proposed,expires_at:iso(now)},destination,form,'reviewed',now));
  assert.throws(()=>prepareDecisionSave({...proposed,media:[{sha256:'image'}]},destination,form,'reviewed',now));
  assert.throws(()=>prepareDecisionSave({...brief,media:[{sha256:'image'}]},destination,form,'published',now));
  for(const patch of [{note:'short'},{note:'x'.repeat(1201)},{external:'https://provider.example/reference'},{postURL:''},{postURL:'https://user:secret@example.invalid/post'}]) assert.throws(()=>prepareDecisionSave(brief,destination,{...form,...patch},'published',now));
  assert.throws(()=>prepareDecisionSave({...brief,revision:0},destination,form,'published',now));
  assert.throws(()=>prepareDecisionSave(brief,destination,form,'published',NaN));
  // A hold may preserve old evidence; an uncertain delivery needs no invented public URL.
  assert.equal(JSON.parse(prepareDecisionSave({...proposed,expires_at:iso(now-1)},destination,form,'held',now)).kind,'held');
  assert.equal(JSON.parse(prepareDecisionSave(brief,destination,{...form,postURL:''},'uncertain',now)).receipt.post_url,'');
});

test('malformed or foreign acknowledgements, gateway failures and lost responses remain uncertain', async () => {
  const body=prepareDecisionSave(brief,destination,form,'published',now,'pinned-published');
  for(const fetcher of [
    async()=>{throw Error('Lost response');},
    async()=>new Response('<html>gateway</html>',{status:502}),
    async()=>Response.json({error:'Failure'},{status:500}),
    async()=>Response.json({error:'The record could not be saved. Refresh before retrying.'},{status:400}),
    async()=>Response.json({id:'foreign',state:'published'}),
    async()=>Response.json({id:'foreign',replayed:true}),
    async()=>Response.json({id:brief.id,state:'held'}),
    async()=>Response.json({id:brief.id}),
    async()=>Response.json(null),
  ]) await assert.rejects(sendDecisionSave(body,fetcher),error=>error instanceof DecisionSaveError&&error.uncertain);
  assert.equal((await sendDecisionSave(body,async()=>Response.json({id:brief.id,state:'published'}))).state,'published');
  assert.equal((await sendDecisionSave(body,async()=>Response.json({id:brief.id,replayed:true}))).replayed,true);
});

test('structured input rejection is correctable; invalid retained input is never sent', async () => {
  const body=prepareDecisionSave(brief,destination,form,'published',now);
  for(const status of [400,401,403,404,409,410,422,429]) await assert.rejects(sendDecisionSave(body,async()=>Response.json({error:'The recorded input was rejected.'},{status})),error=>error instanceof DecisionSaveError&&!error.uncertain&&error.message==='The recorded input was rejected.');
  let sent=0;
  for(const body of ['broken',JSON.stringify({id:brief.id,kind:'scheduled'})]) await assert.rejects(sendDecisionSave(body,async()=>{sent++;throw Error();}),error=>error instanceof DecisionSaveError&&!error.uncertain);
  assert.equal(sent,0);
});

test('the old new-key retry fails after a committed delivery loses its response; identical replay retains one original event', async t => {
  const env=database(t), created=await createBrief(env,draft,'fictional-writer',now);
  await decideBrief(env,{id:created.id,revision:1,kind:'reviewed',note:form.note,checks:{claims:true,sources:true,destination:true,duplication:true},request_key:'setup-review'},'fictional-reviewer',now);
  await decideBrief(env,{id:created.id,revision:2,kind:'scheduled',note:form.note,request_key:'setup-schedule',receipt:{account:destination.account,provider:destination.provider,external_id:form.external,observed_at:iso(now),scheduled_at:iso(now+1000),evidence:form.note}},'fictional-owner',now);
  const at=now+2000, input={...brief,id:created.id};
  const pinned=prepareDecisionSave(input,destination,form,'published',at,'fixed-delivery-key');
  const posted=[]; let lose=true;
  const transport=async(url,init)=>{
    assert.equal(url,'/api/admin/marketing/decide'); posted.push(init.body);
    const result=await decideBrief(env,JSON.parse(init.body),'fictional-owner',at);
    if(lose){lose=false;throw Error('Acknowledgement lost after commit');}
    return Response.json(result);
  };
  await assert.rejects(sendDecisionSave(pinned,transport),error=>error.uncertain);
  const oldRetry=prepareDecisionSave(input,destination,form,'published',at+1000,'replacement-key');
  await assert.rejects(decideBrief(env,JSON.parse(oldRetry),'fictional-owner',at+1000),error=>error.status===409&&/brief changed/i.test(error.message));
  assert.equal((await sendDecisionSave(pinned,transport)).replayed,true); assert.deepEqual(posted,[pinned,pinned]);
  const current=env.sql.prepare('SELECT state,revision,version FROM marketing_briefs WHERE id=?').get(created.id);
  assert.deepEqual({...current},{state:'published',revision:4,version:1});
  const events=env.sql.prepare("SELECT * FROM marketing_events WHERE brief_id=? AND kind='published'").all(created.id);
  const receipts=env.sql.prepare("SELECT * FROM marketing_receipts WHERE brief_id=? AND state='published'").all(created.id);
  assert.equal(events.length,1); assert.equal(receipts.length,1); assert.equal(events[0].request_key,'fixed-delivery-key');
  assert.equal(JSON.parse(events[0].detail).note,form.note.trim());
  assert.equal(receipts[0].observed_at,iso(at)); assert.equal(receipts[0].evidence,form.note.trim()); assert.equal(receipts[0].external_id,form.external); assert.equal(receipts[0].post_url,form.postURL);
  // Replaying the historical event does not rewrite a later timestamp or revision.
  const before=JSON.stringify({current,events,receipts}); await sendDecisionSave(pinned,transport);
  assert.equal(JSON.stringify({current:env.sql.prepare('SELECT state,revision,version FROM marketing_briefs WHERE id=?').get(created.id),events:env.sql.prepare("SELECT * FROM marketing_events WHERE brief_id=? AND kind='published'").all(created.id),receipts:env.sql.prepare("SELECT * FROM marketing_receipts WHERE brief_id=? AND state='published'").all(created.id)}),before);
});

for(const kind of ['held','reviewed']) test(`${kind} decisions also replay their exact original event after a lost response`, async t => {
  const env=database(t), created=await createBrief(env,{...draft,topic_key:'fictional-'+kind},'fictional-writer',now);
  const body=prepareDecisionSave({...brief,id:created.id,revision:1,state:'proposed'},destination,form,kind,now,'fixed-'+kind);
  let lose=true; const sent=[];
  const transport=async(url,init)=>{sent.push(init.body);const result=await decideBrief(env,JSON.parse(init.body),'fictional-reviewer',now);if(lose){lose=false;throw Error('Lost response');}return Response.json(result);};
  await assert.rejects(sendDecisionSave(body,transport),error=>error.uncertain);
  assert.equal((await sendDecisionSave(body,transport)).replayed,true);assert.deepEqual(sent,[body,body]);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_events WHERE brief_id=? AND kind=?').get(created.id,kind).n,1);
  assert.equal(env.sql.prepare('SELECT revision FROM marketing_briefs WHERE id=?').get(created.id).revision,2);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts WHERE brief_id=?').get(created.id).n,0);
});
