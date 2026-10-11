const kinds=new Set(['cv','coverLetter','interview','companyResearch','portfolio','learningPlan']);
const inputApplication=a=>Object.fromEntries(['id','jobId','title','company','description','sponsorship','evidence'].map(k=>[k,a[k]]));

export function beginPreparedDraft(data,id,kind,scope,requestId){
 const a=data.applications.find(a=>a.id===id);
 if(!a||!kinds.has(kind))throw Error('Choose a current application document.');
 return {scope,requestId,kind,input:{profile:{...data.profile},application:inputApplication(a)},sourceURL:a.url,previousText:a[kind]||''};
}

export function acceptPreparedDraft(data,ticket,result,scope,requestId){
 if(ticket.scope!==scope||ticket.requestId!==requestId)return {status:'superseded',data};
 const a=data.applications.find(a=>a.id===ticket.input.application.id);
 if(!a||JSON.stringify(data.profile)!==JSON.stringify(ticket.input.profile)||
  JSON.stringify(inputApplication(a))!==JSON.stringify(ticket.input.application)||
  a.url!==ticket.sourceURL||(a[ticket.kind]||'')!==ticket.previousText)return {status:'changed',data};
 if(typeof result?.text!=='string'||!result.text.trim()||typeof result.generatedAt!=='string'||!Number.isFinite(Date.parse(result.generatedAt)))return {status:'invalid',data};
 return {status:'saved',data:{...data,applications:data.applications.map(row=>row.id===a.id?{...row,[ticket.kind]:result.text,preparedAt:result.generatedAt,updatedAt:result.generatedAt}:row)}};
}
