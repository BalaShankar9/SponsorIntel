export const COMPACT_MARKETING_POLICY='sourced-guides-eligible-planner-v6';
export const PLANNER_INPUT_VERSION='eligible-facts-v1';
const pick=(source,keys)=>Object.fromEntries(keys.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));

export function legacyPlannerContext(context){
 const compact=({advert,opportunity,...source})=>source;
 return {...context,sources:context.sources.map(compact),candidates:context.candidates.map(compact)};
}

// The planner ranks only eligible candidates. Their complete approved facts,
// including every employer condition/limitation, appear once. Full original
// evidence remains in the immutable run context and still goes to the critic.
// Measurements/queue are not summarised, rounded, merged or reinterpreted.
export function compactPlannerContext(context){
 const keys=['kind','id','topic_key','title','path','campaign','url','facts','required_segments','checked_at','expires_at','content_hash','limitation','proposed_slot'];
 const candidates=context.candidates.map(source=>pick(source,keys)),eligible=new Set(candidates.map(source=>source.id));
 return {
  input_version:PLANNER_INPUT_VERSION,
  observed_at:context.observed_at,
  candidates,
  non_candidates:context.sources.filter(source=>!eligible.has(source.id)).map(source=>pick(source,['id','title','kind'])),
  non_candidate_limit:'These sources were not selectable in this captured attempt. Their omission from candidates is not evidence of a market shortage or sponsorship refusal.',
  unavailable:context.unavailable,
  opportunity_scan:context.opportunity_scan,
  slot:context.slot,
  queue:context.queue,
  metrics:context.metrics,
  measurement:context.measurement,
  performance:context.performance,
  measurement_limit:context.measurement_limit,
 };
}
