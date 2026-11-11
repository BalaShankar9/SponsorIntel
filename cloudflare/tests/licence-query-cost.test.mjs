import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {REVIEWED_LICENCE_QUERY} from '../worker/employer-licences.js';

const previous = 'SELECT id,name,city,ratings,routes FROM sponsors WHERE snapshot=? AND skilled=1 AND id IN (SELECT value FROM json_each(?))';

test('real local D1 reads only the reviewed IDs while retaining exact snapshot and Skilled Worker filtering', {timeout:60000}, async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({modules:true,
    script:'export default {fetch(){return new Response("fictional test");}}',
    compatibilityDate:'2026-10-04', cf:false, d1Databases:{DB:'fictional-licence-query-cost'}}));
  try {
    const db = await mf.getD1Database('DB');
    await db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
    // Public-register-sized synthetic fixture. No customer or employer data.
    await db.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<128000)
      INSERT INTO sponsors SELECT printf('%024x',i),'current','Fictional employer '||i,'Cardiff','',
      '["Worker (A rating)"]','["Skilled Worker"]',1 FROM n`).run();
    const ids = [1,2,3,128000,128001].map(i=>i.toString(16).padStart(24,'0'));
    await db.prepare('UPDATE sponsors SET skilled=0 WHERE snapshot=? AND id=?').bind('current',ids[1]).run();
    await db.prepare(`INSERT INTO sponsors VALUES(?,'old','Old snapshot only','Cardiff','','[]','["Skilled Worker"]',1)`).bind(ids[4]).run();
    const wanted=JSON.stringify(ids);
    for (const optimise of [false,true]) {
      if (optimise) await db.prepare('ANALYZE').run();
      const before = await db.prepare(previous).bind('current',wanted).all();
      const after = await db.prepare(REVIEWED_LICENCE_QUERY).bind(wanted,'current').all();
      const sorted = rows=>rows.sort((a,b)=>a.id.localeCompare(b.id));
      assert.deepEqual(sorted(after.results),sorted(before.results));
      assert.deepEqual(after.results.map(x=>x.id),[ids[0],ids[2],ids[3]]);
      assert.ok(after.meta.rows_read<=50,JSON.stringify(after.meta));
      if (!optimise) assert.ok(before.meta.rows_read>100000,JSON.stringify(before.meta));
      const plan=(await db.prepare('EXPLAIN QUERY PLAN '+REVIEWED_LICENCE_QUERY).bind(wanted,'current').all()).results;
      assert.ok(plan.some(x=>/SEARCH s .*snapshot=\? AND id=\?/.test(x.detail)),JSON.stringify(plan));
      const empty=await db.prepare(REVIEWED_LICENCE_QUERY).bind('[]','current').all();
      assert.deepEqual(empty.results,[]); assert.ok(empty.meta.rows_read<10);
      console.log(JSON.stringify({fixture:'128000 fictional register rows',analysed:optimise,before_rows_read:before.meta.rows_read,after_rows_read:after.meta.rows_read,returned:after.results.length}));
    }
  } finally { await mf.dispose(); }
});

