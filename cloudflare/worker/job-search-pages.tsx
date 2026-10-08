import React from 'react';
import { renderToString } from 'react-dom/server';
import { CareerProvider } from '../src/career-data';
import { Vacancies } from '../src/vacancies';
import { jobsPageMetadata, jobsPageSchema } from '../src/seo';
import { readJobSearch, jobSearchPath, type JobsResult } from '../shared/job-search.js';
import { jobsAPI } from './jobs.js';
import { boundedText } from './data.js';

const safeJSON = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
export function jobSearchHTML(result: JobsResult, search: string) {
  return renderToString(<CareerProvider><Vacancies initialResult={result} initialSearch={search} go={() => {}} /></CareerProvider>);
}
export function jobSearchUnavailable() {
  return new Response('<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Opportunities temporarily unavailable | Sponsor Intel</title><main><h1>We couldn’t load current opportunities.</h1><p>Please try again shortly. A failed check does not mean there are no jobs.</p><a href="/jobs">Try loading opportunities again</a><p><a href="/">Sponsor Intel home</a></p></main></html>', {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex','Retry-After':'60'}});
}
export async function renderJobSearchPage(request: Request, env: { ASSETS: { fetch: typeof fetch }; DB: unknown }) {
  const url = new URL(request.url), filters = readJobSearch(url.search);
  const path = jobSearchPath(filters, filters.page);
  // Use the exact public API query and read-time expiry/licence rules, through
  // the local binding. No loopback HTTP, copied feed or customer records.
  const result: JobsResult = await (await jobsAPI(new URL(path.replace('/jobs', '/api/jobs'), url), env)).json();
  if (result.page !== filters.page) {
    if (result.page === 1) url.searchParams.delete('page');
    else url.searchParams.set('page', String(result.page));
    return new Response(null, {status:302,headers:{Location:url.href,'Cache-Control':'no-store'}});
  }
  const asset = await env.ASSETS.fetch(new Request(new URL('/jobs/index.html', url)));
  if (!asset.ok) return jobSearchUnavailable();
  const template = await boundedText(asset, 2_000_000);
  if (!template.includes('class="vacancies-page"')) return jobSearchUnavailable();
  const body = jobSearchHTML(result, url.search), meta = jobsPageMetadata(filters, result.page);
  const indexable = meta.indexable && !url.hostname.endsWith('.workers.dev');
  const robots = indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow';
  const headers = new Headers(asset.headers);
  for (const name of ['ETag','Last-Modified','Content-Length','Content-Encoding']) headers.delete(name);
  headers.set('Content-Type','text/html; charset=utf-8');
  headers.set('Cache-Control','no-store');
  headers.set('CDN-Cache-Control','no-store');
  if (!indexable) headers.set('X-Robots-Tag','noindex, follow');
  const canonical = 'https://sponsorintel.london' + meta.path;
  return new HTMLRewriter()
    .on('.vacancies-page', {element(element) {element.replace(body,{html:true});}})
    .on('title', {element(element) {element.setInnerContent(meta.title);}})
    .on('link[rel="canonical"]', {element(element) {element.setAttribute('href',canonical);}})
    .on('meta[name="robots"]', {element(element) {element.setAttribute('content',robots);}})
    .on('meta[property="og:url"]', {element(element) {element.setAttribute('content',canonical);}})
    .on('meta[property="og:title"],meta[name="twitter:title"]', {element(element) {element.setAttribute('content',meta.title);}})
    .on('#structured-data', {element(element) {element.setInnerContent(safeJSON(jobsPageSchema(filters,result.page)),{html:true});}})
    .on('noscript', {element(element) {element.setInnerContent('You can read current roles, search, change filters and follow the next page without JavaScript. Enable JavaScript to save searches and use your personal workspace. Reload to check for newer information.');}})
    .on('body', {element(element) {element.append('<script type="application/json" id="jobs-data">'+safeJSON({path:meta.path,result})+'</script>',{html:true});}})
    .transform(new Response(template,{headers}));
}
