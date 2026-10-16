import type { Job } from '../src/career-data';
export type JobSearch = {
  q: string; location: string; sponsorship: string; level: string;
  salary: string; sector: string; licence: string; page: number;
};
export type JobsResult = {
  items: Job[]; total: number; catalog_total: number; next_deadline: string | null;
  generated_at: string; valid_until: string; pages: number; page: number;
  sources: { id: string; company: string; careers_url: string; count: number; error: string | null; last_success: string | null }[];
  collections: { total: number; employers: number; early_career: number; sponsorship: number; licensed: number; salary: number };
  sectors: Record<string, string>;
  licence_register: { available: boolean; source_date: string | null; checked_at: string | null };
};
export function readJobSearch(search: string | URLSearchParams): JobSearch;
export function jobSearchPath(filters: Partial<JobSearch>, page?: number): string;
export function readInitialJobs(raw: string, search: string, now?: number): {path: string; result: JobsResult} | null;
