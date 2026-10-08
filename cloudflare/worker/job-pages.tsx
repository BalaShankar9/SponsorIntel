import React from "react";
import { renderToString } from "react-dom/server";
import { JobDetailView } from "../src/job-detail-view";
import { jobAvailability, jobMetadata, jobStructuredData, JOB_ORIGIN } from "../shared/job-detail.js";
import { boundedText } from "./data.js";
import type { Job } from "../src/career-data";

const escapeHTML = (value: string) => value.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const safeJSON = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export async function renderJobPage(request: Request, assets: { fetch: typeof fetch }, job: Job) {
  const assetURL = new URL("/app.html", request.url);
  const asset = await assets.fetch(new Request(assetURL));
  if (!asset.ok) return new Response("Page temporarily unavailable", {
    status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Retry-After": "60" },
  });
  const now = Date.now();
  const meta = jobMetadata(job, now);
  const fallbackHost = new URL(request.url).hostname.endsWith(".workers.dev");
  const indexable = meta.indexable && !fallbackHost;
  const robots = indexable ? "index,follow,max-image-preview:large" : "noindex,follow";
  let html = await boundedText(asset, 2_000_000);
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/,
    '<noscript><p class="seo-noscript">' + (meta.indexable
      ? 'You can read this opportunity and open the employer’s advert here. Enable JavaScript to save it or prepare an application.'
      : 'This advert is retained for reference. Check the employer’s website or explore current opportunities.') + '</p></noscript>');
  html = html.replace(/<title>[^<]*<\/title>/, () => "<title>" + escapeHTML(meta.title) + "</title>");
  for (const [name, content] of Object.entries({
    description: meta.description, robots, "og:title": meta.title,
    "og:description": meta.description, "og:url": JOB_ORIGIN + meta.path,
    "twitter:title": meta.title, "twitter:description": meta.description,
  })) html = html.replace(
    new RegExp('(<meta\\s+(?:name|property)="' + name + '"\\s+content=")[^"]*(")', "g"),
    (_, before, after) => before + escapeHTML(content) + after,
  );
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/,
    () => '<link rel="canonical" href="' + JOB_ORIGIN + meta.path + '" />');
  html = html.replace(/<script\b[^>]*id="structured-data"[^>]*>[\s\S]*?<\/script>/,
    () => '<script type="application/ld+json" id="structured-data">' + safeJSON(jobStructuredData(job, now, !fallbackHost)) + "</script>");
  const body = renderToString(
    <div className="role-server-shell">
      <header className="role-server-brand"><a href="/">Sponsor<span>Intel</span></a><a href="/jobs">Explore UK opportunities</a></header>
      <main id="main" className="career"><JobDetailView job={job} now={now} /></main>
    </div>,
  );
  html = html.replace('<div id="root"></div>', () => '<div id="root">' + body + "</div>");
  html = html.replace("</body>", () => '<script type="application/json" id="job-data">' + safeJSON(job) + "</script></body>");
  // Always re-read the current database state. Cached closed adverts must not
  // remain indexable or offer a preparation action after the next board refresh.
  return new Response(html, {
    status: jobAvailability(job, now) === "removed" ? 410 : 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      ...(indexable ? {} : { "X-Robots-Tag": "noindex, follow" }),
    },
  });
}
