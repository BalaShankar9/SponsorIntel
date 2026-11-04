// Local-only fictional data. The control page changes failures without reloading
// the app, so the visible retry buttons exercise actual recovery.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const origin = 'http://127.0.0.1:5204';
let mode = 'partial';
const calls = {};
const meta = {source_date:'2026-10-28',source_url:'https://www.gov.uk/',publication_url:'https://www.gov.uk/',employers:1,skilled_worker:1,source_rows:1,checked_at:'2026-10-28T07:15:00Z',cities:1,refresh_error:null,routes:[]};
const employer = {id:'f'.repeat(24),name:'Fictional QA Employer',city:'Cardiff',county:'',routes:['Skilled Worker'],ratings:['Worker (A rating)']};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin), path = url.pathname;
    const json = (data, status = 200) => { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data)); };
    if (path === '/__qa') {
      if (['partial','offline','healthy','slow','search-error'].includes(url.searchParams.get('mode'))) mode = url.searchParams.get('mode');
      if (url.searchParams.has('reset')) for (const key of Object.keys(calls)) delete calls[key];
      res.writeHead(200, {'Content-Type':'text/html','Cache-Control':'no-store'});
      return res.end(`<h1>Fictional public loading checks</h1><p>Mode: ${mode}</p>${['partial','offline','healthy','slow','search-error'].map(m=>`<a href="/__qa?mode=${m}">${m}</a> `).join('')}<p><a href="/">Open app</a> <a href="/__qa?reset=1">Reset counters</a></p><pre>${JSON.stringify(calls,null,2)}</pre>`);
    }
    if (path.startsWith('/api/')) {
      calls[path] = (calls[path] || 0) + 1;
      if (path === '/api/auth/get-session') return json(null);
      if (path === '/api/meta' && mode === 'slow') { req.on('close',()=>{}); return; }
      if (['/api/meta','/api/featured','/api/cities'].includes(path) && (mode === 'offline' || (mode === 'partial' && path !== '/api/meta'))) return json({error:'Temporarily unavailable. Please try again.'},503);
      if (path === '/api/meta') return json(meta);
      if (path === '/api/featured') return json({items:[employer]});
      if (path === '/api/cities') return json([{city:'Cardiff',count:1}]);
      if (path === '/api/sponsors') return mode === 'search-error' ? json({error:'Temporarily unavailable. Please try again.'},503) : json({items:[employer],total:1,pages:1});
      return json({});
    }
    const file = /^\/(assets|fonts)\/[a-zA-Z0-9_./-]+$/.test(path) && !path.includes('..') ? path : '/index.html';
    res.writeHead(200, {'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'text/html','Cache-Control':'no-store'});
    res.end(await readFile(new URL('../../dist'+file,import.meta.url)));
  } catch { res.writeHead(500);res.end('Local fictional preview failed.'); }
}).listen(5204,'127.0.0.1',()=>console.log('Fictional loading controls: '+origin+'/__qa'));
