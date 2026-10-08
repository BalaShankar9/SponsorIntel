import type { Job } from "../src/career-data";
export const JOB_FRESHNESS_MS: number;
export const JOB_ORIGIN: string;
export const jobLabels: Record<string, string>;
export function jobPath(id: string): string | null;
export function jobAvailability(job: Job, now?: number): "current" | "removed" | "stale" | "expired";
export function jobMetadata(job: Job, now?: number): {
  path: string; title: string; description: string; indexable: boolean;
};
export function jobStructuredData(job: Job, now?: number): object;
export function jobTimestamp(value: string): string;
