export const factAnswerFields = [
  {key:'notice_period',label:'Notice period or earliest start',hint:'For example: four weeks after accepting an offer. Leave blank if you need to check.'},
  {key:'salary_expectation',label:'Salary expectation',hint:'State currency and period if known. This is your preference, not a salary inferred from the advert.'},
  {key:'interview_availability',label:'Interview availability',hint:'Include your timezone and any dates. Check this again before using it.'},
];
export function validateFactAnswers(value) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!factAnswerFields.some(f=>f.key===k)))throw Error('Use only the three routine answer fields.');
  return Object.fromEntries(factAnswerFields.map(({key})=>{
    const v=value[key];
    if(v!==undefined && v!==null && (typeof v!=='string'||v.length>1200))throw Error('Keep each answer within 1,200 characters.');
    return [key,typeof v==='string'&&v.trim()?v.trim():null];
  }));
}
export const factPackLabels={current:'Facts confirmed for preparation',revoked:'Confirmation revoked',superseded:'Replaced by a later version',batch_changed:'Batch changed — review again',inputs_changed:'Profile or role changed — review again'};

// Recovery storage keeps request identity, never the applicant's answer text.
export function factSafeAttempt(attempt) {
 const body={...attempt.body};
 if(body.action==='approve_facts')delete body.answers;
 return {...attempt,body};
}
