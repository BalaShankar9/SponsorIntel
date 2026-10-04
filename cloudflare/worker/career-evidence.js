// Evidence checks are deterministic. Shared terms are not eligibility or hiring scores.
const TERMS = [
  "Python",
  "SQL",
  "Excel",
  "Power BI",
  "Tableau",
  "Looker",
  "JavaScript",
  "TypeScript",
  "React",
  "Java",
  "C++",
  "C#",
  "R",
  "pandas",
  "NumPy",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Salesforce",
  "Anaplan",
  "Figma",
  "HTML",
  "CSS",
  "Git",
  "machine learning",
  "data analysis",
  "customer service",
  "project management",
  "communication",
];
const normal = (text) =>
  String(text || "")
    .normalize("NFKC")
    .toLowerCase();
function contains(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + escaped + "($|[^a-z0-9])", "i").test(
    normal(text),
  );
}
function lines(text) {
  return String(text || "")
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function quote(text, term) {
  return (lines(text).find((line) => contains(line, term)) || term).slice(
    0,
    350,
  );
}
export function buildEvidenceReview(profile, application) {
  const cv = profile.cv || "",
    advert = application.description || "";
  const required = TERMS.filter((t) => contains(advert, t));
  const shared = required.filter((t) => contains(cv, t));
  const missing = required.filter((t) => !contains(cv, t));
  const conditions = lines(advert)
    .filter(
      (s) =>
        /\b(?:must|required|essential|graduat|degree|right to work|sponsorship|available|availability|years of|experience in)\b/i.test(
          s,
        ) || /graduat|\b20\d{2}\b/.test(s),
    )
    .slice(0, 10);
  const years = [...new Set(cv.match(/\b(?:19|20)\d{2}\b/g) || [])].sort();
  return [
    "EVIDENCE THAT FITS — SHARED TERMS",
    "These terms occur in both your CV and the advert. This is not a check of proficiency, eligibility or every requirement.",
    shared.length
      ? shared
          .map(
            (t) =>
              `${t}\n  Your CV: “${quote(cv, t)}”\n  Advert: “${quote(advert, t)}”`,
          )
          .join("\n\n")
      : "No shared terms were found in the skills we check. Review the CV and advert together; this does not mean you are unsuitable.",
    "GAPS TO CHECK",
    missing.length
      ? "The advert mentions these terms, but your CV does not: " +
        missing.join(", ") +
        ". Add evidence only if it is true."
      : "No additional terms from our limited skills list were found. Other requirements may still be missing.",
    "ADVERT CONDITIONS — NOT YET VERIFIED AGAINST YOUR PROFILE",
    conditions.length
      ? conditions.map((s) => "• " + s.slice(0, 500)).join("\n")
      : "Check the original advert for qualifications, dates, location, hours and experience requirements.",
    years.length
      ? "Years appearing in your CV: " +
        years.join(", ") +
        ". Compare these with any graduation-year and availability requirements above."
      : "Your CV does not give clear four-digit dates. Check education and experience dates.",
    "SPONSORSHIP AND WORK AUTHORISATION",
    application.evidence
      ? "Original advert wording: “" + application.evidence + "”"
      : "No clear sponsorship statement has been saved for this role.",
    "An employer licence does not confirm sponsorship for this role. Your work authorisation has not been verified. Check the advert and official guidance; ask the employer about this specific role.",
    "NEXT THREE ACTIONS",
    "1. Confirm the dates, qualifications, location and availability conditions against your own circumstances.",
    "2. Add specific, truthful examples for the requirements you meet. Keep missing experience visible.",
    "3. Ask the recruiter about unclear role requirements and sponsorship before investing in a full application.",
  ].join("\n\n");
}
