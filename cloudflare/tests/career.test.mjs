import test from "node:test";
import assert from "node:assert/strict";
import {
  sponsorshipEvidence,
  isUK,
  careerLevel,
  canonicalJobURL,
  plainText,
} from "../worker/jobs.js";
import { validateWorkspace } from "../worker/career-validation.js";

test("sponsorship labels require immigration evidence and handle negation", () => {
  for (const s of [
    "We sponsor community events.",
    "We provide sponsorship for a local football club.",
    "We do not discriminate against candidates needing visa sponsorship.",
    "Do you need visa sponsorship?",
  ])
    assert.equal(sponsorshipEvidence(s).status, "not_stated", s);
  assert.equal(
    sponsorshipEvidence("We offer visa sponsorship for this role.").status,
    "offered",
  );
  assert.equal(
    sponsorshipEvidence("We can sponsor visas for eligible candidates.").status,
    "conditional",
  );
  for (const s of [
    "We cannot provide visa sponsorship.",
    "No visa sponsorship is available.",
    "Visa sponsorship is not available.",
    "You have the right to work in the UK without restrictions for the full 12-week internship and would not require visa sponsorship if offered a permanent position.",
  ])
    assert.equal(sponsorshipEvidence(s).status, "unavailable");
  assert.equal(
    sponsorshipEvidence(
      "We offer visa sponsorship in our other offices.\nWe are unable to provide visa sponsorship for this role.",
    ).status,
    "unavailable",
  );
});
test("direct sponsorship arrangements preserve conditions and reject questions or refusals", () => {
  const original = "We will arrange a UK visa sponsorship and help with relocation to London.";
  assert.deepEqual(sponsorshipEvidence(original), {status: "offered", quote: original});
  for (const text of [
    "We can arrange UK visa sponsorship for eligible applicants.",
    "We may arrange your visa sponsorship subject to eligibility.",
    "We will arrange a UK visa sponsorship if the role meets the requirements.",
  ]) assert.equal(sponsorshipEvidence(text).status, "conditional", text);
  for (const text of [
    "We will arrange a UK visa sponsorship?",
    "Ask whether we will arrange a UK visa sponsorship.",
    "Candidates hope we will arrange a UK visa sponsorship.",
    "We will arrange a US visa sponsorship.",
    "We will arrange an introduction to an immigration adviser about visa sponsorship.",
  ]) assert.equal(sponsorshipEvidence(text).status, "not_stated", text);
  for (const text of [
    "We cannot arrange a UK visa sponsorship.",
    "We will not arrange a UK visa sponsorship.",
    original + "\nWe are unable to provide visa sponsorship for this role.",
  ]) assert.equal(sponsorshipEvidence(text).status, "unavailable", text);
});

test("employer refusals tied to the vacancy do not require the word visa", () => {
  for (const text of [
    "We are currently not offering sponsorship for this role.",
    "Due to limits on sponsorship allocations, we are not currently in a position to offer sponsorship to new candidates for these roles, this remains under review.",
    "Due to limits on sponsorship allocations, we are not currently in a position to offer sponsorship to new candidates for this role; this remains under review.",
    "We are unable to offer sponsorship for this role.",
  ]) {
    assert.deepEqual(sponsorshipEvidence(text), {status: "unavailable", quote: text});
    assert.equal(sponsorshipEvidence("We offer visa sponsorship in our other offices.\n" + text).status, "unavailable");
  }
  for (const text of [
    "Sponsorship of professional qualifications through our Individual Professional Development (IPD) panel",
    "We are unable to offer sponsorship of professional qualifications for this role.",
    "We are unable to offer sponsorship for this event.",
    "We are unable to offer sponsorship for this role?",
    "Ask whether we are unable to offer sponsorship for this role.",
    "Do you require sponsorship for this role?",
    "We are not offering sponsorship for the local football club.",
  ]) assert.equal(sponsorshipEvidence(text).status, "not_stated", text);
});

test("UK filter rejects similarly named overseas locations and unspecified remote roles", () => {
  assert.equal(isUK("Cardiff, London or Remote (UK)"), true);
  assert.equal(isUK("London, Ontario, Canada"), false);
  assert.equal(isUK("Cambridge, MA, USA"), false);
  assert.equal(isUK("Remote"), false);
  assert.equal(isUK("Dublin, Ireland"), false);
  assert.equal(careerLevel("Graduate Software Engineer"), "early_career");
  assert.equal(careerLevel("Senior Engineer"), "experienced");
});
test("job URL normalisation keeps functional job identifiers and rejects unsafe schemes", () => {
  assert.equal(
    canonicalJobURL("https://example.com/jobs?gh_jid=7&utm_source=email#apply"),
    "https://example.com/jobs?gh_jid=7",
  );
  assert.equal(canonicalJobURL("javascript:alert(1)"), "");
  assert.equal(canonicalJobURL("https://127.0.0.1/"), "");
  assert.equal(canonicalJobURL("https://a:b@example.com/"), "");
});
test("advert text strips markup and script content", () => {
  assert.equal(
    plainText("<p>Hello &amp; welcome</p><script>alert(1)</script>"),
    "Hello & welcome",
  );
});
test("workspace validation rejects duplicate IDs, caps private text and strips extra fields", () => {
  assert.throws(() => validateWorkspace({ version: 1, applications: [] }));
  assert.throws(() =>
    validateWorkspace({ version: 2, applications: [{ id: "x" }, { id: "x" }] }),
  );
  assert.throws(() =>
    validateWorkspace({
      version: 2,
      applications: Array.from({ length: 101 }, (_, i) => ({ id: String(i) })),
    }),
  );
  const d = validateWorkspace({
    version: 2,
    user_id: "other-user",
    profile: { cv: "x".repeat(35000) },
    applications: [
      { id: "x", url: "javascript:alert(1)", stage: "Hired", user_id: "other" },
    ],
  });
  assert.equal(d.profile.cv.length, 30000);
  assert.equal(d.applications[0].url, "");
  assert.equal(d.applications[0].stage, "Saved");
  assert.equal(d.user_id, undefined);
  assert.equal(d.applications[0].user_id, undefined);
});

import { buildEvidenceReview } from "../worker/career-evidence.js";
test("evidence check keeps advert eligibility separate from candidate facts", () => {
  const text = buildEvidenceReview(
    { cv: "BSc Data Science, 2023–2026. Skills: Python, SQL." },
    {
      description:
        "You are graduating in 2028. Python and SQL required. You must have the right to work in the UK.",
      evidence: "We cannot provide visa sponsorship.",
    },
  );
  assert.match(text, /Years appearing in your CV: 2023, 2026/);
  assert.match(text, /graduating in 2028/);
  assert.match(text, /NOT YET VERIFIED/);
  assert.match(text, /Your CV: “Skills: Python, SQL.”/);
  assert.doesNotMatch(text, /Confirms eligibility|Matches the requirement/);
});
