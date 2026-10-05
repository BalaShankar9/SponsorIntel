import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import {
  metricRoute,
  recordMetric,
  analyticsAPI,
  responseMetric,
} from "../worker/analytics.js";
import { validateBoard, adminAPI } from "../worker/admin.js";
import { searchAdvisers } from "../worker/advisers.js";
import {
  officialPath,
  sourceFromContent,
  retrieveSources,
  validateAnswer,
  chatAPI,
} from "../worker/chat.js";
function database() {
  const sql = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    sql.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  return {
    sql,
    DB: {
      prepare(query) {
        let args = [];
        return {
          bind(...values) {
            args = values;
            return this;
          },
          async first() {
            return sql.prepare(query).get(...args) || null;
          },
          async all() {
            return { results: sql.prepare(query).all(...args) };
          },
          async run() {
            sql.prepare(query).run(...args);
            return { success: true };
          },
        };
      },
    },
  };
}
const req = (path, body, origin = "https://sponsorintel.london") =>
  new Request("https://sponsorintel.london" + path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "198.51.100.9",
    },
    body: JSON.stringify(body),
  });
test("analytics drop queries, private identifiers and unknown routes; counts persist without identity", async () => {
  const env = database();
  assert.equal(
    metricRoute("/jobs/" + "a".repeat(24) + "?email=private@example.com"),
    "/jobs/:id",
  );
  assert.equal(metricRoute("/unknown/private-person"), null);
  assert.equal(metricRoute("/admin"), null);
  assert.equal(responseMetric("/api/chat", "POST", 503), null);
  assert.equal(responseMetric("/api/chat", "POST", 200), "guidance_answer");
  const r = await analyticsAPI(
    req("/api/metrics", { page: "/jobs?q=private name" }),
    env,
  );
  assert.equal(r.status, 200);
  await recordMetric(env, "page_view", "/jobs");
  const row = env.sql.prepare("SELECT * FROM analytics_daily").get();
  assert.equal(row.count, 2);
  assert.equal(row.dimension, "/jobs");
  assert.equal(JSON.stringify(row).includes("private"), false);
  assert.equal(
    (
      await analyticsAPI(
        req("/api/metrics", { page: "/jobs" }, "https://evil.example"),
        env,
      )
    ).status,
    403,
  );
});
test("admin API denies unauthenticated access even to an apparent owner query", async () => {
  const env = database();
  const r = await adminAPI(
    new Request(
      "https://sponsorintel.london/api/admin/dashboard?email=owner@example.com",
    ),
    env,
  );
  assert.equal(r.status, 403);
  assert.equal((await r.json()).users, undefined);
});
test("employer intake blocks arbitrary feed hosts, path injection and unreviewable sources", () => {
  const good = {
    company: "A real company",
    provider: "ashby",
    board: "real-board",
    careers: "https://employer.example/careers",
    sector: "technology",
    sponsor_id: "a".repeat(24),
    evidence:
      "The official careers page links to this board. Legal entity checked.",
  };
  assert.equal(validateBoard(good).id, "reviewed-ashby-real-board");
  for (const patch of [
    { provider: "custom" },
    { board: "../../internal" },
    { board: "valid?destination=bad" },
    { careers: "javascript:alert(1)" },
    { careers: "https://user:pass@employer.example" },
    { sponsor_id: "unverified" },
    { evidence: "trust me" },
  ])
    assert.throws(() => validateBoard({ ...good, ...patch }));
});
test("adviser directory preserves official snapshot dates and returns bounded literal results without ratings", () => {
  const all = searchAdvisers(new URLSearchParams());
  assert.equal(all.catalog_total, 2274);
  assert.equal(all.as_of, "2026-07-09");
  assert.equal(all.items.length, 12);
  const exact = searchAdvisers(new URLSearchParams({ q: all.items[0].id }));
  assert.equal(exact.total, 1);
  assert.equal(exact.items[0].rating, undefined);
  assert.equal(searchAdvisers(new URLSearchParams({ q: "% OR 1=1" })).total, 0);
  assert.ok(
    searchAdvisers(new URLSearchParams({ level: "Level 3" })).items.every(
      (a) => a.level === "Level 3",
    ),
  );
});
const content = {
  base_path: "/graduate-visa",
  title: "Graduate visa",
  public_updated_at: "2026-10-05",
  details: {
    parts: [
      {
        title: "Overview",
        body: "<p>You cannot extend your Graduate visa. You may be able to switch to a different visa, for example a Skilled Worker visa.</p>",
      },
    ],
  },
  withdrawn_notice: {},
};
test("chat retrieval rejects external URLs, withdrawn pages, incomplete publications and mismatched content", () => {
  for (const p of [
    "https://evil.example",
    "//evil.example/x",
    "/path?redirect=bad",
    "/../private",
  ])
    assert.equal(officialPath(p), null);
  const s = sourceFromContent(content, "/graduate-visa", "extend");
  assert.match(s.text, /cannot extend/);
  for (const c of [
    { ...content, withdrawn_notice: { explanation: "withdrawn" } },
    { ...content, base_path: "/another-visa" },
    { ...content, details: { attachments: [{ url: "some.pdf" }] } },
  ])
    assert.throws(() => sourceFromContent(c, "/graduate-visa", "extend"));
});
test("chat only returns paragraphs anchored to existing source IDs, verbatim evidence and quoted figures", () => {
  const sources = [
    { ...sourceFromContent(content, "/graduate-visa", "extend"), id: "S1" },
  ];
  const good = {
    status: "answered",
    message: "",
    blocks: [
      {
        text: "A Graduate visa cannot be extended.",
        source_id: "S1",
        evidence_ids: ["S1.1"],
      },
    ],
  };
  assert.equal(validateAnswer(JSON.stringify(good), sources).blocks.length, 1);
  for (const patch of [
    { source_id: "S99" },
    { evidence_ids: ["S1.99"] },
    { text: "A Graduate visa is valid for 50 years." },
    { text: "See https://malicious.example for private payment" },
  ])
    assert.throws(() =>
      validateAnswer(
        { ...good, blocks: [{ ...good.blocks[0], ...patch }] },
        sources,
      ),
    );
  assert.equal(
    validateAnswer(
      {
        status: "clarify",
        message: "Which UK visa route are you asking about?",
        blocks: [],
      },
      sources,
    ).blocks.length,
    0,
  );
});
test("failed live sources never fall back to model memory and question consent is required", async () => {
  const env = database();
  let calls = 0;
  env.AI = {
    run() {
      calls++;
      throw Error("Must not run");
    },
  };
  assert.equal(
    (
      await chatAPI(
        req("/api/chat", {
          question: "Can I extend my Graduate visa?",
          consent: false,
        }),
        env,
      )
    ).status,
    400,
  );
  const result = await retrieveSources("Can I extend my Graduate visa?", {
    fetcher: async () => new Response("Unavailable", { status: 503 }),
  });
  assert.equal(result.sources.length, 0);
  assert.equal(result.partial, true);
  assert.equal(calls, 0);
});

