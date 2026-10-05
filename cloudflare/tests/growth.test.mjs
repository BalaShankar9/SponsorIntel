import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { studyBudget, businessCharges } from "../shared/planning.js";
import {
  parseStudents,
  studyQuery,
  refreshStudents,
  studyAPI,
  STUDENT_HEADERS,
} from "../worker/study.js";
import { accountEmail, sendAccountEmail } from "../worker/account-email.js";
import { generationPrompt } from "../worker/career.js";
import { validateWorkspace } from "../worker/career-validation.js";
import { companyBrief } from "../worker/company-brief.js";
function database() {
  const sql = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    sql.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
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
    async batch(items) {
      sql.exec("BEGIN");
      try {
        const out = [];
        for (const s of items) out.push(await s.all());
        sql.exec("COMMIT");
        return out;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { sql, DB };
}
const csv = (rows) =>
  new Response(STUDENT_HEADERS.join(",") + "\n" + rows.join("\n"));
test("study budget keeps proof-of-funds separate, avoids double-counting paid tuition and caps scholarships", () => {
  const input = {
    tuition: 12500,
    scholarship: 0,
    months: 12,
    living: 1200,
    london: false,
    paid: 4000,
    visa: 558,
    ihs: 1164,
    extras: 1000,
  };
  const result = studyBudget(input);
  assert.equal(result.total, 29622);
  assert.equal(result.maintenance, 10539);
  assert.equal(result.proofOfFunds, 19039);
  assert.equal(studyBudget({ ...input, london: true }).maintenance, 13761);
  assert.equal(studyBudget({ ...input, months: 4.2 }).maintenance, 5855);
  assert.equal(
    studyBudget({ ...input, scholarship: 200000, paid: 999999 }).proofOfFunds,
    10539,
  );
  assert.ok(Number.isFinite(studyBudget({ ...input, tuition: NaN }).total));
});
test("employer fee illustration separates size, duration, exemptions and excludes operating capital", () => {
  assert.deepEqual(businessCharges(), {
    licence: 611,
    certificate: 525,
    skills: 1440,
    total: 2576,
  });
  assert.equal(businessCharges({ months: 13 }).skills, 720);
  assert.equal(businessCharges({ months: 60, large: true }).skills, 6600);
  assert.equal(businessCharges({ exempt: true }).total, 1136);
});
test("student CSV retains both routes and literal location text; rejects malformed or unfamiliar schemas", async () => {
  const row =
    "Example College,Cardiff,,Higher Education Institution (HEI),Student Sponsor,Student,";
  const result = await parseStudents(
    csv([row, row.replace(",Student,", ",Child Student,")]),
  );
  assert.equal(result.rows, 2);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0].routes, ["Child Student", "Student"]);
  await assert.rejects(() =>
    parseStudents(new Response("Wrong,Columns\nSome,Data")),
  );
  await assert.rejects(() =>
    parseStudents(csv([row.replace(",Student,", ",Unknown Route,")])),
  );
  const spec = studyQuery(new URLSearchParams({ q: "%_O'Reilly", page: "-1" }));
  assert.equal(spec.page, 1);
  assert.equal(spec.values[0], "%\\%\\_O'Reilly%");
  assert.equal(spec.values.at(-1), "Student");
});
test("student refresh publishes only a validated snapshot and preserves previous data on source failure", async () => {
  const env = database(),
    source =
      "https://assets.publishing.service.gov.uk/media/example/students-2026-10-05.csv";
  const rows = Array.from(
    { length: 501 },
    (_, i) =>
      `College ${i},Cardiff,,Higher Education Institution (HEI),Student Sponsor,Student,`,
  );
  const fetcher = async (url) =>
    url.includes("/api/content/")
      ? Response.json({
          base_path:
            "/government/publications/register-of-licensed-sponsors-students",
          details: { attachments: [{ url: source }] },
        })
      : csv(rows);
  const first = await refreshStudents(env, fetcher);
  assert.equal(first.total, 501);
  let data = await (
    await studyAPI(
      new URL("https://sponsorintel.london/api/study/sponsors?q=College+17"),
      env,
    )
  ).json();
  assert.equal(data.total, 11);
  assert.equal(data.items[0].city, "Cardiff");
  const failure = await refreshStudents(
    env,
    async () => new Response("failed", { status: 503 }),
  );
  assert.ok(failure.error);
  data = await (
    await studyAPI(
      new URL("https://sponsorintel.london/api/study/sponsors"),
      env,
    )
  ).json();
  assert.equal(data.meta.snapshot, first.snapshot);
  assert.equal(data.total, 501);
  assert.ok(data.meta.refresh_error);
  assert.equal(env.sql.prepare("SELECT count(*) n FROM feed_locks").get().n, 0);
  env.sql.close();
});
test("account mail validates destination and link origin, escapes markup and reports transport failure without false success", async () => {
  const input = {
    to: "qa@example.com",
    url: "https://sponsorintel.london/api/auth/verify-email?token=abc&callbackURL=%2Faccount",
    origin: "https://sponsorintel.london",
    kind: "verify",
  };
  const mail = accountEmail(input);
  assert.match(mail.html, /&amp;callbackURL/);
  assert.match(mail.text, /one hour/);
  assert.throws(() =>
    accountEmail({ ...input, url: "https://evil.example/reset-password" }),
  );
  assert.throws(() =>
    accountEmail({
      ...input,
      to: "qa@example.com\r\nBcc: stranger@example.com",
    }),
  );
  await assert.rejects(
    () =>
      sendAccountEmail(
        {
          EMAIL_VERIFICATION_ENABLED: "true",
          EMAIL: {
            async send() {
              throw Error("private upstream error");
            },
          },
        },
        input,
      ),
    /could not be sent/,
  );
});
test("portfolio and learning prompts retain plans as proposals; old backups gain bounded fields", () => {
  const profile = {
      cv: "Example candidate has studied JavaScript and built a small local weather prototype, with no claimed commercial deployment.",
    },
    application = {
      title: "Developer",
      company: "Example",
      description: "Requires React",
    };
  assert.match(
    generationPrompt("portfolio", profile, application).user,
    /PROPOSED/,
  );
  assert.match(
    generationPrompt("learningPlan", profile, application).user,
    /absence of a word is not proof/,
  );
  const w = validateWorkspace({
    version: 2,
    profile,
    applications: [{ id: "qa", learningPlan: "x".repeat(30000) }],
  });
  assert.equal(w.applications[0].learningPlan.length, 24000);
  assert.equal(w.applications[0].companyResearch, "");
  assert.equal(w.applications[0].portfolio, "");
});
test("company brief does not invent research for a manual or mismatched role", async () => {
  const result = await companyBrief(
    { jobId: "manual", company: "Example company" },
    {},
  );
  assert.match(result, /EVIDENCE NEEDED/);
  assert.match(result, /No external company facts/);
});

