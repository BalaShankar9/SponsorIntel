import { boundedText, idFor } from "./data.js";
import { XMLParser, XMLValidator } from "fast-xml-parser";

import { BOARDS, SECTORS, UNIVERSITY_FEEDS } from "./job-sources.js";
import { employerLicences } from "./employer-licences.js";
import { currentJobs } from "./current-jobs.js";
import { jobFilter } from "./job-filters.js";
import { parseJobDeadline, universityClosingDate } from "./job-deadlines.js";
import { payEvidence } from "../shared/pay-evidence.js";
import { JOB_FRESHNESS_MS } from "../shared/job-detail.js";
export { BOARDS } from "./job-sources.js";

export function plainText(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(
      /&(lsquo|rsquo|ldquo|rdquo|ndash|mdash|bull|pound|euro|hellip);/gi,
      (_, key) =>
        ({
          lsquo: "‘",
          rsquo: "’",
          ldquo: "“",
          rdquo: "”",
          ndash: "–",
          mdash: "—",
          bull: "•",
          pound: "£",
          euro: "€",
          hellip: "…",
        })[key.toLowerCase()],
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      parseInt(n, 16) < 0x110000 ? String.fromCodePoint(parseInt(n, 16)) : "",
    )
    .replace(/&#(\d+);/g, (_, n) =>
      Number(n) < 0x110000 ? String.fromCodePoint(Number(n)) : "",
    )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

// Ported from HireStack's URL canonicalizer. Preserve gh_jid: some boards need it.
export function canonicalJobURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    const host = url.hostname;
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.includes(":") ||
      /^[\d.]+$/.test(host)
    )
      return "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(gh_src|gclid|fbclid|mc_cid|mc_eid|_ga|_gl)$/i.test(key))
        url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().slice(0, 2000);
  } catch {
    return "";
  }
}

export function sponsorshipEvidence(text) {
  const sentences = plainText(text)
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const relevant = sentences.filter(
    (s) =>
      /visa|immigration|work permit|right to work/i.test(s) &&
      /sponsor/i.test(s),
  );
  const negative = relevant.find((s) =>
    /(?:cannot|can't|unable to|do not|don't|does not|won't|will not|not able to|not in a position to).{0,30}(?:offer|provide|support|sponsor|consider|arrange)|no (?:visa|immigration|work permit) sponsorship|no relocation (?:support|assistance|benefits) and (?:visa|immigration) sponsorship|(?:visa|immigration|work permit) sponsorship.{0,25}(?:not available|unavailable|not provided|not offered)|without (?:requiring|needing) (?:visa )?sponsorship|(?:would|will|must|should|do|does) not (?:require|need) (?:visa |immigration |work permit )?sponsorship|(?:visa )?sponsorship (?:is )?not (?:possible|provided|supported)/i.test(
      s,
    ),
  );
  if (negative) return { status: "unavailable", quote: negative.slice(0, 500) };
  const positive = relevant.find(
    (s) =>
      !s.endsWith("?") &&
      /\bwe (?:can |will |may |do |are able to |are happy to )?(?:offer|provide|support) (?:\w+ ){0,3}(?:visa|immigration|work permit) sponsorship|\b(?:visa|immigration|work permit) sponsorship (?:is |will be |can be |may be )?(?:available|provided|offered|supported)\b|\bwe (?:can|will|may|are able to) sponsor (?:your |a |the )?(?:visa|work permit)|^[-• ]*relocation (?:support|assistance|benefits) and (?:visa|immigration) sponsorship\b/i.test(
        s,
      ),
  );
  if (positive)
    return {
      status:
        /eligible|eligibility|depend|case.by.case|subject to|may |can |consider|certain|selected roles|some (?:roles|teams)|where|if /i.test(
          positive,
        )
          ? "conditional"
          : "offered",
      quote: positive.slice(0, 500),
    };
  return { status: "not_stated", quote: "" };
}

