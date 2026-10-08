import React from "react";
import { ArrowLeft, ArrowUpRight, MapPin, ShieldCheck, Clock3, FileText } from "lucide-react";
import type { Job } from "./career-data";
import { jobAvailability, jobLabels, jobTimestamp } from "../shared/job-detail.js";
import { payEvidence } from "../shared/pay-evidence.js";
import { originalJobPublication } from "../shared/job-posting.js";

const external = { target: "_blank", rel: "noopener noreferrer" };
export function JobDetailView({
  job, actions, report, now = Date.now(),
}: {
  job: Job; actions?: React.ReactNode; report?: React.ReactNode; now?: number;
}) {
  const availability = jobAvailability(job, now);
  const pay = payEvidence(job.description);
  const published = originalJobPublication(job, now);
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
          <div><strong>{availability === "expired" ? "The advertised deadline has passed" : availability === "removed" ? "No longer in our current collection" : "This information needs a fresh check"}</strong>
            <p>{availability === "expired"
              ? "The closing date supplied by the employer has passed. We have removed this role from current opportunities."
              : availability === "removed"
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
          <section className="role-panel role-licence" aria-labelledby="role-licence-heading">
            <p className="role-section-label"><ShieldCheck size={17} /> EMPLOYER REGISTER CHECK</p>
            <h2 id="role-licence-heading">Is there a sponsor licence linked to this employer?</h2>
            {job.employer_licence ? <>
              <p><strong>{job.employer_licence.name}</strong>{job.employer_licence.city && ` · ${job.employer_licence.city}`} is listed for the Skilled Worker route in the register dated {jobTimestamp(job.employer_licence.source_date)}.</p>
              <p className="role-caption">We reviewed a link between this employer’s brand or group and that register entry. Ask which legal entity would employ and sponsor you. This does not change the advert’s sponsorship wording above or confirm eligibility for this role.</p>
              <p className="role-caption">Register last checked {jobTimestamp(job.employer_licence.checked_at)}. Employer link reviewed {jobTimestamp(job.employer_licence.reviewed_at)}.</p>
              <div className="role-licence-links">
                <a className="text-button" href={`/?q=${encodeURIComponent(job.employer_licence.name)}`}>View sponsor record <ArrowUpRight size={14} /></a>
                <a className="text-button" href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers" {...external}>Official register <ArrowUpRight size={14} /></a>
                {job.employer_licence.evidence_url && <a className="text-button" href={job.employer_licence.evidence_url} {...external}>Employer identity source <ArrowUpRight size={14} /></a>}
              </div>
            </> : <>
              <p>We do not currently have a verified licence link for this employer. It may still be licensed; this is not a finding that it cannot sponsor.</p>
              <a className="text-button" href={`/?q=${encodeURIComponent(job.company)}`}>Check the sponsor directory <ArrowUpRight size={14} /></a>
            </>}
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
            <h3>Advertised closing date</h3>
            <p>{job.application_deadline ? jobTimestamp(job.application_deadline) : "No verified deadline supplied"}</p>
            <p className="role-caption">{job.application_deadline && /^\d{4}-\d{2}-\d{2}$/.test(job.application_deadline)
              ? "The source gives a date but no time. We hide this listing after that UK calendar day. Confirm the exact cutoff with the employer; it may close earlier."
              : "Check the employer’s advert before applying; dates may change and recruitment may close early."}</p>
            <h3>Pay in the advert</h3>
            {pay.quotes.length ? <>
              {pay.multiple && <p className="role-caption"><strong>Several pay statements appear in this advert.</strong> They may describe different terms or disagree. Confirm which applies to this role.</p>}
              {pay.quotes.map((quote, index) => <blockquote key={index}>“{quote}”</blockquote>)}
              {pay.variablePay && <p className="role-caption">OTE means on-target earnings and can include commission. It is not a guaranteed base salary.</p>}
              {pay.proRata && <p className="role-caption">Pro rata means pay is adjusted for the working time or contract period. Confirm the amount you would actually receive.</p>}
              {pay.shortened && <p className="role-caption">These excerpts are shortened. Read the full advert for all pay terms.</p>}
              <p className="role-caption">Quoted from the advert; amounts have not been reconciled or assessed against visa salary requirements.</p>
            </> : <p>A clear UK pay statement was not found in the text we checked. Confirm pay with the employer.</p>}
            <h3>Seen on the employer’s board</h3>
            <p>{jobTimestamp(job.last_seen)}</p>
            {job.provider === 'smartrecruiters' && job.description_checked_at && <><h3>Advert text retrieved</h3><p>{jobTimestamp(job.description_checked_at)}</p><p className="role-caption">We recheck the employer’s vacancy list at each successful refresh. Unchanged advert versions may use text retrieved within the past seven days. Re-read the original advert before applying.</p></>}
            {published && <><h3>Originally published by the employer</h3><p><time dateTime={published}>{jobTimestamp(published)}</time></p><p className="role-caption">The original publication date supplied by Greenhouse. A later edit or refresh does not make this a new vacancy.</p></>}
            {job.source_updated_at && <><h3>{job.provider === 'greenhouse' ? 'Last edited by the source' : job.provider === 'teaching-vacancies' ? 'Published on Teaching Vacancies' : 'Date supplied by the source'}</h3><p>{jobTimestamp(job.source_updated_at)}</p><p className="role-caption">{job.provider === 'greenhouse' ? 'An edit date does not establish when the vacancy first opened.' : job.provider === 'teaching-vacancies' ? 'The original listing supplies a calendar date, without a publication time.' : 'This may be a publication or edit date.'}</p></>}
            <h3>Source</h3>
            <p>{job.provider === "teaching-vacancies" ? "Department for Education — Teaching Vacancies" : job.provider === "university-rss" ? "Official university vacancy feed" : `${job.provider === "greenhouse" ? "Greenhouse" : job.provider === "lever" ? "Lever" : job.provider === "ashby" ? "Ashby" : job.provider === "smartrecruiters" ? "SmartRecruiters" : "Employer"} public job board`}</p>
            {job.provider === "university-rss" && <p className="role-caption">A selection of recent campus vacancies, not every university role. Feed text may omit attachments or further eligibility details; check the full advert.</p>}
            {job.provider === "teaching-vacancies" && <p className="role-caption">Contains Department for Education Teaching Vacancies listing information, licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" {...external}>Open Government Licence v3.0</a>. We check the full advert text; attachments and external application forms may contain further conditions. Sponsorship wording is supplied by the advertiser and does not establish your eligibility. <a href={job.apply_url} {...external}>Read the original advert for free</a>.</p>}
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
