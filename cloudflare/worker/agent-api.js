import { bodyJSON, reply, sameOrigin, limit } from "./auth.js";
import {
  dispatchSources,
  operationsSnapshot,
  setSourcePause,
  SourceBusy,
  completeRun,
} from "./agent-operations.js";
import { generateOperationsBrief } from "./agent-brief.js";

// Called only after adminAPI has verified the immutable owner user ID.
export async function agentOperationsAPI(request, env, owner) {
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/api/admin/agents")
    return reply(await operationsSnapshot(env));
  if (
    request.method !== "POST" ||
    ![
      "/api/admin/agents/run",
      "/api/admin/agents/source",
      "/api/admin/agents/brief",
      "/api/admin/agents/reconcile",
      "/api/admin/agents/recover",
    ].includes(path)
  )
    return reply({ error: "Not found" }, 404);
  if (!sameOrigin(request))
    return reply({ error: "Use the owner dashboard." }, 403);
  if (
    !(await limit(
      env,
      "agent-operations:" + owner.user.id,
      path.endsWith("/run") ? 6 : 20,
    ))
  )
    return reply(
      { error: "Please wait before requesting another operation." },
      429,
    );
  let body;
  try {
    body = await bodyJSON(request, 2000);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  try {
    if (path.endsWith("/run")) {
      if (body.source_id != null && typeof body.source_id !== "string")
        throw Error("Choose an approved source.");
      const result = await dispatchSources(env, {
        id: "owner-" + crypto.randomUUID(),
        actor: owner.user.id,
        sourceId: body.source_id || null,
        trigger: "owner",
      });
      return reply(
        {
          ...result,
          message: result.reused
            ? "A run is already active. Its progress is shown below."
            : "Source run queued. Progress will appear below.",
        },
        202,
      );
    }
    if (path.endsWith("/source")) {
      await setSourcePause(
        env.DB,
        body.source_id,
        body.paused,
        owner.user.id,
        body.reason,
      );
      return reply({
        ok: true,
        message: body.paused
          ? "Source paused and its vacancies hidden."
          : "Source resumed. A successful refresh is required before its vacancies return.",
      });
    }
    if (path.endsWith("/brief")) {
      if (body.consent !== true)
        throw Error(
          "Confirm that operational findings may be sent to Cloudflare AI.",
        );
      const brief = await generateOperationsBrief(
        env,
        await operationsSnapshot(env),
        owner.user.id,
      );
      return reply({
        brief,
        message:
          "Coordinator priorities saved for review. No suggested action was executed.",
      });
    }
    if (
      typeof body.run_id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(body.run_id)
    )
      throw Error("Choose a run.");
    const run = await env.DB.prepare("SELECT * FROM agent_runs WHERE id=?")
      .bind(body.run_id)
      .first();
    if (!run) throw Error("Run not found.");
    if (path.endsWith("/recover")) {
      if (
        !["queued", "running"].includes(run.state) ||
        Date.now() - Date.parse(run.created_at) < 10 * 60000
      )
        throw Error(
          "Recovery is available for unfinished runs older than ten minutes.",
        );
      const instance = await env.SOURCE_WORKFLOW.get(run.id);
      const status = await instance.status();
      if (status.status === "complete")
        throw Error(
          "Execution has completed. Use Check execution status to reconcile its records.",
        );
      await instance.restart();
      await env.DB.prepare(
        "INSERT INTO admin_audit(actor,action,target,created_at) VALUES(?,?,?,?)",
      )
        .bind(
          owner.user.id,
          "agent_run_recovered",
          run.id,
          new Date().toISOString(),
        )
        .run();
      return reply({
        message:
          "Recovery requested. Completed publications will be reused, and existing request and attempt limits still apply.",
      });
    }
    if (run.state === "dispatch_failed")
      return reply(
        {
          ...(await dispatchSources(env, {
            id: run.id,
            actor: run.actor,
            sourceId: run.source_id,
            trigger: run.trigger_kind,
          })),
          message: "Dispatch retried using the same run ID.",
        },
        202,
      );
    const status = await (await env.SOURCE_WORKFLOW.get(run.id)).status();
    if (["complete", "errored", "terminated"].includes(status.status)) {
      await env.DB.prepare(
        "UPDATE agent_tasks SET state='failed',error_code='workflow_ended',finished_at=? WHERE run_id=? AND state IN ('queued','running')",
      )
        .bind(new Date().toISOString(), run.id)
        .run();
      await completeRun(env.DB, run.id);
    }
    return reply({
      message: "Workflow status checked: " + status.status + ".",
    });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof SourceBusy
            ? error.message
            : error instanceof Error &&
                !/D1|SQLITE|binding|fetch|secret|token/i.test(error.message)
              ? error.message
              : "Operation could not complete. Please check the run status.",
      },
      error instanceof SourceBusy ? 409 : 400,
    );
  }
}
