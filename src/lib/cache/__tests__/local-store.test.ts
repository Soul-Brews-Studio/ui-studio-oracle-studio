import { describe, it, expect, beforeEach } from 'bun:test';
import { installDomMocks, resetDomMocks } from './setup';

installDomMocks();

// Import after mocks are installed.
const { localStore, estimateBytes } = await import('../local-store');

describe('localStore', () => {
  beforeEach(() => { resetDomMocks(); });

  it('round-trips an entry', async () => {
    await localStore.set('k1', { v: 'v0', ts: 1, ttl: 1000, data: { hello: 'world' } });
    const got = await localStore.get<{ hello: string }>('k1');
    expect(got?.data.hello).toBe('world');
    expect(got?.ttl).toBe(1000);
  });

  it('returns null for missing keys', async () => {
    expect(await localStore.get('missing')).toBeNull();
  });

  it('deletes entries', async () => {
    await localStore.set('k2', { v: 'v0', ts: 1, ttl: 1, data: 1 });
    await localStore.del('k2');
    expect(await localStore.get('k2')).toBeNull();
  });

  it('keys() returns only cache-prefixed keys', async () => {
    await localStore.set('a', { v: 'v0', ts: 1, ttl: 1, data: 1 });
    await localStore.set('b', { v: 'v0', ts: 1, ttl: 1, data: 2 });
    const keys = await localStore.keys();
    expect(keys.sort()).toEqual(['a', 'b']);
  });

  it('clear() removes all cache entries', async () => {
    await localStore.set('a', { v: 'v0', ts: 1, ttl: 1, data: 1 });
    await localStore.clear();
    expect((await localStore.keys()).length).toBe(0);
  });

  it('estimateBytes grows with payload', () => {
    expect(estimateBytes('x')).toBeGreaterThan(0);
    expect(estimateBytes('xxxxxxxxxx')).toBeGreaterThan(estimateBytes('x'));
  });
});
