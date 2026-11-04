import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {createBrief,decideBrief,marketingSnapshot,marketingAPI} from '../worker/marketing.js';
import {instagramWelcomeContent,WELCOME_SOURCES} from '../worker/marketing-welcome.js';
import {captureMarketingContext,dispatchMarketingAgents,EDITORIAL_SOURCES} from '../worker/marketing-agents.js';
import media from '../shared/marketing-media.json' with {type:'json'};
import {pageResponse} from '../worker/pages.js';
import {publishedGuideFetcher} from '../worker/guide-evidence.js';

const now=Date.parse('2026-10-08T05:00:00Z'),iso=n=>new Date(n).toISOString(),asset=media[0];
const content=()=>({topic_key:'test-instagram',destination:'instagram-company',title:'Company welcome',purpose:'Introduce the verified company account and encourage readers to inspect job evidence.',text:'Research the exact vacancy, read its original advert and use examples you can evidence in your application.',sources:[{title:'Reading adverts',url:'https://sponsorintel.london/guides/sponsorship-in-job-adverts',excerpt:'A sponsor licence and the wording in a job advert answer different questions.',checked_at:iso(now)}],expires_at:iso(now+86400000),media:[{asset_id:asset.id,alt:asset.alt}]});
const checks={claims:true,sources:true,destination:true,duplication:true,media:true};
const decision=(id,revision,kind,extra={})=>({id,revision,kind,request_key:crypto.randomUUID(),note:'Synthetic local observation; reviewed exact content, media and company destination.',...extra});
const receipt=(extra={})=>({account:'sponsorintellondon',provider:'metricool',external_id:'synthetic-ig-one',observed_at:iso(now),scheduled_at:iso(now+3600000),evidence:'Synthetic local provider record for the reviewed caption and ordered image.',media_sha256:[asset.sha256],...extra});
function seedJob(env){env.sql.prepare("INSERT INTO jobs(id,board_id,company,title,location,description,apply_url,provider,sponsorship,level,first_seen,last_seen) VALUES('synthetic','test','Example','Example role','London','Example role description','https://example.com/job','test','not_stated','professional',?,?)").run(iso(now),iso(now));}
const fetchSources=async(url,options)=>{
 assert.equal(options.redirect,'manual');assert.ok(url.startsWith('https://sponsorintel.london/guides/'));
 const source=WELCOME_SOURCES.find(s=>url.endsWith(s.path));
 return new Response(`<article class="resource-article">${source.facts.join(' ')}</article>`,{headers:{'Content-Type':'text/html'}});
};

