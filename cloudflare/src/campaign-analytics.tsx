import React from 'react';
type Row = {id:string; label:string; page_view:number; account_created:number; document_prepared:number; guidance_answer:number};
export function CampaignAnalytics({data}:{data?:{first_recorded:string|null;items:Row[]}}) {
  if (!data) return null;
  return <section className="career-panel campaign-panel" aria-labelledby="campaign-title">
    <span className="eyebrow">SOCIAL CAMPAIGNS</span>
    <h2 id="campaign-title">Which posts bring useful activity?</h2>
    <p className="fine-print">New-baseline counts from recognised campaign links, during the selected period. Signed-in owners and declared test requests are excluded; signed-out operators, repeat visits and bots can remain. CVs and cover letters count successful preparation responses, not downloads, submitted applications, unique people or job outcomes. Sourced replies exclude clarification and insufficient-evidence responses; citation checks alone do not prove legal accuracy.</p>
    {!data.first_recorded && <p className="campaign-empty">Waiting for the first recognised campaign visit. Zero counts do not mean a scheduled post has failed.</p>}
    <div className="campaign-table" tabIndex={0} role="region" aria-label="Campaign event counts, scroll horizontally on a small screen">
      <table><thead><tr><th scope="col">Post</th><th scope="col">Page opens</th><th scope="col">Sign-ups</th><th scope="col">CVs & cover letters</th><th scope="col">Sourced replies</th></tr></thead>
      <tbody>{data.items.map(row => <tr key={row.id}><th scope="row">{row.label}</th>{[row.page_view,row.account_created,row.document_prepared,row.guidance_answer].map((n,i)=><td key={i}>{n.toLocaleString('en-GB')}</td>)}</tr>)}</tbody></table>
    </div>
    <p className="fine-print">Attribution lasts up to 30 minutes in the current page or app. A reload or new tab may lose it; selected links from reports carry the same public campaign label forward. No visitor ID, analytics cookie or personal journey is stored. Counts cannot establish that a post caused an action. {data.first_recorded && <>First recorded campaign event in this period: {data.first_recorded} (UTC).</>}</p>
  </section>;
}
