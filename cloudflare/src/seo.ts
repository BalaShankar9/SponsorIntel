import pages from "../shared/pages.json";
import type { Job } from "./career-data";
import { jobMetadata, jobStructuredData } from "../shared/job-detail.js";
export const publicPages: Record<
  string,
  { path: string; title: string; description: string; reviewed?: string }
> = pages;
export const ORIGIN = "https://sponsorintel.london";
const privateTitles: Record<string, string> = {
  applications: "Your applications",
  "career-profile": "Your CV profile",
  studio: "Application studio",
  account: "Your account",
  signin: "Sign in",
  signup: "Create your account",
  "reset-password": "Reset your password",
  admin: "Owner dashboard",
  saved: "Saved employers",
  settings: "Preferences",
  "employer-notes": "Employer notes",
};
export function pageMeta(view: string) {
  return (
    publicPages[view] || {
      path: "/" + view,
      title: (privateTitles[view] || "Page not found") + " | Sponsor Intel",
      description: privateTitles[view]
        ? "Your personal Sponsor Intel workspace."
        : "This page could not be found. Explore UK employers, jobs and career guides on Sponsor Intel.",
    }
  );
}
export function structuredData(view: string) {
  const page = publicPages[view];
  if (!page) return null;
  const website = {
    "@type": "WebSite",
    "@id": ORIGIN + "/#website",
    name: "Sponsor Intel",
    alternateName: "SponsorIntel",
    url: ORIGIN + "/",
    inLanguage: "en-GB",
  };
  const webPage = {
    "@type": "WebPage",
    "@id": ORIGIN + page.path + "#page",
    url: ORIGIN + page.path,
    name: page.title,
    description: page.description,
    isPartOf: { "@id": website["@id"] },
    inLanguage: "en-GB",
    ...(page.reviewed ? { dateModified: page.reviewed } : {}),
    publisher: { "@id": ORIGIN + "/#organisation" },
  };
  const organisation = {
    "@type": "Organization",
    "@id": ORIGIN + "/#organisation",
    name: "Sponsor Intel",
    url: ORIGIN + "/",
    logo: ORIGIN + "/favicon.svg",
    description:
      "UK sponsor employer discovery, application preparation and source-linked immigration information.",
  };
  const crumbs = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Sponsor Intel",
      item: ORIGIN + "/",
    },
  ];
  if (view.startsWith("guides/"))
    crumbs.push({
      "@type": "ListItem",
      position: 2,
      name: "Career guides",
      item: ORIGIN + "/guides",
    });
  if (view.startsWith("routes/") || view.startsWith("study/"))
    crumbs.push({
      "@type": "ListItem",
      position: 2,
      name: view.startsWith("routes/") ? "UK visa routes" : "Study in the UK",
      item: ORIGIN + "/" + view.split("/")[0],
    });
  if (view !== "discover")
    crumbs.push({
      "@type": "ListItem",
      position: crumbs.length + 1,
      name: page.title.replace(" | Sponsor Intel", ""),
      item: ORIGIN + page.path,
    });
  return {
    "@context": "https://schema.org",
    "@graph": [
      website,
      organisation,
      webPage,
      ...(crumbs.length > 1
        ? [{ "@type": "BreadcrumbList", itemListElement: crumbs }]
        : []),
    ],
  };
}
export function updateMetadata(view: string) {
  const page = pageMeta(view);
  applyMetadata(page, structuredData(view), !!publicPages[view]);
}
export function updateJobMetadata(
  job: Job | null,
  id: string,
  missing = false,
) {
  const page = job
    ? jobMetadata(job)
    : {
        path: "/jobs/" + id,
        title:
          (missing ? "Opportunity not found" : "Opportunity details") +
          " | Sponsor Intel",
        description:
          "Read the employer's advert, sponsorship wording and source checks on Sponsor Intel.",
        indexable: false,
      };
  applyMetadata(page, job ? jobStructuredData(job) : null, page.indexable);
}
function applyMetadata(
  page: { title: string; path: string; description: string },
  structured: object | null,
  indexable: boolean,
) {
  document.title = page.title;
  document
    .querySelector('link[rel="canonical"]')
    ?.setAttribute("href", ORIGIN + page.path);
  for (const [selector, content] of [
    ['meta[name="description"]', page.description],
    ['meta[property="og:title"]', page.title],
    ['meta[property="og:description"]', page.description],
    ['meta[property="og:url"]', ORIGIN + page.path],
    ['meta[name="twitter:title"]', page.title],
    ['meta[name="twitter:description"]', page.description],
    [
      'meta[name="robots"]',
      indexable && !location.hostname.endsWith(".workers.dev")
        ? "index,follow,max-image-preview:large"
        : "noindex,follow",
    ],
  ])
    document.querySelector(selector)?.setAttribute("content", content);
  const schema = document.getElementById("structured-data");
  if (schema) schema.textContent = JSON.stringify(structured);
}
