import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, MapPin, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useCareer, request, stamp, day, sponsorLabels } from "./career-data";
import { Title } from "./career-ui";
import { jobTimestamp } from "../shared/job-detail.js";
import { readJobSearch, jobSearchPath, readInitialJobs, type JobsResult } from "../shared/job-search.js";
import { updateJobsMetadata } from "./seo";
const external = { target: "_blank", rel: "noopener noreferrer" };
type Go = (view: string) => void;
function browserInitial() {
  if (typeof document === "undefined" || location.pathname !== "/jobs") return null;
  return readInitialJobs(document.getElementById("jobs-data")?.textContent || "", location.search);
}
export function Vacancies({ go, initialResult, initialSearch }: { go: Go; initialResult?: JobsResult; initialSearch?: string }) {
  const c = useCareer();
  const [bootstrap] = useState(browserInitial);
  const searchInput = initialSearch ?? (typeof location === "undefined" ? "" : location.search);
  const start = readJobSearch(searchInput);
  const firstResult: JobsResult | null = initialResult || bootstrap?.result || null;
  const [q, setQ] = useState(start.q),
    [city, setCity] = useState(start.location),
    [sponsorship, setSponsorship] = useState(start.sponsorship),
    [level, setLevel] = useState(start.level),
    [salary, setSalary] = useState(start.salary),
    [sector, setSector] = useState(start.sector),
    [licence, setLicence] = useState(start.licence),
    [page, setPage] = useState(
      firstResult?.page || start.page,
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
  const [result, setResult] = useState<JobsResult | null>(firstResult),
    [loading, setLoading] = useState(!firstResult),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const useBootstrap = useRef(!!firstResult);
  useEffect(() => { document.getElementById("jobs-data")?.remove(); }, []);
  useEffect(() => { updateJobsMetadata(applied, page); }, [applied, page]);
  function applyFilters(
    next = { q, location: city, sponsorship, level, salary, sector, licence },
  ) {
    next = readJobSearch(new URLSearchParams(next));
    setResult(null);
    setLoading(true);
    setQ(next.q);
    setCity(next.location);
    setSponsorship(next.sponsorship);
    setLevel(next.level);
    setSalary(next.salary);
    setSector(next.sector);
    setLicence(next.licence);
    setPage(1);
    setApplied(next);
    history.replaceState({}, "", jobSearchPath(next, 1));
  }
  function search(e?: React.FormEvent) {
    e?.preventDefault();
    applyFilters();
  }
  function changePage(next: number) {
    setResult(null);
    setLoading(true);
    setPage(next);
    history.replaceState({}, "", jobSearchPath(applied, next));
  }
  function collectionFilters(kind: string) {
    return {
      q: "",
      location: "",
      sponsorship: kind === "sponsorship" ? "mentioned" : "",
      level: kind === "early_career" ? "early_career" : "",
      salary: kind === "salary" ? "listed" : "",
      sector: "",
      licence: kind === "licensed" ? "matched" : "",
    };
  }
  function collection(kind: string) { applyFilters(collectionFilters(kind)); }
  function follow(e: React.MouseEvent<HTMLAnchorElement>, action: () => void) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); action();
  }
  useEffect(() => {
    if (useBootstrap.current) { useBootstrap.current = false; return; }
    let alive = true;
    setLoading(true);
    setError("");
    setResult(null);
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
  // An open results tab also rechecks deadlines. Clear the old collection
  // before refreshing so a failed request cannot leave expired roles on show.
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { setResult(null); setKey(v => v + 1); } };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  useEffect(() => {
    if (loading) return;
    const deadline = Math.min(Date.now() + 5 * 60000, ...[result?.next_deadline, result?.valid_until].map(x => Date.parse(x || '')).filter(Number.isFinite));
    const timer = window.setTimeout(() => {
      setResult(null);
      if (!document.hidden) setKey(v => v + 1);
    }, Math.min(2147483647, Math.max(1, deadline - Date.now() + 20)));
    return () => clearTimeout(timer);
  }, [result, loading]);
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
      "Search saved. Open My applications to follow new matches.",
    );
  }
  return (
    <section className="vacancies-page">
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
            {result?.collections?.employers ?? "—"} {result?.collections?.employers === 1 ? "employer" : "employers"} with UK vacancies
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
            <a
              key={id}
              href={jobSearchPath(collectionFilters(id))}
              className={"opportunity-collection" + (active ? " selected" : "")}
              aria-current={active ? "page" : undefined}
              onClick={(e) => follow(e, () => collection(id))}
            >
              <span className="collection-top">
                <Icon size={21} />
                <strong>{count?.toLocaleString() ?? "—"}</strong>
              </span>
              <span className="collection-title">{title}</span>
              <small>{note}</small>
            </a>
          );
        })}
      </section>
      <form id="job-search" action="/jobs" method="get" className="job-search-form" onSubmit={search}>
        <label>
          <Search size={18} />
          <input
            name="q"
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
            name="location"
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
          <select form="job-search" name="licence" value={licence} onChange={(e) => setLicence(e.target.value)}>
            <option value="">All employers</option>
            <option value="matched">Linked to a Skilled Worker licence</option>
          </select>
        </label>
        <label>
          Sponsorship
          <select form="job-search" name="sponsorship"
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
          <select form="job-search" name="level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All career stages</option>
            <option value="early_career">Graduate, junior & internships</option>
          </select>
        </label>
        <label>
          Employer sector
          <select form="job-search" name="sector" value={sector} onChange={(e) => setSector(e.target.value)}>
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
          <select form="job-search" name="salary" value={salary} onChange={(e) => setSalary(e.target.value)}>
            <option value="">All adverts</option>
            <option value="listed">GBP pay mentioned</option>
          </select>
        </label>
        <button className="secondary-button" type="submit" form="job-search">
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
        <a href="/jobs"
          className="text-button clear-job-filters"
          onClick={(e) => follow(e, () => collection("all"))}
        >
          <X size={15} /> Clear all filters
        </a>
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
              : `${result?.total || 0} matching ${result?.total === 1 ? "role" : "roles"}`}
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
                {j.application_deadline && <span><CalendarDays size={14} /> Closing date: {jobTimestamp(j.application_deadline)}</span>}
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
          <div className="career-empty">
            <h2>No roles match these filters yet.</h2>
            <p>Try a broader title or location. This collection covers selected employers and does not represent the whole UK market.</p>
            <a className="primary-button" href="/jobs" onClick={(e) => follow(e, () => collection("all"))}>Clear filters <ArrowRight size={16} /></a>
          </div>
        )
      )}
      {!loading && !error && result && result.pages > 1 && (
        <div className="career-pagination">
          {page > 1 ? <a className="secondary-button" href={jobSearchPath(applied, page - 1)} onClick={(e) => follow(e, () => changePage(page - 1))}><ChevronLeft size={16} /> Previous</a>
            : <span className="secondary-button" aria-disabled="true"><ChevronLeft size={16} /> Previous</span>}
          <span>Page {page} of {result.pages}</span>
          {page < result.pages ? <a className="secondary-button" href={jobSearchPath(applied, page + 1)} onClick={(e) => follow(e, () => changePage(page + 1))}>Next <ChevronRight size={16} /></a>
            : <span className="secondary-button" aria-disabled="true">Next <ChevronRight size={16} /></span>}
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
          closed. Past closing dates are excluded whenever you load current results.
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
    </section>
  );
}

