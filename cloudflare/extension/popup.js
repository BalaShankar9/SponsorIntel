import {analyseAdvert} from './analyse.js';
import {captureAdvert} from './capture.js';
const $=id=>document.getElementById(id);
const advert=$('advert'),confirm=$('confirm'),result=$('result');
let generation=0;
function invalidate(){generation++;result.hidden=true;confirm.checked=false;}
advert.addEventListener('input',()=>{invalidate();$('source').textContent='Edited/pasted text — page identity has not been verified.';});
confirm.addEventListener('change',()=>{result.hidden=true;});
$('read').addEventListener('click',async()=>{
  invalidate();const token=generation;advert.value='';$('source').textContent='';$('read').disabled=true;
  $('message').textContent='Reading the text you can see…';
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https?:\/\//.test(tab.url||'')) throw Error('Open a normal job webpage, or paste the advert below. Browser/store pages cannot be read.');
    const responses=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureAdvert});
    if(token!==generation)return;
    const data=responses[0]?.result;
    if(!data||data.error)throw Error(data?.error||'No readable advert returned. Paste it below.');
    advert.value=data.text;
    $('source').textContent=`${data.source} · ${data.mode} · ${new Date().toLocaleTimeString('en-GB')}`;
    $('message').textContent='Review the text and confirm it contains only this complete advert. Expand any missing sections on the site before reading again.';
  }catch(error){if(token===generation)$('message').textContent=error instanceof Error&&/^(Open |Select |Several |One |Too |The |This |No )/.test(error.message)?error.message:'This page could not be read. Select or paste the complete advert instead.';}
  finally{$('read').disabled=false;}
});
$('check').addEventListener('click',()=>{
  const answer=analyseAdvert(advert.value,confirm.checked);
  $('verdict').textContent=answer.title;$('reason').textContent=answer.reason;
  $('evidence').replaceChildren(...answer.evidence.map(e=>{const quote=document.createElement('blockquote');quote.textContent=e.quote;return quote;}));
  result.dataset.status=answer.status;result.hidden=false;result.scrollIntoView({block:'start'});
});
$('clear').addEventListener('click',()=>{invalidate();advert.value='';$('source').textContent='';$('message').textContent='Cleared. Nothing was saved.';advert.focus();});
