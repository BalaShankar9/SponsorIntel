import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseBoardJobs,
  careerLevel,
  isUK,
  salaryExcerpt,
} from "../worker/jobs.js";
import {
  extractContent,
  contentHash,
  summaryState,
  versionKind,
  WATCHED_SOURCES,
  isWithdrawn,
} from "../worker/immigration-content.js";
import { refreshImmigration, immigrationAPI } from "../worker/immigration.js";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

test("Lever requirements and final sections override a generic sponsorship introduction", async () => {
  const jobs = await normaliseBoardJobs(
    [
      {
        id: "1",
        text: "Graduate Analyst",
        country: "GB",
        categories: { location: "Slough (GB)", commitment: "Full-time" },
        hostedUrl: "https://jobs.lever.co/test/1",
        descriptionPlain: "We offer visa sponsorship for some teams.",
        lists: [
          {
            text: "Requirements",
            content:
              "<li>We cannot provide visa sponsorship for this role.</li><li>The salary is £35,000 per year.</li>",
          },
        ],
        additionalPlain: "Applications close on Friday.",
        workplaceType: "hybrid",
      },
    ],
    { id: "test", company: "Test", provider: "lever" },
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sponsorship, "unavailable");
  assert.match(jobs[0].description, /Applications close/);
  assert.match(jobs[0].salary_excerpt, /£35,000/);
  assert.equal(jobs[0].employment_type, "Full-time");
});

test("board ingestion excludes talent pools, overseas roles, duplicates and overlong incomplete adverts", async () => {
  const base = {
    id: "1",
    title: "Trainee Analyst",
    location: "London",
    descriptionPlain: "A useful full job description.",
    jobUrl: "https://jobs.ashbyhq.com/test/1",
  };
  const raw = [
    base,
    { ...base, id: "2", jobUrl: base.jobUrl + "?utm_source=test" },
    {
      ...base,
      id: "3",
      title: "Speculative interest",
      jobUrl: base.jobUrl + "x",
    },
    {
      ...base,
      id: "4",
      address: { postalAddress: { addressCountry: "Canada" } },
    },
    { ...base, id: "5", descriptionPlain: "x".repeat(80001) },
  ];
  const jobs = await normaliseBoardJobs(raw, {
    id: "test",
    company: "Test",
    provider: "ashby",
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].level, "early_career");
  assert.equal(careerLevel("Internal Audit Manager"), "experienced");
  assert.equal(isUK("Nationwide (GB)"), true);
  assert.equal(isUK("London", "US"), false);
  assert.equal(
    salaryExcerpt("We helped with £25 million of loan repayments."),
    "",
  );
  assert.equal(
    salaryExcerpt("The salary is &pound;35,000 per annum."),
    "The salary is £35,000 per annum.",
  );
});

test("official guide extraction selects the requested chapter and detects changes without a new timestamp", async () => {
  const source = WATCHED_SOURCES.find((s) => s.id === "skilled-job");
  const data = {
    base_path: "/skilled-worker-visa",
    title: "Skilled Worker visa",
    public_updated_at: "2024-01-01",
    details: {
      parts: [
        {
          slug: "overview",
          title: "Overview",
          body: "Wrong section that should not be selected.",
        },
        {
          slug: "your-job",
          title: "Your job",
          body: "<p>The salary and occupation must meet the listed requirements.</p>",
        },
      ],
    },
  };
  const first = extractContent(data, source);
  assert.doesNotMatch(first.body, /Wrong section/);
  const second = extractContent(
    {
      ...data,
      details: {
        parts: [
          {
            slug: "your-job",
            title: "Your job",
            body: "<p>A new salary rule applies with listed exceptions.</p>",
          },
        ],
      },
    },
    source,
  );
  assert.notEqual(await contentHash(first), await contentHash(second));
  assert.throws(() =>
    extractContent({ ...data, details: { parts: [] } }, source),
  );
  assert.throws(() => extractContent({ ...data, base_path: "/wrong" }, source));
});

