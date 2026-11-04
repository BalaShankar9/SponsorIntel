// Recognise an explicit, unconditional CV refusal for this application only.
// No format is inferred from a school's identity, a missing CV field, or silence.
// Whole statements avoid mistaking agency-only, hypothetical or historical text
// for an instruction. Keep the source quote, never an AI rewrite.
const cv = String.raw`(?:CVs?|curriculum vitae)`;
const scope = String.raw`for (?:this|the) (?:application|role|post|vacancy)`;
const prefix = String.raw`(?:please note(?: that)?[,:]?\s+)?`;
const refusal = new RegExp(String.raw`^${prefix}(?:${cv}\s+(?:will not be|won['’]t be|cannot be|are not|is not)\s+accepted(?:\s+${scope})?|we\s+(?:do not|don't|don’t|cannot)\s+accept\s+${cv}(?:\s+${scope})?)[.!]?$`, 'iu');

export function cvApplicationRestriction(description) {
  if (typeof description !== 'string' || description.length > 100000) return null;
  for (const part of description.split(/\n|(?<=[.!?])\s+/)) {
    const quote = part.trim().replace(/^[•*-]\s+/, '');
    if (quote.length > 500 || !refusal.test(quote.replace(/\s+/g, ' '))) continue;
    return { quote };
  }
  return null;
}

export function applicationSourceURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
