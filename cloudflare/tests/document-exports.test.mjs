import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { extractRawText } from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

let vite, createDocument;
const originalFetch=globalThis.fetch;
before(async()=>{
  vite=await createServer({server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
  ({createDocument}=await vite.ssrLoadModule('/src/documents.ts'));
  globalThis.fetch=async path=>{assert.equal(path,'/fonts/NotoSans-Regular.ttf');return new Response(await readFile(new URL('../public/fonts/NotoSans-Regular.ttf',import.meta.url)));};
});
after(async()=>{globalThis.fetch=originalFetch;await vite?.close();});
const text='ALEX MORGAN\nFictional export test — Café, naïve, José, £32,500 and 25%.\n\nEXPERIENCE\n'+Array.from({length:20},(_,i)=>`• Evidence item ${String(i+1).padStart(2,'0')}: compared fictional records and documented the result. This is a test, not a real applicant's experience. `+'Checked source information before writing the handover. '.repeat(3)).join('\n\n')+'\n\nEDUCATION\nFictional Institute\n\nEND OF DOCUMENT\nSI-EXPORT-END';
const normalize=s=>s.replace(/\s+/g,' ').trim();

test('Word output preserves all original paragraphs, Unicode and final marker as a downloadable file',async()=>{
  const result=await createDocument(text+'\nతెలుగు','docx','../Alex <CV>');
  assert.equal(result.filename,'Alex CV.docx');assert.match(result.blob.type,/wordprocessingml/);
  const extracted=await extractRawText({buffer:Buffer.from(await result.blob.arrayBuffer())});
  assert.equal(normalize(extracted.value),normalize(text+'\nతెలుగు'));
});
test('multi-page PDF retains every item in order, supported characters and safe page bounds',async()=>{
  const result=await createDocument(text,'pdf','Alex CV');
  assert.equal(result.filename,'Alex CV.pdf');assert.equal(result.blob.type,'application/pdf');
  const task=getDocument({data:new Uint8Array(await result.blob.arrayBuffer()),useSystemFonts:true});
  try {
    const pdf=await task.promise;assert.ok(pdf.numPages>=2);
    let all='';
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p), content=await page.getTextContent(),viewport=page.getViewport({scale:1});
      for(const item of content.items){if(!('str' in item))continue;all+=item.str+' ';
        if(item.str.trim()){const [,,,,x,y]=item.transform;assert.ok(x>=49&&x+item.width<=viewport.width-49,`horizontal bounds page ${p}`);assert.ok(y>=49&&y<=viewport.height-49,`vertical bounds page ${p}`);}
      }
    }
    assert.equal(normalize(all),normalize(text));
  } finally {await task.destroy();}
});
test('unsupported PDF characters fail explicitly rather than silently losing a name; Word preserves them',async()=>{
  await assert.rejects(createDocument('అలెక్స్\nFictional CV','pdf','CV'),/does not cover every character/);
});
test('a failed font download cannot return a misleading PDF',async()=>{
  const saved=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:503});
  try {await assert.rejects(createDocument('Alex Morgan','pdf','CV'),/font could not load/);} finally {globalThis.fetch=saved;}
});
