// Reviewed company/brand links, not a claim about a vacancy's employing entity.
// IDs are exact name + location records in the official worker register.
// Never infer a link from similar names, keywords or an advert offering sponsorship.
export const REVIEWED_EMPLOYER_LINKS = [
  {id:"university-southampton",sponsor_id:"2a75ac7e351da13cba8ddb10",evidence_url:"https://jobs.soton.ac.uk/RSS/",reviewed_at:"2026-10-08"},
  {id:"university-nottingham",sponsor_id:"6ef3de9d8fb9c471146bd4fc",evidence_url:"https://jobs.nottingham.ac.uk/RSS/",reviewed_at:"2026-10-08"},
  { id: "monzo", sponsor_id: "fffc1b73b4b4d6d0acebbab8", evidence_url: "https://monzo.com/careers/", reviewed_at: "2026-10-06" },
  { id: "gocardless", sponsor_id: "bd18e6ef03cf6d98416ecb59", evidence_url: "https://gocardless.com/legal/", reviewed_at: "2026-10-06" },
  { id: "funding-circle", sponsor_id: "4ac667c52c9a0a4dbc3c6604", evidence_url: "https://www.fundingcircle.com/uk/about-us/", reviewed_at: "2026-10-06" },
  { id: "zopa", sponsor_id: "8032bd0aad08e26ea0b49eaf", evidence_url: "https://www.zopa.com/contact", reviewed_at: "2026-10-06" },
  { id: "graphcore", sponsor_id: "f2ff8516c38862d935974912", evidence_url: "https://www.graphcore.ai/hubfs/assets/pdf/Click%20wrap%20license%20agreement.pdf", reviewed_at: "2026-10-06" },
  { id: "allica-bank", sponsor_id: "c35e7085232c95e3d50e2d99", evidence_url: "https://www.allica.bank/careers", reviewed_at: "2026-10-06" },
  {"id": "cloudflare", "sponsor_id": "f836d0c9dd3bae29019003a4", "evidence_url": "https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/", "reviewed_at": "2026-10-07"},
  {"id": "deliveroo", "sponsor_id": "ef82b77104d718b9c266786a", "evidence_url": "https://deliveroo.co.uk/legal/", "reviewed_at": "2026-10-07"},
  {"id": "stripe", "sponsor_id": "a4c1ffd864c2e3e38a892774", "evidence_url": "https://stripe.com/gb/legal/spukl", "reviewed_at": "2026-10-07"},
  {"id": "figma", "sponsor_id": "dc5e5b0f2185b97f8f8e48c6", "evidence_url": "https://www.figma.com/uk-tax-strategy/", "reviewed_at": "2026-10-07"},
  {"id": "octopus-energy", "sponsor_id": "1b963b6bb4838b96938a96f4", "evidence_url": "https://octopus.energy/quote/terms-and-conditions/", "reviewed_at": "2026-10-07"},
  {"id": "zeeco", "sponsor_id": "d4272f5f1029b6c7acec8818", "evidence_url": "https://www.zeeco.com/privacy-policy", "reviewed_at": "2026-10-07"},
  {"id": "invinity", "sponsor_id": "89325f0cfb4d4758510a45aa", "evidence_url": "https://invinity.com/wp-content/uploads/2024/10/2022.05.12-Invinity-Energy-UK-Ltd-Terms-and-Conditions-for-the-Supply-of-Goods-FINAL-1.pdf", "reviewed_at": "2026-10-07"},
  {"id": "axon", "sponsor_id": "9df83e5777ab2d551ba89677", "evidence_url": "https://axon-com.com/legal-and-privacy/", "reviewed_at": "2026-10-07"},
  {"id": "bakerhicks", "sponsor_id": "15f4e702e4bf277db585f025", "evidence_url": "https://bakerhicks.com/en/privacy", "reviewed_at": "2026-10-07"},
  {"id": "hr-wallingford", "sponsor_id": "2b50a3b31eb0a6cb8348780d", "evidence_url": "https://www.hrwallingford.com/sites/default/files/2024-10/bc048_sustainability-report-2024-r02-00_0.pdf", "reviewed_at": "2026-10-07"},
  {"id": "multiverse", "sponsor_id": "a59d4845eaf070b6d5b23bf1", "evidence_url": "https://community.multiverse.io/privacy_policy", "reviewed_at": "2026-10-07"},
  {"id": "maven", "sponsor_id": "17b565a57b9527eeb262e8cb", "evidence_url": "https://downloads.modern-slavery-statement-registry.service.gov.uk/pdf-published/Z4ESldnl/2023/2023%20-%20Slavery%20and%20Human%20Trafficking%20Statement.pdf", "reviewed_at": "2026-10-07"},
  {"id": "numan", "sponsor_id": "251f88c057cdf37907a9c838", "evidence_url": "https://www.numan.com/legal/terms-and-conditions", "reviewed_at": "2026-10-07"},
  {"id": "university-bath", "sponsor_id": "172ea1ba3df39d083228ae40", "evidence_url": "https://www.bath.ac.uk/jobs/rss/", "reviewed_at": "2026-10-07"},
  {"id": "university-greater-manchester", "sponsor_id": "f30b3f2408fe12130a3c4b24", "evidence_url": "https://greatermanchester.ac.uk/assets/Uploads/Instrument-of-Government.pdf", "reviewed_at": "2026-10-07"},
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
