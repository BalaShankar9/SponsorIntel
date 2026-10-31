export type PreparationState = 'manual' | 'current' | 'changed' | 'review_required' | 'held' | 'awaiting_refresh' | 'expired' | 'removed' | 'stale' | 'missing' | 'unavailable';
export const preparationMessages: Record<Exclude<PreparationState, 'current' | 'manual'>, string>;
export function preparationAllowed(state: string): state is 'current' | 'manual';
export function manualApplicationId(jobId?: string): boolean;
