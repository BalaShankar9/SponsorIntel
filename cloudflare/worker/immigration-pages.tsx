import React from 'react';
import {renderToString} from 'react-dom/server';
import {ImmigrationUpdates, type Feed} from '../src/updates';
import {immigrationAPI} from './immigration.js';
import {boundedText} from './data.js';

type Assets = {fetch: typeof fetch};
const safeJSON = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function immigrationHTML(feed: Feed, topic: string | null) {
  return renderToString(<ImmigrationUpdates initialFeed={feed} initialTopic={topic || 'all'} />);
}

export function immigrationUnavailable() {
  return new Response('<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Immigration updates temporarily unavailable | Sponsor Intel</title><main><h1>We could not check the immigration updates.</h1><p>Please try again shortly. Use the official guidance for current conditions.</p><a href="https://www.gov.uk/browse/visas-immigration">Read GOV.UK immigration guidance</a><p><a href="/">Sponsor Intel home</a></p></main></html>', {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','Retry-After':'60'}});
}

export async function renderImmigrationPage(request: Request, env: {ASSETS: Assets; DB: unknown}) {
  // The API applies the same current-source checks used by the interactive view.
  // No user-agent branch, build-time source copy, personal state or extra fetch.
  const feed: Feed = await (await immigrationAPI(env)).json();
  if (!feed.sources.length) return immigrationUnavailable();
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new Request(new URL('/updates/index.html', url)));
  if (!asset.ok) return immigrationUnavailable();
  const template = await boundedText(asset, 2_000_000);
  if (!template.includes('class="immigration-page"')) return immigrationUnavailable();
  const body = immigrationHTML(feed, url.searchParams.get('topic'));
  const headers = new Headers(asset.headers);
  for (const name of ['ETag','Last-Modified','Content-Length','Content-Encoding']) headers.delete(name);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('CDN-Cache-Control', 'no-store');
  if (url.hostname.endsWith('.workers.dev')) headers.set('X-Robots-Tag','noindex, follow');
  return new HTMLRewriter()
    .on('.immigration-page', {element(element) {element.replace(body, {html:true});}})
    .on('noscript', {element(element) {element.setInnerContent('You can read the checked guidance, choose topics and follow official source links without JavaScript. Enable JavaScript for automatic page refresh and feedback. Reload this page to check for newer information.', {html:false});}})
    .on('body', {element(element) {element.append('<script type="application/json" id="immigration-data">' + safeJSON(feed) + '</script>', {html:true});}})
    .transform(new Response(template, {headers}));
}
