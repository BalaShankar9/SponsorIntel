import pages from "../shared/pages.json" with { type: "json" };
const publicPaths = new Set(Object.values(pages).map((p) => p.path));
const privatePaths = new Set([
  "/account",
  "/career-profile",
  "/studio",
  "/applications",
  "/saved",
  "/settings",
  "/employer-notes",
]);
const known = (p) => publicPaths.has(p) || privatePaths.has(p);
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
  if (publicPaths.has(url.pathname))
    assetPath =
      url.pathname === "/" ? "/index.html" : url.pathname + "/index.html";
  else if (privatePaths.has(url.pathname)) assetPath = "/app.html";
  else if (
    /^\/(assets\/|fonts\/|favicon\.svg$|share-card-v1\.jpg$|robots\.txt$|sitemap\.xml$|open-source-notices\.txt$)/.test(
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
  return response;
}
