import { describe, it, expect } from 'bun:test';
import { placeProjectsOnSphere, clusterRadiusFor } from '../layout';
import type { OracleProject } from '../../../api/oracle';

function proj(name: string, docs: number): OracleProject {
  return { project: name, docs, types: 1, last_indexed: 0 };
}

describe('placeProjectsOnSphere', () => {
  it('returns empty map for no projects', () => {
    expect(placeProjectsOnSphere([]).size).toBe(0);
  });

  it('places a single project at origin', () => {
    const m = placeProjectsOnSphere([proj('solo', 5)]);
    const pos = m.get('solo');
    expect(pos).toBeDefined();
    expect(pos?.cx).toBe(0);
    expect(pos?.cy).toBe(0);
    expect(pos?.cz).toBe(0);
  });

  it('spreads 2 projects on opposite poles', () => {
    const m = placeProjectsOnSphere([proj('a', 5), proj('b', 5)]);
    const a = m.get('a')!;
    const b = m.get('b')!;
    expect(a.cy).toBeGreaterThan(0);
    expect(b.cy).toBeLessThan(0);
  });

  it('gives every project a unique position for N=10', () => {
    const projects = Array.from({ length: 10 }, (_, i) => proj(`p${i}`, 10));
    const m = placeProjectsOnSphere(projects);
    expect(m.size).toBe(10);
    const positions = Array.from(m.values());
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].cx - positions[j].cx;
        const dy = positions[i].cy - positions[j].cy;
        const dz = positions[i].cz - positions[j].cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        expect(d).toBeGreaterThan(1);
      }
    }
  });

  it('cluster radius scales with docCount within bounds', () => {
    expect(clusterRadiusFor(0)).toBeGreaterThanOrEqual(4);
    expect(clusterRadiusFor(10_000)).toBeLessThanOrEqual(14);
    expect(clusterRadiusFor(100)).toBeGreaterThan(clusterRadiusFor(5));
  });

  it('honors a custom radius option', () => {
    const m = placeProjectsOnSphere(
      [proj('a', 1), proj('b', 1)],
      { radius: 50 },
    );
    const a = m.get('a')!;
    const mag = Math.sqrt(a.cx * a.cx + a.cy * a.cy + a.cz * a.cz);
    expect(mag).toBeGreaterThan(40);
  });
});
