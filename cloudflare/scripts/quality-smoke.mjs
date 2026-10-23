import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8788",
  checks = [];
async function get(path) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  return r.json();
}
const news = await get("/api/updates");
assert.equal(news.interval_minutes, 15);
assert.ok(news.sources.length >= 6);
checks.push("official source coverage");
for (const s of news.sources) {
  assert.equal(new URL(s.url).hostname, "www.gov.uk");
  assert.ok(
    s.last_success && Date.now() - Date.parse(s.last_success) < 3600000,
    "source freshness: " + s.id,
  );
  assert.equal(s.error, null, "source health: " + s.id);
  if (s.summary) {
    assert.equal(s.status, "explained");
    assert.equal(s.summary.content_hash, s.content_hash);
    assert.ok(s.summary.points.length);
  }
}
checks.push("fresh source checks and pinned explanations");
assert.ok(news.sources.filter((s) => s.summary).length >= 5);
checks.push("five explanations available");
assert.ok(news.events.every((e) => e.kind !== "baseline"));
checks.push("baseline excluded from change log");
const unauthorised = await fetch(base + "/api/admin/refresh-updates", {
  method: "POST",
});
assert.equal(unauthorised.status, 401);
checks.push("refresh protected");
const jobs = await get("/api/jobs");
assert.ok(jobs.catalog_total > 0);
for (const id of ["figma", "octopus-energy", "funding-circle"]) {
  const s = jobs.sources.find((s) => s.id === id);
  assert.ok(s && !s.error && s.count > 0, id);
}
checks.push("new employer feeds healthy");
const paid = await get("/api/jobs?salary=listed");
assert.ok(paid.total > 0);
assert.ok(paid.items.every((j) => j.salary_excerpt));
checks.push("pay evidence filter");
const early = await get("/api/jobs?level=early_career");
assert.ok(early.items.every((j) => !/^Internal Audit/i.test(j.title)));
checks.push("no internal-audit internship false positives");
const detail = await get("/api/jobs/" + jobs.items[0].id);
assert.equal(typeof detail.salary_excerpt, "string");
assert.equal(typeof detail.employment_type, "string");
checks.push("job evidence detail");
const page = await fetch(base + "/updates");
assert.equal(page.status, 200);
assert.match(page.headers.get("content-type"), /text\/html/);
assert.ok(page.headers.get("content-security-policy"));
checks.push("updates route and security headers");
const sitemap = await (await fetch(base + "/sitemap.xml")).text();
assert.match(sitemap, /https:\/\/sponsorintel\.london\/updates/);
checks.push("public sitemap");
console.log(
  JSON.stringify(
    {
      base,
      passed: checks.length,
      checks,
      jobs: jobs.catalog_total,
      sources: news.sources.length,
      checked_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
