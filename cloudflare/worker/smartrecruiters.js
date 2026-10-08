import {boundedText,idFor} from './data.js';
import {advertHTMLText,advertPlainText} from './advert-text.js';

// Reviewed employer identity only. Never follow a response's `ref` as a URL.
export const SMARTRECRUITERS = Object.freeze({
  portmandentex: Object.freeze({identifier:'PortmanDentex',company:'PortmanDentex'}),
});
export const SMARTRECRUITERS_REQUEST_COST = 50; // two catalogues of <=5 pages + <=40 details
const MAX_POSTINGS=500, PAGE_SIZE=100, DETAIL_BATCH=40, CACHE_AGE=7*86400000;
const iso=t=>new Date(t).toISOString();
const required=(v,max=300)=>typeof v==='string'&&v.trim()&&v.length<=max;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const stable=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(stable(v[k]))])):v);

function config(board){
  const c=SMARTRECRUITERS[board.id];
  if(!c||board.provider!=='smartrecruiters'||board.board!==c.identifier||board.company!==c.company)
    throw Error('Unreviewed paged employer source');
  return c;
}
function identity(row,c,now){
  if(!row||typeof row.id!=='string'||!/^[0-9]{6,25}$/.test(row.id)||!uuid(row.uuid)||!uuid(row.jobAdId)||
      row.company?.identifier!==c.identifier||row.company?.name!==c.company||row.visibility!=='PUBLIC'||
      !required(row.name,240)||!required(row.location?.country,30)||!required(row.location?.city,200)||
      !required(row.releasedDate,40)||!row.releasedDate.includes('T')||!Number.isFinite(Date.parse(row.releasedDate))||Date.parse(row.releasedDate)>now+300000)
    throw Error('Unexpected public posting identity');
  const l=row.location;
  if(['region','address','postalCode'].some(k=>l[k]!=null&&(typeof l[k]!=='string'||l[k].length>400))||
      (row.typeOfEmployment?.label!=null&&!required(row.typeOfEmployment.label,100)))throw Error('Invalid public location or employment type');
  // Restrict the signature to published identity/location fields. Custom fields
  // can contain unpublished pay or administrative information; do not copy them.
  return {id:row.id,uuid:row.uuid,jobAdId:row.jobAdId,name:row.name,
    company:c.identifier,releasedDate:iso(Date.parse(row.releasedDate)),
    location:{city:l.city,country:l.country.toLowerCase(),region:l.region||'',address:l.address||'',postalCode:l.postalCode||'',remote:l.remote===true,hybrid:l.hybrid===true},
    employment:row.typeOfEmployment?.label||''};
}
function excludedLocation(i){
  const l=i.location;
  return l.country!=='gb'||/^(?:GY|JE|IM)\d/i.test(l.postalCode.trim())||
    /\b(?:isle of man|isle of jersey|channel islands|guernsey|jersey)\b/i.test([l.city,l.region,l.address].join(' '));
}
export async function smartRecruitersDetail(detail,row,board,now=Date.now()){
  const c=config(board), expected=identity(row,c,now), actual=identity(detail,c,now);
  if(detail.active!==true||stable(actual)!==stable(expected))throw Error('Posting changed during collection');
  const u=new URL(detail.postingUrl);
  if(u.protocol!=='https:'||u.host!=='jobs.smartrecruiters.com'||u.username||u.password||u.search||u.hash||
      !u.pathname.startsWith(`/${c.identifier}/${row.id}`)||!new RegExp(`^/${c.identifier}/${row.id}(?:-[^/]+)?/?$`).test(u.pathname))
    throw Error('Unexpected posting destination');
  const sections=detail.jobAd?.sections, keys=['companyDescription','jobDescription','qualifications','additionalInformation'];
  if(!sections||typeof sections!=='object'||Array.isArray(sections)||Object.keys(sections).some(k=>!keys.includes(k))||
      !keys.every(k=>Object.hasOwn(sections,k))||
      !(required(sections.jobDescription?.text,160000)||required(sections.companyDescription?.text,160000)))throw Error('Incomplete public advert sections');
  const parts=[];
  for(const k of keys){
    const section=sections[k];
    if(!section)continue;
    if(typeof section.text!=='string'||section.text.length>160000||typeof section.title!=='string'||section.title.length>200)
      throw Error('Invalid public advert section');
    const text=advertHTMLText(section.text);
    if(text)parts.push([advertPlainText(section.title),text].filter(Boolean).join('\n'));
  }
  const description=parts.join('\n\n');
  if(!description||description.length>80000)throw Error('Advert exceeds supported text size');
  const l=expected.location;
  return {id:row.id,title:advertPlainText(row.name),location:[l.city,l.region,'United Kingdom'].filter(Boolean).join(', '),country:'GB',
    descriptionPlain:description,absolute_url:u.href,publishedAt:expected.releasedDate,
    employmentType:advertPlainText(expected.employment),workplaceType:l.remote?'Remote':l.hybrid?'Hybrid':'Onsite',
    description_checked_at:iso(now)};
}

