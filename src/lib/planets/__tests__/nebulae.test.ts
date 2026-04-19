import { describe, it, expect } from 'bun:test';
import { buildNebulae, overlap } from '../nebulae';

const center = (n: number) => ({ cx: n, cy: 0, cz: 0 });

describe('overlap', () => {
  it('computes Jaccard correctly', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y', 'z', 'w']);
    const { shared, jaccard } = overlap(a, b);
    expect(shared).toBe(2);
    expect(jaccard).toBeCloseTo(2 / 4, 5);
  });

  it('returns zero for disjoint sets', () => {
    const { shared, jaccard } = overlap(new Set(['a']), new Set(['b']));
    expect(shared).toBe(0);
    expect(jaccard).toBe(0);
  });

  it('handles empty sets without dividing by zero', () => {
    const { jaccard } = overlap(new Set(), new Set());
    expect(jaccard).toBe(0);
  });
});

describe('buildNebulae', () => {
  it('emits nothing below the shared threshold', () => {
    const concepts = new Map([
      ['a', new Set(['x', 'y'])],
      ['b', new Set(['y', 'z'])],
    ]);
    const centers = new Map([['a', center(0)], ['b', center(10)]]);
    expect(buildNebulae(concepts, centers).length).toBe(0);
  });

  it('emits a nebula when ≥3 concepts are shared', () => {
    const shared = new Set(['p', 'q', 'r', 's']);
    const concepts = new Map([
      ['a', new Set([...shared, 'unique-a'])],
      ['b', new Set([...shared, 'unique-b'])],
    ]);
    const centers = new Map([['a', center(0)], ['b', center(10)]]);
    const neb = buildNebulae(concepts, centers);
    expect(neb.length).toBe(1);
    expect(neb[0].cx).toBe(5);
    expect(neb[0].strength).toBeGreaterThan(0);
    expect(neb[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is symmetric: A-B same as B-A regardless of input order', () => {
    const A = new Set(['p', 'q', 'r']);
    const B = new Set(['p', 'q', 'r', 's']);
    const forward = buildNebulae(
      new Map([['a', A], ['b', B]]),
      new Map([['a', center(0)], ['b', center(10)]]),
    );
    const backward = buildNebulae(
      new Map([['b', B], ['a', A]]),
      new Map([['b', center(10)], ['a', center(0)]]),
    );
    expect(forward[0].strength).toBeCloseTo(backward[0].strength, 5);
    expect(forward[0].cx).toBe(backward[0].cx);
  });

  it('skips pairs missing a cluster center', () => {
    const concepts = new Map([
      ['a', new Set(['p', 'q', 'r'])],
      ['b', new Set(['p', 'q', 'r'])],
    ]);
    const centers = new Map([['a', center(0)]]);
    expect(buildNebulae(concepts, centers).length).toBe(0);
  });

  it('honors a custom minShared option', () => {
    const concepts = new Map([
      ['a', new Set(['p', 'q'])],
      ['b', new Set(['p', 'q'])],
    ]);
    const centers = new Map([['a', center(0)], ['b', center(10)]]);
    expect(buildNebulae(concepts, centers, { minShared: 2 }).length).toBe(1);
  });
});
