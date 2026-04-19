// Per-doc orbit parameters relative to its cluster center.

import type { MapDocument as ApiMapDocument } from '../../api/oracle';

export interface OrbitResult {
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  orbitTilt: number;
  x: number;
  y: number;
  z: number;
}

export interface ClusterCenter {
  cx: number;
  cy: number;
  cz: number;
  radius?: number;
}

export function computeOrbit(
  doc: ApiMapDocument,
  center: ClusterCenter,
  docIndex: number,
  now: number = Date.now(),
): OrbitResult {
  const dx = doc.x ?? 0;
  const dy = doc.y ?? 0;
  const dz = doc.z ?? 0;

  const rawR = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const clusterR = center.radius ?? 8;
  const orbitRadius = clusterR * 0.3 + (rawR % clusterR);

  const orbitPhase = Math.atan2(dy, dx);
  const orbitTilt = hashTilt(doc.id ?? String(docIndex));
  const orbitSpeed = speedFromCreatedAt(doc.created_at, now);

  const x = center.cx + Math.cos(orbitPhase) * orbitRadius;
  const y = center.cy + Math.sin(orbitPhase) * orbitRadius * Math.cos(orbitTilt);
  const z = center.cz + Math.sin(orbitPhase) * orbitRadius * Math.sin(orbitTilt);

  return { orbitRadius, orbitSpeed, orbitPhase, orbitTilt, x, y, z };
}

export function speedFromCreatedAt(
  createdAt: string | null | undefined,
  now: number = Date.now(),
): number {
  if (!createdAt) return 0.001;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 0.001;
  const ageDays = (now - t) / 86_400_000;
  if (ageDays < 7) return 0.003;
  if (ageDays < 30) return 0.002;
  return 0.001;
}

/** Deterministic hash → tilt in [0, 0.3] rad. FNV-1a. */
export function hashTilt(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const normalized = (h >>> 0) / 0xffffffff;
  return normalized * 0.3;
}
