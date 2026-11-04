// Local, fictional comparison only. No source requests, database or model calls.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import {build} from 'esbuild';
import {school,vacancy,advert,catalogue} from '../tests/fixtures/teaching-board.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const option=name=>process.argv.find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const baseline=option('--baseline'),out=option('--out');
if(!/^[0-9a-f]{40}$/.test(baseline||'')||!out)throw Error('Supply an exact --baseline=<commit> and --out=<receipt>.');
const changed=['worker/teaching-vacancies.js','worker/teaching-location.js'];
const originals=new Map(changed.map(path=>{
  const result=spawnSync('git',['show',`${baseline}:cloudflare/${path}`],{cwd:root,encoding:'utf8',maxBuffer:1_000_000});
  if(result.status!==0)throw Error('Could not read the requested baseline: '+path);
  return[path,result.stdout];
}));
async function parser(old){
  const result=await build({stdin:{contents:`export {parseTeachingCatalogue,parseTeachingVacancy} from './worker/teaching-vacancies.js'; export {sourceDiagnostic} from './worker/source-errors.js';`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'node',target:'node24',plugins:old?[{name:'immutable-baseline',setup(build){build.onLoad({filter:/teaching-(vacancies|location)\.js$/},args=>{
    const value=originals.get(relative(root,args.path));
    return value===undefined?undefined:{contents:value,loader:'js'};
  });}}]:[]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const old=await parser(true),current=await parser(false);
const now=Date.parse('2026-11-04T05:00:00Z'),row=vacancy(1);
const noise=n=>'<nav>'+('<div><span>Unrelated navigation and school information.</span></div>'.repeat(n))+'</nav>';
const cases=[];
const add=(name,kind,html,expected=row,page=1)=>cases.push({name,kind,html,expected,page});
const plain=advert(row,now,{body:'Qualified teacher status. Salary £38,812. Two years of teaching experience. CVs are not accepted; use the school form. Sponsorship remains subject to employer checks.'});
for(const [label,count] of [['small',0],['medium',1400],['large',9000]]){
  const prefix=noise(count);
  add(label,'vacancy',prefix+plain);
  add(label+'-duplicate-title','vacancy',prefix+plain+'<h1>Another title</h1>');
  add(label+'-duplicate-section','vacancy',prefix+plain+'<section id="job-details"></section>');
  add(label+'-duplicate-campus','vacancy',prefix+plain+'<div class="header-with-logo-title"></div>');
}
for(const patch of [{hiringOrganization:{name:school.company,identifier:'654321'}},{title:'Different role'},{validThrough:'tomorrow'},{datePosted:'2026-02-30'}])add('changed-identity-'+cases.length,'vacancy',advert(row,now,{patch}));
add('visa-conflict','vacancy',advert(row,now,{quote:'Visas cannot be sponsored'}));
add('closed','vacancy',advert(row,now,{body:'This vacancy has closed.'}));
add('oversized-description','vacancy',advert(row,now,{body:'x'.repeat(80001)}));
const rows=Array.from({length:20},(_,i)=>vacancy(i+1));
for(const r of rows)add('role-'+r.id,'vacancy',advert(r,now),r);
for(const page of [1,2]){
  const html=catalogue(rows,page);
  add('catalogue-'+page,'catalogue',noise(1400)+html,row,page);
  add('wrong-school-'+page,'catalogue',html+'<input name="organisation_slug" value="another-school">',row,page);
  add('wrong-total-'+page,'catalogue',html.replace('Jobs (20)','Jobs (21)'),row,page);
}
function run(module,c){
  try{return {value:c.kind==='vacancy'?module.parseTeachingVacancy(c.html,school,c.expected,now):module.parseTeachingCatalogue(c.html,school,c.page)};}
  catch(error){return {error:module.sourceDiagnostic(error)};}
}
for(const c of cases)assert.deepEqual(run(current,c),run(old,c),c.name);
const performanceCases=cases.filter(c=>['small','medium','large','catalogue-1'].includes(c.name));
const timing=[];
for(const c of performanceCases){
  for(let i=0;i<12;i++){run(old,c);run(current,c);}
  const samples={baseline:[],candidate:[]};
  for(let batch=0;batch<12;batch++){
    for(const [key,module] of batch%2?[['candidate',current],['baseline',old]]:[['baseline',old],['candidate',current]]){
      const start=process.threadCpuUsage();
      for(let i=0;i<10;i++)run(module,c);
      const used=process.threadCpuUsage(start);
      samples[key].push((used.user+used.system)/1000/10);
    }
  }
  const median=values=>[...values].sort((a,b)=>a-b).slice(5,7).reduce((a,b)=>a+b)/2;
  const before=median(samples.baseline),after=median(samples.candidate);
  timing.push({case:c.name,html_bytes:Buffer.byteLength(c.html),baseline_thread_cpu_ms_per_parse:before,candidate_thread_cpu_ms_per_parse:after,reduction_percent:100*(before-after)/before,samples});
}
const hash=value=>createHash('sha256').update(value).digest('hex');
const result={observed_at:new Date().toISOString(),node:process.version,platform:process.platform,architecture:process.arch,baseline,scope:'Fictional local Node parser comparison, not Cloudflare CPU or production-source acceptance',equivalent_cases:cases.length,fixture_digest:hash(JSON.stringify(cases)),baseline_files:Object.fromEntries([...originals].map(([path,value])=>[path,hash(value)])),candidate_files:Object.fromEntries([...changed,'worker/teaching-tree.js'].map(path=>[path,hash(readFileSync(new URL('../'+path,import.meta.url)))])),timing,source_requests:0,production_writes:0,limits_changed:false};
writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,timing:timing.map(({samples,...rest})=>rest)},null,2));
