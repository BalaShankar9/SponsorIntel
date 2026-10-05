import React, { useEffect, useState } from "react";
import { ArrowUpRight, Search, ShieldCheck, Scale } from "lucide-react";
import "./platform.css";
const source =
  "https://www.gov.uk/government/publications/register-of-currently-registered-immigration-advice-organisations";
const finder = "https://www.gov.uk/find-an-immigration-adviser";
const external = { target: "_blank", rel: "noopener noreferrer" };
export function AdviserDirectory() {
  const [q, setQ] = useState(""),
    [level, setLevel] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(
        "/api/advisers?" +
          new URLSearchParams({ q, level, page: String(page) }),
        { signal: controller.signal },
      )
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error || "Please try again.");
          setData(d);
        })
        .catch((e) => {
          if (e.name !== "AbortError")
            setError(
              "We could not load the directory. Use the official adviser finder below.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, level, page]);
  return (
    <div className="platform">
      <section className="platform-hero">
        <span className="eyebrow">PEOPLE WHO CAN HELP</span>
        <h1>
          A clearer path starts
          <br />
          with qualified advice.
        </h1>
        <p>
          Find immigration advice organisations, check their registration and
          make a considered choice. No paid rankings or promises of a visa.
        </p>
        <div className="platform-actions">
          <a className="primary-button" href={finder} {...external}>
            <ShieldCheck size={17} /> Check a current registration{" "}
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
      <div className="source-note">
        <strong>
          A dated official directory, not a live authorisation check.
        </strong>{" "}
        These 2,274 organisations appear in the IAA’s 9 July 2026 snapshot,
        published 25 September 2026. Registration, websites and services can
        change. Check the organisation and individual adviser with the regulator
        before paying.{" "}
        <a href={source} {...external}>
          Read the source
        </a>
        .
        {data?.monitor?.new_attachment && (
          <p>
            <strong>A newer official attachment is awaiting review.</strong>{" "}
            This directory still uses the date shown above.
          </p>
        )}
        {data?.monitor?.withdrawn && (
          <p>
            <strong>
              The source publication is marked withdrawn. Use the live regulator
              register.
            </strong>
          </p>
        )}
      </div>
      <section className="career-panel">
        <h2>
          <Scale size={20} /> Looking for a solicitor or barrister?
        </h2>
        <p>
          IAA organisations are one part of the market. Solicitors and
          barristers can be regulated by other approved bodies and may not
          appear below. Use these official routes to search or check them.
        </p>
        <div className="regulator-links">
          <a href="https://solicitors.lawsociety.org.uk/" {...external}>
            Solicitors · England & Wales ↗
          </a>
          <a href="https://www.sra.org.uk/solicitors-register/" {...external}>
            Check an SRA firm ↗
          </a>
          <a href="https://www.lawscot.org.uk/find-a-solicitor/" {...external}>
            Solicitors · Scotland ↗
          </a>
          <a href="https://lawsoc-ni.org/using-a-solicitor" {...external}>
            Solicitors · Northern Ireland ↗
          </a>
          <a href={finder} {...external}>
            Barristers & other regulators ↗
          </a>
        </div>
      </section>
      <section className="career-panel">
        <h2>Search the IAA snapshot</h2>
        <div className="adviser-search">
          <label className="sr-only" htmlFor="adviser-search">
            Organisation name or registration number
          </label>
          <input
            id="adviser-search"
            type="search"
            placeholder="Organisation name or registration number"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <label className="sr-only" htmlFor="adviser-level">
            IAA advice level
          </label>
          <select
            id="adviser-level"
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All advice levels</option>
            {["Level 1", "Level 2", "Level 3"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <p className="fine-print">
          Advice levels describe authorised scope, not quality or a customer
          rating.{" "}
          <a
            href="https://www.gov.uk/find-an-immigration-adviser/what-advisers-can-do"
            {...external}
          >
            Understand the levels
          </a>
          . Location and price are not available in this spreadsheet; use the
          official finder or the firm’s website.
        </p>
      </section>
      {error && (
        <p className="career-error" role="alert">
          {error}{" "}
          <a href={finder} {...external}>
            Official finder
          </a>
        </p>
      )}
      {loading && <p role="status">Searching the official snapshot…</p>}
      {data && !loading && !error && (
        <>
          <p aria-live="polite">
            {data.total.toLocaleString("en-GB")} organisations
            {q ? " matching your search" : ""} · Page {data.page} of{" "}
            {data.pages || 1}
          </p>
          <div className="adviser-grid">
            {data.items.map((a: any) => (
              <article className="adviser-card" key={a.id}>
                <span className="tag green">{a.level} · IAA snapshot</span>
                <h2>{a.name}</h2>
                <p>
                  Registration number: <strong>{a.id}</strong>
                </p>
                <p>Listed as of 9 July 2026</p>
                <small>Customer rating: not available here</small>
                <div className="platform-actions">
                  {a.website && (
                    <a href={a.website} {...external}>
                      Listed website <ArrowUpRight size={13} />
                    </a>
                  )}
                  <a href={finder} {...external}>
                    Check registration ↗
                  </a>
                  <a
                    href={
                      "https://www.google.com/search?" +
                      new URLSearchParams({
                        q: '"' + a.name + '" immigration reviews',
                      })
                    }
                    {...external}
                  >
                    Find independent reviews ↗
                  </a>
                </div>
              </article>
            ))}
          </div>
          {!data.items.length && (
            <section className="career-panel">
              <h2>No organisation found</h2>
              <p>
                Try a shorter name or search the regulator directly. Absence
                here does not establish whether a firm is authorised.
              </p>
            </section>
          )}
          <div className="platform-actions">
            <button
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
      <section className="career-panel">
        <h2>Choose with confidence</h2>
        <p>
          Match the name and registration number. Confirm the adviser can handle
          your type of case. Ask for a written fee quote, the work included and
          the complaints process. Be cautious of guaranteed visas, jobs or
          sponsorship.
        </p>
        <p>
          <strong>Reviews are separate from regulation.</strong> We link out to
          independent review searches. Licensed review-provider data is not
          connected, so we do not display star scores or rank firms by
          reputation. Check the exact business, review dates, volume and
          recurring themes on the original source.
        </p>
        <a
          href="https://www.gov.uk/find-an-immigration-adviser/hiring-an-adviser"
          {...external}
        >
          What to check before hiring an adviser ↗
        </a>
      </section>
      <p className="fine-print">
        Contains public sector information licensed under the{" "}
        <a
          href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
          {...external}
        >
          Open Government Licence v3.0
        </a>
        . Source: Immigration Advice Authority. Inclusion is not an endorsement.
        Directory publication checks run daily; new spreadsheet versions require
        review before import.
      </p>
    </div>
  );
}
