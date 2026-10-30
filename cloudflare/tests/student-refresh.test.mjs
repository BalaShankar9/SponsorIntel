import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {database} from './research-db.mjs';
import {refreshStudents, sameStudentSnapshot, STUDENT_HEADERS} from '../worker/study.js';

const source='https://assets.publishing.service.gov.uk/media/fictional/students-2026-10-05.csv';
const rows=Array.from({length:501},(_,i)=>`Fictional College ${i},Cardiff,,HEI,Student Sponsor,Student,`);
const csv=(content=rows)=>new Response(STUDENT_HEADERS.join(',')+'\n'+content.join('\n'));
const fetcher=(content=rows,url=source)=>async target=>target.includes('/api/content/')
  ? Response.json({base_path:'/government/publications/register-of-licensed-sponsors-students',details:{attachments:[{url}]}})
  : csv(content);
const metadata=env=>JSON.parse(env.sql.prepare("SELECT value FROM metadata WHERE key='students'").get().value);

test('identical complete student data reuses its snapshot even when the official attachment changes',async t=>{
  const env=database(t), first=await refreshStudents(env,fetcher());
  const original=env.sql.prepare('SELECT * FROM student_sponsors ORDER BY id').all();
  const calls=[],nextSource=source.replace('10-05','10-06');
  const unchanged=await refreshStudents(env,async url=>{calls.push(url);return fetcher([...rows].reverse(),nextSource)(url);});
  assert.equal(unchanged.snapshot,first.snapshot);
  assert.equal(unchanged.source_url,nextSource);
  assert.equal(unchanged.source_date,'2026-10-06');
  assert.equal(unchanged.source_rows,501);
  assert.equal(calls.length,2);assert.equal(calls[1],nextSource);
  assert.deepEqual(env.sql.prepare('SELECT * FROM student_sponsors ORDER BY id').all(),original);
  assert.equal(unchanged.refresh_error,null);
});

test('same URL and same count cannot hide a changed student status or other retained field',async t=>{
  const env=database(t),first=await refreshStudents(env,fetcher());
  const next=[...rows];next[0]=next[0].replace('Student Sponsor','Student Sponsor - Track Record');
  const changed=await refreshStudents(env,fetcher(next));
  assert.notEqual(changed.snapshot,first.snapshot);
  assert.equal(env.sql.prepare('SELECT status FROM student_sponsors WHERE snapshot=? AND name=?').get(changed.snapshot,'Fictional College 0').status,'Student Sponsor - Track Record');
  assert.equal(env.sql.prepare('SELECT count(*) n FROM student_sponsors WHERE snapshot=?').get(first.snapshot).n,501);
  const item={id:'a',name:'A',city:'Cardiff',locations:'Swansea',type:'HEI',status:'Student Sponsor',routes:['Student'],compliance:'Track Record'};
  const stored={...item,routes:JSON.stringify(item.routes)};
  assert.equal(sameStudentSnapshot([item],[stored]),true);
  for(const key of ['id','name','city','locations','type','status','routes','compliance'])
    assert.equal(sameStudentSnapshot([item],[{...stored,[key]:'changed'}]),false,key);
  assert.equal(sameStudentSnapshot([item],[]),false);
  assert.equal(sameStudentSnapshot([item,item],[stored,stored]),false);
});

test('an unchanged URL still requires a complete valid source and preserves the last success on failure',async t=>{
  const env=database(t),first=await refreshStudents(env,fetcher());
  for(const response of [()=>csv(rows.slice(0,400)),()=>new Response('Wrong,Columns\nA,B'),()=>new Response('unavailable',{status:503})]){
    const failure=await refreshStudents(env,async url=>url.includes('/api/content/')?fetcher()(url):response());
    assert.ok(failure.error);assert.equal(metadata(env).snapshot,first.snapshot);
    assert.equal(metadata(env).last_success,first.last_success);
    assert.equal(env.sql.prepare('SELECT count(*) n FROM student_sponsors').get().n,501);
  }
});

test('a newer owner or expired lease cannot be overwritten by an older student check',async t=>{
  for(const scenario of ['newer-success','expired-success','newer-source-failure']){
    const env=database(t),first=await refreshStudents(env,fetcher());
    const winner={...first,checked_at:'2026-10-06T12:00:00Z',refresh_error:'newer decision'};
    const result=await refreshStudents(env,async url=>{
      if(!url.includes('/api/content/')){
        if(scenario.startsWith('newer')){
          env.sql.prepare("UPDATE metadata SET value=? WHERE key='students'").run(JSON.stringify(winner));
          env.sql.prepare("UPDATE feed_locks SET owner='newer-owner' WHERE name='students'").run();
        }else env.sql.prepare("UPDATE feed_locks SET expires=0 WHERE name='students'").run();
        if(scenario.endsWith('failure'))return new Response('failed',{status:503});
      }
      return fetcher()(url);
    });
    assert.ok(result.skipped||result.error);
    assert.deepEqual(metadata(env),scenario.startsWith('newer')?winner:first);
    if(scenario.startsWith('newer'))assert.equal(env.sql.prepare("SELECT owner FROM feed_locks WHERE name='students'").get().owner,'newer-owner');
  }
});

