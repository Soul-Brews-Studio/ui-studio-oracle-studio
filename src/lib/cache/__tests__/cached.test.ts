import { describe, it, expect, beforeEach } from 'bun:test';
import { installDomMocks, resetDomMocks } from './setup';

installDomMocks('v1.0.0+test');

const { cached, __resetCachedForTests } = await import('../cached');
const { cacheBus } = await import('../bus');
const { localStore } = await import('../local-store');

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

describe('cached()', () => {
  beforeEach(async () => {
    resetDomMocks();
    __resetCachedForTests();
    await localStore.clear();
  });

  it('fetches on first call and caches', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return { n: calls }; };
    const a = await cached('k', 10_000, fetcher);
    const b = await cached('k', 10_000, fetcher);
    expect(a.n).toBe(1);
    expect(b.n).toBe(1); // served from cache
    expect(calls).toBe(1);
  });

  it('re-fetches after TTL expires (stale-while-revalidate)', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return calls; };
    const v1 = await cached('swr', 5, fetcher);
    expect(v1).toBe(1);
    await sleep(10);
    // Stale: returns cached value immediately but triggers background refetch.
    const v2 = await cached('swr', 5, fetcher);
    expect(v2).toBe(1);
    // Wait for background refetch to finish.
    await sleep(20);
    const v3 = await cached('swr', 10_000, fetcher);
    expect(v3).toBe(2);
    expect(calls).toBe(2);
  });

  it('version mismatch invalidates entry', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return calls; };
    await cached('vk', 10_000, fetcher);
    expect(calls).toBe(1);

    // Simulate a new build version.
    (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = 'v2.0.0+test';
    const v = await cached('vk', 10_000, fetcher);
    expect(v).toBe(2);
    expect(calls).toBe(2);

    (globalThis as unknown as { __APP_VERSION__: string }).__APP_VERSION__ = 'v1.0.0+test';
  });

  it('cacheBus.invalidate(tag) drops tagged entries', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return calls; };
    await cached('menu-a', 10_000, fetcher, { tag: 'menu' });
    await cached('menu-b', 10_000, fetcher, { tag: 'menu' });
    expect(calls).toBe(2);

    cacheBus.invalidate('menu');
    // Allow async listeners to run.
    await sleep(5);

    const v = await cached('menu-a', 10_000, fetcher, { tag: 'menu' });
    expect(v).toBe(3);
  });

  it('ttl <= 0 bypasses the cache', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; return calls; };
    await cached('nocache', 0, fetcher);
    await cached('nocache', 0, fetcher);
    expect(calls).toBe(2);
  });

  it('de-dupes concurrent initial fetches', async () => {
    let calls = 0;
    const fetcher = async () => { calls++; await sleep(20); return 'x'; };
    const [a, b, c] = await Promise.all([
      cached('dedup', 10_000, fetcher),
      cached('dedup', 10_000, fetcher),
      cached('dedup', 10_000, fetcher),
    ]);
    expect(a).toBe('x');
    expect(b).toBe('x');
    expect(c).toBe('x');
    expect(calls).toBe(1);
  });
});
