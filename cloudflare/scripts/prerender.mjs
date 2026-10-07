import { createServer } from "vite";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import pages from "../shared/pages.json" with { type: "json" };
// Render the same React components delivered to people, without browser state,
// cookies, an account, or copied live feed data. Feeds load from their fresh APIs.
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
try {
  await copyFile('shared/campaigns.js', 'dist/campaigns.js');
  const { render, pageMeta, structuredData } = await vite.ssrLoadModule(
    "/src/entry-server.tsx",
  );
  const template = await readFile("dist/index.html", "utf8");
  if (!template.includes('<div id="root"></div>'))
    throw new Error(
      "Run npm run build to generate a fresh Vite template before pre-rendering.",
    );
  for (const [view, path] of [
    ...Object.entries(pages).map(([k, v]) => [k, v.path]),
    ["account", "/app"],
    ["not-found", "/404"],
  ]) {
    const meta = pageMeta(view);
    const indexable = !!pages[view];
    let html = template.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escape(meta.title)}</title>`,
    );
    const metas = {
      description: meta.description,
      robots: indexable
        ? "index,follow,max-image-preview:large"
        : "noindex,follow",
      "og:title": meta.title,
      "og:description": meta.description,
      "og:url": "https://sponsorintel.london" + meta.path,
      "twitter:title": meta.title,
      "twitter:description": meta.description,
    };
    for (const [name, value] of Object.entries(metas)) {
      html = html.replace(
        new RegExp(
          `<meta\\s+(?:name|property)="${name}"\\s+content="[^"]*"\\s*/?>`,
        ),
        (match) =>
          match.replace(/content="[^"]*"/, `content="${escape(value)}"`),
      );
    }
    html = html.replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="https://sponsorintel.london${meta.path}" />`,
    );
    const schema = JSON.stringify(structuredData(view)).replace(
      /</g,
      "\\u003c",
    );
    html = html.replace(
      /<script\b[^>]*id="structured-data"[^>]*>[\s\S]*?<\/script>/,
      `<script type="application/ld+json" id="structured-data">${schema}</script>`,
    );
    const body =
      path === "/app" ? "" : render(path === "/404" ? "/not-found" : path);
    html = html.replace(
      '<div id="root"></div>',
      `<noscript><p class="seo-noscript">You can read our guides and follow source links here. Enable JavaScript to search employers, load current vacancies and use your personal workspace.</p></noscript><div id="root">${body}</div>`,
    );
    const file =
      path === "/"
        ? "dist/index.html"
        : path === "/app" || path === "/404"
          ? `dist${path}.html`
          : `dist${path}/index.html`;
    await mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    await writeFile(file, html);
  }
  // The sitemap comes from the same public route list. Private workspace paths,
  // search filters and unknown URLs can never leak into it.
  await writeFile(
    "dist/sitemap.xml",
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      Object.values(pages)
        .map(
          (p) => `  <url><loc>https://sponsorintel.london${p.path}</loc></url>`,
        )
        .join("\n") +
      "\n</urlset>\n",
  );
  console.log(
    `Pre-rendered ${Object.keys(pages).length} public pages, a private shell and a real 404 page.`,
  );
} finally {
  await vite.close();
}
