import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { feedbackAPI, feedbackContext } from "../worker/feedback.js";

function fixture() {
  const sql = new DatabaseSync(":memory:");
  for (const migration of ["0001_initial.sql", "0005_feedback_context.sql"])
    sql.exec(
      readFileSync(
        new URL("../migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
  return {
    sql,
    env: {
      APP_VERSION: "test-release",
      DB: {
        prepare(query) {
          let values = [];
          return {
            bind(...args) {
              values = args;
              return this;
            },
            async first() {
              return sql.prepare(query).get(...values) || null;
            },
            async run() {
              sql.prepare(query).run(...values);
              return { success: true };
            },
          };
        },
      },
    },
  };
}
function request(body = {}, headers = {}, method = "POST") {
  return new Request("https://sponsorintel.london/api/feedback", {
    method,
    headers: {
      Origin: "https://sponsorintel.london",
      "Content-Type": "application/json",
      ...headers,
    },
    ...(method === "POST"
      ? {
          body:
            typeof body === "string"
              ? body
              : JSON.stringify({
                  kind: "bug",
                  message: "LOCAL QA: the button did not work.",
                  ...body,
                }),
        }
      : {}),
  });
}
test("all feedback categories persist privately with a real receipt and server version", async () => {
  const { sql, env } = fixture();
  try {
    for (const kind of ["feedback", "bug", "data"]) {
      const r = await feedbackAPI(
        request({
          kind,
          context: {
            page: "/jobs?q=private-search",
            item: { type: "job", id: "public-job-1", label: "Public role" },
            cv: "must not persist",
            email: "private@example.test",
          },
        }),
        env,
      );
      assert.equal(r.status, 201);
      assert.equal(r.headers.get("cache-control"), "no-store");
      const receipt = await r.json();
      assert.equal(receipt.ok, true);
      const row = sql
        .prepare("SELECT * FROM feedback WHERE id=?")
        .get(receipt.id);
      assert.equal(row.kind, kind);
      assert.equal(row.app_version, "test-release");
      assert.deepEqual(JSON.parse(row.context), {
        page: "/jobs",
        item: { type: "job", id: "public-job-1", label: "Public role" },
      });
      assert.ok(Date.parse(row.created_at));
    }
    for (const method of ["GET", "HEAD", "DELETE"]) {
      const r = await feedbackAPI(request({}, {}, method), env);
      assert.equal(r.status, 405);
      assert.equal(r.headers.get("allow"), "POST");
      assert.doesNotMatch(await r.text(), /LOCAL QA/);
    }
  } finally {
    sql.close();
  }
});
test("origin, content, body and category validation reject unwanted writes", async () => {
  const { sql, env } = fixture();
  try {
    assert.equal(
      (await feedbackAPI(request({}, { Origin: "https://evil.example" }), env))
        .status,
      403,
    );
    assert.equal(
      (await feedbackAPI(request({}, { Origin: "" }), env)).status,
      403,
    );
    assert.equal(
      (await feedbackAPI(request({}, { "Content-Type": "text/plain" }), env))
        .status,
      415,
    );
    for (const body of [
      "[]",
      "null",
      "{",
      { kind: "invented" },
      { message: "x" },
      { message: " ".repeat(20) },
      { message: "x".repeat(2001) },
      { extra: "x".repeat(12001) },
    ])
      assert.equal((await feedbackAPI(request(body), env)).status, 400);
    assert.equal(
      (await feedbackAPI(request({ website: "bot-fill" }), env)).status,
      200,
    );
    assert.equal(sql.prepare("SELECT count(*) n FROM feedback").get().n, 0);
    assert.equal(sql.prepare("SELECT count(*) n FROM rate_limits").get().n, 0);
  } finally {
    sql.close();
  }
});
test("five-report limit prevents extra writes without retaining raw IPs", async () => {
  const { sql, env } = fixture();
  try {
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await feedbackAPI(
            request({}, { "CF-Connecting-IP": "192.0.2.1" }),
            env,
          )
        ).status,
        201,
      );
    const limited = await feedbackAPI(
      request({}, { "CF-Connecting-IP": "192.0.2.1" }),
      env,
    );
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "3600");
    assert.equal(sql.prepare("SELECT count(*) n FROM feedback").get().n, 5);
    assert.doesNotMatch(
      JSON.stringify(sql.prepare("SELECT * FROM rate_limits").all()),
      /192\.0\.2\.1/,
    );
    assert.equal(
      (await feedbackAPI(request({}, { "CF-Connecting-IP": "192.0.2.2" }), env))
        .status,
      201,
    );
  } finally {
    sql.close();
  }
});
test("context opt-out, unknown paths and unrecognised fields remain private", async () => {
  assert.deepEqual(feedbackContext(null), {});
  assert.deepEqual(
    feedbackContext({
      page: "/users/private@example.test",
      item: { type: "cv", id: "private", label: "private" },
      screenshot: "data",
      search: "private",
    }),
    {},
  );
  assert.deepEqual(
    feedbackContext({
      page: "/applications?name=private#secret",
      item: { type: "job", id: "bad/id", label: "role" },
    }),
    { page: "/applications" },
  );
  const { sql, env } = fixture();
  try {
    const r = await feedbackAPI(request({ context: null }), env);
    assert.equal(r.status, 201);
    assert.equal(
      sql.prepare("SELECT context FROM feedback").get().context,
      "{}",
    );
  } finally {
    sql.close();
  }
});
test("failed storage never issues a false success receipt", async () => {
  const { sql, env } = fixture();
  try {
    sql.exec("DROP TABLE feedback");
    await assert.rejects(feedbackAPI(request(), env), /no such table/);
  } finally {
    sql.close();
  }
});
