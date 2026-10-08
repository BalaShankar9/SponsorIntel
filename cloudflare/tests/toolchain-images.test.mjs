import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Resolve the exact native library loaded by Miniflare, including nested installs.
const require = createRequire(import.meta.url);
const fromMiniflare = createRequire(require.resolve('miniflare'));
const sharp = fromMiniflare('sharp');
const atLeast = (actual, minimum) => {
  if (typeof actual !== 'string' || !/^\d+\.\d+\.\d+$/.test(actual)) return false;
  const a = actual.split('.').map(Number), b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return true;
};

test('Miniflare loads the patched SVG library and its local Images binding still transforms images', {timeout:30000}, async () => {
  assert.ok(atLeast(sharp.versions.sharp, '0.35.5'), 'GHSA-wq5f-xc86-pv6w: sharp must be patched');
  assert.ok(atLeast(sharp.versions.rsvg, '2.63.2'), 'the actually loaded native SVG library must also be patched');
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules:true, compatibilityDate:'2026-10-04', cf:false,
    images:{binding:'IMAGES'},
    // Fictional in-memory image. No external URLs, credentials or remote bindings.
    script:`export default { async fetch(request, env) {
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16"><rect width="24" height="16" fill="#186749"/></svg>';
      const stream=new Response(svg).body;
      if(new URL(request.url).pathname==='/info') return Response.json(await env.IMAGES.info(stream));
      return (await env.IMAGES.input(stream).transform({width:12,height:8}).output({format:'image/png'})).response();
    }};`,
  }));
  try {
    const infoResponse=await mf.dispatchFetch('http://localhost/info');
    assert.equal(infoResponse.status,200);
    const info=await infoResponse.json();
    assert.equal(info.format,'image/svg+xml');
    const response=await mf.dispatchFetch('http://localhost/resize');
    assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'image/png');
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const metadata=await sharp(bytes).metadata();
    assert.equal(metadata.width,12); assert.equal(metadata.height,8);
  } finally { await mf.dispose(); }
});
