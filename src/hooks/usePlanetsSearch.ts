import { useCallback, useEffect, useMemo, useState } from 'react';
import { search } from '../api/oracle';
import type { Document } from '../api/oracle';

export interface UsePlanetsSearch {
  query: string;
  setQuery: (q: string) => void;
  matchIds: Set<string>;
  matching: Document[];
  error: string | null;
  clear: () => void;
}

export function usePlanetsSearch(debounceMs: number = 300): UsePlanetsSearch {
  const [query, setQueryState] = useState('');
  const [matching, setMatching] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatching([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await search(q, 'all', 50, 'hybrid');
        if (cancelled) return;
        setMatching(res.results ?? []);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setMatching([]);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, debounceMs]);

  const matchIds = useMemo(
    () => new Set(matching.map((d) => d.id)),
    [matching],
  );

  const setQuery = useCallback((q: string) => setQueryState(q), []);
  const clear = useCallback(() => setQueryState(''), []);

  return { query, setQuery, matchIds, matching, error, clear };
}
