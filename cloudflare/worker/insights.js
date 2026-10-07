import { JOB_ORIGIN } from '../shared/job-detail.js';
export const INSIGHT_SLUG='uk-sponsorship-jobs-report';
const title='UK sponsorship jobs: the Sponsor Intel evidence report';
const description='A dated look at our selected UK job boards: sponsorship wording, early-career roles, salary transparency and the limits of the data.';
const escape=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON=(v)=>JSON.stringify(v).replace(/</g,'\\u003c');
const date=(v)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/London'});
const n=(v)=>Number(v).toLocaleString('en-GB');
const safeURL=(value)=>{try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}};

export function publicationGate(snapshot,now=Date.now()) {
  const age=now-Date.parse(snapshot.measured_at);
  if (!Number.isFinite(age)||age< -300000||age>1800000) return 'Evidence snapshot is not current.';
  if (snapshot.checks.length!==5 || snapshot.checks.some(x=>!x.ok||!x.security)) return 'Site health checks must pass before publishing.';
  const jobs=snapshot.jobs;
  if (['total','employers','offered','conditional','unavailable','not_stated','early_career','salary'].some(k=>!Number.isSafeInteger(jobs[k])||jobs[k]<0||jobs[k]>jobs.total) || jobs.total<10) return 'Insufficient or invalid job counts.';
  if (jobs.offered+jobs.conditional+jobs.unavailable+jobs.not_stated!==jobs.total) return 'Sponsorship categories do not reconcile.';
  if (snapshot.sources.reduce((a,x)=>a+x.roles,0)!==jobs.total) return 'Source coverage does not reconcile.';
  if (snapshot.sources.some(x=>x.roles && (x.paused || x.error || !safeURL(x.careers_url) || !Number.isFinite(Date.parse(x.last_success)) || now-Date.parse(x.last_success)>24*3600000 || Date.parse(x.last_success)>now+300000))) return 'A contributing source is paused, failed or older than 24 hours.';
  if (snapshot.held_batches) return 'Source batches awaiting review must be resolved before publication.';
  return null;
}