test("explanations fail closed on changed, stale, failed and withdrawn sources", () => {
  assert.equal(isWithdrawn({ withdrawn_notice: {} }), false);
  assert.equal(
    isWithdrawn({
      withdrawn_notice: {
        explanation: "Replaced by new guidance",
        withdrawn_at: "2026-10-01",
      },
    }),
    true,
  );
  const now = Date.now(),
    source = {
      kind: "guidance",
      content_hash: "old",
      content: "The current official guide gives the conditions in full.",
      last_success: new Date(now).toISOString(),
    },
    summary = { content_hash: "old", title: "Explanation",points:["Read the current official guide and its full conditions."],evidence:[["The current official guide gives the conditions in full."]] };
  assert.equal(summaryState(source, summary, now).summary, summary);
  assert.equal(
    summaryState({ ...source, content_hash: "new" }, summary, now).status,
    "source_changed",
  );
  for (const changed of [
    { error: "failed" },
    { last_success: new Date(now - 3600001).toISOString() },
    { withdrawn: 1 },
    { last_success: "invalid" },
    { last_success: new Date(now + 300001).toISOString() },
  ])
    assert.equal(
      summaryState({ ...source, ...changed }, summary, now).summary,
      null,
    );
  assert.equal(versionKind(null, "hash"), "baseline");
  assert.equal(versionKind({ content_hash: "hash" }, "hash"), null);
  assert.equal(versionKind({ content_hash: "hash" }, "different"), "changed");
});

test("collection extraction tracks documents even with an empty body and rejects external destinations", () => {
  const source = WATCHED_SOURCES.find((s) => s.id === "rules");
  const data = {
    base_path: source.path,
    title: "Statements",
    details: { body: "" },
    links: {
      documents: [
        { base_path: "https://evil.example/steal", title: "Bad" },
        {
          base_path:
            "/government/publications/statement-of-changes-to-the-immigration-rules-hc-123-2026",
          title: "Official statement",
          public_updated_at: "2026-10-01",
        },
      ],
    },
  };
  const content = extractContent(data, source);
  assert.equal(content.discovered.length, 1);
  assert.match(content.body, /Official statement/);
  assert.doesNotMatch(content.body, /evil/);
});

function testDB() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../migrations/0002_career.sql", import.meta.url),
      "utf8",
    ),
  );
  sql.exec(
    readFileSync(
      new URL("../migrations/0004_quality_updates.sql", import.meta.url),
      "utf8",
    ),
  );
  const DB = {
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
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { DB, sql };
}

test("refresh persists an honest baseline, records real changes once, and retains history when GOV.UK fails", async (t) => {
  const { DB, sql } = testDB();
  let changed = false,
    fail = false;
  const statement =
    "/government/publications/statement-of-changes-to-the-immigration-rules-hc-123-2026";
  t.mock.method(globalThis, "fetch", async (input) => {
    const path = new URL(input).pathname.replace("/api/content", "");
    if (fail && path === "/graduate-visa")
      return new Response("Unavailable", { status: 503 });
    const item = {
      base_path: path,
      title: "Official " + path,
      public_updated_at: "2024-10-31T00:00:00Z",
      details: {},
    };
    if (path === statement)
      item.details = {
        body: "An official publication with commencement conditions and provisions.",
        attachments: [],
      };
    else if (path.includes("collections")) {
      item.details = { body: "" };
      item.links = {
        documents: [
          {
            base_path: statement,
            title: "Official statement",
            public_updated_at: "2026-10-01",
          },
        ],
      };
    } else
      item.details.parts = [...new Set(WATCHED_SOURCES.map(s=>s.part).filter(Boolean))].map((slug) => ({
        slug,
        title: slug,
        body:
          "Official guidance and its conditions for this route. " +
          (path === "/graduate-visa" && changed
            ? "A changed requirement."
            : "Original requirement."),
      }));
    return Response.json(item);
  });
  try {
    await refreshImmigration({ DB });
    assert.equal(
      sql
        .prepare(
          "SELECT count(*) n FROM immigration_versions WHERE kind='baseline'",
        )
        .get().n,
      WATCHED_SOURCES.length + 1,
    );
    assert.equal(
      (await (await immigrationAPI({ DB })).json()).events.length,
      0,
    );
    await refreshImmigration({ DB });
    assert.equal(
      sql.prepare("SELECT count(*) n FROM immigration_versions").get().n,
      WATCHED_SOURCES.length + 1,
    );
    changed = true;
    await refreshImmigration({ DB });
    assert.equal(
      sql
        .prepare(
          "SELECT count(*) n FROM immigration_versions WHERE kind='changed'",
        )
        .get().n,
      1,
    );
    const previous = sql
      .prepare(
        "SELECT content_hash,last_success FROM immigration_sources WHERE id='graduate'",
      )
      .get();
    fail = true;
    await refreshImmigration({ DB });
    const retained = sql
      .prepare(
        "SELECT content_hash,last_success,error FROM immigration_sources WHERE id='graduate'",
      )
      .get();
    assert.equal(retained.content_hash, previous.content_hash);
    assert.equal(retained.last_success, previous.last_success);
    assert.ok(retained.error);
    assert.equal(sql.prepare("SELECT count(*) n FROM feed_locks").get().n, 0);
    assert.equal(
      (await (await immigrationAPI({ DB })).json()).events.length,
      1,
    );
  } finally {
    sql.close();
  }
});
