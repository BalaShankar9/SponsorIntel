import test from "node:test";
import assert from "node:assert/strict";
import { canonicalPath, pageResponse } from "../worker/pages.js";
const env = {
  ASSETS: {
    fetch: async (r) =>
      new Response(`<html>${new URL(r.url).pathname}</html>`, {
        headers: { "Content-Type": "text/html" },
      }),
  },
};
test("public HTML routing canonicalises paths without discarding campaign or search values", async () => {
  const r = await pageResponse(
    new Request(
      "https://www.sponsorintel.london/jobs/?q=engineer&utm_source=whatsapp",
    ),
    env,
  );
  assert.equal(r.status, 301);
  assert.equal(
    r.headers.get("location"),
    "https://sponsorintel.london/jobs?q=engineer&utm_source=whatsapp",
  );
  assert.equal(
    canonicalPath("/guides/check-uk-sponsor/index.html"),
    "/guides/check-uk-sponsor",
  );
  assert.equal(canonicalPath("/not-a-real-page/"), null);
});
test("public pages select their actual generated document", async () => {
  const r = await pageResponse(
    new Request(
      "https://sponsorintel.london/guides/check-uk-sponsor?utm_source=whatsapp",
    ),
    env,
  );
  assert.equal(r.status, 200);
  assert.match(await r.text(), /\/guides\/check-uk-sponsor\/index.html/);
  assert.doesNotMatch(r.headers.get("cache-control"), /immutable/);
});
test("private workspace and unknown URLs cannot return indexable public HTML", async () => {
  const r = await pageResponse(
    new Request("https://sponsorintel.london/career-profile"),
    env,
  );
  assert.equal(r.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.match(await r.text(), /\/app.html/);
  const missing = await pageResponse(
    new Request("https://sponsorintel.london/invented-job"),
    env,
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("x-robots-tag"), "noindex, follow");
  assert.match(await missing.text(), /\/404.html/);
});
test("missing deployment assets fail closed instead of becoming a soft 404", async () => {
  const r = await pageResponse(
    new Request("https://sponsorintel.london/jobs"),
    { ASSETS: { fetch: async () => new Response("missing", { status: 404 }) } },
  );
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("x-robots-tag"), "noindex");
});
test("fallback hostname is not indexed and mutations never become page requests", async () => {
  const r = await pageResponse(
    new Request("https://sponsorintel.balashankarbollineni4.workers.dev/"),
    env,
  );
  assert.equal(r.headers.get("x-robots-tag"), "noindex, follow");
  const post = await pageResponse(
    new Request("https://sponsorintel.london/jobs", { method: "POST" }),
    env,
  );
  assert.equal(post.status, 405);
});
