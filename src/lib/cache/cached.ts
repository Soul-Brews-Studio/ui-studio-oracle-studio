// cached() — stale-while-revalidate wrapper around a fetcher.
//   fresh (age < ttl)  → return cached, no refetch.
//   stale (age ≥ ttl)  → return cached AND kick off a background refetch.
//   missing / version mismatch → await fetcher, write, return.
//   cacheBus.invalidate(tag) drops every entry with that tag.
// Storage: auto (local if ≤50KB, else idb). Override via policy.store.

import type { CacheEntry, CachePolicy } from './types';
import { localStore, estimateBytes } from './local-store';
import { idbStore } from './idb-store';
import { cacheBus } from './bus';

const SIZE_THRESHOLD_BYTES = 50 * 1024;

function appVersion(): string {
  try { return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'; }
  catch { return 'dev'; }
}

// tag → keys index (for O(1) tag invalidation); inflight map (de-dupes concurrent fetchers).
const tagIndex = new Map<string, Set<string>>();
const inflight = new Map<string, Promise<unknown>>();

cacheBus.on(async (ev) => {
  const keys = tagIndex.get(ev.tag);
  if (!keys || keys.size === 0) return;
  const snapshot = Array.from(keys);
  keys.clear();
  for (const k of snapshot) {
    try { await localStore.del(k); } catch { /* ignore */ }
    try { await idbStore.del(k); } catch { /* ignore */ }
    inflight.delete(k);
  }
});

async function readEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  return (await localStore.get<T>(key)) ?? (await idbStore.get<T>(key));
}

async function writeEntry<T>(key: string, entry: CacheEntry<T>, policy: CachePolicy): Promise<void> {
  if (policy.store === 'idb') { await idbStore.set(key, entry); return; }
  if (policy.store === 'local') { await localStore.set(key, entry); return; }
  if (estimateBytes(entry.data) > SIZE_THRESHOLD_BYTES) { await idbStore.set(key, entry); return; }
  try { await localStore.set(key, entry); }
  catch { await idbStore.set(key, entry); }
}

async function fetchAndStore<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, policy: CachePolicy): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = (async () => {
    const data = await fetcher();
    const entry: CacheEntry<T> = { v: appVersion(), ts: Date.now(), ttl: ttlMs, tag: policy.tag, data };
    try { await writeEntry(key, entry, policy); } catch { /* ignore */ }
    return data;
  })();
  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

function refreshInBackground<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, policy: CachePolicy): void {
  if (inflight.has(key)) return;
  const p = fetchAndStore(key, ttlMs, fetcher, policy).catch(() => { /* swallow */ });
  inflight.set(key, p);
  void p.finally(() => { inflight.delete(key); });
}

/** Wrap `fetcher` with stale-while-revalidate caching keyed by `key`. */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  policy: CachePolicy = {},
): Promise<T> {
  if (policy.tag) {
    let set = tagIndex.get(policy.tag);
    if (!set) { set = new Set(); tagIndex.set(policy.tag, set); }
    set.add(key);
  }
  if (ttlMs <= 0) return fetcher();

  const entry = await readEntry<T>(key);
  const v = appVersion();
  if (entry && entry.v === v) {
    if (Date.now() - entry.ts < ttlMs) return entry.data;
    refreshInBackground(key, ttlMs, fetcher, policy);
    return entry.data;
  }
  return fetchAndStore(key, ttlMs, fetcher, policy);
}

/** Test-only reset. */
export function __resetCachedForTests(): void {
  tagIndex.clear();
  inflight.clear();
}
