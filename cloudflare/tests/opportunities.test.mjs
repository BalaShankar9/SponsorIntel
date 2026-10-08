import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  BOARDS,
  normaliseBoardJobs,
  ukLocations,
  storeBoardJobs,
  refreshJobs,
  jobsAPI,
  fetchBoard,
  sponsorshipEvidence,
  getJobDetail,
} from "../worker/jobs.js";
import { employerLicences, REVIEWED_EMPLOYER_LINKS } from "../worker/employer-licences.js";
import { validateWorkspace } from "../worker/career-validation.js";

function database() {
  const sql = new DatabaseSync(":memory:");
  for (const name of [
    "0001_initial.sql",
    "0002_career.sql",
    "0003_auth.sql",
    "0004_quality_updates.sql",
    "0006_owner_analytics.sql",
    "0019_job_deadlines.sql",
    "0028_job_publication_date.sql",
    "0031_paged_sources.sql",
  ])
    sql.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
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
        for (const statement of statements) results.push(await statement.run());
        sql.exec("COMMIT");
        return results;
      } catch (error) {
        sql.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sql, DB };
}
const board = BOARDS.find((b) => b.id === "zopa");
const rawJob = (id = "one", more = {}) => ({
  id,
  text: "Graduate Analyst",
  categories: { location: "London", commitment: "Full-time" },
  country: "GB",
  hostedUrl: `https://jobs.lever.co/zopa/${id}`,
  descriptionPlain:
    "The annual salary is £35,000. We offer visa sponsorship for this role.",
  ...more,
});

