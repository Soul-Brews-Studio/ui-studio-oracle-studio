// Client-side API cache — shared types.

export interface CacheEntry<T = unknown> {
  /** App build version (from __APP_VERSION__) at write time. */
  v: string;
  /** ISO epoch ms when this entry was written. */
  ts: number;
  /** TTL in ms — entry is fresh while `now - ts < ttl`. */
  ttl: number;
  /** Invalidation tag (optional). */
  tag?: string;
  /** The cached value. */
  data: T;
}

export interface CachePolicy {
  /** Invalidation tag for bulk clear via cacheBus. */
  tag?: string;
  /** Force a specific backing store. Default: auto — local first, idb if payload > 50KB. */
  store?: 'local' | 'idb';
}

export interface InvalidationEvent {
  tag: string;
  at: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}