import { preserveCVContacts } from "../worker/career-quality.js";
test("CV contact header retains supplied details without generating missing details or repeating existing ones", () => {
  const result = preserveCVContacts("PROFILE\nAn example profile.", {
    name: "Fictional Candidate",
    email: "qa@example.com",
    phone: "",
  });
  assert.equal(
    result,
    "Fictional Candidate\nqa@example.com\n\nPROFILE\nAn example profile.",
  );
  assert.equal(
    preserveCVContacts(result, {
      name: "Fictional Candidate",
      email: "qa@example.com",
    }),
    result,
  );
  assert.equal(preserveCVContacts("PROFILE", {}), "PROFILE");
});
import { topicPaths } from "../worker/chat.js";
test("new route questions start with the relevant official guidance", () => {
  assert.ok(
    topicPaths(
      "Can my own business get a sponsor licence for self sponsorship?",
    ).includes("/uk-visa-sponsorship-employers"),
  );
  assert.deepEqual(topicPaths("India Young Professionals ballot"), [
    "/india-young-professionals-scheme-visa",
  ]);
  assert.deepEqual(topicPaths("Innovator Founder endorsement"), [
    "/innovator-founder-visa",
  ]);
});

import { validateReview } from "../worker/career-review.js";
test("factual checks accept punctuation and line-break formatting but reject added claim words", () => {
  const profile = {
    cv: "BSc Computer Science, 2023–2026, Example University. Built a local Python program. Wrote unit tests for title search.",
  };
  const text =
    "PROFILE\nCandidate with supplied academic experience.\nEDUCATION\nBSc Computer Science\n2023–2026, Example University\nPROJECTS\nBuilt a local Python program. Wrote unit tests for title search.";
  const checks = [
    "BSc Computer Science, 2023–2026, Example University",
    "Built a local Python program",
    "Wrote unit tests for title search",
  ].map((claim) => ({ claim, source_ids: ["C1"] }));
  assert.equal(validateReview({ text, checks }, profile, "cv"), text);
  assert.throws(
    () =>
      validateReview(
        {
          text,
          checks: [
            { claim: "Built a commercial Python program", source_ids: ["C1"] },
            ...checks.slice(1),
          ],
        },
        profile,
        "cv",
      ),
    /Unsupported evidence check/,
  );
});
