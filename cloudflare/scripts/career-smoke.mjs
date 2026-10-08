// Exercises real auth, D1 isolation, concurrency and recovery. Only fictional data.
// Usage: node scripts/career-smoke.mjs [base URL]. All created accounts are removed.
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:8788";
const accounts = [];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
async function call(
  path,
  { cookie = "", method = "GET", body, origin = base } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  return {
    r,
    d,
    cookie: r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; "),
  };
}
async function signup() {
  const email = "sponsorintel-qa-" + crypto.randomUUID() + "@example.invalid",
    password = crypto.randomUUID() + "Aa!7";
  const x = await call("/api/auth/sign-up/email", {
    method: "POST",
    body: { name: "Fictional Acceptance Test", email, password },
  });
  check(x.r.ok, "create account: " + JSON.stringify(x.d));
  const a = { email, password, cookie: x.cookie };
  accounts.push(a);
  return a;
}
try {
  const a = await signup(),
    b = await signup();
  check(a.cookie.includes("session_token"), "session cookie is present");
  const anon = await call("/api/career/workspace");
  check(anon.r.status === 401, "anonymous access denied");
  const workspace = {
    version: 2,
    profile: {
      name: "Fictional Candidate",
      cv: "Fictional CV used only for testing private workspace isolation.",
    },
    applications: [
      {
        id: "qa-application",
        title: "Fictional role",
        company: "Fictional company",
        notes: "Private candidate A notes",
      },
    ],
    searches: [],
  };
  let x = await call("/api/career/workspace", {
    method: "PUT",
    cookie: a.cookie,
    body: { data: workspace, revision: 0 },
  });
  check(x.r.ok && x.d.revision === 1, "save initial workspace");
  x = await call("/api/career/workspace", { cookie: b.cookie });
  check(x.d.data === null, "second account cannot see first account data");
  x = await call("/api/career/workspace?user_id=" + a.email, {
    cookie: b.cookie,
  });
  check(x.d.data === null, "query parameter cannot choose another user");
  x = await call("/api/career/workspace", {
    method: "PUT",
    cookie: a.cookie,
    origin: "https://untrusted.invalid",
    body: { data: workspace, revision: 1 },
  });
  check(x.r.status === 403, "cross-origin write denied");
  const concurrent = await Promise.all([
    call("/api/career/workspace", {
      method: "PUT",
      cookie: a.cookie,
      body: { data: workspace, revision: 1 },
    }),
    call("/api/career/workspace", {
      method: "PUT",
      cookie: a.cookie,
      body: { data: workspace, revision: 1 },
    }),
  ]);
  check(
    concurrent.filter((r) => r.r.ok).length === 1 &&
      concurrent.some((r) => r.r.status === 409),
    "concurrent write conflict protected",
  );
  x = await call("/api/career/workspace", { cookie: a.cookie });
  check(
    x.d.revision === 2 &&
      x.d.data.applications[0].notes === "Private candidate A notes",
    "round trip preserves content",
  );
  x = await call("/api/career/recovery-code", {
    method: "POST",
    cookie: a.cookie,
    body: {},
  });
  check(x.r.ok && x.d.code.length === 64, "recovery code created");
  const code = x.d.code;
  const newPassword = crypto.randomUUID() + "Bz!8";
  x = await call("/api/recover", {
    method: "POST",
    body: { code, password: newPassword },
  });
  check(x.r.ok, "recovery resets password");
  x = await call("/api/career/workspace", { cookie: a.cookie });
  check(x.r.status === 401, "recovery invalidates old session");
  x = await call("/api/recover", {
    method: "POST",
    body: { code, password: newPassword },
  });
  check(x.r.status === 400, "recovery code cannot be replayed");
  x = await call("/api/auth/sign-in/email", {
    method: "POST",
    body: { email: a.email, password: newPassword },
  });
  check(x.r.ok, "recovered account signs in");
  a.cookie = x.cookie;
  x = await call("/api/career/workspace", { cookie: a.cookie });
  check(
    x.d.data.profile.name === "Fictional Candidate",
    "recovery preserves private data",
  );
  const jobs = await call("/api/jobs");
  check(jobs.r.ok && jobs.d.total > 0, "live jobs available");
  const detail = await call("/api/jobs/" + jobs.d.items[0].id);
  check(
    detail.r.ok && detail.d.description.length > 80,
    "job detail and original source available",
  );
  x = await call("/api/career/generate", {
    method: "POST",
    body: { consent: false },
  });
  check(x.r.status === 400, "AI requires explicit consent");
  console.log(
    JSON.stringify({ ok: true, checks, base, jobs: jobs.d.catalog_total }),
  );
} finally {
  for (const a of accounts) {
    const d = await call("/api/career/account", {
      method: "DELETE",
      cookie: a.cookie,
    });
    if (!d.r.ok) throw Error("Test account cleanup failed");
    const checkDeleted = await call("/api/career/workspace", {
      cookie: a.cookie,
    });
    assert.equal(checkDeleted.r.status, 401);
  }
  console.log("Fictional test accounts and cloud workspaces removed.");
}