export function isUK(location, country = "") {
  if (country) return /^(GB|GBR|UK|United Kingdom)$/i.test(country.trim());
  if (/united kingdom|\bUK\b|\(GB\)/i.test(location)) return true;
  if (
    /united states|\bUSA?\b|,?\s(?:MA|CA|CT|OH|TX)\b|canada|ontario|australia|new south wales|new zealand|new england/i.test(
      location,
    )
  )
    return false;
  if (/\b(?:england|scotland|wales)\b|northern ireland/i.test(location))
    return true;
  return /\b(london|manchester|cardiff|edinburgh|glasgow|birmingham|bristol|leeds|belfast|nottingham|sheffield|reading|brighton|oxford|warwick|derby|motherwell|newcastle upon tyne|cambridge|southampton|liverpool|leicester|coventry|swansea|aberdeen|dundee|wallingford)\b/i.test(
    location,
  );
}

export function ukLocations(job, provider) {
  const primary =
    typeof job.location === "string"
      ? job.location
      : job.location?.name || job.categories?.location || "";
  const country =
    job.country || job.address?.postalAddress?.addressCountry || "";
  const locations = isUK(primary, country) ? [primary || "United Kingdom"] : [];
  // Some Greenhouse posts share a multi-office department despite a specific
  // overseas posting location. Only use offices to resolve an ambiguous label.
  if (
    provider === "greenhouse" &&
    !locations.length &&
    (!primary ||
      /^(hybrid|remote|on[ -]?site|multiple locations|various locations|EMEA|Europe)$/i.test(
        primary.trim(),
      ))
  ) {
    for (const office of job.offices || []) {
      const value = office.location || office.name || "";
      if (isUK(value)) locations.push(value);
    }
  }
  if (provider === "ashby") {
    for (const secondary of job.secondaryLocations || []) {
      if (
        isUK(
          secondary.location || "",
          secondary.address?.addressCountry ||
            secondary.address?.postalAddress?.addressCountry ||
            "",
        )
      )
        locations.push(secondary.location || "United Kingdom");
    }
  }
  if (provider === "lever") {
    for (const value of job.categories?.allLocations || []) {
      // A structured primary country takes priority over an ambiguous city.
      if (value !== primary && isUK(value)) locations.push(value);
    }
  }
  return [...new Set(locations.map(plainText).filter(Boolean))].join(" · ");
}

export function careerLevel(title) {
  if (
    /\bintern(?:ship)?\b|\bgraduate\b|\bjunior\b|entry.level|early.career|apprentic|\btrainee\b/i.test(
      title,
    )
  )
    return "early_career";
  if (/senior|staff|principal|director|head of|lead\b|manager/i.test(title))
    return "experienced";
  return "not_stated";
}

// Lever stores requirements and exclusions outside the introduction. Include
// every published section before looking for sponsorship evidence.
export function advertText(job, provider) {
  const parts =
    provider === "lever"
      ? [
          job.descriptionPlain || job.description,
          ...(Array.isArray(job.lists) ? job.lists : []).map((x) =>
            [x.text, x.content].filter(Boolean).join("\n"),
          ),
          job.additionalPlain || job.additional,
          job.salaryDescriptionPlain || job.salaryDescription,
        ]
      : [
          job.content || job.descriptionPlain || job.descriptionHtml,
          job.compensation?.scrapeableCompensationSalarySummary,
        ];
  return parts.map(plainText).filter(Boolean).join("\n\n");
}

export function isTalentPool(title) {
  return /talent (?:community|pool|network)|speculative|expression of interest|register (?:your )?interest|future opportunities|general application|job template|^test (?:job|posting)$|^dummy (?:job|posting)$/i.test(
    title,
  );
}

export function salaryExcerpt(text) {
  // Backward-compatible list marker. The detail page reads every pay statement.
  return (payEvidence(plainText(text)).quotes[0] || "").slice(0, 400);
}

