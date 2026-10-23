import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { campaignHeaders } from './metrics';
import {beginPreparedDraft,acceptPreparedDraft,type PreparationTicket} from '../shared/prepared-draft.js';
import {acceptAdvertReview, type AdvertSnapshot} from '../shared/advert-version.js';

import {readRecoveryCopy,discardRecoveryCopy,switchCloudWorkspace,type RecoveryCopy} from '../shared/workspace-recovery.js';

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
  sourceVersion?: string;
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
  preparation_version?: string;
  apply_url: string;
  provider: string;
  sponsorship: string;
  evidence: string;
  last_seen: string;
  first_seen: string;
  level: string;
  active?: number;
  review_hold?: "held" | "released" | null;
  salary_excerpt?: string;
  employment_type?: string;
  workplace?: string;
  source_updated_at?: string;
  description_checked_at?: string | null;
  source_first_published_at?: string | null;
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
  recoveryCopy: RecoveryCopy | null;
  reloadCloud: () => Promise<void>;
  restoreRecovery: () => Promise<void>;
  removeRecovery: () => void;
  saveJob: (job: Job) => string;
  updateApplication: (id: string, patch: Partial<CareerApplication>) => void;
  reviewAdvert: (expected:CareerApplication,advert:AdvertSnapshot,keepText:boolean) => boolean;
  beginPreparation: (id: string, kind: string) => PreparationTicket;
  finishPreparation: (ticket: PreparationTicket, result: {text:string;generatedAt:string}) => boolean;
  selected: string;
  setSelected: (id: string) => void;
  importGuest: () => void;
  ready: boolean;
};
const Context = createContext<CareerContextValue | null>(null);
export function CareerProvider({ children }: { children: React.ReactNode }) {
  const [data, setStateData] = useState<CareerData>(
    () => readLocal("si.career.guest.v2")?.data || emptyData(),
  );
  const [user, setUser] = useState<CareerContextValue["user"]>(null),
    [status, setStatus] = useState("Saved on this browser"),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState("");
  const [recoveryCopy,setRecoveryCopy] = useState<RecoveryCopy|null>(null);
  const replacing = useRef(false);
  const cacheGuard = useRef<{key:string;raw:string|null}|null>(null);
  const revision = useRef(0),
    lastSaved = useRef(""),
    saving = useRef(false),
    currentUser = useRef(""),
    blocked = useRef(false),
    loadVersion = useRef(0),
    latest = useRef(data),
    preparationSerial = useRef(0),
    preparationRequests = useRef(new Map<string,number>());
  // Update the same current snapshot synchronously for edits, account loads and
  // async completions; an old response must not race a queued React update.
  const setData: React.Dispatch<React.SetStateAction<CareerData>> = action => {
    const next = typeof action === 'function' ? action(latest.current) : action;
    latest.current = next;
    setStateData(next);
  };
  const preparationScope = () => `${loadVersion.current}:${currentUser.current}`;
  function beginPreparation(id:string,kind:string) {
    if(!ready)throw Error('Wait for your workspace to finish loading.');
    const ticket=beginPreparedDraft(latest.current,id,kind,preparationScope(),++preparationSerial.current);
    preparationRequests.current.set(`${id}:${kind}`,ticket.requestId);
    return ticket;
  }
  function finishPreparation(ticket:PreparationTicket,result:{text:string;generatedAt:string}) {
    const key=`${ticket.input.application.id}:${ticket.kind}`;
    const accepted=acceptPreparedDraft(latest.current,ticket,result,preparationScope(),preparationRequests.current.get(key));
    if(preparationRequests.current.get(key)===ticket.requestId)preparationRequests.current.delete(key);
    if(accepted.status==='saved'){setData(accepted.data);return true;}
    if(accepted.status!=='superseded')setError(accepted.status==='changed'
      ? 'Your CV, application or draft changed during preparation. Your current work was kept; the returned draft was not saved. Review your evidence before preparing again.'
      : 'The returned draft could not be saved. Your current work was kept.');
    return false;
  }
  async function load() {
    const version = ++loadVersion.current;
    cacheGuard.current=null;
    setReady(false);
    setError("");
    blocked.current = false;
    try {
      const s = await request("/api/auth/get-session");
      if (version !== loadVersion.current) return;
      const u = s?.user || null;
      setUser(u);
      currentUser.current = u?.id || "";
      try { setRecoveryCopy(u ? readRecoveryCopy(localStorage,u.id) : null); }
      catch { setRecoveryCopy(null); /* Cloud reads remain usable when device storage is unavailable. Switching still requires verified storage. */ }
      if (u) {
        setData(emptyData());
        setStatus("Loading your workspace…");
        const w = await request("/api/career/workspace");
        if (version !== loadVersion.current) return;
        if(w.accountId!==u.id)throw Error("Your signed-in account changed. Sign in again before syncing.");
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
        setStatus(cached?.dirty ? "Changes saved on this device" : "Synced to your account");
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
      if(cacheGuard.current?.key===key&&localStorage.getItem(key)!==cacheGuard.current.raw){
        blocked.current=true;
        setError('Another tab changed the saved copy. Your current work and recovery copy remain available here; download them before reloading.');
        return;
      }
      const raw=JSON.stringify({data,revision:revision.current,dirty:!!user&&JSON.stringify(data)!==lastSaved.current});
      localStorage.setItem(key,raw);
      if(cacheGuard.current?.key===key)cacheGuard.current.raw=raw;
    } catch {
      setError('Your browser storage is full or unavailable. Export a backup before closing.');
    }
    if (!user || blocked.current) return;
    const timer = setTimeout(() => void sync(user.id), 900);
    return () => clearTimeout(timer);
  }, [data, user, ready]);
  async function sync(userId: string) {
    if (saving.current || replacing.current || blocked.current || currentUser.current !== userId)
      return;
    saving.current = true;
    try {
      while (currentUser.current === userId && !blocked.current && !replacing.current) {
        const copy = latest.current,
          json = JSON.stringify(copy);
        if (json === lastSaved.current) break;
        setStatus("Saving…");
        const r = await request("/api/career/workspace", "PUT", {
          data: copy,
          accountId: userId,
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
        if(cacheGuard.current?.key==="si.career.user."+userId)cacheGuard.current.raw=localStorage.getItem(cacheGuard.current.key);
      }
    } catch (e) {
      setStatus("Changes saved on this device");
      setError((e as Error).message);
      blocked.current = true;
    } finally {
      saving.current = false;
    }
  }
  async function reloadCloud() {
    const id=currentUser.current;
    if(!id||!ready||saving.current||replacing.current)throw Error('Wait for your workspace to finish saving or loading.');
    cacheGuard.current={key:"si.career.user."+id,raw:localStorage.getItem("si.career.user."+id)};
    replacing.current=true;
    const version=++loadVersion.current;
    setReady(false);setError('');
    try {
      const remote=await switchCloudWorkspace({storage:localStorage,id,data:latest.current,revision:revision.current,
        readCloud:async()=>{
          const session=await request('/api/auth/get-session');
          if(session?.user?.id!==id)throw Error('Your signed-in account changed. Your current work was kept.');
          const w=await request('/api/career/workspace');
          return {...w,data:w.data||emptyData()};
        },
        isCurrent:before=>version===loadVersion.current&&currentUser.current===id&&JSON.stringify(latest.current)===before,
        onPreserved:setRecoveryCopy});
      cacheGuard.current.raw=localStorage.getItem(cacheGuard.current.key);
      revision.current=remote.revision;lastSaved.current=JSON.stringify(remote.data);
      setData(remote.data);setSelected('');blocked.current=false;
      setStatus('Synced to your account');
    } catch(e) {
      if(version===loadVersion.current&&currentUser.current===id){blocked.current=true;setStatus('Current copy kept on this device');setError((e as Error).message);}
      throw e;
    } finally {
      replacing.current=false;
      if(version===loadVersion.current&&currentUser.current===id)setReady(true);
    }
  }
  function removeRecovery() {
    const id=currentUser.current;
    if(!id||!ready||replacing.current||!recoveryCopy)throw Error('Wait for your workspace to finish loading.');
    discardRecoveryCopy(localStorage,id,recoveryCopy.raw);setRecoveryCopy(null);
  }
  async function restoreRecovery() {
    const id=currentUser.current,version=loadVersion.current,before=JSON.stringify(latest.current);
    if(!id||!ready||saving.current||replacing.current)throw Error('Wait for your workspace to finish saving or loading.');
    const copy=readRecoveryCopy(localStorage,id);
    if(!copy?.snapshot||copy.raw!==recoveryCopy?.raw)throw Error('This recovery copy changed or cannot be restored. Save its text and review it first.');
    const {validateWorkspace}=await import('../worker/career-validation.js');
    const restored=validateWorkspace(copy.snapshot.data) as CareerData;
    if(version!==loadVersion.current||currentUser.current!==id||replacing.current||saving.current||JSON.stringify(latest.current)!==before||readRecoveryCopy(localStorage,id)?.raw!==copy.raw)throw Error('Your workspace changed. Try again after it finishes loading.');
    // Keep the recovery copy until explicitly removed. Normal revision checks
    // still prevent a restore from overwriting a newer cloud revision.
    setData(restored);setSelected('');setStatus('Recovered copy restored on this device');
  }
  async function logout() {
    if(replacing.current)throw Error('Wait for your workspace to finish loading.');
    if(currentUser.current&&readRecoveryCopy(localStorage,currentUser.current))throw Error('Save or restore your recovery copy in Account & backup, then remove it before signing out.');
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
    setRecoveryCopy(null);
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
  function reviewAdvert(expected:CareerApplication,advert:AdvertSnapshot,keepText:boolean) {
    if (!ready || replacing.current) return false;
    const result=acceptAdvertReview(latest.current,expected,advert,keepText);
    if(result.status!=='saved') {setError('Your working advert changed. Review the latest comparison before updating it.');return false;}
    setData(result.data);return true;
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
      ...(job.preparation_version && (job.description || '').length <= 26000 ? {sourceVersion:job.preparation_version} : {}),
      company: job.company,
      title: job.title,
      location: job.location,
      description: (job.description || "").slice(0,26000),
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
        recoveryCopy,
        reloadCloud,
        restoreRecovery,
        removeRecovery,
        saveJob,
        updateApplication,
        reviewAdvert,
        beginPreparation,
        finishPreparation,
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
