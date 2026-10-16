import React, {useEffect, useState} from 'react';
import {MapPin, ArrowUpRight, ArrowRight, Building2} from 'lucide-react';
import {CITY_DIRECTORY_PATH, cityDirectoryPath, readCityFilters, readInitialCityDirectory, type CityResult, type CityEmployer, type CityItem} from '../shared/sponsor-cities.js';

const source = 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';
const count = (n:number) => n.toLocaleString('en-GB');
const stamp = (s:string) => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : 'Not available';
export function SponsorCities({initialResult, initialSearch}:{initialResult?:CityResult;initialSearch?:string} = {}) {
  const search = initialSearch ?? (typeof location === 'undefined' ? '' : location.search);
  const [result,setResult] = useState<CityResult|null>(() => initialResult || (typeof document === 'undefined' ? null : readInitialCityDirectory(document.getElementById('city-directory-data')?.textContent || '',search)));
  const [error,setError] = useState('');
  const filters = result?.filters || readCityFilters(search);
  useEffect(() => {
    let active = true;
    if (!result) fetch('/api/sponsor-cities' + cityDirectoryPath(readCityFilters(search)).slice(CITY_DIRECTORY_PATH.length))
      .then(async r => { if (!r.ok) throw new Error('The register could not be loaded. Please try again.'); return r.json(); })
      .then(data => { if(active)setResult(data); }).catch(e => {if(active)setError(e.message);});
    const restore = (e:PageTransitionEvent) => {if(e.persisted)location.reload();};
    window.addEventListener('pageshow',restore);
    return () => {active=false;window.removeEventListener('pageshow',restore);};
  }, []);
  const city = filters.city;
  const cityLink = (name:string) => cityDirectoryPath({city:name,route:filters.route});
  return <section className="sponsor-city-page">
    <header className="city-hero">
      <div><span className="eyebrow"><MapPin size={15}/> YOUR LOCAL EMPLOYER DIRECTORY</span>
        <h1>{city ? <>Sponsor employers in <em>{city}.</em></> : <>Find sponsors.<br/><em>Start with your city.</em></>}</h1>
        <p>Explore organisations on the official Worker and Temporary Worker sponsor register, grouped by their listed town or city.</p>
        {city && <a className="city-back" href={cityDirectoryPath({route:filters.route})}>← Browse all towns & cities</a>}
      </div>
      <aside className="city-source"><span className="tiny-label">OFFICIAL REGISTER SNAPSHOT</span><strong>{result ? stamp(result.source_date) : 'Loading source date…'}</strong><a href={source} target="_blank" rel="noopener noreferrer">Check the GOV.UK source <ArrowUpRight size={16}/></a><span>Contains public sector information licensed under the Open Government Licence v3.0.</span></aside>
    </header>
    <p className="city-boundary"><strong>A licence is a starting point.</strong> It does not confirm an open job or sponsorship for your role. The register’s town or city may differ from the workplace.</p>
    {result?.stale && <p className="city-warning" role="status">This snapshot may be out of date or its latest refresh failed. Check the official register before relying on a listing.</p>}
    <form className="city-search" action={CITY_DIRECTORY_PATH} method="get">
      {city && <input type="hidden" name="city" value={city}/>}
      <label>{city ? 'Employer name' : 'Town or city'}<input name={city ? 'name' : 'q'} defaultValue={city ? filters.employer : filters.q} placeholder={city ? 'Search within this list' : 'Try Cardiff, Sheffield or Manchester'} maxLength={100}/></label>
      <label>Visa route<select name="route" defaultValue={filters.route}><option value="">All work routes</option>{result?.routes.map(r=><option key={r.name} value={r.name}>{r.name}</option>)}{filters.route&&!result?.routes.some(r=>r.name===filters.route)&&<option value={filters.route}>{filters.route}</option>}</select></label>
      {!city && <label>Browse order<select name="sort" defaultValue={filters.sort}><option value="count">Most listings</option><option value="az">A–Z</option></select></label>}
      <button className="primary-button" type="submit">{city ? 'Find employers' : 'Find places'} <ArrowRight size={17}/></button>
    </form>
    {!city && <nav className="city-popular" aria-label="Popular places"><span>Jump to</span>{['London','Manchester','Birmingham','Cardiff','Sheffield','Edinburgh'].map(name=><a key={name} href={cityLink(name)}>{name}</a>)}</nav>}
    {error && <div role="alert" className="city-warning">{error} <a href={cityDirectoryPath(filters)}>Reload directory</a></div>}
    {!result&&!error && <p role="status">Loading the latest available register snapshot…</p>}
    {result && <>
      <div className="city-results-heading"><h2>{count(result.total)} {city ? (result.total===1 ? 'employer listing' : 'employer listings') : (result.total===1 ? 'town or city' : 'towns & cities')}{filters.route ? ` · ${filters.route}` : ''}</h2><a href={city ? cityDirectoryPath({city}) : CITY_DIRECTORY_PATH}>Clear filters</a></div>
      {!city && <p className="city-caption">{count(result.summary.entries)} employer-and-location listings in the snapshot. {count(result.summary.without_city)} with no town or city supplied are excluded from this directory. Counts are listings, not vacancies or unique companies across the UK.</p>}
      {result.total===0 && <div className="city-empty"><Building2 size={30}/><h3>No matching {city ? 'employers' : 'places'} in this snapshot.</h3><p>Try another spelling or a wider route filter. This does not establish that no employer in the area holds a licence.</p><a href={CITY_DIRECTORY_PATH}>Browse all places</a></div>}
      <div className={city ? 'city-employers' : 'city-grid'}>
        {city ? (result.items as CityEmployer[]).map(e=><article key={e.id} className="city-employer"><span className="city-listing-label">REGISTER LISTING</span><h3>{e.name}</h3><p><MapPin size={15}/>{[e.city,e.county].filter(Boolean).join(', ')}</p><div className="city-routes">{e.routes.map(r=><span key={r}>{r}</span>)}</div><p className="city-caption">Licence rating: {e.ratings.join(' · ')}</p><a href={'/?employer='+encodeURIComponent(e.id)}>View licence & save employer <ArrowUpRight size={16}/></a></article>)
          : (result.items as CityItem[]).map(c=><a className="city-card" href={cityLink(c.city)} key={c.city}><MapPin size={21}/><h3>{c.city}</h3><strong>{count(c.count)} <span>{c.count===1 ? 'listing' : 'listings'}</span></strong>{!filters.route&&<small>{count(c.skilled_worker)} include Skilled Worker</small>}<span className="city-card-action">Explore employers <ArrowRight size={16}/></span></a>)}
      </div>
      {result.pages>1 && <nav className="city-pagination" aria-label="Directory pages">{result.page>1 ? <a href={cityDirectoryPath(filters,result.page-1)}>← Previous</a> : <span/>}<span>Page {result.page} of {count(result.pages)}</span>{result.page<result.pages ? <a href={cityDirectoryPath(filters,result.page+1)}>Next →</a> : <span/>}</nav>}
      {city && <aside className="city-next"><div><h2>Now look at the actual role.</h2><p>Our jobs collection has separate workplace and sponsorship evidence. Its selected coverage is smaller than this licence directory.</p></div><a className="secondary-button" href={'/jobs?'+new URLSearchParams({location:city})}>Explore jobs around {city} <ArrowUpRight size={16}/></a></aside>}
      <p className="city-caption">Register dated {stamp(result.source_date)} · Last import check {stamp(result.checked_at)}. Repeat route rows are combined for the same organisation name, town/city and county. Case-only location differences are grouped; original employer spelling is retained. Boroughs and spelling variants stay separate. Places sharing the same name appear together; check each listing’s county. <a href="/about">How our data works</a></p>
    </>}
  </section>;
}
