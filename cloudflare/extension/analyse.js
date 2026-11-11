// Local, deliberately conservative advert-wording checks. No network or licence lookup.
export const MAX_TEXT = 100000;
export const labels = {
  offered: 'Sponsorship offered in this wording',
  conditional: 'Sponsorship may be available',
  unavailable: 'Sponsorship refused in this wording',
  unclear: 'Sponsorship is unclear',
};
const normal = value => value.replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
export function analyseAdvert(text, confirmed = false) {
  const result = (status, reason, evidence = []) => ({status, title: labels[status], reason, evidence});
  if (typeof text !== 'string' || text.trim().length < 40)
    return result('unclear', 'Add the complete advert, including its eligibility and sponsorship sections.');
  if (text.length > MAX_TEXT)
    return result('unclear', 'This text is too long. Select one complete advert; no partial verdict has been made.');
  if (!confirmed)
    return result('unclear', 'First check that this is one complete job advert, rather than a results page, form or general guide.');
  const evidence = [];
  let ambiguous = false;
  let previousStatement = false;
  const retain = (kind, quote) => {
    if (!evidence.some(e => e.quote === quote)) evidence.push({kind, quote});
  };
  // Keep at least one quote of every kind before filling the bounded display.
  // A long list of positive sentences must not hide the caveat or refusal.
  const displayedEvidence = () => {
    const selected = new Set();
    for (const kind of ['offered','conditional','unavailable','unclear']) {
      const first = evidence.findIndex(e => e.kind === kind);
      if (first >= 0) selected.add(first);
    }
    for (let i = 0; i < evidence.length && selected.size < 6; i++) selected.add(i);
    return [...selected].sort((a,b) => a-b).map(i => evidence[i]);
  };
  const sentences = text.split(/(?<=[.!?])\s+|[\r\n]+/).map(x => x.trim()).filter(Boolean);
  for (const original of sentences) {
    const whole = normal(original).replace(/^[-•*]\s*/, '');
    const followsStatement = previousStatement;
    previousStatement = false;
    // A section label is not an uncertain claim. It also must not hide a
    // caveat referring to the preceding statement across that label.
    const heading = '(?:(?:UK |Skilled Worker )?(?:visa|immigration|work permit) )?sponsorship';
    if (new RegExp('^'+heading+':?$','i').test(whole)) {
      previousStatement = followsStatement;
      continue;
    }
    let s = whole.replace(new RegExp('^'+heading+':\\s*','i'), '');
    // Strip this courtesy preface only before an explicit employer refusal.
    // Keep the complete original quote; unfamiliar prefaces remain unclear.
    s = s.replace(/^unfortunately(?: at this time)?,?\s+(?=(?:we|the company|the employer) (?:(?:currently )?(?:cannot|can't|do not|don't|will not|won't)|are (?:(?:currently )?unable to|not (?:currently )?able to))\b)/i, '');
    if (!/sponsor/i.test(whole)) {
      // An adjacent caveat may refer back without repeating "sponsorship".
      // Preserve uncertainty; this is not a general right-to-work refusal rule.
      if (followsStatement && /^(?:(?:however|unfortunately|please note)[,:]?\s+)?(?:this|that|it)(?:\s+(?:offer|support|assistance|policy|statement|information|arrangement|benefit))?\s+(?:does not apply\b|is (?:no longer|not (?:available|offered|provided|applicable|valid)|out of date|outdated|withdrawn)\b|has been (?:withdrawn|discontinued)\b|applies only\b|is only (?:available|offered|provided)\b)/i.test(s)) {
        ambiguous = true;
        if (s.length <= 650) retain('unclear', original);
      }
      continue;
    }
    // Questions, advice, examples and very long clauses cannot establish an offer/refusal.
    if (whole.length > 650 || /\?/.test(s) || /^(?:if |unless |for example|example|ask |please ask|check whether|you should|"|'|“|‘)/i.test(s)) {
      ambiguous = true;
      if (whole.length <= 650) retain('unclear', original);
      continue;
    }
    const immigration = /visa|immigration|work permit|skilled worker|right to work|authori[sz]ed to work/i.test(whole);
    // Avoid treating a non-immigration funding statement as job visa evidence.
    if (!immigration && /qualification|course|degree|training|conference|event|charit|sport/i.test(s)) continue;
    const employer = '(?:we|the company|the employer)';
    const sponsor = '(?:(?:UK |Skilled Worker )?(?:visa|immigration|work permit) sponsorship|(?:UK )?Skilled Worker sponsorship)';
    const no = new RegExp('^(?:please note[,:]? (?:that )?)?'+employer+' (?:currently )?(?:cannot|can\'t|do not|don\'t|will not|won\'t|are (?:currently )?unable to|are not (?:currently )?able to) (?:currently )?(?:offer|provide|support|arrange) '+sponsor+'\\b','i').test(s)
      || new RegExp('^'+sponsor+' (?:is |will be )?(?:not (?:available|provided|offered|supported|possible)|unavailable)\\b','i').test(s)
      || /^(?:this|the) (?:role|position|job|vacancy) (?:is not eligible for|does not (?:offer|provide|support)) (?:UK |Skilled Worker )?(?:visa )?sponsorship\b/i.test(s)
      || /^we are (?:currently not offering|not (?:currently )?offering|unable to offer|not (?:currently )?in a position to offer) sponsorship(?: to new candidates)? for (?:this|these) roles?\b/i.test(s)
      || /^(?:applicants|candidates) must (?:be (?:legally )?authori[sz]ed to work|have (?:the )?right to work).{0,100}\bwithout (?:employer |visa )?sponsorship\b/i.test(s)
      || /^no (?:UK |Skilled Worker )?(?:visa|immigration|work permit) sponsorship (?:is )?(?:available|provided|offered|supported)\b/i.test(s);
    const yes = new RegExp('^'+employer+' (?:(?:will|can|may|do|are able to|are happy to) )?(?:offer|provide|support|arrange) (?:(?:a|your|the) )?'+sponsor+'\\b','i').test(s)
      || new RegExp('^'+sponsor+' (?:(?:is|will be|can be|may be) )?(?:available|provided|offered|supported)\\b','i').test(s)
      || /^we (?:can|will|may|are able to) sponsor (?:your |a |the )?(?:UK |Skilled Worker )?(?:visa|work permit)\b/i.test(s)
      || /^skilled worker visas can be sponsored[.!]?$/i.test(s)
      || /^(?:this|the) (?:role|position|job|vacancy) is eligible for (?:UK |Skilled Worker )?(?:visa )?sponsorship\b/i.test(s)
      || /^(?:applicants|candidates) (?:requiring|who require) (?:UK |Skilled Worker )?(?:visa )?sponsorship are welcome to apply\b/i.test(s);
    if (!yes && !no) { ambiguous = true; retain('unclear', original); continue; }
    previousStatement = true;
    // A match at the start cannot override a later qualification or refusal.
    const conflictingClause = /\b(?:but|however|although|except|unless|not only|no longer|not for|previously|historically|last year|in the past)\b/i.test(s);
    const nonUK = /\b(?:H-?1B|United States|US visa|USA|Canada|Canadian|Australia|Australian)\b/i.test(s);
    if (conflictingClause || nonUK || (yes && /\b(?:not|never|cannot|can't|don't|do not|won't|will not)\b/i.test(s))) {
      retain('unclear', original); ambiguous = true; continue;
    }
    const kind = no ? 'unavailable' : /\b(?:can|may|eligible|eligibility|depending|depends|subject to|consider|certain|selected|some|only|limited|exceptional|welcome|where|if)\b|case.by.case/i.test(s) ? 'conditional' : 'offered';
    retain(kind, original);
  }
  const positive = evidence.some(e => ['offered','conditional'].includes(e.kind));
  const negative = evidence.some(e => e.kind === 'unavailable');
  if (positive && negative)
    return result('unclear', 'The text contains both support and refusal wording. Check the exact role and all conditions with the employer.', displayedEvidence());
  if (ambiguous && (positive || negative))
    return result('unclear', 'A caveat or other sponsorship wording needs interpretation. Read the quoted context and complete advert before relying on a matched sentence.', displayedEvidence());
  if (negative) return result('unavailable', 'A direct refusal was found. This describes the supplied wording, not every role at this employer.', displayedEvidence());
  if (positive) {
    const status = evidence.some(e => e.kind === 'conditional') ? 'conditional' : 'offered';
    return result(status, 'This is wording evidence, not a confirmed offer, current opening, licence match or personal eligibility decision.', displayedEvidence());
  }
  return result('unclear', 'No clear role-specific commitment or refusal matched. Silence, a right-to-work question and a sponsor licence do not establish the answer.', displayedEvidence());
}
