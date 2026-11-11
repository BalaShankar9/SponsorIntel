// Fictional local DOM acceptance. Use connected browser controls; no installed
// extension, permission injection, real site or external service is simulated.
// Optional first argument is a directory extracted from the reviewed archive.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const packageDir=resolve(process.argv[2]||fileURLToPath(new URL('../extension/',import.meta.url)));
const offer='<p>We offer visa sponsorship.</p>';
const refusal='<p>HIDDEN FICTIONAL NOTE. We cannot offer visa sponsorship.</p>';
const intro='<h1>Fictional London engineer</h1><p>Build and test software in our fictional team.</p>';
const fixtures={
 opacity:offer+`<div style="opacity:0">${refusal}</div>`,
 collapse:offer+`<table style="visibility:collapse"><tr><td>${refusal}</td></tr></table>`,
 hidden:offer+`<div hidden>${refusal}</div>`,
 aria:offer+`<div aria-hidden="true">${refusal}</div>`,
 display:offer+`<div style="display:none">${refusal}</div>`,
 content:offer+`<div style="content-visibility:hidden">${refusal}</div>`,
 closed:offer+`<details><summary>Additional role conditions</summary>${refusal}</details>`,
 open:offer+`<details open><summary>Additional role conditions</summary>${refusal}</details>`,
 visible:offer+refusal,
 forms:offer+'<form><label>PRIVATE FICTIONAL FORM<input value="PRIVATE FICTIONAL ANSWER"></label></form><textarea>PRIVATE FICTIONAL CV</textarea>',
 inline:'<p>We <strong>may provide</strong> visa sponsorship, subject to eligibility.</p>',
 opaqueRoot:offer,
 closedRoot:offer,
 multiple:offer,
 unsupported:offer,
 oversized:offer+'<p>'+('Fictional long text. '.repeat(6000))+'</p>',
 complex:offer+'<span>x</span>'.repeat(12010),
};
const expected={opacity:'offered',collapse:'offered',hidden:'offered',aria:'offered',display:'offered',content:'offered',closed:'error',open:'unclear',visible:'unclear',forms:'offered',inline:'conditional',opaqueRoot:'unclear',closedRoot:'error',multiple:'error',unsupported:'error',oversized:'error',complex:'error'};
const server=createServer((req,res)=>{
 const key=new URL(req.url,'http://local').pathname.slice(1);
 if(key==='popup-local'){res.setHeader('Content-Type','text/html');return res.end(readFileSync(resolve(packageDir,'popup.html'),'utf8').replace('<script type="module"', '<section id="job-description"><h2>Fictional local popup integration</h2><p>London engineer building software for our fictional team.</p>'+offer+'<details><summary>Additional role conditions</summary>'+refusal+'</details></section><script>window.chrome={tabs:{query:async()=>[{id:1,url:location.href}]},scripting:{executeScript:async({func})=>[{result:func()}]}};</script><script type="module"'));}
 if(['capture.js','analyse.js','popup.js','popup.css'].includes(key)){res.setHeader('Content-Type',key.endsWith('.css')?'text/css':'application/javascript');return res.end(readFileSync(resolve(packageDir,key)));}
 if(!(key in fixtures)){res.statusCode=404;return res.end('Unknown fictional fixture.');}
 let role=`<article id="job-description">${intro}${fixtures[key]}</article>`;
 if(key==='opaqueRoot')role=`${intro}<div style="opacity:0">${role}</div>`;
 if(key==='closedRoot')role=`<details id="job-description"><summary>${intro}</summary>${offer}</details>`;
 if(key==='multiple')role=`<article class="job-description">${intro}${offer}</article><article class="job-description">${intro}${refusal}</article>`;
 res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','no-store');
 res.end(`<!doctype html><meta charset="utf-8"><title>Capture boundary QA — ${key}</title><style>body{max-width:780px;margin:2rem auto;padding:1rem;font:16px system-ui;color:#173329}button{padding:.7rem;margin:.4rem}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f3ee;padding:1rem}</style><header><h1>Fictional capture boundary test</h1><p>Fixture: ${key}. Expected automatic outcome: ${expected[key]}. Local component test; not installed-extension acceptance.</p></header><main>${role}</main><button id="select">Select advert</button><button id="capture">Capture advert</button><pre id="output" aria-live="polite">Ready</pre><script type="module">import {captureAdvert} from '/capture.js';import {analyseAdvert} from '/analyse.js';${key==='unsupported'?'Element.prototype.checkVisibility=undefined;':''}document.querySelector('#select').onclick=()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#job-description')||document.querySelector('main'));window.getSelection().removeAllRanges();window.getSelection().addRange(range);};document.querySelector('#capture').onclick=()=>{const captured=captureAdvert();document.querySelector('#output').textContent=JSON.stringify({captured,result:captured.error?null:analyseAdvert(captured.text||'',true)},null,2)};</script>`);
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({origin:'http://127.0.0.1:'+server.address().port,fixtures:expected,scope:'Fictional local DOM; no browser automation or installed extension'})));
