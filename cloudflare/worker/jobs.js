import { boundedText, idFor } from "./data.js";

// Explicit public employer boards. No arbitrary user-provided fetch destinations.
export const BOARDS = [
  {
    id: "monzo",
    company: "Monzo",
    provider: "greenhouse",
    board: "monzo",
    careers: "https://monzo.com/careers/",
  },
  {
    id: "cloudflare",
    company: "Cloudflare",
    provider: "greenhouse",
    board: "cloudflare",
    careers: "https://www.cloudflare.com/careers/jobs/",
  },
  {
    id: "gocardless",
    company: "GoCardless",
    provider: "greenhouse",
    board: "gocardless",
    careers: "https://gocardless.com/about/careers/",
  },
  {
    id: "deliveroo",
    company: "Deliveroo",
    provider: "greenhouse",
    board: "deliveroo",
    careers: "https://careers.deliveroo.co.uk/",
  },
  {
    id: "stripe",
    company: "Stripe",
    provider: "greenhouse",
    board: "stripe",
    careers: "https://stripe.com/jobs",
  },
  {
    id: "figma",
    company: "Figma",
    provider: "greenhouse",
    board: "figma",
    careers: "https://www.figma.com/careers/",
  },
  {
    id: "octopus-energy",
    company: "Octopus Energy",
    provider: "lever",
    board: "octoenergy",
    careers: "https://octopus.energy/careers/",
  },
  {
    id: "funding-circle",
    company: "Funding Circle",
    provider: "ashby",
    board: "fundingcircle",
    careers: "https://www.fundingcircle.com/uk/careers/",
  },
];

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
    /(?:cannot|can't|unable to|do not|don't|does not|won't|will not|not able to|not in a position to).{0,30}(?:offer|provide|support|sponsor|consider|arrange)|no (?:visa|immigration|work permit) sponsorship|(?:visa|immigration|work permit) sponsorship.{0,25}(?:not available|unavailable|not provided|not offered)|without (?:requiring|needing) (?:visa )?sponsorship|(?:would|will|must|should|do|does) not (?:require|need) (?:visa |immigration |work permit )?sponsorship|(?:visa )?sponsorship (?:is )?not (?:possible|provided|supported)/i.test(
      s,
    ),
  );
  if (negative) return { status: "unavailable", quote: negative.slice(0, 500) };
  const positive = relevant.find(
    (s) =>
      !s.endsWith("?") &&
      /\bwe (?:can |will |may |do |are able to |are happy to )?(?:offer|provide|support) (?:\w+ ){0,3}(?:visa|immigration|work permit) sponsorship|\b(?:visa|immigration|work permit) sponsorship (?:is |will be |can be |may be )?(?:available|provided|offered|supported)\b|\bwe (?:can|will|may|are able to) sponsor (?:your |a |the )?(?:visa|work permit)/i.test(
        s,
      ),
  );
  if (positive)
    return {
      status:
        /eligible|eligibility|depend|case.by.case|subject to|may |can |consider|certain|where|if /i.test(
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
  if (
    /united kingdom|\bUK\b|\(GB\)|england|scotland|wales|northern ireland/i.test(
      location,
    )
  )
    return true;
  if (
    /united states|\bUSA?\b|,?\s(?:MA|CA|CT|OH|TX)\b|canada|ontario/i.test(
      location,
    )
  )
    return false;
  return /\b(london|manchester|cardiff|edinburgh|glasgow|birmingham|bristol|leeds|belfast|nottingham|sheffield|reading|brighton|oxford)\b/i.test(
    location,
  );
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
        ]
      : [job.content || job.descriptionPlain || job.descriptionHtml];
  return parts.map(plainText).filter(Boolean).join("\n\n");
}

export function isTalentPool(title) {
  return /talent (?:community|pool|network)|speculative|expression of interest|register (?:your )?interest|future opportunities|general application/i.test(
    title,
  );
}

export function salaryExcerpt(text) {
  // A quote, not an estimated salary or a visa salary assessment.
  return (
    plainText(text)
      .split(/\n|(?<=[.!?])\s+/)
      .find(
        (s) =>
          /(?:£\s*\d[\d,.]*|\bGBP\s*\d[\d,.]*)/i.test(s) &&
          /\b(?:salary|pay|compensation|annum|per (?:year|hour|month)|annual|base|OTE)\b/i.test(
            s,
          ),
      )
      ?.trim()
      .slice(0, 400) || ""
  );
}

export async function normaliseBoardJobs(raw, board) {
  if (!Array.isArray(raw) || raw.length > 5000)
    throw new Error("Invalid board response");
  const result = [],
    seen = new Set();
  for (const job of raw) {
    if (job.isListed === false) continue;
    const location =
      typeof job.location === "string"
        ? job.location
        : job.location?.name || job.categories?.location || "";
    const country =
      job.country || job.address?.postalAddress?.addressCountry || "";
    if (!isUK(location, country)) continue;
    const completeText = advertText(job, board.provider);
    // Do not truncate away an eligibility exclusion and then label an advert.
    if (completeText.length > 80000) continue;
    const description = completeText;
    const apply_url = canonicalJobURL(
      job.absolute_url || job.hostedUrl || job.jobUrl || job.applyUrl,
    );
    const title = plainText(job.title || job.text).slice(0, 240);
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
      workplace: plainText(job.workplaceType || "").slice(0, 60),
    });
  }
  return result;
}

