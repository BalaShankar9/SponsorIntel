import React from 'react';
import { applicationSourceURL, cvApplicationRestriction } from '../shared/application-instructions.js';

export function ApplicationInstructions({ description, url }: { description?: string; url?: string }) {
  const instruction = cvApplicationRestriction(description);
  const source = applicationSourceURL(url);
  if (!instruction) return null;
  return <section className="application-instructions" aria-label="Application format">
    <h3>Follow the employer’s application format</h3>
    <blockquote>“{instruction.quote}”</blockquote>
    <p>Use the employer’s requested format. Your CV can help you gather evidence, but it does not replace the required application.</p>
    <p>Review your evidence notes against the original questions, word limits and instructions before submitting.</p>
    {source && <a className="text-button" href={source} target="_blank" rel="noopener noreferrer">Open employer instructions ↗</a>}
  </section>;
}
