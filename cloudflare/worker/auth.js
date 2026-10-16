import { betterAuth } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { boundedText } from "./data.js";
import { sendAccountEmail } from "./account-email.js";

export const reply = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function bodyJSON(request, max = 650000) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new Error("Please send JSON.");
  return JSON.parse(await boundedText(new Response(request.body), max));
}
export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
export const digest = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
export function sameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export async function limit(env, key, max, seconds = 3600) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const hash = await digest(key + ":" + bucket);
  const r = await env.DB.prepare(
    "INSERT INTO ai_usage(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(hash, Date.now() + seconds * 2000)
    .first();
  return r.count <= max;
}

export function authFor(request, env) {
  const origin = new URL(request.url).origin;
  const emailEnabled = !!env.EMAIL && env.EMAIL_VERIFICATION_ENABLED === "true";
  const origins = [
    env.APP_ORIGIN,
    "https://sponsorintel.balashankarbollineni4.workers.dev",
    "https://sponsorintel.london",
    "https://www.sponsorintel.london",
    "http://127.0.0.1:8788",
    "http://localhost:8788",
    "http://127.0.0.1:5177",
  ].filter(Boolean);
  if (!origins.includes(origin))
    throw new Error("Unrecognised application origin");
  return betterAuth({
    appName: "Sponsor Intel",
    secret: env.AUTH_SECRET,
    baseURL: origin,
    basePath: "/api/auth",
    database: env.DB,
    trustedOrigins: origins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: emailEnabled,
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      ...(emailEnabled
        ? {
            sendResetPassword: async ({ user, token }) => {
              const url = new URL("/reset-password", origin);
              url.searchParams.set("token", token);
              await sendAccountEmail(env, {
                to: user.email,
                url: url.href,
                kind: "reset",
                origin,
              });
            },
          }
        : {}),
    },
    ...(emailEnabled
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: false,
            autoSignInAfterVerification: false,
            expiresIn: 3600,
            sendVerificationEmail: async ({ user, url }) => {
              await sendAccountEmail(env, {
                to: user.email,
                url,
                kind: "verify",
                origin,
              });
            },
          },
        }
      : {}),
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: origin.startsWith("https:"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/request-password-reset": { window: 3600, max: 5 },
        "/send-verification-email": { window: 3600, max: 5 },
        "/reset-password": { window: 3600, max: 5 },
      },
    },
    logger: { level: "error" },
  });
}

export async function authAPI(request, env) {
  if (!env.AUTH_SECRET)
    return reply(
      {
        error:
          "Accounts are temporarily unavailable. Your browser workspace still works.",
      },
      503,
    );
  const path = new URL(request.url).pathname;
  const allowed = [
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
    "/api/auth/sign-out",
    "/api/auth/get-session",
    "/api/auth/change-password",
    "/api/auth/send-verification-email",
    "/api/auth/verify-email",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
  ];
  if (!allowed.includes(path)) return reply({ error: "Not found" }, 404);
  if (request.method !== "GET" && !sameOrigin(request))
    return reply({ error: "Please use Sponsor Intel to sign in." }, 403);
  if (Number(request.headers.get("Content-Length")) > 6000)
    return reply({ error: "Request too large" }, 413);
  if (request.method === "POST") {
    let text;
    try {
      text = await boundedText(new Response(request.body), 6000);
    } catch {
      return reply({ error: "Request too large" }, 413);
    }
    if (
      [
        "/api/auth/send-verification-email",
        "/api/auth/request-password-reset",
        "/api/auth/sign-up/email",
      ].includes(path)
    ) {
      let input;
      try {
        input = JSON.parse(text);
      } catch {
        return reply({ error: "Invalid account request" }, 400);
      }
      if (input.callbackURL || input.redirectTo) {
        try {
          const target = new URL(
            input.callbackURL || input.redirectTo,
            new URL(request.url).origin,
          );
          if (
            target.origin !== new URL(request.url).origin ||
            !["/account", "/signin", "/reset-password"].includes(
              target.pathname,
            )
          )
            throw Error();
        } catch {
          return reply(
            { error: "Use the account page for this request." },
            400,
          );
        }
      }
      if (
        path !== "/api/auth/sign-up/email" &&
        (!env.EMAIL || env.EMAIL_VERIFICATION_ENABLED !== "true")
      )
        return reply(
          {
            error:
              "Email recovery is unavailable. Use your saved recovery code.",
          },
          503,
        );
      if (env.EMAIL && env.EMAIL_VERIFICATION_ENABLED === "true") {
        const key = String(input.email || "")
          .trim()
          .toLowerCase();
        if (
          !(await limit(env, "account-mail-address:" + key, 4, 3600)) ||
          !(await limit(env, "account-mail-global", 100, 86400))
        )
          return reply(
            { error: "Too many email requests. Please try again later." },
            429,
          );
      }
    }
    request = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: text,
    });
    if (
      path !== "/api/auth/sign-out" &&
      !(await limit(env, "auth:" + request.headers.get("CF-Connecting-IP"), 30))
    )
      return reply(
        { error: "Too many sign-in attempts. Please try again later." },
        429,
      );
  }
  const response = await authFor(request, env).handler(request);
  const safe = new Response(response.body, response);
  safe.headers.set("Referrer-Policy", "no-referrer");
  safe.headers.set("Cache-Control", "no-store");
  return safe;
}

export async function sessionFor(request, env) {
  if (!env.AUTH_SECRET) return null;
  return authFor(request, env).api.getSession({ headers: request.headers });
}

export async function recoverAccount(request, env) {
  if (!sameOrigin(request))
    return reply({ error: "Please use Sponsor Intel." }, 403);
  if (
    !(await limit(
      env,
      "recovery:" + request.headers.get("CF-Connecting-IP"),
      5,
    ))
  )
    return reply({ error: "Please try again in an hour." }, 429);
  let body;
  try {
    body = await bodyJSON(request, 1500);
  } catch {
    return reply({ error: "Invalid recovery details." }, 400);
  }
  const code =
    typeof body.code === "string"
      ? body.code.replace(/\s|-/g, "").toLowerCase()
      : "";
  if (
    !/^[a-f0-9]{64}$/.test(code) ||
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    return reply(
      {
        error: "Enter your recovery code and a password of 12–128 characters.",
      },
      400,
    );
  const hash = await digest(code);
  const exists = await env.DB.prepare(
    "SELECT user_id FROM recovery_codes WHERE hash=?",
  )
    .bind(hash)
    .first();
  if (!exists)
    return reply({ error: "Recovery details could not be verified." }, 400);
  const password = await hashPassword(body.password);
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE account SET password=?,updatedAt=? WHERE providerId='credential' AND userId=(SELECT user_id FROM recovery_codes WHERE hash=?)",
    ).bind(password, Date.now(), hash),
    env.DB.prepare(
      "DELETE FROM session WHERE userId=(SELECT user_id FROM recovery_codes WHERE hash=?)",
    ).bind(hash),
    env.DB.prepare("DELETE FROM recovery_codes WHERE hash=?").bind(hash),
  ]);
  if (!results[0].meta.changes)
    return reply({ error: "This recovery code has already been used." }, 400);
  return reply({ ok: true });
}
