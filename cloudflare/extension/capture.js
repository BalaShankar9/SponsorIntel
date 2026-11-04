// Passed to scripting.executeScript: everything it needs lives inside this function.
export function captureAdvert() {
  const MAX = 100000;
  const exclude = 'script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"]';
  if (!/^https?:$/.test(location.protocol)) return {error:'This page cannot be read. Paste the advert instead.'};
  // Box rectangles alone include fully transparent and collapsed content.
  // Older browsers must use paste rather than silently weaken this boundary.
  if (typeof document.documentElement.checkVisibility !== 'function') return {error:'This browser cannot safely check page visibility. Paste the complete public advert instead.'};
  const visible = e => e.checkVisibility({opacityProperty:true,checkOpacity:true,visibilityProperty:true,checkVisibilityCSS:true});
  const closedSections = e => [ ...(e.matches('details:not([open])')?[e]:[]), ...e.querySelectorAll('details:not([open])') ].filter(d=>!d.closest(exclude)&&visible(d));
  const selection = window.getSelection();
  let root, mode;
  if (selection && !selection.isCollapsed && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (ancestor?.closest(exclude) || [...(ancestor?.querySelectorAll('form,input,textarea,select,[contenteditable]') || [])].some(e => range.intersectsNode(e)))
      return {error:'Select advert text outside application fields, or paste the public advert instead.'};
    if (!ancestor || closedSections(ancestor).some(e=>range.intersectsNode(e))) return {error:'Expand the collapsed advert sections before selecting, or paste the complete public advert.'};
    const selectedNodes=document.createTreeWalker(ancestor,NodeFilter.SHOW_TEXT);
    let selectedNode,selectedSeen=0;
    while ((selectedNode=selectedNodes.nextNode())) {
      if (++selectedSeen>12000) return {error:'The selection is too complex to read completely. Paste one complete public advert.'};
      if (!selectedNode.textContent.trim() || !range.intersectsNode(selectedNode)) continue;
      const parent=selectedNode.parentElement;
      if (!parent || parent.closest(exclude) || !visible(parent)) return {error:'Select visible advert text outside hidden or application regions, or paste the complete public advert.'};
    }
    const text = selection.toString().trim();
    if (text.length > MAX) return {error:'The selection is too long. Select one complete advert.'};
    return {text, mode:'Selected text — check that it includes the complete advert', source:location.origin};
  }
  const selectors = ['#jobDescriptionText','.jobs-description__content','.jobs-description-content__text','[data-testid="job-description"]','#job-description','.job-description','[itemprop="description"]'];
  for (const selector of selectors) {
    const candidates = [...document.querySelectorAll(selector)].filter(e => !e.closest(exclude) && visible(e));
    if (candidates.length > 1) return {error:'Several advert sections were found. Select one complete advert, or paste it below.'};
    if (candidates.length === 1) {root=candidates[0];mode='Detected advert section';break;}
  }
  if (!root) {
    const mains=[...document.querySelectorAll('main,[role="main"]')].filter(e=>!e.closest(exclude)&&visible(e));
    if (mains.length !== 1) return {error:'One advert section could not be isolated. Select the complete advert on the page, then try again, or paste it below.'};
    root=mains[0];mode='Main page text — may include other roles; review before checking';
  }
  if (closedSections(root).length) return {error:'Expand the collapsed advert sections before reading, or paste the complete public advert.'};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const chunks=[];let length=0,seen=0,node;
  while ((node=walker.nextNode())) {
    if (++seen>12000) return {error:'The page is too complex to read completely. Select or paste one complete advert.'};
    const parent=node.parentElement;
    if (!parent || parent.closest(exclude) || !visible(parent)) continue;
    const text=node.textContent.replace(/\s+/g,' ');
    if (!text.trim()) continue;
    length+=text.length+1;
    if (length>MAX) return {error:'This section is too long. Select or paste one complete advert; no partial check was made.'};
    // Preserve inline fragments as one sentence; block boundaries separate paragraphs.
    chunks.push({text,parent});
  }
  const block=e=>{while(e&&e!==root&&getComputedStyle(e).display.startsWith('inline'))e=e.parentElement;return e;};
  let last=null,text='';
  for (const chunk of chunks) {const current=block(chunk.parent);text+=(last&&last!==current?'\n':' ')+chunk.text;last=current;}
  if (text.trim().length<40) return {error:'Too little readable text. Expand the full job description, or paste the advert.'};
  return {text:text.replace(/[ \t]+/g,' ').trim(),mode,source:location.origin};
}
