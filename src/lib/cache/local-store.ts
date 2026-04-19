// localStorage adapter for the client cache.
//
// Keys are namespaced under `oracle_cache/v1:` so the store is easy to spot
// in devtools and can be wiped atomically via `clear()`.

import type { CacheEntry, CacheStore } from './types';

const PREFIX = 'oracle_cache/v1:';

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export const localStore: CacheStore = {
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const ls = storage();
    if (!ls) return null;
    try {
      const raw = ls.getItem(PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed || typeof parsed.ts !== 'number' || typeof parsed.ttl !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const ls = storage();
    if (!ls) return;
    try {
      ls.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // Quota exceeded or other failure — swallow; caller may fall back to idb.
      throw new Error('localStore:set failed');
    }
  },

  async del(key: string): Promise<void> {
    const ls = storage();
    if (!ls) return;
    try { ls.removeItem(PREFIX + key); } catch { /* ignore */ }
  },

  async keys(): Promise<string[]> {
    const ls = storage();
    if (!ls) return [];
    const out: string[] = [];
    try {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
      }
    } catch { /* ignore */ }
    return out;
  },

  async clear(): Promise<void> {
    const ls = storage();
    if (!ls) return;
    try {
      const doomed: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(PREFIX)) doomed.push(k);
      }
      for (const k of doomed) ls.removeItem(k);
    } catch { /* ignore */ }
  },
};

/** Estimate the byte size of a value once JSON-encoded. */
export function estimateBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    try { return JSON.stringify(value).length * 2; } catch { return 0; }
  }
}

export const LOCAL_STORE_PREFIX = PREFIX;
