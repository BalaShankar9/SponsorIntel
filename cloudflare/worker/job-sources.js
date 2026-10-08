// Reviewed public employer boards. Requests never use user-supplied destinations.
// Sectors describe the employer, not the occupation or visa eligibility.
export const SECTORS = {
  technology: "Technology",
  finance: "Finance & fintech",
  engineering: "Engineering",
  healthcare: "Healthcare & life sciences",
  energy: "Energy & climate",
  education: "Education",
  commerce: "Commerce & delivery",
};

export const BOARDS = [
  {
    id: "monzo",
    company: "Monzo",
    provider: "greenhouse",
    board: "monzo",
    careers: "https://monzo.com/careers/",
    sector: "finance",
  },
  {
    id: "cloudflare",
    company: "Cloudflare",
    provider: "greenhouse",
    board: "cloudflare",
    careers: "https://www.cloudflare.com/careers/jobs/",
    sector: "technology",
  },
  {
    id: "gocardless",
    company: "GoCardless",
    provider: "greenhouse",
    board: "gocardless",
    careers: "https://gocardless.com/about/careers/",
    sector: "finance",
  },
  {
    id: "deliveroo",
    company: "Deliveroo",
    provider: "greenhouse",
    board: "deliveroo",
    careers: "https://careers.deliveroo.co.uk/",
    sector: "commerce",
  },
  {
    id: "stripe",
    company: "Stripe",
    provider: "greenhouse",
    board: "stripe",
    careers: "https://stripe.com/jobs",
    sector: "finance",
  },
  {
    id: "figma",
    company: "Figma",
    provider: "greenhouse",
    board: "figma",
    careers: "https://www.figma.com/careers/",
    sector: "technology",
  },
  {
    id: "octopus-energy",
    company: "Octopus Energy",
    provider: "lever",
    board: "octoenergy",
    careers: "https://octopus.energy/careers/",
    sector: "energy",
  },
  {
    id: "funding-circle",
    company: "Funding Circle",
    provider: "ashby",
    board: "fundingcircle",
    careers: "https://www.fundingcircle.com/uk/careers/",
    sector: "finance",
  },
  {
    id: "zopa",
    company: "Zopa",
    provider: "lever",
    board: "zopa",
    sector: "finance",
    careers: "https://jobs.lever.co/zopa/",
  },
  {
    id: "zeeco",
    company: "Zeeco",
    provider: "lever",
    board: "zeeco",
    sector: "engineering",
    careers: "https://jobs.lever.co/zeeco/",
  },
  {
    id: "invinity",
    company: "Invinity Energy Systems",
    provider: "lever",
    board: "invinity",
    sector: "energy",
    careers: "https://jobs.lever.co/invinity/",
  },
  {
    id: "wep-clinical",
    company: "WEP Clinical",
    provider: "lever",
    board: "wepclinical",
    sector: "healthcare",
    careers: "https://jobs.lever.co/wepclinical/",
  },
  {
    id: "nucleus",
    company: "Nucleus Global",
    provider: "greenhouse",
    board: "nucleus",
    sector: "healthcare",
    careers: "https://job-boards.greenhouse.io/nucleus",
  },
  {
    id: "apothecom",
    company: "ApotheCom",
    provider: "greenhouse",
    board: "apothecom",
    sector: "healthcare",
    careers: "https://job-boards.greenhouse.io/apothecom",
  },
  {
    id: "precision-aq",
    company: "Precision AQ",
    provider: "greenhouse",
    board: "precisionaq",
    sector: "healthcare",
    careers: "https://job-boards.greenhouse.io/precisionaq",
  },
  {
    id: "axon",
    company: "AXON",
    provider: "greenhouse",
    board: "axonag",
    sector: "healthcare",
    careers: "https://job-boards.greenhouse.io/axonag",
  },
  {
    id: "graphcore",
    company: "Graphcore",
    provider: "greenhouse",
    board: "graphcore",
    sector: "technology",
    careers: "https://job-boards.greenhouse.io/graphcore",
  },
  {
    id: "bakerhicks",
    company: "BakerHicks",
    provider: "greenhouse",
    board: "bakerhicks",
    sector: "engineering",
    careers: "https://job-boards.greenhouse.io/bakerhicks",
  },
  {
    id: "hr-wallingford",
    company: "HR Wallingford",
    provider: "greenhouse",
    board: "hrwallingford",
    sector: "engineering",
    careers: "https://job-boards.greenhouse.io/hrwallingford",
  },
  {
    id: "allica-bank",
    company: "Allica Bank",
    provider: "ashby",
    board: "allica-bank",
    sector: "finance",
    careers: "https://jobs.ashbyhq.com/allica-bank",
  },
  {
    id: "voleon",
    company: "The Voleon Group",
    provider: "ashby",
    board: "voleon",
    sector: "finance",
    careers: "https://jobs.ashbyhq.com/voleon",
  },
  {
    id: "multiverse",
    company: "Multiverse",
    provider: "ashby",
    board: "multiverse",
    sector: "education",
    careers: "https://jobs.ashbyhq.com/multiverse",
  },
  {
    id: "callosum",
    company: "Callosum",
    provider: "ashby",
    board: "callosum",
    sector: "technology",
    careers: "https://jobs.ashbyhq.com/callosum",
  },
  {
    id: "sampura",
    company: "Sampura Research",
    provider: "ashby",
    board: "sampura",
    sector: "technology",
    careers: "https://jobs.ashbyhq.com/sampura",
  },
  {
    id: "seamflow",
    company: "Seamflow",
    provider: "ashby",
    board: "seamflow",
    sector: "technology",
    careers: "https://jobs.ashbyhq.com/seamflow",
  },
  {
    id: "maven",
    company: "Maven Securities",
    provider: "greenhouse",
    board: "mavensecuritiesholdingltd",
    sector: "finance",
    careers: "https://job-boards.greenhouse.io/mavensecuritiesholdingltd",
  },
  {
    id: "numan", company: "Numan", provider: "lever", region: "eu",
    board: "numan", sector: "healthcare", careers: "https://careers.numan.com/",
  },
  {
    id: "eucalyptus", company: "Eucalyptus", provider: "greenhouse",
    board: "eucalyptus", sector: "healthcare", careers: "https://www.eucalyptus.health/careers",
  },
  {
    id: "university-bath", company: "University of Bath", provider: "university-rss",
    sector: "education", careers: "https://www.bath.ac.uk/jobs/",
  },
  {
    id: "university-greater-manchester", company: "University of Greater Manchester", provider: "university-rss",
    sector: "education", careers: "https://jobs.greatermanchester.ac.uk/",
  },
  {
    id: "university-southampton", company: "University of Southampton", provider: "university-rss",
    sector: "education", careers: "https://jobs.soton.ac.uk/",
  },
  {
    id: "university-nottingham", company: "University of Nottingham", provider: "university-rss",
    sector: "education", careers: "https://jobs.nottingham.ac.uk/",
  },
  {
    id: "university-cardiff-met", company: "Cardiff Metropolitan University", provider: "university-rss",
    sector: "education", careers: "https://jobs.cardiffmet.ac.uk/",
  },
];

