// Pairwise concept-overlap nebulae between clusters.

import type { NebulaMeta } from 'knowledge-map-3d';

export interface ClusterCenterLite {
  cx: number;
  cy: number;
  cz: number;
}

export interface NebulaOptions {
  minShared?: number;
}

export function buildNebulae(
  projectConcepts: Map<string, Set<string>>,
  clusterCenters: Map<string, ClusterCenterLite>,
  options: NebulaOptions = {},
): NebulaMeta[] {
  const minShared = options.minShared ?? 3;
  const keys = Array.from(projectConcepts.keys())
    .filter((k) => clusterCenters.has(k))
    .sort();

  const out: NebulaMeta[] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      const A = projectConcepts.get(a);
      const B = projectConcepts.get(b);
      if (!A || !B) continue;
      const { shared, jaccard } = overlap(A, B);
      if (shared < minShared) continue;
      const ca = clusterCenters.get(a);
      const cb = clusterCenters.get(b);
      if (!ca || !cb) continue;
      out.push({
        id: `neb-${a}-${b}`,
        clusterA: a,
        clusterB: b,
        cx: (ca.cx + cb.cx) / 2,
        cy: (ca.cy + cb.cy) / 2,
        cz: (ca.cz + cb.cz) / 2,
        strength: jaccard,
        color: conceptHueColor(sharedConcepts(A, B)),
      });
    }
  }
  return out;
}

export function overlap(a: Set<string>, b: Set<string>): { shared: number; jaccard: number } {
  let shared = 0;
  for (const v of a) if (b.has(v)) shared++;
  const union = a.size + b.size - shared;
  return { shared, jaccard: union === 0 ? 0 : shared / union };
}

function sharedConcepts(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const v of a) if (b.has(v)) out.push(v);
  return out.sort();
}

function conceptHueColor(concepts: string[]): string {
  let h = 0;
  for (const c of concepts) {
    for (let i = 0; i < c.length; i++) h = (h + c.charCodeAt(i)) % 360;
  }
  return hslToHex(h, 70, 60);
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
