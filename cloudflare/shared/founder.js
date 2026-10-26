// Curated 26 October 2026. A dated explanation, not a legal eligibility engine.
export const REVIEWED_AT='2026-10-26T12:16:42Z';
export const REVIEW_DUE='2026-11-02T00:00:00Z';
export const FORMAT='sponsor-intel-founder-workbook';
export const MAX_IMPORT_BYTES=300000;
export const sources={
  overview:{title:'GOV.UK: Innovator Founder overview and fees',url:'https://www.gov.uk/innovator-founder-visa'},
  eligibility:{title:'GOV.UK: eligibility and maintenance',url:'https://www.gov.uk/innovator-founder-visa/eligibility'},
  rules:{title:'Immigration Rules: Appendix Innovator Founder',url:'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-innovator-founder'},
  endorsers:{title:'GOV.UK: authorised endorsing bodies',url:'https://www.gov.uk/government/publications/endorsing-bodies-innovator-founder-and-scale-up-visas/innovator-founder-and-scale-up-visas-endorsing-bodies'},
  assessment:{title:'Home Office guidance for endorsing bodies',url:'https://www.gov.uk/government/publications/scale-up-and-innovator-founder-visa-endorsing-bodies-guidance/innovator-founder-and-scale-up-visas-guidance-for-endorsing-bodies-accessible'},
  documents:{title:'GOV.UK: documents you need',url:'https://www.gov.uk/innovator-founder-visa/documents-youll-need-to-apply'},
  ihs:{title:'GOV.UK: healthcare surcharge',url:'https://www.gov.uk/healthcare-immigration-application/how-much-pay'},
};
export const stages=[
  {id:'fit',number:'01',title:'Understand the route',time:'Before spending',summary:'Separate the immigration requirements from the business you want to build.',action:'Write down the questions you must resolve before paying for an endorsement.',source:'rules',fields:[
    {id:'fit_questions',label:'Questions to resolve',hint:'Check age 18+, English B2 or an exemption, your current permission and switching restrictions, maintenance and any dependants. Record questions for a regulated adviser; do not enter passport or bank details.'},
    {id:'founder_role',label:'Your role in the business',hint:'What will you personally create and run? Which skills and experience support that role, and what will you need to learn?'}],check:'I have recorded the route questions I need to resolve.'},
  {id:'validate',number:'02',title:'Find a real problem',time:'Research before a pitch',summary:'Test who needs your idea, what they use now and why they might change.',action:'Design one small test with a clear failure condition. Keep assumptions separate from evidence.',source:'assessment',fields:[
    {id:'customer_problem',label:'Customer and problem',hint:'Describe one specific customer group, the costly problem and its current workaround. Avoid names or personal interview data.'},
    {id:'validation',label:'Customer validation log',hint:'For each real test: date, method, number of participants, anonymised finding and what contradicted your idea. Planned interviews are not completed evidence.'},
    {id:'competitors',label:'Alternatives and competitors',hint:'Record named products, their original URLs, date checked, price if verified, strengths and gaps. Include doing nothing or a manual workaround.'}],check:'I have documented a validation test and what it did or did not establish.'},
  {id:'case',number:'03',title:'Build the business case',time:'Evidence over adjectives',summary:'Explain innovation, viability and scalability using facts someone else can inspect.',action:'Show the difference, the resources to deliver it and a realistic route to growth.',source:'assessment',fields:[
    {id:'innovation',label:'Innovation',hint:'What is materially different from the alternatives? What is central to the business and difficult to replicate? Link to actual evidence, not a claim that adding AI makes it innovative.'},
    {id:'viability',label:'Viability and founder skills',hint:'What can you deliver with your skills, team, time and funds? Identify gaps, a learning or hiring plan, dependencies and realistic risks.'},
    {id:'scalability',label:'Scalability',hint:'Explain repeatable delivery, routes to national/international growth and credible job creation. State assumptions and what must be proven first.'},
    {id:'finances',label:'Financial assumptions',hint:'Record prices, cost per sale, monthly operating costs, funding source and runway. Separate confirmed funds from hoped-for funding. Include a downside scenario.'}],check:'I have separated facts, assumptions and gaps in the three business criteria.'},
  {id:'endorsement',number:'04',title:'Prepare for endorsement',time:'Check the exact provider',summary:'Compare the authorised bodies and assemble a consistent business evidence pack.',action:'Use the current official list, then check the chosen body’s own requirements and terms.',source:'endorsers',fields:[
    {id:'endorser_questions',label:'Endorser comparison notes',hint:'What is its process, quoted fee and VAT position, review timing, refund policy and evidence requirement? A public application link does not confirm capacity or acceptance.'},
    {id:'pitch',label:'Pitch outline',hint:'Problem → customer evidence → solution → difference → market → business model → founder/team → finances → milestones → risks. Use only truthful evidence.'}],check:'I have checked my chosen provider and recorded the missing endorsement evidence.'},
  {id:'application',number:'05',title:'Prepare the visa documents',time:'After endorsement',summary:'Endorsement and the Home Office application are separate decisions.',action:'Check the official document list and personal circumstances. The Rules require an endorsement dated no more than three months before application and not withdrawn.',source:'documents',fields:[
    {id:'documents',label:'Document checklist notes',hint:'Endorsement, valid passport, English evidence, financial evidence if required, TB test if applicable and certified translations if needed. Record status only, not document numbers or uploads.'},
    {id:'application_questions',label:'Questions for qualified review',hint:'List switching, dependants, maintenance, suitability or other personal issues that require regulated advice. Do not store sensitive immigration history here.'}],check:'I have recorded which documents and personal questions still need review.'},
  {id:'milestones',number:'06',title:'Build and keep evidence',time:'After a successful application',summary:'Track business delivery, contact points and later route decisions as separate milestones.',action:'Retain evidence of real progress. Check current extension or settlement requirements well before permission ends.',source:'overview',fields:[
    {id:'milestones',label:'Milestone and evidence log',hint:'Record planned dates, actual results, business changes and source files you keep privately. GOV.UK describes contact meetings at 12 and 24 months. Later permission or settlement is not automatic.'},
    {id:'next_action',label:'Your next concrete action',hint:'Choose one action, a date and the evidence that would show it is complete. For example: test a prototype with three potential customers and record anonymised findings.'}],check:'I have planned the next milestone and the evidence I will retain.'},
];
export const directory=[
  {id:'ukes',name:'UK Endorsing Services',kind:'Endorser',region:'UK',role:'Listed for new Innovator Founder endorsements.',url:'https://www.ukesapp.co.uk/',proof:sources.endorsers.url,availability:'Provider site displayed a new-business application link when checked; capacity and decision time are unconfirmed.',cost:'Official route charge: £1,000 endorsement and at least two £500 meetings if the visa succeeds. Ask for the complete quote and VAT position.'},
  {id:'innovator-international',name:'Innovator International',kind:'Endorser',region:'UK',role:'Listed for new Innovator Founder endorsements.',url:'https://www.innovatorinternational.com/',proof:sources.endorsers.url,availability:'Provider site displayed an endorsement application route when checked; acceptance and capacity are unconfirmed.',cost:'Official route charge: £1,000 endorsement and at least two £500 meetings if the visa succeeds. Check any separate support costs and VAT.'},
  {id:'envestors',name:'Envestors Limited',kind:'Endorser',region:'UK',role:'Listed for new Innovator Founder endorsements.',url:'https://envestors-visa-endorsement.co.uk/',proof:sources.endorsers.url,availability:'Listed by GOV.UK. Provider intake details could not be verified in this review.',cost:'Official route charge: £1,000 endorsement and at least two £500 meetings if the visa succeeds. Confirm the complete provider quote.'},
  {id:'gep',name:'Global Entrepreneurs Programme',kind:'Invitation-only programme',region:'UK',role:'Authorised to endorse founders already invited to its programme; aimed at internationally mobile, tech-based entrepreneurs.',url:'https://www.business.gov.uk/invest-in-uk/expand-your-business-in-the-uk/',proof:sources.endorsers.url,availability:'Invitation required. A website enquiry is not an invitation or endorsement.',cost:'Programme-specific costs and terms are not established by this directory; ask the programme.'},
  {id:'wales',name:'Business Wales',kind:'Business support',region:'Wales',role:'Welsh Government support for aspiring entrepreneurs and businesses starting, running or growing in Wales.',url:'https://businesswales.gov.wales/business-wales-service',proof:'https://businesswales.gov.wales/business-wales-service',availability:'Online guidance and an adviser/helpline service. Individual eligibility, appointments and programme intake must be checked.',cost:'Check the exact service before committing. Not an endorsing-body listing.'},
  {id:'national-support',name:'Find business support in your nation',kind:'Business support',region:'UK',role:'Official signposts to England, Scotland, Wales and Northern Ireland support services.',url:'https://www.gov.uk/get-business-support',proof:'https://www.gov.uk/get-business-support',availability:'Public guidance and regional contact routes. Opening hours do not prove an available adviser.',cost:'The GOV.UK page identifies free advice; separately check any programme or paid service. Not visa advice or endorsement.'},
  {id:'innovate',name:'Innovate UK Business Growth',kind:'Business support',region:'England',role:'Funded specialist support for eligible innovative businesses, including commercialisation, markets and investment readiness.',url:'https://www.gov.uk/business-finance-support/innovate-uk-business-growth',proof:'https://www.gov.uk/business-finance-support/innovate-uk-business-growth',availability:'Eligibility and adviser capacity require confirmation. This page lists English regions and start-up/established business stages.',cost:'Funded support as described on the official page; not an automatic grant, investment or endorsement.'},
  {id:'advisers',name:'Find and check an immigration adviser',kind:'Regulator signpost',region:'UK',role:'GOV.UK signposts IAA-registered advisers and the relevant legal professional bodies. This is a search route, not a named adviser recommendation.',url:'https://www.gov.uk/find-an-immigration-adviser',proof:'https://www.gov.uk/guidance/information-for-advice-seekers',availability:'Check the individual’s current registration, permitted work, founder-route experience and capacity.',cost:'Fees vary. Agree the scope and total cost before instructing anyone; no rating or fee quote is supplied here.'},
];
export function reviewCurrent(now=Date.now()){return Number.isFinite(now)&&now>=Date.parse(REVIEWED_AT)&&now<Date.parse(REVIEW_DUE);}
export function feeIllustration(location,now=Date.now()){
  if(!reviewCurrent(now)||!['outside','inside'].includes(location))return null;
  const visa=location==='outside'?1357:1693;
  return {visa,ihs:3105,endorsement:1000,meetings:1000,total:visa+5105,maintenance:1270};
}
export function emptyWorkbook(){return {format:FORMAT,version:1,notes:Object.fromEntries(stages.flatMap(s=>s.fields.map(f=>[f.id,'']))),checks:[],shortlist:[],location:'outside'};}
export function hasWork(book){return Object.values(book.notes).some(v=>v.trim())||book.checks.length>0||book.shortlist.length>0||book.location!=='outside';}
export function parseWorkbook(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw Error('Choose a Sponsor Intel workbook smaller than 300 KB.');
  let d;try{d=JSON.parse(text);}catch{throw Error('This file is not valid workbook JSON.');}
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const base=emptyWorkbook(), keys=Object.keys(base.notes);
  if(!exact(d,Object.keys(base))||d.format!==FORMAT||d.version!==1||!exact(d.notes,keys)||!['inside','outside'].includes(d.location))throw Error('This workbook format or version is not supported. Existing work has not changed.');
  for(const k of keys){if(typeof d.notes[k]!=='string'||d.notes[k].length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(d.notes[k]))throw Error('A note is invalid or longer than 4,000 characters.');base.notes[k]=d.notes[k];}
  for(const [key,allowed]of [['checks',stages.map(s=>s.id)],['shortlist',directory.map(s=>s.id)]]){
    if(!Array.isArray(d[key])||d[key].length>allowed.length||new Set(d[key]).size!==d[key].length||!d[key].every(v=>typeof v==='string'&&allowed.includes(v)))throw Error('A checklist or directory selection is invalid.');base[key]=[...d[key]];
  }
  base.location=d.location;return base;
}
export function exportWorkbook(book){return JSON.stringify(parseWorkbook(JSON.stringify(book)),null,2);}
export function workbookReport(book,now=Date.now()){
  const b=parseWorkbook(JSON.stringify(book));
  return ['SPONSOR INTEL — FOUNDER PREPARATION PACK',`Export requested: ${new Date(now).toISOString()}`,'Private, self-authored preparation. Not endorsement, legal advice or eligibility approval.',`Guidance checked 26 October 2026; review due 2 November 2026. ${reviewCurrent(now)?'Within the dated review window.':'Review overdue or date uncertain; recheck official guidance.'}`,'Progress marks record your own preparation, not verified completion.',...stages.flatMap(s=>['',`${s.number} ${s.title}`,`Self-marked: ${b.checks.includes(s.id)?'prepared':'not marked'}`,...s.fields.flatMap(f=>[f.label,b.notes[f.id]||'[Not recorded]']),`Official reference: ${sources[s.source].url}`]),'','SHORTLIST',...directory.filter(d=>b.shortlist.includes(d.id)).flatMap(d=>[`${d.name} — ${d.kind}`,d.url,`Role evidence: ${d.proof}`]),'','FEE ASSUMPTION',`One adult; exactly three years; applying ${b.location} the UK. Use the live hub and official sources for current amounts. No fee amount is frozen into this pack.`,'','SOURCE LIBRARY',...Object.values(sources).map(s=>`${s.title}: ${s.url}`)].join('\n');
}
export function filterDirectory(query='',kind='All',region='All'){
  const q=query.trim().toLocaleLowerCase('en-GB').slice(0,100);
  return directory.filter(d=>(kind==='All'||d.kind===kind)&&(region==='All'||d.region===region)&&`${d.name} ${d.role} ${d.region}`.toLocaleLowerCase('en-GB').includes(q));
}
