import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {referenceSet,candidateReferenceSet,referenceEvidence} from '../worker/research-reference.js';
import {compactReferenceEvidence} from '../worker/research-candidate.js';
import {evidenceWithQuotes} from '../worker/research-contract.js';
import {verifyResearchSource} from './research-source.mjs';

// Reads an existing private reference export. No network, model or database writes.
export async function comparisonPreflight(rows){
  if(rows.length!==50||new Set(rows.map(r=>r.job_id)).size!==50)throw Error('Expected the complete fixed reference cohort.');
  const env={DB:{prepare:()=>({bind(dataset,...ids){return{all:async()=>({results:rows.filter(r=>r.dataset===dataset&&ids.includes(r.job_id))})};}})}};
  const batches=[];
  for(let i=0;i<candidateReferenceSet.batches.length;i++){
    const batch=candidateReferenceSet.batches[i],evidence=await referenceEvidence(env,batch.id),compact=compactReferenceEvidence(evidence);
    if(JSON.stringify(batch.job_ids)!==JSON.stringify(referenceSet.batches[i].job_ids))throw Error('Comparison cohort changed.');
    for(let n=0;n<evidence.length;n++)if(compact[n].quote_options.map(q=>q.text).join('')!==evidence[n].description)throw Error('Original evidence was lost.');
    const input=e=>JSON.stringify({evidence:e,approved_observations:[],limitations:['Fixed historical advert snapshots for provisional evaluation only. They do not establish current availability, independent accuracy or visa eligibility.']});
    const original=input(evidenceWithQuotes(evidence)),candidate=input(compact);
    if(candidate.length>=original.length||candidate.length>90000)throw Error('Input reduction failed.');
    batches.push({batch:batch.id,adverts:evidence.length,original_characters:original.length,candidate_characters:candidate.length,complete_original_text_retained:true});
  }
  return {at:new Date().toISOString(),source_sha256:(await verifyResearchSource()).sha256,original_dataset:referenceSet.id,candidate_dataset:candidateReferenceSet.id,
    verified_records:50,unique_description_hashes:new Set(referenceSet.cases.map(c=>c.content_hash)).size,batches,
    maximum_original_characters:Math.max(...batches.map(b=>b.original_characters)),maximum_candidate_characters:Math.max(...batches.map(b=>b.candidate_characters)),
    total_original_characters:batches.reduce((n,b)=>n+b.original_characters,0),total_candidate_characters:batches.reduce((n,b)=>n+b.candidate_characters,0),
    model_calls:0,source_requests:0,production_writes:0,model_quality_verified:false,
    limitation:'Byte and request-size preflight only. Character counts are not token usage or provider cost; no model has executed this comparison.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4)throw Error('Usage: research-comparison-preflight.mjs private-reference.json aggregate-receipt.json');
  const source=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));
  const receipt=await comparisonPreflight(source[0].results);
  await writeFile(resolve(process.argv[3]),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({verified_records:receipt.verified_records,batches:receipt.batches.length,maximum_original_characters:receipt.maximum_original_characters,maximum_candidate_characters:receipt.maximum_candidate_characters,model_calls:0}));
}
