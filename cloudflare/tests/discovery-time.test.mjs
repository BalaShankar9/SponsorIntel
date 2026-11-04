import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {discoveryTimeInput,discoveryTimeValue,discoveryFormTimes} from '../shared/discovery-time.js';
import {saveDiscovery} from '../worker/discovery.js';
import {sourceDatabase} from './helpers/source-d1.mjs';

test('discovery UTC editing preserves explicit precision across timezone and daylight-saving boundaries',()=>{
 const old=process.env.TZ;
 try{
  for(const timezone of ['UTC','Europe/London','Asia/Kolkata','America/New_York']){
   process.env.TZ=timezone;
   for(const stamp of ['2026-10-20T15:43:14.127Z','2026-10-25T01:30:00.000Z','2026-03-29T01:30:00.000Z','2028-02-29T23:59:59.999Z'])assert.equal(discoveryTimeValue(discoveryTimeInput(stamp)),stamp);
   assert.equal(discoveryTimeValue('2026-10-20T15:43'),'2026-10-20T15:43:00.000Z','A minute-only choice must not retain hidden seconds');
   assert.equal(discoveryTimeValue('2026-10-20T15:43:14.1'),'2026-10-20T15:43:14.100Z');
  }
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
 assert.equal(discoveryTimeInput(null),'');assert.equal(discoveryTimeValue(''),null);
 for(const value of ['2026-02-29T12:00','2026-02-30T12:00','2026-10-20T24:00','2026-10-20T12:60','2026-10-20T12:00Z','2026-10-20T12:00+01:00','2026-10-20','2026-10-20T12:00:00.1234','not a date'])assert.throws(()=>discoveryTimeValue(value),{status:400});
 assert.throws(()=>discoveryTimeInput('2026-02-30T12:00:00.000Z'),{status:400});
});

test('submitted dates require a deliberate observation and preserve history and exact retry in the real discovery save',async t=>{
 const env=sourceDatabase(t),now=Date.parse('2026-10-20T17:00:00.000Z'),form=new FormData();
 for(const k of ['observed_at','posted_at','deadline','follow_up_at'])form.set(k,'');
 assert.throws(()=>discoveryFormTimes(form),/actually observed/);
 form.set('observed_at','2026-10-20T15:43');form.set('follow_up_at','2026-10-23T12:00');
 const content={title:'Fictional date regression lead',employer:'Fictional employer',location:'London',observed_at:'2026-10-20T15:43:14.127Z',posted_at:null,posted_evidence:'',deadline:null,deadline_evidence:'',original_url:'',identity_url:'',identity_note:'',quote:'',state:'held',reason:'Fictional evidence review awaiting original employer evidence.',follow_up_at:null,job_id:null,duplicate_of:null,method:'agent_assisted'};
 const input={id:null,revision:0,request_key:crypto.randomUUID(),source_kind:'employer',source_url:'https://employer.example/jobs/dates',content:{...content,...discoveryFormTimes(form)}};
 const first=await saveDiscovery(env,input,'fictional-owner',now);
 assert.equal(first.lead.content.observed_at,'2026-10-20T15:43:00.000Z');assert.equal(first.lead.content.follow_up_at,'2026-10-23T12:00:00.000Z');
 assert.equal(first.lead.content.posted_at,null);assert.equal(first.lead.content.deadline,null);
 assert.equal((await saveDiscovery(env,input,'fictional-owner',now+1000)).replayed,true);
 const original=env.sql.prepare('SELECT * FROM discovery_revisions').get();
 const amended={...input,id:first.lead.id,revision:1,request_key:crypto.randomUUID(),content:{...first.lead.content,reason:'A second fictional evidence review preserves the actual observation time.'}};
 await saveDiscovery(env,amended,'fictional-owner',now+2000);
 assert.deepEqual(env.sql.prepare('SELECT * FROM discovery_revisions WHERE revision=1').get(),original);
 assert.equal(env.sql.prepare('SELECT count(*) n FROM admin_audit').get().n,2);
 form.delete('follow_up_at');assert.equal(discoveryFormTimes(form).follow_up_at,null);
 form.append('observed_at','2026-10-20T16:00');assert.throws(()=>discoveryFormTimes(form),{status:400});
});

test('the real discovery form starts observation blank and visibly renders retained milliseconds in UTC',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'si-discovery-time-'));t.after(()=>rm(dir,{recursive:true,force:true}));const outfile=join(dir,'form.cjs');
 await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {DiscoveryForm} from './src/discovery-desk';export const render=lead=>renderToStaticMarkup(<DiscoveryForm lead={lead} onSaved={async()=>{}} onOpen={async()=>{}} onClose={()=>{}}/>);`,loader:'tsx',resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',outfile,loader:{'.css':'empty'},logLevel:'silent'});
 const {render}=createRequire(import.meta.url)(outfile),fresh=render(null);
 assert.match(fresh,/name="observed_at"[^>]*required=""[^>]*value=""/);
 assert.match(fresh,/Source observed at \(UTC\)/);assert.match(fresh,/I checked the source just now/);
 const content={title:'Fictional existing lead',employer:'',location:'',observed_at:'2026-10-20T15:43:14.127Z',posted_at:null,posted_evidence:'',deadline:null,deadline_evidence:'',original_url:'',identity_url:'',identity_note:'',quote:'',state:'rejected',reason:'Fictional original source review; not a real opportunity.',follow_up_at:null,job_id:null,duplicate_of:null,method:'agent_assisted'};
 const edited=render({id:'fictional',revision:1,source_kind:'employer',source_url:'https://employer.example/jobs/dates',content});
 assert.match(edited,/name="observed_at"[^>]*step="0.001"[^>]*value="2026-10-20T15:43:14.127"/);
 assert.doesNotMatch(edited,/name="follow_up_at"/);
});
