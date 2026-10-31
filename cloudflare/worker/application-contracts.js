// Deliberately separate from campaign execution and current customer validation.
// Admission is an exact retained profile plus the unchanged fictional fixture.
import manifest from './application-contracts/2026-10-08-v1/manifest.json' with {type:'json'};
import {validateReview} from './application-contracts/2026-10-08-v1/career-review.js';
import {validateCandidateReview} from './application-contracts/2026-10-08-v1/career-review-candidate.js';
const canonical=value=>JSON.stringify(value&&typeof value==='object'?
 Array.isArray(value)?value.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
export function historicalApplicationContract(recordedProfile,expectedProfile){
 let recorded,current;
 try{recorded=JSON.parse(recordedProfile);current=JSON.parse(expectedProfile);}catch{return null;}
 if(!current||current.fixture_hash!==manifest.profile.fixture_hash||current.suite!==manifest.profile.suite||canonical(recorded)!==canonical(manifest.profile))return null;
 return {validateReview,validateCandidateReview,evidence:{id:manifest.id,source_commit:manifest.source_commit,source_sha256:manifest.source_sha256,recorded_implementation:manifest.profile.implementation}};
}