export async function normaliseBoardJobs(raw, board, now = Date.now()) {
  if (!Array.isArray(raw) || raw.length > 5000)
    throw new Error("Invalid board response");
  const result = [],
    seen = new Set();
  for (const job of raw) {
    if (!job || typeof job !== "object")
      throw new Error("Invalid vacancy record");
    if (job.isListed === false) continue;
    // Greenhouse explicitly identifies prospect posts with a null internal id.
    if (board.provider === "greenhouse" && job.internal_job_id === null)
      continue;
    const deadline = parseJobDeadline(job.application_deadline);
    if (deadline.closes_at && Date.parse(deadline.closes_at) <= now) continue;
    const location = ukLocations(job, board.provider);
    if (!location) continue;
    const completeText = advertText(job, board.provider);
    // Do not truncate away an eligibility exclusion and then label an advert.
    if (completeText.length > 80000) continue;
    const description = completeText;
    const apply_url = canonicalJobURL(
      job.absolute_url || job.hostedUrl || job.jobUrl || job.applyUrl,
    );
    const title = plainText(job.title || job.text).slice(0, 240);
    // Some adverts recruit in London for a role that requires moving abroad.
    const relocation = title.match(/\brelocat(?:e|ing|ion) to ([^|()]+)/i)?.[1];
    if (relocation && !isUK(relocation)) continue;
    if (
      !title ||
      !description ||
      !apply_url ||
      (!job.id && !job.jobUrl) ||
      isTalentPool(title) ||
      seen.has(apply_url)
    )
      continue;
    seen.add(apply_url);
    const evidence = sponsorshipEvidence(description);
    result.push({
      id: await idFor(board.id + ":" + (job.id || apply_url)),
      board_id: board.id,
      company: board.company,
      title,
      location: location.slice(0, 300),
      description,
      apply_url,
      provider: board.provider,
      ...deadline,
      source_updated_at: String(job.updated_at || job.publishedAt || "").slice(
        0,
        40,
      ),
      sponsorship: evidence.status,
      evidence: evidence.quote,
      level: careerLevel(title),
      salary_excerpt: salaryExcerpt(description),
      employment_type: plainText(
        job.employmentType || job.categories?.commitment || "",
      ).slice(0, 100),
      workplace: plainText(
        job.workplaceType ||
          (/^(hybrid|remote|on[ -]?site)$/i.test(job.location?.name || "")
            ? job.location.name
            : ""),
      )
        .replace(/^./, (s) => s.toUpperCase())
        .slice(0, 60),
    });
  }
  return result;
}

export function universityRestriction(title, description, feed = {}) {
  const text = plainText(description), heading = plainText(title);
  // Only explicit restrictions: ordinary references to internal colleagues,
  // secondment options or welcoming internal/external applicants are not exclusions.
  if (/\binternal(?:[ -](?:candidates|applicants))?[ -]only\b/i.test(heading) ||
      /\b(?:this (?:post|role|vacancy|position|opportunity)|applications?) (?:is |are |will be )?(?:restricted|limited) to (?:current|existing|internal) (?:members of staff|staff|employees|applicants|candidates)\b/i.test(text) ||
      /\b(?:open|available) (?:only|exclusively) to (?:current|existing|internal) (?:members of staff|staff|employees|applicants|candidates)\b/i.test(text) ||
      /\b(?:open|available) to internal (?:applicants|candidates) only\b/i.test(text))
    return "internal_only";
  if ((feed.holdMarkers || []).some(marker => text.split(/\s+/).includes(marker)))
    return "unreviewed_distribution_marker";
  return null;
}

