import React, { useEffect, useRef, useState } from "react";
import { JobDetail } from "./job-detail";
import { AccountEmailHelp } from "./account-email";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  CalendarDays,
  LogIn,
  LogOut,
  Copy,
} from "lucide-react";
import {
  useCareer,
  request,
  download,
  emptyData,
  mergeData,
  EMPTY_PROFILE,
  stages,
  sponsorLabels,
  day,
  stamp,
  followupDate,
  followupDraft,
  type CareerApplication,
  type CareerData,
  type Job,
} from "./career-data";
import {
  importCV,
  exportDocument,
  exportJSONResume,
  exportCalendar,
} from "./documents";
import "./career.css";
import { type ReportFeedback } from "./feedback";
import { buildEvidenceReview } from "../worker/career-evidence.js";
import { draftWarnings, sourceWarnings } from "../worker/career-quality.js";
const external = { target: "_blank", rel: "noopener noreferrer" };
type Go = (view: string) => void;

function Title({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="career-heading">
      <div>
        <p className="eyebrow">{label}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="career-dialog"
      ref={ref}
      onCancel={close}
      aria-label={title}
    >
      <button
        className="icon-button career-close"
        aria-label="Close dialog"
        onClick={close}
      >
        <X />
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
function Empty({
  title,
  text,
  action,
  label,
}: {
  title: string;
  text: string;
  action: () => void;
  label: string;
}) {
  return (
    <div className="career-empty">
      <span>
        <BriefcaseBusiness size={28} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary-button" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

export function CareerAccountLink({ go }: { go: Go }) {
  const { user, status } = useCareer();
  return (
    <button className="career-account-link" onClick={() => go("account")}>
      <Cloud size={17} />
      <span>
        <strong>{user?.name || "Your private workspace"}</strong>
        <small>{user ? status : "Sign in to save across devices"}</small>
      </span>
      <ChevronRight size={15} />
    </button>
  );
}
export function CareerWorkspace({
  mode,
  go,
  onReport,
}: {
  mode: string;
  go: Go;
  onReport: ReportFeedback;
}) {
  const c = useCareer();
  const roleId = mode.match(/^jobs\/([a-f0-9]{24})$/)?.[1];
  if (
    !c.ready &&
    !["account", "signin", "signup", "jobs"].includes(mode) &&
    !roleId
  )
    return (
      <div className="career career-panel">
        <h2>Opening your workspace…</h2>
        <p>{c.error || "Loading your saved work."}</p>
        {c.error && (
          <button className="secondary-button" onClick={() => void c.reload()}>
            Try again
          </button>
        )}
      </div>
    );
  return (
    <div className="career">
      <div className="career-status">
        <span>
          <span className={"status-dot " + (c.user ? "online" : "")} />
          {c.status}
        </span>
        <button onClick={() => go("account")}>
          {c.user ? "Account & backup" : "Sign in for cloud sync"}
          <ArrowRight size={13} />
        </button>
      </div>
      {c.error && (
        <div role="alert" className="career-error">
          {c.error}
          <button onClick={() => c.setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {roleId ? (
        <JobDetail key={roleId} id={roleId} go={go} onReport={onReport} />
      ) : mode === "jobs" ? (
        <Vacancies go={go} />
      ) : mode === "applications" ? (
        <Applications go={go} />
      ) : mode === "studio" ? (
        <Studio go={go} />
      ) : mode === "career-profile" ? (
        <Profile go={go} />
      ) : (
        <Account
          key={mode}
          go={go}
          initialMode={mode === "signin" ? "signin" : "signup"}
        />
      )}
    </div>
  );
}

function Vacancies({ go }: { go: Go }) {
  const c = useCareer();
  const params = new URLSearchParams(
    typeof location === "undefined" ? "" : location.search,
  );
  const [q, setQ] = useState(params.get("q") || ""),
    [city, setCity] = useState(params.get("location") || ""),
    [sponsorship, setSponsorship] = useState(params.get("sponsorship") || ""),
    [level, setLevel] = useState(params.get("level") || ""),
    [salary, setSalary] = useState(params.get("salary") || ""),
    [sector, setSector] = useState(params.get("sector") || ""),
    [licence, setLicence] = useState(params.get("licence") === "matched" ? "matched" : ""),
    [page, setPage] = useState(
      Math.max(1, parseInt(params.get("page") || "1") || 1),
    ),
    [key, setKey] = useState(0);
  const [applied, setApplied] = useState({
    q,
    location: city,
    sponsorship,
    level,
    salary,
    sector,
    licence,
  });
  const [result, setResult] = useState<{
      items: Job[];
      total: number;
      catalog_total: number;
      pages: number;
      page: number;
      sources: any[];
      collections: {
        total: number;
        employers: number;
        early_career: number;
        sponsorship: number;
        licensed: number;
        salary: number;
      };
      sectors: Record<string, string>;
      licence_register: { available: boolean; source_date: string | null; checked_at: string | null };
    } | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function applyFilters(
    next = { q, location: city, sponsorship, level, salary, sector, licence },
  ) {
    setQ(next.q);
    setCity(next.location);
    setSponsorship(next.sponsorship);
    setLevel(next.level);
    setSalary(next.salary);
    setSector(next.sector);
    setLicence(next.licence);
    setPage(1);
    setApplied(next);
    const p = new URLSearchParams(
      Object.entries(next).filter(([, value]) => value),
    );
    history.replaceState({}, "", "/jobs?" + p);
  }
  function search(e?: React.FormEvent) {
    e?.preventDefault();
    applyFilters();
  }
  function changePage(next: number) {
    setPage(next);
    const p = new URLSearchParams(
      Object.entries(applied).filter(([, value]) => value),
    );
    if (next > 1) p.set("page", String(next));
    history.replaceState({}, "", "/jobs" + (p.size ? "?" + p : ""));
  }
  function collection(kind: string) {
    applyFilters({
      q: "",
      location: "",
      sponsorship: kind === "sponsorship" ? "mentioned" : "",
      level: kind === "early_career" ? "early_career" : "",
      salary: kind === "salary" ? "listed" : "",
      sector: "",
      licence: kind === "licensed" ? "matched" : "",
    });
  }
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    request(
      "/api/jobs?" +
        new URLSearchParams({
          ...applied,
          page: String(page),
        }),
    )
      .then((d) => {
        if (alive) {
          setResult(d);
          if (d.page !== page) changePage(d.page);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key, page, applied]);
  function saveSearch() {
    if (!c.ready) return;
    if (c.data.searches.length >= 10) {
      setMessage(
        "You have ten saved searches. Remove one in My applications to add another.",
      );
      return;
    }
    if (
      c.data.searches.some(
        (s) =>
          s.q === applied.q &&
          s.location === applied.location &&
          s.sponsorship === applied.sponsorship &&
          s.level === applied.level &&
          (s.salary || "") === applied.salary &&
          (s.sector || "") === applied.sector &&
          (s.licence || "") === applied.licence,
      )
    ) {
      setMessage("This search is already saved.");
      return;
    }
    c.setData((d) => ({
      ...d,
      searches: [
        ...d.searches,
        {
          id: crypto.randomUUID(),
          ...applied,
          createdAt: stamp(),
        },
      ],
    }));
    setMessage(
      "Search saved. Revisit it from My applications for fresh results.",
    );
  }
  return (
    <>
      <Title
        label="FIND YOUR NEXT CHAPTER"
        title="Good work. Real possibilities."
        description="Explore UK vacancies, see the sponsorship wording and prepare an application that sounds like you."
      />
      <div className="jobs-hero">
        <div>
          <span className="career-pill">
            <span className="status-dot online" />
            EMPLOYER JOB BOARDS
          </span>
          <h2>
            A role worth
            <br />
            your next step.
          </h2>
          <p>
            Fresh opportunities. Clear sources.
            <br />
            Your career, with a little more clarity.
          </p>
        </div>
        <div className="jobs-hero-note">
          <BriefcaseBusiness size={30} />
          <strong>{result?.catalog_total?.toLocaleString() || "—"}</strong>
          <span>UK roles in this collection</span>
          <small>
            {result?.collections?.employers || "—"} employers with UK vacancies
            · Checked every six hours
          </small>
        </div>
      </div>
      <section
        className="opportunity-collections"
        aria-label="Explore opportunity collections"
      >
        {[
          {
            id: "all",
            title: "All opportunities",
            note: "Explore the full collection",
            count: result?.catalog_total,
            icon: BriefcaseBusiness,
          },
          {
            id: "sponsorship",
            title: "Sponsorship mentioned",
            note: "Stated or conditional in the advert",
            count: result?.collections?.sponsorship,
            icon: ShieldCheck,
          },
          {
            id: "early_career",
            title: "Your first career step",
            note: "Graduate, junior & internship titles",
            count: result?.collections?.early_career,
            icon: GraduationCap,
          },
          {
            id: "licensed",
            title: "Licensed employers",
            note: "Companies linked to sponsor records",
            count: result?.collections?.licensed,
            icon: ShieldCheck,
          },
        ].map(({ id, title, note, count, icon: Icon }) => {
          const active = !applied.q && !applied.location && !applied.sector && !applied.salary &&
            applied.sponsorship === (id === "sponsorship" ? "mentioned" : "") &&
            applied.level === (id === "early_career" ? "early_career" : "") &&
            applied.licence === (id === "licensed" ? "matched" : "");
          return (
            <button
              key={id}
              className={"opportunity-collection" + (active ? " selected" : "")}
              aria-pressed={active}
              onClick={() => collection(id)}
            >
              <span className="collection-top">
                <Icon size={21} />
                <strong>{count?.toLocaleString() ?? "—"}</strong>
              </span>
              <span className="collection-title">{title}</span>
              <small>{note}</small>
            </button>
          );
        })}
      </section>
      <form className="job-search-form" onSubmit={search}>
        <label>
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Role, skill or employer"
            aria-label="Search vacancies"
            maxLength={150}
          />
        </label>
        <label>
          <MapPin size={18} />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City or UK location"
            aria-label="Job location"
            maxLength={80}
          />
        </label>
        <button className="primary-button" type="submit">
          Find roles
          <ArrowRight size={16} />
        </button>
      </form>
      <div className="job-filter-row">
        <label>
          Employer licence
          <select value={licence} onChange={(e) => setLicence(e.target.value)}>
            <option value="">All employers</option>
            <option value="matched">Linked to a Skilled Worker licence</option>
          </select>
        </label>
        <label>
          Sponsorship
          <select
            value={sponsorship}
            onChange={(e) => setSponsorship(e.target.value)}
          >
            <option value="">All adverts</option>
            <option value="mentioned">Stated or conditional</option>
            {Object.entries(sponsorLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Career stage
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All career stages</option>
            <option value="early_career">Graduate, junior & internships</option>
          </select>
        </label>
        <label>
          Employer sector
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All employer sectors</option>
            {Object.entries(result?.sectors || {}).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Advertised pay
          <select value={salary} onChange={(e) => setSalary(e.target.value)}>
            <option value="">All adverts</option>
            <option value="listed">GBP pay mentioned</option>
          </select>
        </label>
        <button className="secondary-button" onClick={() => search()}>
          Apply filters
        </button>
        <button
          className="text-button"
          onClick={saveSearch}
          disabled={!c.ready}
        >
          <Bookmark size={15} />
          Save search
        </button>
      </div>
      {Object.values(applied).some(Boolean) && (
        <button
          className="text-button clear-job-filters"
          onClick={() => collection("all")}
        >
          <X size={15} /> Clear all filters
        </button>
      )}
      {message && (
        <p className="career-notice" role="status">
          {message}
        </p>
      )}
      <div className="jobs-explainer">
        <ShieldCheck size={18} />
        <p>
          <strong>
            A sponsor licence and a sponsored vacancy are different.
          </strong>{" "}
          Labels below describe the advert’s wording. “Not stated” means the
          employer has not confirmed it in the text we checked. Early-career
          titles do not confirm student-visa eligibility. Employer sectors
          describe the company’s industry.
          {" "}“Employer licence linked” means we reviewed a connection to a
          company on the worker register. A group’s licence may belong to a
          different legal entity from the one hiring for a specific role.
        </p>
      </div>
      {result?.licence_register?.available === false && (
        <p className="career-notice" role="status">
          Employer licence checks need a fresh register update. Licence links
          are temporarily hidden; this does not mean these employers are unlicensed.
        </p>
      )}
      <div className="section-header">
        <h2>
          {loading
            ? "Finding roles…"
            : error
              ? "Roles could not be loaded"
              : `${result?.total || 0} matching roles`}
        </h2>
        <span>Newest added first · Employer boards</span>
      </div>
      {error && (
        <p className="career-error" role="alert">
          {error}
          <button onClick={() => setKey((k) => k + 1)}>Retry</button>
        </p>
      )}
      {loading ? (
        <div className="vacancy-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="job-skeleton" key={i} />
          ))}
        </div>
      ) : !error && result?.items.length ? (
        <div className="vacancy-grid">
          {result.items.map((j) => (
            <article className="vacancy-card" key={j.id}>
              <div className="vacancy-top">
                <span className="company-initial">
                  {j.company.slice(0, 2).toUpperCase()}
                </span>
                <span>{j.company}</span>
                {c.data.applications.some((a) => a.jobId === j.id) && (
                  <CheckCircle2 size={18} aria-label="Saved to applications" />
                )}
              </div>
              <a className="vacancy-title" href={"/jobs/" + j.id}>
                {j.title}
              </a>
              <p className="location">
                <MapPin size={14} />
                {j.location}
              </p>
              <div className="job-quality-meta">
                {j.employer_licence && (
                  <span className="employer-licence-tag" title={`${j.employer_licence.name} · Register ${j.employer_licence.source_date}`}>
                    <ShieldCheck size={14} /> Employer licence linked
                  </span>
                )}
                {j.sector_label && <span>{j.sector_label}</span>}
                {j.salary_excerpt && <span>Pay mentioned in advert</span>}
                {j.employment_type && (
                  <span>
                    {j.employment_type.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </span>
                )}
                {j.workplace && <span>{j.workplace}</span>}
              </div>
              <div>
                <span className={"sponsorship-tag " + j.sponsorship}>
                  {sponsorLabels[j.sponsorship]}
                </span>
                {j.level === "early_career" && (
                  <span className="career-level">
                    <GraduationCap size={13} />
                    Early career title
                  </span>
                )}
              </div>
              <footer>
                <span
                  title={new Date(j.last_seen).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                    timeZoneName: "short",
                  })}
                >
                  Checked {day(j.last_seen)}
                </span>
                <a href={"/jobs/" + j.id}>
                  View role <ArrowUpRight size={17} />
                </a>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        !error && (
          <Empty
            title="No roles match these filters yet."
            text="Try a broader title or location. This collection covers selected employers and does not represent the whole UK market."
            label="Clear filters"
            action={() => collection("all")}
          />
        )
      )}
      {!loading && !error && result && result.pages > 1 && (
        <div className="career-pagination">
          <button
            className="secondary-button"
            disabled={page === 1}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span>
            Page {page} of {result.pages}
          </span>
          <button
            className="secondary-button"
            disabled={page >= result.pages}
            onClick={() => changePage(page + 1)}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      <details className="career-sources">
        <summary>Sources and refresh status</summary>
        <p>
          We check these public employer boards every six hours. Jobs not seen
          successfully for three days are excluded from search. A successful
          feed check does not guarantee the employer is still accepting
          applications. General talent-pool and speculative-interest listings
          are excluded. Career-stage labels come from the title, not a
          confirmation of your eligibility. University feeds contain selected
          recent campus vacancies; a role leaving a feed does not prove it has
          closed. Past closing dates are excluded at each successful refresh.
        </p>
        {result?.sources.map((s) => (
          <div key={s.id}>
            <a href={s.careers_url} {...external}>
              {s.company}
              <ArrowUpRight size={13} />
            </a>
            <span>
              {s.error ? "Refresh delayed" : `${s.count} UK roles`} ·{" "}
              {s.last_success
                ? new Date(s.last_success).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/London",
                    timeZoneName: "short",
                  })
                : "Not yet checked"}
            </span>
          </div>
        ))}
      </details>
      <div className="career-outbound">
        <span>Looking beyond this collection?</span>
        <a href="https://findajob.dwp.gov.uk/" {...external}>
          Work Hub
          <ArrowUpRight size={14} />
        </a>
        <a href="https://www.jobs.nhs.uk/candidate/search" {...external}>
          NHS Jobs
          <ArrowUpRight size={14} />
        </a>
        <a href="https://ennismore.com/careers/" {...external}>
          Hospitality at Ennismore
          <ArrowUpRight size={14} />
        </a>
        <a href="https://bakerhicks.com/en/careers/early-careers" {...external}>
          Graduate schemes at BakerHicks
          <ArrowUpRight size={14} />
        </a>
        <button onClick={() => go("applications")}>
          Add a role yourself
          <Plus size={14} />
        </button>
      </div>
    </>
  );
}

function Applications({ go }: { go: Go }) {
  const c = useCareer();
  const [filter, setFilter] = useState("All"),
    [manual, setManual] = useState(false),
    [remove, setRemove] = useState("");
  const [title, setTitle] = useState(""),
    [company, setCompany] = useState(""),
    [description, setDescription] = useState(""),
    [url, setURL] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    const id = c.saveJob({
      id: "manual-" + crypto.randomUUID(),
      company,
      title,
      description,
      location: "",
      apply_url: url,
      provider: "manual",
      sponsorship: "not_stated",
      evidence: "",
      last_seen: "",
      first_seen: stamp(),
      level: "not_stated",
    });
    if (id) {
      setManual(false);
      go("studio");
    }
  }
  const apps = c.data.applications.filter(
    (a) => filter === "All" || a.stage === filter,
  );
  function importLegacy() {
    try {
      const old = JSON.parse(localStorage.getItem("si.saved.v1") || "[]");
      const imported = old
        .filter((x: any) => x && x.id && x.name)
        .map((x: any) => ({
          id: "legacy-" + x.id,
          jobId: "",
          company: String(x.name),
          title: String(x.role || "Role to choose"),
          description: "",
          location: String(x.city || ""),
          url: "",
          sponsorship: "not_stated",
          evidence: "",
          checkedAt: "",
          stage: stages.includes(x.stage) ? x.stage : "Saved",
          notes: String(x.notes || ""),
          followUp: String(x.followUp || ""),
          createdAt: x.savedAt || stamp(),
          updatedAt: stamp(),
          cv: "",
          coverLetter: "",
          interview: "",
          analysis: "",
          companyResearch: "",
          portfolio: "",
          learningPlan: "",
          preparedAt: "",
        }));
      c.setData((d) =>
        mergeData(d, { ...emptyData(), applications: imported }),
      );
    } catch {
      c.setError(
        "The older shortlist could not be imported. Its original data has been kept.",
      );
    }
  }
  return (
    <>
      <Title
        label="SMALL STEPS. REAL PROGRESS."
        title="Your next chapter, in motion."
        description="Every role has its own place. Keep your documents, conversations and next steps together."
      >
        <button className="primary-button" onClick={() => setManual(true)}>
          <Plus size={16} />
          Add a role
        </button>
      </Title>
      <div className="career-metrics">
        {[
          { n: c.data.applications.length, l: "Roles saved" },
          {
            n: c.data.applications.filter((a) =>
              ["Applied", "Interview", "Offer"].includes(a.stage),
            ).length,
            l: "Applications sent",
          },
          {
            n: c.data.applications.filter((a) => a.stage === "Interview")
              .length,
            l: "Interviews",
          },
          {
            n: c.data.applications.filter(
              (a) =>
                a.followUp &&
                a.followUp <= stamp().slice(0, 10) &&
                !["Closed", "Offer"].includes(a.stage),
            ).length,
            l: "Follow-ups due",
          },
        ].map((x) => (
          <div key={x.l}>
            <strong>{x.n}</strong>
            <span>{x.l}</span>
          </div>
        ))}
      </div>
      {c.data.searches.length > 0 && (
        <section className="saved-searches">
          <h2>Your saved searches</h2>
          <p>
            Open a search for the latest results. These are in-app shortcuts; no
            emails are sent.
          </p>
          {c.data.searches.map((s) => (
            <div key={s.id}>
              <a
                href={
                  "/jobs?" +
                  new URLSearchParams({
                    q: s.q,
                    location: s.location,
                    sponsorship: s.sponsorship,
                    level: s.level,
                    salary: s.salary || "",
                    sector: s.sector || "",
                    licence: s.licence || "",
                  })
                }
              >
                <Search size={15} />
                {[
                  s.q || "All roles",
                  s.location,
                  s.sponsorship === "mentioned"
                    ? "Sponsorship mentioned"
                    : sponsorLabels[s.sponsorship],
                  s.level === "early_career" ? "Early career" : "",
                  s.salary ? "GBP pay" : "",
                  s.sector,
                  s.licence === "matched" ? "Licensed employers" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                <ArrowUpRight size={15} />
              </a>
              <button
                className="icon-button"
                aria-label="Remove saved search"
                onClick={() =>
                  c.setData((d) => ({
                    ...d,
                    searches: d.searches.filter((x) => x.id !== s.id),
                  }))
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="career-tabs" role="group" aria-label="Application stage">
        {["All", ...stages].map((s) => (
          <button
            key={s}
            className={filter === s ? "active" : ""}
            onClick={() => setFilter(s)}
          >
            {s}
            <span>
              {
                c.data.applications.filter((a) => s === "All" || a.stage === s)
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      {apps.length ? (
        <div className="career-application-list">
          {apps.map((a) => (
            <article key={a.id} className="career-application-card">
              <span className="company-initial">
                {a.company.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p>{a.company}</p>
                <button
                  className="vacancy-title"
                  onClick={() => {
                    c.setSelected(a.id);
                    go("studio");
                  }}
                >
                  {a.title}
                </button>
                <div className="application-meta">
                  <span>
                    {a.preparedAt
                      ? "Draft prepared " + day(a.preparedAt)
                      : "Ready for your next step"}
                  </span>
                  {a.followUp && (
                    <span>
                      <CalendarDays size={13} />
                      Follow up {day(a.followUp)}
                    </span>
                  )}
                </div>
              </div>
              <label className="sr-only" htmlFor={"stage-" + a.id}>
                Stage for {a.title}
              </label>
              <select
                id={"stage-" + a.id}
                value={a.stage}
                onChange={(e) =>
                  c.updateApplication(a.id, {
                    stage: e.target.value,
                    ...(e.target.value === "Applied" && !a.followUp
                      ? { followUp: followupDate() }
                      : {}),
                  })
                }
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                className="secondary-button"
                onClick={() => {
                  c.setSelected(a.id);
                  go("studio");
                }}
              >
                Open workspace
                <ArrowRight size={15} />
              </button>
              <button
                className="icon-button"
                aria-label={"Remove " + a.title}
                onClick={() => setRemove(a.id)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            filter === "All"
              ? "Your next opportunity starts here."
              : "No applications at this stage."
          }
          text="Save a vacancy or add a role you found elsewhere. Your original employer shortlist is still available."
          label="Explore roles"
          action={() => go("jobs")}
        />
      )}
      <div className="career-outbound">
        <button onClick={importLegacy}>
          Import older employer notes
          <Plus size={14} />
        </button>
        <button onClick={() => go("saved")}>
          Open employer shortlist
          <ArrowRight size={14} />
        </button>
        <button
          onClick={() =>
            download(
              JSON.stringify(c.data, null, 2),
              "sponsor-intel-career-backup.json",
              "application/json",
            )
          }
        >
          Export workspace
          <Download size={14} />
        </button>
      </div>
      {remove && (
        <Modal title="Remove this application?" close={() => setRemove("")}>
          <p>
            This removes its notes and documents from this workspace. Export a
            backup first if you want to keep them.
          </p>
          <button
            className="danger-button"
            onClick={() => {
              c.setData((d) => ({
                ...d,
                applications: d.applications.filter((a) => a.id !== remove),
              }));
              setRemove("");
            }}
          >
            Remove application
          </button>
        </Modal>
      )}
      {manual && (
        <Modal title="Add an opportunity" close={() => setManual(false)}>
          <form className="career-form" onSubmit={add}>
            <label>
              Job title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={240}
              />
            </label>
            <label>
              Employer
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label>
              Original advert link <small>(optional, HTTPS)</small>
              <input
                type="url"
                pattern="https://.*"
                value={url}
                onChange={(e) => setURL(e.target.value)}
                maxLength={2000}
              />
            </label>
            <label>
              Paste the job description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={80}
                maxLength={26000}
                rows={8}
              />
            </label>
            <p className="fine-print">
              This is a role you supplied. Sponsorship has not been verified.
            </p>
            <button className="primary-button" type="submit">
              Create workspace
              <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Profile({ go }: { go: Go }) {
  const c = useCareer();
  const p = c.data.profile;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<typeof p>) =>
    c.setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const parsed = await importCV(file);
      update({ ...parsed.profile, cv: parsed.text });
      setMessage(
        "CV imported. Check the text and contact details before preparing an application.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <>
      <Title
        label="YOUR EXPERIENCE IS THE STARTING POINT"
        title="A profile that sounds like you."
        description="Keep a master CV here. Every application starts from your real experience, with you in control of the final words."
      />
      {sourceWarnings(p.cv).map((warning: string) => (
        <p className="career-notice" key={warning}>
          {warning}
        </p>
      ))}
      <div className="career-profile-layout">
        <section className="career-panel">
          <div className="panel-heading">
            <h2>Your details</h2>
            <span className="career-pill">PRIVATE</span>
          </div>
          <div className="career-form two-fields">
            {[
              { key: "name", label: "Full name" },
              { key: "headline", label: "Professional headline" },
              { key: "email", label: "Contact email" },
              { key: "phone", label: "Phone (optional)" },
              { key: "city", label: "Preferred city" },
              { key: "goal", label: "Roles you are looking for" },
            ].map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  value={p[f.key as keyof typeof p]}
                  onChange={(e) => update({ [f.key]: e.target.value })}
                  maxLength={f.key === "email" ? 200 : 160}
                  type={f.key === "email" ? "email" : "text"}
                />
              </label>
            ))}
          </div>
          <label className="career-field">
            Key skills <small>Separate with commas</small>
            <textarea
              value={p.skills}
              onChange={(e) => update({ skills: e.target.value })}
              rows={3}
              maxLength={2000}
            />
          </label>
          <label className="career-field">
            Sponsorship preference
            <select
              value={p.sponsorship}
              onChange={(e) => update({ sponsorship: e.target.value })}
            >
              <option value="unsure">I’m not sure yet</option>
              <option value="now">I need sponsorship now</option>
              <option value="later">I may need sponsorship later</option>
              <option value="not_needed">I do not need sponsorship</option>
            </select>
          </label>
          <p className="fine-print">
            This is your stated preference. It is not an eligibility assessment.
          </p>
        </section>
        <section className="career-panel cv-panel">
          <div className="panel-heading">
            <h2>Your master CV</h2>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => ref.current?.click()}
            >
              {busy ? (
                <Loader2 className="spin" size={15} />
              ) : (
                <Upload size={15} />
              )}
              Import CV
            </button>
          </div>
          <input
            hidden
            ref={ref}
            type="file"
            accept=".pdf,.docx,.txt,.json"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <p>
            Import PDF, DOCX, TXT or JSON Resume, or paste your CV below. File
            extraction happens in this browser.
          </p>
          {message && (
            <p role="status" className="career-notice">
              {message}
            </p>
          )}
          <label className="sr-only" htmlFor="master-cv">
            Master CV text
          </label>
          <textarea
            id="master-cv"
            className="master-cv"
            value={p.cv}
            onChange={(e) => update({ cv: e.target.value })}
            maxLength={30000}
            placeholder="Paste your experience, education, projects and skills here. Include only details you want to use in applications."
          />
          <div className="panel-bottom">
            <span>{p.cv.length.toLocaleString()} / 30,000 characters</span>
            <button
              className="text-button"
              onClick={() => exportJSONResume(p)}
              disabled={!p.cv}
            >
              <Download size={14} />
              Export JSON Resume
            </button>
          </div>
        </section>
      </div>
      <div className="career-actions">
        <button
          className="primary-button"
          onClick={() => go(c.selected ? "studio" : "jobs")}
        >
          Continue to {c.selected ? "my application" : "roles"}
          <ArrowRight size={16} />
        </button>
        <span className="fine-print">
          {c.user
            ? "Saved privately to your account."
            : "Saved on this browser. Sign in to sync across devices."}
        </span>
      </div>
    </>
  );
}

function Studio({ go }: { go: Go }) {
  const c = useCareer();
  const a =
    c.data.applications.find((x) => x.id === c.selected) ||
    c.data.applications[0];
  const [tab, setTab] = useState<
      | "analysis"
      | "cv"
      | "coverLetter"
      | "interview"
      | "followup"
      | "companyResearch"
      | "portfolio"
      | "learningPlan"
    >("analysis"),
    [busy, setBusy] = useState(""),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState("");
  const tabs = [
    { id: "analysis", label: "Evidence & gaps" },
    { id: "cv", label: "Tailored CV" },
    { id: "coverLetter", label: "Cover letter" },
    { id: "interview", label: "Interview prep" },
    { id: "companyResearch", label: "Company brief" },
    { id: "portfolio", label: "Portfolio plan" },
    { id: "learningPlan", label: "Learning plan" },
    { id: "followup", label: "Follow-up" },
  ] as const;
  if (!a)
    return (
      <>
        <Title
          label="POWERED BY HIRE STACK"
          title="Put your best evidence forward."
          description="A practical workspace for a thoughtful application. Start with a real role and your own experience."
        />
        <Empty
          title="Choose your next opportunity."
          text="Save a role, add your CV and let Hire Stack help you prepare."
          label="Find a role"
          action={() => go("jobs")}
        />
        <button className="text-button" onClick={() => go("career-profile")}>
          Start with my CV
          <ArrowRight size={16} />
        </button>
      </>
    );
  const value =
    tab === "followup" ? followupDraft(a, c.data.profile.name) : a[tab] || "";
  async function generate() {
    if (!a || tab === "followup") return;
    if (tab === "analysis") {
      c.updateApplication(a.id, {
        analysis: buildEvidenceReview(c.data.profile, a),
        preparedAt: stamp(),
        stage: a.stage === "Saved" ? "Preparing" : a.stage,
      });
      setMessage(
        "Evidence check ready. Shared terms use source quotes; role conditions still need your review.",
      );
      return;
    }
    setBusy(tab);
    setMessage("");
    if (a.stage === "Saved") c.updateApplication(a.id, { stage: "Preparing" });
    const id = a.id,
      kind = tab;
    try {
      const r = await request("/api/career/generate", "POST", {
        profile: c.data.profile,
        application: {
          id: a.id,
          jobId: a.jobId,
          title: a.title,
          company: a.company,
          description: a.description,
          sponsorship: a.sponsorship,
          evidence: a.evidence,
        },
        kind,
        consent,
      });
      c.updateApplication(id, {
        [kind]: r.text,
        preparedAt: r.generatedAt,
      });
      setMessage(
        (kind === "companyResearch"
          ? (r.text.startsWith("COMPANY BRIEF — EMPLOYER ADVERT EVIDENCE")
            ? "Brief prepared from the monitored employer advert. Open its sources and verify the details."
            : "Research checklist ready. We could not match this role to a current monitored advert; no company facts were invented.")
          : r.evidenceReviewed
            ? "Draft ready after an AI evidence review. Check every fact before using it."
            : "Draft ready. Check every fact and edit it before using it.") +
          (r.warnings?.length ? " " + r.warnings.join(" ") : ""),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function output(type: "pdf" | "docx") {
    setBusy("export");
    try {
      await exportDocument(
        value,
        type,
        `${c.data.profile.name || "My"} ${tabs.find((t) => t.id === tab)?.label} ${a.company}`,
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "The download could not be created. Try plain text.",
      );
    } finally {
      setBusy("");
    }
  }
  const enough =
    (tab === "companyResearch" || c.data.profile.cv.trim().length >= 100) &&
    a.description.trim().length >= 80;
  return (
    <>
      <Title
        label="SPONSOR INTEL × HIRE STACK"
        title="Make this application yours."
        description="Use the evidence you have. See what needs work. Keep the final say."
      />
      <div className="studio-job">
        <span className="company-initial">
          {a.company.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <p>{a.company}</p>
          <h2>{a.title}</h2>
          <span className={"sponsorship-tag " + a.sponsorship}>
            {sponsorLabels[a.sponsorship]}
          </span>
        </div>
        <select
          aria-label="Choose application"
          disabled={!!busy}
          value={a.id}
          onChange={(e) => {
            c.setSelected(e.target.value);
            setMessage("");
          }}
        >
          {c.data.applications.map((x) => (
            <option value={x.id} key={x.id}>
              {x.title} · {x.company}
            </option>
          ))}
        </select>
      </div>
      {draftWarnings(value, c.data.profile.cv, tab).map((warning: string) => (
        <p className="career-notice" key={warning}>
          {warning}
        </p>
      ))}
      <div className="studio-layout">
        <aside className="studio-sidebar">
          <section className="career-panel">
            <h3>Your application</h3>
            <label className="career-field">
              Stage
              <select
                value={a.stage}
                onChange={(e) =>
                  c.updateApplication(a.id, {
                    stage: e.target.value,
                    ...(e.target.value === "Applied" && !a.followUp
                      ? { followUp: followupDate() }
                      : {}),
                  })
                }
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="studio-checks">
              <p>
                <CheckCircle2 size={16} />
                {a.description
                  ? "Job description saved"
                  : "Add a job description"}
              </p>
              <p>
                {c.data.profile.cv.length >= 100 ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <FileText size={16} />
                )}
                <button onClick={() => go("career-profile")}>
                  {c.data.profile.cv
                    ? "Review my master CV"
                    : "Add my master CV"}
                </button>
              </p>
              <p>
                <ShieldCheck size={16} />
                You review before applying
              </p>
            </div>
            {a.url && (
              <a className="primary-button" href={a.url} {...external}>
                Open employer advert
                <ArrowUpRight size={15} />
              </a>
            )}
            <p className="fine-print">
              After submitting on the employer’s site, change the stage to
              Applied.
            </p>
          </section>
          <section className="career-panel">
            <h3>Next step</h3>
            <label className="career-field">
              Follow-up date
              <input
                type="date"
                value={a.followUp}
                onChange={(e) =>
                  c.updateApplication(a.id, { followUp: e.target.value })
                }
              />
            </label>
            <button
              className="text-button"
              disabled={!a.followUp}
              onClick={() => exportCalendar(a)}
            >
              <CalendarDays size={14} />
              Add to my calendar
            </button>
            <label className="career-field">
              Private notes
              <textarea
                rows={5}
                value={a.notes}
                onChange={(e) =>
                  c.updateApplication(a.id, { notes: e.target.value })
                }
                maxLength={4000}
                placeholder="Recruiter conversations, next steps…"
              />
            </label>
          </section>
        </aside>
        <section className="studio-main">
          <div
            className="studio-tabs"
            role="tablist"
            aria-label="Application documents"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                disabled={!!busy}
                aria-selected={tab === t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => {
                  setTab(t.id);
                  setMessage("");
                }}
              >
                {t.label}
                {t.id !== "followup" && a[t.id] && <Check size={12} />}
              </button>
            ))}
          </div>
          <div className="studio-document">
            <div className="document-heading">
              <div>
                <span className="eyebrow">YOUR EDITABLE WORKING DRAFT</span>
                <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
              </div>
              {tab !== "followup" && (
                <button
                  className="primary-button"
                  disabled={
                    !!busy ||
                    !enough ||
                    (!["analysis", "companyResearch"].includes(tab) && !consent)
                  }
                  onClick={() => void generate()}
                >
                  {busy && busy !== "export" ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}{" "}
                  {tab === "analysis"
                    ? "Check evidence"
                    : busy && busy !== "export"
                      ? "Preparing…"
                      : value
                        ? "Prepare a fresh draft"
                        : "Prepare draft"}
                </button>
              )}
            </div>
            {tab !== "followup" &&
              tab !== "analysis" &&
              tab !== "companyResearch" && (
                <>
                  <p className="fine-print">
                    {!enough
                      ? "Add your master CV and a full job description first."
                      : "AI helps with wording and preparation. Check accuracy, dates and claims before applying. CVs and letters receive a second AI evidence review. Built with Llama."}
                  </p>
                  <label className="ai-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I agree to send my CV and this job description to Cloudflare
                    AI to prepare this draft.
                  </label>
                </>
              )}
            {tab === "analysis" && (
              <p className="fine-print">
                This check compares your CV and advert in your browser. It
                quotes shared skill terms and highlights conditions to review.
                No AI score or eligibility decision.
              </p>
            )}
            {tab === "companyResearch" && (
              <p className="fine-print">
                Uses the current monitored advert when it matches this
                application. This is a source-linked employer brief, not
                independent market or financial research. No CV is sent to AI.
              </p>
            )}
            {["portfolio", "learningPlan"].includes(tab) && (
              <p className="fine-print">
                A preparation plan, not proof that you have completed the work.
                Proposed tasks must stay labelled as suggestions until you do
                them.
              </p>
            )}
            {tab === "followup" && (
              <p className="fine-print">
                A starting point you can copy and edit. Nothing is sent
                automatically.
              </p>
            )}
            {message && (
              <p role="status" className="career-notice">
                {message}
              </p>
            )}
            <label className="sr-only" htmlFor="application-document">
              {tabs.find((t) => t.id === tab)?.label}
            </label>
            <textarea
              id="application-document"
              className="document-editor"
              value={value}
              readOnly={tab === "followup" || !!busy}
              maxLength={
                tab === "coverLetter"
                  ? 20000
                  : ["interview", "portfolio", "learningPlan"].includes(tab)
                    ? 24000
                    : ["analysis", "companyResearch"].includes(tab)
                      ? 20000
                      : 40000
              }
              onChange={(e) => {
                setMessage("");
                if (tab !== "followup")
                  c.updateApplication(a.id, { [tab]: e.target.value });
              }}
              placeholder={
                tab === "analysis"
                  ? "Your evidence review will appear here. You can also write your own notes."
                  : `Your ${tabs.find((t) => t.id === tab)?.label.toLowerCase()} will appear here. Edit every line to make it yours.`
              }
            />
            <div className="document-actions">
              <button
                className="secondary-button"
                disabled={!value || !!busy}
                onClick={() => void output("docx")}
              >
                <Download size={15} />
                Word
              </button>
              <button
                className="secondary-button"
                disabled={!value || !!busy}
                onClick={() => void output("pdf")}
              >
                <Download size={15} />
                PDF
              </button>
              <button
                className="text-button"
                disabled={!value}
                onClick={() => download(value, tab + ".txt")}
              >
                Plain text
              </button>
              <button
                className="text-button"
                disabled={!value}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(value)
                    .then(() => setMessage("Copied."))
                    .catch(() =>
                      setMessage(
                        "Use the text download if copying is unavailable.",
                      ),
                    )
                }
              >
                <Copy size={14} />
                Copy
              </button>
            </div>
          </div>
          <details className="career-sources">
            <summary>Working job description and source evidence</summary>
            {a.evidence && (
              <>
                <p>Sponsorship wording captured from the original advert:</p>
                <blockquote>{a.evidence}</blockquote>
              </>
            )}
            <p>
              {a.checkedAt
                ? "Source checked " + day(a.checkedAt)
                : "This role was added manually; source not independently verified."}
            </p>
            <label className="career-field">
              Job description
              <textarea
                rows={12}
                value={a.description}
                onChange={(e) =>
                  c.updateApplication(a.id, { description: e.target.value })
                }
                maxLength={26000}
              />
            </label>
          </details>
        </section>
      </div>
    </>
  );
}

function Account({
  go,
  initialMode = "signup",
}: {
  go: Go;
  initialMode?: "signin" | "signup";
}) {
  const c = useCareer();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">(
      initialMode,
    ),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(() => {
      if (typeof location === "undefined") return "";
      const params = new URLSearchParams(location.search);
      if (params.has("error"))
        return "This email link could not be verified. Request a fresh verification link below.";
      return params.has("email-link")
        ? "Email link processed. Sign in to continue to your account."
        : "";
    }),
    [deleteModal, setDeleteModal] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "recover") {
        await request("/api/recover", "POST", { code, password });
        setMessage("Password reset. Sign in, then create a new recovery code.");
        setMode("signin");
        setPassword("");
        setCode("");
      } else {
        const result = await request(
          "/api/auth/" +
            (mode === "signup" ? "sign-up/email" : "sign-in/email"),
          "POST",
          {
            email,
            password,
            ...(mode === "signup"
              ? { name, callbackURL: "/signin?email-link=1" }
              : {}),
          },
        );
        if (mode === "signup" && !result.token) {
          setPassword("");
          setMode("signin");
          setMessage(
            "Check your inbox to verify your email, then sign in. Your browser workspace is still here.",
          );
          return;
        }
        await c.reload();
        setPassword("");
        if (mode === "signup") {
          const r = await request("/api/career/recovery-code", "POST", {});
          setRecovery(r.code);
        }
        setMessage(
          "Your account is ready. You can import this browser’s workspace below.",
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 650000)
        throw Error("Choose a backup smaller than 650 KB.");
      const input = JSON.parse(await file.text());
      const { validateWorkspace } = await import(
        "../worker/career-validation.js"
      );
      const data = validateWorkspace(input) as CareerData;
      c.setData((d) => mergeData(d, data));
      setMessage("Backup merged. Existing applications were kept.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (upload.current) upload.current.value = "";
    }
  }
  async function removeAccount() {
    setBusy(true);
    try {
      await request("/api/career/account", "DELETE", {});
      if (c.user) localStorage.removeItem("si.career.user." + c.user.id);
      await c.reload();
      setDeleteModal(false);
      setMessage("Your account and cloud workspace have been deleted.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        label="YOUR WORKSPACE, YOUR CONTROL"
        title={
          c.user
            ? `Welcome, ${c.user.name.split(" ")[0]}.`
            : "Keep your next chapter together."
        }
        description="A private place for your CV, applications and progress. Sign in to continue on another device."
      />
      {message && (
        <p className="career-notice" role="status">
          {message}
        </p>
      )}
      <div className="account-grid">
        <section className="career-panel">
          {c.user ? (
            <>
              <Cloud size={30} />
              <h2>Your account</h2>
              <p>{c.user.email}</p>
              <AccountEmailHelp
                signedIn
                email={c.user.email}
                verified={c.user.emailVerified}
              />
              <p>{c.status}</p>
              <div className="career-actions">
                <button
                  className="primary-button"
                  onClick={() => go("applications")}
                >
                  My applications
                  <ArrowRight size={15} />
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void c.logout().catch((e) => setMessage(e.message))
                  }
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
              <button
                className="text-button"
                disabled={!c.ready || c.status === "Saving…"}
                onClick={async () => {
                  download(
                    JSON.stringify(c.data, null, 2),
                    "sponsor-intel-before-reload.json",
                    "application/json",
                  );
                  if (c.user)
                    localStorage.removeItem("si.career.user." + c.user.id);
                  await c.reload();
                  setMessage(
                    "Your previous copy was downloaded. The latest cloud workspace is now loaded.",
                  );
                }}
              >
                Download backup & reload cloud copy
              </button>
              <button
                className="text-button"
                onClick={() => {
                  c.importGuest();
                  setMessage(
                    "Browser workspace imported. Existing account applications were kept.",
                  );
                }}
              >
                Import this browser’s guest workspace
                <Upload size={14} />
              </button>
              <button
                className="text-button"
                onClick={() =>
                  void request("/api/career/recovery-code", "POST", {})
                    .then((r) => setRecovery(r.code))
                    .catch((e) => setMessage(e.message))
                }
              >
                Create a new recovery code
              </button>
              <p className="fine-print">
                Creating a new code replaces the old one. For your security,
                sign in again first if your session is older than ten minutes.
              </p>
              <ChangePassword />
              <button
                className="text-button danger-text"
                onClick={() => setDeleteModal(true)}
              >
                Delete my account and cloud data
              </button>
            </>
          ) : (
            <>
              <div className="career-tabs">
                {[
                  { v: "signup", l: "Create account" },
                  { v: "signin", l: "Sign in" },
                  { v: "recover", l: "Recover account" },
                ].map((t) => (
                  <button
                    className={mode === t.v ? "active" : ""}
                    key={t.v}
                    onClick={() => {
                      setMode(t.v as typeof mode);
                      setMessage("");
                    }}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
              <form className="career-form" onSubmit={submit}>
                {mode === "signup" && (
                  <label>
                    Your name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={100}
                      autoComplete="name"
                    />
                  </label>
                )}
                {mode === "recover" ? (
                  <label>
                    Saved recovery code
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      rows={3}
                    />
                  </label>
                ) : (
                  <label>
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={200}
                      autoComplete="email"
                    />
                  </label>
                )}
                <label>
                  {mode === "recover" ? "New password" : "Password"}
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                  />
                  <small>At least 12 characters. Use a unique password.</small>
                </label>
                <button className="primary-button" disabled={busy || !c.ready}>
                  {busy ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <LogIn size={16} />
                  )}{" "}
                  {mode === "signup"
                    ? "Create my account"
                    : mode === "signin"
                      ? "Sign in"
                      : "Reset password"}
                </button>
                <p className="fine-print">
                  Verify your email before signing in. Account emails come from
                  accounts@sponsorintel.london. You can also recover an account
                  using a saved recovery code.
                </p>
              </form>
              <AccountEmailHelp key={email} email={email} />
            </>
          )}
        </section>
        <section className="career-panel">
          <ShieldCheck size={30} />
          <h2>Your data belongs to you.</h2>
          <p>
            Your master CV, applications and saved searches can be downloaded at
            any time.
          </p>
          <div className="backup-options">
            <button
              className="secondary-button"
              onClick={() =>
                download(
                  JSON.stringify(c.data, null, 2),
                  "sponsor-intel-career-backup.json",
                  "application/json",
                )
              }
            >
              <Download size={16} />
              Download career backup
            </button>
            <button
              className="secondary-button"
              onClick={() => upload.current?.click()}
            >
              <Upload size={16} />
              Import career backup
            </button>
            <input
              type="file"
              hidden
              ref={upload}
              accept=".json"
              onChange={(e) => void importBackup(e.target.files?.[0])}
            />
          </div>
          <p className="fine-print">
            Backups contain personal information. Keep them somewhere private.
            Your original employer shortlist has its own backup in Workspace
            settings.
          </p>
          <h3>How your information is used</h3>
          <p>
            Guest work stays in this browser. Signing in stores your career
            workspace on Cloudflare. Files are read on your device; extracted
            text is saved with your workspace. AI preparation sends the selected
            CV and job description to Cloudflare only when you agree and press
            Prepare.
          </p>
          <p className="fine-print">
            On shared devices, sign out when you finish. Guest work remains
            until you clear it or browser storage.
          </p>
          <button
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  "Clear the career workspace saved in this browser? Download a backup first. This does not delete a signed-in cloud workspace.",
                )
              ) {
                localStorage.removeItem("si.career.guest.v2");
                if (!c.user) c.setData(emptyData());
                setMessage("Guest career workspace cleared.");
              }
            }}
          >
            Clear guest career workspace
          </button>
        </section>
      </div>
      {recovery && (
        <Modal
          title="Save your account recovery code"
          close={() => setRecovery("")}
        >
          <p>
            This code can reset your password. Store it privately; it is shown
            only now. We cannot email it to you.
          </p>
          <textarea
            aria-label="Recovery code"
            className="recovery-code"
            readOnly
            value={recovery}
          />
          <div className="career-actions">
            <button
              className="primary-button"
              onClick={() =>
                download(
                  "Sponsor Intel account recovery code\n\n" +
                    recovery +
                    "\n\nKeep this private. Use it on the Recover account screen.",
                  "sponsor-intel-recovery.txt",
                )
              }
            >
              <Download size={16} />
              Download recovery code
            </button>
            <button
              className="secondary-button"
              onClick={() => setRecovery("")}
            >
              I’ve saved it
            </button>
          </div>
        </Modal>
      )}
      {deleteModal && (
        <Modal title="Delete your account?" close={() => setDeleteModal(false)}>
          <p>
            This deletes your cloud career profile, applications, documents and
            account. Download a backup first. Your older employer shortlist and
            guest workspace on this browser are separate.
          </p>
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => void removeAccount()}
          >
            Delete account and cloud data
          </button>
        </Modal>
      )}
    </>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await request("/api/auth/change-password", "POST", {
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      setCurrent("");
      setNext("");
      setMessage(
        "Password changed. Other signed-in sessions have been revoked.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="password-settings">
      <summary>Change my password</summary>
      <form className="career-form" onSubmit={(e) => void submit(e)}>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <small>At least 12 characters. Use a unique password.</small>
        </label>
        <button className="secondary-button" disabled={busy}>
          Update password
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
