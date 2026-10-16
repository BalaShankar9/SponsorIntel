// Source quotations only: never infer annual earnings, base pay or visa eligibility.
// Input is the stored plain-text advert, shared by ingestion and the role page.
const money = /(?:£\s*\d[\d,.]*\s*[kK]?|\bGBP\s*\d[\d,.]*\s*[kK]?)/;
const payWords = /\b(?:salary|salaries|pay|compensation|annum|per (?:year|hour|month|day|week)|annual|base|OTE|on[ -]target earnings|pro[ -]rata|commission)\b/i;
const unrelated = /\b(?:learning|training|equipment|wellbeing|well-being) budget\b|\b(?:revenue|funding|valuation|loan repayments?|salary sacrifice)\b/i;
const standaloneRange = /^(?:[\s•💰]*)(?:£|GBP)\s*\d[\d,.]*\s*k?\s*(?:-|–|—|to)\s*(?:(?:£|GBP)\s*)?\d[\d,.]*\s*k?\s*[.!]?$/iu;

export function payEvidence(description) {
  const text = typeof description === "string" ? description : "";
  const statements = [];
  for (const part of text.slice(0, 100000).split(/\n|(?<=[.!?])\s+/)) {
    const quote = part.trim();
    if (!money.test(quote) || unrelated.test(quote) || (!payWords.test(quote) && !standaloneRange.test(quote))) continue;
    const key = quote.toLowerCase().replace(/\s+/g, "");
    // Repeated header/footer summaries add no evidence. Retain the fuller quote,
    // including its contract terms, rather than announcing a duplicate as a difference.
    const keys = statements.map((s) => s.toLowerCase().replace(/\s+/g, ""));
    if (keys.some((k) => k.includes(key))) continue;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (key.includes(keys[i])) statements.splice(i, 1);
    }
    statements.push(quote);
  }
  return {
    quotes: statements.slice(0, 4).map((s) => s.length > 800 ? s.slice(0, 800) + "…" : s),
    multiple: statements.length > 1,
    proRata: statements.some((s) => /\bpro[ -]rata\b/i.test(s)),
    variablePay: statements.some((s) => /\b(?:OTE|on[ -]target earnings|commission)\b/i.test(s)),
    shortened: text.length > 100000 || statements.length > 4 || statements.slice(0, 4).some((s) => s.length > 800),
  };
}
