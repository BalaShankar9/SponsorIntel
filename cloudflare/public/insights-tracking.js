import {createCampaignContext, campaignLink} from '/campaigns.js';
const context = createCampaignContext(location.search);
// Only the finite campaign ID crosses the network, never the raw query string.
fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:location.pathname,campaign:context.id()}),keepalive:true}).catch(()=>{});
for (const link of document.querySelectorAll('a[href]')) {
  const href = link.getAttribute('href');
  const tagged = campaignLink(href, location.origin, context.id());
  if (tagged !== href) link.setAttribute('href', tagged);
}