export async function fetchBoard(board) {
  const url =
    board.provider === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${board.board}/jobs?content=true`
      : board.provider === "lever"
        ? `https://api.lever.co/v0/postings/${board.board}?mode=json`
        : `https://api.ashbyhq.com/posting-api/job-board/${board.board}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SponsorIntel/2.1 (+https://sponsorintel.london)",
    },
    signal: AbortSignal.timeout(25000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error("Board unavailable: " + response.status);
  const data = JSON.parse(await boundedText(response, 12_000_000));
  const raw = board.provider === "lever" ? data : data.jobs;
  return normaliseBoardJobs(raw, board);
}

export async function refreshJobs(env) {
  const summary = [];
  for (const board of BOARDS) {
    const now = new Date().toISOString();
    try {
      const jobs = await fetchBoard(board);
      for (let i = 0; i < jobs.length; i += 30) {
        await env.DB.batch(
          jobs
            .slice(i, i + 30)
            .map((j) =>
              env.DB.prepare(
                `INSERT INTO jobs (id,board_id,company,title,location,description,apply_url,provider,source_updated_at,sponsorship,evidence,level,first_seen,last_seen,salary_excerpt,employment_type,workplace,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET title=excluded.title,location=excluded.location,description=excluded.description,apply_url=excluded.apply_url,source_updated_at=excluded.source_updated_at,sponsorship=excluded.sponsorship,evidence=excluded.evidence,level=excluded.level,last_seen=excluded.last_seen,salary_excerpt=excluded.salary_excerpt,employment_type=excluded.employment_type,workplace=excluded.workplace,active=1`,
              ).bind(
                j.id,
                j.board_id,
                j.company,
                j.title,
                j.location,
                j.description,
                j.apply_url,
                j.provider,
                j.source_updated_at,
                j.sponsorship,
                j.evidence,
                j.level,
                now,
                now,
                j.salary_excerpt,
                j.employment_type,
                j.workplace,
              ),
            ),
        );
      }
      // Only a completely read and stored board may retire absent jobs.
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE jobs SET active=0 WHERE board_id=? AND last_seen<>?",
        ).bind(board.id, now),
        env.DB.prepare(
          "INSERT INTO job_sources(id,company,careers_url,checked_at,last_success,count,error) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,last_success=excluded.last_success,count=excluded.count,error=NULL",
        ).bind(board.id, board.company, board.careers, now, now, jobs.length),
      ]);
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
    }
  }
  return summary;
}

export async function jobsAPI(url, env) {
  if (url.pathname === "/api/jobs/sources")
    return Response.json({
      sources: (
        await env.DB.prepare("SELECT * FROM job_sources ORDER BY company").all()
      ).results,
    });
  const id = url.pathname.match(/^\/api\/jobs\/([a-f0-9]{24})$/)?.[1];
  if (id) {
    const item = await env.DB.prepare("SELECT * FROM jobs WHERE id=?")
      .bind(id)
      .first();
    return Response.json(item || { error: "This vacancy was not found." }, {
      status: item ? 200 : 404,
    });
  }
  if (url.pathname !== "/api/jobs")
    return Response.json({ error: "Not found" }, { status: 404 });
  const p = url.searchParams;
  const values = [new Date(Date.now() - 3 * 86400000).toISOString()];
  let where = "active=1 AND last_seen>=?";
  for (const term of (p.get("q") || "")
    .trim()
    .slice(0, 150)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)) {
    where +=
      " AND (title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')";
    const pattern = "%" + term.replace(/[\\%_]/g, "\\$&") + "%";
    values.push(pattern, pattern, pattern);
  }
  if (p.get("location")) {
    where += " AND location LIKE ? ESCAPE '\\'";
    values.push(
      "%" +
        p
          .get("location")
          .slice(0, 80)
          .replace(/[\\%_]/g, "\\$&") +
        "%",
    );
  }
  if (
    ["offered", "conditional", "not_stated", "unavailable"].includes(
      p.get("sponsorship"),
    )
  ) {
    where += " AND sponsorship=?";
    values.push(p.get("sponsorship"));
  }
  if (p.get("level") === "early_career") where += " AND level='early_career'";
  if (p.get("salary") === "listed") where += " AND salary_excerpt<>''";
  const page = Math.max(1, Math.min(500, parseInt(p.get("page") || "1") || 1));
  const count = await env.DB.prepare(
    "SELECT COUNT(*) total FROM jobs WHERE " + where,
  )
    .bind(...values)
    .first();
  const items = await env.DB.prepare(
    "SELECT id,company,title,location,apply_url,provider,sponsorship,evidence,level,first_seen,last_seen,source_updated_at,salary_excerpt,employment_type,workplace FROM jobs WHERE " +
      where +
      " ORDER BY first_seen DESC,title LIMIT 12 OFFSET ?",
  )
    .bind(...values, (page - 1) * 12)
    .all();
  const total = await env.DB.prepare(
    "SELECT COUNT(*) total FROM jobs WHERE active=1 AND last_seen>=?",
  )
    .bind(values[0])
    .first();
  return Response.json({
    items: items.results,
    total: count.total,
    catalog_total: total.total,
    page,
    pages: Math.ceil(count.total / 12),
    sources: (
      await env.DB.prepare("SELECT * FROM job_sources ORDER BY company").all()
    ).results,
  });
}
