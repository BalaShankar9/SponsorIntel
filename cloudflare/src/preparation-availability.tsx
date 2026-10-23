import React, { useCallback, useEffect, useRef, useState } from 'react';
import { preparationAllowed, preparationMessages, manualApplicationId, type PreparationState } from '../shared/preparation-availability.js';
import {savedAdvertState,type AdvertSnapshot,type PreparationSnapshot} from '../shared/advert-version.js';
import {type CareerApplication,sponsorLabels} from './career-data';
import './advert-review.css';
type State = PreparationState | 'checking';

export function usePreparationAvailability(application?: CareerApplication) {
  const jobId=application?.jobId || '';
  const latestApplication=useRef(application);latestApplication.current=application;
  const [snapshot, setSnapshot] = useState<{jobId: string; state: State; advert?:AdvertSnapshot}>({jobId, state: manualApplicationId(jobId) ? 'manual' : 'checking'});
  const active = useRef(jobId), serial = useRef(0);
  active.current = jobId;
  const refresh = useCallback(async (): Promise<PreparationState> => {
    const attempt = ++serial.current;
    if (manualApplicationId(jobId)) { setSnapshot({jobId, state: 'manual'}); return 'manual'; }
    setSnapshot({jobId, state: 'checking'});
    let received: PreparationSnapshot = {state:'unavailable'};
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/career/availability?job=' + encodeURIComponent(jobId), {cache:'no-store', signal:controller.signal});
      const result = await response.json();
      if (response.ok && result.jobId === jobId && (result.state === 'current' || Object.hasOwn(preparationMessages, result.state))) received = {state:result.state,advert:result.advert};
    } catch { /* Missing status is not evidence that the role is current. */ }
    finally { clearTimeout(timer); }
    if (active.current !== jobId || serial.current !== attempt) return 'unavailable';
    setSnapshot({jobId,...received});
    return savedAdvertState(latestApplication.current,received);
  }, [jobId]);
  useEffect(() => {
    void refresh();
    if (manualApplicationId(jobId)) return;
    const visible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(visible, 5 * 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { ++serial.current; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [jobId, refresh]);
  const state: State = snapshot.jobId === jobId ? snapshot.state === 'checking' ? 'checking' : savedAdvertState(application,{...snapshot,state:snapshot.state}) : manualApplicationId(jobId) ? 'manual' : 'checking';
  return {state, advert:snapshot.jobId===jobId?snapshot.advert:undefined, ready:preparationAllowed(state), refresh};
}

export function PreparationAvailability({application, advert, state, busy, refresh, review}: {
  application:CareerApplication; advert?:AdvertSnapshot; state: State; busy: boolean; refresh: () => Promise<PreparationState>;
  review:(advert:AdvertSnapshot,keepText:boolean)=>void;
}) {
  const jobId=application.jobId;
  const [confirmed,setConfirmed]=useState(false);
  useEffect(()=>setConfirmed(false),[application.id,application.description,advert?.version]);
  if (!jobId || preparationAllowed(state)) return null;
  return <section className="studio-readiness" aria-labelledby="preparation-availability-title">
    <h3 id="preparation-availability-title">{state === 'checking' ? 'Checking this saved role' : 'Check this role before preparing'}</h3>
    <p role="status">{state === 'checking' ? 'Checking the latest listing status. Your saved work stays available.' : preparationMessages[state]}</p>
    {(state==='changed'||state==='review_required') && advert && <div className="advert-review">
      <p>The comparison uses our latest collected advert. Open the employer’s original before applying. Updating this advert keeps your notes, CV, letters and other saved documents.</p>
      <dl><dt>Latest role</dt><dd>{advert.title} · {advert.company} · {advert.location}</dd><dt>Sponsorship wording</dt><dd>{sponsorLabels[advert.sponsorship] || advert.sponsorship}{advert.evidence && <blockquote>{advert.evidence}</blockquote>}</dd>{(advert.deadline||advert.closesAt) && <><dt>Advertised deadline</dt><dd>{advert.deadline||advert.closesAt}</dd></>}{advert.salary && <><dt>Advertised pay</dt><dd>{advert.salary}</dd></>}{advert.employment && <><dt>Employment type</dt><dd>{advert.employment}</dd></>}{advert.workplace && <><dt>Workplace</dt><dd>{advert.workplace}</dd></>}<dt>Last observed</dt><dd>{advert.checkedAt ? new Date(advert.checkedAt).toLocaleString('en-GB') : 'Not supplied'}</dd></dl>
      <div className="advert-comparison"><div><h4>Your working advert</h4><pre>{application.description}</pre></div><div><h4>Latest collected advert</h4><pre>{advert.description}</pre></div></div>
      <a className="text-button" href={advert.url} target="_blank" rel="noopener noreferrer">Open latest employer advert</a>
      {advert.description.length<=26000 ? <button className="secondary-button" disabled={busy} onClick={()=>review(advert,false)}>Use latest advert</button> : <p>This advert is longer than the workspace limit. Read the complete text, edit your working excerpts below, then confirm your review.</p>}
      <details><summary>Keep my edited text instead</summary><p>Preparation will use your working text. Check that it still reflects the current requirements. The role details, original link and sponsorship evidence will update to the latest listing.</p><label className="ai-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I compared the latest advert and reviewed my working text.</label><button className="text-button" disabled={busy||!confirmed} onClick={()=>review(advert,true)}>Keep reviewed working text</button></details>
      <p className="fine-print">Existing drafts are not regenerated or certified by this review. Check them again before using them.</p>
    </div>}
    {state !== 'checking' && <div className="role-licence-links">
      {/^[a-f0-9]{24}$/.test(jobId) && <a className="text-button" href={'/jobs/' + jobId}>View listing status</a>}
      <button className="text-button" disabled={busy} onClick={() => void refresh()}>Check again</button>
    </div>}
  </section>;
}
