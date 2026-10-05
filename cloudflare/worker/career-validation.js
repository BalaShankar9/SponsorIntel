const text = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
export function validateWorkspace(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.version !== 2
  )
    throw new Error("Invalid workspace");
  const p = input.profile || {};
  const profile = {
    name: text(p.name, 100),
    email: text(p.email, 200),
    phone: text(p.phone, 80),
    city: text(p.city, 120),
    headline: text(p.headline, 160),
    cv: text(p.cv, 30000),
    skills: text(p.skills, 2000),
    goal: text(p.goal, 200),
    sponsorship: ["now", "later", "unsure", "not_needed"].includes(
      p.sponsorship,
    )
      ? p.sponsorship
      : "unsure",
  };
  if (!Array.isArray(input.applications) || input.applications.length > 100)
    throw new Error("Keep at most 100 applications in this workspace.");
  const ids = new Set();
  const applications = input.applications.map((a) => {
    if (
      !a ||
      typeof a.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(a.id) ||
      ids.has(a.id)
    )
      throw new Error("Invalid application record");
    ids.add(a.id);
    return {
      id: a.id,
      jobId: text(a.jobId, 80),
      company: text(a.company, 200),
      title: text(a.title, 240),
      location: text(a.location, 300),
      description: text(a.description, 26000),
      url: /^https:\/\//.test(a.url || "") ? text(a.url, 2000) : "",
      sponsorship: [
        "offered",
        "conditional",
        "not_stated",
        "unavailable",
      ].includes(a.sponsorship)
        ? a.sponsorship
        : "not_stated",
      evidence: text(a.evidence, 500),
      checkedAt: text(a.checkedAt, 40),
      stage: [
        "Saved",
        "Preparing",
        "Applied",
        "Interview",
        "Offer",
        "Closed",
      ].includes(a.stage)
        ? a.stage
        : "Saved",
      notes: text(a.notes, 4000),
      followUp: /^\d{4}-\d{2}-\d{2}$/.test(a.followUp || "") ? a.followUp : "",
      createdAt: text(a.createdAt, 40),
      updatedAt: text(a.updatedAt, 40),
      cv: text(a.cv, 40000),
      coverLetter: text(a.coverLetter, 20000),
      interview: text(a.interview, 24000),
      analysis: text(a.analysis, 20000),
      companyResearch: text(a.companyResearch, 20000),
      portfolio: text(a.portfolio, 24000),
      learningPlan: text(a.learningPlan, 24000),
      preparedAt: text(a.preparedAt, 40),
    };
  });
  const searches = (Array.isArray(input.searches) ? input.searches : [])
    .slice(0, 10)
    .map((s) => ({
      id: text(s.id, 80),
      q: text(s.q, 150),
      location: text(s.location, 80),
      sponsorship: text(s.sponsorship, 30),
      level: text(s.level, 30),
      salary: text(s.salary, 30),
      sector: text(s.sector, 30),
      createdAt: text(s.createdAt, 40),
    }));
  return { version: 2, profile, applications, searches };
}
