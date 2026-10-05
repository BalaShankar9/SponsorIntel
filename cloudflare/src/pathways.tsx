import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Compass,
  GraduationCap,
  Search,
  ShieldCheck,
} from "lucide-react";
import content from "../shared/pathways.json";
import baselines from "../shared/guidance-baselines.json";
import { businessCharges, studyBudget } from "../shared/planning.js";
import "./pathways.css";
const money = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
const external = { target: "_blank", rel: "noopener noreferrer" };
const STUDENTS =
  "https://www.gov.uk/government/publications/register-of-licensed-sponsors-students";
function Source({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a className="path-source" href={href} {...external}>
      {children}
      <ArrowUpRight size={15} />
    </a>
  );
}
function Hero({
  tag,
  title,
  text,
}: {
  tag: string;
  title: string;
  text: string;
}) {
  return (
    <header className="path-hero">
      <div>
        <p className="eyebrow">{tag}</p>
        <h1>{title}</h1>
        <p>{text}</p>
        <div className="path-proof">
          <ShieldCheck size={17} /> Official sources · Clear costs · No
          guaranteed outcomes
        </div>
      </div>
      <div className="path-orbit" aria-hidden="true">
        <Compass size={70} />
        <span>
          YOUR NEXT
          <br />
          CHAPTER
        </span>
      </div>
    </header>
  );
}
function SourceNote({ view }: { view: string }) {
  const [state, setState] = useState("");
  useEffect(() => {
    if (["immigration-sources", "editorial-policy"].includes(view)) return;
    const controller = new AbortController();
    fetch("/api/updates", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        const ids =
          view === "study/uk-costs"
            ? ["student-money", "student", "ihs"]
            : view === "study"
              ? ["student-course", "student"]
              : view.includes("business")
                ? [
                    "founder",
                    "founder-eligibility",
                    "sponsor-fees",
                    "sponsor-certificate",
                    "sponsor-skills-charge",
                    "student",
                  ]
                : Object.keys(baselines.sources);
        const sources = ids.map((id) =>
          d.sources.find((s: { id: string }) => s.id === id),
        );
        const changed = sources.some(
          (s: any) =>
            s &&
            (s.withdrawn ||
              s.content_hash !==
                (baselines.sources as Record<string, string>)[s.id]),
        );
        const unavailable = sources.some(
          (s: any) =>
            !s ||
            s.error ||
            !s.last_success ||
            Date.now() - new Date(s.last_success).getTime() > 3600000,
        );
        setState(
          changed
            ? "An official source has changed since this guide was checked. Use the original guidance; our explanation and cost examples need review."
            : unavailable
              ? "Some official source checks are unavailable or overdue. Confirm current rules directly before acting."
              : "Official sources are monitored every 15 minutes. No change detected against the checked passages; this is not a new legal review.",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState(
            "Automatic source checks are unavailable. Confirm the current rules on GOV.UK.",
          );
      });
    return () => controller.abort();
  }, [view]);
  return (
    <div className="path-review">
      <span>
        <CheckCircle2 size={16} /> Sources checked 5 October 2026
      </span>
      <span>
        General information ·{" "}
        <a href="/editorial-policy">How we check guidance</a>
      </span>
      {state && (
        <p role="status">
          {state} <a href="/updates">View source checks</a>
        </p>
      )}
    </div>
  );
}
function NextSteps() {
  return (
    <section className="path-next">
      <div>
        <h2>Make your next step an informed one.</h2>
        <p>
          Use the original guidance and get regulated advice for your
          circumstances.
        </p>
      </div>
      <a className="secondary-button" href="/advisers">
        Find immigration advice <ArrowRight size={17} />
      </a>
      <a className="primary-button" href="/ask">
        Ask with official sources <ArrowRight size={17} />
      </a>
    </section>
  );
}
export function PathwayPage({ view }: { view: string }) {
  return (
    <div className="pathways">
      <SourceNote view={view} />
      {view === "routes" ? (
        <RouteExplorer />
      ) : view === "routes/business-self-sponsorship" ? (
        <BusinessGuide />
      ) : view === "routes/india-to-uk" ? (
        <IndiaGuide />
      ) : view === "study" ? (
        <StudyDirectory />
      ) : view === "study/uk-costs" ? (
        <StudyCosts />
      ) : view === "immigration-sources" ? (
        <SourceDirectory />
      ) : (
        <EditorialPolicy />
      )}
      <NextSteps />
    </div>
  );
}
function RouteExplorer() {
  const [goal, setGoal] = useState("All routes");
  return (
    <>
      <Hero
        tag="UK VISA ROUTES, EXPLAINED"
        title="There is more than one way forward."
        text="Compare work, study, business and family routes. Start with the conditions that matter, then follow the official guidance."
      />
      <div className="path-quick">
        <a href="/routes/business-self-sponsorship">
          <Building2 /> Business & self-sponsorship <ArrowRight />
        </a>
        <a href="/routes/india-to-uk">
          <Compass /> Planning from India <ArrowRight />
        </a>
        <a href="/study">
          <GraduationCap /> Find a licensed institution <ArrowRight />
        </a>
      </div>
      <section>
        <div className="path-section-title">
          <div>
            <p className="eyebrow">COMPARE YOUR OPTIONS</p>
            <h2>Start with your reason for moving.</h2>
          </div>
          <label>
            Explore by goal
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {[
                "All routes",
                ...new Set(content.routes.map((r) => r.goal)),
              ].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="path-muted">
          This filter organises information. It does not assess your eligibility
          or recommend a visa.
        </p>
        <div className="path-grid">
          {content.routes
            .filter((r) => goal === "All routes" || r.goal === goal)
            .map((r) => (
              <article className="path-card" key={r.name}>
                <span className="tag green">{r.goal}</span>
                <h3>{r.name}</h3>
                <p>{r.summary}</p>
                <div className="path-caution">
                  <strong>Check carefully</strong>
                  <p>{r.watch}</p>
                </div>
                <p>
                  <strong>Your next step:</strong> {r.next}
                </p>
                <Source href={r.url}>Read the official route</Source>
              </article>
            ))}
        </div>
      </section>
      <p className="path-note">
        This is a selected comparison, not the full immigration rules. Visitor
        permission does not normally allow work or a move to the UK for
        long-term residence. Check any switching restrictions before making
        plans.
      </p>
      <Source href="https://www.gov.uk/check-uk-visa">
        Use the official visa checker
      </Source>
    </>
  );
}
function BusinessGuide() {
  const [months, setMonths] = useState(36),
    [large, setLarge] = useState(false),
    [exempt, setExempt] = useState(false);
  const cost = businessCharges({ months, large, exempt });
  return (
    <>
      <Hero
        tag="BUSINESS ROUTES · A PRACTICAL REALITY CHECK"
        title="A real business first. A visa assessment next."
        text="Understand what people mean by “self-sponsorship”, what a sponsor licence requires and how to build a realistic budget."
      />
      <div className="path-note">
        <strong>
          There is no standalone UK visa called “self-sponsorship”.
        </strong>
        <p>
          The phrase commonly describes a business sponsoring an owner or
          director under the Skilled Worker rules. Owning shares or
          incorporating a company does not give permission to live or work in
          the UK. Whether an arrangement works depends on the business, genuine
          job, sponsor duties and the individual's immigration position.
        </p>
      </div>
      <div className="path-grid two">
        <article className="path-card">
          <h2>A company sponsoring a worker</h2>
          <p>
            A lawful operating business must qualify for a sponsor licence, have
            suitable people and systems to manage sponsorship, and offer a
            genuine eligible role at the required pay. UKVI can check the
            business and its records.
          </p>
          <Source href="https://www.gov.uk/uk-visa-sponsorship-employers">
            Employer sponsorship requirements
          </Source>
          <Source href="https://www.gov.uk/uk-visa-sponsorship-employers/sponsorship-management-roles">
            Sponsorship management roles
          </Source>
          <Source href="https://www.gov.uk/skilled-worker-visa/your-job">
            Job and salary requirements
          </Source>
        </article>
        <article className="path-card">
          <h2>Innovator Founder</h2>
          <p>
            This route needs an approved endorsement for a business idea that
            meets innovation, viability and scalability requirements. There is
            no published flat investment amount that makes a new idea eligible;
            you still need credible business funding and separate personal
            maintenance.
          </p>
          <p>
            The published endorsement charge is £1,000, plus at least two £500
            contact-point meetings during the visa period. Visa fees, healthcare
            surcharge and operating funds are additional.
          </p>
          <Source href="https://www.gov.uk/innovator-founder-visa">
            Innovator Founder overview and fees
          </Source>
          <Source href="https://www.gov.uk/innovator-founder-visa/eligibility">
            Funding and eligibility
          </Source>
        </article>
      </div>
      <section className="path-split">
        <div>
          <p className="eyebrow">COSTS WITHOUT THE SALES PITCH</p>
          <h2>What is the least investment?</h2>
          <p>
            There is no universal minimum business budget that guarantees
            approval. The cheaper-looking package may leave out salary, employer
            National Insurance, rent, accounting, compliance work and the
            applicant's visa costs.
          </p>
          <ol className="path-steps">
            <li>
              <strong>Check what your current permission allows.</strong>{" "}
              Student permission normally prohibits business activity. Do not
              start trading on an assumption.
            </li>
            <li>
              <strong>Build a viable business case.</strong> Document customers,
              cash flow, genuine duties and how the business can sustain the
              role.
            </li>
            <li>
              <strong>Check sponsor readiness.</strong> Review licence
              eligibility, key personnel, records and reporting
              responsibilities.
            </li>
            <li>
              <strong>Get an itemised regulated assessment.</strong> Separate
              government charges, professional fees, working capital and
              personal living costs.
            </li>
            <li>
              <strong>Apply only when the evidence supports it.</strong> A
              licence, certificate and personal visa application are separate
              steps; none guarantees the next.
            </li>
          </ol>
          <Source href="https://www.gov.uk/student-visa">
            Student conditions
          </Source>
        </div>
        <div className="path-calculator">
          <p className="eyebrow">EMPLOYER CHARGES ILLUSTRATION</p>
          <h3>One Skilled Worker sponsorship</h3>
          <label>
            Sponsorship duration
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            >
              {[12, 18, 24, 36, 48, 60].map((n) => (
                <option key={n} value={n}>
                  {n} months
                </option>
              ))}
            </select>
          </label>
          <label className="path-checkbox">
            <input
              type="checkbox"
              checked={large}
              onChange={(e) => setLarge(e.target.checked)}
            />{" "}
            Medium or large sponsor
          </label>
          <label className="path-checkbox">
            <input
              type="checkbox"
              checked={exempt}
              onChange={(e) => setExempt(e.target.checked)}
            />{" "}
            A verified Immigration Skills Charge exemption applies
          </label>
          <dl>
            <div>
              <dt>New Worker licence</dt>
              <dd>{money(cost.licence)}</dd>
            </div>
            <div>
              <dt>One certificate of sponsorship</dt>
              <dd>{money(cost.certificate)}</dd>
            </div>
            <div>
              <dt>Immigration Skills Charge</dt>
              <dd>{money(cost.skills)}</dd>
            </div>
            <div className="path-total">
              <dt>Illustrated employer charges</dt>
              <dd>{money(cost.total)}</dd>
            </div>
          </dl>
          <p>
            Not a business investment estimate or eligibility decision. Excludes
            salary, running costs, professional fees, visa fee, IHS and
            maintenance. A business with a suitable existing licence may not
            need a new licence fee.
          </p>
          <p>
            <strong>These sponsor charges are payable by the employer.</strong>{" "}
            Do not treat them as fees to sell a job or pass on to a sponsored
            worker. Check official exemptions and sponsor size rules.
          </p>
          <Source href="https://www.gov.uk/uk-visa-sponsorship-employers/apply-for-your-licence">
            Licence fee and sponsor size
          </Source>
          <Source href="https://www.gov.uk/uk-visa-sponsorship-employers/certificates-of-sponsorship">
            Certificate charge
          </Source>
          <Source href="https://www.gov.uk/uk-visa-sponsorship-employers/immigration-skills-charge">
            Skills charge and exemptions
          </Source>
        </div>
      </section>
      <section className="path-card">
        <h2>Before paying a consultant</h2>
        <p>
          Ask for their regulator and registration number, a written scope, all
          fees including VAT, refund terms and the evidence they need.
          Independently verify the adviser. Treat guaranteed visas, purchased
          certificates, sham jobs and “no real business needed” offers as
          warning signs.
        </p>
        <a href="/advisers">
          Check an adviser or solicitor <ArrowRight size={16} />
        </a>
      </section>
    </>
  );
}
function IndiaGuide() {
  return (
    <>
      <Hero
        tag="PLANNING FROM INDIA"
        title="Choose a route that fits your purpose."
        text="Compare the evidence, cost and next step for each route before paying for a course, job offer or immigration package."
      />
      <div className="path-note">
        <strong>
          There is no single “best” route for every Indian applicant.
        </strong>
        <p>
          A genuine job offer, academic goal, eligible qualification, business
          proposition or family relationship leads to a different assessment.
          Lower cost does not replace eligibility.
        </p>
      </div>
      <div className="path-grid">
        {content.routes
          .filter((r) =>
            [
              "Skilled Worker",
              "Student",
              "India Young Professionals Scheme",
              "High Potential Individual",
              "Global Talent",
              "Innovator Founder",
            ].includes(r.name),
          )
          .map((r) => (
            <article className="path-card" key={r.name}>
              <h2>{r.name}</h2>
              <p>{r.summary}</p>
              <p>{r.watch}</p>
              <Source href={r.url}>Check requirements and current fees</Source>
            </article>
          ))}
      </div>
      <section className="path-split">
        <div>
          <h2>A sensible order for your decision</h2>
          <ol className="path-steps">
            <li>
              Write down your actual purpose, qualifications, English evidence,
              work history and available budget.
            </li>
            <li>
              Check routes whose published conditions fit that evidence. The
              Young Professionals ballot is competitive, and a listed university
              must match the HPI graduation-year list.
            </li>
            <li>
              For study, verify the institution and exact course, recognition,
              entry requirements, CAS process and international fees.
            </li>
            <li>
              Calculate total costs without assuming a part-time job,
              scholarship, future sponsorship or settlement.
            </li>
            <li>
              Check current application requirements, any TB or ATAS
              requirement, dependants and the official application service
              before paying.
            </li>
          </ol>
        </div>
        <div className="path-card">
          <h2>Useful starting points</h2>
          <Source href="https://www.gov.uk/check-uk-visa">
            Official visa checker
          </Source>
          <Source href="https://www.gov.uk/india-young-professionals-scheme-visa">
            Young Professionals ballot guidance
          </Source>
          <Source href="https://www.gov.uk/tb-test-visa/countries-where-you-need-a-tb-test-to-enter-the-uk">
            TB testing requirements
          </Source>
          <Source href="https://www.gov.uk/guidance/academic-technology-approval-scheme">
            ATAS guidance
          </Source>
          <Source href="https://study-uk.britishcouncil.org/scholarships-funding">
            British Council scholarship information
          </Source>
          <Source href="https://www.chevening.org/scholarships/">
            Chevening scholarships
          </Source>
          <a href="/study/uk-costs">
            Compare study costs <ArrowRight size={16} />
          </a>
          <a href="/routes/business-self-sponsorship">
            Understand business sponsorship <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
type StudentResult = {
  meta: {
    total: number;
    source_date: string;
    source_rows: number;
    checked_at: string;
    last_success?: string;
    refresh_error: string | null;
  };
  items: {
    id: string;
    name: string;
    city: string;
    locations: string;
    type: string;
    status: string;
    routes: string[];
    compliance: string;
  }[];
  total: number;
  page: number;
  pages: number;
  types: string[];
};
function StudyDirectory() {
  const [q, setQ] = useState(""),
    [type, setType] = useState(""),
    [route, setRoute] = useState("Student"),
    [page, setPage] = useState(1),
    [data, setData] = useState<StudentResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      fetch(
        "/api/study/sponsors?" +
          new URLSearchParams({ q, type, route, page: String(page) }),
        { signal: controller.signal },
      )
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          return d;
        })
        .then(setData)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, type, route, page]);
  return (
    <>
      <Hero
        tag="UK STUDENT SPONSOR DIRECTORY"
        title="Find a place to learn. Check it properly."
        text="Search institutions on the official Student and Child Student sponsor register, then compare courses, fees and your study goals."
      />
      <div className="path-quick">
        <a href="/study/uk-costs">
          <GraduationCap /> Compare fees & plan your budget <ArrowRight />
        </a>
        <a href="/routes/india-to-uk">
          <Compass /> India-to-UK planning guide <ArrowRight />
        </a>
      </div>
      <div className="path-note">
        <strong>
          Licensed to sponsor does not mean every course qualifies.
        </strong>
        <p>
          This covers the institutions in our official register snapshot. It is
          not every UK college or course, an academic ranking, or a promise of
          admission, a CAS, a Graduate visa or a job. Child Student providers
          include schools; that route is separate from adult study.
        </p>
      </div>
      <section className="path-search" aria-label="Search student sponsors">
        <label>
          <span>Institution or location</span>
          <div className="path-input">
            <Search size={18} />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Try Cardiff, Wrexham or Chester"
              maxLength={100}
            />
          </div>
        </label>
        <label>
          Provider type
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All provider types</option>
            {data?.types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Route
          <select
            value={route}
            onChange={(e) => {
              setRoute(e.target.value);
              setPage(1);
            }}
          >
            <option>Student</option>
            <option>Child Student</option>
            <option value="all">Both routes</option>
          </select>
        </label>
      </section>
      {error ? (
        <p role="alert" className="path-note">
          {error}
        </p>
      ) : (
        <p role="status" className="path-muted">
          {busy
            ? "Checking the directory…"
            : `${data?.total.toLocaleString()} matching provider records · ${data?.meta.total.toLocaleString()} across the snapshot · Source ${data?.meta.source_date}`}
        </p>
      )}
      {data?.meta.refresh_error && (
        <p className="path-note">{data.meta.refresh_error}</p>
      )}
      {data &&
        Date.now() -
          new Date(data.meta.last_success || data.meta.checked_at).getTime() >
          3 * 86400000 && (
          <p className="path-note">
            The last successful check is older than three days. Use the current
            official register.
          </p>
        )}
      <div className="path-grid" aria-busy={busy}>
        {!error &&
          data?.items.map((s) => (
            <article className="path-card" key={s.id}>
              <span className="tag green">{s.type}</span>
              <h2>{s.name}</h2>
              <p>
                {s.city || "Town not listed"}
                {s.locations && ` · Other listed locations: ${s.locations}`}
              </p>
              <dl>
                <div>
                  <dt>Licence status</dt>
                  <dd>{s.status}</dd>
                </div>
                <div>
                  <dt>Routes</dt>
                  <dd>{s.routes.join(", ")}</dd>
                </div>
              </dl>
              {s.compliance && <p>{s.compliance}</p>}
              <p className="path-muted">
                Licence status is not a teaching-quality rating. Verify the
                current entry before paying.
              </p>
              <Source href={STUDENTS}>Check the official register</Source>
            </article>
          ))}
      </div>
      {!busy && !error && data?.total === 0 && (
        <p>
          No matching institution. Try its legal name, then check GOV.UK
          directly.
        </p>
      )}
      {data && data.pages > 1 && (
        <div className="path-pagination">
          <button
            className="secondary-button"
            disabled={busy || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {data.pages}
          </span>
          <button
            className="secondary-button"
            disabled={busy || page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
      <Source href={STUDENTS}>Download the current GOV.UK register</Source>
      <p className="path-muted">
        Contains public sector information licensed under the Open Government
        Licence v3.0. Directory checked daily; each source date is shown.
      </p>
      <section className="path-card">
        <h2>Before you choose a course</h2>
        <p>
          Ask the institution to confirm your campus, delivery mode, course
          duration, academic recognition, international entry criteria, total
          fees, deposit/refund policy and CAS eligibility in writing. Check the
          Graduate route conditions separately. Online, short and part-time
          courses can have different immigration consequences.
        </p>
        <Source href="https://www.gov.uk/student-visa/course">
          Eligible study and CAS guidance
        </Source>
        <Source href="https://www.gov.uk/check-a-university-is-officially-recognised">
          Check degree recognition
        </Source>
      </section>
    </>
  );
}
function StudyCosts() {
  const [level, setLevel] = useState("Postgraduate");
  const [input, setInput] = useState({
    tuition: 12500,
    scholarship: 0,
    months: 12,
    living: 1200,
    london: false,
    paid: 0,
    visa: 558,
    ihs: 1164,
    extras: 1000,
  });
  const budget = studyBudget(input);
  const set = (key: keyof typeof input, value: number | boolean) =>
    setInput((s) => ({ ...s, [key]: value }));
  return (
    <>
      <Hero
        tag="UK STUDY COSTS · INTERNATIONAL FEES"
        title="Compare the whole cost, not just the headline."
        text="Explore a small, checked set of published fees, then build a budget for your own course and circumstances."
      />
      <div className="path-note">
        <strong>
          Selected examples, not a UK-wide “cheapest colleges” ranking.
        </strong>
        <p>
          These eight records cover four universities. Fee bands are labelled
          separately from named courses. Prices are for the stated academic
          year, before unconfirmed discounts. Admission, live places, CAS
          eligibility and scholarship awards are not verified here. Confirm them
          directly.
        </p>
      </div>
      <section>
        <div className="path-section-title">
          <h2>Published international tuition</h2>
          <label>
            Study level
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option>Postgraduate</option>
              <option>Undergraduate</option>
              <option>All</option>
            </select>
          </label>
        </div>
        <div className="path-grid">
          {content.fees
            .filter((f) => level === "All" || f.level === level)
            .sort((a, b) => a.gbp - b.gbp)
            .map((f) => (
              <article className="path-card" key={f.institution + f.course}>
                <span className="tag green">
                  {f.type} · {f.year}
                </span>
                <h3>{f.course}</h3>
                <p>
                  {f.institution} · {f.city}
                </p>
                <strong className="path-price">{money(f.gbp)}</strong>
                <p>{f.basis}</p>
                <Source href={f.url}>View the institution's page</Source>
                {"feeSource" in f && f.feeSource && (
                  <Source href={f.feeSource}>International fee source</Source>
                )}
                <button
                  className="secondary-button"
                  onClick={() => {
                    set("tuition", f.gbp);
                    document
                      .getElementById("study-budget")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Use this tuition in my budget
                </button>
              </article>
            ))}
        </div>
      </section>
      <section className="path-split" id="study-budget">
        <div>
          <p className="eyebrow">AN EDITABLE ILLUSTRATION</p>
          <h2>What would you actually need?</h2>
          <p>
            The example starts with £12,500 tuition, 12 months of living costs
            at £1,200/month and £1,164 IHS. The IHS example assumes a Student
            visa lasting more than 12 and up to 18 months. Visa length can
            exceed course length; replace this with the official calculation.
          </p>
          <p>
            For an applicant who needs financial evidence, the published
            maintenance minimum is £1,529/month in London or £1,171/month
            outside London, for up to nine months, plus outstanding tuition on
            the CAS. Exceptions and evidence rules apply.
          </p>
          <p>
            <strong>The maintenance amount is not an extra fee.</strong> It is
            money to demonstrate, and may overlap with the living-cost budget.
            Do not add it to the estimated spend again. Nine months of evidence
            is not necessarily a full year's living costs.
          </p>
          <p>
            For the usual bank-funds route, the required funds generally need to
            be held for 28 consecutive days, ending within 31 days before
            application. Only count a confirmed scholarship or funding that
            meets the rules.
          </p>
          <Source href="https://www.gov.uk/student-visa/money">
            Official financial evidence rules
          </Source>
          <Source href="https://www.gov.uk/student-visa">
            Current Student application fee
          </Source>
          <Source href="https://www.gov.uk/healthcare-immigration-application/how-much-pay">
            Official IHS calculation rules
          </Source>
        </div>
        <div className="path-calculator">
          <h3>Your study budget</h3>
          <div className="path-form-grid">
            {(
              [
                { key: "tuition", label: "Tuition for the budget period (£)" },
                {
                  key: "scholarship",
                  label: "Confirmed tuition scholarship (£)",
                },
                { key: "months", label: "Months of living costs" },
                { key: "living", label: "Living budget per month (£)" },
                { key: "visa", label: "Visa application fee (£)" },
                { key: "ihs", label: "Healthcare surcharge (£)" },
                { key: "extras", label: "Travel, tests and other costs (£)" },
                { key: "paid", label: "Tuition already paid (£)" },
              ] as const
            ).map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="number"
                  min={0}
                  step={f.key === "months" ? 1 : 0.01}
                  value={input[f.key]}
                  onChange={(e) => set(f.key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <label className="path-checkbox">
            <input
              type="checkbox"
              checked={input.london}
              onChange={(e) => set("london", e.target.checked)}
            />{" "}
            Campus in London (for the maintenance illustration)
          </label>
          <dl aria-live="polite">
            <div>
              <dt>Tuition after confirmed scholarship</dt>
              <dd>{money(budget.tuition)}</dd>
            </div>
            <div>
              <dt>Living budget</dt>
              <dd>{money(budget.living)}</dd>
            </div>
            <div>
              <dt>Visa, IHS and other costs</dt>
              <dd>{money(budget.visa + budget.ihs + budget.extras)}</dd>
            </div>
            <div className="path-total">
              <dt>Estimated spend for this period</dt>
              <dd>{money(budget.total)}</dd>
            </div>
            <div>
              <dt>
                Separate illustration of required funds: outstanding tuition
                plus maintenance
              </dt>
              <dd>{money(budget.proofOfFunds)}</dd>
            </div>
          </dl>
          <p>
            For one adult student, no dependants. The illustration assumes
            financial evidence is required and does not apply loan, official
            sponsorship or accommodation offsets. Tuition already paid reduces
            outstanding funds, not your overall course cost. Estimates are not a
            visa assessment. Figures checked 5 October 2026.
          </p>
        </div>
      </section>
      <Source href="https://study-uk.britishcouncil.org/scholarships-funding">
        Explore scholarships with the British Council
      </Source>
    </>
  );
}
function SourceDirectory() {
  return (
    <>
      <Hero
        tag="IMMIGRATION INFORMATION WORTH CHECKING"
        title="Follow the source. Keep your own judgement."
        text="A starting list of official channels and specialist publishers for UK immigration and international study."
      />
      <div className="path-note">
        Some channels focus on immigration; others also cover education or
        government work. Listing is not an endorsement of every post. Follow
        social links from the publisher's own website to avoid impersonators. We
        do not copy or auto-publish their feeds.
      </div>
      <div className="path-grid">
        {content.channels.map((c) => (
          <article className="path-card" key={c.name}>
            <span className="tag green">{c.kind}</span>
            <h2>{c.name}</h2>
            <p>
              <strong>{c.scope}</strong>
            </p>
            <p>{c.note}</p>
            <Source href={c.url}>Official website and channel links</Source>
          </article>
        ))}
      </div>
      <section className="path-card">
        <h2>A 30-second check before sharing a post</h2>
        <ol className="path-steps">
          <li>Find the original GOV.UK source and the date it takes effect.</li>
          <li>
            Separate a proposal or announcement from a rule already in force.
          </li>
          <li>
            Check who the change applies to and any transitional conditions.
          </li>
          <li>
            Check a person offering paid advice on their regulator's register.
          </li>
          <li>
            Ignore guaranteed approvals, purchased job offers and messages
            requesting payment to a personal account.
          </li>
        </ol>
        <a href="/updates">
          Read our monitored official updates <ArrowRight size={16} />
        </a>
      </section>
    </>
  );
}
function EditorialPolicy() {
  return (
    <>
      <Hero
        tag="HOW WE EARN YOUR TRUST"
        title="Useful guidance needs visible evidence."
        text="What we publish, how we check it and how you can challenge a mistake."
      />
      <div className="path-grid two">
        <article className="path-card">
          <h2>Who prepares this information</h2>
          <p>
            Sponsor Intel is built and operated by Bala Shankar Bollineni. These
            pages use automated assistance and editorial source checks. They
            have not been signed off by a named regulated immigration
            professional. We provide general information, not personal legal
            advice.
          </p>
        </article>
        <article className="path-card">
          <h2>Our source order</h2>
          <p>
            Immigration Rules and current Home Office guidance come first.
            Institutions provide course and fee information; regulators provide
            registration information. Social posts and marketing pages are
            discovery leads, not proof of eligibility.
          </p>
        </article>
        <article className="path-card">
          <h2>Dates mean different things</h2>
          <p>
            A source publication date, effective date and our last check are
            separate. A successful automated fetch is not a fresh legal review.
            We keep source links and visible review dates. Automated monitoring
            flags official changes for review; it does not silently rewrite
            legal advice.
          </p>
        </article>
        <article className="path-card">
          <h2>Coverage and comparisons</h2>
          <p>
            We state whether a directory covers an official snapshot or selected
            examples. Sponsor status is not a job guarantee, provider approval
            is not a course recommendation, and regulatory levels are not
            customer ratings. No invented review stars, visa success rates or
            admission probabilities.
          </p>
        </article>
        <article className="path-card">
          <h2>Corrections and commercial interests</h2>
          <p>
            Use the feedback button to report a source, date or factual error.
            We review corrections against original evidence. These new route and
            fee comparisons contain no paid placements or commission-based
            ranking. Any future commercial placement must be labelled.
          </p>
          <a href="/?feedback=data">
            Report an information problem <ArrowRight size={16} />
          </a>
        </article>
        <article className="path-card">
          <h2>Personal information and AI</h2>
          <p>
            Application preparation requires consent before sending your CV to
            Cloudflare AI. Check every generated claim. Immigration chat
            retrieves official sources but can still make mistakes or refuse an
            unsupported answer. Personal cases belong with a regulated adviser.
          </p>
          <a href="/about">
            Read our data and source guide <ArrowRight size={16} />
          </a>
        </article>
      </div>
      <Source href="https://www.gov.uk/find-an-immigration-adviser">
        Find regulated personal advice
      </Source>
    </>
  );
}
