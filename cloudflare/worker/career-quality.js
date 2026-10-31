// Conservative checks only: these do not verify employment history or measure suitability.
export function sourceWarnings(cv = "") {
  const warnings = [];
  if (
    /\[(?:month\s*year|start\s*date|end\s*date|insert[^\]]*|your[^\]]*)\]/i.test(
      cv,
    )
  )
    warnings.push(
      "Your source CV contains an unfinished date or placeholder. Add the real information before applying; we will not guess it.",
    );
  if (
    /\bplanned\b|\bplanning exercises\b|\bahead of building\b|\barchitecture concepts\b|\bnot yet built\b/i.test(
      cv,
    )
  )
    warnings.push(
      "Your source includes planned concepts. Keep them separate from products you have actually built.",
    );
  return warnings;
}
export function contactFromText(text = "") {
  const profile = {};
  const lines = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const first = lines[0] || "";
  if (
    first.length >= 4 &&
    first.length <= 90 &&
    first.split(/\s+/).length >= 2 &&
    first.split(/\s+/).length <= 6 &&
    /^[\p{L}\p{M} .'’-]+$/u.test(first) &&
    !/(curriculum vitae|resume|résumé|professional|profile|software|developer)/i.test(
      first,
    )
  )
    profile.name = first;
  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  if (email) profile.email = email;
  const phone = text.match(
    /(?:\+44\s?(?:\(0\)\s?)?|\b0)7\d(?:[\s()-]*\d){8}\b/,
  )?.[0];
  if (phone) profile.phone = phone.trim();
  return profile;
}
export function draftWarnings(text = "", cv = "", kind = "cv") {
  const warnings = sourceWarnings(cv);
  if (
    /\[(?:month\s*year|start\s*date|end\s*date|insert[^\]]*|your[^\]]*)\]/i.test(
      text,
    )
  )
    warnings.push(
      "This draft still contains a placeholder. Replace it with a known fact or remove it.",
    );
  if (kind === "cv") {
    const known = new Set(cv.match(/\b(?:19|20)\d{2}\b/g) || []);
    const added = [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) || [])].filter(
      (y) => !known.has(y),
    );
    if (added.length)
      warnings.push(
        "Dates not present in your source CV: " +
          added.join(", ") +
          ". Check these carefully.",
      );
    if (
      /\bprojects?\b/i.test(cv) &&
      text.length > 100 &&
      !/\bprojects?\b/i.test(text)
    )
      warnings.push(
        "Your source includes projects but this draft may have omitted them. Check that your most relevant built work is represented.",
      );
  }
  if (kind === "coverLetter" && text.length > 80) {
    const words = text.trim().split(/\s+/).length;
    if (words < 220 || words > 300)
      warnings.push(
        "This cover letter is " +
          words +
          " words. Aim for 220–300 focused words.",
      );
  }
  return warnings;
}

// Drop explicit source placeholders from generated prose without inventing dates.
// Keep the source warning so candidates know a real date is still needed.
export function cleanDraft(text = "") {
  return text
    .replace(/^\s*Dates? not supplied\.?\s*$/gim, "")
    .replace(
      /\[(?:month\s*year|start\s*date|end\s*date)\]\s*[–—-]\s*(?=Present\b)/gi,
      "",
    )
    .replace(
      /\[(?:month\s*year|start\s*date|end\s*date|insert[^\]]*|your[^\]]*)\]/gi,
      "",
    )
    .replace(/[ \t]+$/gm, "")
    .trim();
}

// Contact details are user-supplied fields; do not rely on a model to retain them.
export function preserveCVContacts(text, profile) {
  const contacts = [profile.name, profile.email, profile.phone]
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.replace(/[\r\n]+/g, " ").trim());
  const missing = contacts.filter(
    (v) => !text.toLocaleLowerCase().includes(v.toLocaleLowerCase()),
  );
  return (missing.length ? missing.join("\n") + "\n\n" : "") + text;
}
