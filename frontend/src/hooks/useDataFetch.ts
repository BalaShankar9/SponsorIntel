'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const STALE_MS = 60_000; // 60 seconds

interface UseDataFetchOptions {
  enabled?: boolean;
}

interface UseDataFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data fetch hook that queries a Supabase table with optional select/filters.
 * For simple table queries, pass the table name as `url`.
 * The hook returns the raw data from the table.
 */
export function useDataFetch<T>(
  table: string,
  options?: UseDataFetchOptions & { select?: string; filters?: Record<string, unknown>; limit?: number }
): UseDataFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);
  const enabled = options?.enabled ?? true;

  const cacheKey = `${table}:${options?.select || '*'}:${JSON.stringify(options?.filters || {})}:${options?.limit || ''}`;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Check cache
    const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < STALE_MS) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase.from(table).select(options?.select || '*');

      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          query = query.eq(key, value);
        }
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: result, error: queryError } = await query;

      if (queryError) throw new Error(queryError.message);

      cache.set(cacheKey, { data: result as T, timestamp: Date.now() });
      setData(result as T);
      setError(null);
      retryCount.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (retryCount.current < 1) {
        retryCount.current += 1;
        setTimeout(() => {
          fetchData();
        }, 2000);
        return;
      }

      setError(message);
      retryCount.current = 0;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, table, enabled, options?.select, options?.filters, options?.limit]);

  useEffect(() => {
    retryCount.current = 0;
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    cache.delete(cacheKey);
    retryCount.current = 0;
    fetchData();
  }, [cacheKey, fetchData]);

  return { data, loading, error, refetch };
}
