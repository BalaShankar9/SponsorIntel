// Recognise a public advert, never an application form or a whole catalogue.
// This is a URL identity guard, not employer/licence or vacancy verification.
export function isLeverHost(host) {
  return host === 'jobs.lever.co' || host === 'jobs.eu.lever.co';
}

export function leverAdvertURL(value, allowApplication = false) {
  let url; try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || !isLeverHost(url.hostname)) return null;
  const match = url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/apply)?\/?$/i);
  if (!match || (match[3] && !allowApplication)) return null;
  url.pathname = `/${match[1]}/${match[2].toLowerCase()}`;
  url.hash = '';
  return url.href;
}
