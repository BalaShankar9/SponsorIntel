export function opportunityFixture(now){
 const at=new Date(now).toISOString(),day=at.slice(0,10),id='111111111111111111111111';
 const url='https://job-boards.greenhouse.io/monzo/jobs/123',quote='We may provide visa sponsorship, subject to eligibility.',title='Fictional C# Engineer';
 const statements=[
  ["INSERT INTO metadata(key,value) VALUES('register',?)",JSON.stringify({snapshot:'fictional-snapshot',source_date:day,checked_at:at})],
  ["INSERT INTO sponsors VALUES(?,?,?,?,?,?,?,1)",'fffc1b73b4b4d6d0acebbab8','fictional-snapshot','Fictional Registered Firm Ltd','London','',JSON.stringify(['Worker (A rating)']),JSON.stringify(['Skilled Worker'])],
  ["INSERT INTO job_sources(id,company,careers_url,last_success,checked_at) VALUES('monzo','Fictional employer',?,?,?)",url,at,at],
  ["INSERT INTO jobs(id,board_id,company,title,location,description,apply_url,provider,sponsorship,evidence,level,first_seen,last_seen) VALUES(?,'monzo','Fictional employer',?,'London',?,?,'greenhouse','conditional',?,'experienced',?,?)",id,title,'Build fictional examples.\n'+quote+'\nApplicants must meet the advertised role requirements.',url,quote,at,at],
  ["INSERT INTO business_runs(id,state,created_at) VALUES('sample-fixture','completed',?)",at],
  ["INSERT INTO job_link_checks(id,run_id,source_id,job_id,day,company,title,url,source_seen_at,state,created_at,finished_at,evidence) VALUES('sample-fixture','sample-fixture','monzo',?,?,'Fictional employer',?,?,?,'checked',?,?,?)",id,day,title,url,at,at,at,JSON.stringify({chain:[{url,status:200}],title_match:true,closure_signal:null,body_sha256:'a'.repeat(64)})],
 ];
 return {id,url,quote,title,statements};
}