export function universityFeedSnapshot(xml, boardId, now = Date.now()) {
  const feed = UNIVERSITY_FEEDS[boardId];
  if (!feed || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error("Invalid university feed");
  const channel = new XMLParser({ parseTagValue: false, maxNestedTags: 20,
    processEntities: false, isArray: (_name, path) => path === "rss.channel.item",
  }).parse(xml)?.rss?.channel;
  if (!channel || channel.title !== feed.title || (channel.item && !Array.isArray(channel.item)))
    throw new Error("Unexpected university feed identity");
  const items = channel.item || [];
  if (items.length > 200) throw new Error("University feed exceeds review limit");
  const seen = new Set(), jobs = [], excluded = [];
  for (const item of items) {
    if (![item.title, item.link, item.description, item.pubDate].every((s) => typeof s === "string" && s.trim()))
      throw new Error("Incomplete university vacancy");
    const link = new URL(plainText(item.link));
    const ref = link.searchParams.get("ref");
    if (link.origin !== feed.origin || link.pathname.toLowerCase() !== feed.path.toLowerCase() ||
        link.username || link.password || !/^[a-z0-9-]{1,50}$/i.test(ref || "") || seen.has(ref))
      throw new Error("Unexpected university vacancy link");
    seen.add(ref);
    const description = plainText(item.description);
    const deadline = universityClosingDate(description);
    if (Date.parse(deadline.closes_at) <= now) {
      excluded.push({ref,reason:"closing_date_passed",closing_date:deadline.application_deadline}); continue;
    }
    const restriction = universityRestriction(item.title, description, feed);
    if (restriction) { excluded.push({ref,reason:restriction}); continue; }
    const published = Date.parse(item.pubDate);
    if (!Number.isFinite(published) || published > now + 300000)
      throw new Error("Invalid university publication date");
    const canonical = new URL(feed.path, feed.origin);
    canonical.searchParams.set("ref", ref);
    jobs.push({ id: ref, title: item.title, location: feed.location, country: "GB",
      content: description, application_deadline: deadline.application_deadline, absolute_url: canonical.href, publishedAt: new Date(published).toISOString() });
  }
  return {jobs,review:{policy:"university-campus-v2",url:feed.url,channel:feed.title,received:items.length,accepted:jobs.length,excluded}};
}

export function parseUniversityFeed(xml, boardId, now = Date.now()) {
  return universityFeedSnapshot(xml,boardId,now).jobs;
}

export async function fetchBoard(board) {
  if (board.provider === "university-rss") {
    const feed = UNIVERSITY_FEEDS[board.id];
    if (!feed) throw new Error("Unreviewed university feed");
    const response = await fetch(feed.url, { headers: { Accept: "application/rss+xml, text/xml", "User-Agent": "SponsorIntel/2.9 (+https://sponsorintel.london)" },
      signal: AbortSignal.timeout(25000), redirect: "manual" });
    const xml = await boundedText(response, 2_000_000, feed.encoding);
    const snapshot = universityFeedSnapshot(xml, board.id);
    const jobs = await normaliseBoardJobs(snapshot.jobs, board);
    // Private, bounded source decisions travel inside the same workflow step.
    // JSON array publication never exposes this metadata as a public vacancy.
    jobs.feed_review = {...snapshot.review, normalised:jobs.length};
    return jobs;
  }
  const url =
    board.provider === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${board.board}/jobs?content=true`
      : board.provider === "lever"
        ? `https://${board.region === "eu" ? "api.eu.lever.co" : "api.lever.co"}/v0/postings/${board.board}?mode=json`
        : `https://api.ashbyhq.com/posting-api/job-board/${board.board}?includeCompensation=true`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SponsorIntel/2.9 (+https://sponsorintel.london)",
    },
    signal: AbortSignal.timeout(25000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error("Board unavailable: " + response.status);
  const data = JSON.parse(await boundedText(response, 12_000_000));
  const raw = board.provider === "lever" ? data : data.jobs;
  if (
    board.provider === "greenhouse" &&
    Number.isInteger(data.meta?.total) &&
    data.meta.total !== raw?.length
  )
    throw new Error("Incomplete employer board response");
  return normaliseBoardJobs(raw, board);
}

// Each bound JSON chunk stays comfortably below D1's 2 MB value limit.
// One transaction publishes an entire board, including removals and freshness.
export async function storeBoardJobs(DB, board, jobs, now, receipts = [], guard = null) {
  const fields = [
    "id",
    "board_id",
    "company",
    "title",
    "location",
    "description",
    "apply_url",
    "provider",
    "source_updated_at",
    "application_deadline",
    "closes_at",
    "sponsorship",
    "evidence",
    "level",
    "salary_excerpt",
    "employment_type",
    "workplace",
  ];
  const statements = guard ? [guard] : [];
  let chunk = [],
    bytes = 2;
  const addChunk = () => {
    if (!chunk.length) return;
    const extracted = fields
      .map((f) => `json_extract(value, '$.${f}')`)
      .join(",");
    const updates = fields
      .filter((f) => !["id", "board_id", "provider"].includes(f))
      .map((f) => `${f}=excluded.${f}`)
      .join(",");
    statements.push(
      DB.prepare(
        `INSERT INTO jobs (${fields.join(",")},first_seen,last_seen,active)
       SELECT ${extracted},?,?,1 FROM json_each(?) WHERE 1
       ON CONFLICT(id) DO UPDATE SET ${updates},last_seen=excluded.last_seen,active=1`,
      ).bind(now, now, "[" + chunk.join(",") + "]"),
    );
    chunk = [];
    bytes = 2;
  };
  for (const job of jobs) {
    const json = JSON.stringify(job),
      size = new TextEncoder().encode(json).length + 1;
    if (size > 900000) throw new Error("Vacancy exceeds storage limit");
    if (bytes + size > 900000) addChunk();
    chunk.push(json);
    bytes += size;
  }
  addChunk();
  statements.push(
    DB.prepare(
      "UPDATE jobs SET active=0 WHERE board_id=? AND id NOT IN (SELECT value FROM json_each(?))",
    ).bind(board.id, JSON.stringify(jobs.map((job) => job.id))),
    DB.prepare(
      "INSERT INTO job_sources(id,company,careers_url,checked_at,last_success,count,error) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET company=excluded.company,careers_url=excluded.careers_url,checked_at=excluded.checked_at,last_success=excluded.last_success,count=excluded.count,error=NULL",
    ).bind(board.id, board.company, board.careers, now, now, jobs.length),
  );
  await DB.batch([...statements, ...receipts]);
}

export async function refreshJobs(
  env,
  { boards, readBoard = fetchBoard } = {},
) {
  const owner = crypto.randomUUID(),
    leaseMs = 20 * 60 * 1000;
  const lease = await env.DB.prepare(
    "INSERT INTO feed_locks(name,owner,expires) VALUES('jobs',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE feed_locks.expires<? RETURNING owner",
  )
    .bind(owner, Date.now() + leaseMs, Date.now())
    .first();
  if (lease?.owner !== owner)
    return [{ skipped: true, reason: "Refresh already running" }];
  const summary = [];
  try {
    if (!boards) {
      await env.DB.prepare(
        "UPDATE jobs SET active=0 WHERE board_id IN (SELECT id FROM employer_boards b WHERE state<>'approved' OR NOT EXISTS(SELECT 1 FROM sponsors s WHERE s.id=b.sponsor_id AND s.skilled=1 AND s.snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot')))",
      ).run();
      boards = [
        ...BOARDS,
        ...(
          await env.DB.prepare(
            "SELECT b.* FROM employer_boards b WHERE state='approved' AND EXISTS(SELECT 1 FROM sponsors s WHERE s.id=b.sponsor_id AND s.skilled=1 AND s.snapshot=json_extract((SELECT value FROM metadata WHERE key='register'),'$.snapshot')) ORDER BY b.id LIMIT 20",
          ).all()
        ).results,
      ];
    }
    for (const board of boards) {
      const held = await env.DB.prepare(
        "UPDATE feed_locks SET expires=? WHERE name='jobs' AND owner=? AND expires>? RETURNING owner",
      )
        .bind(Date.now() + leaseMs, owner, Date.now())
        .first();
      if (held?.owner !== owner) throw new Error("Job refresh lease expired");
      const now = new Date().toISOString();
      try {
        const jobs = await readBoard(board);
        await storeBoardJobs(env.DB, board, jobs, now);
        await env.DB.prepare(
          "INSERT INTO source_runs(source_id,checked_at,success,count) VALUES(?,?,1,?)",
        )
          .bind(board.id, now, jobs.length)
          .run();
        summary.push({ board: board.id, jobs: jobs.length });
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "job_board_refresh_failed",
            board: board.id,
            message: error instanceof Error ? error.message : "Unknown failure",
          }),
        );
        await env.DB.prepare(
          "INSERT INTO job_sources(id,company,careers_url,checked_at,count,error) VALUES(?,?,?,?,0,?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,error=excluded.error",
        )
          .bind(
            board.id,
            board.company,
            board.careers,
            now,
            "Refresh unavailable. Last successful data retained.",
          )
          .run();
        summary.push({ board: board.id, error: true });
        await env.DB.prepare(
          "INSERT INTO source_runs(source_id,checked_at,success,count) VALUES(?,?,0,0)",
        )
          .bind(board.id, now)
          .run();
      }
    }
  } finally {
    await env.DB.prepare("DELETE FROM feed_locks WHERE name='jobs' AND owner=?")
      .bind(owner)
      .run();
  }
  return summary;
}

