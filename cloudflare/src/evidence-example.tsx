import React, { useId, useState } from 'react';
import { buildEvidenceReview } from '../worker/career-evidence.js';
import './evidence-example.css';

// Authored examples stay outside CareerProvider, saved applications and metrics.
export const EVIDENCE_EXAMPLES = Object.freeze([
  Object.freeze({
    id: 'project', label: 'From a study project to an analyst role',
    cv: 'Example applicant — fictional\nBSc, 2023–2026. Built a Python study project to clean a sample dataset. Used Excel to check the results. This was coursework, not paid employment.',
    description: 'Example analyst role — fictional, not a vacancy\nPython, Excel and SQL required. Explain a project you have completed. The role requires two days a week in the office. Confirm the location and working arrangements before applying.',
    evidence: '',
    takeaway: 'Python and Excel appear in both texts. SQL is missing from this CV; the check cannot tell whether the person knows it. A study project should remain a study project in the application.',
  }),
  Object.freeze({
    id: 'service', label: 'From volunteering to a customer service role',
    cv: 'Example applicant — fictional\nVolunteered at a community event in 2025. Provided customer service by answering visitor questions and used communication skills to explain the event timetable. No paid employment is described.',
    description: 'Example customer service role — fictional, not a vacancy\nCustomer service and communication required. Use Excel to maintain the rota. Weekend availability is essential. Describe evidence from your own experience.',
    evidence: '',
    takeaway: 'Customer service and communication appear in both texts. Excel and weekend availability still need checking. Volunteering provides an example to discuss, not proof of paid work experience.',
  }),
]);

export function EvidenceExample({ onChooseRole }: { onChooseRole: () => void }) {
  const id = useId();
  const [selected, setSelected] = useState<string>(EVIDENCE_EXAMPLES[0].id);
  const [result, setResult] = useState('');
  const example = EVIDENCE_EXAMPLES.find(item => item.id === selected)!;
  return <details className="evidence-example">
    <summary>Try an example — no CV needed</summary>
    <p>See how Evidence &amp; gaps compares a CV with an advert. These made-up examples run in your browser, use no AI calls and are never added to your saved applications.</p>
    <label htmlFor={id}>Choose a fictional example</label>
    <select id={id} value={selected} onChange={event => { setSelected(event.target.value); setResult(''); }}>
      {EVIDENCE_EXAMPLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <div className="evidence-example-sources">
      <section><h3>Fictional CV</h3><p>{example.cv}</p></section>
      <section><h3>Fictional advert</h3><p>{example.description}</p></section>
    </div>
    <button className="secondary-button" onClick={() => setResult(buildEvidenceReview({ cv: example.cv }, example))}>Check this example</button>
    <div role="status" className="fine-print">{result ? 'Example check ready below.' : ''}</div>
    {result && <section aria-label="Fictional example result" className="evidence-example-result">
      <h3>What to take from this example</h3>
      <p>{example.takeaway}</p>
      <p>This checks a limited list of shared terms. It does not assess suitability, work authorisation or whether a job offers sponsorship.</p>
      <details><summary>Read the full evidence check</summary><pre>{result}</pre></details>
      <button className="text-button" onClick={onChooseRole}>Find a real role to investigate</button>
    </section>}
  </details>;
}
