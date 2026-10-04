import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  Copy,
  Flag,
  Lightbulb,
} from "lucide-react";
import "./feedback.css";

export type FeedbackKind = "feedback" | "bug" | "data";
export type FeedbackItem = {
  type: "employer" | "job" | "update";
  id: string;
  label: string;
};
export type ReportFeedback = (kind?: FeedbackKind, item?: FeedbackItem) => void;
const choices = [
  { kind: "feedback", label: "Share an idea", icon: Lightbulb },
  { kind: "bug", label: "Report a bug", icon: Bug },
  { kind: "data", label: "Incorrect info", icon: Flag },
] as const;
const pageNames: Record<string, string> = {
  "/": "Find sponsors",
  "/jobs": "Find a role",
  "/updates": "Immigration updates",
  "/applications": "My applications",
  "/saved": "My shortlist",
  "/studio": "Application studio",
  "/account": "My account",
  "/career-profile": "My CV & profile",
  "/settings": "Settings",
  "/employer-notes": "Employer notes",
  "/guides": "Career guides",
  "/about": "About & sources",
};

export function FeedbackForm({
  initialKind,
  page,
  item,
  close,
}: {
  initialKind: FeedbackKind;
  page: string;
  item?: FeedbackItem;
  close: () => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [message, setMessage] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);
  const receipt = useRef<HTMLHeadingElement>(null);
  const labels = {
    feedback: "What would make Sponsor Intel more useful for you?",
    bug: "What happened, and what were you trying to do?",
    data: "What looks wrong, and what needs checking?",
  };
  const placeholders = {
    feedback: "I’d find it easier to…",
    bug: "I tried to… I expected… Instead…",
    data: "The employer, job or update says… I think it should…",
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSending(true);
    setError("");
    const website = new FormData(event.currentTarget).get("website");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message,
          website,
          context: includeContext ? { page, item } : null,
        }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.error || "Your report could not be sent. Please try again.",
        );
      if (!result?.ok || typeof result.id !== "string")
        throw new Error(
          "We couldn’t confirm delivery. Your message is still here; please try again.",
        );
      setReference(result.id);
      setMessage("");
      window.requestAnimationFrame(() => receipt.current?.focus());
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "AbortError" && e.name !== "TypeError"
          ? e.message
          : "We couldn’t confirm delivery. Check your connection and try again. Your message is still here.",
      );
    } finally {
      window.clearTimeout(timeout);
      pending.current = false;
      setSending(false);
    }
  }
  if (reference)
    return (
      <section className="feedback-receipt" aria-live="polite">
        <span className="feedback-symbol">
          <CheckCircle2 size={28} />
        </span>
        <p className="eyebrow">THANK YOU FOR HELPING</p>
        <h2 ref={receipt} tabIndex={-1}>
          Your voice is part of this.
        </h2>
        <p>
          Your {kind === "feedback" ? "feedback" : "report"} has been saved
          privately for review. Keep your reference if you need to follow up.
        </p>
        <div className="feedback-reference">
          <span>Your reference</span>
          <code>{reference}</code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reference);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={15} />
            {copied ? "Copied" : "Copy reference"}
          </button>
        </div>
        <div className="feedback-actions">
          <button className="primary-button" onClick={close}>
            Back to exploring <ArrowRight size={17} />
          </button>
          <button
            className="text-button"
            onClick={() => {
              setReference("");
              setCopied(false);
            }}
          >
            Send another
          </button>
        </div>
      </section>
    );
  return (
    <section className="feedback-panel">
      <p className="eyebrow">BUILT WITH YOU</p>
      <h2>Help make this better.</h2>
      <p className="feedback-intro">
        Found a problem or have an idea? No account needed.
      </p>
      <form onSubmit={submit} aria-busy={sending}>
        <fieldset className="feedback-choices" disabled={sending}>
          <legend>What would you like to share?</legend>
          {choices.map(({ kind: value, label, icon: Icon }) => (
            <label key={value} className={kind === value ? "selected" : ""}>
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              <Icon size={19} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <label className="feedback-message-label" htmlFor="feedback-message">
          {labels[kind]}
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minLength={10}
          maxLength={2000}
          required
          rows={5}
          placeholder={placeholders[kind]}
          disabled={sending}
          aria-describedby="feedback-privacy feedback-length"
        />
        <div className="feedback-length" id="feedback-length">
          At least 10 characters{" "}
          <span>{message.length.toLocaleString()} / 2,000</span>
        </div>
        <label className="feedback-context">
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
            disabled={sending}
          />
          <span>
            Include where this happened
            <small>
              {pageNames[page] ||
                (page.startsWith("/guides/") ? "Career guide" : "Current page")}
              {item ? " · " + item.label : ""}
            </small>
          </span>
        </label>
        <div className="feedback-trap" aria-hidden="true">
          <label>
            Leave this empty
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <p id="feedback-privacy" className="feedback-privacy">
          Stored privately with the app version. No CV, account details or
          search terms are attached. Please don’t include passwords or personal
          documents.
        </p>
        {error && (
          <p className="feedback-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button feedback-submit"
          disabled={sending || message.trim().length < 10}
        >
          {sending
            ? "Sending…"
            : kind === "feedback"
              ? "Send feedback"
              : "Send report"}
          <ArrowRight size={17} />
        </button>
      </form>
    </section>
  );
}
