export function publicRequest<T>(path: string, options?: {signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number}): Promise<T>;
