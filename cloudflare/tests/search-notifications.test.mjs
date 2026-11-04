import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './research-db.mjs';
import {configureSearchMonitor,scanSearchNotifications,scanSearchMonitor,searchInbox,markSearchMatchesRead,searchNotificationHealth} from '../worker/search-notifications.js';
import {jobsAPI,normaliseBoardJobs,storeBoardJobs,BOARDS} from '../worker/jobs.js';
import {validateWorkspace} from '../worker/career-validation.js';
import {businessFindings} from '../worker/business-operations.js';
const base=Date.now(),iso=n=>new Date(n).toISOString(),board=BOARDS.find(b=>b.id==='monzo');
const user={id:'candidate-one',emailVerified:true};
function account(env,u=user,searches=[{id:'search-a',q:'engineer'}]) {
 env.sql.prepare('INSERT OR IGNORE INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(u.id,'Fictional candidate',u.id+'@example.invalid',+u.emailVerified,base,base);
 const data=validateWorkspace({version:2,profile:{},applications:[],searches});
 env.sql.prepare('INSERT INTO career_workspaces(user_id,data,updated_at) VALUES(?,?,?)').run(u.id,JSON.stringify(data),iso(base));
 return data;
}
async function add(env,id,time=base+1000,changes={}) {
 const records=await normaliseBoardJobs([{id,title:'Graduate engineer',location:{name:'London'},content:'We offer visa sponsorship for this role. Annual salary £40,000.',absolute_url:'https://job-boards.greenhouse.io/monzo/jobs/'+id}],board,time);
 records[0]={...records[0],...changes};
 // Use the real ingest upsert while preserving other fixture roles in this batch.
 const prior=env.sql.prepare('SELECT * FROM jobs WHERE board_id=?').all(board.id);
 await storeBoardJobs(env.DB,board,[...prior.filter(j=>j.id!==records[0].id),records[0]],iso(time));
 return records[0];
}
const follow=(env,s='search-a',u=user,time=base)=>configureSearchMonitor(env,u,{search_id:s,enabled:true},time);

test('following is opt-in and idempotent; only newly added matches enter the private inbox',async t=>{
 const env=database(t);account(env);
 const old=await add(env,'old',base-1000);
 assert.equal((await scanSearchNotifications(env,base)).checked,0);
 assert.equal((await searchInbox(env,user.id,base)).monitors.length,0);
 const m=await follow(env);assert.equal((await follow(env,'search-a',user,base+500)).id,m.id);
 const fresh=await add(env,'new');
 await scanSearchNotifications(env,base+2000);await scanSearchNotifications(env,base+2001);
 const inbox=await searchInbox(env,user.id,base+2001);
 assert.deepEqual(inbox.monitors[0].matches.map(j=>j.id),[fresh.id]);assert.equal(inbox.monitors[0].unread,1);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_matches').get().n,1);
 assert.equal(inbox.monitors[0].started_at,iso(base));assert.notEqual(old.id,fresh.id);
 assert.equal((await searchNotificationHealth(env)).followed,1);
});

test('one candidate cannot read, stop or acknowledge another candidate’s monitor',async t=>{
 const env=database(t),other={id:'candidate-two',emailVerified:true};account(env);account(env,other);
 const m=await follow(env),job=await add(env,'new');await scanSearchNotifications(env,base+2000);
 assert.equal((await searchInbox(env,other.id,base+3000)).monitors.length,0);
 await configureSearchMonitor(env,other,{search_id:'search-a',enabled:false,monitor_id:m.id},base+3000);
 await assert.rejects(markSearchMatchesRead(env,other.id,{monitor_id:m.id,as_of:iso(base+2000),job_ids:[job.id]},base+3000),{status:404});
 assert.equal((await searchInbox(env,user.id,base+3000)).monitors[0].unread,1);
 await assert.rejects(configureSearchMonitor(env,{...user,emailVerified:false},{search_id:'search-a',enabled:true}),{status:403});
 await assert.rejects(follow(env,'not-in-workspace'),{status:409});
 await assert.rejects(configureSearchMonitor(env,user,{search_id:'search-a',enabled:true,filters:{q:'a locally changed search'}}),{status:409});
});

test('marking a displayed list does not consume a later arrival, and replay preserves read receipts',async t=>{
 const env=database(t);account(env);const m=await follow(env),first=await add(env,'first');
 await scanSearchNotifications(env,base+2000);
 const before=await searchInbox(env,user.id,base+3000),second=await add(env,'second',base+900000);
 await scanSearchNotifications(env,base+901000);
 await markSearchMatchesRead(env,user.id,{monitor_id:m.id,as_of:before.as_of,job_ids:[first.id,second.id]},base+902000);
 const after=await searchInbox(env,user.id,base+902000);
 assert.equal(after.monitors[0].unread,1);assert.equal(after.monitors[0].matches.find(j=>j.id===second.id).read_at,null);
 await scanSearchNotifications(env,base+1802000);
 assert.equal((await searchInbox(env,user.id,base+1803000)).monitors[0].matches.find(j=>j.id===first.id).read_at,iso(base+902000));
 await assert.rejects(markSearchMatchesRead(env,user.id,{monitor_id:m.id,as_of:iso(base+9999999),job_ids:[first.id]},base+903000),{status:400});
});

test('stopping, editing filters, removing searches and deleting a workspace revoke matches atomically',async t=>{
 const env=database(t),data=account(env);let m=await follow(env);await add(env,'one');await scanSearchNotifications(env,base+2000);
 const stale=env.sql.prepare('SELECT * FROM search_monitors').get();
 await configureSearchMonitor(env,user,{search_id:'search-a',enabled:false,monitor_id:m.id},base+3000);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_matches').get().n,0);
 await scanSearchMonitor(env,stale,{boards:[],licensed:[]},base+4000);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_matches').get().n,0);
 m=await follow(env,'search-a',user,base+5000);assert.notEqual(m.id,stale.id);
 await assert.rejects(configureSearchMonitor(env,user,{search_id:'search-a',enabled:false,monitor_id:stale.id}),{status:409});
 data.profile.name='Harmless profile edit';env.sql.prepare('UPDATE career_workspaces SET data=?,revision=revision+1').run(JSON.stringify(data));
 assert.equal(env.sql.prepare('SELECT id FROM search_monitors').get().id,m.id);
 data.searches[0].q='developer';env.sql.prepare('UPDATE career_workspaces SET data=?,revision=revision+1').run(JSON.stringify(data));
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_monitors').get().n,0);
 await follow(env);data.searches=[];env.sql.prepare('UPDATE career_workspaces SET data=?').run(JSON.stringify(data));
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_monitors').get().n,0);
 data.searches=[{id:'search-a',q:'engineer'}];env.sql.prepare('UPDATE career_workspaces SET data=?').run(JSON.stringify(data));await follow(env);
 env.sql.prepare('DELETE FROM career_workspaces WHERE user_id=?').run(user.id);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_monitors').get().n,0);
});

test('expired, inactive, stale or changed adverts disappear at read time without another scan',async t=>{
 const env=database(t);account(env,user,[{id:'search-a',q:'engineer',sponsorship:'mentioned'}]);await follow(env);
 const job=await add(env,'one');await scanSearchNotifications(env,base+2000);
 for(const [field,value] of [['closes_at',iso(base+3000)],['active',0],['last_seen',iso(base-72*3600000)],['sponsorship','unavailable']]) {
  const original=env.sql.prepare('SELECT * FROM jobs WHERE id=?').get(job.id)[field];
  env.sql.prepare('UPDATE jobs SET '+field+'=? WHERE id=?').run(value,job.id);
  assert.equal((await searchInbox(env,user.id,base+3000)).monitors[0].matches.length,0,field);
  env.sql.prepare('UPDATE jobs SET '+field+'=? WHERE id=?').run(original,job.id);
 }
 assert.equal((await searchInbox(env,user.id,base+3000)).monitors[0].matches.length,1);
});

test('saved-search matching agrees with public filters, including literal input and licensed employers',async t=>{
 const env=database(t),searches=[{id:'mentioned',sponsorship:'mentioned'},{id:'unavailable',sponsorship:'unavailable'},
  {id:'location',location:'London',level:'early_career',salary:'listed',sector:'technology'},
  {id:'literal',q:'%'},{id:'licence',licence:'matched'}];account(env,user,searches);
 const sponsor='fffc1b73b4b4d6d0acebbab8';
 env.sql.prepare('INSERT INTO metadata VALUES(?,?)').run('register',JSON.stringify({snapshot:'fixture',checked_at:iso(base),source_date:iso(base)}));
 env.sql.prepare('INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,?)').run(sponsor,'fixture','Monzo','London','','["A"]','["Skilled Worker"]',1);
 for(const s of searches) await follow(env,s.id);
 await add(env,'offer');await add(env,'no',base+1100,{sponsorship:'unavailable',evidence:'No visa sponsorship.'});
 await scanSearchNotifications(env,base+2000);
 const inbox=await searchInbox(env,user.id,base+3000);
 for(const s of searches) {
  const publicData=await (await jobsAPI(new URL('https://sponsorintel.london/api/jobs?'+new URLSearchParams(s)),env,base+3000)).json();
  assert.deepEqual(inbox.monitors.find(m=>m.search_id===s.id).matches.map(j=>j.id).sort(),publicData.items.map(j=>j.id).sort(),s.id);
 }
 env.sql.prepare('DELETE FROM sponsors').run();assert.equal((await searchInbox(env,user.id,base+3000)).monitors.find(m=>m.search_id==='licence').matches.length,0);
});

test('queue is bounded, rotates through waiting searches and excludes unverified users',async t=>{
 const env=database(t);
 for(let i=0;i<25;i++){const u={id:'fixture-'+i,emailVerified:true};account(env,u);await follow(env,'search-a',u);}
 env.sql.prepare("UPDATE user SET emailVerified=0 WHERE id='fixture-24'").run();
 const first=await scanSearchNotifications(env,base+1000);assert.equal(first.checked,20);
 const second=await scanSearchNotifications(env,base+2000);assert.equal(second.checked,4);
 assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_monitors WHERE checked_at IS NULL').get().n,1);
});

test('recent-match retention and stale-monitor health remain honest',async t=>{
 const env=database(t);account(env);await follow(env);await add(env,'old');await scanSearchNotifications(env,base+2000);
 const later=base+15*86400000;
 assert.equal((await searchInbox(env,user.id,later)).monitors[0].matches.length,0);
 assert.equal((await searchInbox(env,user.id,later)).monitors[0].delayed,true);
 await scanSearchNotifications(env,later);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM search_matches').get().n,0);
 const fake={checks:[],sources:[],immigration:[],metrics:[],jobs:{},search_notifications:{followed:1,oldest_check:iso(base),awaiting_first_check:0,last_run:{failed:0}}};
 assert.ok(businessFindings(fake,later).some(f=>f.id==='search-notifications'));
});