test('Instagram requires registered image media and a bounded caption; arbitrary assets and personal destinations cannot enter the ledger',async t=>{
 const env=database(t);
 for(const patch of [{media:[]},{media:[{asset_id:'external',alt:asset.alt}]},{media:[{asset_id:asset.id,alt:asset.alt,url:'https://evil.example/pixel'}]},{media:[{asset_id:asset.id,alt:'short'}]},{text:'x'.repeat(2201)},{destination:'hellracer473'}])await assert.rejects(createBrief(env,{...content(),...patch},'writer',now));
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_briefs').get().n,0);
 const b=await createBrief(env,content(),'writer',now),snapshot=await marketingSnapshot(env,now);
 assert.equal(snapshot.items[0].id,b.id);assert.deepEqual(snapshot.items[0].media,[asset]);
 assert.equal(snapshot.destinations['instagram-company'].account,'sponsorintellondon');
});
test('registered image reaches the asset binding while unknown social paths remain 404',async()=>{
 const paths=[],env={ASSETS:{fetch:async req=>{paths.push(new URL(req.url).pathname);return new Response('asset',{headers:{'Content-Type':'image/png'}});}}};
 assert.equal((await pageResponse(new Request(asset.url),env)).status,200);
 assert.equal(paths[0],new URL(asset.url).pathname);
 assert.equal((await pageResponse(new Request('https://sponsorintel.london/social/unregistered.png'),env)).status,404);
 assert.equal(paths[1],'/404.html');
});
test('image or alt-text changes revoke review and preserve the previous version',async t=>{
 const env=database(t),b=await createBrief(env,content(),'writer',now);
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks:{...checks,media:false}}),'reviewer',now),/image/);
 await assert.rejects(decideBrief(env,decision(b.id,1,'reviewed',{checks}),'writer',now),/different reviewer/);
 await decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now);
 const revised={...content(),media:[{asset_id:asset.id,alt:asset.alt+' Read the original advert.'}]};
 await decideBrief(env,decision(b.id,2,'revise',{content:revised}),'writer',now);
 const versions=env.sql.prepare('SELECT version,assets FROM marketing_media_versions ORDER BY version').all();
 assert.equal(versions.length,2);assert.equal(JSON.parse(versions[0].assets)[0].alt,asset.alt);
 assert.equal(JSON.parse(versions[1].assets)[0].alt,revised.media[0].alt);
 await assert.rejects(decideBrief(env,decision(b.id,3,'scheduled',{receipt:receipt()}),'publisher',now),/not allowed/);
});
test('Instagram receipts require the exact company, ordered image hashes and a canonical post URL',async t=>{
 const env=database(t),b=await createBrief(env,content(),'writer',now);
 await decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now);
 for(const patch of [{account:'hellracer473'},{media_sha256:undefined},{media_sha256:['wrong']}])await assert.rejects(decideBrief(env,decision(b.id,2,'scheduled',{receipt:receipt(patch)}),'publisher',now));
 await decideBrief(env,decision(b.id,2,'scheduled',{receipt:receipt()}),'publisher',now);
 for(const post_url of ['https://www.instagram.com/sponsorintellondon/','https://www.facebook.com/x/posts/123','https://www.instagram.com.evil.example/p/abc/','https://www.instagram.com/p/abc/?token=secret','https://www.instagram.com/p/abc/extra'])await assert.rejects(decideBrief(env,decision(b.id,3,'published',{receipt:receipt({post_url})}),'publisher',now));
 await decideBrief(env,decision(b.id,3,'published',{receipt:receipt({post_url:'https://www.instagram.com/p/SYNTHETIC_local/'})}),'publisher',now);
 assert.equal((await marketingSnapshot(env,now)).items[0].state,'published');
 const event=env.sql.prepare("SELECT detail FROM marketing_events WHERE kind='published'").get();assert.deepEqual(JSON.parse(event.detail).media_sha256,[asset.sha256]);
});
test('welcome preparation checks fixed current sources and live catalogue availability before writing',async t=>{
 const env=database(t);seedJob(env);
 const draft=await instagramWelcomeContent(env,fetchSources,now);
 assert.equal(draft.sources.length,3);assert.equal(draft.media[0].asset_id,asset.id);
 for(const fetcher of [async()=>new Response('',{status:302,headers:{Location:'https://evil.example'}}),async()=>new Response('<article class="resource-article">Replaced claims</article>',{headers:{'Content-Type':'text/html'}})])await assert.rejects(instagramWelcomeContent(env,fetcher,now));
 env.sql.prepare('UPDATE jobs SET closes_at=?').run(iso(now-1));
 await assert.rejects(instagramWelcomeContent(env,fetchSources,now),/vacancy evidence/);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_briefs').get().n,0);
});
test('welcome API retains the first draft on repeat without refreshing dates or claiming independent review',async t=>{
 const env=database(t);seedJob(env);env.sql.prepare('UPDATE jobs SET last_seen=?').run(iso(Date.now()));
 env.ASSETS={fetch:async request=>fetchSources(request.url.replace('/index.html',''),{redirect:request.redirect})};
 const request=()=>new Request('https://sponsorintel.london/api/admin/marketing/instagram-welcome',{method:'POST',headers:{Origin:'https://sponsorintel.london','Content-Type':'application/json'},body:'{}'});
 const owner={user:{id:'synthetic-owner'}};
 const first=await (await marketingAPI(request(),env,owner)).json();
 const prior=env.sql.prepare('SELECT expires_at FROM marketing_versions').get();
 const second=await (await marketingAPI(request(),env,owner)).json();
 assert.equal(first.id,second.id);assert.equal(second.replayed,true);
 assert.equal(env.sql.prepare('SELECT state FROM marketing_briefs').get().state,'proposed');
 assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM marketing_events WHERE kind='reviewed'").get().n,0);
 assert.deepEqual(env.sql.prepare('SELECT expires_at FROM marketing_versions').get(),prior);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM marketing_receipts').get().n,0);
});
test('production guide reads use deployed article assets and refuse unrelated paths or origins',async()=>{
 const seen=[],fetcher=publishedGuideFetcher({ASSETS:{fetch:async r=>{seen.push(r);return new Response('Published guide');}}});
 await fetcher('https://sponsorintel.london/guides/build-a-shortlist',{headers:{Cookie:'must-not-forward'}});
 assert.equal(seen[0].url,'https://sponsorintel.london/guides/build-a-shortlist/index.html');
 assert.equal(seen[0].headers.has('Cookie'),false);
 for(const url of ['https://evil.example/guides/build-a-shortlist','https://sponsorintel.london/api/admin','https://sponsorintel.london/guides/build-a-shortlist?private=value'])await assert.rejects(fetcher(url));
 assert.equal(seen.length,1);
});
test('an uncertain Instagram delivery holds the shared company queue without another model call',async t=>{
 const env=database(t),b=await createBrief(env,content(),'writer',now);
 await decideBrief(env,decision(b.id,1,'reviewed',{checks}),'reviewer',now);
 await decideBrief(env,decision(b.id,2,'scheduled',{receipt:receipt()}),'publisher',now);
 await decideBrief(env,decision(b.id,3,'uncertain',{receipt:receipt()}),'publisher',now);
 env.AI_MODEL='synthetic-writer';env.AI_REVIEW_MODEL='synthetic-reviewer';env.MARKETING_WORKFLOW={create:async()=>({id:'test'})};
 const run=await dispatchMarketingAgents(env,now);
 const context=await captureMarketingContext(env,run.id,async url=>new Response('<article class="resource-article">'+EDITORIAL_SOURCES.filter(s=>url.endsWith(s.path)).flatMap(s=>s.facts).join(' ')+'</article>',{headers:{'Content-Type':'text/html'}}),now);
 assert.equal(context.queue.length,1);assert.equal(context.queue[0].state,'uncertain');assert.equal(context.slot,null);
 assert.equal(env.sql.prepare('SELECT calls FROM agent_research_budget').get().calls,0);
});
