import React, { useCallback, useEffect, useRef, useState } from 'react';
import { preparationAllowed, preparationMessages, manualApplicationId, type PreparationState } from '../shared/preparation-availability.js';
type State = PreparationState | 'checking';

export function usePreparationAvailability(jobId = '') {
  const [snapshot, setSnapshot] = useState<{jobId: string; state: State}>({jobId, state: manualApplicationId(jobId) ? 'manual' : 'checking'});
  const active = useRef(jobId), serial = useRef(0);
  active.current = jobId;
  const refresh = useCallback(async (): Promise<PreparationState> => {
    const attempt = ++serial.current;
    if (manualApplicationId(jobId)) { setSnapshot({jobId, state: 'manual'}); return 'manual'; }
    setSnapshot({jobId, state: 'checking'});
    let state: PreparationState = 'unavailable';
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/career/availability?job=' + encodeURIComponent(jobId), {cache:'no-store', signal:controller.signal});
      const result = await response.json();
      if (response.ok && result.jobId === jobId && (result.state === 'current' || Object.hasOwn(preparationMessages, result.state))) state = result.state;
    } catch { /* Missing status is not evidence that the role is current. */ }
    finally { clearTimeout(timer); }
    if (active.current !== jobId || serial.current !== attempt) return 'unavailable';
    setSnapshot({jobId, state});
    return state;
  }, [jobId]);
  useEffect(() => {
    void refresh();
    if (manualApplicationId(jobId)) return;
    const visible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(visible, 5 * 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { ++serial.current; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [jobId, refresh]);
  const state = snapshot.jobId === jobId ? snapshot.state : manualApplicationId(jobId) ? 'manual' : 'checking';
  return {state, ready:preparationAllowed(state), refresh};
}

export function PreparationAvailability({jobId, state, busy, refresh}: {
  jobId: string; state: State; busy: boolean; refresh: () => Promise<PreparationState>;
}) {
  if (!jobId || preparationAllowed(state)) return null;
  return <section className="studio-readiness" aria-labelledby="preparation-availability-title">
    <h3 id="preparation-availability-title">{state === 'checking' ? 'Checking this saved role' : 'Check this role before preparing'}</h3>
    <p role="status">{state === 'checking' ? 'Checking the latest listing status. Your saved work stays available.' : preparationMessages[state]}</p>
    {state !== 'checking' && <div className="role-licence-links">
      {/^[a-f0-9]{24}$/.test(jobId) && <a className="text-button" href={'/jobs/' + jobId}>View listing status</a>}
      <button className="text-button" disabled={busy} onClick={() => void refresh()}>Check again</button>
    </div>}
  </section>;
}