// Explicit campus feeds only: a UK university can also advertise overseas roles.
// These URLs cannot be supplied by an intake form or a feed item.
export const UNIVERSITY_FEEDS = {
  "university-cardiff-met": {
    directory: "https://jobs.cardiffmet.ac.uk/RSS/",
    campuses: ["cardiff-met-cyncoed", "cardiff-met-llandaff"],
  },
  "cardiff-met-cyncoed": {
    url: "https://jobs.cardiffmet.ac.uk/RSS/rss.aspx?cat=1081&type=9",
    location: "Cyncoed Campus, Cardiff, United Kingdom", origin: "https://jobs.cardiffmet.ac.uk",
    path: "/rss/click.aspx", title: "Jobs at Cardiff Metropolitan | Cyncoed Campus",
    encoding: "utf-8", // Observed bytes are UTF-8 despite the ISO-8859-1 declaration.
  },
  "cardiff-met-llandaff": {
    url: "https://jobs.cardiffmet.ac.uk/RSS/rss.aspx?cat=1080&type=9",
    location: "Llandaff Campus, Cardiff, United Kingdom", origin: "https://jobs.cardiffmet.ac.uk",
    path: "/rss/click.aspx", title: "Jobs at Cardiff Metropolitan | Llandaff Campus",
    encoding: "utf-8",
  },
  "university-southampton": {
    url: "https://jobs.soton.ac.uk/RSS/rss.aspx?cat=282&type=9",
    location: "Highfield Campus, Southampton, United Kingdom", origin: "https://jobs.soton.ac.uk",
    path: "/rss/click.aspx", title: "Recruitment at the University of Southampton | Highfield Campus",
    encoding: "utf-8",
  },
  "university-nottingham": {
    url: "https://jobs.nottingham.ac.uk/RSS/rss.aspx?cat=220&type=9",
    location: "University Park, Nottingham, United Kingdom", origin: "https://jobs.nottingham.ac.uk",
    path: "/rss/click.aspx", title: "Jobs at the University of Nottingham | University Park",
    encoding: "utf-8", // Live bytes are UTF-8 despite the legacy ISO-8859-1 declaration.
    holdMarkers: ["#INT", "#LI-DNI"], // Unexplained distribution markers stay out pending review.
  },
  "university-bath": {
    url: "https://www.bath.ac.uk/jobs/rss/rss.aspx?cat=418&type=9",
    location: "Bath, United Kingdom", origin: "https://www.bath.ac.uk",
    path: "/jobs/rss/click.aspx", title: "Jobs at Bath | Bath",
    encoding: "windows-1252", // Feed declares ISO-8859-1.
  },
  "university-greater-manchester": {
    url: "https://jobs.greatermanchester.ac.uk/RSS/rss.aspx?cat=927&type=9",
    location: "Bolton, United Kingdom", origin: "https://jobs.greatermanchester.ac.uk",
    path: "/RSS/click.aspx", title: "Jobs at University of Greater Manchester | Bolton Campus (inc. Queens and Greater Manchester Business School)",
    encoding: "utf-8",
  },
};

// Grouped campuses remain one employer and one atomic publication. All network
// destinations are explicitly reviewed here; never expand from RSS links.
export function universityFeedIds(boardId) {
  const root = UNIVERSITY_FEEDS[boardId];
  const ids = root?.campuses || [boardId];
  if (!root || !Array.isArray(ids) || !ids.length || ids.length > 4 ||
      new Set(ids).size !== ids.length || ids.some(id => !UNIVERSITY_FEEDS[id]?.url || UNIVERSITY_FEEDS[id]?.campuses))
    throw Error("Unreviewed university feed");
  return ids;
}

export function sourceRequestCost(board) {
  return board.provider === "university-rss" ? universityFeedIds(board.id).length : 1;
}
