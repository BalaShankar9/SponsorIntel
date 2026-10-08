import { REFERENCE_SET } from './reference-manifest.js';

export const referenceSet = REFERENCE_SET;
export const referenceBatch = (id,set=REFERENCE_SET) => set.batches.find(b => b.id === id);
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2,'0')).join('');
}
export async function referenceEvidence(env, batchId, set=REFERENCE_SET) {
  const batch = referenceBatch(batchId,set);
  if (!batch) throw Error('Choose a known reference batch.');
  const rows = await env.DB.prepare(`SELECT job_id,record FROM agent_reference_cases WHERE dataset=? AND job_id IN (${batch.job_ids.map(() => '?').join(',')})`)
    .bind(set.id,...batch.job_ids).all();
  if (rows.results.length !== batch.job_ids.length) throw Error('The frozen reference snapshot is incomplete.');
  const evidence = [];
  for (const id of batch.job_ids) {
    const row = rows.results.find(r => r.job_id === id), expected = set.cases.find(c => c.id === id);
    if (!row || await hash(row.record) !== expected.record_hash) throw Error('The frozen reference snapshot changed.');
    const r = JSON.parse(row.record);
    if (r.id !== id || await hash(r.description) !== expected.content_hash || r.description.length > 16000) throw Error('Invalid frozen advert evidence.');
    // Explicit projection: no accepted labels, annotation reasons, current site
    // labels, answer-key hashes or owner data ever enter the model context.
    evidence.push({id:r.id,title:r.title,company:r.company,description:r.description,
      url:r.apply_url,observed_at:r.last_seen,content_hash:r.content_hash,
      complete:true,current:false,historical_snapshot:set.snapshot_at});
  }
  if (evidence.reduce((n,e) => n + e.description.length,0) > 24000) throw Error('Reference batch exceeds its evidence limit.');
  return evidence;
}

export function scoreReferenceEvaluation(report,batchId) {
  const batch = referenceBatch(batchId);
  if (!batch) throw Error('Choose a known reference batch.');
  const cases = batch.job_ids.map(id => {
    const expected = REFERENCE_SET.cases.find(c => c.id === id).accepted_labels;
    const answers = report.assessments.filter(a => a.job_id === id);
    const actual = answers.length === 1 ? answers[0].verdict : 'missing';
    return {id,expected:expected.join(' or '),actual,ambiguous:expected.length>1,
      correct:expected.length===1 ? actual===expected[0] : null,
      within_provisional_set:expected.includes(actual)};
  });
  const single = cases.filter(c => !c.ambiguous);
  return {dataset:REFERENCE_SET.id,batch:batchId,synthetic:false,provisional:true,human_adjudicated:false,
    snapshot_at:REFERENCE_SET.snapshot_at,correct:single.filter(c => c.correct).length,total:single.length,
    evaluated_adverts:cases.length,ambiguous_cases:cases.length-single.length,
    dangerous_false_positives:single.filter(c => ['unavailable','not_stated'].includes(c.expected) && ['offered','conditional'].includes(c.actual)).length,
    unsupported_refusals:single.filter(c => c.expected==='not_stated' && c.actual==='unavailable').length,
    cases,limitation:'Fixed source-balanced development sample with AI-assisted provisional annotations. Ambiguous labels are excluded from the exact-label denominator. No independent human adjudication or population accuracy estimate; archived adverts are not current opportunities.'};
}

export async function referenceProgress(env) {
  const controls=await env.DB.prepare('SELECT enabled,research FROM business_controls WHERE singleton=1').first();
  const count = await env.DB.prepare('SELECT COUNT(*) n FROM agent_reference_cases WHERE dataset=?').bind(REFERENCE_SET.id).first();
  const rows = await env.DB.prepare(`SELECT id,reference_batch,state,policy,models,report,calls FROM agent_investigations WHERE reference_batch IN (${REFERENCE_SET.batches.map(() => '?').join(',')}) ORDER BY created_at,id`).bind(...REFERENCE_SET.batches.map(b => b.id)).all();
  const batches = REFERENCE_SET.batches.map(batch => {
    const run = rows.results.find(r => r.reference_batch===batch.id);
    let result = null;
    try { result = run?.report ? JSON.parse(run.report) : null; } catch { /* Held below. */ }
    const valid = run?.state==='review' && result?.quality?.review_complete===true &&
      result?.evaluation?.dataset===REFERENCE_SET.id && result.evaluation.batch===batch.id &&
      result?.report?.assessments?.length===batch.job_ids.length &&
      batch.job_ids.every(id => result.report.assessments.filter(a => a.job_id===id).length===1);
    const score = valid ? scoreReferenceEvaluation(result.report,batch.id) : null;
    return {id:batch.id,adverts:batch.job_ids.length,run_id:run?.id||null,calls:run?.calls||0,
      state:!run?'pending':valid?'reviewed':['queued','running'].includes(run.state)?'running':'needs_attention',
      correct:score?.correct||0,total:score?.total||0,ambiguous:score?.ambiguous_cases||0,
      dangerous_false_positives:score?.dangerous_false_positives||0,unsupported_refusals:score?.unsupported_refusals||0,
      disputed_items:valid?result.quality.unsupported_items:0,policy:run?.policy||null,models:run?.models||null};
  });
  const evaluated = batches.filter(b => b.state==='reviewed'), profiles = new Set(batches.filter(b => b.run_id).map(b => b.policy+'|'+b.models));
  const loaded = count?.n===REFERENCE_SET.cases.length;
  const state = !loaded?'not_loaded':profiles.size>1||batches.some(b => b.state==='needs_attention')?'needs_attention':!controls?.enabled||!controls.research?'paused':
    batches.some(b => b.state==='running')?'running':evaluated.length===batches.length?'complete':'ready';
  return {dataset:REFERENCE_SET.id,snapshot_at:REFERENCE_SET.snapshot_at,state,snapshot_loaded:loaded,
    total_adverts:REFERENCE_SET.cases.length,unique_descriptions:new Set(REFERENCE_SET.cases.map(c => c.content_hash)).size,
    evaluated_adverts:evaluated.reduce((n,b) => n+b.adverts,0),completed_batches:evaluated.length,total_batches:batches.length,
    correct:evaluated.reduce((n,b) => n+b.correct,0),scored:evaluated.reduce((n,b) => n+b.total,0),ambiguous:evaluated.reduce((n,b) => n+b.ambiguous,0),
    dangerous_false_positives:evaluated.reduce((n,b) => n+b.dangerous_false_positives,0),unsupported_refusals:evaluated.reduce((n,b) => n+b.unsupported_refusals,0),
    disputed_items:evaluated.reduce((n,b) => n+b.disputed_items,0),comparable:profiles.size<=1,
    next_batch:state==='ready'?batches.find(b => b.state==='pending')?.id||null:null,
    profile:batches.find(b => b.run_id)?{policy:batches.find(b => b.run_id).policy,models:batches.find(b => b.run_id).models}:null,
    batches:batches.map(({policy,models,...b}) => b),
    limitation:'Provisional development evidence, not independent validation. One scheduled batch per UTC day replaces the usual private investigation while this set is unfinished. Existing shared limits and pause controls apply. No automatic retry after a failed or uncertain attempt.'};
}

export function researchRetentionStatement(DB,cutoff) {
  // Keep finite reference campaigns and their child step receipts. Otherwise
  // deleting an old attempt would silently make its paid batch eligible again.
  return DB.prepare("DELETE FROM agent_investigations WHERE reference_batch IS NULL AND state IN ('review','failed') AND created_at<?").bind(cutoff);
}
