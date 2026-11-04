export type Campaign = {id: string; source: string; campaign: string; content: string; label: string; medium: string};
export const campaigns: readonly Campaign[];
export function campaignById(id: unknown): Campaign | null;
export function campaignFromSearch(search: unknown): Campaign | null;
export function campaignLink(href: string, origin: string, id: unknown): string;
export function createCampaignContext(search: string, startedAt?: number): {id(now?: number): string | null};
