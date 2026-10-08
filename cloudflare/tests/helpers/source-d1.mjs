import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function sourceDatabase(t){
 const sql=new DatabaseSync(':memory:');t.after(()=>sql.close());
 for(const file of readdirSync(new URL('../../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(query){let args=[];return {bind(...values){args=values;return this;},exec(){const s=sql.prepare(query);return s.columns().length?{results:s.all(...args),success:true}:{...s.run(...args),results:[],success:true};},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this.exec();}};},async batch(statements){sql.exec('BEGIN');try{const result=statements.map(x=>x.exec());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 const SOURCE_WORKFLOW={async create(){return {id:'fixture'};},async get(){return {async status(){return {status:'running'};}};}};
 return {DB,sql,SOURCE_WORKFLOW};
}
