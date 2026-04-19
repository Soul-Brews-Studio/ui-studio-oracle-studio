import { describe, it, expect } from 'bun:test';
import { installDomMocks } from './setup';

installDomMocks();

const { cacheBus } = await import('../bus');

describe('cacheBus', () => {
  it('delivers invalidation events to listeners', () => {
    const events: string[] = [];
    const off = cacheBus.on((ev) => { events.push(ev.tag); });
    cacheBus.invalidate('menu');
    cacheBus.invalidate('stats');
    off();
    cacheBus.invalidate('menu'); // post-off: should not deliver
    expect(events).toEqual(['menu', 'stats']);
  });

  it('mirrors events to localStorage for cross-tab', () => {
    cacheBus.invalidate('oracles');
    const raw = (globalThis as unknown as { localStorage: Storage }).localStorage.getItem('oracle_cache_bus_v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.tag).toBe('oracles');
    expect(typeof parsed.at).toBe('number');
  });

  it('attachCrossTab returns an unsubscribe function', () => {
    const off = cacheBus.attachCrossTab();
    expect(typeof off).toBe('function');
    off();
  });
});
