import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {database} from './research-db.mjs';
import {registerCleanupStatement} from '../worker/register-cleanup.js';

function seed(env, snapshots, active) {
  env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register', JSON.stringify({snapshot:active}));
  for(const snapshot of snapshots) env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)')
    .run('fictional',snapshot,'Fictional employer','Cardiff','','[]','[]',1);
}

test('cleanup preserves exactly the current and previous public snapshots in either order',async t=>{
  for(const [current,previous] of [['b','d'],['d','b'],['c','c']]) {
    const env=database(t);seed(env,['a','b','c','d','e'],current);
    await registerCleanupStatement(env.DB,current,previous).run();
    assert.deepEqual(env.sql.prepare('SELECT snapshot FROM sponsors ORDER BY snapshot').all().map(x=>x.snapshot),[...new Set([current,previous])].sort());
  }
});

test('an older cleanup cannot delete rows after another snapshot activates or metadata disappears',async t=>{
  for(const metadata of ['newer',null]) {
    const env=database(t);seed(env,['a','b','c','newer'],'newer');
    if(metadata===null)env.sql.exec("DELETE FROM metadata WHERE key='register'");
    await registerCleanupStatement(env.DB,'c','b').run();
    assert.equal(env.sql.prepare('SELECT count(*) n FROM sponsors').get().n,4);
  }
});

test('real D1 cleanup avoids reading two full retained registers, with identical obsolete-row deletion',{timeout:60000},async()=>{
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("fictional test")}}',compatibilityDate:'2026-10-04',cf:false,d1Databases:{DB:'fictional-register-cleanup'}}));
  try {
    const db=await mf.getD1Database('DB');
    await db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
    await db.prepare("INSERT INTO metadata VALUES('register',?)").bind(JSON.stringify({snapshot:'current'})).run();
    for(const snapshot of ['current','previous']) await db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<128000)
      INSERT INTO sponsors SELECT printf('%024x',i),?,'Fictional '||i,'Cardiff','','[]','[]',1 FROM n`).bind(snapshot).run();
    for(const analysed of [false,true]) {
      if(analysed)await db.prepare('ANALYZE').run();
      const before=await db.prepare('DELETE FROM sponsors WHERE snapshot<>? AND snapshot<>?').bind('current','previous').run();
      const after=await registerCleanupStatement(db,'current','previous').run();
      assert.equal(before.meta.changes,0);assert.equal(after.meta.changes,0);
      assert.ok(before.meta.rows_read>=256000,JSON.stringify(before.meta));
      assert.ok(after.meta.rows_read<20,JSON.stringify(after.meta));
      for(const snapshot of ['aaa','middle','zzz'])await db.prepare("INSERT INTO sponsors VALUES('obsolete',?,'Fictional old','Cardiff','','[]','[]',1)").bind(snapshot).run();
      const obsolete=await registerCleanupStatement(db,'current','previous').run();
      assert.equal(obsolete.meta.changes,3);assert.ok(obsolete.meta.rows_read<50,JSON.stringify(obsolete.meta));
      assert.equal((await db.prepare('SELECT count(*) n FROM sponsors').first()).n,256000);
      console.log(JSON.stringify({fixture:'256000 retained fictional rows',analysed,before_rows_read:before.meta.rows_read,after_rows_read:after.meta.rows_read,obsolete_rows_read:obsolete.meta.rows_read,obsolete_deleted:obsolete.meta.changes}));
    }
  }finally{await mf.dispose();}
});
