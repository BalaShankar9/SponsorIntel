// Explicit operator tool. Creates a NEW account and binds ownership to its ID.
// Never promotes an account just because its unverified email matches.
// Usage: node scripts/provision-owner.mjs EMAIL ABSOLUTE_PRIVATE_OUTPUT_DIR
import { randomBytes } from "node:crypto";
import { writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
const [email, directory] = process.argv.slice(2);
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") ||
  !isAbsolute(directory || "")
)
  throw Error(
    "Provide an owner email and an absolute private output directory outside this repository.",
  );
const repo = resolve("..");
if (resolve(directory).startsWith(repo + "/"))
  throw Error("Credentials must stay outside this repository.");
await mkdir(directory, { recursive: true, mode: 0o700 });
const origin = "https://sponsorintel.london";
const password = randomBytes(24).toString("base64url");
const response = await fetch(origin + "/api/auth/sign-up/email", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Bala Bollineni", email, password }),
});
const account = await response.json();
if (!response.ok)
  throw Error(
    "A new owner account could not be created. Existing email accounts must be verified through a separate operator recovery process.",
  );
if (
  account.user?.email !== email ||
  !/^[a-zA-Z0-9_-]{10,128}$/.test(account.user.id)
)
  throw Error("Unexpected account identity.");
const cookie = response.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const state = { id: account.user.id, email, password, cookie };
const statePath = resolve(directory, "owner-setup-private.json");
await writeFile(statePath, JSON.stringify(state), { mode: 0o600, flag: "wx" });
const sqlPath = resolve(directory, "owner-role-private.sql");
await writeFile(
  sqlPath,
  "INSERT INTO admin_members(user_id,created_at) VALUES('" +
    state.id +
    "',datetime('now'));\nINSERT INTO admin_audit(actor,action,target,created_at) VALUES('" +
    state.id +
    "','owner_provisioned','" +
    state.id +
    "',datetime('now'));\n",
  { mode: 0o600, flag: "wx" },
);
execFileSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "sponsorintel-db",
    "--remote",
    "--file=" + sqlPath,
  ],
  { stdio: "pipe" },
);
const check = await fetch(origin + "/api/admin/session", {
  headers: { cookie },
});
if (!check.ok)
  throw Error(
    "Account created and role written, but owner verification failed. Inspect private setup state; do not recreate the account.",
  );
const recoveryResponse = await fetch(origin + "/api/career/recovery-code", {
  method: "POST",
  headers: { cookie, Origin: origin, "Content-Type": "application/json" },
  body: "{}",
});
const recovery = recoveryResponse.ok
  ? (await recoveryResponse.json()).code
  : "";
const text = [
  "SPONSOR INTEL — PRIVATE OWNER ACCESS",
  "Do not share or post this file.",
  "",
  "Dashboard: " + origin + "/admin",
  "Sign in: " + origin + "/signin",
  "Email: " + email,
  "Initial password: " + password,
  "",
  "Single-use recovery code: " +
    (recovery || "Create one from Account after signing in."),
  "",
  "After signing in, open Account → Change my password and set your own unique password. Keep the recovery code somewhere private. Email reset is not enabled yet.",
  "The admin dashboard is tied to your account ID; registering the same email elsewhere cannot grant access.",
  "Created " + new Date().toISOString(),
  "",
].join("\n");
await writeFile(resolve(directory, "Sponsor-Intel-owner-access.txt"), text, {
  mode: 0o600,
  flag: "wx",
});
console.log(
  "Owner account created, role verified, and private access file saved. No credentials printed.",
);
