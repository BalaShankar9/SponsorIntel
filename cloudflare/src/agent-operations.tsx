import React, { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  CirclePause,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import "./agent-operations.css";
import { AgentResearch } from './agent-research';

type Finding = {
  id: string;
  priority: string;
  title: string;
  fact: string;
  action: string;
};
type Run = {
  id: string;
  state: string;
  created_at: string;
  requests: number;
  summary: Record<string, number> | null;
};
type Source = {
  id: string;
  company: string;
  careers: string;
  count?: number;
  last_success?: string;
  error?: string;
  paused: boolean;
  cooldown_until: number;
  licence_linked: boolean;
  collection?: {total:number;ready:number;fetched:number;state:string;checked_at:string} | null;
};
type Snapshot = {
  measured_at: string;
  enabled: boolean;
  runs: Run[];
  tasks: {
    source_id: string;
    company: string;
    state: string;
    attempts: number;
    count: number;
    error_code: string | null;
    evidence?: {collection?:{total:number;ready:number;fetched:number;state:string;requests:number};feed_review?: {received:number;accepted:number;normalised?:number;excluded:{ref:string;reason:string;closing_date?:string}[]}} | null;
  }[];
  sources: Source[];
  reviews: {
    id: string;
    source_id: string;
    kind: string;
    evidence: { message: string };
    created_at: string;
  }[];
  budget: {
    day: string;
    requests: number;
    request_limit: number;
    briefs: number;
    brief_limit: number;
  };
  latest_brief: {
    created_at: string;
    output: { priorities: Finding[] };
  } | null;
};
const date = (v?: string) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not checked";
const label = (s: string) => s.replaceAll("_", " ");
async function api(path: string, body?: unknown) {
  const response = await fetch(
    "/api/admin/agents" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Agent operations could not load.");
  return data;
}

export function AgentOperations() {
  const [data, setData] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [change, setChange] = useState<Source | null>(null),
    [reason, setReason] = useState(""),
    [consent, setConsent] = useState(false);
  async function load() {
    try {
      setData(await api(""));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    api("")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const active = data?.runs.some((r) =>
    ["queued", "running"].includes(r.state),
  );
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => clearInterval(id);
  }, [active]);
  async function act(path: string, body: unknown) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api(path, body);
      setMessage(result.message);
      setChange(null);
      setReason("");
      await load();
    } catch (e) {
      setError((e as Error).message);
      try {
        setData(await api(""));
      } catch {
        /* Keep the last snapshot visible. */
      }
    } finally {
      setBusy(false);
    }
  }
  const latest = data?.runs[0],
    published = data?.tasks.filter((t) => t.state === "published").length || 0;
  return (
    <section className="agent-operations" aria-labelledby="agent-title">
      <div className="agent-heading">
        <div>
          <span className="eyebrow">YOUR OPERATING TEAM</span>
          <h2 id="agent-title">Agent operations</h2>
          <p>Every source check leaves evidence. You control what runs.</p>
        </div>
        <span className={"agent-pill " + (data?.enabled ? "good" : "")}>
          <Activity size={14} />
          {data?.enabled ? "Workflow connected" : "Checking connection"}
        </span>
      </div>
      {error && (
        <p className="career-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="agent-message" role="status">
          {message}
        </p>
      )}
      {!data && !error && <p role="status">Loading operational records…</p>}
      {data && (
        <>
          <AgentResearch />
          <div className="agent-actions">
            <button
              className="primary-button"
              disabled={busy || active || !data.enabled}
              onClick={() => void act("/run", {})}
            >
              <RefreshCw size={15} />
              {active ? "Source run in progress" : "Run source checks"}
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh status
            </button>
            <small>Checked {date(data.measured_at)}</small>
          </div>
          <div className="agent-metrics">
            <article>
              <strong>
                {published}
                <small> / {data.tasks.length}</small>
              </strong>
              <span>Sources published in latest run</span>
            </article>
            <article>
              <strong>{data.reviews.length}</strong>
              <span>
                Open quality findings
                {data.reviews.length === 50 ? " (latest 50)" : ""}
              </span>
            </article>
            <article>
              <strong>
                {data.budget.requests}
                <small> / {data.budget.request_limit}</small>
              </strong>
              <span>Feed request reservations today · UTC</span>
            </article>
            <article>
              <strong>{data.sources.filter((s) => s.paused).length}</strong>
              <span>Sources paused by you</span>
            </article>
          </div>
          <div className="agent-role-grid">
            {[
              [
                RefreshCw,
                "Collector",
                "Approved employer feeds; bounded retries and recovery.",
              ],
              [
                ShieldCheck,
                "Evidence verifier",
                "Checks advert wording; records current reviewed licence evidence.",
              ],
              [
                CheckCircle2,
                "Freshness & duplicates",
                "Checks repeated IDs and links; holds unexpected source drops.",
              ],
              [
                Bot,
                "AI coordinator",
                "Ranks recorded findings into a reviewable work list.",
              ],
            ].map(([Icon, title, text]: any) => (
              <article key={title}>
                <Icon size={19} />
                <h3>{title}</h3>
                <p>{text}</p>
                <small>
                  {title === "AI coordinator"
                    ? "On request · recommendations only"
                    : "Runs within the source workflow"}
                </small>
              </article>
            ))}
          </div>
          <div className="agent-columns">
            <div className="agent-panel">
              <h3>Coordinator priorities</h3>
              <p>
                Send source-health findings to Cloudflare AI to decide what
                deserves attention first. No CVs, account details or feedback
                messages are included.
              </p>
              <label className="agent-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Use Cloudflare AI for this operational brief.
              </label>
              <button
                className="secondary-button"
                disabled={
                  busy ||
                  !consent ||
                  data.budget.briefs >= data.budget.brief_limit
                }
                onClick={() => void act("/brief", { consent: true })}
              >
                <Bot size={15} />
                Prepare priorities
              </button>
              <small className="agent-allowance">
                {data.budget.briefs} of {data.budget.brief_limit} attempts
                today. Failed attempts count.
              </small>
              {data.latest_brief ? (
                <>
                  <p className="fine-print">
                    Based on findings saved {date(data.latest_brief.created_at)}
                    . Suggestions are not automatically executed.
                  </p>
                  <ol className="agent-priorities">
                    {data.latest_brief.output.priorities.map((f) => (
                      <li key={f.id}>
                        <strong>{f.title}</strong>
                        <p>{f.fact}</p>
                        <small>{f.action}</small>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="fine-print">
                  No AI brief has been generated yet.
                </p>
              )}
            </div>
            <div className="agent-panel">
              <h3>Quality review</h3>
              <p>
                A held batch leaves the previous successful snapshot in place.
                Existing freshness limits still apply.
              </p>
              {data.reviews.length ? (
                data.reviews.map((r) => (
                  <article className="agent-finding" key={r.id}>
                    <strong>
                      {data.sources.find((s) => s.id === r.source_id)
                        ?.company || r.source_id}
                    </strong>
                    <p>{r.evidence.message}</p>
                    <small>{date(r.created_at)}</small>
                  </article>
                ))
              ) : (
                <div className="agent-empty">
                  <ShieldCheck size={26} />
                  <strong>No open quality findings</strong>
                  <p>
                    This means no automated holds are open. It does not
                    establish that every advert is accurate.
                  </p>
                </div>
              )}
              <div className="agent-next">
                <strong>LinkedIn provider · access needed</strong>
                <p>
                  The Techmap pilot remains disconnected. Subscription rights
                  and a reviewed UK sample are required before publication.
                </p>
              </div>
            </div>
          </div>
          <details className="agent-panel" open>
            <summary>
              Latest run {latest ? "· " + label(latest.state) : "· no run yet"}
            </summary>
            {latest && (
              <>
                <p className="fine-print">
                  Started {date(latest.created_at)} · {latest.requests} request
                  reservations · {latest.id}
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Employer</th>
                        <th>Result</th>
                        <th>Attempts</th>
                        <th>Published roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tasks.map((t) => (
                        <tr key={t.source_id}>
                          <td>{t.company}</td>
                          <td>
                            <span
                              className={
                                "agent-pill " +
                                (t.state === "published" ? "good" : "")
                              }
                            >
                              {t.error_code === 'details_pending' ? 'Gathering descriptions' : label(t.state)}
                            </span>
                            {t.evidence?.collection && <small>{t.evidence.collection.ready} of {t.evidence.collection.total} descriptions ready · {t.evidence.collection.fetched} checked this pass. {t.error_code === 'details_pending' ? 'Continues on the next scheduled refresh; nothing partially published.' : 'Complete catalogue checked before publication.'}</small>}
                            {t.error_code && t.error_code !== 'details_pending' && (
                              <small>{label(t.error_code)}</small>
                            )}
                          </td>
                          <td>{t.attempts} / 3</td>
                          <td>{t.state === "published" ? t.count : "—"}
                            {t.evidence?.feed_review&&<details><summary>Source screening</summary><p>{t.evidence.feed_review.received} feed entries; {t.evidence.feed_review.excluded.length} excluded before publication.</p>{t.evidence.feed_review.excluded.length>0&&<ul>{t.evidence.feed_review.excluded.map(e=><li key={e.ref}>{e.ref}: {label(e.reason)}{e.closing_date?' ('+e.closing_date+')':''}</li>)}</ul>}<p className="fine-print">An unreviewed distribution marker means we need clarification; it does not prove the role is closed or internal.</p></details>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void act("/reconcile", { run_id: latest.id })}
                >
                  Check execution status
                </button>
                {["queued", "running"].includes(latest.state) &&
                  Date.now() - Date.parse(latest.created_at) > 10 * 60000 && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        void act("/recover", { run_id: latest.id })
                      }
                    >
                      Recover interrupted run
                    </button>
                  )}
              </>
            )}
          </details>
          <details className="agent-panel">
            <summary>
              Source controls · {data.sources.length} approved feeds
            </summary>
            <p>
              Pause hides this source’s vacancies. Resume allows the next
              successful refresh to bring them back. Three failed fetches
              trigger a six-hour cooldown.
            </p>
            {change && (
              <form
                className="agent-source-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("/source", {
                    source_id: change.id,
                    paused: !change.paused,
                    reason,
                  });
                }}
              >
                <strong>
                  {change.paused ? "Resume" : "Pause"} {change.company}
                </strong>
                <label>
                  Reason
                  <input
                    required
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="agent-actions">
                  <button className="primary-button" disabled={busy}>
                    Save change
                  </button>
                  <button type="button" onClick={() => setChange(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {data.sources.map((s) => (
              <div className="agent-source" key={s.id}>
                <div>
                  <a href={s.careers} target="_blank" rel="noreferrer">
                    {s.company}
                  </a>
                  {s.collection?.state==='collecting'&&<small>Gathering descriptions: {s.collection.ready} / {s.collection.total}. Next scheduled pass continues the collection.</small>}
                  <small>
                    {s.paused
                      ? "Paused"
                      : s.cooldown_until > Date.now()
                        ? "Cooling down until " +
                          date(new Date(s.cooldown_until).toISOString())
                        : "Last successful check " + date(s.last_success)}{" "}
                    ·{" "}
                    {s.licence_linked
                      ? "Reviewed licence link"
                      : "Licence link unconfirmed"}
                  </small>
                </div>
                <div className="agent-actions">
                  <button
                    disabled={busy || active || s.paused}
                    onClick={() => void act("/run", { source_id: s.id })}
                  >
                    Check source
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setChange(s);
                      setReason("");
                    }}
                  >
                    <CirclePause size={14} />
                    {s.paused ? "Resume" : "Pause"}
                  </button>
                </div>
              </div>
            ))}
          </details>
          <details className="agent-panel">
            <summary>Recent run history</summary>
            {data.runs.map((r) => (
              <div className="agent-source" key={r.id}>
                <div>
                  <strong>{label(r.state)}</strong>
                  <small>
                    {date(r.created_at)} · {r.requests} request reservations
                  </small>
                </div>
                <span>
                  {r.summary
                    ? Object.entries(r.summary)
                        .map(([k, v]) => `${v} ${label(k)}`)
                        .join(" · ")
                    : "Awaiting completion"}
                </span>
              </div>
            ))}
          </details>
          <p className="fine-print">
            New sourcing research, immigration editing, application-quality
            evaluation and growth agents remain in the build plan. These
            operational records do not claim those agents are running.
          </p>
        </>
      )}
    </section>
  );
}
