import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  Bookmark,
  Compass,
  BriefcaseBusiness,
  BookOpen,
  MapPin,
  Check,
  CheckCheck,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  X,
  Menu,
  MessageSquare,
  ExternalLink,
  Download,
  Upload,
  Plus,
  Building2,
  GraduationCap,
  Heart,
  Leaf,
  Globe2,
  LayoutGrid,
  CalendarDays,
  Settings2,
  Info,
  CheckCircle2,
  Copy,
  RefreshCw,
  Trash2,
  Scale,
  Sparkles,
  Target,
  FileText,
  Radio,
} from "lucide-react";
import "./styles.css";
import { CareerProvider } from "./career-data";
import { CareerWorkspace, CareerAccountLink } from "./career";
import { ImmigrationUpdates } from "./updates";
type Employer = {
  id: string;
  name: string;
  city: string;
  county: string;
  routes: string[];
  ratings: string[];
};
type Saved = Employer & {
  savedAt: string;
  stage: string;
  role: string;
  notes: string;
  followUp: string;
  sourceDate: string;
};
type Meta = {
  source_date: string;
  source_url: string;
  publication_url: string;
  employers: number;
  skilled_worker: number;
  source_rows: number;
  checked_at: string;
  cities: number;
  refresh_error: string | null;
  routes: { name: string; count: number }[];
};
type Profile = { name: string; city: string; goal: string; checks: string[] };
const SOURCE =
  "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers";
