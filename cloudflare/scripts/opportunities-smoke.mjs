import assert from "node:assert/strict";
import { BOARDS } from "../worker/job-sources.js";
const base = process.argv[2] || "http://127.0.0.1:8788";
async function get(path) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  return r.json();
}
const all = await get("/api/jobs");
assert.equal(all.catalog_total, all.collections.total);
assert.ok(all.catalog_total > 0);
assert.equal(all.sources.length, BOARDS.length);
for (const board of BOARDS) {
  const s = all.sources.find((s) => s.id === board.id);
  assert.ok(s, board.id);
  assert.equal(s.error, null, board.id);
  assert.ok(
    Date.now() - Date.parse(s.last_success) < 86400000,
    "Fresh " + board.id,
  );
}
for (const [query, count, check] of [
  [
    "sponsorship=mentioned",
    all.collections.sponsorship,
    (j) => ["offered", "conditional"].includes(j.sponsorship) && j.evidence,
  ],
  [
    "level=early_career",
    all.collections.early_career,
    (j) => j.level === "early_career",
  ],
  ["salary=listed", all.collections.salary, (j) => j.salary_excerpt],
]) {
  const d = await get("/api/jobs?" + query);
  assert.equal(d.total, count);
  assert.ok(d.items.every(check));
}
const earlySponsor = await get(
  "/api/jobs?level=early_career&sponsorship=mentioned",
);
assert.ok(
  earlySponsor.items.every(
    (j) =>
      j.level === "early_career" &&
      ["offered", "conditional"].includes(j.sponsorship),
  ),
);
const finance = await get("/api/jobs?sector=finance&salary=listed");
assert.ok(
  finance.items.every((j) => j.sector === "finance" && j.salary_excerpt),
);
const health = await get("/api/jobs?sector=healthcare");
assert.ok(health.items.every((j) => j.sector === "healthcare"));
const hybrid = await get("/api/jobs?q=Cloudflare");
assert.ok(hybrid.total > 0);
assert.ok(hybrid.items.every((j) => !/^(Hybrid|Remote)$/i.test(j.location)));
const absent = await get("/api/jobs?q=NoSuchRole459203094");
assert.equal(absent.total, 0);
const first = all.items[0];
const detail = await get("/api/jobs/" + first.id);
assert.equal(detail.id, first.id);
assert.equal(detail.active, 1);
assert.ok(detail.description);
assert.equal(new URL(detail.apply_url).protocol, "https:");
assert.equal(
  (await fetch(base + "/api/admin/refresh-jobs", { method: "POST" })).status,
  401,
);
console.log(
  JSON.stringify(
    {
      base,
      passed: 12,
      boards: all.sources.length,
      collections: all.collections,
      early_career_with_sponsorship_wording: earlySponsor.total,
      checked_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
