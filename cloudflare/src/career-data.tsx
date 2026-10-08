import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { campaignHeaders } from './metrics';

export type CareerProfile = {
  name: string;
  email: string;
  phone: string;
  city: string;
  headline: string;
  cv: string;
  skills: string;
  goal: string;
  sponsorship: string;
};
export type CareerApplication = {
  id: string;
  jobId: string;
  company: string;
  title: string;
  location: string;
  description: string;
  url: string;
  sponsorship: string;
  evidence: string;
  checkedAt: string;
  stage: string;
  notes: string;
  followUp: string;
  createdAt: string;
  updatedAt: string;
  cv: string;
  coverLetter: string;
  interview: string;
  analysis: string;
  companyResearch: string;
  portfolio: string;
  learningPlan: string;
  preparedAt: string;
};
export type Job = {
  id: string;
  company: string;
  title: string;
  location: string;
  description?: string;
  apply_url: string;
  provider: string;
  sponsorship: string;
  evidence: string;
  last_seen: string;
  first_seen: string;
  level: string;
  active?: number;
  salary_excerpt?: string;
  employment_type?: string;
  workplace?: string;
  source_updated_at?: string;
  application_deadline?: string | null;
  closes_at?: string | null;
  sector?: string;
  sector_label?: string;
  employer_licence?: {
    id: string; name: string; city: string; routes: string[]; ratings: string[];
    source_date: string; checked_at: string; evidence_url: string | null; reviewed_at: string;
  } | null;
  source?: { careers_url: string; checked_at: string; last_success: string; error: string | null } | null;
};
export type SavedSearch = {
  id: string;
  q: string;
  location: string;
  sponsorship: string;
  level: string;
  salary?: string;
  sector?: string;
  licence?: string;
  createdAt: string;
};
export type CareerData = {
  version: 2;
  profile: CareerProfile;
  applications: CareerApplication[];
  searches: SavedSearch[];
};
export const EMPTY_PROFILE: CareerProfile = {
  name: "",
  email: "",
  phone: "",
  city: "",
  headline: "",
  cv: "",
  skills: "",
  goal: "",
  sponsorship: "unsure",
};
export const emptyData = (): CareerData => ({
  version: 2,
  profile: { ...EMPTY_PROFILE },
  applications: [],
  searches: [],
});
export const stages = [
  "Saved",
  "Preparing",
  "Applied",
  "Interview",
  "Offer",
  "Closed",
];
export const sponsorLabels: Record<string, string> = {
  offered: "Sponsorship stated",
  conditional: "Conditional sponsorship",
  not_stated: "Sponsorship not stated",
  unavailable: "Sponsorship unavailable",
};
export const day = (s: string) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not supplied";
export const stamp = () => new Date().toISOString();
export async function request<T = any>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json", ...campaignHeaders() } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok)
    throw new Error(
      d.error?.message || d.message || d.error || "Please try again.",
    );
  return d;
}
export function download(
  content: Blob | string,
  name: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function readLocal(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v?.data?.version === 2 ? v : null;
  } catch {
    return null;
  }
}
export function mergeData(base: CareerData, incoming: CareerData): CareerData {
  const applications = new Map(base.applications.map((a) => [a.id, a]));
  for (const a of incoming.applications)
    if (!applications.has(a.id)) applications.set(a.id, a);
  const profile = { ...base.profile };
  for (const k of Object.keys(profile) as (keyof CareerProfile)[])
    if (!profile[k]) profile[k] = incoming.profile[k] || "";
  const searches = new Map(base.searches.map((s) => [s.id, s]));
  for (const s of incoming.searches || [])
    if (!searches.has(s.id)) searches.set(s.id, s);
  return {
    version: 2,
    profile,
    applications: [...applications.values()].slice(0, 100),
    searches: [...searches.values()].slice(0, 10),
  };
}
type CareerContextValue = {
  data: CareerData;
  setData: React.Dispatch<React.SetStateAction<CareerData>>;
  user: { id: string; name: string; email: string; emailVerified?: boolean } | null;
  status: string;
  error: string;
  setError: (s: string) => void;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  saveJob: (job: Job) => string;
  updateApplication: (id: string, patch: Partial<CareerApplication>) => void;
  selected: string;
  setSelected: (id: string) => void;
  importGuest: () => void;
  ready: boolean;
};
const Context = createContext<CareerContextValue | null>(null);
export function CareerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CareerData>(
    () => readLocal("si.career.guest.v2")?.data || emptyData(),
  );
  const [user, setUser] = useState<CareerContextValue["user"]>(null),
    [status, setStatus] = useState("Saved on this browser"),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState("");
  const revision = useRef(0),
    lastSaved = useRef(""),
    saving = useRef(false),
    currentUser = useRef(""),
    blocked = useRef(false),
    loadVersion = useRef(0),
    latest = useRef(data);
  latest.current = data;
  async function load() {
    const version = ++loadVersion.current;
    setReady(false);
    setError("");
    blocked.current = false;
    try {
      const s = await request("/api/auth/get-session");
      if (version !== loadVersion.current) return;
      const u = s?.user || null;
      setUser(u);
      currentUser.current = u?.id || "";
      if (u) {
        setData(emptyData());
        setStatus("Loading your workspace…");
        const w = await request("/api/career/workspace");
        if (version !== loadVersion.current) return;
        revision.current = w.revision;
        const cached = readLocal("si.career.user." + u.id);
        const remote = w.data || emptyData();
        lastSaved.current = JSON.stringify(remote);
        if (cached?.dirty) {
          setData(cached.data);
          if (cached.revision !== w.revision) {
            blocked.current = true;
            setError(
              "You have unsaved changes and another device changed this workspace. Export this copy before reloading.",
            );
          }
        } else setData(remote);
        setStatus("Synced to your account");
      } else {
        setData(readLocal("si.career.guest.v2")?.data || emptyData());
        setStatus("Saved on this browser");
        lastSaved.current = "";
      }
      setReady(true);
    } catch (e) {
      if (version !== loadVersion.current) return;
      blocked.current = true;
      const cached = currentUser.current
        ? readLocal("si.career.user." + currentUser.current)
        : null;
      if (cached) setData(cached.data);
      setError((e as Error).message);
      setStatus("Connection unavailable — export your backup before reloading");
      setReady(!currentUser.current || !!cached);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const key = user ? "si.career.user." + user.id : "si.career.guest.v2";
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          data,
          revision: revision.current,
          dirty: !!user && JSON.stringify(data) !== lastSaved.current,
        }),
      );
    } catch {
      setError("Your browser storage is full. Export a backup before closing.");
    }
    if (!user || blocked.current) return;
    const timer = setTimeout(() => void sync(user.id), 900);
    return () => clearTimeout(timer);
  }, [data, user, ready]);
  async function sync(userId: string) {
    if (saving.current || blocked.current || currentUser.current !== userId)
      return;
    saving.current = true;
    try {
      while (currentUser.current === userId && !blocked.current) {
        const copy = latest.current,
          json = JSON.stringify(copy);
        if (json === lastSaved.current) break;
        setStatus("Saving…");
        const r = await request("/api/career/workspace", "PUT", {
          data: copy,
          revision: revision.current,
        });
        if (currentUser.current !== userId) break;
        revision.current = r.revision;
        lastSaved.current = json;
        setStatus("Synced to your account");
        localStorage.setItem(
          "si.career.user." + userId,
          JSON.stringify({
            data: latest.current,
            revision: r.revision,
            dirty: JSON.stringify(latest.current) !== json,
          }),
        );
      }
    } catch (e) {
      setStatus("Changes saved on this device");
      setError((e as Error).message);
      blocked.current = true;
    } finally {
      saving.current = false;
    }
  }
  async function logout() {
    if (user && JSON.stringify(latest.current) !== lastSaved.current) {
      await sync(user.id);
      if (JSON.stringify(latest.current) !== lastSaved.current)
        throw new Error(
          "Your latest changes have not synced. Download a career backup before reloading or signing out.",
        );
    }
    ++loadVersion.current;
    await request("/api/auth/sign-out", "POST", {});
    if (user) localStorage.removeItem("si.career.user." + user.id);
    currentUser.current = "";
    setUser(null);
    setData(readLocal("si.career.guest.v2")?.data || emptyData());
    setSelected("");
    setError("");
    setStatus("Saved on this browser");
    blocked.current = false;
  }
  function updateApplication(id: string, patch: Partial<CareerApplication>) {
    setData((d) => ({
      ...d,
      applications: d.applications.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: stamp() } : a,
      ),
    }));
  }
  function saveJob(job: Job) {
    if (!ready) {
      setError("Wait for your workspace to finish loading.");
      return "";
    }
    const existing = latest.current.applications.find(
      (a) => a.jobId === job.id,
    );
    if (existing) {
      setSelected(existing.id);
      return existing.id;
    }
    if (data.applications.length >= 100) {
      setError(
        "Your workspace holds 100 applications. Export a backup and remove finished entries to make room.",
      );
      return "";
    }
    const id = crypto.randomUUID();
    const a: CareerApplication = {
      id,
      jobId: job.id,
      company: job.company,
      title: job.title,
      location: job.location,
      description: job.description || "",
      url: job.apply_url,
      sponsorship: job.sponsorship,
      evidence: job.evidence,
      checkedAt: job.last_seen,
      stage: "Saved",
      notes: "",
      followUp: "",
      createdAt: stamp(),
      updatedAt: stamp(),
      cv: "",
      coverLetter: "",
      analysis: "",
      interview: "",
      companyResearch: "",
      portfolio: "",
      learningPlan: "",
      preparedAt: "",
    };
    latest.current = {
      ...latest.current,
      applications: [a, ...latest.current.applications],
    };
    setData(latest.current);
    setSelected(id);
    return id;
  }
  function importGuest() {
    const guest = readLocal("si.career.guest.v2")?.data;
    if (guest) setData((d) => mergeData(d, guest));
  }
  return (
    <Context.Provider
      value={{
        data,
        setData,
        user,
        status,
        error,
        setError,
        reload: load,
        logout,
        saveJob,
        updateApplication,
        selected,
        setSelected,
        importGuest,
        ready,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCareer() {
  const v = useContext(Context);
  if (!v) throw Error("CareerProvider required");
  return v;
}

// Adapted from HireStack's cadence engine. The user chooses whether to follow up.
export function followupDate(start = new Date(), days = 7) {
  const d = new Date(start);
  for (let n = 0; n < days;) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
  }
  return d.toISOString().slice(0, 10);
}
export function followupDraft(a: CareerApplication, name: string) {
  return `Subject: ${a.title} — application follow-up\n\nHello,\n\nI’m following up on my application for ${a.title} at ${a.company}. I’d be happy to provide any further information or work samples that would be useful.\n\nPlease let me know if there is an update on the next steps.\n\nBest wishes,\n${name || "[Your name]"}`;
}
