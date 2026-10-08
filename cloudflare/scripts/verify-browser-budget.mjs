import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import pages from "../shared/pages.json" with { type: "json" };

const dist = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL(".vite/manifest.json", dist), "utf8"));
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
assert.ok(entry, "Browser entry is missing");
const initial = new Set();
function visit(key) {
  if (initial.has(key)) return;
  assert.ok(manifest[key], `Missing browser dependency: ${key}`);
  initial.add(key);
  for (const dependency of manifest[key].imports || []) visit(dependency);
}
visit(entry);
const owner = manifest["src/owner.tsx"];
assert.ok(owner?.isDynamicEntry, "Owner tools must remain an on-demand entry");
assert.ok(!initial.has("src/owner.tsx"), "Public pages must not preload owner tools");

const javascript = new Set([...initial].map((key) => manifest[key].file));
const styles = new Set([...initial].flatMap((key) => manifest[key].css || []));
async function sizes(files) {
  const results = await Promise.all([...files].map(async (file) => {
    const body = await readFile(new URL(file, dist));
    return { file, bytes: body.length, gzip_bytes: gzipSync(body).length };
  }));
  return { files: results, bytes: results.reduce((n, x) => n + x.bytes, 0), gzip_bytes: results.reduce((n, x) => n + x.gzip_bytes, 0) };
}
const js = await sizes(javascript), css = await sizes(styles);
// Decimal byte budgets cover every eager dependency, not just the biggest file.
// Compression is reproducible build gzip, not a promised network transfer size.
assert.ok(js.bytes <= 420_000 && js.gzip_bytes <= 130_000, `Initial JavaScript exceeds budget: ${JSON.stringify(js)}`);
assert.ok(css.bytes <= 110_000 && css.gzip_bytes <= 23_000, `Initial CSS exceeds budget: ${JSON.stringify(css)}`);
for (const page of Object.values(pages)) {
  const file = page.path === "/" ? "index.html" : `${page.path.slice(1)}/index.html`;
  const html = await readFile(new URL(file, dist), "utf8");
  assert.match(html, /<h1[\s>]/, `${file} lost its prerendered heading`);
  assert.ok(!html.includes("Opening your dashboard") && !html.includes("The dashboard couldn’t open"), `${file} contains an admin loading state`);
  const links = html.match(/<(?:script|link)\b[^>]*>/g) || [];
  assert.ok(!links.some((tag) => tag.includes(owner.file) || (owner.css || []).some((file) => tag.includes(file))), `${file} preloads owner-only assets`);
}
console.log(JSON.stringify({ initial_javascript: js, initial_css: css, deferred_owner: owner.file, public_pages: Object.keys(pages).length }, null, 2));
