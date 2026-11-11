import {useEffect,useState} from 'react';
import {emptyFinancialInputs,type FinancialInputs} from '../shared/founder-finances.js';

type Draft={inputs:FinancialInputs;contextToken:number};
// Tab memory only. Each authenticated identity has a separate, hidden draft.
// Keeping this outside the mounted hub also preserves it during in-app navigation.
const drafts=new Map<string,Draft>(),listeners=new Set<()=>void>();
const keyFor=(accountId:string|null)=>accountId===null?'guest':'account:'+accountId;
const defaults=emptyFinancialInputs();
const hasInputs=(inputs:FinancialInputs)=>Object.entries(inputs).some(([key,value])=>value!==defaults[key as keyof FinancialInputs]);
const emit=()=>listeners.forEach(fn=>fn());
// Called only after a confirmed account deletion, never on ordinary sign-out.
export function clearFounderFinanceDraft(accountId:string){drafts.delete(keyFor(accountId));emit();}
if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{
 if([...drafts.values()].some(draft=>hasInputs(draft.inputs))){event.preventDefault();event.returnValue='';}
});
export function useFounderFinanceDraft(accountId:string|null,contextToken:number){
 const[,render]=useState(0),key=keyFor(accountId);
 useEffect(()=>{const update=()=>render(n=>n+1);listeners.add(update);return()=>{listeners.delete(update);};},[]);
 const draft=drafts.get(key)||{inputs:emptyFinancialInputs(),contextToken};
 return {
  inputs:draft.inputs,
  contextChanged:hasInputs(draft.inputs)&&draft.contextToken!==contextToken,
  change(next:FinancialInputs){
   if(hasInputs(next))drafts.set(key,{inputs:{...next},contextToken:drafts.get(key)?.contextToken??contextToken});
   else drafts.delete(key);
   emit();
  },
  adoptContext(){const current=drafts.get(key);if(current)drafts.set(key,{...current,contextToken});emit();},
  current(){return drafts.get(key)||{inputs:emptyFinancialInputs(),contextToken};},
 };
}