const boardById = new Map(BOARDS.map((board) => [board.id, board]));
function withSector(job, extra = []) {
  const sector =
    boardById.get(job.board_id)?.sector ||
    extra.find((b) => b.id === job.board_id)?.sector ||
    "";
  return { ...job, sector, sector_label: SECTORS[sector] || "" };
}

export async function getJobDetail(id, env) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const item = await env.DB.prepare("SELECT * FROM jobs WHERE id=?")
    .bind(id)
    .first();
  if (!item) return null;
  const source = await env.DB.prepare(
    "SELECT careers_url,checked_at,last_success,error FROM job_sources WHERE id=?",
  )
    .bind(item.board_id)
    .first();
  const extra = boardById.has(item.board_id)
    ? []
    : (
        await env.DB.prepare("SELECT id,sector,sponsor_id,reviewed_at,state FROM employer_boards WHERE id=?")
          .bind(item.board_id)
          .all()
      ).results;
  const licences = await employerLicences(env.DB, extra);
  return { ...withSector(item, extra), source: source || null,
    employer_licence: licences.matches.get(item.board_id) || null };
}

export async function jobsAPI(url, env, now = Date.now()) {
  if (url.pathname === "/api/jobs/sources")
    return Response.json({
      sources: (
        await env.DB.prepare("SELECT * FROM job_sources ORDER BY company").all()
      ).results,
    }, { headers: { "Cache-Control": "no-store" } });
  const id = url.pathname.match(/^\/api\/jobs\/([a-f0-9]{24})$/)?.[1];
  if (id) {
    const item = await getJobDetail(id, env);
    return Response.json(item || { error: "This vacancy was not found." }, {
      status: item ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (url.pathname !== "/api/jobs")
    return Response.json({ error: "Not found" }, { status: 404 });
  const p = url.searchParams;
  const extraBoards = (
    await env.DB.prepare(
      "SELECT id,sector,sponsor_id,reviewed_at,state FROM employer_boards WHERE state='approved'",
    ).all()
  ).results;
  const licences = await employerLicences(env.DB, extraBoards, now);
  const licensedBoards = JSON.stringify([...licences.matches.keys()]);
  const current = currentJobs(now);
  const {sql: where, values} = jobFilter(p, extraBoards, licences.matches.keys(), now);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) total FROM jobs WHERE " + where,
  )
    .bind(...values)
    .first();
  const pages = Math.ceil(count.total / 12);
  const page = Math.max(
    1,
    Math.min(pages || 1, parseInt(p.get("page") || "1") || 1),
  );
  const items = await env.DB.prepare(
    "SELECT id,board_id,company,title,location,apply_url,provider,sponsorship,evidence,level,first_seen,last_seen,source_updated_at,application_deadline,closes_at,salary_excerpt,employment_type,workplace FROM jobs WHERE " +
      where +
      " ORDER BY first_seen DESC,title,id LIMIT 12 OFFSET ?",
  )
    .bind(...values, (page - 1) * 12)
    .all();
  const stats = await env.DB.prepare(
    `SELECT COUNT(*) total, COUNT(DISTINCT board_id) employers,
      COALESCE(SUM(level='early_career'),0) early_career,
      COALESCE(SUM(sponsorship IN ('offered','conditional')),0) sponsorship,
      COALESCE(SUM(board_id IN (SELECT value FROM json_each(?))),0) licensed,
      COALESCE(SUM(salary_excerpt<>''),0) salary, MIN(closes_at) next_deadline, MIN(last_seen) oldest_seen
     FROM jobs WHERE ${current.sql}`,
  )
    .bind(licensedBoards, ...current.values)
    .first();
  const { next_deadline, oldest_seen, ...collections } = stats;
  const boundaries = [now + 5 * 60000, Date.parse(next_deadline), Date.parse(oldest_seen) + JOB_FRESHNESS_MS];
  if (licences.register.available) boundaries.push(Date.parse(licences.register.checked_at) + 2 * 86400000, Date.parse(licences.register.source_date) + 7 * 86400000);
  const validUntil = Math.min(...boundaries.filter(Number.isFinite));
  return Response.json({
    generated_at: new Date(now).toISOString(),
    valid_until: new Date(validUntil).toISOString(),
    items: items.results.map((job) => ({ ...withSector(job, extraBoards),
      employer_licence: licences.matches.get(job.board_id) || null })),
    total: count.total,
    catalog_total: stats.total,
    collections,
    next_deadline,
    licence_register: licences.register,
    sectors: SECTORS,
    page,
    pages,
    sources: (
      await env.DB.prepare("SELECT * FROM job_sources ORDER BY company").all()
    ).results,
  }, { headers: { "Cache-Control": "no-store" } });
}