const STAGES = [
  "Saved",
  "Preparing",
  "Applied",
  "Interview",
  "Offer",
  "Closed",
];
const DEFAULT_PROFILE: Profile = {
  name: "",
  city: "",
  goal: "Find a sponsor",
  checks: [],
};
const formatDate = (x: string) =>
  x
    ? new Date(x.slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not available";
const count = (n: number) => new Intl.NumberFormat("en-GB").format(n);
async function api<T>(path: string): Promise<T> {
  const r = await fetch(path);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Please try again.");
  return d;
}
function stored<T>(key: string, fallback: T): T {
  try {
    const x = JSON.parse(localStorage.getItem(key) || "null");
    if (x === null) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(x)) return fallback;
    return x as T;
  } catch {
    return fallback;
  }
}
const external = { target: "_blank", rel: "noopener noreferrer" };
const CAREERS: Record<string, string> = {
  "Google (UK) Limited": "https://www.google.com/about/careers/applications/",
  "Deloitte LLP": "https://www.deloitte.com/uk/en/careers.html",
  "Microsoft Limited": "https://careers.microsoft.com/",
  "Barclays Bank PLC": "https://search.jobs.barclays/",
  "Accenture (UK) Limited": "https://www.accenture.com/gb-en/careers",
  "The University of Manchester": "https://www.jobs.manchester.ac.uk/",
  "University College London":
    "https://www.ucl.ac.uk/work-at-ucl/search-ucl-jobs",
  "Amazon UK Services Ltd": "https://www.amazon.jobs/",
};
const GUIDES = [
  {
    tag: "START HERE",
    title: "Understand sponsorship",
    desc: "Learn how a licensed employer, an eligible job and your circumstances fit together.",
    url: "https://www.gov.uk/skilled-worker-visa",
    icon: ShieldCheck,
    color: "sage",
  },
  {
    tag: "AFTER UNIVERSITY",
    title: "Plan your next chapter",
    desc: "Read the official Graduate visa guidance, including work conditions and next steps.",
    url: "https://www.gov.uk/graduate-visa",
    icon: GraduationCap,
    color: "peach",
  },
  {
    tag: "WHILE STUDYING",
    title: "Know your work conditions",
    desc: "Check the official Student visa guidance before you start a role.",
    url: "https://www.gov.uk/student-visa",
    icon: BookOpen,
    color: "lilac",
  },
  {
    tag: "PERSONAL SUPPORT",
    title: "Find qualified advice",
    desc: "Find a regulated immigration adviser when you need advice about your own situation.",
    url: "https://www.gov.uk/find-an-immigration-adviser",
    icon: MessageSquare,
    color: "sand",
  },
];
function Brand({ small = false }: { small?: boolean }) {
  return (
    <a
      className={"brand " + (small ? "small" : "")}
      href="/"
      aria-label="Sponsor Intel home"
    >
      <span className="brandmark">
        <i />
        <i />
      </span>
      <span>
        Sponsor<span className="brandlight">Intel</span>
        <small>YOUR NEXT CHAPTER</small>
      </span>
    </a>
  );
}
function Monogram({
  employer,
  large = false,
}: {
  employer: Employer;
  large?: boolean;
}) {
  let hue = 0;
  for (const c of employer.name) hue = (hue + c.charCodeAt(0) * 7) % 5;
  const letters = employer.name
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter((x) => !["the", "limited", "ltd", "uk"].includes(x.toLowerCase()))
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`monogram tone-${hue} ${large ? "large" : ""}`}
    >
      {letters}
    </span>
  );
}
function App() {
  const [view, setView] = useState(
    location.pathname.replace(/^\//, "") || "discover",
  );
  useEffect(() => {
    const titles: Record<string, string> = {
      discover: "Sponsor Intel — Your next chapter in the UK",
      jobs: "UK vacancies · Sponsor Intel",
      guides: "Your UK career guide · Sponsor Intel",
      updates: "UK immigration updates, explained · Sponsor Intel",
      applications: "Your applications · Sponsor Intel",
      "career-profile": "Your CV profile · Sponsor Intel",
      studio: "Application studio · Sponsor Intel",
      account: "Your account · Sponsor Intel",
      saved: "Saved employers · Sponsor Intel",
      settings: "Preferences · Sponsor Intel",
      "employer-notes": "Employer notes · Sponsor Intel",
    };
    document.title = titles[view] || "Page not found · Sponsor Intel";
    const canonical =
      "https://sponsorintel.london" + (view === "discover" ? "/" : "/" + view);
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", canonical);
    document
      .querySelector('meta[property="og:url"]')
      ?.setAttribute("content", canonical);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        "content",
        ["discover", "jobs", "guides", "updates"].includes(view)
          ? "index,follow"
          : "noindex,nofollow",
      );
  }, [view]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [featured, setFeatured] = useState<Employer[]>([]);
  const [cities, setCities] = useState<{ city: string; count: number }[]>([]);
  const [saved, setSaved] = useState<Saved[]>(() =>
    stored<Saved[]>("si.saved.v1", [])
      .filter(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.name === "string" &&
          Array.isArray(x.routes) &&
          Array.isArray(x.ratings),
      )
      .slice(0, 500),
  );
  const [profile, setProfile] = useState<Profile>(() => {
    const p = stored<Profile>("si.profile.v1", DEFAULT_PROFILE);
    return {
      ...DEFAULT_PROFILE,
      ...p,
      checks: Array.isArray(p?.checks) ? p.checks : [],
    };
  });
  const [q, setQ] = useState(
    new URLSearchParams(location.search).get("q") || "",
  );
  const [city, setCity] = useState(
    new URLSearchParams(location.search).get("city") || "",
  );
  const [route, setRoute] = useState(
    new URLSearchParams(location.search).get("route") || "",
  );
  const [rating, setRating] = useState("");
  const [sort, setSort] = useState("az");
  const [page, setPage] = useState(1);
  const [searchKey, setSearchKey] = useState(0);
  const [explored, setExplored] = useState(
    !!location.search && !new URLSearchParams(location.search).has("employer"),
  );
  const [results, setResults] = useState<Employer[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [menu, setMenu] = useState(false);
  const [filters, setFilters] = useState(false);
  const [modal, setModal] = useState<
    | "employer"
    | "feedback"
    | "profile"
    | "privacy"
    | "sources"
    | "compare"
    | null
  >(null);
  const [selected, setSelected] = useState<Employer | null>(null);
  const [detailError, setDetailError] = useState("");
  const [toast, setToast] = useState("");
  const [comparison, setComparison] = useState<string[]>([]);
  const [feedbackKind, setFeedbackKind] = useState("feedback");
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [jobRole, setJobRole] = useState("");
  const [jobCity, setJobCity] = useState("");
  const [trackerFilter, setTrackerFilter] = useState("All");
  const dialog = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const notify = (text: string) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    try {
      localStorage.setItem("si.saved.v1", JSON.stringify(saved));
    } catch {
      notify(
        "Your browser could not save changes. Export a backup before you leave.",
      );
    }
  }, [saved]);
  useEffect(() => {
    try {
      localStorage.setItem("si.profile.v1", JSON.stringify(profile));
    } catch {
      notify("Your browser could not save preferences.");
    }
  }, [profile]);
  function load() {
    setError("");
    Promise.all([
      api<Meta>("/api/meta"),
      api<{ items: Employer[] }>("/api/featured"),
      api<{ city: string; count: number }[]>("/api/cities"),
    ])
      .then(([m, f, c]) => {
        setMeta(m);
        setFeatured(f.items);
        setCities(c);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);
  useEffect(() => {
    const onPop = () => {
      setView(location.pathname.replace(/^\//, "") || "discover");
      setMenu(false);
      const p = new URLSearchParams(location.search);
      if (p.has("employer")) openId(p.get("employer")!, false);
      else {
        setModal(null);
        setQ(p.get("q") || "");
        setCity(p.get("city") || "");
        setRoute(p.get("route") || "");
        setExplored(!!location.search);
        setSearchKey((x) => x + 1);
      }
    };
    window.addEventListener("popstate", onPop);
    const id = new URLSearchParams(location.search).get("employer");
    if (id) openId(id, false);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [modal]);
  function closeModal() {
    setModal(null);
    const u = new URL(location.href);
    if (u.searchParams.has("employer")) {
      u.searchParams.delete("employer");
      history.replaceState({}, "", u.pathname + u.search);
    }
  }
  function go(next: string) {
    setView(next);
    setMenu(false);
    setModal(null);
    history.pushState({}, "", next === "discover" ? "/" : "/" + next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function search(e?: React.FormEvent) {
    e?.preventDefault();
    setExplored(true);
    setPage(1);
    setSearchKey((x) => x + 1);
    setView("discover");
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (city) p.set("city", city);
    if (route) p.set("route", route);
    history.replaceState({}, "", "/" + (p.size ? "?" + p : "?browse=1"));
  }
  useEffect(() => {
    if (!explored) return;
    let active = true;
    setLoading(true);
    setSearchError("");
    const p = new URLSearchParams({
      q,
      city,
      route,
      rating,
      sort,
      page: String(page),
    });
    api<{ items: Employer[]; total: number; pages: number }>(
      "/api/sponsors?" + p,
    )
      .then((d) => {
        if (active) {
          setResults(d.items);
          setTotal(d.total);
          setPages(d.pages);
        }
      })
      .catch((e) => {
        if (active) setSearchError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchKey, page, sort, rating, explored]);
  async function openId(id: string, update = true) {
    setDetailError("");
    setSelected(null);
    setModal("employer");
    if (update) {
      const u = new URL(location.href);
      u.searchParams.set("employer", id);
      history.pushState({}, "", u.pathname + u.search);
    }
    try {
      const e = await api<Employer>("/api/sponsors/" + encodeURIComponent(id));
      setSelected(e);
    } catch (e) {
      setDetailError((e as Error).message);
    }
  }
  function save(e: Employer) {
    if (saved.some((x) => x.id === e.id)) {
      go("saved");
      return;
    }
    setSaved((s) => [
      ...s,
      {
        ...e,
        savedAt: new Date().toISOString(),
        stage: "Saved",
        role: "",
        notes: "",
        followUp: "",
        sourceDate: meta?.source_date || "",
      },
    ]);
    notify("Saved to your shortlist. Your next chapter is taking shape.");
  }
  function remove(id: string) {
    setSaved((s) => s.filter((x) => x.id !== id));
    setComparison((c) => c.filter((x) => x !== id));
    notify("Employer removed from your shortlist.");
  }
  function update(id: string, patch: Partial<Saved>) {
    setSaved((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function toggleCompare(id: string) {
    setComparison((c) =>
      c.includes(id)
        ? c.filter((x) => x !== id)
        : c.length < 3
          ? [...c, id]
          : c,
    );
  }
  function checkStep(key: string) {
    setProfile((p) => ({
      ...p,
      checks: p.checks.includes(key)
        ? p.checks.filter((x) => x !== key)
        : [...p.checks, key],
    }));
  }
  const steps = [
    {
      key: "shortlist",
      label: "Save three employers to explore",
      done: saved.length >= 3,
    },
    {
      key: "cv",
      label: "Tailor your CV to one role",
      done: profile.checks.includes("cv"),
    },
    {
      key: "application",
      label: "Send a thoughtful application",
      done: saved.some((x) =>
        ["Applied", "Interview", "Offer"].includes(x.stage),
      ),
    },
  ];
  const completed = steps.filter((x) => x.done).length;
  const applied = saved.filter((x) =>
    ["Applied", "Interview", "Offer"].includes(x.stage),
  ).length;
  function exportData() {
    download(
      JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), saved, profile },
        null,
        2,
      ),
      "sponsor-intel-workspace.json",
      "application/json",
    );
    notify("Backup download started. Keep the file somewhere safe.");
  }
  function download(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCSV() {
    const escape = (s: string) =>
      '"' +
      String(s)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Employer",
        "City",
        "Stage",
        "Role",
        "Follow up",
        "Notes",
        "Register date",
      ],
      ...saved.map((x) => [
        x.name,
        x.city,
        x.stage,
        x.role,
        x.followUp,
        x.notes,
        x.sourceDate,
      ]),
    ];
    download(
      rows.map((r) => r.map(escape).join(",")).join("\r\n"),
      "sponsor-intel-shortlist.csv",
      "text/csv;charset=utf-8",
    );
  }
  async function importData(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2000000) throw Error("This backup is too large.");
      const d = JSON.parse(await file.text());
      if (
        !d ||
        d.version !== 1 ||
        !Array.isArray(d.saved) ||
        d.saved.length > 500
      )
        throw Error("Please choose a Sponsor Intel backup.");
      const entries: Saved[] = d.saved.map((x: Saved) => {
        if (
          !x ||
          !/^[a-f0-9]{24}$/.test(x.id) ||
          typeof x.name !== "string" ||
          x.name.length > 500 ||
          !Array.isArray(x.routes) ||
          !Array.isArray(x.ratings) ||
          ![...x.routes, ...x.ratings].every(
            (v) => typeof v === "string" && v.length < 300,
          )
        )
          throw Error("This backup contains invalid records.");
        return {
          id: x.id,
          name: x.name,
          city: String(x.city || "").slice(0, 200),
          county: String(x.county || "").slice(0, 200),
          routes: x.routes,
          ratings: x.ratings,
          savedAt: String(x.savedAt || ""),
          stage: STAGES.includes(x.stage) ? x.stage : "Saved",
          role: String(x.role || "").slice(0, 200),
          notes: String(x.notes || "").slice(0, 2000),
          followUp: /^\d{4}-\d{2}-\d{2}$/.test(x.followUp) ? x.followUp : "",
          sourceDate: String(x.sourceDate || "").slice(0, 10),
        };
      });
      setSaved((s) => {
        const merged = new Map(s.map((x) => [x.id, x]));
        for (const x of entries) if (!merged.has(x.id)) merged.set(x.id, x);
        return [...merged.values()].slice(0, 500);
      });
      if (d.profile && typeof d.profile === "object") {
        const p = d.profile;
        setProfile((current) => ({
          ...current,
          name:
            current.name ||
            (typeof p.name === "string" ? p.name.slice(0, 40) : ""),
          goal:
            current.goal === DEFAULT_PROFILE.goal &&
            [
              "Find a sponsor",
              "My first graduate role",
              "My next career move",
            ].includes(p.goal)
              ? p.goal
              : current.goal,
          checks: [
            ...new Set([
              ...current.checks,
              ...(Array.isArray(p.checks)
                ? p.checks.filter((x: unknown) => x === "cv")
                : []),
            ]),
          ],
        }));
      }
      notify("Backup imported. Existing entries were kept.");
    } catch (e) {
      notify((e as Error).message);
    }
    if (importRef.current) importRef.current.value = "";
  }
  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setFeedbackStatus("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: feedbackKind,
          message: feedback,
          website: "",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setFeedback("");
      setFeedbackStatus(
        "Received. Thank you for helping shape Sponsor Intel. Reference " +
          d.id.slice(0, 8),
      );
    } catch (e) {
      setFeedbackStatus((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  function EmployerCard({ employer }: { employer: Employer }) {
    const isSaved = saved.some((x) => x.id === employer.id);
    const a = employer.ratings.every((x) =>
      /\(A (?:rating|\(Premium\)|\(SME\+\))\)/.test(x),
    );
    return (
      <article className="employer-card">
        <div className="card-top">
          <Monogram employer={employer} />
          <button
            className={"icon-button save-button " + (isSaved ? "is-saved" : "")}
            aria-label={(isSaved ? "View saved " : "Save ") + employer.name}
            onClick={() => save(employer)}
          >
            <Bookmark size={19} fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
        <button className="employer-title" onClick={() => openId(employer.id)}>
          {employer.name}
        </button>
        <div className="location">
          <MapPin size={14} />
          {employer.city || "Location not supplied"}
        </div>
        <div className="card-tags">
          <span className={a ? "tag green" : "tag amber"}>
            <ShieldCheck size={12} />
            {a ? "A-rated licence" : "Check licence rating"}
          </span>
          <span className="tag neutral">
            {employer.routes.includes("Skilled Worker")
              ? "Skilled Worker"
              : employer.routes[0]}
          </span>
        </div>
        <div className="card-footer">
          <span>Listed on official register</span>
          <button
            onClick={() => openId(employer.id)}
            aria-label={"View " + employer.name}
          >
            <ArrowUpRight size={20} />
          </button>
        </div>
      </article>
    );
  }
  const nav = [
    { id: "jobs", label: "Find a role", icon: Search },
    { id: "discover", label: "Discover sponsors", icon: Compass },
    { id: "saved", label: "My shortlist", icon: Bookmark, badge: saved.length },
    { id: "applications", label: "My applications", icon: BriefcaseBusiness },
    { id: "studio", label: "Application studio", icon: Sparkles },
    { id: "career-profile", label: "My CV & profile", icon: FileText },
    { id: "updates", label: "Immigration updates", icon: Radio },
    { id: "guides", label: "UK career guides", icon: BookOpen },
  ];
  const stale =
    meta &&
    (Date.now() - new Date(meta.source_date).getTime() > 7 * 86400000 ||
      meta.refresh_error);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Brand />
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <a
              key={n.id}
              href={n.id === "discover" ? "/" : "/" + n.id}
              className={view === n.id ? "active" : ""}
              aria-current={view === n.id ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(n.id);
              }}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {!!n.badge && <b>{n.badge}</b>}
              {n.id === "discover" && <span className="active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="little-spark">
            <Sparkles size={18} />
          </span>
          <strong>
            A little progress.
            <br />A bigger possibility.
          </strong>
          <p>Your next step doesn’t have to be a big one.</p>
          <button onClick={() => go("applications")}>
            See my progress <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setModal("feedback")}>
            <MessageSquare size={18} />
            Feedback & support
          </button>
          <button onClick={() => go("settings")}>
            <Settings2 size={18} />
            Workspace settings
          </button>
          <CareerAccountLink go={go} />
        </div>
      </aside>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <Brand small />
          </div>
          <div className="breadcrumbs">
            Your workspace <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n.id === view)?.label || "Settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="beta-label">OPEN BETA · FREE TO EXPLORE</span>
            <button
              className="topbar-guide"
              onClick={() => setModal("sources")}
            >
              <ShieldCheck size={16} />
              Sources & checks
            </button>
            <button
              className="profile-button"
              aria-label="Personalise your workspace"
              onClick={() => setModal("profile")}
            >
              {profile.name ? (
                profile.name[0].toUpperCase()
              ) : (
                <Leaf size={17} />
              )}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <Info size={20} />
              <span>{error}</span>
              <button onClick={load}>Try again</button>
            </div>
          )}
          {stale && (
            <div className="notice">
              <Info size={18} />
              <span>
                We’re showing the last verified register from{" "}
                {formatDate(meta!.source_date)}. Check the official source
                before you act.
              </span>
              <a href={SOURCE} {...external}>
                Open source <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          {view === "discover" && (
            <div className="career-launch">
              <span>
                <Sparkles size={18} />
                <strong>Your next step is here.</strong> Explore real roles and
                prepare with Hire Stack.
              </span>
              <button onClick={() => go("jobs")}>
                Find my next role <ArrowRight size={16} />
              </button>
            </div>
          )}
          {view === "discover" && (
            <>
              <div className="page-intro">
                <div>
                  <p className="eyebrow">
                    A WORLD OF AMBITION. A PLACE TO BEGIN.
                  </p>
                  <h1>
                    {profile.name
                      ? `Your next chapter, ${profile.name}.`
                      : "Your next chapter starts here."}
                  </h1>
                  <p>
                    Find UK sponsors. Make a shortlist. Move forward with
                    confidence.
                  </p>
                </div>
                <span className="date-chip">
                  <CalendarDays size={15} />
                  {meta
                    ? "Register · " + formatDate(meta.source_date)
                    : "Loading official register…"}
                </span>
              </div>
              <div className="welcome-grid">
                <section className="hero">
                  <div className="hero-copy">
                    <span className="hero-kicker">
                      <span /> FOR INTERNATIONAL TALENT
                    </span>
                    <h2>
                      Big ambitions.
                      <br />
                      <em>Clearer possibilities.</em>
                    </h2>
                    <p>
                      Discover employers licensed to sponsor.
                      <br />
                      Build a future that feels more like you.
                    </p>
                    <button
                      onClick={() => {
                        searchRef.current?.focus();
                        searchRef.current?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        });
                      }}
                    >
                      Find my next opportunity <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="journey-art" aria-hidden="true">
                    <div className="art-orbit orbit-one" />
                    <div className="art-orbit orbit-two" />
                    <div className="art-star">✳</div>
                    <div className="art-path" />
                    <div className="art-building building-one">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="art-building building-two">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="art-building building-three">
                      <span />
                      <i />
                      <i />
                    </div>
                    <div className="art-plant">
                      <i />
                      <i />
                      <i />
                    </div>
                    <div className="floating-label">
                      <span>
                        <Check size={13} />
                      </span>{" "}
                      A new beginning
                    </div>
                    <div className="art-ground" />
                  </div>
                  <span className="hero-bottom">
                    YOUR POTENTIAL HAS NO POSTCODE <Globe2 size={14} />
                  </span>
                </section>
                <section className="progress-card">
                  <div className="progress-head">
                    <span className="progress-icon">
                      <Target size={20} />
                    </span>
                    <span className="tiny-label">ONE STEP AT A TIME</span>
                  </div>
                  <h3>Make today count.</h3>
                  <p>Three small steps to get you moving.</p>
                  <div className="progress-track">
                    <i style={{ width: `${(completed / 3) * 100}%` }} />
                  </div>
                  <div className="progress-caption">
                    <strong>{completed} of 3 complete</strong>
                    <span>You’ve got this.</span>
                  </div>
                  <div className="mini-checklist">
                    {steps.map((s) => (
                      <button
                        key={s.key}
                        className={s.done ? "done" : ""}
                        onClick={() =>
                          s.key === "cv"
                            ? checkStep("cv")
                            : s.key === "application"
                              ? go("applications")
                              : searchRef.current?.focus()
                        }
                      >
                        <span>{s.done && <Check size={12} />}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <section
                className="search-section"
                aria-labelledby="search-title"
              >
                <div className="section-heading">
                  <h2 id="search-title">
                    Your search, with a little more clarity.
                  </h2>
                  <span>Start with an employer or a city</span>
                </div>
                <form className="searchbar" onSubmit={search}>
                  <label className="search-input">
                    <Search size={21} />
                    <span className="sr-only">Employer name or city</span>
                    <input
                      ref={searchRef}
                      aria-label="Employer name or city"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search employers, e.g. Google or NHS"
                      maxLength={100}
                    />
                    {q && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQ("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </label>
                  <label className="city-input">
                    <MapPin size={20} />
                    <span className="sr-only">Town or city</span>
                    <input
                      list="cities"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Anywhere in the UK"
                      maxLength={100}
                    />
                    <ChevronDown size={15} />
                  </label>
                  <button className="primary-button" type="submit">
                    Find sponsors <ArrowRight size={17} />
                  </button>
                </form>
                <datalist id="cities">
                  {cities.map((c) => (
                    <option key={c.city} value={c.city} />
                  ))}
                </datalist>
                <div className="quick-filters">
                  <span>Explore:</span>
                  {[
                    "London",
                    "Manchester",
                    "Birmingham",
                    "Edinburgh",
                    "Cardiff",
                  ].map((c) => (
                    <button
                      className={city === c ? "selected" : ""}
                      key={c}
                      onClick={() => {
                        setCity(c);
                        setQ("");
                        setExplored(true);
                        setPage(1);
                        setSearchKey((k) => k + 1);
                      }}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    className={"filter-toggle " + (filters ? "selected" : "")}
                    aria-expanded={filters}
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={14} />
                    More filters{" "}
                    {route || rating ? <span className="filter-dot" /> : null}
                  </button>
                </div>
                {filters && (
                  <div className="filters-panel">
                    <label>
                      Visa route
                      <select
                        value={route}
                        onChange={(e) => {
                          setRoute(e.target.value);
                          setExplored(true);
                          setPage(1);
                          setSearchKey((k) => k + 1);
                        }}
                      >
                        <option value="">All routes</option>
                        {meta?.routes.map((r) => (
                          <option key={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Licence rating
                      <select
                        value={rating}
                        onChange={(e) => {
                          setRating(e.target.value);
                          setExplored(true);
                          setPage(1);
                        }}
                      >
                        <option value="">All ratings</option>
                        <option value="A">A-rated only</option>
                      </select>
                    </label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQ("");
                        setCity("");
                        setRoute("");
                        setRating("");
                        setPage(1);
                        setSearchKey((k) => k + 1);
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </section>
              <div className="trust-line">
                <ShieldCheck size={16} />
                <span>
                  {meta ? (
                    <>
                      <strong>{count(meta.employers)}</strong> employer records
                      · GOV.UK register, {formatDate(meta.source_date)}
                    </>
                  ) : (
                    "Official GOV.UK sponsor register"
                  )}
                </span>
                <button onClick={() => setModal("sources")}>
                  How our data works <ArrowUpRight size={13} />
                </button>
              </div>
              <section
                className="results-section"
                aria-labelledby="results-title"
              >
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {explored ? "YOUR SEARCH" : "A FEW PLACES TO START"}
                    </span>
                    <h2 id="results-title">
                      {explored
                        ? loading
                          ? "Finding your possibilities…"
                          : `${count(total)} employer${total === 1 ? "" : "s"} found`
                        : "Discover the possibilities."}
                    </h2>
                  </div>
                  {explored ? (
                    <label className="sort-control">
                      <span>Sort:</span>
                      <select
                        aria-label="Sort employers"
                        value={sort}
                        onChange={(e) => {
                          setSort(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="az">Name A–Z</option>
                        <option value="za">Name Z–A</option>
                      </select>
                    </label>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => {
                        setQ("");
                        setCity("");
                        setRoute("");
                        setExplored(true);
                        setSearchKey((k) => k + 1);
                      }}
                    >
                      Explore all employers <ArrowRight size={16} />
                    </button>
                  )}
                </div>
                <p className="results-help">
                  A sponsor licence is a useful starting point. It does not
                  confirm an open job or sponsorship for a specific role.
                </p>
                {searchError ? (
                  <div className="empty-state">
                    <Info />
                    <h3>We couldn’t load those results.</h3>
                    <p>{searchError}</p>
                    <button
                      className="secondary-button"
                      onClick={() => setSearchKey((k) => k + 1)}
                    >
                      Try again
                    </button>
                  </div>
                ) : loading ? (
                  <div
                    className="employer-grid"
                    aria-busy="true"
                    aria-label="Loading employers"
                  >
                    {[1, 2, 3, 4, 5, 6].map((x) => (
                      <div className="skeleton-card" key={x}>
                        <i />
                        <i />
                        <i />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="employer-grid">
                    {(explored ? results : featured.slice(0, 6)).map((e) => (
                      <EmployerCard employer={e} key={e.id} />
                    ))}
                  </div>
                )}
                {explored && !loading && !searchError && !results.length && (
                  <div className="empty-state">
                    <Search />
                    <h3>No matches just yet.</h3>
                    <p>
                      Try a shorter employer name, check the spelling, or choose
                      a different city.
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setQ("");
                        setCity("");
                        setRoute("");
                        setRating("");
                        setSearchKey((k) => k + 1);
                      }}
                    >
                      Search the full register
                    </button>
                  </div>
                )}
                {explored && pages > 1 && !loading && (
                  <div className="pagination">
                    <button
                      disabled={page === 1}
                      className="secondary-button"
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <span>
                      Page {page} of {count(pages)}
                    </span>
                    <button
                      disabled={page >= pages}
                      className="secondary-button"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </section>
              <section className="guide-banner">
                <span className="guide-banner-icon">
                  <GraduationCap size={31} />
                </span>
                <div>
                  <span className="eyebrow">NEW TO THE UK JOB SEARCH?</span>
                  <h3>You don’t have to figure it all out at once.</h3>
                  <p>
                    Start with plain-language next steps and links to official
                    guidance.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => go("guides")}
                >
                  Find your starting point <ArrowUpRight size={17} />
                </button>
              </section>
            </>
          )}
          {view === "saved" && (
            <>
              <PageTitle
                eyebrow="MAKE ROOM FOR POSSIBILITY"
                title="Your shortlist, your way."
                description="Keep interesting employers close. Turn a possibility into your next step."
                action={
                  <>
                    <button
                      className="secondary-button"
                      onClick={exportCSV}
                      disabled={!saved.length}
                    >
                      <Download size={16} />
                      Export shortlist
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => go("discover")}
                    >
                      <Plus size={16} />
                      Find employers
                    </button>
                  </>
                }
              />
              <div className="workspace-note">
                <Info size={16} />
                Your shortlist is saved on this browser. Export a backup in
                settings to keep a copy.
              </div>
              {saved.length ? (
                <>
                  <div className="shortlist-tools">
                    <span>
                      <strong>{saved.length}</strong> saved employer
                      {saved.length === 1 ? "" : "s"}
                    </span>
                    <button
                      disabled={comparison.length < 2}
                      className="secondary-button"
                      onClick={() => setModal("compare")}
                    >
                      <Scale size={16} />
                      Compare{" "}
                      {comparison.length ? `(${comparison.length})` : ""}
                    </button>
                  </div>
                  <div className="employer-grid">
                    {saved.map((e) => (
                      <div className="saved-wrap" key={e.id}>
                        <EmployerCard employer={e} />
                        <div className="saved-controls">
                          <label>
                            <input
                              type="checkbox"
                              checked={comparison.includes(e.id)}
                              disabled={
                                !comparison.includes(e.id) &&
                                comparison.length >= 3
                              }
                              onChange={() => toggleCompare(e.id)}
                            />
                            Compare
                          </label>
                          <button
                            className="text-button"
                            onClick={() => {
                              update(e.id, {
                                stage:
                                  e.stage === "Saved" ? "Preparing" : e.stage,
                              });
                              go("applications");
                            }}
                          >
                            Track application <ArrowRight size={14} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={"Remove " + e.name}
                            onClick={() => remove(e.id)}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty
                  icon={Bookmark}
                  title="Your next opportunity starts with a save."
                  description="Tap the bookmark on an employer to keep it here. You can compare your shortlist and track what happens next."
                  action={() => go("discover")}
                  label="Discover employers"
                />
              )}
            </>
          )}
          {view === "employer-notes" && (
            <>
              <PageTitle
                eyebrow="SMALL STEPS. REAL PROGRESS."
                title="One step closer."
                description="A calm place to keep your applications, notes and next steps together."
                action={
                  <button
                    className="secondary-button"
                    onClick={exportCSV}
                    disabled={!saved.length}
                  >
                    <Download size={16} />
                    Export tracker
                  </button>
                }
              />
              <div className="tracker-stats">
                {[
                  { n: saved.length, l: "On your shortlist", icon: Bookmark },
                  {
                    n: applied,
                    l: "Applications sent",
                    icon: BriefcaseBusiness,
                  },
                  {
                    n: saved.filter((x) => x.stage === "Interview").length,
                    l: "At interview stage",
                    icon: MessageSquare,
                  },
                  {
                    n: saved.filter((x) => x.stage === "Offer").length,
                    l: "Offers received",
                    icon: Sparkles,
                  },
                ].map((s) => (
                  <div key={s.l}>
                    <span>
                      <s.icon size={20} />
                    </span>
                    <strong>{s.n}</strong>
                    <p>{s.l}</p>
                  </div>
                ))}
              </div>
              <div
                className="tracker-tabs"
                role="group"
                aria-label="Filter application stage"
              >
                {["All", ...STAGES].map((s) => (
                  <button
                    className={trackerFilter === s ? "active" : ""}
                    key={s}
                    onClick={() => setTrackerFilter(s)}
                  >
                    {s}
                    <span>
                      {s === "All"
                        ? saved.length
                        : saved.filter((x) => x.stage === s).length}
                    </span>
                  </button>
                ))}
              </div>
              {saved.filter(
                (x) => trackerFilter === "All" || x.stage === trackerFilter,
              ).length ? (
                <div className="application-list">
                  {saved
                    .filter(
                      (x) =>
                        trackerFilter === "All" || x.stage === trackerFilter,
                    )
                    .map((e) => (
                      <article className="application-card" key={e.id}>
                        <div className="application-top">
                          <Monogram employer={e} />
                          <div>
                            <button
                              onClick={() => openId(e.id)}
                              className="employer-title"
                            >
                              {e.name}
                            </button>
                            <span className="location">
                              <MapPin size={13} />
                              {e.city}
                            </span>
                          </div>
                          <label className="stage-select">
                            <span className="sr-only">
                              Application stage for {e.name}
                            </span>
                            <select
                              value={e.stage}
                              onChange={(ev) => {
                                update(e.id, { stage: ev.target.value });
                                notify("Application stage updated.");
                              }}
                            >
                              {STAGES.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="application-fields">
                          <label>
                            Role you’re exploring
                            <input
                              placeholder="e.g. Graduate analyst"
                              value={e.role}
                              maxLength={200}
                              onChange={(ev) =>
                                update(e.id, { role: ev.target.value })
                              }
                            />
                          </label>
                          <label>
                            Next follow-up
                            <input
                              type="date"
                              aria-label={"Follow-up date for " + e.name}
                              value={e.followUp}
                              onChange={(ev) =>
                                update(e.id, { followUp: ev.target.value })
                              }
                            />
                          </label>
                          <label className="notes-field">
                            Your notes
                            <textarea
                              placeholder="Application link, who you spoke to, or your next step…"
                              value={e.notes}
                              maxLength={2000}
                              onChange={(ev) =>
                                update(e.id, { notes: ev.target.value })
                              }
                            />
                          </label>
                        </div>
                        <div className="application-bottom">
                          <span>
                            <CheckCheck size={14} />
                            Saved automatically on this browser
                          </span>
                          {e.followUp &&
                            e.followUp <
                              new Date().toISOString().slice(0, 10) &&
                            !["Closed", "Offer"].includes(e.stage) && (
                              <span className="due-tag">Follow-up due</span>
                            )}
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <Empty
                  icon={BriefcaseBusiness}
                  title={
                    saved.length
                      ? "Nothing at this stage yet."
                      : "A fresh start for your applications."
                  }
                  description="Save an employer to start tracking. Add the role, your notes, and a follow-up date as you go."
                  label="Explore employers"
                  action={() => go("discover")}
                />
              )}
              <p className="fine-print">
                Follow-up dates appear in your tracker. Email reminders are not
                enabled. Keep important deadlines in your calendar too.
              </p>
            </>
          )}
          {[
            "jobs",
            "applications",
            "studio",
            "career-profile",
            "account",
          ].includes(view) && <CareerWorkspace mode={view} go={go} />}
          {view === "updates" && <ImmigrationUpdates />}
          {view === "guides" && (
            <>
              <PageTitle
                eyebrow="A LITTLE CLARITY GOES A LONG WAY"
                title="Find your feet. Then your future."
                description="A practical starting point for international students, graduates and people building their career in the UK."
              />
              <section className="guide-intro">
                <div>
                  <span className="tag green">YOUR STARTING POINT</span>
                  <h2>
                    You bring the ambition.
                    <br />
                    Let’s make the next step clearer.
                  </h2>
                  <p>
                    Choose the guidance that fits your situation. Each guide
                    takes you directly to the official source, where you can
                    read the current rules.
                  </p>
                </div>
                <GraduationCap size={100} strokeWidth={1} />
              </section>
              <div className="guides-grid">
                {GUIDES.map((g) => (
                  <a
                    className={"guide-card " + g.color}
                    href={g.url}
                    {...external}
                    key={g.title}
                  >
                    <g.icon size={29} />
                    <span className="eyebrow">{g.tag}</span>
                    <h3>{g.title}</h3>
                    <p>{g.desc}</p>
                    <strong>
                      Read on GOV.UK <ArrowUpRight size={18} />
                    </strong>
                  </a>
                ))}
              </div>
              <section className="plain-checklist">
                <h2>A thoughtful application, in four steps.</h2>
                {[
                  "Research the employer and verify the current sponsor register entry.",
                  "Read the exact role requirements and ask whether sponsorship is available.",
                  "Tailor your CV with specific examples that match the role.",
                  "Track your application and decide when to follow up.",
                ].map((s, i) => (
                  <div key={s}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{s}</p>
                  </div>
                ))}
              </section>
              <p className="fine-print">
                Sponsor Intel is an independent research tool. These links
                provide general information; the app does not assess visa
                eligibility or provide immigration advice.
              </p>
            </>
          )}
          {view === "settings" && (
            <>
              <PageTitle
                eyebrow="MAKE YOURSELF AT HOME"
                title="Your workspace."
                description="Personalise your starting point and keep a copy of your progress."
              />
              <div className="settings-grid">
                <section className="settings-card">
                  <h2>A little more you.</h2>
                  <label>
                    First name (optional)
                    <input
                      value={profile.name}
                      maxLength={40}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="What should we call you?"
                    />
                  </label>
                  <label>
                    Your focus
                    <select
                      value={profile.goal}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, goal: e.target.value }))
                      }
                    >
                      <option>Find a sponsor</option>
                      <option>My first graduate role</option>
                      <option>My next career move</option>
                    </select>
                  </label>
                  <p className="fine-print">
                    Your preferences stay in this browser. We don’t need your
                    nationality, passport or visa documents.
                  </p>
                </section>
                <section className="settings-card">
                  <h2>Keep your progress.</h2>
                  <p>
                    Your shortlist and notes are stored on this browser, without
                    an account. Clearing browser data removes them. A backup
                    lets you carry your shortlist to another browser.
                  </p>
                  <button className="primary-button" onClick={exportData}>
                    <Download size={17} />
                    Download workspace backup
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={17} />
                    Import an existing backup
                  </button>
                  <input
                    className="sr-only"
                    type="file"
                    accept="application/json,.json"
                    ref={importRef}
                    onChange={(e) => importData(e.target.files?.[0])}
                  />
                  <p className="fine-print">
                    Import merges saved employers without overwriting entries
                    already here. Backups include your notes, so keep them
                    private.
                  </p>
                </section>
                <section className="settings-card">
                  <h2>Transparency, by default.</h2>
                  <p>
                    Read where employer records come from, what the data can
                    tell you, and how your information is handled.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setModal("sources")}
                  >
                    Our data and sources <ArrowUpRight size={16} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setModal("privacy")}
                  >
                    Privacy and use <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {![
            "discover",
            "saved",
            "applications",
            "jobs",
            "guides",
            "updates",
            "settings",
            "studio",
            "career-profile",
            "account",
            "employer-notes",
          ].includes(view) && (
            <Empty
              icon={Compass}
              title="Let’s get you back on track."
              description="That page isn’t part of this workspace."
              action={() => go("discover")}
              label="Back to discover"
            />
          )}
          <footer>
            <span>
              <Leaf size={14} /> A clearer path to your next chapter.
            </span>
            <div>
              <button onClick={() => setModal("sources")}>
                Data & sources
              </button>
              <button onClick={() => setModal("privacy")}>Privacy & use</button>
              <button onClick={() => setModal("feedback")}>
                Leave feedback
              </button>
              <span>© {new Date().getFullYear()} Sponsor Intel</span>
            </div>
          </footer>
        </main>
      </div>
      <nav className="mobile-tabs" aria-label="Quick navigation">
        {nav.slice(0, 4).map((n) => (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            className={view === n.id ? "active" : ""}
          >
            <n.icon size={20} />
            <span>
              {n.id === "jobs"
                ? "Roles"
                : n.id === "discover"
                  ? "Sponsors"
                  : n.id === "saved"
                    ? "Saved"
                    : "Applications"}
            </span>
          </button>
        ))}
      </nav>
      <dialog
        ref={dialog}
        className={"modal " + (modal === "employer" ? "employer-modal" : "")}
        onCancel={(e) => {
          e.preventDefault();
          closeModal();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) closeModal();
        }}
        aria-label={
          modal === "employer"
            ? "Employer details"
            : modal === "feedback"
              ? "Send feedback"
              : modal === "sources"
                ? "Data and sources"
                : modal === "privacy"
                  ? "Privacy and use"
                  : modal === "compare"
                    ? "Compare employers"
                    : "Personalise your workspace"
        }
      >
        <div className="modal-inner">
          <button
            className="icon-button close-modal"
            aria-label="Close dialog"
            onClick={closeModal}
          >
            <X size={21} />
          </button>
          {modal === "employer" &&
            (detailError ? (
              <div className="empty-state">
                <Info />
                <h2>Check the latest source.</h2>
                <p>{detailError}</p>
                <a className="primary-button" href={SOURCE} {...external}>
                  Official register <ArrowUpRight size={16} />
                </a>
              </div>
            ) : selected ? (
              <>
                <div className="detail-heading">
                  <Monogram employer={selected} large />
                  <span className="eyebrow">EMPLOYER PROFILE</span>
                  <h2>{selected.name}</h2>
                  <p>
                    <MapPin size={16} />
                    {[selected.city, selected.county]
                      .filter(Boolean)
                      .join(", ") || "Location not supplied"}
                  </p>
                </div>
                <div className="detail-actions">
                  <button
                    className="primary-button"
                    onClick={() => save(selected)}
                  >
                    <Bookmark size={17} />
                    {saved.some((x) => x.id === selected.id)
                      ? "View in my shortlist"
                      : "Save employer"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(location.href);
                        notify("Employer link copied.");
                      } catch {
                        notify(
                          "Copy this page’s address to share the employer.",
                        );
                      }
                    }}
                  >
                    <Copy size={16} />
                    Copy link
                  </button>
                </div>
                <div className="verified-strip">
                  <ShieldCheck size={22} />
                  <div>
                    <strong>Listed in the official sponsor register</strong>
                    <span>
                      Snapshot published {formatDate(meta?.source_date || "")}
                    </span>
                  </div>
                </div>
                <h3>Licensed sponsorship routes</h3>
                <div className="route-list">
                  {selected.routes.map((r) => (
                    <span key={r}>
                      <Check size={15} />
                      {r}
                    </span>
                  ))}
                </div>
                <h3>Licence ratings</h3>
                <div className="rating-list">
                  {selected.ratings.map((r) => (
                    <span
                      className={
                        /\(A (?:rating|\(Premium\)|\(SME\+\))\)/.test(r)
                          ? "tag green"
                          : "tag amber"
                      }
                      key={r}
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <p className="detail-note">
                  This confirms the employer appears in our dated register
                  snapshot. It does not confirm current vacancies, a specific
                  job’s sponsorship, or your eligibility. Verify the live
                  register and the job advert.
                </p>
                <div className="next-step-box">
                  <span className="eyebrow">YOUR NEXT STEP</span>
                  <h3>Explore what’s possible.</h3>
                  {CAREERS[selected.name] ? (
                    <a
                      className="primary-button"
                      href={CAREERS[selected.name]}
                      {...external}
                    >
                      Visit employer careers <ArrowUpRight size={17} />
                    </a>
                  ) : (
                    <a
                      className="primary-button"
                      href={
                        "https://www.jobs.service.gov.uk/jobs/search?keywords=" +
                        encodeURIComponent(selected.name)
                      }
                      {...external}
                    >
                      Search employer vacancies <ArrowUpRight size={17} />
                    </a>
                  )}
                  <a className="source-link" href={SOURCE} {...external}>
                    Verify on GOV.UK <ExternalLink size={14} />
                  </a>
                  <p>Check the exact employer name and role before applying.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setFeedbackKind("data");
                    setFeedback(
                      "Employer: " + selected.name + "\nWhat needs checking: ",
                    );
                    setModal("feedback");
                  }}
                >
                  Report a data issue <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <div className="empty-state">
                <RefreshCw className="spin" />
                <p>Checking the current register snapshot…</p>
              </div>
            ))}
          {modal === "feedback" && (
            <>
              <span className="modal-symbol">
                <MessageSquare />
              </span>
              <p className="eyebrow">BETTER, TOGETHER</p>
              <h2>Help shape Sponsor Intel.</h2>
              <p>
                Something confusing, a data issue, or an idea? We’re listening.
              </p>
              <form className="feedback-form" onSubmit={submitFeedback}>
                <label>
                  What would you like to share?
                  <select
                    value={feedbackKind}
                    onChange={(e) => setFeedbackKind(e.target.value)}
                  >
                    <option value="feedback">Feedback or idea</option>
                    <option value="bug">Something isn’t working</option>
                    <option value="data">An employer data issue</option>
                  </select>
                </label>
                <label>
                  Your message
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    minLength={10}
                    maxLength={2000}
                    required
                    placeholder="Tell us a little about it…"
                    rows={5}
                  />
                </label>
                <p className="fine-print">
                  Feedback is stored privately for review. Don’t include
                  passwords, passport details or other sensitive information.
                  This form is not an immigration advice service.
                </p>
                <button className="primary-button" disabled={sending}>
                  {sending ? "Sending…" : "Send feedback"}
                  <ArrowRight size={17} />
                </button>
                <p role="status" className="form-status">
                  {feedbackStatus}
                </p>
              </form>
            </>
          )}
          {modal === "profile" && (
            <>
              <span className="modal-symbol">
                <Leaf />
              </span>
              <p className="eyebrow">YOUR OWN STARTING POINT</p>
              <h2>Make yourself at home.</h2>
              <p>Give your workspace a personal touch. No account needed.</p>
              <label>
                First name (optional)
                <input
                  value={profile.name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, name: e.target.value }))
                  }
                  maxLength={40}
                  placeholder="Your first name"
                />
              </label>
              <label>
                What brings you here?
                <select
                  value={profile.goal}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, goal: e.target.value }))
                  }
                >
                  <option>Find a sponsor</option>
                  <option>My first graduate role</option>
                  <option>My next career move</option>
                </select>
              </label>
              <button
                className="primary-button"
                onClick={() => {
                  closeModal();
                  notify("Your workspace is ready for you.");
                }}
              >
                Make it mine <ArrowRight size={17} />
              </button>
              <p className="fine-print">
                Only saved in this browser. You can change this in settings.
              </p>
            </>
          )}
          {modal === "sources" && (
            <>
              <span className="modal-symbol">
                <ShieldCheck />
              </span>
              <p className="eyebrow">CLARITY YOU CAN CHECK</p>
              <h2>Official data. Clear limits.</h2>
              <p>
                Employer records come from the Home Office’s register of
                licensed sponsors for Worker and Temporary Worker routes.
              </p>
              {meta && (
                <dl className="source-details">
                  <div>
                    <dt>Source publication</dt>
                    <dd>{formatDate(meta.source_date)}</dd>
                  </div>
                  <div>
                    <dt>Source rows</dt>
                    <dd>{count(meta.source_rows)}</dd>
                  </div>
                  <div>
                    <dt>Employer records</dt>
                    <dd>{count(meta.employers)}</dd>
                  </div>
                  <div>
                    <dt>Last source check</dt>
                    <dd>{formatDate(meta.checked_at)}</dd>
                  </div>
                </dl>
              )}
              <p>
                We combine records with the same normalised employer name,
                town/city and county, keeping their listed routes and ratings.
                Different registered locations may appear separately. Location
                is the register’s address, not necessarily a vacancy’s work
                location.
              </p>
              <h3>What we don’t infer</h3>
              <p>
                We don’t treat a sponsor licence as a job offer, invent
                sponsorship probabilities, or claim that featured employers are
                currently hiring. Featured employers are starting points, not
                personal recommendations.
              </p>
              <h3>Keeping the register up to date</h3>
              <p>
                We check the official publication daily. A new snapshot only
                replaces the current one after its import passes validation. The
                date shown is the source publication date. Always verify the
                live source before making a decision.
              </p>
              <a href={SOURCE} {...external} className="primary-button">
                Open official register <ArrowUpRight size={17} />
              </a>
              <p className="fine-print">
                Contains public sector information licensed under the{" "}
                <a
                  href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                  {...external}
                >
                  Open Government Licence v3.0
                </a>
                . Sponsor Intel is independent and not affiliated with the Home
                Office or featured employers.
              </p>
            </>
          )}
          {modal === "privacy" && (
            <>
              <span className="modal-symbol">
                <ShieldCheck />
              </span>
              <h2>Your space, respected.</h2>
              <h3>What stays on your device</h3>
              <p>
                Your original employer shortlist and guest career workspace stay
                in this browser. Signing in syncs your career profile, documents
                and applications to your private account on Cloudflare. Anyone
                using the same browser profile may see guest data. Signing out
                clears the signed-in career cache from this device.
              </p>
              <h3>What is sent to the service</h3>
              <p>
                Search terms and filters are sent to our Cloudflare-hosted
                service to return results. Feedback is stored privately for
                review. Avoid personal or sensitive details in either. CV files
                are read in your browser. Extracted text is saved with your
                career workspace. When you agree and press Prepare, your CV and
                job description are sent to Cloudflare AI. Review generated
                content before using it. Infrastructure may process connection
                and request information for security and reliability.
              </p>
              <h3>External services</h3>
              <p>
                Fonts are delivered by Google Fonts; exported PDFs use bundled
                Noto Sans.{" "}
                <a
                  href="/open-source-notices.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open-source notices
                </a>
                . External career and guidance links open sites with their own
                privacy policies. We do not include advertising trackers or
                behavioural analytics.
              </p>
              <h3>Control your information</h3>
              <p>
                Remove employers from your shortlist, export your workspace, or
                clear this site’s browser data to remove local information.
                Career accounts use email and password, with a recovery code;
                email verification and reset emails are not currently enabled.
                Use Account & backup to export your career workspace, or delete
                your account and cloud career data. Clearing browser data cannot
                be undone without a backup. For feedback removal, send a request
                quoting its reference using the feedback form.
              </p>
              <h3>Using Sponsor Intel</h3>
              <p>
                This free beta helps you research employers and organise your
                own job search. Data may be delayed or incomplete. Check
                official records, the employer and the role yourself. The app
                provides no immigration advice, eligibility decision, job offer
                or visa guarantee.
              </p>
              <button
                className="secondary-button"
                onClick={() => {
                  closeModal();
                  go("settings");
                }}
              >
                Workspace settings <ArrowRight size={16} />
              </button>
            </>
          )}
          {modal === "compare" && (
            <>
              <p className="eyebrow">SIDE BY SIDE</p>
              <h2>A clearer shortlist.</h2>
              <p>
                Compare the official register details for your selected
                employers.
              </p>
              <div className="comparison-grid">
                {comparison
                  .map((id) => saved.find((s) => s.id === id))
                  .filter(Boolean)
                  .map((e) => (
                    <div key={e!.id}>
                      <Monogram employer={e!} />
                      <h3>{e!.name}</h3>
                      <p>
                        <MapPin size={14} />
                        {e!.city}
                      </p>
                      <strong>Listed routes</strong>
                      {e!.routes.map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                      <strong>Licence ratings</strong>
                      {e!.ratings.map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                      <button
                        className="text-button"
                        onClick={() => openId(e!.id)}
                      >
                        View current record <ArrowUpRight size={14} />
                      </button>
                    </div>
                  ))}
              </div>
              <p className="fine-print">
                Saved records reflect the date you saved them. Open a current
                record to check for updates. Employer names and locations alone
                do not establish a job’s eligibility.
              </p>
            </>
          )}
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro subpage-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="title-actions">{action}</div>}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
  label,
  action,
}: {
  icon: typeof Search;
  title: string;
  description: string;
  label: string;
  action: () => void;
}) {
  return (
    <section className="empty-state spacious">
      <span className="empty-icon">
        <Icon size={31} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="primary-button" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CareerProvider>
      <App />
    </CareerProvider>
  </React.StrictMode>,
);
