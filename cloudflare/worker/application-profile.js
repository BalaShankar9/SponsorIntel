// Stable source identity, independent of bundler symbol allocation.
import fixture from '../tests/fixtures/application-development-20.json' with {type:'json'};
import source from './application-source.json' with {type:'json'};
export const APPLICATION_FIXTURE_HASH='5b8654502327fbff77608a48c42fc61d3acf786ea3ee43f42d90b97b5efd81c3';
export const APPLICATION_EVAL_POLICY='paired-application-schema-v2';
export const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
export async function profileDigest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function candidateReviewOptions(kind){
 if(!['cv','coverLetter'].includes(kind))throw Error('Unknown candidate document kind');
 const evidence=object({source_id:{type:'string',minLength:2,maxLength:12},quote:{type:'string',minLength:10,maxLength:1800}});
 const paragraph=object({text:{type:'string',minLength:10,maxLength:1400},evidence:{type:'array',minItems:1,maxItems:3,items:evidence}});
 const section=object({heading:{type:'string',enum:kind==='cv'?['PROFILE','SKILLS','SELECTED PROJECTS','EXPERIENCE','EDUCATION']:['BODY']},paragraphs:{type:'array',minItems:kind==='cv'?1:2,maxItems:kind==='cv'?8:4,items:paragraph}});
 return {max_tokens:2700,temperature:.1,response_format:{type:'json_schema',json_schema:object({sections:{type:'array',minItems:1,maxItems:kind==='cv'?5:1,items:section}})}};
}
export const baselineReviewOptions=()=>({max_tokens:2700,temperature:.1,response_format:{type:'json_object'}});
export async function applicationProfile(env){
 if(await profileDigest(canonical(fixture))!==APPLICATION_FIXTURE_HASH)throw Error('Application fixture changed');
 return {suite:fixture.version,fixture_hash:APPLICATION_FIXTURE_HASH,policy:APPLICATION_EVAL_POLICY,candidate_policy:'application-linked-paragraphs-v1',writer:env.AI_MODEL,reviewer:env.AI_REVIEW_MODEL,review_options:baselineReviewOptions(),candidate_options:{cv:candidateReviewOptions('cv'),coverLetter:candidateReviewOptions('coverLetter')},identity_method:'source-graph-sha256-v1',implementation:source.sha256};
}
