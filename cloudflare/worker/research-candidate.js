import {ARCHIVED_ANALYST_PROMPT, ARCHIVED_REVIEW_PROMPT, evidenceWithQuotes} from './research-contract.js';
import source from './research-source.json' with {type:'json'};

// A development comparison, never an automatic replacement for live research.
export const RESEARCH_CANDIDATE_POLICY = 'investigator-v4-compact-reference';
export const RESEARCH_CANDIDATE_DATASET = 'real-adverts-2026-10-08-compact-v2';
export const CANDIDATE_ANALYST_PROMPT = ARCHIVED_ANALYST_PROMPT + ' The ordered quote_options contain the COMPLETE advert exactly once; concatenate their text to read its full context. Do not treat a chunk in isolation. Keep each assessment reason within 600 characters, each summary text within 500, and each next check within 400. Give at most four next checks. Output only the requested JSON object.';
export const CANDIDATE_REVIEW_PROMPT = ARCHIVED_REVIEW_PROMPT + ' Keep each review reason within 600 characters. Output only the requested JSON object.';

export function compactReferenceEvidence(evidence) {
  // Explicit projection excludes answer keys, stored labels and learning memory.
  return evidenceWithQuotes(evidence).map(({id,title,company,url,observed_at,content_hash,complete,current,historical_snapshot,quote_options}) =>
    ({id,title,company,url,observed_at,content_hash,complete,current,historical_snapshot,quote_options}));
}

export function candidateReferenceProfile(models) {
  if(models.investigator.provider!=='cloudflare'||models.investigator.model!=='@cf/zai-org/glm-4.7-flash'||
    models.reviewer.provider!=='cloudflare'||models.reviewer.model!=='@cf/meta/llama-3.3-70b-instruct-fp8-fast')
    throw Error('The comparison requires the reviewed Cloudflare investigator and different reviewer.');
  return {version:1,policy:RESEARCH_CANDIDATE_POLICY,dataset:RESEARCH_CANDIDATE_DATASET,source_sha256:source.sha256,models,
    max_tokens:8192,temperature:0.1,thinking:true,analyst_format:'json_object',reviewer_format:'json_schema',
    input:'complete-ordered-quote-blocks',revision_limit:1};
}

// Llama's documented JSON-schema interface is separate from GLM's JSON-object
// request. GLM schema support is not assumed from another model's documentation.
export function candidateReviewFormat(report) {
  const text={type:'string',minLength:1,maxLength:600};
  const group=(name,ids,type='string')=>({type:'array',minItems:ids.length,maxItems:ids.length,
    items:{type:'object',additionalProperties:false,properties:{[name]:{type,...(ids.length?{enum:ids}:{})},supported:{type:'boolean'},reason:text},required:[name,'supported','reason']}});
  return {type:'json_schema',json_schema:{type:'object',additionalProperties:false,properties:{
    checks:group('job_id',report.assessments.map(x=>x.job_id)),
    summary_checks:group('claim_id',report.summary_claims.map(x=>x.claim_id)),
    next_check_checks:group('index',report.next_checks.map((_,i)=>i),'integer'),
  },required:['checks','summary_checks','next_check_checks']}};
}