test('lost student activation acknowledgement and later cleanup failure never restore an old pointer',async t=>{
  for(const failAt of ['activation','cleanup']){
    const env=database(t),first=await refreshStudents(env,fetcher());
    const prepare=env.DB.prepare.bind(env.DB);let injected=false;
    env.DB.prepare=query=>{
      const statement=prepare(query);
      if(failAt==='activation'&&query.startsWith('INSERT INTO metadata(key,value)')){
        const original=statement.first.bind(statement);
        statement.first=async()=>{const result=await original();if(!injected){injected=true;throw Error('Fictional lost acknowledgement');}return result;};
      }
      if(failAt==='cleanup'&&query.includes('DELETE FROM student_sponsors'))statement.run=async()=>{injected=true;throw Error('Fictional cleanup failure');};
      return statement;
    };
    const changed=[...rows];changed[0]=changed[0].replace('Cardiff','Swansea');
    const result=await refreshStudents(env,fetcher(changed));
    assert.ok(result.error);assert.equal(injected,true);
    assert.notEqual(metadata(env).snapshot,first.snapshot);
    assert.equal(env.sql.prepare('SELECT count(*) n FROM student_sponsors WHERE snapshot=?').get(metadata(env).snapshot).n,501);
    assert.equal(env.sql.prepare('SELECT count(*) n FROM student_sponsors WHERE snapshot=?').get(first.snapshot).n,501);
  }
});

test('a partial changed student import leaves the complete published snapshot active',async t=>{
  const env=database(t),first=await refreshStudents(env,fetcher());
  const batch=env.DB.batch.bind(env.DB);let batches=0;
  env.DB.batch=async statements=>{if(++batches===2)throw Error('Fictional staging interruption');return batch(statements);};
  const changed=[...rows];changed[0]=changed[0].replace('Cardiff','Swansea');
  assert.ok((await refreshStudents(env,fetcher(changed))).error);
  assert.equal(metadata(env).snapshot,first.snapshot);
  assert.equal(metadata(env).last_success,first.last_success);
  assert.equal(env.sql.prepare('SELECT count(*) n FROM student_sponsors WHERE snapshot=?').get(first.snapshot).n,501);
  assert.equal(env.sql.prepare('SELECT count(*) n FROM student_sponsors WHERE snapshot<>?').get(first.snapshot).n,80);
});

test('real D1 repeated complete student check keeps directory rows with bounded write cost',{timeout:30000},async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fictional test")}}',compatibilityDate:'2026-10-04',cf:false,d1Databases:{DB:'fictional-student-reuse'}}));
  try{
    const DB=await mf.getD1Database('DB');
    for(const file of ['0001_initial.sql','0007_student_sponsors.sql'])
      for(const query of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(x=>x.trim()))await DB.prepare(query).run();
    await DB.exec('CREATE TABLE IF NOT EXISTS feed_locks(name TEXT PRIMARY KEY,owner TEXT,expires INTEGER);');
    let writes=0;
    const measure=result=>{writes+=result.meta?.rows_written||0;return result;};
    const measured={
      prepare(query){
        let statement=DB.prepare(query);
        return {bind(...args){statement=statement.bind(...args);return this;},
          async first(){const result=measure(await statement.all());return result.results[0]||null;},
          async all(){return measure(await statement.all());},async run(){return measure(await statement.run());},
          get raw(){return statement;}};
      },
      async batch(statements){return (await DB.batch(statements.map(x=>x.raw))).map(measure);},
    };
    const first=await refreshStudents({DB:measured},fetcher());const initialWrites=writes;writes=0;
    const second=await refreshStudents({DB:measured},fetcher());
    assert.equal(second.snapshot,first.snapshot);
    assert.equal((await DB.prepare('SELECT count(*) n FROM student_sponsors').first()).n,501);
    assert.ok(initialWrites>=501);assert.ok(writes<=10,JSON.stringify({writes}));
    console.log(JSON.stringify({fixture:'501 fictional student sponsors; full source fetched twice',initial_rows_written:initialWrites,identical_check_rows_written:writes}));
  }finally{await mf.dispose();}
});
