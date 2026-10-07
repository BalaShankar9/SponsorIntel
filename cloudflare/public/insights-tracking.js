// Aggregate page counts only; no query strings, referrers or personal IDs.
fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:location.pathname}),keepalive:true}).catch(()=>{});
