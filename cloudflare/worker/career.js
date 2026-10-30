// Application and interview prompts adapted from HireStack AI (MIT).
// Source and copyright notices are recorded in THIRD_PARTY_NOTICES.md.
import {
  reply,
  bodyJSON,
  token,
  digest,
  limit,
  sameOrigin,
  sessionFor,
} from "./auth.js";

import { buildEvidenceReview } from "./career-evidence.js";
import {
  cleanDraft,
  draftWarnings,
  preserveCVContacts,
} from "./career-quality.js";
import { reviewDraft } from "./career-review.js";
import { validateWorkspace } from "./career-validation.js";
import { companyBrief } from "./company-brief.js";
import { preparationReply } from './analytics.js';
import { cvApplicationRestriction } from '../shared/application-instructions.js';
import { configureSearchMonitor, searchInbox, markSearchMatchesRead } from './search-notifications.js';
import { preparationSnapshot, preparationBlock } from './preparation-availability.js';
import {applicationBatchesAPI} from './application-batches.js';
import {founderWorkspaceAPI} from './founder-workspace.js';
export { validateWorkspace } from "./career-validation.js";

import {generationPrompt,writeCareerDraft} from "./career-writer.js";
export {generationPrompt,writeCareerDraft} from "./career-writer.js";

export async function careerAPI(request, env) {
  const url = new URL(request.url);
  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method))
    return reply({ error: "Method not allowed" }, 405);
  if (request.method !== "GET" && !sameOrigin(request))
    return reply({ error: "Please use Sponsor Intel." }, 403);
  const session = await sessionFor(request, env);
  if (url.pathname === "/api/career/config")
    return reply({
      accounts: !!env.AUTH_SECRET,
      ai: !!env.AI,
      version: 2,
      dailyGenerations: 8,
      emailVerification:
        !!env.EMAIL && env.EMAIL_VERIFICATION_ENABLED === "true",
    });
  const user = session?.user;
  if (url.pathname === '/api/career/availability' && request.method === 'GET') {
    const jobId = url.searchParams.get('job') || '';
    const snapshot = await preparationSnapshot(jobId, env);
    return reply({ jobId, ...snapshot }, snapshot.state === 'unavailable' ? 503 : 200);
  }
  if (url.pathname === "/api/career/generate" && request.method === "POST") {
    let body;
    try {
      body = await bodyJSON(request, 85000);
    } catch {
      return reply({ error: "The CV or job description is too large." }, 400);
    }
    if (
      body?.consent !== true &&
      !["analysis", "companyResearch"].includes(body?.kind)
    )
      return reply(
        {
          error:
            "Confirm that you want to send this CV and job description to Cloudflare AI.",
        },
        400,
      );
    let workspace;
    try {
      workspace = validateWorkspace({
        version: 2,
        profile: body.profile,
        applications: [body.application],
        searches: [],
      });
    } catch {
      return reply({ error: "Please check your profile and vacancy." }, 400);
    }
    if (
      (body.kind !== "companyResearch" &&
        workspace.profile.cv.trim().length < 100) ||
      workspace.applications[0].description.trim().length < 80
    )
      return reply(
        {
          error:
            "Add your CV and the job description before preparing a document.",
        },
        400,
      );
    const linkedApplication = workspace.applications[0];
    const blocked = await preparationBlock(linkedApplication, env, body.kind);
    if (blocked) return blocked;
    if (body.kind === 'cv' && cvApplicationRestriction(workspace.applications[0].description))
      return reply({ error: 'This advert says CVs are not accepted for this application. Use your evidence notes with the employer’s requested format. Existing drafts remain editable.' }, 409);
    if (body.kind === "analysis")
      return preparationReply({
        text: buildEvidenceReview(workspace.profile, workspace.applications[0]),
        kind: "analysis",
        generatedAt: new Date().toISOString(),
        reviewRequired: true,
      });
    if (body.kind === "companyResearch") {
      if (
        !(await limit(
          env,
          "company-brief:" +
            (user?.id || request.headers.get("CF-Connecting-IP") || "local"),
          30,
        ))
      )
        return reply({ error: "Please try again later." }, 429);
      const text = await companyBrief(workspace.applications[0], env);
      const afterBrief = await preparationBlock(linkedApplication, env, body.kind);
      if (afterBrief) return afterBrief;
      return preparationReply({
        text,
        kind: body.kind,
        generatedAt: new Date().toISOString(),
        reviewRequired: true,
      });
    }
    if (!env.AI)
      return reply(
        {
          error:
            "AI preparation is temporarily unavailable. You can still edit and export your documents.",
        },
        503,
      );
    let prompt;
    try {
      prompt = generationPrompt(
        body.kind,
        workspace.profile,
        workspace.applications[0],
      );
    } catch {
      return reply({ error: "Choose a supported document." }, 400);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    if (
      !(await limit(env, "ai-ip:" + ip, 12, 86400)) ||
      !(await limit(env, "ai-user:" + (user?.id || ip), 8, 86400)) ||
      !(await limit(env, "ai-global", Number(env.AI_DAILY_LIMIT || 40), 86400))
    )
      return reply(
        {
          error:
            "Today’s preparation allowance has been used. Your drafts remain editable; try again tomorrow.",
        },
        429,
      );
    try {
      let value = await writeCareerDraft(env,body.kind,workspace.profile,workspace.applications[0]);
      // A hold/closure can arrive during generation. Preserve consumed usage,
      // stop the next model stage and never return the now-non-current draft.
      const afterWriting = await preparationBlock(linkedApplication, env, body.kind);
      if (afterWriting) return afterWriting;
      if (["cv", "coverLetter"].includes(body.kind))
        value = await reviewDraft(
          env,
          value,
          workspace.profile,
          workspace.applications[0],
          body.kind,
        );
      if (body.kind === "cv")
        value = preserveCVContacts(value, workspace.profile);
      if (body.kind === "learningPlan")
        value =
          "LEARNING PLAN — SUGGESTED PRACTICE ONLY\nThis plan does not replace required qualifications, professional registration or supervised training. Use fictional examples for practice. Confirm official entry requirements before pursuing a regulated role.\n\n" +
          value;
      const beforeReturn = await preparationBlock(linkedApplication, env, body.kind);
      if (beforeReturn) return beforeReturn;
      return preparationReply({
        evidenceReviewed: ["cv", "coverLetter"].includes(body.kind),
        text: value,
        warnings: draftWarnings(value, workspace.profile.cv, body.kind),
        kind: body.kind,
        generatedAt: new Date().toISOString(),
        reviewRequired: true,
      });
    } catch (error) {
      const safeReasons = [
        "Incomplete output",
        "Invalid reviewed document",
        "Missing factual checks",
        "Unsupported evidence check",
        "New numeric claim",
        "Unsupported availability",
        "Incomplete evidence review",
      ];
      console.warn(
        JSON.stringify({
          event: "career_generation_failed",
          reason: safeReasons.includes(error?.message)
            ? error.message
            : "model_or_format_unavailable",
        }),
      );
      return reply(
        {
          error:
            "Preparation could not finish. Your existing draft is safe. Please try again later.",
        },
        503,
      );
    }
  }
  if (!user) return reply({ error: "Sign in to sync your workspace." }, 401);
  if(url.pathname==='/api/career/founder-workspace')return founderWorkspaceAPI(request,env,user);
  if(url.pathname==='/api/career/batches'||url.pathname.startsWith('/api/career/batches/'))return applicationBatchesAPI(request,env,user);
  if (url.pathname === '/api/career/search-notifications') {
    if (!await limit(env,'search-inbox:'+user.id,120,60)) return reply({error:'Please wait a moment before trying again.'},429);
    if (request.method === 'GET') return reply(await searchInbox(env,user.id));
    if (request.method === 'PUT' || request.method === 'POST') {
      let body;
      try {body=await bodyJSON(request,6000);}
      catch {return reply({error:'Please send valid search settings.'},400);}
      try {
        return reply(request.method==='PUT' ? await configureSearchMonitor(env,user,body) : await markSearchMatchesRead(env,user.id,body));
      } catch(error) {
        if (error.status) return reply({error:error.message},error.status);
        if (error instanceof SyntaxError) return reply({error:'Please send valid search settings.'},400);
        throw error;
      }
    }
    return reply({error:'Method not allowed'},405);
  }
  if (url.pathname === "/api/career/workspace") {
    if (request.method === "GET") {
      const r = await env.DB.prepare(
        "SELECT data,revision,updated_at FROM career_workspaces WHERE user_id=?",
      )
        .bind(user.id)
        .first();
      return reply({
        accountId: user.id,
        data: r ? JSON.parse(r.data) : null,
        revision: r?.revision || 0,
        updatedAt: r?.updated_at || null,
      });
    }
    if (request.method === "PUT") {
      let body, data;
      try {
        body = await bodyJSON(request);
        data = validateWorkspace(body.data);
        if (!Number.isSafeInteger(body.revision) || body.revision < 0)
          throw Error();
      } catch {
        return reply(
          {
            error:
              "The workspace could not be saved. Export a backup and check its size.",
          },
          400,
        );
      }
      if(body.accountId!==undefined&&body.accountId!==user.id)
        return reply({error:'Your signed-in account changed. Your current work was not saved to another account.'},409);
      const now = new Date().toISOString();
      let result;
      if (body.revision === 0)
        result = await env.DB.prepare(
          // Authentication can precede a concurrent account deletion. Check
          // existence inside this write so an in-flight save cannot recreate data.
          "INSERT INTO career_workspaces(user_id,data,revision,updated_at) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM user WHERE id=?) ON CONFLICT(user_id) DO NOTHING",
        )
          .bind(user.id, JSON.stringify(data), now, user.id)
          .run();
      else
        result = await env.DB.prepare(
          "UPDATE career_workspaces SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?",
        )
          .bind(JSON.stringify(data), now, user.id, body.revision)
          .run();
      if (!result.meta.changes)
        return reply(
          {
            error:
              "The workspace changed or your account is no longer available. Export this copy, then reload before saving.",
          },
          409,
        );
      return reply({ revision: body.revision + 1, updatedAt: now });
    }
  }
  if (
    url.pathname === "/api/career/recovery-code" &&
    request.method === "POST"
  ) {
    if (Date.now() - new Date(session.session.createdAt).getTime() > 600000)
      return reply(
        {
          error: "Sign out and sign in again before creating a recovery code.",
        },
        403,
      );
    const code = token();
    const result = await env.DB.prepare(
      "INSERT INTO recovery_codes(user_id,hash,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM user WHERE id=?) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,created_at=excluded.created_at",
    )
      .bind(user.id, await digest(code), new Date().toISOString(), user.id)
      .run();
    if (!result.meta.changes)
      return reply({ error: "Your account is no longer available. Please sign in again." }, 401);
    return reply({ code });
  }
  if (url.pathname === "/api/career/account" && request.method === "DELETE") {
    if (Date.now() - new Date(session.session.createdAt).getTime() > 600000)
      return reply(
        { error: "Sign out and sign in again before deleting your account." },
        403,
      );
    await env.DB.batch([
      env.DB.prepare("DELETE FROM career_workspaces WHERE user_id=?").bind(
        user.id,
      ),
      env.DB.prepare("DELETE FROM recovery_codes WHERE user_id=?").bind(
        user.id,
      ),
      env.DB.prepare("DELETE FROM session WHERE userId=?").bind(user.id),
      env.DB.prepare("DELETE FROM account WHERE userId=?").bind(user.id),
      env.DB.prepare("DELETE FROM user WHERE id=?").bind(user.id),
    ]);
    return reply({ ok: true });
  }
  return reply({ error: "Not found" }, 404);
}
