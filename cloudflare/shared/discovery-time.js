// Explicit UTC wall times avoid timezone guesses and hidden precision.
const invalid=()=>Object.assign(Error('Enter a valid UTC date and time, or leave an unknown optional date blank.'),{status:400});
export function discoveryTimeInput(value){
 if(!value)return '';
 const date=new Date(value);
 if(!Number.isFinite(date.getTime())||date.toISOString()!==value)throw invalid();
 return value.slice(0,-1);
}
export function discoveryTimeValue(value){
 if(value==='')return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value))throw invalid();
 const canonical=(value.length===16?value+':00.000':value.length===19?value+'.000':value.padEnd(23,'0'))+'Z';
 const date=new Date(canonical);
 if(!Number.isFinite(date.getTime())||date.toISOString()!==canonical)throw invalid();
 return canonical;
}
export function discoveryFormTimes(form){
 const result={};
 for(const key of ['observed_at','posted_at','deadline','follow_up_at']){
  const entries=form.getAll(key);
  if(entries.length>1||entries.length===0&&key!=='follow_up_at')throw invalid();
  result[key]=discoveryTimeValue(entries[0]??'');
 }
 if(!result.observed_at)throw Object.assign(Error('Enter when you actually observed the source before saving.'),{status:400});
 return result;
}
