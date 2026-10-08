import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { BOARDS, normaliseBoardJobs, storeBoardJobs } from "../worker/jobs.js";
import {
  dispatchSources,
  initialiseRun,
  executeSourceTask,
  completeRun,
  setSourcePause,
  operationsSnapshot,
  SourceBusy,
  SourceRetry,
} from "../worker/agent-operations.js";
import {
  operationFindings,
  validateBrief,
  generateOperationsBrief,
} from "../worker/agent-brief.js";
import { agentOperationsAPI } from "../worker/agent-api.js";
import { adminAPI } from "../worker/admin.js";

const board = BOARDS[0];
function database(t) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  for (const name of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    sql.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  const DB = {
    prepare(query) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        exec() {
          const s = sql.prepare(query);
          return s.columns().length
            ? { results: s.all(...args), success: true }
            : { ...s.run(...args), results: [], success: true };
        },
        async first() {
          return sql.prepare(query).get(...args) || null;
        },
        async all() {
          return { results: sql.prepare(query).all(...args) };
        },
        async run() {
          return this.exec();
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const r = statements.map((s) => s.exec());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return {
    sql,
    DB,
    SOURCE_WORKFLOW: {
      async create() {
        return { id: "test" };
      },
      async get() {
        return {
          async status() {
            return { status: "running" };
          },
        };
      },
    },
  };
}
async function run(env, id = "run-1") {
  await dispatchSources(env, { id, sourceId: board.id });
  await initialiseRun(env, id);
  return id;
}
async function records(count = 1) {
  return normaliseBoardJobs(
    Array.from({ length: count }, (_, i) => ({
      id: String(i),
      title: "Graduate analyst " + i,
      location: { name: "London" },
      content:
        "Research and analyse operational data in London. We cannot provide visa sponsorship for this role.",
      absolute_url: "https://boards.greenhouse.io/fictional/jobs/" + i,
    })),
    board,
  );
}
const query = (db, s) => db.sql.prepare(s).get();

test("publication and receipt are atomic; replay does not fetch or duplicate the source run", async (t) => {
  const env = database(t);
  await run(env);
  const jobs = await records();
  let calls = 0;
  const readBoard = async () => {
    calls++;
    return jobs;
  };
  assert.equal(
    (await executeSourceTask(env, "run-1", board.id, { readBoard })).state,
    "published",
  );
  assert.equal(
    (await executeSourceTask(env, "run-1", board.id, { readBoard })).replay,
    true,
  );
  assert.equal(calls, 1);
  assert.equal(query(env, "SELECT COUNT(*) n FROM source_runs").n, 1);
  assert.equal(
    query(env, "SELECT requests FROM agent_daily_budget").requests,
    1,
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM agent_write_guard").n, 0);
  assert.equal(
    query(env, "SELECT sponsorship FROM jobs").sponsorship,
    "unavailable",
  );
  assert.equal(
    JSON.parse(query(env, "SELECT evidence FROM agent_tasks").evidence)
      .licence_id,
    null,
  );
  assert.equal((await completeRun(env.DB, "run-1")).state, "completed");
});

test("receipt write failure rolls the entire publication back and a bounded retry can recover", async (t) => {
  const env = database(t);
  await run(env);
  const jobs = await records();
  env.sql.exec(
    "CREATE TRIGGER fail_receipt BEFORE UPDATE ON agent_tasks WHEN NEW.state='published' BEGIN SELECT RAISE(ABORT,'fictional storage failure'); END;",
  );
  await assert.rejects(
    executeSourceTask(env, "run-1", board.id, { readBoard: async () => jobs }),
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM jobs").n, 0);
  assert.equal(query(env, "SELECT COUNT(*) n FROM source_runs").n, 0);
  env.sql.exec("DROP TRIGGER fail_receipt");
  assert.equal(
    (
      await executeSourceTask(env, "run-1", board.id, {
        readBoard: async () => jobs,
      })
    ).state,
    "published",
  );
  assert.equal(query(env, "SELECT attempts FROM agent_tasks").attempts, 2);
});

test("sponsorship claims that disagree with the actual advert are held privately", async (t) => {
  const env = database(t);
  await run(env);
  const jobs = await records();
  jobs[0].sponsorship = "offered";
  assert.equal(
    (
      await executeSourceTask(env, "run-1", board.id, {
        readBoard: async () => jobs,
      })
    ).state,
    "needs_review",
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM jobs").n, 0);
  assert.equal(
    query(env, "SELECT kind FROM agent_reviews").kind,
    "evidence_mismatch",
  );
});

test("an unexpected empty feed preserves prior jobs and freshness; a valid later snapshot resolves the hold", async (t) => {
  const env = database(t),
    jobs = await records(20),
    old = new Date(Date.now() - 3600000).toISOString();
  await storeBoardJobs(env.DB, board, jobs, old);
  await run(env);
  assert.equal(
    (
      await executeSourceTask(env, "run-1", board.id, {
        readBoard: async () => [],
      })
    ).state,
    "needs_review",
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM jobs WHERE active=1").n, 20);
  assert.equal(
    query(env, "SELECT last_success FROM job_sources").last_success,
    old,
  );
  await completeRun(env.DB, "run-1");
  await run(env, "run-2");
  await executeSourceTask(env, "run-2", board.id, {
    readBoard: async () => jobs,
  });
  assert.equal(query(env, "SELECT state FROM agent_reviews").state, "resolved");
});

test("failed calls are counted, retries stop at three, and a failed source cools down", async (t) => {
  const env = database(t);
  await run(env);
  let calls = 0;
  const readBoard = async () => {
    calls++;
    throw Error("sensitive provider body");
  };
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      executeSourceTask(env, "run-1", board.id, { readBoard }),
      SourceRetry,
    );
  assert.equal(
    (await executeSourceTask(env, "run-1", board.id, { readBoard })).state,
    "failed",
  );
  await executeSourceTask(env, "run-1", board.id, { readBoard });
  assert.equal(calls, 3);
  assert.equal(
    query(env, "SELECT requests FROM agent_daily_budget").requests,
    3,
  );
  assert.ok(
    query(env, "SELECT cooldown_until FROM agent_source_controls")
      .cooldown_until > Date.now(),
  );
  assert.ok(
    !JSON.stringify(await operationsSnapshot(env)).includes(
      "sensitive provider body",
    ),
  );
  await completeRun(env.DB, "run-1");
  await run(env, "run-2");
  assert.equal(
    (await executeSourceTask(env, "run-2", board.id, { readBoard })).error_code,
    "source_cooldown",
  );
  assert.equal(calls, 3);
});

test("daily and per-run budgets stop fetching without automatic resets", async (t) => {
  const env = database(t);
  await run(env);
  let calls = 0;
  const readBoard = async () => {
    calls++;
    return [];
  };
  env.sql
    .prepare("INSERT INTO agent_daily_budget(day,requests) VALUES(?,500)")
    .run(new Date().toISOString().slice(0, 10));
  assert.equal(
    (await executeSourceTask(env, "run-1", board.id, { readBoard })).error_code,
    "request_budget",
  );
  assert.equal(calls, 0);
  assert.equal(
    query(env, "SELECT requests FROM agent_daily_budget").requests,
    500,
  );
  assert.throws(() =>
    env.sql.exec("UPDATE agent_daily_budget SET requests=501"),
  );
});

test("pause hides source jobs; resume does not resurrect them before a successful refresh", async (t) => {
  const env = database(t),
    jobs = await records();
  await storeBoardJobs(env.DB, board, jobs, new Date().toISOString());
  await setSourcePause(
    env.DB,
    board.id,
    true,
    "owner-id",
    "Investigating source data",
  );
  assert.equal(query(env, "SELECT active FROM jobs").active, 0);
  await run(env);
  assert.equal(
    (
      await executeSourceTask(env, "run-1", board.id, {
        readBoard: async () => {
          throw Error("must not fetch");
        },
      })
    ).error_code,
    "owner_paused",
  );
  await setSourcePause(
    env.DB,
    board.id,
    false,
    "owner-id",
    "Source reviewed and restored",
  );
  assert.equal(query(env, "SELECT active FROM jobs").active, 0);
  await completeRun(env.DB, "run-1");
  await run(env, "run-2");
  await executeSourceTask(env, "run-2", board.id, {
    readBoard: async () => jobs,
  });
  assert.equal(query(env, "SELECT active FROM jobs").active, 1);
  assert.equal(query(env, "SELECT COUNT(*) n FROM admin_audit").n, 2);
});

test("pause cannot race a held lease and a late fetch cannot overwrite after losing its lease", async (t) => {
  const env = database(t);
  await run(env);
  const jobs = await records();
  await assert.rejects(
    executeSourceTask(env, "run-1", board.id, {
      readBoard: async () => {
        await assert.rejects(
          setSourcePause(
            env.DB,
            board.id,
            true,
            "owner",
            "Stop this source safely",
          ),
          SourceBusy,
        );
        env.sql.exec("UPDATE feed_locks SET owner='newer-operation'");
        return jobs;
      },
    }),
    SourceBusy,
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM jobs").n, 0);
  assert.equal(
    query(env, "SELECT owner FROM feed_locks").owner,
    "newer-operation",
  );
});

test("expired runs do not fetch; malformed batches and duplicate IDs do not publish", async (t) => {
  const env = database(t);
  await run(env);
  env.sql.exec("UPDATE agent_runs SET created_at='2020-01-01T00:00:00.000Z'");
  assert.equal(
    (
      await executeSourceTask(env, "run-1", board.id, {
        readBoard: async () => {
          throw Error("must not fetch");
        },
      })
    ).error_code,
    "run_expired",
  );
  await completeRun(env.DB, "run-1");
  await run(env, "run-2");
  const jobs = await records();
  assert.equal(
    (
      await executeSourceTask(env, "run-2", board.id, {
        readBoard: async () => [...jobs, ...jobs],
      })
    ).state,
    "needs_review",
  );
});

test("uncertain dispatch checks the same instance and concurrent owner requests reuse the active run", async (t) => {
  const env = database(t);
  let creates = 0;
  env.SOURCE_WORKFLOW.create = async () => {
    creates++;
    throw Error("uncertain transport");
  };
  const first = await dispatchSources(env, { id: "same-id" });
  assert.equal(first.id, "same-id");
  const second = await dispatchSources(env, { id: "different-id" });
  assert.equal(second.id, "same-id");
  assert.equal(creates, 1);
  assert.equal(query(env, "SELECT COUNT(*) n FROM agent_runs").n, 1);
});

test("unconfirmed dispatch remains explicit and retry uses its original ID", async (t) => {
  const env = database(t);
  env.SOURCE_WORKFLOW.create = async () => {
    throw Error("down");
  };
  env.SOURCE_WORKFLOW.get = async () => {
    throw Error("down");
  };
  await assert.rejects(dispatchSources(env, { id: "recover-id" }));
  assert.equal(
    query(env, "SELECT state FROM agent_runs").state,
    "dispatch_failed",
  );
  env.SOURCE_WORKFLOW.create = async ({ id }) => {
    assert.equal(id, "recover-id");
  };
  assert.equal(
    (await dispatchSources(env, { id: "recover-id" })).id,
    "recover-id",
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM agent_runs").n, 1);
});

test("AI coordinator accepts only existing findings and has no action execution path", async (t) => {
  const env = database(t),
    snapshot = await operationsSnapshot(env),
    findings = operationFindings(snapshot);
  for (const value of [
    { priorities: ["invented"] },
    { priorities: [findings[0].id, findings[0].id] },
    { priorities: [findings[0].id], execute: "publish" },
    { priorities: [] },
  ])
    assert.throws(() => validateBrief(value, findings));
  env.AI_MODEL = "fictional-model";
  env.AI = {
    async run(model, input) {
      assert.equal(model, "fictional-model");
      assert.equal(input.tools, undefined);
      assert.ok(!input.messages[1].content.includes("private-cv"));
      return { response: JSON.stringify({ priorities: [findings[0].id] }) };
    },
  };
  const output = await generateOperationsBrief(env, snapshot, "owner-id");
  assert.equal(output.output.execution, "none");
  assert.equal(query(env, "SELECT COUNT(*) n FROM agent_runs").n, 0);
  env.AI.run = async () => ({ response: '{"priorities":["invented"]}' });
  await assert.rejects(
    generateOperationsBrief(env, snapshot, "owner-id"),
    /validated priorities/,
  );
  await assert.rejects(
    generateOperationsBrief(env, snapshot, "owner-id"),
    /two daily/,
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM agent_briefs").n, 1);
});

test("private agent endpoints reject anonymous callers and cross-origin owner mutations", async (t) => {
  const env = database(t);
  for (const path of [
    "/api/admin/agents",
    "/api/admin/agents/run",
    "/api/admin/agents/brief",
  ]) {
    assert.equal(
      (await adminAPI(new Request("https://sponsorintel.london" + path), env))
        .status,
      403,
    );
  }
  const request = new Request(
    "https://sponsorintel.london/api/admin/agents/run",
    {
      method: "POST",
      headers: {
        Origin: "https://other.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  assert.equal(
    (
      await agentOperationsAPI(request, env, {
        user: { id: "fictional-owner" },
      })
    ).status,
    403,
  );
  assert.equal(query(env, "SELECT COUNT(*) n FROM agent_runs").n, 0);
});

test("recovery keeps the original task set and scheduled dispatch reconciles a confirmed ended run", async (t) => {
  const env = database(t);
  await run(env);
  assert.deepEqual(await initialiseRun(env, "run-1"), [board.id]);
  env.sql.exec("UPDATE agent_runs SET created_at='2020-01-01T00:00:00.000Z'");
  env.SOURCE_WORKFLOW.get = async () => ({
    async status() {
      return { status: "errored" };
    },
  });
  const next = await dispatchSources(env, {
    id: "recovered-run",
    sourceId: board.id,
  });
  assert.equal(next.id, "recovered-run");
  assert.equal(
    query(env, "SELECT state FROM agent_runs WHERE id='run-1'").state,
    "attention",
  );
  assert.equal(
    query(env, "SELECT error_code FROM agent_tasks WHERE run_id='run-1'")
      .error_code,
    "workflow_ended",
  );
});

test("owner recovery is age-gated and cannot reset source request budgets", async (t) => {
  const env = database(t);
  await run(env);
  let restarts = 0;
  env.SOURCE_WORKFLOW.get = async () => ({
    async status() {
      return { status: "running" };
    },
    async restart() {
      restarts++;
    },
  });
  const request = () =>
    new Request("https://sponsorintel.london/api/admin/agents/recover", {
      method: "POST",
      headers: {
        Origin: "https://sponsorintel.london",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ run_id: "run-1" }),
    });
  assert.equal(
    (
      await agentOperationsAPI(request(), env, {
        user: { id: "fictional-owner" },
      })
    ).status,
    400,
  );
  assert.equal(restarts, 0);
  env.sql.exec(
    "UPDATE agent_runs SET created_at='2020-01-01T00:00:00.000Z',requests=149",
  );
  assert.equal(
    (
      await agentOperationsAPI(request(), env, {
        user: { id: "fictional-owner" },
      })
    ).status,
    200,
  );
  assert.equal(restarts, 1);
  assert.equal(query(env, "SELECT requests FROM agent_runs").requests, 149);
});


test('university exclusion decisions are committed with publication and reused on replay',async t=>{
 const env=database(t),b=BOARDS.find(x=>x.id==='university-nottingham');
 await dispatchSources(env,{id:'campus-review',sourceId:b.id});await initialiseRun(env,'campus-review');
 const jobs=await normaliseBoardJobs([{id:'PUBLIC',title:'Research Administrator',location:'Nottingham, United Kingdom',country:'GB',content:'A public university role. Internal candidates may request a secondment.',absolute_url:'https://jobs.nottingham.ac.uk/rss/click.aspx?ref=PUBLIC'}],b);
 jobs.feed_review={policy:'university-campus-v2',received:3,accepted:1,excluded:[{ref:'STAFF',reason:'internal_only'},{ref:'OLD',reason:'closing_date_passed'}]};let calls=0;const readBoard=async()=>{calls++;return jobs;};
 await executeSourceTask(env,'campus-review',b.id,{readBoard});await executeSourceTask(env,'campus-review',b.id,{readBoard});
 const evidence=JSON.parse(env.sql.prepare("SELECT evidence FROM agent_tasks WHERE run_id='campus-review'").get().evidence);assert.deepEqual(evidence.feed_review,jobs.feed_review);assert.equal(calls,1);assert.equal(env.sql.prepare('SELECT COUNT(*) n FROM jobs').get().n,1);
});
