import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Users,
  Activity,
  BriefcaseBusiness,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useCareer } from "./career-data";
import { AgentOperations } from './agent-operations';
import {JobReviews} from './job-reviews';
import { DiscoveryDesk } from './discovery-desk';
import { BusinessOperations } from './business-operations';
import { SearchPerformance } from './search-performance';
import "./platform.css";
import { CampaignAnalytics } from './campaign-analytics';
import {MarketingDesk} from './marketing-desk';
import {SupportDesk} from './support-desk';
import {ApplicationEvaluation} from './application-evaluation';
type Go = (view: string) => void;
async function api(path: string, body?: unknown) {
  const r = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Please try again.");
  return data;
}
const date = (value: string | number | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No record";
const number = (value: number = 0) => value.toLocaleString("en-GB");
export function OwnerDashboard({ go }: { go: Go }) {
  const { user, ready } = useCareer();
  const [data, setData] = useState<any>(null),
    [days, setDays] = useState(30),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [form, setForm] = useState({
    company: "",
    provider: "greenhouse",
    board: "",
    careers: "",
    sector: "technology",
    sponsor_id: "",
    evidence: "",
    school_urn: "",
    school_slug: "",
  });
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await api(`/api/admin/dashboard?days=${days}&page=${page}`));
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (user) void load();
  }, [user?.id, days, page]);
  async function act(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/admin/boards", body);
      setMessage(result.message);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshStudents() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/admin/refresh-students", {});
      setMessage(
        result.error ||
          `Student register refreshed: ${number(result.total)} provider records.`,
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return <section className="career-panel">Checking your account…</section>;
  if (!user)
    return (
      <section className="platform-hero">
        <span className="eyebrow">PRIVATE OWNER SPACE</span>
        <h1>Your product, in view.</h1>
        <p>
          Sign in with the owner account to see usage, users, feedback and data
          freshness.
        </p>
        <button className="primary-button" onClick={() => go("signin")}>
          Sign in <ArrowRight size={16} />
        </button>
      </section>
    );
  const metrics: any[] = data?.metrics || [],
    sum = (event: string) =>
      metrics.filter((m) => m.event === event).reduce((n, m) => n + m.count, 0);
  const views = metrics.filter((m) => m.event === "page_view");
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      day,
      count: views
        .filter((m) => m.day === day)
        .reduce((n, m) => n + m.count, 0),
    };
  });
  const peak = Math.max(1, ...daily.map((x) => x.count));
  const routes: Record<string, number> = {};
  views.forEach((m) => {
    routes[m.dimension] = (routes[m.dimension] || 0) + m.count;
  });
  return (
    <div className="platform owner-dashboard">
      <section className="platform-hero compact">
        <span className="eyebrow">OWNER DASHBOARD</span>
        <h1>Know what’s working.</h1>
        <p>
          Real usage, people and source checks. Private to your owner account.
        </p>
        <div className="platform-actions">
          <label>
            Period{" "}
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button
            className="secondary-button"
            onClick={() => void load()}
            disabled={busy}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </section>
      {error && (
        <p className="career-error" role="alert">
          {error}
        </p>
      )}
      {busy && !data && <p role="status">Loading your dashboard…</p>}
      {data && (
        <>
          <BusinessOperations />
          <SearchPerformance />
          <MarketingDesk />
          <AgentOperations />
          <DiscoveryDesk />
          <JobReviews />
          <CampaignAnalytics data={data.campaigns} />
          <p className="fine-print">
            Checked {date(data.measured_at)} · New measurement baseline enabled {date(data.measurement?.enabled_at)}.
            Signed-in owners and declared test requests are excluded. Earlier dates have no comparable data; today is partial.
            Daily totals use UTC; timestamps use your local time. Earliest retained eligible activity:{" "}
            {data.tracking_started || "none yet"} (90-day retention).
          </p>
          <details className="career-panel"><summary>Earlier mixed activity — historical only</summary><p>These older totals for the selected period include owner testing. They have been preserved separately and are excluded from new growth decisions. They cannot be retroactively separated into customers and operators.</p><p>{data.legacy_metrics?.filter((m:any)=>!m.event.startsWith('campaign_')).map((m:any)=>`${m.event.replaceAll('_',' ')}: ${number(m.count)}`).join(' · ') || 'No earlier activity retained in this period.'}</p></details>
          <div className="platform-stats">
            {[
              [Users, "Non-owner accounts", data.users.members],
              [Activity, "Page views", sum("page_view")],
              [
                BriefcaseBusiness,
                "CVs & cover letters prepared",
                sum("document_prepared"),
              ],
              [MessageSquare, "Sourced guidance replies", sum("guidance_answer")],
            ].map(([Icon, label, value]: any) => (
              <article key={label}>
                <Icon size={20} />
                <strong>{number(value)}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <div className="platform-grid">
            <section className="career-panel">
              <h2>Page activity</h2>
              <p className="fine-print">
                Aggregated page opens, including repeat visits, signed-out operators and possible bots.
                No visitor IDs, analytics cookies, search terms or CV content are stored.
                Prepared documents count successful responses, not saved files, submitted applications or outcomes.
              </p>
              <div
                className="usage-bars"
                role="img"
                aria-label={`${sum("page_view")} page views in ${days} days`}
              >
                {daily.map((d) => (
                  <div key={d.day} title={data.measurement?.enabled_at && d.day < data.measurement.enabled_at.slice(0,10) ? `${d.day}: before the new baseline` : `${d.day}: ${d.count}${d.day===data.measurement?.enabled_at?.slice(0,10)?" (partial starting day)":""}`}>
                    <i
                      style={{
                        height: `${Math.max(2, (d.count / peak) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="bar-dates">
                <span>{daily[0].day}</span>
                <span>Today</span>
              </div>
              <div className="metric-list">
                {Object.entries(routes)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([route, count]) => (
                    <p key={route}>
                      <span>{route}</span>
                      <strong>{number(count)}</strong>
                    </p>
                  ))}
                {!views.length && <p>No page activity recorded yet.</p>}
              </div>
            </section>
            <section className="career-panel">
              <h2>Your community</h2>
              <div className="metric-list">
                <p>
                  <span>New non-owner accounts in period</span>
                  <strong>{data.users.new_users}</strong>
                </p>
                <p>
                  <span>Non-owner accounts with a current session used in period</span>
                  <strong>{data.users.active_sessions}</strong>
                </p>
                <p>
                  <span>Successful sign-ins</span>
                  <strong>{sum("sign_in")}</strong>
                </p>
                <p>
                  <span>Evidence reviews, research & preparation plans</span>
                  <strong>{sum("preparation_completed")}</strong>
                </p>
                <p>
                  <span>Guidance clarifications or insufficient evidence</span>
                  <strong>{sum("guidance_followup")}</strong>
                </p>
                <p>
                  <span>Feedback submissions</span>
                  <strong>{sum("feedback_sent")}</strong>
                </p>
                <p>
                  <span>Current vacancies</span>
                  <strong>{number(data.jobs.total)}</strong>
                </p>
                <p>
                  <span>Adverts with positive / conditional wording</span>
                  <strong>{number(data.jobs.sponsorship)}</strong>
                </p>
              </div>
              <p className="fine-print">
                Session activity is updated at most once a day. Generations count successful responses; they
                do not measure application quality or job outcomes.
              </p>
            </section>
          </div>
          <section className="career-panel">
            <h2>Registered users</h2>
            <p>
              Account details and activity only. This dashboard does not expose
              anyone’s CV, application notes or generated documents.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Last session update</th>
                    <th>Workspace saved</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.items.map((u: any) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>
                        {u.email}
                        <small>{u.emailVerified ? 'Verified email' : 'Email awaiting verification'}</small>
                      </td>
                      <td>{date(u.createdAt)}</td>
                      <td>{date(u.last_session)}</td>
                      <td>{date(u.workspace_updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.users.items.length && <p>No registered users yet.</p>}
            <div className="platform-actions">
              <button
                disabled={page === 1 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={page * 25 >= data.users.total || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
          <section className="career-panel">
            <h2>Data freshness</h2>
            <p>
              The sponsor register checks daily; employer boards every six
              hours; selected immigration sources every 15 minutes. Failed
              fetches keep their last successful data and show an error. Job
              discovery hides vacancies unchecked for three days.
            </p>
            <div className="source-status">
              <strong>Sponsor register</strong>
              <span>{date(data.metadata.register?.checked_at)}</span>
              <span
                className={
                  data.metadata.register?.refresh_error
                    ? "status-bad"
                    : "status-good"
                }
              >
                {data.metadata.register?.refresh_error ||
                  "Last check succeeded"}
              </span>
            </div>
            <div className="source-status">
              <strong>
                Student sponsor register ·{" "}
                {number(data.metadata.students?.total)} records
              </strong>
              <span>
                Last success: {date(data.metadata.students?.last_success)}
              </span>
              <span
                className={
                  data.metadata.students?.refresh_error ||
                  !data.metadata.students?.snapshot
                    ? "status-bad"
                    : "status-good"
                }
              >
                {data.metadata.students?.refresh_error ||
                  (data.metadata.students?.snapshot
                    ? `Source ${data.metadata.students.source_date}`
                    : "Awaiting first import")}
              </span>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void refreshStudents()}
              >
                Check student register
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Employer board</th>
                    <th>Vacancies</th>
                    <th>Last success</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.job_sources.map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        <a
                          href={s.careers_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.company} ↗
                        </a>
                      </td>
                      <td>{s.count}</td>
                      <td>{date(s.last_success)}</td>
                      <td
                        className={
                          s.error ||
                          !s.last_success ||
                          Date.now() - Date.parse(s.last_success) > 24 * 3600000
                            ? "status-bad"
                            : "status-good"
                        }
                      >
                        {s.error ||
                          (!s.last_success
                            ? "Awaiting first import"
                            : Date.now() - Date.parse(s.last_success) >
                                24 * 3600000
                              ? "Check overdue"
                              : "Current")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>Immigration source checks</summary>
              {data.immigration_sources.map((s: any) => (
                <div className="source-status" key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                  <span>{date(s.last_success)}</span>
                  <strong
                    className={
                      s.error || s.withdrawn ? "status-bad" : "status-good"
                    }
                  >
                    {s.withdrawn
                      ? "Withdrawn"
                      : s.error || "Last check succeeded"}
                  </strong>
                </div>
              ))}
            </details>
            <details>
              <summary>Recent employer refresh history</summary>
              {data.runs.length ? (
                data.runs.map((s: any, i: number) => (
                  <div className="source-status" key={i}>
                    <span>{s.source_id}</span>
                    <span>{date(s.checked_at)}</span>
                    <strong
                      className={s.success ? "status-good" : "status-bad"}
                    >
                      {s.success ? `${s.count} UK roles` : "Refresh failed"}
                    </strong>
                  </div>
                ))
              ) : (
                <p>
                  History starts with this release. The next scheduled import
                  will add results.
                </p>
              )}
            </details>
          </section>
          <section className="career-panel">
            <h2>Add a reliable employer feed</h2>
            <p>
              Find the employer’s official careers page, follow its Greenhouse,
              Lever or Ashby board, or its DfE Teaching Vacancies school page, and match the legal entity in the sponsor
              register. A licence alone does not mean every role offers
              sponsorship.
            </p>
            <details>
              <summary>Add an employer for review</summary>
              <form
                className="platform-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act({ action: "add", ...form, ...(form.provider==='teaching-vacancies'?{board:form.school_urn+'--'+form.school_slug}: {}) });
                }}
              >
                {[
                  ["company", "Employer name"],
                  ["careers", "Official careers URL"],
                  [
                    "board",
                    "Job-board name (from its Greenhouse, Lever or Ashby link)",
                  ],
                ].filter(([k])=>k!=="board"||form.provider!=="teaching-vacancies").map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      required={k!=='board'||form.provider!=='teaching-vacancies'}
                      disabled={k==='board'&&form.provider==='teaching-vacancies'}
                      value={(form as any)[k]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [k]: e.target.value }))
                      }
                    />
                  </label>
                ))}
                <SponsorPicker
                  onPick={(id) => setForm((f) => ({ ...f, sponsor_id: id }))}
                />
                <label>
                  Board provider
                  <select
                    value={form.provider}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, provider: e.target.value, ...(e.target.value==='teaching-vacancies'?{sector:'education'}:{}) }))
                    }
                  >
                    {["greenhouse", "lever", "ashby", "teaching-vacancies"].map((x) => (
                      <option key={x} value={x}>{x==='teaching-vacancies'?'DfE Teaching Vacancies (one school)':x}</option>
                    ))}
                  </select>
                </label>
                {form.provider==='teaching-vacancies'&&<><label>School URN (six-digit official school identifier)<input required pattern="[0-9]{6}" maxLength={6} value={form.school_urn} onChange={e=>setForm(f=>({...f,school_urn:e.target.value}))}/></label><label>School name in the Teaching Vacancies link<input required maxLength={72} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="For example, king-s-lynn-academy" value={form.school_slug} onChange={e=>setForm(f=>({...f,school_slug:e.target.value}))}/></label><p className="fine-print">Use the school’s exact display name above. Review its legal employer or academy trust separately against the sponsor register. A different school, trust-wide feed or unidentified employer will be held. Up to 20 adverts per school; all original adverts and the complete list must pass before publication.</p></>}
                <label>
                  Employer sector
                  <select
                    value={form.sector}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sector: e.target.value }))
                    }
                  >
                    {Object.entries({
                      technology: "Technology",
                      finance: "Finance",
                      engineering: "Engineering",
                      healthcare: "Healthcare",
                      energy: "Energy",
                      education: "Education",
                      commerce: "Commerce",
                    }).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Evidence: legal-name match and how the official careers page
                  links to this board
                  <textarea
                    required
                    minLength={30}
                    maxLength={1200}
                    value={form.evidence}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, evidence: e.target.value }))
                    }
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={busy || !form.sponsor_id}
                >
                  Add to review
                </button>
              </form>
            </details>
            {message && (
              <p role="status" className="career-notice">
                {message}
              </p>
            )}
            {data.boards.map((b: any) => (
              <SourceReview key={b.id} board={b} busy={busy} act={act} />
            ))}
            <p className="fine-print">
              New sources require explicit owner approval and a successful feed
              probe. Approved boards join the next six-hour import. Pausing a
              board removes its vacancies from discovery. Review sponsorship
              wording on each advert.
            </p>
          </section>
          <ApplicationEvaluation />
          <SupportDesk />
        </>
      )}
    </div>
  );
}
function SourceReview({
  board: b,
  busy,
  act,
}: {
  board: any;
  busy: boolean;
  act: (body: unknown) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <article className="source-review">
      <h3>
        {b.company} <span className="tag">{b.state}</span>
      </h3>
      <a href={b.careers} target="_blank" rel="noreferrer">
        Official careers page <ExternalLink size={13} />
      </a>
      <p>{b.evidence}</p>
      <small>
        {b.provider} / {b.board}
      </small>
      {b.state !== "approved" && (
        <label className="check-line">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I checked the official careers link and matched the legal sponsor
          entity.
        </label>
      )}
      <div className="platform-actions">
        {b.state !== "approved" && (
          <button
            className="primary-button"
            disabled={!confirmed || busy}
            onClick={() => void act({ action: "approve", id: b.id, confirmed })}
          >
            Probe & approve
          </button>
        )}
        {b.state !== "paused" && (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void act({ action: "pause", id: b.id })}
          >
            Pause source
          </button>
        )}
      </div>
    </article>
  );
}

function SponsorPicker({ onPick }: { onPick: (id: string) => void }) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2 || selected) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        "/api/sponsors?" +
          new URLSearchParams({ q: query, route: "Skilled Worker" }),
        { signal: controller.signal },
      )
        .then(async (r) => {
          if (!r.ok) throw Error("Search unavailable");
          const d = await r.json();
          setItems(d.items || []);
          setError("");
        })
        .catch((e) => {
          if (e.name !== "AbortError")
            setError("The register search is unavailable. Try again shortly.");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);
  return (
    <div className="wide">
      <label>
        Match the legal employer on the current Skilled Worker register
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected("");
            onPick("");
          }}
          placeholder="Search the registered legal name"
        />
      </label>
      {selected && <p className="status-good">Selected: {selected}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="sponsor-picker">
        {items.map((s) => (
          <button
            type="button"
            key={s.id}
            onClick={() => {
              setSelected(s.name + " · " + s.city);
              setQuery(s.name);
              setItems([]);
              onPick(s.id);
            }}
          >
            {s.name}
            <small>
              {s.city} · {s.routes.join(", ")}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
