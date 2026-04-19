// Simple pub/sub bus for cache invalidation. Components fire
// `cacheBus.invalidate('menu')` after a write; cached-wrapped readers
// listen and drop any entry whose tag matches.

import type { InvalidationEvent } from './types';

type Listener = (ev: InvalidationEvent) => void;

class CacheBus {
  private listeners = new Set<Listener>();

  /** Fire an invalidation event for `tag`. Also mirrors to other tabs via storage event. */
  invalidate(tag: string): void {
    const ev: InvalidationEvent = { tag, at: Date.now() };
    for (const fn of this.listeners) {
      try { fn(ev); } catch { /* ignore */ }
    }
    // Cross-tab: bump a well-known localStorage key so other tabs' `storage`
    // listeners can pick it up and re-broadcast locally.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('oracle_cache_bus_v1', JSON.stringify(ev));
      }
    } catch { /* ignore */ }
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Rebroadcast a cross-tab storage event locally. */
  private replay(raw: string | null): void {
    if (!raw) return;
    try {
      const ev = JSON.parse(raw) as InvalidationEvent;
      if (!ev || typeof ev.tag !== 'string') return;
      for (const fn of this.listeners) {
        try { fn(ev); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  /** Wire `storage` event listener — call once at app start. */
  attachCrossTab(): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key === 'oracle_cache_bus_v1') this.replay(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

export const cacheBus = new CacheBus();
