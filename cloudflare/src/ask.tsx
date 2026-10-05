import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Send,
  ShieldCheck,
  MessageSquare,
  Trash2,
} from "lucide-react";
import "./platform.css";
type Source = {
  id: string;
  title: string;
  url: string;
  updated_at: string | null;
  checked_at: string;
  partial: boolean;
};
type Turn = {
  question: string;
  status: string;
  message: string;
  blocks: { text: string; source_id: string; quote: string }[];
  sources: Source[];
  checked_at: string;
  partial: boolean;
};
export function ImmigrationAssistant() {
  const [question, setQuestion] = useState(""),
    [consent, setConsent] = useState(false),
    [turns, setTurns] = useState<Turn[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [failedSources, setFailedSources] = useState<Source[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (turns.length)
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [turns.length]);
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setFailedSources([]);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: turns.slice(-2).map((t) => t.question),
          consent,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setFailedSources(data.sources || []);
        throw Error(data.error || "Please try again.");
      }
      setTurns((t) => [...t.slice(-7), { ...data, question }]);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="platform">
      <section className="platform-hero">
        <span className="eyebrow">ASK SPONSOR INTEL · BETA</span>
        <h1>
          Immigration information.
          <br />
          In everyday language.
        </h1>
        <p>
          Ask about UK visa rules, routes and changes. We fetch relevant GOV.UK
          guidance when you ask, then explain it with source quotations you can
          check.
        </p>
        <div className="chat-prompts">
          {[
            "Can I extend a Graduate visa?",
            "Can a Student visa holder be self-employed?",
            "Does a sponsor licence mean every job offers sponsorship?",
          ].map((p) => (
            <button key={p} onClick={() => setQuestion(p)}>
              {p}
            </button>
          ))}
        </div>
      </section>
      <p className="source-note">
        <ShieldCheck size={17} /> General information with official sources.
        This assistant cannot decide your eligibility or replace a regulated
        adviser. Coverage depends on available GOV.UK text; some rules and
        attachments need a fuller review. For a personal case, deadline or
        refusal, <a href="/advisers">find qualified advice</a>.
      </p>
      {turns.map((turn, i) => (
        <div
          ref={i === turns.length - 1 ? resultRef : undefined}
          className="chat-turn"
          key={i}
        >
          <p className="chat-question">
            <MessageSquare size={18} /> {turn.question}
          </p>
          {turn.message && <p className="chat-answer">{turn.message}</p>}
          {turn.blocks.map((b, k) => (
            <p className="chat-answer" key={k}>
              {b.text}{" "}
              <a
                href={`#answer-${i}-${b.source_id}`}
                aria-label={`Source ${b.source_id}`}
              >
                [{b.source_id}]
              </a>
            </p>
          ))}
          <p className="fine-print">
            Checked {new Date(turn.checked_at).toLocaleString("en-GB")} · AI
            explanation; check the original guidance before acting.
            {turn.partial
              ? " Some source checks were incomplete; this is not a complete rule review."
              : ""}
          </p>
          <details open>
            <summary>Official sources & evidence passages</summary>
            <ul className="chat-sources">
              {turn.sources.map((s) => (
                <li key={s.id} id={`answer-${i}-${s.id}`}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    [{s.id}] {s.title} <ArrowUpRight size={13} />
                  </a>
                  <small>
                    GOV.UK ·{" "}
                    {s.updated_at
                      ? "Page updated " +
                        new Date(s.updated_at).toLocaleDateString("en-GB")
                      : "Update date unavailable"}
                    {s.partial ? " · Selected sections" : ""}
                  </small>
                  {turn.blocks
                    .filter((b) => b.source_id === s.id)
                    .map((b, k) => (
                      <details key={k}>
                        <summary>Read the supporting passage</summary>
                        <blockquote className="preserve-lines">
                          {b.quote}
                        </blockquote>
                      </details>
                    ))}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
      <section className="career-panel">
        <h2>
          {turns.length
            ? "Ask a follow-up"
            : "What would you like to understand?"}
        </h2>
        <form className="chat-form" onSubmit={(e) => void ask(e)}>
          <label className="sr-only" htmlFor="immigration-question">
            Your UK immigration question
          </label>
          <textarea
            id="immigration-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            minLength={8}
            maxLength={1000}
            placeholder="For example: What does GOV.UK say about switching from a Graduate visa to Skilled Worker?"
          />
          <label className="check-line">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            I agree to send my question and the last two questions to Cloudflare
            AI and use them to search GOV.UK. I won’t include passport numbers,
            contact details or private documents.
          </label>
          <div className="platform-actions">
            <button
              className="primary-button"
              disabled={busy || !consent || question.trim().length < 8}
            >
              <Send size={16} />
              {busy
                ? "Checking official sources…"
                : "Ask with official sources"}
            </button>
            {turns.length > 0 && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setTurns([]);
                  setError("");
                  setFailedSources([]);
                }}
              >
                <Trash2 size={14} /> Clear conversation
              </button>
            )}
          </div>
        </form>
        {busy && (
          <p className="fine-print" role="status">
            Fetching current guidance and checking the answer’s quotations. This
            may take a little time.
          </p>
        )}
        {error && (
          <p className="career-error" role="alert">
            {error}
          </p>
        )}
        {failedSources.length > 0 && (
          <ul className="chat-sources">
            {failedSources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="fine-print">
          Your conversation stays in this page’s memory and disappears when you
          leave or clear it. We don’t save question text to your account.
          Anonymous answer counts help us understand usage. Daily and hourly
          allowances keep the free service available.
        </p>
      </section>
    </div>
  );
}
