// Local fictional adverts for the real installed-extension walkthrough.
// No browser automation, mocked extension APIs, external assets or application submissions.
import {createServer} from 'node:http';
const intro='<h1>Software engineer</h1><p class="location">London, UK · Example team · Fictional vacancy</p><h2>About the role</h2><p>Build and test software with a small product team. Work with designers and other engineers to improve reliable, accessible services.</p><h2>What you will bring</h2><p>Experience writing and reviewing code, explaining technical choices and collaborating with colleagues.</p><h2>Sponsorship</h2>';
const statements={
 offered:'We offer visa sponsorship for this role.',
 conditional:'We may provide visa sponsorship, subject to eligibility.',
 refused:'We cannot offer visa sponsorship for this role.',
 unclear:'Read the full role description before applying.',
 contradiction:'We offer visa sponsorship. This does not apply to this role.',
 stale:'We cannot offer visa sponsorship. This statement is out of date.'
};
const tail='<h2>Next step</h2><p>This is fictional demonstration content. There is no employer application, vacancy or recruitment service on this page.</p>';
const advert=(statement,extra='')=>`<article id="job-description">${intro}<p>${statement}</p>${extra}${tail}</article>`;
const fixtures=Object.fromEntries(Object.entries(statements).map(([key,text])=>[key,advert(text)]));
fixtures.hidden=advert(statements.conditional,'<p hidden>HIDDEN FICTIONAL REFUSAL: We cannot offer visa sponsorship.</p><div style="opacity:0;height:0;overflow:hidden"><p>HIDDEN FICTIONAL REFUSAL: We cannot offer visa sponsorship.</p></div><form><label>Fictional excluded application field<input value="PRIVATE FICTIONAL ANSWER" readonly></label></form>');
fixtures.collapsed=advert(statements.offered,'<details><summary>Additional role conditions</summary><p>We cannot offer visa sponsorship for this role.</p></details>');
fixtures.multiple=`<article class="job-description">${intro}<p>${statements.offered}</p>${tail}</article><article class="job-description"><h2>Second fictional role</h2><p>London engineer building and testing software. ${statements.refused}</p></article>`;
fixtures.oversized=advert('Long fictional advert. '.repeat(6000)+statements.offered);
const expected={offered:'offered',conditional:'conditional',refused:'unavailable',unclear:'unclear',contradiction:'unclear',stale:'unclear',hidden:'conditional; hidden/form markers excluded',collapsed:'capture held until expanded; then unclear',multiple:'automatic capture held',oversized:'automatic capture held'};
const html=(key,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional advert · ${key} · Sponsor Intel QA</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f6f0;color:#17382b;font:16px/1.6 system-ui,sans-serif}header{background:#173b2c;color:#fff;padding:22px 5vw}header strong{font-size:20px}header p{margin:3px 0;color:#d8ef8e}nav{display:flex;gap:12px;flex-wrap:wrap;padding:14px 5vw;border-bottom:1px solid #d9dfd2}nav a{color:#28533e;font-size:13px}main{max-width:850px;margin:28px 5vw;padding:30px;background:white;border:1px solid #d9dfd2;border-radius:16px}h1{font-size:34px;line-height:1.15;margin:0 0 10px}h2{font-size:17px;margin:22px 0 5px}p{margin:8px 0}.location{color:#607166}details{border:1px solid #d9dfd2;padding:12px;border-radius:8px}summary{cursor:pointer;font-weight:600}input{display:block;padding:8px}form{margin-top:16px}footer{max-width:850px;margin:20px 5vw;color:#607166;font-size:13px}@media(max-width:600px){main{padding:20px;margin:20px}h1{font-size:28px}}
</style></head><body><header><strong>Sponsor Intel · demonstration advert</strong><p>Fictional content for extension testing. No applications are accepted.</p></header><nav aria-label="Fictional test examples">${Object.keys(fixtures).map(name=>`<a href="/${name}"${name===key?' aria-current="page"':''}>${name}</a>`).join('')}</nav><main>${body}</main><footer>Use the installed Advert Check action to read and review this advert. This page does not calculate or display the extension's result.</footer></body></html>`;
const server=createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Read-only fictional fixture');}
 const key=new URL(req.url,'http://local').pathname.slice(1)||'offered';
 if(!Object.hasOwn(fixtures,key)){res.writeHead(404);return res.end('Unknown fictional example');}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.method==='HEAD'?undefined:html(key,fixtures[key]));
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({origin:`http://127.0.0.1:${server.address().port}`,scope:'Fictional pages for manual installed-extension QA; no mocked APIs or results',expected})));