test("UK offices recover hybrid jobs without turning a US-only role into a UK role", async () => {
  const gh = {
    id: 1,
    internal_job_id: 22,
    title: "Engineer",
    location: { name: "Hybrid" },
    content: "A real role.",
    absolute_url: "https://job-boards.greenhouse.io/example/jobs/1",
    offices: [{ name: "London, United Kingdom" }],
  };
  const jobs = await normaliseBoardJobs([gh], {
    id: "example",
    company: "Example",
    provider: "greenhouse",
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, "London, United Kingdom");
  assert.equal(jobs[0].workplace, "Hybrid");
  assert.equal(
    ukLocations(
      { ...gh, offices: [{ name: "Austin, TX, United States" }] },
      "greenhouse",
    ),
    "",
  );
  assert.equal(
    ukLocations(
      {
        ...gh,
        location: { name: "Sydney, Australia" },
        offices: [{ location: "Sydney, New South Wales, Australia" }],
      },
      "greenhouse",
    ),
    "",
  );
  assert.equal(
    ukLocations(
      {
        ...gh,
        location: { name: "Riga, Latvia" },
        offices: [{ name: "London" }, { name: "Riga" }],
      },
      "greenhouse",
    ),
    "",
  );
  assert.equal(
    ukLocations(
      {
        location: "London",
        address: { postalAddress: { addressCountry: "CA" } },
      },
      "ashby",
    ),
    "",
  );
  assert.equal(
    ukLocations(
      {
        location: "Toronto",
        address: { postalAddress: { addressCountry: "CA" } },
        secondaryLocations: [
          { location: "Cardiff", address: { addressCountry: "GB" } },
        ],
      },
      "ashby",
    ),
    "Cardiff",
  );
  assert.equal(
    ukLocations(
      {
        country: "US",
        categories: {
          location: "Boston",
          allLocations: ["Boston", "London, UK"],
        },
      },
      "lever",
    ),
    "London, UK",
  );
});

test("prospect posts, explicit past deadlines and templates are excluded while test engineers remain", async () => {
  const gh = {
    id: 1,
    internal_job_id: 2,
    title: "Test Engineer",
    location: { name: "London" },
    content: "A real role.",
    absolute_url: "https://job-boards.greenhouse.io/example/jobs/1",
  };
  const result = await normaliseBoardJobs(
    [
      gh,
      { ...gh, id: 2, internal_job_id: null },
      { ...gh, id: 3, title: "Job Template" },
      { ...gh, id: 4, application_deadline: "2020-01-01T00:00:00Z" },
    ],
    { id: "example", company: "Example", provider: "greenhouse" },
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Test Engineer");
  await assert.rejects(normaliseBoardJobs([null], board), /Invalid vacancy/);
});

test('explicit candidate work-authorisation exclusions do not require the word visa', () => {
  for (const text of [
    'Candidates must be legally authorized to work in the country of employment without employer sponsorship.',
    'Applicants must be authorised to work in the UK without employer sponsorship.',
  ]) {
    assert.deepEqual(sponsorshipEvidence(text), {status:'unavailable',quote:text});
    assert.equal(sponsorshipEvidence('Visa sponsorship is available.\n'+text).status,'unavailable');
  }
  for (const text of [
    'Candidates must comply with export laws without sponsorship for an export license.',
    'Candidates must be legally authorized to work in the country of employment.',
    'Work with commercial sponsors and employer sponsorship of conferences.',
    'We welcome applicants who need visa sponsorship.',
  ]) assert.equal(sponsorshipEvidence(text).status,'not_stated');
});

test("advert benefits are evidence but negation and questions never become positive sponsorship", () => {
  assert.equal(
    sponsorshipEvidence(
      "- Relocation support and visa sponsorship, handled properly",
    ).status,
    "offered",
  );
  assert.equal(
    sponsorshipEvidence(
      "We cannot provide relocation support and visa sponsorship.",
    ).status,
    "unavailable",
  );
  assert.equal(
    sponsorshipEvidence("Relocation support and visa sponsorship?").status,
    "not_stated",
  );
  assert.equal(
    sponsorshipEvidence("No relocation support and visa sponsorship.").status,
    "unavailable",
  );
  assert.equal(
    sponsorshipEvidence(
      "Visa sponsorship is available for selected roles, please see our FAQ page for details",
    ).status,
    "conditional",
  );
});

test("Lever salary sections are included and foreign currency is not mislabelled as GBP pay", async () => {
  const [j] = await normaliseBoardJobs(
    [
      rawJob("pay", {
        descriptionPlain: "A real role.",
        salaryDescriptionPlain:
          "The annual salary is £38,000. We cannot provide visa sponsorship.",
      }),
    ],
    board,
  );
  assert.match(j.salary_excerpt, /38,000/);
  assert.equal(j.sponsorship, "unavailable");
  const [usd] = await normaliseBoardJobs(
    [rawJob("usd", { descriptionPlain: "The annual salary is $38,000." })],
    board,
  );
  assert.equal(usd.salary_excerpt, "");
});

test("atomic board updates preserve first-seen, retire missing jobs even in the same millisecond, and roll back failed writes", async () => {
  const { sql, DB } = database();
  try {
    const old = "2026-01-01T00:00:00.000Z",
      now = new Date().toISOString();
    const jobs = await normaliseBoardJobs(
      [rawJob("one"), rawJob("two")],
      board,
    );
    await storeBoardJobs(DB, board, jobs, old);
    await storeBoardJobs(DB, board, [jobs[0]], now);
    assert.equal(
      sql.prepare("SELECT first_seen FROM jobs WHERE id=?").get(jobs[0].id)
        .first_seen,
      old,
    );
    assert.equal(
      sql.prepare("SELECT active FROM jobs WHERE id=?").get(jobs[1].id).active,
      0,
    );
    sql.exec(
      "CREATE TRIGGER fail_source BEFORE UPDATE ON job_sources BEGIN SELECT RAISE(FAIL,'simulated storage failure'); END;",
    );
    await assert.rejects(
      storeBoardJobs(DB, board, [{ ...jobs[0], title: "Changed" }], now),
      /simulated/,
    );
    assert.equal(
      sql.prepare("SELECT title FROM jobs WHERE id=?").get(jobs[0].id).title,
      "Graduate Analyst",
    );
    sql.exec("DROP TRIGGER fail_source");
    await storeBoardJobs(DB, board, [], now);
    assert.equal(
      sql.prepare("SELECT count(*) n FROM jobs WHERE active=1").get().n,
      0,
    );
    assert.equal(sql.prepare("SELECT count FROM job_sources").get().count, 0);
  } finally {
    sql.close();
  }
});

test("refresh lock prevents overlapping writers and failed feeds retain last successful rows", async () => {
  const { sql, DB } = database();
  try {
    const jobs = await normaliseBoardJobs([rawJob()], board);
    await storeBoardJobs(DB, board, jobs, "2026-01-01T00:00:00.000Z");
    sql
      .prepare("INSERT INTO feed_locks VALUES('jobs','other',?)")
      .run(Date.now() + 100000);
    let calls = 0;
    const held = await refreshJobs(
      { DB },
      {
        boards: [board],
        readBoard: async () => {
          calls++;
          return jobs;
        },
      },
    );
    assert.equal(calls, 0);
    assert.equal(held[0].skipped, true);
    sql.exec("DELETE FROM feed_locks");
    const failed = await refreshJobs(
      { DB },
      {
        boards: [board],
        readBoard: async () => {
          throw Error("upstream failed");
        },
      },
    );
    assert.equal(failed[0].error, true);
    assert.equal(sql.prepare("SELECT active FROM jobs").get().active, 1);
    assert.equal(
      sql.prepare("SELECT last_success FROM job_sources").get().last_success,
      "2026-01-01T00:00:00.000Z",
    );
    assert.equal(sql.prepare("SELECT count(*) n FROM feed_locks").get().n, 0);
    await refreshJobs({ DB }, { boards: [board], readBoard: async () => jobs });
    assert.equal(
      sql.prepare("SELECT error FROM job_sources").get().error,
      null,
    );
  } finally {
    sql.close();
  }
});

test("incomplete employer responses fail instead of retiring unseen jobs", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ jobs: [], meta: { total: 5 } }),
  );
  await assert.rejects(
    fetchBoard(BOARDS.find((b) => b.provider === "greenhouse")),
    /Incomplete/,
  );
});

