// Public read requests must finish with either data or an actionable error.
export async function publicRequest(path, { signal, fetcher = fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetcher(path, { signal: controller.signal });
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('We could not load this right now. Please try again.');
    }
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'We could not load this right now. Please try again.');
    return data;
  } catch (error) {
    if (timedOut) throw new Error('This is taking longer than expected. Please try again.');
    if (!controller.signal.aborted && error instanceof TypeError) throw new Error('We could not connect. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
