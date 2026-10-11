// Owner-only inspection of already retained fictional review responses.
// Never changes a receipt, invokes a model or makes a rejected output assessable.
import {validateReview} from './career-review.js';
import {validateCandidateReview} from './career-review-candidate.js';

const failures=new Map([
 ['Invalid candidate review structure',['structure','The response contains an invalid or unexpected structure.']],
 ['Missing candidate review sections',['sections','The required review sections are missing or outside their bounds.']],
 ['Invalid candidate review heading',['headings','A section heading is invalid, repeated or out of order.']],
 ['Missing candidate review paragraphs',['paragraphs','A section has missing or too many paragraphs.']],
 ['Invalid candidate paragraph',['paragraph_text','A paragraph violates text, length or formatting requirements.']],
 ['Every paragraph needs source evidence',['evidence_count','A paragraph does not have the required number of evidence quotations.']],
 ['Candidate quotation is absent from its source',['source_quote','A quotation or its source identifier does not match the supplied candidate evidence.']],
 ['Candidate number is absent from linked evidence',['linked_number','A number in a paragraph is absent from its linked quotations.']],
 ['Repeated candidate paragraph',['repeated_paragraph','The response repeats a paragraph.']],
 ['Invalid candidate paragraph count',['paragraph_count','The document has an invalid number of paragraphs or letter sections.']],
 ['Candidate document is too long',['document_length','The rendered document exceeds its length limit.']],
 ['Invalid reviewed document',['document_text','The corrected document is missing or violates length or formatting requirements.']],
 ['Missing factual checks',['factual_checks','The current reviewer did not supply the required factual checks.']],
 ['Unsupported evidence check',['evidence_check','A checked claim or source reference does not match the corrected document or supplied source identifiers.']],
 ['New numeric claim',['new_number','The current review introduces a number absent from the candidate input.']],
 ['Unsupported availability',['availability','The current review asserts availability not present in the candidate input.']],
]);
const limitation='This is a read-only recheck of retained response content against the unchanged contract. It does not recover provider completion metadata, prove writing quality, change the original rejection or permit a retry.';
export function retainedReviewDiagnostic(row,c,expectedProfile){
 if(row.state!=='rejected'||!['baseline','candidate'].includes(row.stage))return null;
 const result=(state,code,summary)=>({method:'retained_response_recheck_v1',state,code,summary,limitation});
 if(!['completed','failed'].includes(row.run_state)||!row.run_finished_at||!row.finished_at)
  return result('unavailable','unfinished','Wait for a finished evaluation receipt before inspecting its rejected review.');
 if(!expectedProfile||row.profile!==expectedProfile)
  return result('unavailable','configuration_changed','The current fixture, models or contract differ from the recorded configuration. Preserve this response for review under its original version.');
 let members;try{members=JSON.parse(row.case_ids);}catch{}
 if(!Array.isArray(members)||!members.includes(c.id))return result('unavailable','case_mismatch','The retained run does not identify this fictional case.');
 if(typeof row.raw!=='string'||!row.raw.length||row.raw.length>100000)
  return result('unavailable','response_unavailable','No bounded retained response content is available for this recheck.');
 let value;try{value=JSON.parse(row.raw);}catch{return result('unavailable','retention_invalid','The retained response wrapper could not be decoded.');}
 if(value===null)return result('unavailable','response_unavailable','No retained response content is available for this recheck.');
 try{
  if(row.stage==='candidate')validateCandidateReview(value,c.profile,c.application,c.kind);
  else validateReview(value,c.profile,c.kind);
  return result('passes_recheck','cause_unresolved','The retained content passes this contract recheck. The original rejection remains; missing provider metadata or another original condition still needs investigation.');
 }catch(error){
  const [code,summary]=error instanceof SyntaxError?['invalid_json','The retained model content is not valid JSON for this contract.']:failures.get(error?.message)||['contract_failure','The retained content fails validation; no more specific safe diagnostic is available.'];
  return result('rejected_again',code,summary);
 }
}
