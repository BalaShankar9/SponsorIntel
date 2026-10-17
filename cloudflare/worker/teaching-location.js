import {SourceCheckError} from './source-errors.js';
const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const find=(n,f)=>[...(f(n)?[n]:[]),...(n.children||[]).flatMap(c=>find(c,f))];
const hasClass=(n,c)=>n.attribs?.class?.split(/\s+/).includes(c);
const text=n=>n.type==='text'?n.data:['script','style','noscript','template'].includes(n.name)?'':(n.children||[]).map(text).join(' ');
const fail=()=>{throw new SourceCheckError('posting_identity');};

export function teachingAdvertLocation(doc,head,company){
 // DfE's JSON-LD can contain the organisation's main address even when the
 // advert names another campus. Read only the caption paired with this title;
 // never borrow the map, school overview or a related vacancy's location.
 const headers=find(doc,n=>hasClass(n,'header-with-logo-title'));
 if(headers.length!==1||head.parent!==headers[0])fail();
 const captions=(headers[0].children||[]).filter(n=>n.name==='span'&&hasClass(n,'govuk-caption-l'));
 if(captions.length!==1)fail();
 const caption=norm(text(captions[0])),prefix=norm(company)+', ';
 if(!caption.startsWith(prefix))fail();
 const location=caption.slice(prefix.length);
 const postcodes=[...location.matchAll(/\b(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/gi)];
 // Ambiguous/multi-site or unfamiliar captions hold the complete batch. A
 // postcode-shaped suffix is an address check, not geocoding or eligibility.
 if(!location||location.length>280||postcodes.length!==1||postcodes[0].index+postcodes[0][0].length!==location.length||!location.includes(','))fail();
 return location;
}
