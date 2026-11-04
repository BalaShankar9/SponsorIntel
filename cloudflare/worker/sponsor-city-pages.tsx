import React from 'react';
import {renderToString} from 'react-dom/server';
import {SponsorCities} from '../src/sponsor-cities';
import {cityPageMetadata,cityPageSchema} from '../src/seo';
import {cityDirectoryPath,readCityFilters,type CityResult} from '../shared/sponsor-cities.js';
import {getSponsorCities} from './sponsor-cities.js';
import {boundedText} from './data.js';
const safeJSON=(data:unknown)=>JSON.stringify(data).replace(/</g,'\\u003c');
export const cityHTML=(result:CityResult,search:string)=>renderToString(<SponsorCities initialResult={result} initialSearch={search}/>);
export function cityUnavailable() {
  return new Response('<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Directory temporarily unavailable | Sponsor Intel</title><main><h1>We couldn’t load the sponsor directory.</h1><p>This does not mean there are no sponsors in your city.</p><a href="/sponsors-by-city">Try again</a> · <a href="/">Sponsor Intel home</a></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex','Retry-After':'60'}});
}
export async function renderCityPage(request:Request,env:{ASSETS:{fetch:typeof fetch};DB:unknown}) {
  const url=new URL(request.url), filters=readCityFilters(url.search);
  const result:CityResult=await getSponsorCities(env,url.search);
  if (result.page!==filters.page) return new Response(null,{status:302,headers:{Location:cityDirectoryPath(result.filters),'Cache-Control':'no-store'}});
  const asset=await env.ASSETS.fetch(new Request(new URL('/sponsors-by-city/index.html',url)));
  if(!asset.ok)return cityUnavailable();
  const template=await boundedText(asset,2_000_000);
  if(!template.includes('class="sponsor-city-page"'))return cityUnavailable();
  const meta=cityPageMetadata(filters), canonical='https://sponsorintel.london'+meta.path;
  const indexable=meta.indexable&&!url.hostname.endsWith('.workers.dev'),robots=indexable?'index,follow,max-image-preview:large':'noindex,follow';
  const headers=new Headers(asset.headers);
  for(const key of ['ETag','Last-Modified','Content-Length','Content-Encoding'])headers.delete(key);
  headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','no-store');headers.set('CDN-Cache-Control','no-store');
  if(!indexable)headers.set('X-Robots-Tag','noindex, follow');
  return new HTMLRewriter()
    .on('.sponsor-city-page',{element(e){e.replace(cityHTML(result,url.search),{html:true});}})
    .on('title',{element(e){e.setInnerContent(meta.title);}})
    .on('link[rel="canonical"]',{element(e){e.setAttribute('href',canonical);}})
    .on('meta[name="robots"]',{element(e){e.setAttribute('content',robots);}})
    .on('meta[property="og:url"]',{element(e){e.setAttribute('content',canonical);}})
    .on('meta[property="og:title"],meta[name="twitter:title"]',{element(e){e.setAttribute('content',meta.title);}})
    .on('#structured-data',{element(e){e.setInnerContent(safeJSON(cityPageSchema(filters)),{html:true});}})
    .on('noscript',{element(e){e.setInnerContent('You can browse places, filter employers and follow directory pages without JavaScript. Enable JavaScript to save employers to your personal shortlist.');}})
    .on('body',{element(e){e.append('<script type="application/json" id="city-directory-data">'+safeJSON({path:meta.path,result})+'</script>',{html:true});}})
    .transform(new Response(template,{headers}));
}
