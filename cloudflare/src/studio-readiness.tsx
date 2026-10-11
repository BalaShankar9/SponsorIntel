import React from 'react';

export function studioReadiness(kind: string, cv: string, description: string, consent: boolean) {
  const needsCV = !['companyResearch', 'followup'].includes(kind);
  const needsAdvert = kind !== 'followup';
  const needsConsent = !['analysis', 'companyResearch', 'followup'].includes(kind);
  const cvReady = cv.trim().length >= 100;
  const advertReady = description.trim().length >= 80;
  return {
    needsCV, needsAdvert, needsConsent, cvReady, advertReady,
    ready: (!needsCV || cvReady) && (!needsAdvert || advertReady) && (!needsConsent || consent),
  };
}

export function StudioReadiness({ kind, cv, description, consent, busy, onCV, onAdvert }: {
  kind: string; cv: string; description: string; consent: boolean; busy: boolean;
  onCV: () => void; onAdvert: () => void;
}) {
  const state = studioReadiness(kind, cv, description, consent);
  if (kind === 'followup' || state.ready) return null;
  return <section className="studio-readiness" aria-labelledby="studio-readiness-title">
    <h3 id="studio-readiness-title">{kind === 'analysis' ? 'Before your evidence check' : 'Before preparing this draft'}</h3>
    <ul>
      {state.needsCV && !state.cvReady && <li>
        <span>{cv.trim() ? 'Add your experience, skills and education (at least 100 characters).' : 'Add your CV to use your own experience.'}</span>
        <button className="text-button" disabled={busy} onClick={onCV}>{cv.trim() ? 'Complete my CV' : 'Add my CV'}</button>
      </li>}
      {state.needsAdvert && !state.advertReady && <li>
        <span>{description.trim() ? 'Add the advert’s responsibilities and requirements (at least 80 characters).' : 'Add the employer’s job description.'}</span>
        <button className="text-button" disabled={busy} onClick={onAdvert}>Add job description</button>
      </li>}
      {state.needsConsent && !consent && <li><span>Review the consent below before sending your CV and advert to Cloudflare AI.</span></li>}
    </ul>
    {(!state.cvReady && state.needsCV || !state.advertReady && state.needsAdvert) && <p className="fine-print">Text length does not establish CV quality or suitability for the role.</p>}
  </section>;
}
