import {analyseAdvert} from '../extension/analyse.js';
import {captureAdvert} from '../extension/capture.js';
import {jobIdentity,sameJob,nextStep} from './identity.js';
import {isLeverHost} from './lever.js';
import {discoverCards,findDescription,readDescription,nearViewport} from './read.js';
import styleText from './theme.css';
import {createJobNote} from '../shared/job-note.js';

// Bundled as a local isolated-world script. Injected only by the toolbar action.
// No page text goes to runtime messaging, storage, an account or a network.
const slot='__sponsorIntelJobNotes_v020';
if(window[slot])window[slot].stop();
else if(/^https?:$/.test(location.protocol))start();

function start(){
  let stopped=false,timer=null,selected=null,snapshot=null,returnFocus=null,lastHref=location.href,generation=0;
  const markers=new Map(),hosts=new Set();
  const host=document.createElement('div');host.dataset.siNotes='panel';
  host.style.setProperty('position','fixed','important');host.style.setProperty('z-index','2147483646','important');
  host.style.setProperty('inset','0','important');host.style.setProperty('pointer-events','none','important');
  const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');style.textContent=styleText+' .dock,.panel{pointer-events:auto}';shadow.append(style);
  const shell=document.createElement('div');
  // All variable/page content is assigned with textContent/value below.
  shell.innerHTML=`<div class="dock"><button id="open" aria-label="Open Sponsor Intel job notes">Sponsor Intel · Job notes</button><button id="stop">Off</button></div>
  <section class="panel" id="panel" aria-label="Sponsor Intel job notes" hidden><header class="masthead"><div><span class="wordmark">Sponsor Intel</span><span class="edition">Job notes / browsing companion</span></div><button class="close" id="close" aria-label="Close job notes">×</button></header><div class="body">
  <p class="kicker">A closer reading</p><h1 id="title" tabindex="-1">One advert. The useful details.</h1><p class="muted origin" id="origin"></p><p class="message" id="message" role="status"></p>
  <div class="toolbar"><button class="primary" id="read">Read full description</button><a class="secondary" id="original" target="_blank" rel="noopener noreferrer" hidden>Open this job ↗</a></div>
  <details class="editor" id="editor" open><summary>Review the full advert</summary><label for="text">The advert you are checking</label><textarea id="text" rows="6" maxlength="100001" spellcheck="false" placeholder="Or paste the complete public advert here. Leave out CVs and application answers."></textarea><p class="small" id="provenance"></p>
  <label class="confirm"><input type="checkbox" id="confirm"><span>I have checked this is the complete advert for the role above, including its conditions.</span></label><div class="toolbar"><button class="primary" id="check">Read the wording</button><button class="secondary" id="clear">Clear</button></div></details>
  <section class="result" id="result" aria-live="polite" hidden><span class="status" id="status"></span><h2 id="verdict" tabindex="-1"></h2><p class="muted" id="reason"></p><div class="quotes" id="quotes"></div><div class="rule"><span class="number">01</span><div><h3>Your next check</h3><p id="next"></p></div></div></section>
  <div class="rule"><span class="number">02</span><div><h3>Sponsor licence</h3><p>Not checked here. The exact legal employer needs a current register match. A trading name or licence alone does not confirm sponsorship for this job.</p></div></div>
  <div class="rule"><span class="number">03</span><div><h3>Vacancy & personal eligibility</h3><p>Not verified. Check the employer’s original advert, closing date and your circumstances before applying.</p></div></div>
  <details class="handoff"><summary>Take this role to your workspace</summary><p class="muted">Prepare a Job notes file with this public advert, original link and wording evidence. Import and review it in Sponsor Intel before creating documents. This does not save to your account or apply.</p><label for="job-title">Job title<input id="job-title" maxlength="240"></label><label for="company">Employer, if known<input id="company" maxlength="200"></label><label for="job-location">Location, if known<input id="job-location" maxlength="300"></label><label for="source-url">Public advert link<input id="source-url" type="url" maxlength="2000"></label><button class="secondary" id="export">Download job notes</button><p class="small" id="handoff-message" role="status">Workspace import is prepared for the next website release; it is not live yet. Keep the file until that release is verified.</p></details>
  <footer class="foot"><details><summary>How these notes work</summary><p>Only this tab is enabled. Small job markers appear as the page changes; descriptions are read when you ask. This is a local wording check, not a complete reading of every site.</p><p>No automatic upload or saving. Closing the notes clears the advert. Off removes the companion. Download job notes creates a file only when you choose it. Reloading or leaving the page requires enabling it again. Do not paste private information.</p></details><a href="https://sponsorintel.london/browser-extension" target="_blank" rel="noopener noreferrer">Sponsor Intel / help & current release ↗</a></footer></div></section>`;
  shadow.append(shell);document.documentElement.append(host);hosts.add(host);
  const $=id=>shadow.getElementById(id),panel=$('panel');
  function clear(message='Cleared from this panel. Any downloaded files are unchanged.'){
    generation++;snapshot=null;$('text').value='';$('confirm').checked=false;$('result').hidden=true;$('quotes').replaceChildren();$('provenance').textContent='';$('message').textContent=message;$('editor').open=true;
  }
  function close(){panel.hidden=true;clear();selected=null;returnFocus?.isConnected&&returnFocus.focus();}
  function open(item=null,focusTarget=null){
    selected=item;returnFocus=focusTarget;clear();panel.hidden=false;
    $('title').textContent=item?.title||'One advert. The useful details.';
    $('origin').textContent=location.hostname+' · enabled in this tab';
    $('original').hidden=!item;
    if(item)$('original').href=item.identity.url;else $('original').removeAttribute('href');
    $('job-title').value=item?.title||'';$('company').value='';$('job-location').value='';$('source-url').value=item?.identity.url||location.href;
    $('message').textContent=item?'A card is a preview. Open its complete description, then read it here. We will check the job identity before using a split-view description.':'Read the complete advert on this page, or paste its public text. Nothing has been classified yet.';
    $('title').focus();
  }
  function selectionStillMatches(){
    return !selected || (selected.card.isConnected && sameJob(jobIdentity(selected.anchor.href),selected.identity));
  }
  function invalidateSource(){
    clear('The page or selected job changed. Read the complete advert again before checking.');
  }
  function ensureFresh(){
    if(!selectionStillMatches() || location.href!==lastHref){invalidateSource();return false;}
    if(snapshot){
      const root=findDescription(selected?.identity);
      const current=root?readDescription(root):captureAdvert();
      if(root!==snapshot.root || current.error || current.text!==snapshot.text){invalidateSource();return false;}
    }
    return true;
  }
  $('read').onclick=()=>{
    clear();
    if(!selectionStillMatches()){invalidateSource();return;}
    const root=findDescription(selected?.identity);
    if(selected&&!root){$('message').textContent='This visible description cannot be matched to the selected job. Open that job’s full page, enable Job notes there, or paste its complete advert. No other role was read.';return;}
    if(!root&&isLeverHost(location.hostname)&&(!window.getSelection()||window.getSelection().isCollapsed)){$('message').textContent='This employer page could not be matched to one complete advert. Open the exact job, select its complete public text, or paste it here. No application form or catalogue was read.';return;}
    const data=root?readDescription(root):captureAdvert();
    if(data.error){$('message').textContent=data.error;return;}
    snapshot={root,text:data.text,observedAt:new Date().toISOString()};lastHref=location.href;$('text').value=data.text;
    $('provenance').textContent=location.hostname+' · read at '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+' · '+(selected?'matching job description':'page text; review its scope');
    $('message').textContent='Read the text below. Expand any missing sections on the website before checking.';
  };
  $('text').oninput=()=>{generation++;snapshot=null;$('result').hidden=true;$('confirm').checked=false;$('quotes').replaceChildren();$('provenance').textContent='Pasted or edited text · its job identity has not been verified.';};
  $('confirm').onchange=()=>{generation++;$('result').hidden=true;};
  $('check').onclick=()=>{
    if(!ensureFresh())return;
    const answer=analyseAdvert($('text').value,$('confirm').checked);
    $('result').dataset.status=answer.status;$('status').textContent=({offered:'Offered wording',conditional:'Conditions apply',unavailable:'Refused wording',unclear:'Not established'})[answer.status];
    $('verdict').textContent=answer.title;$('reason').textContent=answer.reason;
    $('quotes').replaceChildren(...answer.evidence.map(e=>{const q=document.createElement('blockquote');q.textContent=e.quote;return q;}));
    $('next').textContent=nextStep(answer.status);$('result').hidden=false;
    if($('confirm').checked&&$('text').value.trim().length>=40){$('editor').open=false;$('message').textContent='Notes from the advert you reviewed. Expand Review the full advert to inspect or edit the source text.';$('verdict').focus();panel.scrollTop=0;}
    else $('result').scrollIntoView({block:'nearest',behavior:'auto'});
  };
  $('clear').onclick=()=>{clear();$('text').focus();};$('close').onclick=close;$('open').onclick=()=>open();$('stop').onclick=stop;
  for(const id of ['job-title','company','job-location','source-url'])$(id).addEventListener('input',()=>generation++);
  $('export').onclick=async()=>{
    if(!ensureFresh())return;
    const token=generation;$('export').disabled=true;
    try{
      const packet=await createJobNote({text:$('text').value,confirmed:$('confirm').checked,url:$('source-url').value,title:$('job-title').value,company:$('company').value,location:$('job-location').value,observedAt:snapshot?.observedAt});
      if(stopped||token!==generation||!ensureFresh())return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sponsor-intel-job-notes.json';shadow.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      $('handoff-message').textContent='Download requested. Check your saved file. Nothing was sent to your profile or to an employer. Import it after the workspace-import release is available.';
    }catch(error){$('handoff-message').textContent=error.message;}
    finally{$('export').disabled=false;}
  };
  shadow.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.stopPropagation();close();}});
  function makeMarker(item){
    const badge=document.createElement('span');badge.dataset.siNotes='marker';const root=badge.attachShadow({mode:'closed'}),s=document.createElement('style');s.textContent=styleText;
    const button=document.createElement('button');button.className='marker';button.type='button';button.textContent='Sponsorship notes';button.setAttribute('aria-label',`Sponsorship notes for ${item.title}`);
    button.onclick=event=>{event.preventDefault();event.stopPropagation();open(item,button);};root.append(s,button);item.card.append(badge);markers.set(item.card,{badge,item});hosts.add(badge);
  }
  function scan(){
    timer=null;if(stopped)return;
    if(location.href!==lastHref){lastHref=location.href;if(!panel.hidden)invalidateSource();}
    if(!panel.hidden)ensureFresh();
    for(const [card,entry] of markers){if(!card.isConnected||!nearViewport(card)||!sameJob(jobIdentity(entry.item.anchor.href),entry.item.identity)){entry.badge.remove();hosts.delete(entry.badge);markers.delete(card);}}
    for(const item of discoverCards()){if(markers.size>=100)break;if(!markers.has(item.card))makeMarker(item);}
  }
  function schedule(records){
    if(records?.length&&records.every(r=>r.target.nodeType===1&&r.target.closest('[data-si-notes]')))return;
    if(!timer&&!stopped)timer=setTimeout(scan,350);
  }
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','data-job-id','data-jobkey','data-jk','open','hidden','aria-hidden','class','style']});
  const onScroll=()=>schedule();window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('popstate',onScroll);window.addEventListener('pagehide',stop);
  function stop(){if(stopped)return;stopped=true;observer.disconnect();clearTimeout(timer);window.removeEventListener('scroll',onScroll);window.removeEventListener('popstate',onScroll);window.removeEventListener('pagehide',stop);clear();for(const node of hosts)node.remove();markers.clear();hosts.clear();delete window[slot];}
  window[slot]={stop};scan();
}
