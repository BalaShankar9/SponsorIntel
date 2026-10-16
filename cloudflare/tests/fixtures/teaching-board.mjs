import {TEACHING_ORIGIN,TEACHING_QUOTE,TEACHING_UNAVAILABLE,teachingBoardIdentity} from '../../worker/teaching-source.js';
export const school={id:'reviewed-teaching-vacancies-123456--fictional-school',company:'Fictional School',provider:'teaching-vacancies',board:'123456--fictional-school',sector:'education',careers:'https://fictional.example/careers',sponsor_id:'0123456789abcdef01234567',evidence:'Fictional reviewed school and legal trust relationship.'};
export const vacancy=n=>({id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),url:TEACHING_ORIGIN+'/jobs/fictional-teacher-'+n,title:'Fictional teacher '+n,visa:n%2?TEACHING_QUOTE:TEACHING_UNAVAILABLE});
const visa=v=>`<div class="govuk-summary-list__row"><dt>Visa sponsorship</dt><dd>${v}</dd></div>`;
export function catalogue(rows,page=1){return `<h1>Jobs (${rows.length})</h1><input name="organisation_slug" value="fictional-school"><form><div id="search-results"><form></form><div class="search-results">${rows.slice((page-1)*10,page*10).map(r=>`<div class="search-results__item"><a class="view-vacancy-link" href="${r.url}" data-link-subject="${r.id}">${r.title}</a><dl>${visa(r.visa)}</dl></div>`).join('')}</div></div></form>${rows.length>page*10?`<div class="govuk-pagination__next"><a class="govuk-pagination__link" href="${teachingBoardIdentity(school).search}&page=${page+1}">Next page</a></div>`:''}`;}
export function advert(row,now=Date.now(),{patch={},body='Qualified teacher status required. Read the complete original instructions.',quote=row.visa}={}){
 const data={'@type':'JobPosting',title:row.title,url:row.url,datePosted:new Date(now).toISOString().slice(0,10),validThrough:new Date(now+86400000*5).toISOString(),hiringOrganization:{name:school.company,identifier:'123456'},jobLocation:{address:{addressCountry:'GB',addressLocality:'Cardiff',addressRegion:'Wales',postalCode:'CF10 1AA'}},employmentType:'FULL_TIME',...patch};
 return `<h1>${row.title}</h1><input name="vacancy_id" value="${row.id}"><section id="job-details"><dl>${visa(quote)}</dl><p>${body}</p></section><aside>Unrelated jobs may offer visa sponsorship.</aside><script type="application/ld+json">${JSON.stringify(data)}</script>`;
}
export function provider(rows=[vacancy(1),vacancy(2)],{now=Date.now(),alter}={}){
 const calls=[];const fetcher=async(url,opts)=>{url=String(url);calls.push(url);const u=new URL(url);let html;if(url.startsWith(teachingBoardIdentity(school).search))html=catalogue(rows,Number(u.searchParams.get('page')||1));else{const r=rows.find(r=>r.url===url);if(!r)throw Error('Unapproved fixture URL');html=advert(r,now);}const value=alter?.(html,url,calls.length,opts)??html;return value instanceof Response?value:new Response(value,{headers:{'Content-Type':'text/html'}});};return{fetcher,calls};
}

export async function seedSchool(db,now=Date.now()){
 const stamp=new Date(now).toISOString();
 await db.batch([
 db.prepare("INSERT INTO metadata(key,value) VALUES('register',?)").bind(JSON.stringify({snapshot:'fictional-register',checked_at:stamp,source_date:stamp})),
 db.prepare("INSERT INTO sponsors(id,snapshot,name,city,county,ratings,routes,skilled) VALUES(?,'fictional-register','Fictional Academy Trust','Cardiff','Wales','[\"A-rating\"]','[\"Skilled Worker\"]',1)").bind(school.sponsor_id),
 db.prepare("INSERT INTO employer_boards(id,company,provider,board,careers,sector,sponsor_id,evidence,state,created_at,reviewed_at) VALUES(?,?,?,?,?,?,?,?,'approved',?,?)").bind(...['id','company','provider','board','careers','sector','sponsor_id','evidence'].map(k=>school[k]),stamp,stamp)
 ]);
}
