// IndexedDB adapter for the client cache — used for larger payloads
// (>50KB) that would bloat localStorage. Single object-store keyed by
// string. Gracefully no-ops when IndexedDB is unavailable.

import type { CacheEntry, CacheStore } from './types';

const DB_NAME = 'oracle_cache_v1';
const STORE = 'entries';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbStore: CacheStore = {
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const db = await openDb();
    if (!db) return null;
    try {
      const val = await promisify<unknown>(tx(db, 'readonly').get(key));
      if (!val || typeof val !== 'object') return null;
      const e = val as CacheEntry<T>;
      if (typeof e.ts !== 'number' || typeof e.ttl !== 'number') return null;
      return e;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try { await promisify(tx(db, 'readwrite').put(entry, key)); } catch {
      throw new Error('idbStore:set failed');
    }
  },

  async del(key: string): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try { await promisify(tx(db, 'readwrite').delete(key)); } catch { /* ignore */ }
  },

  async keys(): Promise<string[]> {
    const db = await openDb();
    if (!db) return [];
    try {
      const req = tx(db, 'readonly').getAllKeys();
      const arr = await promisify<IDBValidKey[]>(req);
      return arr.map((k) => String(k));
    } catch {
      return [];
    }
  },

  async clear(): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try { await promisify(tx(db, 'readwrite').clear()); } catch { /* ignore */ }
  },
};

/** Reset the module singleton — test-only; not exported from the barrel. */
export function __resetIdbForTests(): void {
  dbPromise = null;
}
