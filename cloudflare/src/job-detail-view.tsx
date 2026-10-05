import React from "react";
import { ArrowLeft, ArrowUpRight, MapPin, ShieldCheck, Clock3, FileText } from "lucide-react";
import type { Job } from "./career-data";
import { jobAvailability, jobLabels, jobTimestamp } from "../shared/job-detail.js";

const external = { target: "_blank", rel: "noopener noreferrer" };
export function JobDetailView({
  job, actions, report, now = Date.now(),
}: {
  job: Job; actions?: React.ReactNode; report?: React.ReactNode; now?: number;
}) {
  const availability = jobAvailability(job, now);
  return (
    <article className="role-page">
      <a className="role-back" href="/jobs"><ArrowLeft size={16} /> All opportunities</a>
      <header className="role-heading">
        <p className="eyebrow">A CLOSER LOOK AT YOUR NEXT STEP</p>
        <div className="role-company">
          <span className="company-initial">{job.company.slice(0, 2).toUpperCase()}</span>
          <span>{job.company}{job.sector_label && <small>{job.sector_label}</small>}</span>
        </div>
        <h1>{job.title}</h1>
        <p className="role-location"><MapPin size={17} />{job.location}</p>
        <div className="role-tags">
          <span className={"sponsorship-tag " + job.sponsorship}>{jobLabels[job.sponsorship] || "Sponsorship not stated"}</span>
          {job.level === "early_career" && <span className="career-level">Early career title</span>}
          {job.employment_type && <span>{job.employment_type.replace(/([a-z])([A-Z])/g, "$1 $2")}</span>}
          {job.workplace && <span>{job.workplace}</span>}
        </div>
      </header>
      {availability !== "current" && (
        <div className="role-availability" role="status">
          <Clock3 size={21} />
          <div><strong>{availability === "removed" ? "No longer in our current collection" : "This information needs a fresh check"}</strong>
            <p>{availability === "removed"
              ? "This advert was absent from the last successful employer-board refresh. It may have closed or moved."
              : "We have not seen this advert successfully within the last three days. Its availability is uncertain."} Check the employer’s website and explore current opportunities.</p>
          </div>
        </div>
      )}
      {job.source?.error && availability === "current" && (
        <p className="career-notice" role="status">The latest employer-board refresh was delayed. The last successfully read advert is shown below.</p>
      )}
      <div className="role-layout">
        <div className="role-main">
          <section className={"role-panel role-evidence " + job.sponsorship} aria-labelledby="role-evidence-heading">
            <p className="role-section-label"><ShieldCheck size={17} /> READ THE EVIDENCE</p>
            <h2 id="role-evidence-heading">What does the advert say about sponsorship?</h2>
            {job.evidence ? <blockquote>“{job.evidence}”</blockquote> : (
              <p>We did not find a clear sponsorship commitment in the advert text. Ask the employer about this specific role.</p>
            )}
            <p className="role-caption">
              {job.sponsorship === "conditional"
                ? "The wording includes conditions. Ask which conditions apply before relying on this opportunity."
                : job.sponsorship === "unavailable"
                  ? "The advert contains wording that says sponsorship is unavailable. Check the original wording before proceeding."
                  : job.sponsorship === "offered"
                    ? "The advert states sponsorship support. This does not confirm that every applicant or role meets the requirements."
                    : "“Not stated” means unknown; it does not mean yes or no."}
              {" "}Labels are extracted automatically. A sponsor licence does not confirm sponsorship for every vacancy.
            </p>
            <a href={job.apply_url} {...external} className="text-button">Read the original wording <ArrowUpRight size={14} /></a>
          </section>
          <section className="role-panel role-description" aria-labelledby="role-description-heading">
            <p className="role-section-label"><FileText size={17} /> FROM THE EMPLOYER</p>
            <h2 id="role-description-heading">The role, in their words</h2>
            <p className="role-caption">Text from the employer’s advert. The original page has the latest details and application instructions.</p>
            <div className="role-advert">{job.description}</div>
          </section>
        </div>
        <aside className="role-sidebar" aria-label="Role facts and next steps">
          <section className="role-panel role-next-step">
            <p className="role-section-label">YOUR NEXT STEP</p>
            <h2>{availability === "current" ? "Make a thoughtful application." : "Find a current opportunity."}</h2>
            <p>{availability === "current"
              ? "Keep this role with your applications, then prepare documents using your own experience."
              : "Preparation is paused for this listing. You can still check the employer’s website."}</p>
            {actions}
            <a className="secondary-button" href={job.apply_url} {...external}>{availability === "current" ? "Open employer advert" : "Check employer website"} <ArrowUpRight size={16} /></a>
            {availability !== "current" && <a className="primary-button" href="/jobs">Explore current roles</a>}
            <p className="role-caption">Applications are made on the employer’s site. Being listed here does not guarantee availability or sponsorship.</p>
          </section>
          <section className="role-panel role-facts">
            <h2>The details we can show</h2>
            <h3>Pay in the advert</h3>
            {job.salary_excerpt ? <blockquote>“{job.salary_excerpt}”</blockquote> : <p>A clear UK pay statement was not found in the text we checked. Confirm pay with the employer.</p>}
            <h3>Seen on the employer’s board</h3>
            <p>{jobTimestamp(job.last_seen)}</p>
            {job.source_updated_at && <><h3>Date supplied by the source</h3><p>{jobTimestamp(job.source_updated_at)}</p><p className="role-caption">This may be a publication or edit date.</p></>}
            <h3>Source</h3>
            <p>{job.provider === "greenhouse" ? "Greenhouse" : job.provider === "lever" ? "Lever" : job.provider === "ashby" ? "Ashby" : "Employer"} public job board</p>
            {job.source?.careers_url && <a className="text-button" href={job.source.careers_url} {...external}>Employer careers page <ArrowUpRight size={14} /></a>}
          </section>
          <section className="role-panel role-checklist">
            <h2>Before you apply</h2>
            <ol>
              <li>Check the role’s location, requirements and closing date on the original advert.</li>
              <li>Confirm sponsorship for this vacancy if you need it.</li>
              <li>Use examples from your own experience in the application.</li>
            </ol>
            <a className="text-button" href={"/?q=" + encodeURIComponent(job.company)}>Research this employer <ArrowUpRight size={14} /></a>
            <a className="text-button" href="/guides/sponsorship-in-job-adverts">Understand sponsorship wording <ArrowUpRight size={14} /></a>
            {report}
          </section>
        </aside>
      </div>
    </article>
  );
}
