import { useEffect, useState } from 'react';
import { publicRequest } from '../shared/public-request.js';

// Independent state keeps an optional section failure from discarding other data.
export function usePublicResource<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    publicRequest<T>(path, { signal: controller.signal })
      .then(value => { if (active) setData(value); })
      .catch(error => { if (active) setError(error instanceof Error ? error.message : 'Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [path, enabled, attempt]);
  return { data, loading, error, retry: () => setAttempt(value => value + 1) };
}