test("opportunity counts, combined filters, literal searches and pagination use only current active jobs", async () => {
  const { sql, DB } = database();
  try {
    const jobs = await normaliseBoardJobs(
      [
        rawJob("a"),
        rawJob("b", {
          text: "Senior Engineer",
          descriptionPlain: "A real role without any sponsorship wording.",
        }),
        rawJob("c", {
          text: "Junior Analyst",
          descriptionPlain: "We cannot provide visa sponsorship.",
        }),
      ],
      board,
    );
    await storeBoardJobs(DB, board, jobs, new Date().toISOString());
    const api = async (q = "") =>
      (
        await jobsAPI(new URL("https://sponsorintel.london/api/jobs" + q), {
          DB,
        })
      ).json();
    const all = await api();
    assert.equal((await jobsAPI(new URL("https://sponsorintel.london/api/jobs"), { DB })).headers.get("cache-control"), "no-store");
    assert.deepEqual(all.collections, {
      total: 3,
      employers: 1,
      early_career: 2,
      sponsorship: 1,
      licensed: 0,
      salary: 1,
    });
    const filtered = await api(
      "?sponsorship=mentioned&level=early_career&salary=listed&sector=finance&page=99",
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.page, 1);
    assert.equal(filtered.items[0].sector_label, "Finance & fintech");
    assert.equal((await api("?sector=healthcare")).total, 0);
    assert.equal((await api("?q=%25")).total, 0);
    assert.equal(
      (await api("?q=" + encodeURIComponent("a".repeat(150)))).total,
      0,
    );
    sql
      .prepare("UPDATE jobs SET last_seen=? WHERE id=?")
      .run("2020-01-01T00:00:00.000Z", jobs[0].id);
    const stale = await api();
    assert.equal(stale.total, 2);
    assert.equal(stale.collections.sponsorship, 0);
  } finally {
    sql.close();
  }
});

test("saved searches keep licence, sector and pay filters and older backups remain valid", () => {
  const data = validateWorkspace({
    version: 2,
    applications: [],
    searches: [
      { id: "old", q: "Engineer" },
      { id: "new", salary: "listed", sector: "engineering", licence: "matched" },
      { id: "invalid", licence: "guaranteed" },
    ],
  });
  assert.equal(data.searches[0].salary, "");
  assert.equal(data.searches[1].salary, "listed");
  assert.equal(data.searches[1].sector, "engineering");
  assert.equal(data.searches[0].licence, "");
  assert.equal(data.searches[1].licence, "matched");
  assert.equal(data.searches[2].licence, "");
});

function seedLicence(sql, sponsorID, now, patch = {}) {
  const meta = { snapshot: "current", source_date: new Date(now).toISOString().slice(0, 10), checked_at: new Date(now).toISOString(), ...patch };
  sql.prepare("INSERT OR REPLACE INTO metadata VALUES('register',?)").run(JSON.stringify(meta));
  sql.prepare("INSERT OR REPLACE INTO sponsors VALUES(?,?,?,?,?,?,?,?)").run(sponsorID, "current", "LOCAL QA Legal Company", "London", "", '["Worker (A rating)"]', '["Skilled Worker"]', 1);
  return meta;
}

