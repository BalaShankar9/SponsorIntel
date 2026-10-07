import pages from "../shared/pages.json" with { type: "json" };
import { getJobDetail } from "./jobs.js";
import { JOB_FRESHNESS_MS, JOB_ORIGIN, jobPath } from "../shared/job-detail.js";
import { insightsResponse, INSIGHT_SLUG } from './insights.js';
const roleID = (path) => path.match(/^\/jobs\/([a-f0-9]{24})$/)?.[1];
const publicPaths = new Set(Object.values(pages).map((p) => p.path));
const privatePaths = new Set([
  "/account",
  "/signin",
  "/signup",
  "/reset-password",
  "/admin",
  "/career-profile",
  "/studio",
  "/applications",
  "/saved",
  "/settings",
  "/employer-notes",
]);
const insightPaths = new Set(['/insights','/insights/'+INSIGHT_SLUG,'/insights/feed.xml']);
const known = (p) => publicPaths.has(p) || privatePaths.has(p) || !!roleID(p) || insightPaths.has(p);
const unavailable = () =>
  new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Temporarily unavailable | Sponsor Intel</title><main><h1>We couldn’t check this opportunity.</h1><p>Please try again shortly.</p><a href="/jobs">Explore opportunities</a></main></html>',
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "Retry-After": "60",
      },
    },
  );

export async function sitemapResponse(env, now = Date.now()) {
  const { results } = await env.DB.prepare(
    `SELECT id FROM jobs WHERE active=1 AND last_seen>? AND last_seen<=? ORDER BY id LIMIT ${50000 - publicPaths.size}`,
  )
    .bind(
      new Date(now - JOB_FRESHNESS_MS).toISOString(),
      new Date(now + 300000).toISOString(),
    )
    .all();
  const paths = [
    ...publicPaths,
    '/insights',
    ...results.map((job) => jobPath(job.id)).filter(Boolean),
  ];
  const report = await env.DB.prepare("SELECT slug,updated_at FROM insight_publications WHERE state='published' AND slug=?").bind(INSIGHT_SLUG).first();
  if (report) paths.push('/insights/'+report.slug);
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      paths
        .map((path) => {
          const reviewed = (path==='/insights/'+report?.slug ? report.updated_at : null) || Object.values(pages).find(
            (p) => p.path === path,
          )?.reviewed;
          return (
            "<url><loc>" +
            JOB_ORIGIN +
            path +
            "</loc>" +
            (reviewed ? "<lastmod>" + reviewed + "</lastmod>" : "") +
            "</url>"
          );
        })
        .join("") +
      "</urlset>",
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
export function canonicalPath(path) {
  const clean = path.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";
  if (clean === "/discover") return "/";
  return known(clean) ? clean : null;
}
export async function pageResponse(request, env) {
  const url = new URL(request.url);
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  const path = canonicalPath(url.pathname);
  // Preserve search filters and campaign parameters while consolidating www.
  if (
    url.hostname === "www.sponsorintel.london" ||
    (path && path !== url.pathname)
  ) {
    if (url.hostname === "www.sponsorintel.london") {
      url.hostname = "sponsorintel.london";
      url.protocol = "https:";
    }
    if (path) url.pathname = path;
    return Response.redirect(url.href, 301);
  }
  let assetPath;
  let status = 200;
  if (insightPaths.has(url.pathname)) return insightsResponse(request,env);
  if (url.pathname === "/sitemap.xml") {
    try {
      return await sitemapResponse(env);
    } catch {
      return unavailable();
    }
  }
  const id = roleID(url.pathname);
  if (id) {
    try {
      const job = await getJobDetail(id, env);
      if (job) {
        const { renderJobPage } = await import("./job-pages.tsx");
        return await renderJobPage(request, env.ASSETS, job);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "job_page_unavailable",
          message: error instanceof Error ? error.message : "Unknown failure",
        }),
      );
      return unavailable();
    }
    assetPath = "/404.html";
    status = 404;
  } else if (publicPaths.has(url.pathname))
    assetPath =
      url.pathname === "/" ? "/index.html" : url.pathname + "/index.html";
  else if (privatePaths.has(url.pathname)) assetPath = "/app.html";
  else if (
    /^\/(assets\/|fonts\/|campaigns\.js$|insights-tracking\.js$|favicon\.svg$|share-card-v1\.jpg$|robots\.txt$|open-source-notices\.txt$)/.test(
      url.pathname,
    )
  ) {
    return env.ASSETS.fetch(request);
  } else {
    assetPath = "/404.html";
    status = 404;
  }
  const assetURL = new URL(request.url);
  assetURL.pathname = assetPath;
  assetURL.search = "";
  const asset = await env.ASSETS.fetch(
    new Request(assetURL, { method: "GET" }),
  );
  if (!asset.ok)
    return new Response("Page temporarily unavailable", {
      status: 503,
      headers: {
        "Retry-After": "60",
        "X-Robots-Tag": "noindex",
        "Cache-Control": "no-store",
      },
    });
  const response = new Response(asset.body, { status, headers: asset.headers });
  response.headers.set(
    "Cache-Control",
    privatePaths.has(url.pathname)
      ? "private, no-store"
      : "public, max-age=0, must-revalidate",
  );
  if (
    status === 404 ||
    privatePaths.has(url.pathname) ||
    url.hostname.endsWith(".workers.dev")
  )
    response.headers.set("X-Robots-Tag", "noindex, follow");
  if (url.pathname === "/reset-password")
    response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
