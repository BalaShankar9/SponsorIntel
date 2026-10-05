import assert from "node:assert/strict";
import pages from "../shared/pages.json" with { type: "json" };
const base = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const canonical = "https://sponsorintel.london";
let checks = 0;
for (const [view, page] of Object.entries(pages)) {
  const r = await fetch(base + page.path, {
    headers: { "User-Agent": "SponsorIntel-SEO-check" },
  });
  assert.equal(r.status, 200, page.path);
  const html = await r.text();
  assert.ok(/<h1[ >]/.test(html), `real heading in initial HTML: ${page.path}`);
  assert.ok(
    html.includes(`href="${canonical}${page.path}"`),
    `canonical: ${page.path}`,
  );
  const escape = (s) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("'", "&#39;")
      .replaceAll('"', "&quot;");
  assert.ok(
    html.includes(`<title>${escape(page.title)}</title>`),
    `title: ${page.path}`,
  );
  assert.ok(
    html.includes(`content="${escape(page.description)}"`),
    `description: ${page.path}`,
  );
  assert.match(html, /content="index,follow,max-image-preview:large"/);
  assert.match(
    html,
    /property="og:image"\s+content="https:\/\/sponsorintel.london\/share-card-v1.jpg"/,
  );
  assert.match(html, /name="google-site-verification"/);
  const schema = JSON.parse(
    html.match(/id="structured-data">([^<]*)<\/script>/)?.[1],
  );
  assert.ok(
    schema["@graph"].some(
      (x) => x["@type"] === "WebPage" && x.url === canonical + page.path,
    ),
  );
  if (view.startsWith("guides/")) {
    assert.match(html, /Go straight to the source/);
    assert.match(html, /www.gov.uk/);
  }
  console.log(`PASS readable HTML, metadata and structured data ${page.path}`);
  checks++;
}
const sitemap = await (await fetch(base + "/sitemap.xml")).text();
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => m[1],
);
assert.ok(sitemapLocations.length >= Object.keys(pages).length);
assert.equal(new Set(sitemapLocations).size, sitemapLocations.length);
for (const url of sitemapLocations) {
  const path = new URL(url).pathname;
  assert.ok(
    Object.values(pages).some((p) => p.path === path) ||
      /^\/jobs\/[a-f0-9]{24}$/.test(path),
  );
  assert.equal(url, canonical + path);
}
for (const p of Object.values(pages))
  assert.ok(sitemap.includes(canonical + p.path));
assert.doesNotMatch(sitemap, /account|saved|applications|utm_/);
checks++;
for (const path of [
  "/account",
  "/signin",
  "/signup",
  "/admin",
  "/career-profile",
  "/studio",
  "/applications",
  "/saved",
  "/settings",
  "/employer-notes",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("x-robots-tag"), /noindex/);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.match(await r.text(), /name="robots" content="noindex,follow"/);
}
checks++;
for (const path of [
  "/this-page-does-not-exist",
  "/jobs/fake-vacancy",
  "/app.html",
  "/guides/no-such-guide",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 404);
  assert.match(r.headers.get("x-robots-tag"), /noindex/);
}
checks++;
const slash = await fetch(base + "/jobs/?q=engineer&utm_source=whatsapp", {
  redirect: "manual",
});
assert.equal(slash.status, 301);
assert.equal(
  slash.headers.get("location"),
  base + "/jobs?q=engineer&utm_source=whatsapp",
);
checks++;
const image = await fetch(base + "/share-card-v1.jpg");
assert.equal(image.status, 200);
assert.match(image.headers.get("content-type"), /image\/jpeg/);
assert.ok((await image.arrayBuffer()).byteLength > 10000);
checks++;
const robots = await (await fetch(base + "/robots.txt")).text();
assert.match(robots, /Sitemap: https:\/\/sponsorintel.london\/sitemap.xml/);
assert.doesNotMatch(
  robots,
  /Disallow: \/(?:account|jobs|guides|updates|api\/$)/m,
);
checks++;
const head = await fetch(base + "/guides/check-uk-sponsor", { method: "HEAD" });
assert.equal(head.status, 200);
assert.equal(await head.text(), "");
checks++;
console.log(
  `PASS ${checks} SEO checks (no-JavaScript HTML, canonical URLs, sitemap, noindex, 404, share image and HEAD).`,
);
