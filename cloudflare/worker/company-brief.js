import { getJobDetail } from "./jobs.js";
import { JOB_FRESHNESS_MS } from "../shared/job-detail.js";
export async function companyBrief(application, env, now = Date.now()) {
  const id = application.jobId;
  const job = /^[a-f0-9]{24}$/.test(id || "")
    ? await getJobDetail(id, env)
    : null;
  const current =
    job &&
    job.company.toLowerCase() === application.company.toLowerCase() &&
    job.active !== 0 &&
    Date.parse(job.last_seen) <= now + 300000 &&
    now - Date.parse(job.last_seen) <= JOB_FRESHNESS_MS;
  if (!current)
    return `COMPANY RESEARCH — EVIDENCE NEEDED\n\nWe could not match this application to a current monitored advert for ${application.company}. No external company facts have been generated.\n\nRESEARCH CHECKLIST\n- Start at the employer's own website and confirm its legal name.\n- Re-open the vacancy and confirm that it is still accepting applications.\n- Record dated evidence about its product, customers, team and working arrangements.\n- Confirm sponsorship for this role directly with the employer.\n- Use Companies House for legal registration, not as a guarantee of hiring or financial health.\n\nQuestions: What would success look like in the first three months? Who would I work with? What is the hiring process? Is visa sponsorship available for my circumstances?`;
  const sentences = job.description
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
  const evidence = sentences
    .filter((s) =>
      /\b(?:company|we|our|team|product|customer|mission|remote|hybrid|office)\b/i.test(
        s,
      ),
    )
    .slice(0, 6)
    .map((s) => "- " + s.slice(0, 650));
  return `COMPANY BRIEF — EMPLOYER ADVERT EVIDENCE\n\n${job.company}\nRole: ${job.title}\nLocation as advertised: ${job.location}\nAdvert last observed: ${job.last_seen}\nBrief prepared: ${new Date(now).toISOString()}\n\nWHAT THE ADVERT SAYS\n${evidence.join("\n\n") || "No reliable company-description passages were identified. Read the source advert."}\n\nSPONSORSHIP EVIDENCE\n${job.evidence || "The advert does not state sponsorship. Ask the employer."}\n\nSOURCE\n${job.apply_url}\n${job.source?.careers_url || ""}\n\nWHAT THIS DOES NOT VERIFY\nThese are employer statements, not independent verification of working culture, funding, headcount, financial health or personal visa eligibility. No market-news search has been performed. Re-open the advert before applying.\n\nQUESTIONS FOR THE INTERVIEW\n- Which team priorities would this role address first?\n- What evidence would demonstrate success in the first three months?\n- What support and feedback would I receive?\n- Which advertised working arrangements apply to this role?\n- Can you confirm sponsorship eligibility and costs for this particular vacancy?`;
}