export async function publishInsight(env,id,snapshot,now=Date.now()) {
  const settings=await env.DB.prepare('SELECT enabled,publishing FROM business_controls WHERE singleton=1').first();
  if (!settings?.enabled||!settings.publishing) return {state:'paused'};
  const replay=await env.DB.prepare('SELECT id FROM insight_versions WHERE id=?').bind(id).first();
  if (replay) return {state:'published',path:'/insights/'+INSIGHT_SLUG,replayed:true};
  const prior=await env.DB.prepare('SELECT * FROM insight_publications WHERE slug=?').bind(INSIGHT_SLUG).first();
  if (prior && now-Date.parse(prior.updated_at)<7*86400000) return {state:'not_due',next_due:new Date(Date.parse(prior.updated_at)+7*86400000).toISOString()};
  const reason=publicationGate(snapshot,now);
  if (reason) return {state:'held',reason};
  const previous=prior?JSON.parse(prior.data):null;
  const data={measured_at:snapshot.measured_at,jobs:snapshot.jobs,
    sources:snapshot.sources.filter(x=>x.roles>0).map(({id,company,careers_url,last_success,roles})=>({id,company,careers_url,last_success,roles})),
    previous:previous?{measured_at:previous.measured_at,total:previous.jobs.total}:null,
    method_version:'selected-boards-v1'};
  const stamp=snapshot.measured_at,encoded=JSON.stringify(data);
  const base=`${snapshot.jobs.offered+snapshot.jobs.conditional} adverts in our selected UK catalogue contain positive or conditional sponsorship wording, out of ${snapshot.jobs.total} roles checked as of ${date(stamp)}. These are advert signals, not sponsorship guarantees. Our new report shows the evidence, coverage and limits.`;
  const expires=new Date(now+7*86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO insight_publications(slug,title,description,published_at,updated_at,state,data)
      SELECT ?,?,?,?,?,'published',? WHERE (SELECT enabled=1 AND publishing=1 FROM business_controls WHERE singleton=1)
      ON CONFLICT(slug) DO UPDATE SET title=excluded.title,description=excluded.description,updated_at=excluded.updated_at,state='published',data=excluded.data`)
      .bind(INSIGHT_SLUG,title,description,stamp,stamp,encoded),
    env.DB.prepare('INSERT INTO insight_versions(id,slug,created_at,data) SELECT ?,slug,updated_at,data FROM insight_publications WHERE slug=? AND updated_at=? AND state=\'published\'')
      .bind(id,INSIGHT_SLUG,stamp),
    env.DB.prepare("UPDATE social_outbox SET state='superseded' WHERE state='needs_connection' AND EXISTS(SELECT 1 FROM insight_versions WHERE id=?)").bind(id),
    ...['company','personal'].map(audience=>env.DB.prepare(`INSERT INTO social_outbox(id,publication_id,audience,text,state,created_at,expires_at)
      SELECT ?,?,?,?,'needs_connection',?,? WHERE EXISTS(SELECT 1 FROM insight_versions WHERE id=?)`)
      .bind(id+':'+audience,id,audience,
        (audience==='personal'?'I’m building Sponsor Intel to make the UK job search easier to navigate.\n\n':'')+base+'\n\n'+JOB_ORIGIN+'/insights/'+INSIGHT_SLUG+'?utm_source=linkedin&utm_medium=organic_social&utm_campaign=evidence-report',stamp,expires,id)),
  ]);
  const saved=await env.DB.prepare('SELECT id FROM insight_versions WHERE id=?').bind(id).first();
  return saved?{state:'published',path:'/insights/'+INSIGHT_SLUG}:{state:'paused'};
}

const styles=`body{margin:0;background:#f7f9f6;color:#1b332c;font-family:system-ui,-apple-system,sans-serif;line-height:1.65}*{box-sizing:border-box}a{color:#245c44;text-underline-offset:4px}header,footer,main{max-width:1100px;margin:auto;padding:28px}header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:1px solid #d8e3da}header>a{font-size:24px;font-weight:800;text-decoration:none;letter-spacing:-1px}nav{display:flex;flex-wrap:wrap;gap:18px;font-size:14px}main{padding-top:60px}h1{font-size:clamp(32px,5vw,58px);line-height:1.08;letter-spacing:-1.7px;max-width:890px;margin:16px 0 24px}h2{font-size:27px;letter-spacing:-.7px;line-height:1.25}h3{font-size:19px;line-height:1.35}.eyebrow{font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#50705c}.lead{font-size:20px;color:#476054;max-width:790px}.stamp{font-size:13px;color:#526557}.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:32px 0}.tile,.card{padding:24px;border:1px solid #dbe6db;border-radius:18px;background:#fff}.tile strong{font-size:35px;display:block;letter-spacing:-1px}.tile span{font-size:13px}.copy{max-width:800px}.copy>section{margin:42px 0}.note{background:#e8eee4;border-radius:14px;padding:20px 24px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:12px 10px;border-bottom:1px solid #d8e3da}th{font-size:12px;text-transform:uppercase}button,.cta{display:inline-block;background:#245c44;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600}.bar{display:flex;height:12px;border-radius:8px;overflow:hidden;background:#e5e8e0;margin:18px 0}.bar i{display:block}.split{display:grid;grid-template-columns:2fr 1fr;gap:25px;margin:32px 0}.skip{position:absolute;left:-9999px}.skip:focus{left:10px;top:10px;background:white;padding:10px}.muted{color:#57685d;font-size:14px}.links{display:flex;gap:20px;flex-wrap:wrap}footer{border-top:1px solid #d8e3da;margin-top:50px;font-size:13px} @media(max-width:650px){header{align-items:flex-start;flex-direction:column}main{padding:30px 20px}.tiles{grid-template-columns:repeat(2,1fr)}.tile{padding:18px}.tile strong{font-size:29px}.split{grid-template-columns:1fr}.lead{font-size:18px}nav{gap:14px}td,th{padding:10px 6px}}`;

function article(p) {
  const d=JSON.parse(p.data),j=d.jobs;
  return `<p class="eyebrow">The opportunity briefing</p><h1>${escape(p.title)}</h1><p class="lead">A clearer view of sponsorship wording in the jobs we monitor. Use the evidence to build a better shortlist.</p>
    <p class="stamp">By Sponsor Intel · Automated data report · First published ${date(p.published_at)} · Data checked ${escape(new Date(d.measured_at).toLocaleString('en-GB',{timeZone:'Europe/London',timeZoneName:'short'}))}</p>
    <div class="tiles">${[[j.total,'UK roles in this snapshot'],[j.offered,'Sponsorship stated'],[j.conditional,'Conditional sponsorship'],[j.early_career,'Early-career roles']].map(([v,label])=>`<div class="tile"><strong>${n(v)}</strong><span>${label}</span></div>`).join('')}</div>
    <div class="copy"><section><h2>What the adverts actually tell us</h2><p>Of the ${n(j.total)} current roles on ${n(j.employers)} selected employer boards, ${n(j.offered)} state that visa sponsorship is offered and ${n(j.conditional)} use conditional wording. Another ${n(j.unavailable)} explicitly say sponsorship is unavailable. The remaining ${n(j.not_stated)} do not state a clear sponsorship commitment.</p>
    <p class="note">An employer’s sponsor licence and an individual advert’s wording answer different questions. A licence does not confirm sponsorship for every role. Conditional wording does not establish your eligibility, and silence is not a refusal. Open the original advert and confirm the position with the employer.</p></section>
    <section><h2>Where to focus your next search</h2><p>There are ${n(j.early_career)} roles classified as early career in this snapshot. This count includes roles without positive sponsorship wording; it is not a count of sponsored graduate jobs. ${n(j.salary)} adverts include a captured salary excerpt, which may still need checking for currency, hours and pay period.</p><ol><li>Start with the role you can demonstrate you are qualified for. Compare the essential requirements with evidence from your own experience.</li><li>Read the exact sponsorship wording on the employer’s current advert. Ask the employer if the answer is unclear.</li><li>Check the employer’s legal identity against the current sponsor register. Do not rely on a similar trading name.</li><li>Save a focused shortlist, prepare a truthful application and review the draft before sending.</li></ol><div class="links"><a class="cta" href="/jobs?sponsorship=mentioned">Explore sponsorship wording</a><a href="/jobs?level=early_career">Explore early-career roles</a></div></section>
    <section><h2>What changed since the previous report?</h2>${d.previous?`<p>The selected catalogue contained ${n(d.previous.total)} roles on ${date(d.previous.measured_at)} and ${n(j.total)} in this snapshot. This difference can reflect new or removed adverts and changes in board coverage. It does not measure the overall UK job market or the number of sponsorship offers made.</p>`:'<p>This is the first published snapshot in this series. We will compare it with the next checked report instead of presenting an unmeasured growth trend.</p>'}</section>
    <section><h2>Source coverage and method</h2><p>This report counts active records observed within the preceding 72 hours, with each contributing board successfully checked within 24 hours at publication. It excludes private user data. Sponsorship and early-career labels are automated interpretations that can be wrong; the original advert remains the source to verify.</p><p>Our selected employer boards are a limited sample. Counts can include similar roles on separate boards and do not represent all UK vacancies. We update this same report at most weekly after its checks pass. The numbers above describe the dated snapshot; <a href="/jobs">the jobs page</a> reflects more recent checks.</p>
    <div class="table-wrap"><table><caption>Contributing employer boards at publication</caption><thead><tr><th scope="col">Employer board</th><th scope="col">Roles</th><th scope="col">Last successful check</th></tr></thead><tbody>${d.sources.map(s=>`<tr><td><a href="${escape(safeURL(s.careers_url)||'/jobs')}" rel="noopener noreferrer">${escape(s.company)}</a></td><td>${n(s.roles)}</td><td>${date(s.last_success)}</td></tr>`).join('')}</tbody></table></div></section>
    <section><h2>Check a claim. Help improve the evidence.</h2><p>Found an incorrect label or a vacancy that has closed? Open that job’s page and use its report button. For a correction to this report, use the feedback button on <a href="/">Sponsor Intel</a> and include this page’s address.</p><p class="muted">Compiled automatically from checked database counts using a reviewed report template. This article is not a legal review or personalised immigration advice. Read our <a href="/editorial-policy">editorial standards</a> and <a href="/guides/sponsorship-in-job-adverts">advert wording guide</a>.</p></section></div>`;
}

export async function insightsResponse(request,env) {
  const path=new URL(request.url).pathname;
  const p=await env.DB.prepare('SELECT * FROM insight_publications WHERE slug=?').bind(INSIGHT_SLUG).first();
  if (path==='/insights/feed.xml') {
    const item=p?.state==='published'?`<item><title>${escape(p.title)}</title><link>${JOB_ORIGIN}/insights/${p.slug}</link><guid isPermaLink="true">${JOB_ORIGIN}/insights/${p.slug}</guid><pubDate>${new Date(p.updated_at).toUTCString()}</pubDate><description>${escape(p.description)}</description></item>`:'';
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Sponsor Intel insights</title><link>${JOB_ORIGIN}/insights</link><description>Evidence-backed reports for your UK job search.</description>${item}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'no-store'}});
  }
  const isArticle=path==='/insights/'+INSIGHT_SLUG;
  const available=p?.state==='published';
  const status=isArticle&&!available?(p?410:404):200;
  const body=isArticle?(available?article(p):'<h1>This report is not available.</h1><p>It may be awaiting publication or a correction.</p><a href="/insights">Read our insights</a>'):
    `<p class="eyebrow">Sponsor Intel insights</p><h1>Understand the evidence.<br>Make your next move.</h1><p class="lead">Original reports from the opportunities we monitor, with the source, date and limits in plain sight.</p><div class="split"><section class="card"><p class="eyebrow">UK opportunity report</p><h2>${escape(title)}</h2><p>${escape(description)}</p>${available?`<p class="stamp">Updated ${date(p.updated_at)}</p><a class="cta" href="/insights/${p.slug}">Read the report →</a>`:'<p class="muted">The first report will appear after the automated evidence and site checks pass.</p>'}</section><aside class="card"><h2>Clarity before action.</h2><p>A sponsor licence, advert wording and personal eligibility are different checks. We help you keep the evidence separate.</p><a href="/guides/sponsorship-in-job-adverts">Read the sponsorship guide →</a></aside></div><p class="muted">Reports are compiled automatically from checked aggregate data. Dates reflect real snapshots. We do not publish personalised legal advice or claim to cover every UK job.</p><div class="links"><a href="/updates">Official immigration updates</a><a href="/insights/feed.xml">RSS feed</a><a href="/editorial-policy">Editorial standards</a></div>`;
  const pageTitle=isArticle&&available?p.title:'Insights for your UK job search';
  const indexable=status===200&&!new URL(request.url).hostname.endsWith('.workers.dev');
  const schema=isArticle&&available?{'@context':'https://schema.org','@type':'Article',headline:p.title,description:p.description,datePublished:p.published_at,dateModified:p.updated_at,author:{'@type':'Organization',name:'Sponsor Intel',url:JOB_ORIGIN+'/about'},publisher:{'@type':'Organization',name:'Sponsor Intel',url:JOB_ORIGIN},mainEntityOfPage:JOB_ORIGIN+path}:null;
  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(pageTitle)} | Sponsor Intel</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable?'index,follow':'noindex,follow'}"><link rel="canonical" href="${JOB_ORIGIN+path}"><link rel="icon" href="/favicon.svg"><link rel="alternate" type="application/rss+xml" title="Sponsor Intel insights" href="/insights/feed.xml"><meta property="og:title" content="${escape(pageTitle)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${JOB_ORIGIN+path}"><meta property="og:image" content="${JOB_ORIGIN}/share-card-v1.jpg"><meta property="og:type" content="${isArticle?'article':'website'}"><meta name="twitter:card" content="summary_large_image"><style>${styles}</style>${schema?`<script type="application/ld+json">${safeJSON(schema)}</script>`:''}<script src="/insights-tracking.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header><a href="/">Sponsor<span>Intel</span></a><nav aria-label="Main navigation"><a href="/jobs">Find jobs</a><a href="/updates">Immigration updates</a><a href="/insights">Insights</a><a href="/signup">Create an account</a></nav></header><main id="main">${body}</main><footer>Sponsor Intel · Your next chapter<div class="links"><a href="/about">Our data</a><a href="/guides">Career guides</a><a href="/advisers">Find regulated advice</a></div></footer></body></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',...(indexable?{}:{'X-Robots-Tag':'noindex, follow'})}});
}
