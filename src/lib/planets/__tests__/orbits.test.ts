import { describe, it, expect } from 'bun:test';
import { computeOrbit, hashTilt, speedFromCreatedAt } from '../orbits';
import type { MapDocument as ApiMapDocument } from '../../../api/oracle';

function doc(partial: Partial<ApiMapDocument>): ApiMapDocument {
  return {
    id: 'd1',
    type: 'principle',
    source_file: 'a.md',
    concepts: [],
    project: 'p',
    x: 1,
    y: 0,
    z: 0,
    created_at: null,
    ...partial,
  };
}

const center = { cx: 10, cy: 0, cz: 0, radius: 8 };

describe('computeOrbit', () => {
  it('produces phase from atan2(y, x)', () => {
    const r = computeOrbit(doc({ x: 0, y: 1, z: 0 }), center, 0);
    expect(r.orbitPhase).toBeCloseTo(Math.PI / 2, 5);
  });

  it('is symmetric: opposite points yield opposite phase sign', () => {
    const a = computeOrbit(doc({ id: 'A', x: 1, y: 1, z: 0 }), center, 0);
    const b = computeOrbit(doc({ id: 'B', x: -1, y: -1, z: 0 }), center, 0);
    expect(Math.sign(a.orbitPhase)).toBe(-Math.sign(b.orbitPhase));
  });

  it('deterministic tilt per id', () => {
    const a = computeOrbit(doc({ id: 'same' }), center, 0);
    const b = computeOrbit(doc({ id: 'same' }), center, 99);
    expect(a.orbitTilt).toBe(b.orbitTilt);
  });

  it('tilt stays within [0, 0.3]', () => {
    for (const k of ['a', 'foo', 'longer-key', '', 'αβγ']) {
      const t = hashTilt(k);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(0.3);
    }
  });

  it('places the doc around its cluster center', () => {
    const r = computeOrbit(doc({ x: 1, y: 0, z: 0 }), center, 0);
    const dist = Math.hypot(r.x - center.cx, r.y - center.cy, r.z - center.cz);
    expect(dist).toBeCloseTo(r.orbitRadius, 5);
  });
});

describe('speedFromCreatedAt', () => {
  const NOW = Date.parse('2026-04-19T00:00:00Z');

  it('returns fast speed for docs <7d', () => {
    expect(speedFromCreatedAt('2026-04-17T00:00:00Z', NOW)).toBe(0.003);
  });

  it('returns medium speed for 7-30d docs', () => {
    expect(speedFromCreatedAt('2026-04-01T00:00:00Z', NOW)).toBe(0.002);
  });

  it('returns slow speed for >30d docs', () => {
    expect(speedFromCreatedAt('2026-01-01T00:00:00Z', NOW)).toBe(0.001);
  });

  it('defaults to slow for missing/bad timestamps', () => {
    expect(speedFromCreatedAt(null, NOW)).toBe(0.001);
    expect(speedFromCreatedAt('not-a-date', NOW)).toBe(0.001);
  });
});