import {
  sourceWarnings,
  contactFromText,
  draftWarnings,
} from "../worker/career-quality.js";
import { buildEvidenceReview } from "../worker/career-evidence.js";
test("CV checks flag placeholders and planned work; imported contacts come only from source text", () => {
  const cv =
    "TEST CANDIDATE\nCardiff | test@example.com | 07700 900123\nPROJECTS\nBuilt React tools. Planned architecture concepts remain ideas.\nEXPERIENCE\nNight receptionist [Month Year] – Present.\nEDUCATION\nMSc Digital Media Management 2021–2022.";
  assert.equal(sourceWarnings(cv).length, 2);
  assert.equal(contactFromText(cv).name, "TEST CANDIDATE");
  assert.equal(contactFromText(cv).email, "test@example.com");
  assert.equal(
    contactFromText("CURRICULUM VITAE\nName unknown").name,
    undefined,
  );
  assert.ok(
    draftWarnings(
      "PROFILE\nAn MSc graduate in 2027. Experience at the hotel.",
      cv,
    ).some((x) => x.includes("2027")),
  );
  const review = buildEvidenceReview(
    { cv },
    {
      description:
        "The old spreadsheet was built in 2011. You have designed interfaces for real people. You can design for density. React is essential. Applicants must be graduating in 2027.",
    },
  );
  assert.match(review, /You have designed interfaces/);
  assert.match(review, /You can design for density/);
  assert.match(review, /graduating in 2027/);
  assert.doesNotMatch(review, /spreadsheet was built in 2011/);
  assert.match(review, /unfinished date/);
});

test("generated drafts remove unresolved date placeholders while preserving real years", async () => {
  const { cleanDraft, sourceWarnings } = await import(
    "../worker/career-quality.js"
  );
  assert.equal(
    cleanDraft("Night receptionist\n[Month Year] – Present\nMSc [2021 – 2022]"),
    "Night receptionist\nPresent\nMSc [2021 – 2022]",
  );
  assert.ok(
    sourceWarnings("Architecture planning exercises ahead of building").some(
      (s) => s.includes("planned"),
    ),
  );
});

test("CV factual review rejects unknown source passages, numbers and availability", async () => {
  const { validateReview } = await import("../worker/career-review.js");
  const source =
    "Built a community platform with live mapping via Google Maps. Created internal tools for an 83-room hotel. Completed a degree in Digital Media Management.";
  const checks = [
    {
      claim: "Built a community platform",
      source_ids: ["C1"],
    },
    {
      claim: "Created internal tools",
      source_ids: ["C1"],
    },
    {
      claim: "Digital Media Management",
      source_ids: ["C1"],
    },
  ];
  const profile = { cv: source };
  const payload = (text, cs = checks) => JSON.stringify({ text, checks: cs });
  assert.equal(validateReview(payload(source), profile, "cv"), source);
  assert.equal(validateReview({ text: source, checks }, profile, "cv"), source);
  assert.throws(() =>
    validateReview(
      payload(source + " Improved results by 50 percent."),
      profile,
      "cv",
    ),
  );
  assert.throws(() =>
    validateReview(
      payload(source + " I am available to interview immediately."),
      profile,
      "cv",
    ),
  );
  assert.throws(() =>
    validateReview(
      payload(source, [
        ...checks.slice(0, 2),
        {
          claim: "Digital Media Management",
          source_ids: ["C999"],
        },
      ]),
      profile,
      "cv",
    ),
  );
});
