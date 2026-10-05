import React, { useEffect, useState } from "react";
import { Bookmark, Check, Copy, Loader2, Sparkles } from "lucide-react";
import { useCareer, request, type Job } from "./career-data";
import type { ReportFeedback } from "./feedback";
import { JobDetailView } from "./job-detail-view";
import { jobAvailability, JOB_ORIGIN, jobPath } from "../shared/job-detail.js";
import { updateJobMetadata } from "./seo";
import "./job-detail.css";

function initialJob(id: string): Job | null {
  if (typeof document === "undefined") return null;
  try {
    const value = JSON.parse(document.getElementById("job-data")?.textContent || "null");
    return value?.id === id ? value : null;
  } catch { return null; }
}

export function JobDetail({
  id, go, onReport,
}: { id: string; go: (view: string) => void; onReport: ReportFeedback }) {
  const c = useCareer();
  const [job, setJob] = useState<Job | null>(() => initialJob(id));
  const [error, setError] = useState(""), [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [showLink, setShowLink] = useState(false);
  const shareURL = JOB_ORIGIN + jobPath(id);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/jobs/" + id, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) {
          setMissing(true); setJob(null); return;
        }
        if (!r.ok) throw new Error("We could not refresh this role. Please try again.");
        const value = await r.json() as Job;
        if (value.id !== id) throw new Error("We could not load this role.");
        setJob(value); setMissing(false);
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, retry]);
  useEffect(() => updateJobMetadata(job, id, missing), [job, id, missing]);
  // Recheck while a tab is left open, including after returning to it.
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setRetry((v) => v + 1); };
    const timer = window.setInterval(refresh, 5 * 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  async function save(prepare: boolean) {
    if (!c.ready || busy) return;
    setBusy(true); setMessage("");
    try {
      const current = await request<Job>("/api/jobs/" + id);
      setJob(current);
      if (jobAvailability(current) !== "current") {
        setMessage("This listing is no longer current. Check the employer’s website before continuing.");
        return;
      }
      const application = c.saveJob(current);
      if (!application) return;
      // Refresh source evidence, preserving the person's notes and documents.
      c.updateApplication(application, {
        title: current.title, location: current.location, description: current.description || "",
        url: current.apply_url, sponsorship: current.sponsorship,
        evidence: current.evidence, checkedAt: current.last_seen,
      });
      if (prepare) go("studio");
      else setMessage("Saved to My applications. You can come back to prepare it.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally { setBusy(false); }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareURL);
      setMessage("Link copied. It opens this role without sharing your private workspace.");
    } catch {
      setShowLink(true);
      setMessage("Copy the link below to share this opportunity.");
    }
  }
  if (missing || (!job && error)) return (
    <section className="career-empty" role={error ? "alert" : undefined}>
      <h1>{missing ? "We couldn’t find that opportunity." : "This role could not be loaded."}</h1>
      <p>{missing ? "The link may be incorrect or the listing may no longer be available. Explore the current collection." : error}</p>
      {!missing && <button className="secondary-button" onClick={() => setRetry((v) => v + 1)}>Try again</button>}
      <a className="primary-button" href="/jobs">Explore current roles</a>
    </section>
  );
  if (!job) return <div className="role-loading" role="status"><Loader2 className="spin" /> Opening the opportunity…</div>;
  const current = jobAvailability(job) === "current";
  const saved = c.data.applications.some((a) => a.jobId === id);
  return <>
    {error && <p className="career-error" role="alert">{error}<button onClick={() => setRetry((v) => v + 1)}>Try again</button></p>}
    <JobDetailView job={job} actions={<>
      <button className="primary-button" disabled={!current || !c.ready || busy} onClick={() => void save(true)}>
        {busy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />} Prepare application
      </button>
      <button className="secondary-button" disabled={!current || !c.ready || busy} onClick={() => void save(false)}>
        {saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? "Saved to applications" : "Save role"}
      </button>
      <button className="text-button role-copy" onClick={() => void copyLink()}><Copy size={16} /> Copy role link</button>
      {message && <p className="role-action-message" role="status">{message}</p>}
      {showLink && <label className="role-share-link">Role link<input readOnly value={shareURL} onFocus={(e) => e.target.select()} /></label>}
    </>} report={
      <button className="report-information" onClick={() => onReport("data", {
        type: "job", id: job.id, label: (job.title + " · " + job.company).slice(0, 240),
      })}>Report an issue with this role</button>
    } />
  </>;
}
