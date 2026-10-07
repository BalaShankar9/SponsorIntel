// Reviewed company/brand links, not a claim about a vacancy's employing entity.
// IDs are exact name + location records in the official worker register.
// Never infer a link from similar names, keywords or an advert offering sponsorship.
export const REVIEWED_EMPLOYER_LINKS = [
  { id: "monzo", sponsor_id: "fffc1b73b4b4d6d0acebbab8", evidence_url: "https://monzo.com/careers/", reviewed_at: "2026-10-06" },
  { id: "gocardless", sponsor_id: "bd18e6ef03cf6d98416ecb59", evidence_url: "https://gocardless.com/legal/", reviewed_at: "2026-10-06" },
  { id: "funding-circle", sponsor_id: "4ac667c52c9a0a4dbc3c6604", evidence_url: "https://www.fundingcircle.com/uk/about-us/", reviewed_at: "2026-10-06" },
  { id: "zopa", sponsor_id: "8032bd0aad08e26ea0b49eaf", evidence_url: "https://www.zopa.com/contact", reviewed_at: "2026-10-06" },
  { id: "graphcore", sponsor_id: "f2ff8516c38862d935974912", evidence_url: "https://www.graphcore.ai/hubfs/assets/pdf/Click%20wrap%20license%20agreement.pdf", reviewed_at: "2026-10-06" },
  { id: "allica-bank", sponsor_id: "c35e7085232c95e3d50e2d99", evidence_url: "https://www.allica.bank/careers", reviewed_at: "2026-10-06" },
];

const DAY = 86400000;
function recent(value, age, now) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now + 300000 && now - time < age;
}

export async function employerLicences(DB, approvedBoards = [], now = Date.now()) {
  const matches = new Map();
  const row = await DB.prepare("SELECT value FROM metadata WHERE key='register'").first();
  let meta;
  try { meta = row ? JSON.parse(row.value) : null; } catch { meta = null; }
  const available = !!(meta?.snapshot && !meta.refresh_error &&
    recent(meta.checked_at, 2 * DAY, now) && recent(meta.source_date, 7 * DAY, now));
  const register = { available, source_date: meta?.source_date || null, checked_at: meta?.checked_at || null };
  if (!available) return { matches, register };

  const links = [...REVIEWED_EMPLOYER_LINKS, ...approvedBoards.filter((b) => b.state === "approved")]
    .filter((b) => /^[a-f0-9]{24}$/.test(b.sponsor_id || "") && b.reviewed_at &&
      Number.isFinite(Date.parse(b.reviewed_at)) && Date.parse(b.reviewed_at) <= now + 300000);
  const rows = await DB.prepare(
    "SELECT id,name,city,ratings,routes FROM sponsors WHERE snapshot=? AND skilled=1 AND id IN (SELECT value FROM json_each(?))",
  ).bind(meta.snapshot, JSON.stringify([...new Set(links.map((b) => b.sponsor_id))])).all();
  const sponsors = new Map(rows.results.map((s) => [s.id, s]));
  for (const link of links) {
    const sponsor = sponsors.get(link.sponsor_id);
    if (!sponsor) continue;
    const routes = JSON.parse(sponsor.routes);
    if (!routes.includes("Skilled Worker")) continue;
    matches.set(link.id, {
      id: sponsor.id, name: sponsor.name, city: sponsor.city,
      routes, ratings: JSON.parse(sponsor.ratings),
      source_date: meta.source_date, checked_at: meta.checked_at,
      // Admin review notes can be private; only curated public source URLs are exposed.
      evidence_url: REVIEWED_EMPLOYER_LINKS.find((b) => b.id === link.id)?.evidence_url || null,
      reviewed_at: link.reviewed_at,
    });
  }
  return { matches, register };
}
