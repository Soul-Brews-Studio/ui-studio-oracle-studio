// Minimal DOM-ish mocks for bun:test — only what the cache module touches.

class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
}

export function installDomMocks(version = 'v0.0.0+test'): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.__APP_VERSION__ = version;
  g.localStorage = new MemoryStorage();
  g.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.indexedDB = undefined; // force localStore path; idb tested separately
  g.Blob = class MockBlob {
    size: number;
    constructor(parts: unknown[]) {
      this.size = parts.reduce<number>((sum, p) => sum + (typeof p === 'string' ? p.length : 0), 0);
    }
  } as unknown as typeof Blob;
}

export function resetDomMocks(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  (g.localStorage as MemoryStorage | undefined)?.clear();
}