test("licensed-company search includes unknown and negative adverts without upgrading sponsorship, and never guesses a company match", async () => {
  const { sql, DB } = database();
  try {
    const jobs = await normaliseBoardJobs([
      rawJob("offered"),
      rawJob("unknown", { descriptionPlain: "A real role with no sponsorship statement." }),
      rawJob("negative", { descriptionPlain: "We cannot offer visa sponsorship." }),
    ], board);
    await storeBoardJobs(DB, board, jobs, new Date().toISOString());
    const unreviewed = { ...board, id: "unreviewed", company: "LOCAL QA Legal Company" };
    await storeBoardJobs(DB, unreviewed, await normaliseBoardJobs([rawJob("lookalike")], unreviewed), new Date().toISOString());
    const sponsorID = REVIEWED_EMPLOYER_LINKS.find((b) => b.id === board.id).sponsor_id;
    seedLicence(sql, sponsorID, Date.now());
    const api = async (query = "") => (await jobsAPI(new URL("https://sponsorintel.london/api/jobs" + query), { DB })).json();
    const all = await api();
    assert.equal(all.total, 4);
    assert.equal(all.collections.licensed, 3);
    const licensed = await api("?licence=matched");
    assert.equal(licensed.total, 3);
    assert.deepEqual(new Set(licensed.items.map((j) => j.sponsorship)), new Set(["offered", "unavailable", "not_stated"]));
    assert.ok(licensed.items.every((j) => j.employer_licence.id === sponsorID));
    assert.equal((await api("?licence=matched&sponsorship=mentioned")).total, 1);
    assert.equal((await api("?licence=matched&sponsorship=unavailable")).total, 1);
    assert.equal((await api("?licence=matched&sector=healthcare")).total, 0);
    const detail = await getJobDetail(jobs[0].id, { DB });
    assert.deepEqual(detail.employer_licence, licensed.items.find((j) => j.id === detail.id).employer_licence);
    // Publishing a new snapshot immediately removes links to a withdrawn record.
    sql.prepare("UPDATE metadata SET value=json_set(value,'$.snapshot','next') WHERE key='register'").run();
    assert.equal((await api("?licence=matched")).total, 0);
    assert.equal((await api()).total, 4);
    assert.equal((await getJobDetail(jobs[0].id, { DB })).employer_licence, null);
  } finally { sql.close(); }
});

test("licence links fail closed on stale, future, failed or malformed register checks and non-Skilled-Worker entries", async () => {
  const { sql, DB } = database(), now = Date.parse("2026-10-06T12:00:00Z");
  const sponsorID = REVIEWED_EMPLOYER_LINKS.find(b=>b.id==="monzo").sponsor_id;
  try {
    seedLicence(sql, sponsorID, now);
    assert.equal((await employerLicences(DB, [], now)).matches.size, 1);
    for (const patch of [
      { checked_at: new Date(now - 2 * 86400000).toISOString() },
      { checked_at: new Date(now + 300001).toISOString() },
      { checked_at: "invalid" },
      { source_date: "2026-09-29" },
      { source_date: "2026-10-07" },
      { refresh_error: "Refresh failed" },
    ]) {
      seedLicence(sql, sponsorID, now, patch);
      const value = await employerLicences(DB, [], now);
      assert.equal(value.matches.size, 0, JSON.stringify(patch));
      assert.equal(value.register.available, false);
    }
    sql.prepare("UPDATE metadata SET value='broken' WHERE key='register'").run();
    assert.equal((await employerLicences(DB, [], now)).matches.size, 0);
    seedLicence(sql, sponsorID, now);
    sql.prepare("UPDATE sponsors SET skilled=0").run();
    assert.equal((await employerLicences(DB, [], now)).matches.size, 0);
    sql.prepare("UPDATE sponsors SET skilled=1,routes='[\"Creative Worker\"]'").run();
    assert.equal((await employerLicences(DB, [], now)).matches.size, 0);
  } finally { sql.close(); }
});

test("owner-reviewed boards gain a licence link only after approval with a dated review and current record", async () => {
  const { sql, DB } = database(), now = Date.parse("2026-10-06T12:00:00Z");
  const approved = { id: "reviewed-lever-example", sponsor_id: "a".repeat(24), reviewed_at: new Date(now).toISOString(), state: "approved", evidence: "PRIVATE QA review notes" };
  try {
    seedLicence(sql, approved.sponsor_id, now);
    const linked = (await employerLicences(DB, [approved], now)).matches.get(approved.id);
    assert.ok(linked);
    assert.equal(linked.evidence_url, null);
    assert.ok(!JSON.stringify(linked).includes("PRIVATE QA"));
    for (const patch of [{ state: "pending" }, { state: "paused" }, { reviewed_at: null }, { sponsor_id: "b".repeat(24) }])
      assert.equal((await employerLicences(DB, [{ ...approved, ...patch }], now)).matches.size, 0);
  } finally { sql.close(); }
});

test("UK recruitment locations do not disguise a required overseas relocation", async () => {
  const jobs = await normaliseBoardJobs(
    [
      rawJob("overseas", { text: "C++ Developer - Relocate to Chicago" }),
      rawJob("uk", { text: "Engineer - Relocate to London" }),
      rawJob("ordinary", { text: "Relocation Support Adviser" }),
    ],
    board,
  );
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => !j.title.includes("Chicago")));
});
