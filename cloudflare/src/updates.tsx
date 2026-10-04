import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./updates.css";

type Explanation = {
  title: string;
  audience: string;
  status: string;
  effective_date: string | null;
  points: string[];
  action: string;
  caveat: string;
  prepared_at: string;
};
type Source = {
  id: string;
  topic: string;
  title: string;
  url: string;
  kind: string;
  status: string;
  summary: Explanation | null;
  checked_at: string;
  last_success: string;
  source_updated_at: string;
  error: string | null;
};
type Update = {
  id: string;
  source_id: string;
  topic: string;
  title: string;
  url: string;
  detected_at: string;
  source_updated_at: string;
  kind: string;
};
type Feed = {
  sources: Source[];
  events: Update[];
  interval_minutes: number;
  generated_at: string;
};
const topics: Record<string, string> = {
  all: "All updates",
  student: "Student",
  graduate: "Graduate",
  "skilled-worker": "Skilled Worker",
  "health-care": "Health & care",
  general: "Immigration Rules",
};
const external = { target: "_blank", rel: "noopener noreferrer" };
function time(value: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
        timeZoneName: "short",
      })
    : "Not yet checked";
}
function date(value: string) {
  return new Date(
    value.length === 10 ? value + "T12:00:00Z" : value,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}
const notices: Record<string, string> = {
  source_changed:
    "The official text has changed. The previous explanation is hidden until it has been checked against the new version.",
  delayed:
    "We could not confirm the latest official text recently. Open GOV.UK for the current guidance; the explanation is temporarily hidden.",
  withdrawn:
    "GOV.UK has marked this content as withdrawn. Do not rely on an earlier explanation.",
  unavailable:
    "This source has not been checked successfully yet. Read the official page directly.",
  awaiting_summary:
    "A plain-English explanation is being prepared. Read the official guidance for now.",
};

export function ImmigrationUpdates() {
  const [topic, setTopic] = useState(() => {
    if (typeof window === "undefined") return "all";
    const fromURL = new URLSearchParams(
      typeof location === "undefined" ? "" : location.search,
    ).get("topic");
    if (fromURL && topics[fromURL]) return fromURL;
    try {
      const saved = localStorage.getItem("si.updates.topic");
      return saved && topics[saved] ? saved : "all";
    } catch {
      return "all";
    }
  });
  const [feed, setFeed] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [key, setKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load(initial = false) {
      if (!initial && document.hidden) return;
      try {
        const response = await fetch("/api/updates", {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Updates could not be loaded. Please try again.");
        const result: Feed = await response.json();
        if (!Array.isArray(result.sources) || !Array.isArray(result.events))
          throw new Error("Updates could not be loaded.");
        setFeed(result);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            "Updates could not be loaded. Please try again or open the official source below.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load(true);
    const interval = window.setInterval(() => void load(), 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [key]);
  function choose(next: string) {
    setTopic(next);
    try {
      localStorage.setItem("si.updates.topic", next);
    } catch {
      /* Browsing still works without storage. */
    }
    history.replaceState(
      {},
      "",
      "/updates" + (next === "all" ? "" : "?topic=" + next),
    );
  }
  const sources = feed?.sources || [],
    matching = sources.filter((s) => topic === "all" || s.topic === topic);
  const guidance = matching.filter((s) => s.kind === "guidance"),
    publications = matching.filter((s) => s.kind === "publication");
  const events = (feed?.events || []).filter(
    (s) => topic === "all" || s.topic === topic,
  );
  const healthy = sources.filter(
    (s) => !["delayed", "unavailable", "withdrawn"].includes(s.status),
  ).length;
  const latest =
    sources
      .map((s) => s.last_success)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  return (
    <div className="immigration-page">
      <header className="updates-heading">
        <span className="eyebrow">KNOW WHAT CHANGES. KNOW YOUR NEXT STEP.</span>
        <h1>
          A little clarity.
          <br />A lot more confidence.
        </h1>
        <p>
          UK immigration updates, explained in everyday language.
          <br />
          Official sources. Clear dates. Room to breathe.
        </p>
      </header>
      <section className="updates-banner" aria-label="Update service status">
        <div className="updates-banner-icon">
          <Radio size={27} />
        </div>
        <div>
          <strong>Your UK immigration briefing</strong>
          <p>
            We check selected GOV.UK guidance and rule publications every 15
            minutes. Updates appear after the official source changes.
          </p>
        </div>
        <div className="updates-health">
          <span>
            {error
              ? "Connection interrupted"
              : sources.length
                ? `${healthy} of ${sources.length} sources checked recently`
                : busy
                  ? "Checking sources…"
                  : "First source check pending"}
          </span>
          <small>
            Latest successful check
            <br />
            {time(latest)}
          </small>
        </div>
      </section>
      <div
        className="updates-topics"
        role="group"
        aria-label="Filter immigration topics"
      >
        {Object.entries(topics).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={topic === id}
            className={topic === id ? "selected" : ""}
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="updates-filter-note">
        Your topic choice is remembered on this device. All explanations cover
        general rules; your own circumstances can change the answer.
      </p>
      {error && (
        <p className="career-error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setBusy(true);
              setKey((k) => k + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
      {busy && (
        <p className="updates-loading" role="status">
          <RefreshCw className="spin" size={18} /> Loading official updates…
        </p>
      )}
      {!busy && feed && (
        <>
          {!!guidance.length && (
            <section aria-labelledby="explained-heading">
              <div className="updates-section-title">
                <div>
                  <span className="eyebrow">THE RULES, MADE CLEARER</span>
                  <h2 id="explained-heading">What it means for you</h2>
                </div>
                <BookOpen size={24} />
              </div>
              <div className="explanation-grid">
                {guidance.map((s) => (
                  <article
                    className={
                      "explanation-card " +
                      (s.summary?.effective_date ? "featured-explanation" : "")
                    }
                    key={s.id}
                  >
                    <div className="explanation-top">
                      <span>{topics[s.topic]}</span>
                      <span className="explanation-state">
                        {s.summary
                          ? s.summary.effective_date &&
                            s.summary.effective_date <=
                              new Date().toISOString().slice(0, 10)
                            ? "Change in effect"
                            : s.summary.status
                          : "Check the official source"}
                      </span>
                    </div>
                    <h3>{s.summary?.title || s.title}</h3>
                    {s.summary && !error ? (
                      <>
                        <p className="explanation-audience">
                          For: {s.summary.audience}
                        </p>
                        {s.summary.effective_date && (
                          <div className="effective-date">
                            <Clock3 size={16} /> Change applies from{" "}
                            {date(s.summary.effective_date)}
                          </div>
                        )}
                        <ul>
                          {s.summary.points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                        <div className="next-step">
                          <strong>Your next step</strong>
                          <p>{s.summary.action}</p>
                        </div>
                        <p className="explanation-caveat">{s.summary.caveat}</p>
                      </>
                    ) : (
                      <p className="explanation-caveat">
                        {error
                          ? "The update service could not be reached. Open GOV.UK to confirm the current text."
                          : notices[s.status] ||
                            "Read the official source for the current wording."}
                      </p>
                    )}
                    <footer>
                      <a href={s.url} {...external}>
                        Read the GOV.UK guidance <ArrowUpRight size={15} />
                      </a>
                      <small>
                        Source checked {time(s.last_success)}
                        {s.summary && (
                          <>
                            {" "}
                            · Explanation prepared {date(s.summary.prepared_at)}
                          </>
                        )}
                      </small>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section
            className="updates-timeline"
            aria-labelledby="changes-heading"
          >
            <div className="updates-section-title">
              <div>
                <span className="eyebrow">THE CHANGE LOG</span>
                <h2 id="changes-heading">Since we started watching</h2>
              </div>
              <Clock3 size={24} />
            </div>
            {events.length ? (
              events.map((e) => (
                <article className="update-event" key={e.id}>
                  <span className="timeline-dot" />
                  <div>
                    <span className="update-event-label">
                      {e.kind === "changed"
                        ? "Official text changed"
                        : "Newly tracked publication"}{" "}
                      · Detected {time(e.detected_at)}
                    </span>
                    <h3>
                      <a href={e.url} {...external}>
                        {e.title} <ArrowUpRight size={15} />
                      </a>
                    </h3>
                    <p>
                      {e.kind === "changed"
                        ? "The source changed after our previous check. Read the official wording; this may be a policy change or an editorial update."
                        : "Read the publication and its implementation section. Different provisions may take effect on different dates."}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="updates-empty">
                <CheckCircle2 size={22} />
                <div>
                  <strong>
                    {sources.length
                      ? "No new changes detected for this topic yet."
                      : "The first source check is being prepared."}
                  </strong>
                  <p>
                    Existing guidance is the starting point. We only add a
                    change here when a later check finds different official text
                    or a newly tracked publication.
                  </p>
                </div>
              </div>
            )}
          </section>
          {!!publications.length && (
            <section aria-labelledby="publications-heading">
              <div className="updates-section-title">
                <div>
                  <span className="eyebrow">FROM THE HOME OFFICE</span>
                  <h2 id="publications-heading">Recent rule publications</h2>
                </div>
              </div>
              <p className="updates-filter-note">
                Publication does not mean every provision is already in force.
                These documents have not yet been simplified; check their
                implementation dates.
              </p>
              <div className="publication-list">
                {publications.map((s) => (
                  <article key={s.id}>
                    <div>
                      <span className="update-event-label">
                        Official publication · Source date{" "}
                        {s.source_updated_at
                          ? date(s.source_updated_at)
                          : "not supplied"}
                      </span>
                      <h3>
                        <a href={s.url} {...external}>
                          {s.title} <ArrowUpRight size={17} />
                        </a>
                      </h3>
                      {notices[s.status] && <p>{notices[s.status]}</p>}
                    </div>
                    <small>Checked {time(s.last_success)}</small>
                  </article>
                ))}
              </div>
            </section>
          )}
          <details className="updates-sources">
            <summary>
              <ShieldCheck size={17} /> How we check this information
            </summary>
            <p>
              We compare the text returned by the GOV.UK Content API, keep a
              history of changes and check every 15 minutes. This is near real
              time, not instant coverage of every immigration announcement. PDF
              attachments are linked; their full text is not automatically
              interpreted.
            </p>
            <p>
              Plain-English explanations are tied to the exact official text
              used to prepare them. We hide them if that text changes, is
              withdrawn, or has not been checked successfully within an hour. A
              change in wording is not automatically a change in law.
            </p>
            <p>
              For decisions about your own case, read the full conditions and
              use an IAA-regulated adviser or another authorised immigration
              professional where needed.
            </p>
            {sources.map((s) => (
              <div className="source-health-row" key={s.id}>
                <a href={s.url} {...external}>
                  {s.title} <ArrowUpRight size={13} />
                </a>
                <span>
                  {s.error
                    ? "Check delayed"
                    : s.status === "withdrawn"
                      ? "Withdrawn"
                      : "Last successful check"}{" "}
                  · {time(s.last_success)}
                </span>
              </div>
            ))}
            <p>
              Public sector information is used under the{" "}
              <a
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                {...external}
              >
                Open Government Licence v3.0
              </a>
              , except where otherwise stated. Sponsor Intel is independent of
              the UK government.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