// Cache progress survives a failed/replayed workflow step. Publication remains
// atomic in the caller and is only possible after a complete second catalogue.
export async function collectSmartRecruiters(board,{DB,leaseOwner,fetcher=fetch,now=Date.now()}={}){
  const c=config(board);
  if(!DB||!required(leaseOwner,100))throw Error('Paged collection requires a source lease');
  const base=`https://api.smartrecruiters.com/v1/companies/${c.identifier}/postings`;
  const deadline=Date.now()+75000;
  let requests=0,nextRequest=0;
  async function read(url){
    // Pace even fast successful responses below the documented 10/second limit.
    if(Date.now()<nextRequest)await new Promise(resolve=>setTimeout(resolve,nextRequest-Date.now()));
    if(++requests>SMARTRECRUITERS_REQUEST_COST||Date.now()>=deadline)throw Error('Paged collection limit reached');
    nextRequest=Date.now()+200;
    const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'SponsorIntel/2.47 (+https://sponsorintel.london/about)'},
      signal:AbortSignal.timeout(Math.max(1,Math.min(8000,deadline-Date.now()))),redirect:'manual'});
    return JSON.parse(await boundedText(response,2_000_000));
  }
  async function catalogue(){
    const rows=[],ids=new Set();let total;
    for(let offset=0;offset<(total??1);offset+=PAGE_SIZE){
      const data=await read(`${base}?limit=${PAGE_SIZE}&offset=${offset}&destination=PUBLIC&country=gb`);
      if(!Number.isInteger(data.totalFound)||data.totalFound<0||data.totalFound>MAX_POSTINGS||data.offset!==offset||data.limit!==PAGE_SIZE||
          !Array.isArray(data.content)||data.content.length!==Math.min(PAGE_SIZE,data.totalFound-offset)||
          (total!==undefined&&total!==data.totalFound))throw Error('Incomplete public posting catalogue');
      total=data.totalFound;
      for(const row of data.content){
        const i=identity(row,c,now);
        if(ids.has(i.id))throw Error('Duplicate posting in catalogue');
        ids.add(i.id);rows.push({row,identity:i,version:await idFor('public-advert-v1:'+stable(i)),excluded:excludedLocation(i)});
      }
    }
    return rows;
  }
  const first=await catalogue();
  const cacheRows=(await DB.prepare('SELECT posting_id,version,payload,checked_at FROM source_posting_cache WHERE source_id=?').bind(board.id).all()).results;
  const cache=new Map(cacheRows.map(r=>[r.posting_id,r]));
  const usable=entry=>{
    const r=cache.get(entry.identity.id),stamp=Date.parse(r?.checked_at);
    if(!r||r.version!==entry.version||!Number.isFinite(stamp)||stamp>now+300000||now-stamp>=CACHE_AGE)return false;
    try {const p=JSON.parse(r.payload);return p.id===entry.identity.id&&p.description_checked_at===r.checked_at&&required(p.descriptionPlain,80000);}catch{return false;}
  };
  const selected=first.filter(x=>!x.excluded&&!usable(x)).sort((a,b)=>a.identity.id.localeCompare(b.identity.id)).slice(0,DETAIL_BATCH);
  let fetched=0;
  for(const entry of selected){
    const body=await read(`${base}/${entry.identity.id}`);
    const payload=JSON.stringify(await smartRecruitersDetail(body,entry.row,board,now));
    const saved=await DB.prepare(`INSERT INTO source_posting_cache(source_id,posting_id,version,payload,checked_at)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?)
      ON CONFLICT(source_id,posting_id) DO UPDATE SET version=excluded.version,payload=excluded.payload,checked_at=excluded.checked_at RETURNING posting_id`)
      .bind(board.id,entry.identity.id,entry.version,payload,iso(now),leaseOwner,Date.now()+1000).first();
    if(!saved)throw Error('Source lease ended before saving progress');
    cache.set(entry.identity.id,{posting_id:entry.identity.id,version:entry.version,payload,checked_at:iso(now)});fetched++;
  }
  const current=await catalogue(), eligible=current.filter(x=>!x.excluded), missing=eligible.filter(x=>!usable(x));
  const progress={total:eligible.length,ready:eligible.length-missing.length,fetched,state:missing.length?'collecting':'ready',checked_at:iso(now),requests,
    catalogue_total:current.length,excluded:current.filter(x=>x.excluded).map(x=>({ref:x.identity.id,reason:'outside_uk'}))};
  const saved=await DB.prepare(`INSERT INTO source_collection_progress(source_id,started_at,checked_at,total,ready,fetched,state)
    SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?)
    ON CONFLICT(source_id) DO UPDATE SET checked_at=excluded.checked_at,total=excluded.total,ready=excluded.ready,fetched=excluded.fetched,state=excluded.state RETURNING source_id`)
    .bind(board.id,iso(now),iso(now),progress.total,progress.ready,fetched,progress.state,leaseOwner,Date.now()+1000).first();
  if(!saved)throw Error('Source lease ended before saving catalogue');
  if(missing.length)return {pending:true,progress};
  // Keep only current entries. This cache is replaceable source data, never user data.
  await DB.prepare("DELETE FROM source_posting_cache WHERE source_id=? AND posting_id NOT IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM feed_locks WHERE name='jobs' AND owner=? AND expires>?)")
    .bind(board.id,JSON.stringify(eligible.map(x=>x.identity.id)),leaseOwner,Date.now()+1000).run();
  return {raw:eligible.map(entry=>JSON.parse(cache.get(entry.identity.id).payload)),progress};
}
