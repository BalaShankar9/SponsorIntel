import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import { jobAvailability, jobMetadata, jobPath, jobTimestamp, JOB_FRESHNESS_MS } from "../shared/job-detail.js";
import { getJobDetail, jobsAPI } from "../worker/jobs.js";
import { canonicalPath, pageResponse, sitemapResponse } from "../worker/pages.js";

const id = "1234567890abcdef12345678";
const now = Date.parse("2026-10-05T12:00:00Z");
function job(patch = {}) {
  return { id, board_id: "monzo", company: "LOCAL QA Employer", title: "Graduate engineer",
    location: "London", description: "Build useful tools.\nRequirements from the employer.",
    apply_url: "https://example.com/careers/role", provider: "greenhouse", sponsorship: "conditional",
    evidence: "Sponsorship may be available for eligible roles.", level: "early_career", active: 1,
    first_seen: new Date(now - 86400000).toISOString(), last_seen: new Date(now).toISOString(), ...patch };
}
function fixture(rows) {
  const sql = new DatabaseSync(":memory:");
  for (const name of ["0001_initial.sql", "0002_career.sql", "0004_quality_updates.sql", "0010_business_operations.sql"])
    sql.exec(readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"));
  for (const row of rows) {
    const keys = Object.keys(row);
    sql.prepare(`INSERT INTO jobs (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`)
      .run(...Object.values(row));
  }
  sql.prepare("INSERT INTO job_sources(id,company,careers_url,checked_at,last_success,error) VALUES(?,?,?,?,?,?)")
    .run("monzo", "LOCAL QA Employer", "https://example.com/careers", new Date(now).toISOString(), new Date(now).toISOString(), "Refresh delayed");
  return { sql, DB: { prepare(query) { let args = []; return {
    bind(...values) { args = values; return this; },
    async first() { const row = sql.prepare(query).get(...args); return row ? { ...row } : null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
  }; } } };
}

test("freshness fails closed for removed, old, corrupt and future observations", () => {
  assert.equal(jobTimestamp("2026-10-05"), "5 Oct 2026");
  assert.match(jobTimestamp("2026-10-05T12:00:00Z"), /13:00 BST/);
  assert.equal(jobAvailability(job(), now), "current");
  assert.equal(jobAvailability(job({ active: 0 }), now), "removed");
  assert.equal(jobAvailability(job({ last_seen: new Date(now - JOB_FRESHNESS_MS).toISOString() }), now), "stale");
  assert.equal(jobAvailability(job({ last_seen: "invalid" }), now), "stale");
  assert.equal(jobAvailability(job({ last_seen: new Date(now + 300001).toISOString() }), now), "stale");
  assert.equal(jobAvailability(job({ last_seen: new Date(now - JOB_FRESHNESS_MS + 1).toISOString() }), now), "current");
  assert.equal(jobMetadata(job({ active: 0 }), now).indexable, false);
  assert.equal(jobPath("../../private"), null);
  assert.equal(canonicalPath(`/jobs/${id}/index.html`), `/jobs/${id}`);
});

test("detail API includes only public source context and revalidates each read", async () => {
  const f = fixture([job()]);
  try {
    const data = await getJobDetail(id, f);
    assert.deepEqual(data.source, { careers_url: "https://example.com/careers", checked_at: new Date(now).toISOString(), last_success: new Date(now).toISOString(), error: "Refresh delayed" });
    assert.ok(data.sector_label);
    const r = await jobsAPI(new URL("https://sponsorintel.london/api/jobs/" + id), f);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    f.sql.prepare("UPDATE jobs SET active=0 WHERE id=?").run(id);
    assert.equal((await getJobDetail(id, f)).active, 0);
    assert.equal(await getJobDetail("invalid", f), null);
    assert.equal((await jobsAPI(new URL("https://sponsorintel.london/api/jobs/" + "f".repeat(24)), f)).status, 404);
  } finally { f.sql.close(); }
});

test("sitemap includes fresh role links and removes stale or inactive records", async () => {
  const staleID = "2".repeat(24), closedID = "3".repeat(24), futureID = "4".repeat(24);
  const f = fixture([job(), job({ id: staleID, last_seen: new Date(now - JOB_FRESHNESS_MS).toISOString() }),
    job({ id: closedID, active: 0 }), job({ id: futureID, last_seen: new Date(now + 300001).toISOString() })]);
  try {
    const r = await sitemapResponse(f, now);
    const xml = await r.text();
    assert.match(xml, new RegExp("/jobs/" + id));
    for (const absent of [staleID, closedID, futureID]) assert.ok(!xml.includes(absent));
    assert.doesNotMatch(xml, /account|applications|studio|utm_/);
    assert.equal(r.headers.get("cache-control"), "no-store");
    f.sql.prepare("UPDATE jobs SET active=0 WHERE id=?").run(id);
    assert.ok(!(await (await sitemapResponse(f, now)).text()).includes(id));
  } finally { f.sql.close(); }
});

test("missing roles return 404 and failed reads return retryable 503", async () => {
  const ASSETS = { fetch: async () => new Response("Not found", { headers: { "Content-Type": "text/html" } }) };
  const f = fixture([]);
  try {
    const r = await pageResponse(new Request("https://sponsorintel.london/jobs/" + id), { ...f, ASSETS });
    assert.equal(r.status, 404);
    assert.match(r.headers.get("x-robots-tag"), /noindex/);
    const broken = { DB: { prepare() { throw new Error("LOCAL QA database unavailable"); } }, ASSETS };
    for (const path of ["/jobs/" + id, "/sitemap.xml"]) {
      const failed = await pageResponse(new Request("https://sponsorintel.london" + path), broken);
      assert.equal(failed.status, 503);
      assert.equal(failed.headers.get("retry-after"), "60");
      assert.match(failed.headers.get("x-robots-tag"), /noindex/);
    }
    const redirect = await pageResponse(new Request(`https://www.sponsorintel.london/jobs/${id}/?utm_source=whatsapp`), f);
    assert.equal(redirect.headers.get("location"), `https://sponsorintel.london/jobs/${id}?utm_source=whatsapp`);
  } finally { f.sql.close(); }
});

test("server-rendered role pages have readable evidence, safe metadata and correct expiry states", async (t) => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom", logLevel: "error" });
  t.after(() => vite.close());
  const { renderJobPage } = await vite.ssrLoadModule("/worker/job-pages.tsx");
  const template = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const assets = { fetch: async () => new Response(template) };
  const request = new Request("https://sponsorintel.london/jobs/" + id + "?utm_source=whatsapp");
  const current = job({ last_seen: new Date().toISOString(), title: 'Engineer </title><script>alert(1)</script> $&',
    description: '</div><img src=x onerror=alert(1)> $&', source: { error: "Refresh delayed" } });
  const r = await renderJobPage(request, assets, current);
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /<h1>Engineer &lt;\/title&gt;/);
  assert.match(html, /Sponsorship may be available/);
  assert.match(html, /latest employer-board refresh was delayed/);
  assert.ok(html.includes(`rel="canonical" href="https://sponsorintel.london/jobs/${id}"`));
  assert.ok(!html.includes('utm_source'));
  assert.doesNotMatch(html, /<script>alert\(1\)|<img src=x/);
  assert.equal(JSON.parse(html.match(/id="job-data">([^<]*)<\/script>/)[1]).description, current.description);
  const schema = JSON.parse(html.match(/id="structured-data">([^<]*)<\/script>/)[1]);
  assert.ok(schema["@graph"].some((x) => x["@type"] === "BreadcrumbList"));
  assert.ok(!schema["@graph"].some((x) => x["@type"] === "JobPosting"));
  assert.match(html, /name="robots"\s+content="index,follow,max-image-preview:large"/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(html, /may still be licensed/);
  const linked = await renderJobPage(request, assets, { ...current, employer_licence: {
    id: "a".repeat(24), name: "LOCAL QA Legal <Company>", city: "London", routes: ["Skilled Worker"], ratings: ["Worker (A rating)"],
    source_date: "2026-10-05", checked_at: "2026-10-06T08:00:00Z", reviewed_at: "2026-10-06", evidence_url: "https://example.com/legal",
  } });
  const linkedHTML = await linked.text();
  assert.match(linkedHTML, /LOCAL QA Legal &lt;Company&gt;/);
  assert.match(linkedHTML, /Ask which legal entity would employ and sponsor you/);
  assert.match(linkedHTML, /Employer identity source/);
  assert.match(linkedHTML, /Sponsorship may be available/);
  const closed = await renderJobPage(request, assets, { ...current, active: 0 });
  assert.equal(closed.status, 410);
  assert.match(closed.headers.get("x-robots-tag"), /noindex/);
  assert.match(await closed.text(), /No longer in our current collection/);
  const stale = await renderJobPage(request, assets, { ...current, last_seen: "2000-01-01T00:00:00Z" });
  assert.equal(stale.status, 200);
  assert.match(stale.headers.get("x-robots-tag"), /noindex/);
  assert.match(await stale.text(), /This information needs a fresh check/);
  const fallback = await renderJobPage(new Request("https://example.workers.dev/jobs/" + id), assets, current);
  assert.match(fallback.headers.get("x-robots-tag"), /noindex/);
  assert.equal((await renderJobPage(request, { fetch: async () => new Response("missing", { status: 404 }) }, current)).status, 503);
  const payPage = await renderJobPage(request, assets, { ...current, salary_excerpt: "Obsolete single quote",
    description: "£85,000 - £110,000 base salary per year\n£78,000 - £110,000 base salary per year\n£67,000 Total OTE (base salary + commission)\n£42,500 pro rata <img src=x onerror=alert(1)>" });
  const payHTML = await payPage.text();
  const facts = payHTML.match(/<section class="role-panel role-facts">([\s\S]*?)<\/section>/)[1];
  assert.match(facts, /Several pay statements/);
  assert.match(facts, /£85,000 - £110,000/);
  assert.match(facts, /£78,000 - £110,000/);
  assert.match(facts, /not a guaranteed base salary/);
  assert.match(facts, /adjusted for the working time/);
  assert.doesNotMatch(facts, /Obsolete single quote|<img src=x/);
  assert.match(facts, /&lt;img src=x/);
});
