import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRequest } from '../shared/public-request.js';

test('a failed optional request does not cancel or discard a successful register request', async () => {
  const fetcher = async path => path === '/api/meta'
    ? Response.json({ source_date: '2026-10-28', employers: 3 })
    : Response.json({ error: 'Temporarily unavailable' }, { status: 503 });
  const [register, featured] = await Promise.allSettled([
    publicRequest('/api/meta', { fetcher }), publicRequest('/api/featured', { fetcher }),
  ]);
  assert.equal(register.status, 'fulfilled');
  assert.equal(register.value.employers, 3);
  assert.equal(featured.status, 'rejected');
  assert.match(featured.reason.message, /Temporarily unavailable/);
  assert.deepEqual(await publicRequest('/api/featured', { fetcher: async () => Response.json({ items: [] }) }), { items: [] });
});

test('provider HTML and network failure produce readable retry messages, never empty success', async () => {
  await assert.rejects(publicRequest('/api/meta', { fetcher: async () => new Response('<html>unavailable</html>', { status: 503 }) }), /could not load/);
  await assert.rejects(publicRequest('/api/meta', { fetcher: async () => { throw new TypeError('Failed to fetch'); } }), /Check your connection/);
});

test('an unresponsive read is aborted within its deadline without retrying automatically', async () => {
  let calls = 0, aborted = false;
  const fetcher = (_path, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  await assert.rejects(publicRequest('/api/meta', { fetcher, timeoutMs: 10 }), /taking longer than expected/);
  assert.equal(calls, 1);
  assert.equal(aborted, true);
});

test('navigation cancellation remains cancellation instead of becoming an outage message', async () => {
  const controller = new AbortController();
  const request = publicRequest('/api/meta', { signal: controller.signal, fetcher: (_path, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});
