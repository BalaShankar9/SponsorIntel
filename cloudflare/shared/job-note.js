import {analyseAdvert} from '../extension/analyse.js';
const keys=['schema','version','source','advert','wording'];
export function publicJobURL(value){
 let url;try{url=new URL(value);}catch{throw Error('Add the exact public HTTPS advert link.');}
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>2000)throw Error('Use a public HTTPS advert link without credentials.');
 for(const key of [...url.searchParams.keys()]){if(/token|session|password|secret|signature|auth/i.test(key))throw Error('Remove private session links; use the public advert address.');if(/^utm_|^(trackingId|trk|referrer)$/i.test(key))url.searchParams.delete(key);}
 url.hash='';url.searchParams.sort();return url.href;
}
const bounded=(value,max,name,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`Review ${name}; its value is missing or too long.`);return value.trim();};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export async function createJobNote(input){
 const text=bounded(input.text,26000,'the complete advert',true);if(text.length<80)throw Error('Include the complete role description (at least 80 characters).');
 if(input.confirmed!==true)throw Error('Confirm the complete public advert before preparing a handoff.');
 const observedAt=input.observedAt||new Date().toISOString();if(!Number.isFinite(Date.parse(observedAt)))throw Error('Invalid observation time.');
 const source={url:publicJobURL(input.url),title:bounded(input.title,240,'job title',true),company:bounded(input.company||'',200,'employer'),location:bounded(input.location||'',300,'location'),observedAt};
 const answer=analyseAdvert(text,true);
 return {schema:'sponsor-intel.job-note',version:1,source,advert:{text,sha256:await hash(text)},wording:{status:answer.status,evidence:answer.evidence,method:'Local phrase check; not independently verified'}};
}
export async function readJobNote(value){
 if(typeof value!=='string'||new TextEncoder().encode(value).length>160000)throw Error('Choose a Job notes file smaller than 160 KB.');
 let data;try{data=JSON.parse(value);}catch{throw Error('This file is not valid Job notes JSON.');}
 if(!data||data.schema!=='sponsor-intel.job-note'||data.version!==1||Object.keys(data).some(key=>!keys.includes(key)))throw Error('Choose a Sponsor Intel Job notes version 1 file, not a CV or workspace backup.');
 const packet=await createJobNote({...data.source,text:data.advert?.text,confirmed:true});
 if(packet.advert.sha256!==data.advert?.sha256)throw Error('The advert changed after this packet was created. Export a fresh note or add the role manually.');
 // Never trust a file's supplied verdict or quoted claims. Recompute from text.
 return {...packet,id:'external-'+(await hash(packet.source.url)).slice(0,24)};
}
