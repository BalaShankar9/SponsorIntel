export const JOB_FRESHNESS_MS = 3 * 86400000;
export const JOB_ORIGIN = "https://sponsorintel.london";
export const jobLabels = {
  offered: "Sponsorship stated",
  conditional: "Conditional sponsorship",
  not_stated: "Sponsorship not stated",
  unavailable: "Sponsorship unavailable",
};

export function jobPath(id) {
  return /^[a-f0-9]{24}$/.test(id || "") ? "/jobs/" + id : null;
}

// Presence in a recently read board is evidence of a listing, not a promise
// that the employer will accept an application or sponsor the applicant.
export function jobAvailability(job, now = Date.now()) {
  if (job.closes_at != null) {
    const deadline = Date.parse(job.closes_at);
    if (!Number.isFinite(deadline) || new Date(deadline).toISOString() !== job.closes_at) return "stale";
    if (deadline <= now) return "expired";
  }
  if (job.active !== 1) return "removed";
  const seen = Date.parse(job.last_seen);
  if (!Number.isFinite(seen) || seen > now + 300000 || now - seen >= JOB_FRESHNESS_MS)
    return "stale";
  return "current";
}

export function jobMetadata(job, now = Date.now()) {
  const current = jobAvailability(job, now) === "current";
  return {
    path: jobPath(job.id),
    title: job.title + " at " + job.company + " | Sponsor Intel",
    description: (current
      ? "Explore " + job.title + " at " + job.company + " in " + job.location +
        ". Read the advert, sponsorship wording and source checks before applying."
      : "This role is outside our current collection. Check the employer's website for availability and explore other UK opportunities.").slice(0, 300),
    indexable: current,
  };
}

export function jobStructuredData(job, now = Date.now()) {
  const meta = jobMetadata(job, now);
  const url = JOB_ORIGIN + meta.path;
  // The source does not consistently supply original posting dates and all
  // required JobPosting fields. Do not invent them or claim a Google Jobs entry.
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": url + "#page", url, name: meta.title,
        description: meta.description, inLanguage: "en-GB",
        isPartOf: { "@type": "WebSite", name: "Sponsor Intel", url: JOB_ORIGIN + "/" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Sponsor Intel", item: JOB_ORIGIN + "/" },
        { "@type": "ListItem", position: 2, name: "UK opportunities", item: JOB_ORIGIN + "/jobs" },
        { "@type": "ListItem", position: 3, name: job.title, item: url },
      ] },
    ],
  };
}

export function jobTimestamp(value) {
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()))
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit",
    minute: "2-digit", timeZone: "Europe/London", timeZoneName: "short",
  }) : "Not supplied";
}
