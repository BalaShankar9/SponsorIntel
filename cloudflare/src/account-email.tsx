import React, { useState } from "react";
import { request } from "./career-data";
export function AccountEmailHelp({
  email = "",
  verified = false,
  signedIn = false,
}: {
  email?: string;
  verified?: boolean;
  signedIn?: boolean;
}) {
  const [address, setAddress] = useState(email),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(kind: "verify" | "reset") {
    setBusy(true);
    setMessage("");
    try {
      await request(
        "/api/auth/" +
          (kind === "verify"
            ? "send-verification-email"
            : "request-password-reset"),
        "POST",
        {
          email: signedIn ? email : address,
          ...(kind === "verify"
            ? { callbackURL: signedIn ? "/account" : "/signin?email-link=1" }
            : { redirectTo: "/reset-password" }),
        },
      );
      setMessage(
        "If this address has an account that needs this action, an email is on its way. Check your inbox and spam folder.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-email-help">
      <h3>{signedIn ? "Email security" : "Need an account email?"}</h3>
      {signedIn ? (
        <p>
          {verified
            ? "Your email address is verified."
            : "Your email address still needs verification. Verify it before your next sign-in."}
        </p>
      ) : (
        <label className="career-field">
          Account email for verification or recovery
          <input
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="email"
            maxLength={254}
          />
        </label>
      )}
      <div className="career-actions">
        {!verified && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !(signedIn ? email : address)}
            onClick={() => void send("verify")}
          >
            Send verification link
          </button>
        )}
        {!signedIn && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy || !address}
            onClick={() => void send("reset")}
          >
            Email a password reset
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="career-notice">
          {message}
        </p>
      )}
      <p className="fine-print">
        Verification links expire after one hour. Password-reset links expire
        after 30 minutes. Your saved recovery code remains available.
      </p>
    </div>
  );
}
export function PasswordReset() {
  const [token] = useState(() =>
      typeof location === "undefined"
        ? ""
        : new URLSearchParams(location.search).get("token") || "",
    ),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await request("/api/auth/reset-password", "POST", {
        token,
        newPassword: password,
      });
      setPassword("");
      setConfirm("");
      setDone(true);
      history.replaceState({}, "", "/reset-password");
      setMessage(
        "Password reset. Other sessions have been signed out. You can sign in with your new password.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="career-panel">
      <h1>Choose a new password</h1>
      {message && (
        <p role="status" className="career-notice">
          {message}
        </p>
      )}
      {token && !done ? (
        <form className="career-form" onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Reset my password"}
          </button>
          <p>
            Use at least 12 characters and a unique password. The reset link is
            single use.
          </p>
        </form>
      ) : !done ? (
        <p>
          Open the password-reset link from your email, or request a new one on
          the sign-in page.
        </p>
      ) : null}
      <a href="/signin">Go to sign in</a>
    </section>
  );
}
