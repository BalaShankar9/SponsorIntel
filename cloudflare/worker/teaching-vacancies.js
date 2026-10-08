import {parseDocument} from 'htmlparser2';
import {boundedText} from './data.js';
import {SourceCheckError,withSourceContext} from './source-errors.js';
import {TEACHING_ORIGIN,TEACHING_QUOTE,TEACHING_UNAVAILABLE,teachingJobURL,teachingBoardIdentity} from './teaching-source.js';

export const TEACHING_REQUEST_COST=24; // two catalogues of <=2 pages and <=20 original adverts
const maxJobs=20,norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const find=(n,f)=>[...(f(n)?[n]:[]),...(n.children||[]).flatMap(c=>find(c,f))];
const hasClass=(n,c)=>n.attribs?.class?.split(/\s+/).includes(c);
const visible=n=>n.type==='text'?n.data:['script','style','noscript','template'].includes(n.name)?'':(n.children||[]).map(visible).join(['p','div','li','section','dl','dt','dd','h1','h2','h3','br'].includes(n.name)?'\n':' ');
const fail=code=>{throw new SourceCheckError(code);};
function config(board){try{return teachingBoardIdentity(board);}catch{throw new SourceCheckError('unreviewed_source',{phase:'configuration'});}}
function visa(node){
 const values=find(node,n=>hasClass(n,'govuk-summary-list__row')).flatMap(r=>{
  const k=find(r,n=>n.name==='dt'),v=find(r,n=>n.name==='dd');return k.length===1&&norm(visible(k[0]))==='Visa sponsorship'&&v.length===1?[norm(visible(v[0]))]:[];
 });
 if(values.length!==1||![TEACHING_QUOTE,TEACHING_UNAVAILABLE].includes(values[0]))fail('invalid_sections');return values[0];
}
export function parseTeachingCatalogue(html,board,page=1){
 const c=config(board),doc=parseDocument(html),heads=find(doc,n=>n.name==='h1'),filters=find(doc,n=>n.name==='input'&&n.attribs?.name==='organisation_slug');
 const count=heads.length===1&&norm(visible(heads[0])).match(/^Jobs \(([\d,]+)\)$/);
 if(!count||filters.length!==1||filters[0].attribs.value!==c.slug)fail('incomplete_catalogue');
 const total=Number(count[1].replaceAll(',',''));if(!Number.isSafeInteger(total)||total<0||total>maxJobs)fail('collection_limit');
 const lists=find(doc,n=>hasClass(n,'search-results'));
 if(total&&lists.length!==1||!total&&lists.length>1)fail('incomplete_catalogue');
 const cards=lists.flatMap(n=>find(n,x=>hasClass(x,'search-results__item'))),rows=[];
 if(cards.length!==Math.min(10,Math.max(0,total-(page-1)*10)))fail('incomplete_catalogue');
 for(const card of cards){
  const links=find(card,n=>n.name==='a'&&hasClass(n,'view-vacancy-link'));if(links.length!==1)fail('posting_identity');
  const link=links[0],url=teachingJobURL(link.attribs.href),id=link.attribs['data-link-subject'],title=norm(visible(link));
  if(!url||!uuid(id)||!title||title.length>240)fail('posting_identity');
  if(rows.some(r=>r.id===id||r.url===url))fail('duplicate_posting');
  rows.push({id,url,title,visa:visa(card)});
 }
 const next=find(doc,n=>n.name==='a'&&hasClass(n,'govuk-pagination__link')&&n.parent?.attribs?.class?.includes('govuk-pagination__next'));
 if(total>page*10){
  if(next.length!==1)fail('incomplete_catalogue');
  const expected=c.search+'&page='+(page+1);let actual;try{actual=new URL(next[0].attribs.href,TEACHING_ORIGIN).href;}catch{fail('invalid_destination');}
  if(actual!==expected)fail('invalid_destination');
 }else if(next.length)fail('incomplete_catalogue');
 return {total,rows};
}
export function parseTeachingVacancy(html,board,expected,now=Date.now()){
 const c=config(board),url=teachingJobURL(expected.url);if(!url)fail('invalid_destination');
 const doc=parseDocument(html),sections=find(doc,n=>n.attribs?.id==='job-details'),heads=find(doc,n=>n.name==='h1');
 const scripts=find(doc,n=>n.name==='script'&&n.attribs?.type==='application/ld+json');
 const jobs=scripts.flatMap(n=>{try{const j=JSON.parse((n.children||[]).map(x=>x.data||'').join(''));return j?.['@type']==='JobPosting'?[j]:[];}catch{return [];}});
 if(sections.length!==1||heads.length!==1||jobs.length!==1)fail('invalid_sections');
 const j=jobs[0],title=norm(j.title),org=j.hiringOrganization,address=j.jobLocation?.address;
 const ids=[...new Set(find(doc,n=>n.name==='input'&&n.attribs?.name==='vacancy_id').map(n=>n.attribs.value))];
 if(ids.length!==1||!uuid(ids[0])||expected.id&&expected.id!==ids[0]||!title||title.length>240||norm(visible(heads[0]))!==title||expected.title&&expected.title!==title||teachingJobURL(j.url)!==url||org?.identifier!==c.urn||norm(org?.name)!==norm(c.company)||address?.addressCountry!=='GB')fail('posting_identity');
 const quote=visa(sections[0]);if(expected.visa&&quote!==expected.visa)fail('posting_changed');
 const publication=j.datePosted,closing=j.validThrough;
 if(typeof publication!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(publication)||!Number.isFinite(Date.parse(publication))||new Date(publication).toISOString().slice(0,10)!==publication||publication>new Date(now).toISOString().slice(0,10)||typeof closing!=='string'||!/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(closing)||!Number.isFinite(Date.parse(closing)))fail('posting_identity');
 // Full visible role section includes pay, qualifications, benefits, additional
 // restrictions and application instructions. Related roles and school contact
 // panels outside this section cannot contribute sponsorship wording.
 const description=visible(sections[0]).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
 if(!description||description.length>80000)fail('oversized_advert');
 if(/\b(?:this (?:job|role|position|vacancy) (?:is no longer available|has (?:now )?closed|has been (?:filled|removed))|applications (?:for this (?:role|position|vacancy) )?are (?:now )?closed|no longer accepting applications)\b/i.test(description)&&Date.parse(closing)>now)fail('posting_changed');
 const location=[address.addressLocality,address.addressRegion,address.postalCode,'United Kingdom'].filter(v=>typeof v==='string'&&v.trim()).map(norm).join(', ');
 if(location.length>300||!address.addressLocality)fail('posting_identity');
 const employment=typeof j.employmentType==='string'?j.employmentType:Array.isArray(j.employmentType)&&j.employmentType.every(x=>typeof x==='string')?j.employmentType.join(', '):'';
 return {id:ids[0],title,location,country:'GB',visa_wording:quote,descriptionPlain:description,absolute_url:url,application_deadline:closing,publishedAt:publication,employmentType:employment,description_checked_at:new Date(now).toISOString()};
}
async function read(url,fetcher,remaining=12000){
 let response;try{response=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(Math.max(1,Math.min(12000,remaining))),headers:{Accept:'text/html',Referer:'https://sponsorintel.london/','User-Agent':'SponsorIntel-EmployerFeed/1.0 (+https://sponsorintel.london/about)'}});}catch(error){throw new SourceCheckError(error?.name==='TimeoutError'||error?.name==='AbortError'?'request_timeout':'request_failed');}
 if(response.status!==200){await response.body?.cancel();throw new SourceCheckError(response.status>=300&&response.status<400?'redirected':'http_error',{http_status:response.status});}
 if(!/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type')||'')){await response.body?.cancel();fail('invalid_payload');}
 try{return await boundedText(response,700000);}catch(error){throw new SourceCheckError(error?.message==='Source exceeds permitted size'?'oversized_payload':'request_failed');}
}
export async function fetchTeachingVacancy(board,expected,{fetcher=fetch,now=Date.now()}={}){
 config(board);const url=teachingJobURL(expected.url);if(!url)fail('invalid_destination');return parseTeachingVacancy(await read(url,fetcher),board,expected,now);
}
export async function collectTeachingVacancies(board,{DB,leaseOwner,readOnlyProbe=false,fetcher=fetch,now=Date.now()}={}){
 const c=config(board);if(!readOnlyProbe&&(!DB||!leaseOwner))throw new SourceCheckError('lease_ended',{phase:'configuration'});
 const started=Date.now(),deadline=started+75000;let requests=0;
 async function fetchHTML(url){
  if(requests>=TEACHING_REQUEST_COST||Date.now()>=deadline)fail('collection_limit');
  if(DB){const lease=await DB.prepare("SELECT owner FROM feed_locks WHERE name='jobs' AND owner=? AND expires>? AND NOT EXISTS(SELECT 1 FROM agent_source_controls WHERE source_id=? AND paused=1)").bind(leaseOwner,Date.now()+1000,board.id).first();if(!lease)fail('lease_ended');}
  requests++;return read(url,fetcher,deadline-Date.now());
 }
 async function catalogue(){
  let total;const rows=[];
  try{for(let page=1;page<=2;page++){
   const parsed=parseTeachingCatalogue(await fetchHTML(c.search+(page===1?'':'&page='+page)),board,page);
   if(total!==undefined&&total!==parsed.total)fail('posting_changed');total=parsed.total;
   for(const row of parsed.rows){if(rows.some(r=>r.id===row.id||r.url===row.url))fail('duplicate_posting');rows.push(row);}
   if(rows.length===total)break;
  }if(rows.length!==total)fail('incomplete_catalogue');return rows;}catch(error){throw withSourceContext(error,{phase:'catalogue',requests});}
 }
 const first=await catalogue(),raw=[];
 for(const row of first){try{raw.push(parseTeachingVacancy(await fetchHTML(row.url),board,row,now));}catch(error){throw withSourceContext(error,{phase:'description',requests});}}
 const second=await catalogue(),stable=rows=>JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
 if(stable(first)!==stable(second))throw new SourceCheckError('posting_changed',{phase:'catalogue',requests});
 return {raw,review:{provider:'teaching-vacancies',school_urn:c.urn,organisation_slug:c.slug,advert_count:raw.length,requests,checked_at:new Date(now).toISOString(),full_catalogue_checked:true}};
}
