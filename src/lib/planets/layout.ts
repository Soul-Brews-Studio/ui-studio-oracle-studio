// Fibonacci-sphere placement for N projects (clusters).

import type { OracleProject } from '../../api/oracle';

export interface ClusterPosition {
  cx: number;
  cy: number;
  cz: number;
  radius: number;
}

export interface LayoutOptions {
  radius?: number;
  minClusterRadius?: number;
  maxClusterRadius?: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function placeProjectsOnSphere(
  projects: OracleProject[],
  options: LayoutOptions = {},
): Map<string, ClusterPosition> {
  const out = new Map<string, ClusterPosition>();
  const N = projects.length;
  if (N === 0) return out;

  const totalDocs = projects.reduce((s, p) => s + (p.docs ?? 0), 0);
  const sphereRadius = options.radius ?? Math.max(12, 6 * Math.log2(Math.max(2, totalDocs)));
  const minR = options.minClusterRadius ?? 4;
  const maxR = options.maxClusterRadius ?? 14;

  if (N === 1) {
    const p = projects[0];
    out.set(p.project, { cx: 0, cy: 0, cz: 0, radius: clusterRadiusFor(p.docs ?? 0, minR, maxR) });
    return out;
  }

  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * i) / (N - 1);
    const rRing = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    const cx = Math.cos(theta) * rRing * sphereRadius;
    const cy = y * sphereRadius;
    const cz = Math.sin(theta) * rRing * sphereRadius;
    const p = projects[i];
    out.set(p.project, {
      cx,
      cy,
      cz,
      radius: clusterRadiusFor(p.docs ?? 0, minR, maxR),
    });
  }
  return out;
}

export function clusterRadiusFor(docCount: number, minR = 4, maxR = 14): number {
  const scaled = Math.log2(Math.max(2, docCount + 1)) * 2;
  return Math.min(maxR, Math.max(minR, scaled));
}
