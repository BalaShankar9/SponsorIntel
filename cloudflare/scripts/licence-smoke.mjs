import assert from "node:assert/strict";

// Read-only acceptance against a populated local or live Worker.
const base = process.argv[2] || "http://127.0.0.1:8788";
async function get(path) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200, path);
  assert.equal(r.headers.get("cache-control"), "no-store", path);
  return r.json();
}
const all = await get("/api/jobs"), first = await get("/api/jobs?licence=matched");
assert.equal(first.licence_register.available, true, "Register checks must be current");
assert.ok(first.total > 0, "The reviewed collection must contain live jobs");
assert.equal(first.total, all.collections.licensed);
const jobs = [...first.items];
assert.ok(first.pages <= 100, "Bounded acceptance scan");
for (let page = 2; page <= first.pages; page++) {
  const result = await get(`/api/jobs?licence=matched&page=${page}`);
  assert.equal(result.total, first.total, "Collection changed during acceptance; rerun after the refresh");
  jobs.push(...result.items);
}
assert.equal(jobs.length, first.total);
assert.equal(new Set(jobs.map((j) => j.id)).size, first.total);
const employers = new Map();
for (const job of jobs) {
  assert.ok(job.employer_licence, job.id);
  assert.ok(job.employer_licence.routes.includes("Skilled Worker"));
  assert.equal(job.employer_licence.source_date, first.licence_register.source_date);
  employers.set(job.employer_licence.id, job.employer_licence);
}
for (const [id, linked] of employers) {
  const official = await get("/api/sponsors/" + id);
  assert.equal(official.name, linked.name);
  assert.equal(official.source_date, linked.source_date);
  assert.ok(official.routes.includes("Skilled Worker"));
}
for (const status of ["offered", "conditional", "not_stated", "unavailable"]) {
  const result = await get("/api/jobs?licence=matched&sponsorship=" + status);
  assert.equal(result.total, jobs.filter((j) => j.sponsorship === status).length);
  assert.ok(result.items.every((j) => j.employer_licence && j.sponsorship === status));
}
const detail = await get("/api/jobs/" + jobs[0].id);
assert.deepEqual(detail.employer_licence, jobs[0].employer_licence);
const page = await fetch(base + "/jobs/" + jobs[0].id);
assert.equal(page.status, 200);
const html = await page.text();
assert.ok(html.includes("Ask which legal entity would employ and sponsor you"));
assert.ok(html.includes(detail.employer_licence.name));
assert.ok(!html.includes("PRIVATE QA"));
console.log(JSON.stringify({ base, checked_at: new Date().toISOString(), total_jobs: all.total,
  licensed_company_jobs: jobs.length, linked_employers: employers.size,
  advert_wording: Object.fromEntries(["offered", "conditional", "not_stated", "unavailable"].map((s) => [s, jobs.filter((j) => j.sponsorship === s).length])),
  register: first.licence_register, sample_role: "/jobs/" + jobs[0].id,
}, null, 2));
