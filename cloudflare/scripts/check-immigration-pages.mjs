// Read-only acceptance: inspect the HTTP document, without rendering page scripts.
import assert from 'node:assert/strict';
const base=new URL(process.argv[2]||'https://sponsorintel.london');
const paths=['/updates','/updates?topic=student','/updates?topic=business'];
const results=[];
for(const path of paths){
 const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)}),html=await response.text();
 assert.equal(response.status,200,path);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 assert.equal(response.headers.get('etag'),null);
 assert.match(html,/rel="canonical" href="https:\/\/sponsorintel.london\/updates"/);
 assert.equal((html.match(/class="immigration-page"/g)||[]).length,1);
 assert.doesNotMatch(html,/Loading official updates/);
 const match=html.match(/<script type="application\/json" id="immigration-data">([^<]*)<\/script>/);
 assert.ok(match,'The page must carry its public starting snapshot.');
 const data=JSON.parse(match[1]),topic=new URL(path,base).searchParams.get('topic');
 assert.ok(data.sources.length>0);
 assert.ok(data.sources.every(s=>!Object.hasOwn(s,'content')));
 const count=data.sources.filter(s=>s.kind==='guidance'&&(!topic||s.topic===topic)).length;
 assert.equal((html.match(/class="explanation-card /g)||[]).length,count);
 assert.match(html,/href="\/updates\?topic=student"/);
 assert.match(html,/href="https:\/\/www.gov.uk\//);
 results.push({path,status:response.status,guidance_cards:count,source_snapshot:data.generated_at,html_bytes:Buffer.byteLength(html)});
}
console.log(JSON.stringify({origin:base.origin,checked_at:new Date().toISOString(),checks:'Initial HTML, topic links, canonical, freshness headers and public bootstrap only; not indexing or rankings.',results},null,2));
