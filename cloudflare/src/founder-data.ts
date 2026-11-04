import {useEffect,useLayoutEffect,useState} from 'react';
import {emptyWorkbook,hasWork} from '../shared/founder.js';
import {createFounderWorkspace,founderDirty} from '../shared/founder-workspace.js';

const listeners=new Set<()=>void>();
// Created only when the Founder hub is opened. Access to browser storage and
// account requests begins only after the explicit private-workspace action.
export const founderStore=createFounderWorkspace({
 storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)},
 notify:()=>listeners.forEach(fn=>fn()),
 request:async(method,body)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch('/api/career/founder-workspace',{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const data=await response.json();
   if(!response.ok)throw Object.assign(Error(data.error||'The account request failed. Your device copy remains available.'),{code:data.code,status:response.status});
   return data;
  }catch(e){if(e instanceof Error&&e.name==='AbortError')throw Error(method==='PUT'?'The save response timed out. Reconcile that exact save; do not discard its recovery copy.':'The saved workbook could not be opened in time. Your current copy remains.');throw e;}
  finally{clearTimeout(timer);}
 }
});
if(typeof window!=='undefined')window.addEventListener('beforeunload',event=>{
 const s=founderStore.state;
 if(founderStore.hasHiddenWork||hasWork(s.book)&&(!s.accountId||founderDirty(s)||s.error)||s.pending||s.recovery){event.preventDefault();event.returnValue='';}
});
export function useFounderWorkspace(accountId:string|null){
 const [,render]=useState(0);
 useEffect(()=>{const fn=()=>render(n=>n+1);listeners.add(fn);return()=>{listeners.delete(fn);};},[]);
 useLayoutEffect(()=>{founderStore.setIdentity(accountId);},[accountId]);
 const s=founderStore.state;
 // Do not paint one account's notes while the identity effect is pending.
 return s.accountId&&s.accountId!==accountId?{...s,book:emptyWorkbook(),base:emptyWorkbook(),recovery:null,incoming:null,rawBackup:null,pending:null,accountId:null}:s;
}
