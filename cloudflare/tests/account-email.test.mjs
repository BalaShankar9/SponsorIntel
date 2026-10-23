import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { SignJWT } from "jose";
import { authAPI, sessionFor } from "../worker/auth.js";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sql.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  const DB = {
    exec(query) {
      return sql.exec(query);
    },
    prepare(query) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async all() {
          const results = sql.prepare(query).all(...args);
          const meta = sql
            .prepare("SELECT changes() changes,last_insert_rowid() last_row_id")
            .get();
          return { results, success: true, meta };
        },
        async first() {
          return sql.prepare(query).get(...args) || null;
        },
        async run() {
          return this.all();
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((s) => s.all()));
    },
  };
  const mail = [];
  const env = {
    DB,
    AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
    APP_ORIGIN: "https://sponsorintel.london",
    EMAIL_VERIFICATION_ENABLED: "true",
    EMAIL: {
      async send(message) {
        mail.push(message);
        return { messageId: crypto.randomUUID() };
      },
    },
  };
  async function call(path, body, options = {}) {
    const req = new Request(env.APP_ORIGIN + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: options.origin || env.APP_ORIGIN,
        "Content-Type": "application/json",
        "CF-Connecting-IP": options.ip || "198.51.100.8",
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return authAPI(req, env);
  }
  const mailURL = () =>
    new URL(
      mail.at(-1).text.match(/https:\/\/sponsorintel\.london\/[^\s]+/)[0],
    );
  return { sql, env, mail, call, mailURL };
}

test("real authentication requires email verification, rejects expired or altered links and never follows an external callback", async () => {
  const f = fixture();
  const account = {
    name: "Fictional Test",
    email: "fictional@example.com",
    password: crypto.randomUUID(),
  };
  try {
    let r = await f.call("/api/auth/sign-up/email", {
      ...account,
      callbackURL: "/account",
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).token, null);
    assert.equal(f.mail.length, 1);
    r = await f.call("/api/auth/sign-in/email", account);
    assert.equal(r.status, 403);
    const url = f.mailURL();
    const altered = new URL(url);
    altered.searchParams.set("token", url.searchParams.get("token") + "x");
    r = await f.call(altered.pathname + altered.search);
    assert.ok(r.status >= 300);
    assert.match(
      r.headers.get("location") || (await r.text()),
      /INVALID_TOKEN/,
    );
    const expired = await new SignJWT({ email: account.email })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(f.env.AUTH_SECRET));
    r = await f.call(
      "/api/auth/verify-email?token=" + expired + "&callbackURL=%2Faccount",
    );
    assert.match(
      r.headers.get("location") || (await r.text()),
      /TOKEN_EXPIRED/,
    );
    assert.equal(
      f.sql.prepare("SELECT emailVerified FROM user").get().emailVerified,
      0,
    );
    const external = new URL(url);
    external.searchParams.set("callbackURL", "https://untrusted.example");
    r = await f.call(external.pathname + external.search);
    assert.equal(r.status, 403);
    r = await f.call(url.pathname + url.search);
    assert.equal(r.status, 302);
    assert.match(r.headers.get("location"), /\/account$/);
    assert.equal(r.headers.get("referrer-policy"), "no-referrer");
    assert.equal(
      f.sql.prepare("SELECT emailVerified FROM user").get().emailVerified,
      1,
    );
    r = await f.call("/api/auth/sign-in/email", account);
    assert.equal(r.status, 200);
    assert.ok(
      r.headers.getSetCookie().some((c) => c.includes("session_token")),
    );
  } finally {
    f.sql.close();
  }
});

test("password recovery expires, is single-use, revokes old sessions and keeps account existence private", async () => {
  const f = fixture();
  const account = {
    name: "Fictional Test",
    email: "fictional@example.com",
    password: crypto.randomUUID(),
  };
  try {
    await f.call("/api/auth/sign-up/email", account);
    const verify = f.mailURL();
    await f.call(verify.pathname + verify.search);
    let r = await f.call("/api/auth/sign-in/email", account);
    const cookie = r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    assert.ok(cookie);
    const existing = await f.call("/api/auth/request-password-reset", {
      email: account.email,
      redirectTo: "/reset-password",
    });
    const reset = f.mailURL();
    assert.equal(reset.pathname, "/reset-password");
    const resetToken = reset.searchParams.get("token");
    const missing = await f.call("/api/auth/request-password-reset", {
      email: "absent@example.com",
      redirectTo: "/reset-password",
    });
    assert.equal(existing.status, missing.status);
    assert.deepEqual(await existing.json(), await missing.json());
    assert.equal(f.mail.length, 2);
    const newPassword = crypto.randomUUID();
    r = await f.call("/api/auth/reset-password", {
      token: resetToken,
      newPassword,
    });
    assert.equal(r.status, 200);
    assert.equal(
      await sessionFor(
        new Request(f.env.APP_ORIGIN + "/api/auth/get-session", {
          headers: { cookie },
        }),
        f.env,
      ),
      null,
    );
    r = await f.call("/api/auth/reset-password", {
      token: resetToken,
      newPassword,
    });
    assert.equal(r.status, 400);
    r = await f.call("/api/auth/sign-in/email", account);
    assert.equal(r.status, 401);
    r = await f.call("/api/auth/sign-in/email", {
      ...account,
      password: newPassword,
    });
    assert.equal(r.status, 200);
    await f.call("/api/auth/request-password-reset", { email: account.email });
    const expired = f.mailURL().searchParams.get("token");
    f.sql
      .prepare("UPDATE verification SET expiresAt=?")
      .run(Date.now() - 60000);
    r = await f.call("/api/auth/reset-password", {
      token: expired,
      newPassword: crypto.randomUUID(),
    });
    assert.equal(r.status, 400);
  } finally {
    f.sql.close();
  }
});

test("mail endpoints reject cross-origin requests, unsafe redirects and excessive email attempts including signup", async () => {
  const f = fixture();
  try {
    let r = await f.call(
      "/api/auth/request-password-reset",
      { email: "absent@example.com" },
      { origin: "https://untrusted.example" },
    );
    assert.equal(r.status, 403);
    r = await f.call("/api/auth/sign-up/email", {
      email: "absent@example.com",
      callbackURL: "https://untrusted.example",
    });
    assert.equal(r.status, 400);
    for (let i = 0; i < 4; i++)
      await f.call("/api/auth/request-password-reset", {
        email: "absent@example.com",
      });
    r = await f.call("/api/auth/sign-up/email", {
      email: "absent@example.com",
      name: "Fictional Test",
      password: crypto.randomUUID(),
    });
    assert.equal(r.status, 429);
    assert.equal(f.mail.length, 0);
  } finally {
    f.sql.close();
  }
});
