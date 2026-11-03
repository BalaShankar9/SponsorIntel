import {jobIdentity,sameJob} from './identity.js';
import {isLeverHost,leverAdvertURL} from './lever.js';
const excluded='script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,.postings-btn-wrapper a,.last-section-apply a,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"],[data-si-notes]';
const excludedForIdentity='script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"],[data-si-notes]';
export const descriptionSelectors='#jobDescriptionText,.jobs-description__content,.jobs-description-content__text,[data-testid="job-description"],#job-description,.job-description,[itemprop="description"]';
export function visible(element) {
  return typeof element?.checkVisibility==='function' && !element.closest(excluded) && element.checkVisibility({opacityProperty:true,visibilityProperty:true,checkOpacity:true,checkVisibilityCSS:true});
}
export function nearViewport(element){const r=element.getBoundingClientRect();return r.bottom>=-innerHeight&&r.top<=innerHeight*2;}
export function readDescription(root) {
  if(!root || !visible(root))return {error:'The complete description is not visible. Open it or paste its public text.'};
  if([...root.querySelectorAll('details:not([open])')].some(visible))return {error:'Expand the closed sections before reading this advert.'};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node,count=0,length=0,last=null,text='';
  while((node=walker.nextNode())) {
    if(++count>12000)return {error:'This description is too complex to read completely. Paste one complete advert.'};
    if(!visible(node.parentElement))continue;
    const part=node.textContent.replace(/\s+/g,' ');if(!part.trim())continue;
    length+=part.length+1;if(length>100000)return {error:'This description is too long. No partial check was made.'};
    let block=node.parentElement;while(block!==root && getComputedStyle(block).display.startsWith('inline'))block=block.parentElement;
    if(last && block!==last)text+='\n';else text+=' ';
    text+=part;last=block;
  }
  if(text.trim().length<40)return {error:'Too little description is visible. Open the complete advert first.'};
  return {text:text.replace(/[ \t]+/g,' ').trim()};
}

function findLeverDescription(identity,pageURL) {
  const current=jobIdentity(pageURL);
  if(!leverAdvertURL(pageURL)||!current||(identity&&!sameJob(current,identity)))return null;
  const roots=[...document.querySelectorAll('.content-wrapper.posting-page > .content')].filter(visible);
  if(roots.length!==1)return null;
  const root=roots[0],sections=[...root.children];
  // Inspect the complete two-part posting, not the first paragraph or benefit.
  // A changed layout, catalogue or ambiguous title stays on selection/paste.
  if(sections.length!==2 || !sections[0].matches('.section-wrapper.accent-section') || !sections[1].matches('.section-wrapper:not(.accent-section)') || !sections.every(visible))return null;
  if(![...sections[1].querySelectorAll('.section')].some(visible))return null;
  const titles=[...root.querySelectorAll('.posting-headline > h2')].filter(visible);
  if(titles.length!==1||titles[0].textContent.trim().length<3||[...root.querySelectorAll('.posting')].some(visible))return null;
  const links=[...root.querySelectorAll('.postings-btn-wrapper a[href],.last-section-apply a[href]')].filter(a=>!a.closest(excludedForIdentity)&&a.checkVisibility({opacityProperty:true,visibilityProperty:true,checkOpacity:true,checkVisibilityCSS:true}));
  if(!links.length||links.some(a=>!sameJob(current,jobIdentity(leverAdvertURL(a.href,true)))))return null;
  return root;
}

export function findDescription(identity,pageURL=location.href) {
  let host;try{host=new URL(pageURL).hostname;}catch{return null;}
  if(isLeverHost(host))return findLeverDescription(identity,pageURL);
  const roots=[...document.querySelectorAll(descriptionSelectors)].filter(visible);
  // Nested descriptions are one region; distinct regions are never combined.
  const outer=roots.filter(r=>!roots.some(other=>other!==r&&other.contains(r)));
  if(outer.length!==1)return null;
  const root=outer[0];
  if(!identity)return root;
  const current=jobIdentity(pageURL);
  if(identity.provider==='original')return sameJob(current,identity)?root:null;
  const enclosing=root.closest('[data-job-id],[data-jobkey],[data-jk]');
  if(enclosing) {
    const id=enclosing.getAttribute('data-job-id')||enclosing.getAttribute('data-jobkey')||enclosing.getAttribute('data-jk');
    if(id!==identity.id)return null;
    return root;
  }
  // A split view's URL can change before its body does. Require an exact link
  // inside its details pane as well; otherwise ask the user to open/paste it.
  const pane=root.closest('.jobs-details,.jobs-search__job-details--container,.jobsearch-RightPane,[data-testid="jobsearch-RightPane"]');
  const links=pane?[...pane.querySelectorAll('a[href]')].filter(visible).map(a=>jobIdentity(a.href)).filter(Boolean):[];
  if(pane)return sameJob(current,identity)&&links.length>0&&links.every(link=>sameJob(link,identity))?root:null;
  const path=new URL(pageURL).pathname;
  const direct=identity.provider==='linkedin'?/\/jobs\/view\//.test(path):/\/viewjob\/?$/.test(path);
  return direct&&sameJob(current,identity)?root:null;
}

export function discoverCards(limit=100) {
  const found=[],seen=new Set();
  const anchors=document.querySelectorAll('a[href*="/jobs/"],a[href*="/job/"],a[href*="/viewjob"],a[href*="jk="],a[href*="/careers/"],a[href*="/positions/"],a[href*="/opportunities/"],a.posting-title[href]');
  let inspected=0;
  for(const anchor of anchors) {
    if(++inspected>1500||found.length>=limit)break;
    if(!visible(anchor)||!nearViewport(anchor))continue;
    const identity=jobIdentity(anchor.href);if(!identity)continue;
    const lever=Boolean(leverAdvertURL(anchor.href));
    const card=anchor.parentElement?.closest(lever?'.posting':'article,li,[data-job-id],[data-occludable-job-id],[data-jobkey],.job_seen_beacon,.job-card,.job-card-container,[data-testid="slider_item"]');
    if(!card||card.closest(excluded)||seen.has(card)||card.contains(document.querySelector(descriptionSelectors)))continue;
    const title=((lever?anchor.querySelector('h5')?.innerText:anchor.innerText)||'').trim().replace(/\s+/g,' ').slice(0,160);if(title.length<3)continue;
    seen.add(card);found.push({card,anchor,identity,title});
  }
  return found;
}
