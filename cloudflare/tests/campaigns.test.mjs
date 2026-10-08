import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {campaigns,campaignById,campaignFromSearch,campaignLink,createCampaignContext} from '../shared/campaigns.js';
import {analyticsAPI,recordResponseMetrics,campaignSummary,preparationReply} from '../worker/analytics.js';
import {pageResponse} from '../worker/pages.js';
import {adminAPI} from '../worker/admin.js';
const origin='https://sponsorintel.london';
const query='?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_week&utm_content=evidence_snapshot';
function request(path,body,headers={}){return new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}

test('campaign vocabulary accepts only exact approved combinations and excludes raw private URL fields',()=>{
  assert.equal(new Set(campaigns.map(c=>c.id)).size,campaigns.length);
  for(const c of campaigns) assert.equal(campaignFromSearch(new URLSearchParams({utm_source:c.source,utm_medium:c.medium,utm_campaign:c.campaign,utm_content:c.content}).toString()).id,c.id);
  assert.equal(campaignFromSearch(query+'&email=private@example.com&q=PRIVATE_CV').id,'fb-evidence');
  for(const s of [query+'&utm_source=linkedin',query.replace('evidence_snapshot','private@example.com'),query.replace('organic_social','paid'),query.replace('facebook','Facebook'),'?'+ 'x'.repeat(5000),'']) assert.equal(campaignFromSearch(s),null);
  assert.equal(campaignById({id:'fb-evidence'}),null);
  assert.equal(campaignById('private@example.com'),null);
});
test('report handoffs carry only known public labels to selected first-party pages',()=>{
  const link=campaignLink('/jobs',origin,'fb-evidence');
  assert.equal(campaignFromSearch(new URL(link,origin).search).id,'fb-evidence');
  for(const href of ['#main','#sources','https://other.example/jobs','//other.example/jobs','javascript:alert(1)','/api/auth/sign-up/email','/admin','/reset-password?token=secret','/signin','/jobs?utm_source=another']) assert.equal(campaignLink(href,origin,'fb-evidence'),href);
  assert.equal(campaignLink('/jobs',origin,'UNKNOWN'),'/jobs');
});
test('campaign context expires, contains no unique ID and is isolated between document instances',()=>{
  const a=createCampaignContext(query,1000),b=createCampaignContext('',1000);
  assert.equal(a.id(1000),'fb-evidence');assert.equal(b.id(1000),null);
  assert.equal(a.id(1800999),'fb-evidence');assert.equal(a.id(1801000),null);assert.equal(a.id(999),null);
  assert.equal(createCampaignContext('',1801000).id(1801000),null);
});
test('campaign page events keep general totals separate and never persist raw private dimensions',async t=>{
  const env=database(t);
  let response=await analyticsAPI(request('/api/metrics',{page:'/jobs?q=PRIVATE_CV',campaign:'fb-evidence',email:'private@example.com'}),env);
  assert.equal(response.status,200);
  response=await analyticsAPI(request('/api/metrics',{page:'/jobs',campaign:'private@example.com'}),env);assert.equal(response.status,200);
  const rows=env.sql.prepare('SELECT * FROM analytics_public_daily').all();
  assert.equal(rows.find(r=>r.event==='page_view').count,2);
  assert.equal(rows.find(r=>r.event==='campaign_page_view').count,1);
  assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_CV|private@example/);
  const summary=campaignSummary(rows);assert.ok(summary.first_recorded);assert.equal(summary.items.find(c=>c.id==='fb-evidence').page_view,1);
  assert.equal(summary.items.find(c=>c.id==='fb-adverts').page_view,0);
});
test('private routes, cross-origin writes and oversized events cannot create campaign counts',async t=>{
  const env=database(t);
  assert.equal((await analyticsAPI(request('/api/metrics',{page:'/admin',campaign:'fb-evidence'}),env)).status,400);
  assert.equal((await analyticsAPI(request('/api/metrics',{page:'/jobs',campaign:'fb-evidence'},{Origin:'https://other.example'}),env)).status,403);
  assert.equal((await analyticsAPI(request('/api/metrics',{page:'/jobs',campaign:'x'.repeat(1000)}),env)).status,400);
  assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_public_daily').get().n,0);
});
test('only successful known server actions receive campaign attribution, never client-declared conversions',async t=>{
  const env=database(t),req=request('/api/career/generate',{cv:'PRIVATE_CV'},{'X-SI-Campaign':'fb-applications'});
  await recordResponseMetrics(env,req,new Response(null,{status:503}));assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM analytics_public_daily').get().n,0);
  await recordResponseMetrics(env,req,preparationReply({kind:'cv',text:'PRIVATE_CV'}));
  await recordResponseMetrics(env,request('/api/admin/boards',{}, {'X-SI-Campaign':'fb-applications'}),new Response(null,{status:200}));
  await analyticsAPI(request('/api/metrics',{page:'/jobs',campaign:'fb-applications',event:'account_created'}),env);
  const rows=env.sql.prepare('SELECT * FROM analytics_public_daily').all();
  assert.equal(rows.find(r=>r.event==='document_prepared').count,1);
  assert.equal(rows.find(r=>r.event==='campaign_document_prepared').count,1);
  assert.equal(rows.find(r=>r.event==='campaign_account_created'),undefined);
  assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_CV/);
  await recordResponseMetrics(env,request('/api/chat',{}, {Origin:'https://other.example','X-SI-Campaign':'fb-applications'}),new Response(null,{status:200}));
  assert.equal(env.sql.prepare("SELECT COUNT(*) n FROM analytics_public_daily WHERE event='campaign_guidance_answer'").get().n,0);
});
test('campaign summary has an honest empty state and filters unknown historical dimensions',()=>{
  assert.equal(campaignSummary([]).first_recorded,null);
  const s=campaignSummary([{day:'2026-10-07',event:'page_view',dimension:'/jobs',count:50},{day:'2026-10-07',event:'campaign_page_view',dimension:'private-email',count:30},{day:'2026-10-07',event:'campaign_fake',dimension:'fb-evidence',count:90}]);
  assert.equal(s.first_recorded,null);assert.ok(s.items.every(r=>r.page_view===0));assert.doesNotMatch(JSON.stringify(s),/private-email|campaign_fake/);
});
test('campaign module is served as an asset, while campaign dashboard remains owner-only',async t=>{
  const env=database(t);env.ASSETS={fetch:async()=>new Response('export const campaigns=[]',{headers:{'Content-Type':'text/javascript'}})};
  const asset=await pageResponse(new Request(origin+'/campaigns.js'),env);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);
  const response=await adminAPI(new Request(origin+'/api/admin/dashboard'),env);assert.equal(response.status,403);assert.equal((await response.json()).campaigns,undefined);
});
