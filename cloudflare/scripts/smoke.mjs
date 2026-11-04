import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8788";
const checks = [];
async function get(path) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  return r.json();
}
assert.equal((await get("/api/health")).ok, true);
checks.push("health");
const meta = await get("/api/meta");
assert.ok(meta.employers >= 100000 && meta.employers <= 300000);
assert.match(meta.source_date, /^20\d{2}-\d{2}-\d{2}$/);
if (meta.source_date === "2026-10-02") assert.equal(meta.employers, 127902);
checks.push("verified record count");
assert.equal(
  (await get("/api/sponsors?q=Google")).items[0].name,
  "Google (UK) Limited",
);
checks.push("company search");
assert.equal((await get("/api/sponsors?q=Google&rating=A")).total, 1);
checks.push("A Premium rating");
assert.ok(
  (await get("/api/sponsors?city=Cardiff&route=Skilled%20Worker")).total > 100,
);
checks.push("city and route filters");
assert.equal(
  (await get("/api/sponsors?q=ThisCompanyDoesNotExist428695")).total,
  0,
);
checks.push("empty results");
assert.equal(
  (await get("/api/sponsors?q=" + encodeURIComponent("%' OR 1=1 --"))).total,
  0,
);
checks.push("literal injection search");
assert.equal((await get("/api/sponsors?page=0")).page, 1);
checks.push("page bounds");
assert.equal((await get("/api/sponsors?page=2")).items.length, 12);
checks.push("pagination");
assert.equal((await get("/api/featured")).items.length, 8);
checks.push("featured real employers");
assert.equal((await get("/api/cities")).length, 80);
checks.push("city suggestions");
assert.equal((await fetch(base + "/api/sponsors/not-a-real-id")).status, 404);
checks.push("invalid employer");
assert.equal((await fetch(base + "/api/admin")).status, 404);
checks.push("no exposed admin endpoint");
for (const path of [
  "/",
  "/saved",
  "/applications",
  "/jobs",
  "/guides",
  "/settings",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Sponsor Intel/);
  assert.ok(r.headers.get("content-security-policy"));
  checks.push("route " + path);
}
if (process.argv.includes("--local-feedback")) {
  assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):/);
  const body = JSON.stringify({
    kind: "feedback",
    message: "LOCAL QA TEST: feedback delivery and private storage.",
  });
  const send = (origin) =>
    fetch(base + "/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body,
    });
  assert.equal((await send("https://untrusted.example")).status, 403);
  checks.push("feedback origin enforcement");
  for (let i = 0; i < 5; i++) assert.equal((await send(base)).status, 201);
  assert.equal((await send(base)).status, 429);
  checks.push("private feedback and rate limit");
}
console.log(
  JSON.stringify(
    {
      base,
      passed: checks.length,
      checks,
      checked_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
