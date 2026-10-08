import {parseDocument} from 'htmlparser2';
import {sponsorshipEvidence} from './jobs.js';

export const TEACHING_ORIGIN='https://teaching-vacancies.service.gov.uk';
export const TEACHING_QUOTE='Skilled Worker visas can be sponsored';
export const TEACHING_TERMS=TEACHING_ORIGIN+'/pages/terms-and-conditions#terms-and-conditions-for-api-users';
export const TEACHING_ATTRIBUTION='Contains Department for Education Teaching Vacancies listing information licensed under the Open Government Licence v3.0. Advertiser claims require review.';
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const text=node=>node.type==='text'?node.data:['script','style','noscript','template'].includes(node.name)?'':(node.children||[]).map(text).join(' ');
const find=(node,test)=>[...(test(node)?[node]:[]),...(node.children||[]).flatMap(n=>find(n,test))];
const hasClass=(node,name)=>node.attribs?.class?.split(/\s+/).includes(name);
const fail=reason=>{throw Object.assign(Error(reason),{reason});};
const bound=(s,max)=>typeof s==='string'&&norm(s).length>0&&norm(s).length<=max?norm(s):null;

export function teachingJobURL(value){
 try{const u=new URL(value,TEACHING_ORIGIN);return u.origin===TEACHING_ORIGIN&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/jobs\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(u.pathname)&&u.pathname.length<=250?u.href:null;}catch{return null;}
}
export function teachingSearchURL(page=1){
 if(![1,2].includes(page))throw Error('Search page outside allowance');
 return TEACHING_ORIGIN+'/jobs?visa_sponsorship_availability%5B%5D=true&sort_by=publish_on'+(page===2?'&page=2':'');
}
function visaRows(node){
 return find(node,n=>hasClass(n,'govuk-summary-list__row')).flatMap(row=>{
  const keys=find(row,n=>n.name==='dt'),values=find(row,n=>n.name==='dd');
  return keys.length===1&&norm(text(keys[0]))==='Visa sponsorship'&&values.length===1?[norm(text(values[0]))]:[];
 });
}
export function parseTeachingSearch(html){
 // The service renders nested sort forms; HTML parsers may close the surrounding
 // #search-results early. Scope adverts to its separately named results list.
 const doc=parseDocument(html),root=find(doc,n=>hasClass(n,'search-results'));
 if(root.length!==1||find(doc,n=>n.attribs?.id==='search-results').length!==1)fail('search_layout_changed');
 const candidates=[];
 for(const item of find(root[0],n=>hasClass(n,'search-results__item'))){
  const visas=visaRows(item),links=find(item,n=>n.name==='a'&&hasClass(n,'view-vacancy-link'));
  if(visas.length!==1||visas[0]!==TEACHING_QUOTE||links.length!==1)continue;
  const url=teachingJobURL(links[0].attribs.href),title=bound(text(links[0]),180);
  if(url&&title&&!candidates.some(c=>c.url===url))candidates.push({url,title});
 }
 // Follow only the explicitly allowed second search page, never arbitrary page links.
 const next=find(doc,n=>n.name==='a'&&hasClass(n,'govuk-pagination__link')).some(n=>{
  try{const u=new URL(n.attribs.href,TEACHING_ORIGIN);return u.href===teachingSearchURL(2);}catch{return false;}
 });
 return {candidates:candidates.slice(0,20),next};
}
export function parseTeachingAdvert(html,candidate,now=Date.now()){
 const url=teachingJobURL(candidate.url);if(!url)fail('advert_identity_changed');
 const doc=parseDocument(html),sections=find(doc,n=>n.attribs?.id==='job-details'),heads=find(doc,n=>n.name==='h1');
 if(sections.length!==1||heads.length!==1)fail('advert_layout_changed');
 const visas=visaRows(sections[0]);if(visas.length!==1||visas[0]!==TEACHING_QUOTE)fail('sponsorship_not_confirmed');
 const scripts=find(doc,n=>n.name==='script'&&n.attribs?.type==='application/ld+json');
 const postings=scripts.flatMap(node=>{try{const j=JSON.parse((node.children||[]).map(n=>n.data||'').join(''));return j?.['@type']==='JobPosting'?[j]:[];}catch{return [];}});
 if(postings.length!==1)fail('advert_metadata_changed');
 const j=postings[0],title=bound(j.title,180),employer=bound(j.hiringOrganization?.name,160),address=j.jobLocation?.address;
 if(!title||!employer||norm(text(heads[0]))!==title||norm(candidate.title)!==title||teachingJobURL(j.url)!==url||address?.addressCountry!=='GB')fail('advert_identity_changed');
 const closes=Date.parse(j.validThrough),posted=j.datePosted;
 if(typeof j.validThrough!=='string'||!/T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(j.validThrough)||!Number.isFinite(closes)||closes<=now)fail('advert_closed_or_deadline_unknown');
 if(typeof posted!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(posted)||!Number.isFinite(Date.parse(posted))||new Date(posted).toISOString().slice(0,10)!==posted||posted>new Date(now).toISOString().slice(0,10))fail('advert_posting_date_unknown');
 const body=norm(text(sections[0]));
 if(/\b(?:this (?:job|role|position|vacancy) (?:is no longer available|has (?:now )?closed|has been (?:filled|removed))|applications (?:for this (?:role|position|vacancy) )?are (?:now )?closed|no longer accepting applications)\b/i.test(body))fail('advert_closed_or_deadline_unknown');
 if(sponsorshipEvidence(body).status==='unavailable')fail('contradictory_sponsorship_wording');
 const location=[address.addressLocality,address.addressRegion,address.postalCode].filter(v=>typeof v==='string'&&v.trim()).map(norm).join(', ');
 if(!location||location.length>160)fail('advert_identity_changed');
 return {title,employer,location,observed_at:new Date(now).toISOString(),posted_at:null,
  posted_evidence:`Teaching Vacancies datePosted: ${posted}. Publication time is not supplied.`,
  deadline:new Date(closes).toISOString(),deadline_evidence:`Teaching Vacancies validThrough: ${j.validThrough}`,
  original_url:url,identity_url:'',identity_note:'The hiring organisation is named on the Teaching Vacancies advert. Its legal employer, external application destination and sponsor-register identity have not been reviewed.',
  quote:TEACHING_QUOTE,state:'pending',reason:'Automatically found in the Department for Education Teaching Vacancies sponsorship search. The individual advert names this employer and states that Skilled Worker visas can be sponsored. Review the full original application route, employer identity and any role-specific restrictions before publication.',
  follow_up_at:new Date(Math.min(now+3*86400000,closes)).toISOString(),job_id:null,duplicate_of:null,method:'automated_source'};
}
