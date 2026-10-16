import {TEACHING_ORIGIN,TEACHING_QUOTE,teachingSearchURL} from '../../worker/teaching-discovery.js';
export const candidate=n=>({url:TEACHING_ORIGIN+'/jobs/fictional-teacher-'+n,title:'Fictional teacher '+n});
const row=quote=>`<div class="govuk-summary-list__row"><dt>Visa sponsorship</dt><dd>${quote}</dd></div>`;
export function search(candidates=[candidate(1),candidate(2)],next=false){
 return `<form><div id="search-results"><div><form><select><option>Newest job</option></select></form></div><div class="search-results">${candidates.map(c=>`<div class="search-results__item"><a class="govuk-link view-vacancy-link" href="${c.url}">${c.title}</a><dl>${row(TEACHING_QUOTE)}</dl></div>`).join('')}</div></div></form>${next?`<a class="govuk-pagination__link" href="${teachingSearchURL(2).replaceAll('&','&amp;')}">Next page</a>`:''}`;
}
export function advert(c=candidate(1),now=Date.now(),patch={},quote=TEACHING_QUOTE,body='A fictional teaching role. No real applicant data.'){
 const data={'@type':'JobPosting',title:c.title,url:c.url,datePosted:new Date(now).toISOString().slice(0,10),validThrough:new Date(now+5*86400000).toISOString().replace('.000Z','Z'),hiringOrganization:{name:'Fictional school '+c.url.split('-').at(-1),identifier:String(123450+Number(c.url.split('-').at(-1)))},jobLocation:{address:{addressCountry:'GB',addressLocality:'Cardiff',addressRegion:'Wales',postalCode:'CF10 1AA'}},...patch};
 return `<h1>${data.title}</h1><section id="job-details"><dl>${row(quote)}</dl><p>${body}</p></section><script type="application/ld+json">${JSON.stringify(data)}</script>`;
}
export function provider(now=Date.now(),{first=[candidate(1),candidate(2)],second=[],pages={},mutate}={}){
 const calls=[];return {calls,fetch:async(url,options={})=>{calls.push({url:String(url),redirect:options.redirect});if(mutate)await mutate(url,options,calls.length);const body=pages[url]??(url===teachingSearchURL(1)?search(first,!!second.length):url===teachingSearchURL(2)?search(second):advert([...first,...second].find(c=>c.url===url),now));return new Response(body,{headers:{'Content-Type':'text/html'}});}};
}
