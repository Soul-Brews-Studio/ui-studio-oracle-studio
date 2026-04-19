// Orchestrator: Oracle API shape → knowledge-map-3d graph.

import type {
  MapDocument as KMDocument,
  ClusterMeta,
  NebulaMeta,
} from 'knowledge-map-3d';
import type {
  MapDocument as ApiMapDocument,
  OracleProject,
  Stats,
} from '../../api/oracle';
import { placeProjectsOnSphere, type ClusterPosition } from './layout';
import { computeOrbit } from './orbits';
import { buildNebulae } from './nebulae';

export interface PlanetsGraph {
  documents: KMDocument[];
  clusters: ClusterMeta[];
  nebulae: NebulaMeta[];
}

const UNKNOWN_CLUSTER = '__unknown__';

export function buildPlanetsGraph(
  apiDocs: ApiMapDocument[],
  projects: OracleProject[],
  _stats?: Stats,
  now: number = Date.now(),
): PlanetsGraph {
  const centers = placeProjectsOnSphere(projects);
  const docsByProject = groupDocsByProject(apiDocs);

  if (docsByProject.has(UNKNOWN_CLUSTER) && !centers.has(UNKNOWN_CLUSTER)) {
    centers.set(UNKNOWN_CLUSTER, { cx: 0, cy: 0, cz: 0, radius: 6 });
  }

  const documents: KMDocument[] = [];
  const clusters: ClusterMeta[] = [];
  const projectConcepts = new Map<string, Set<string>>();

  for (const [projectId, center] of centers.entries()) {
    const docs = docsByProject.get(projectId) ?? [];
    const concepts = new Set<string>();

    docs.forEach((d, i) => {
      const orbit = computeOrbit(d, center, i, now);
      const createdAtMs = parseUnixMs(d.created_at);
      for (const c of d.concepts ?? []) concepts.add(c);
      documents.push({
        id: d.id,
        type: d.type,
        sourceFile: d.source_file,
        concepts: d.concepts ?? [],
        chunkIds: d.chunk_ids,
        project: d.project ?? null,
        x: orbit.x,
        y: orbit.y,
        z: orbit.z,
        clusterId: projectId,
        orbitRadius: orbit.orbitRadius,
        orbitSpeed: orbit.orbitSpeed,
        orbitPhase: orbit.orbitPhase,
        orbitTilt: orbit.orbitTilt,
        parentId: null,
        moonCount: 0,
        createdAt: createdAtMs,
        contentLength: estimateContentLength(d),
      });
    });

    projectConcepts.set(projectId, concepts);

    clusters.push({
      id: projectId,
      label: clusterLabel(projectId),
      docCount: docs.length,
      cx: center.cx,
      cy: center.cy,
      cz: center.cz,
      radius: center.radius,
      concepts: Array.from(concepts).slice(0, 8),
      starDocId: docs[0]?.id ?? null,
    });
  }

  const centerLite = new Map<string, { cx: number; cy: number; cz: number }>();
  for (const [k, v] of centers.entries()) {
    centerLite.set(k, { cx: v.cx, cy: v.cy, cz: v.cz });
  }
  const nebulae = buildNebulae(projectConcepts, centerLite);

  return { documents, clusters, nebulae };
}

function groupDocsByProject(apiDocs: ApiMapDocument[]): Map<string, ApiMapDocument[]> {
  const out = new Map<string, ApiMapDocument[]>();
  for (const d of apiDocs) {
    const key = d.project ?? UNKNOWN_CLUSTER;
    const arr = out.get(key) ?? [];
    arr.push(d);
    out.set(key, arr);
  }
  return out;
}

function parseUnixMs(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function estimateContentLength(d: ApiMapDocument): number {
  const conceptsLen = (d.concepts ?? []).join(' ').length;
  const pathLen = (d.source_file ?? '').length;
  return 500 + conceptsLen * 20 + pathLen * 4;
}

function clusterLabel(project: string): string {
  if (project === UNKNOWN_CLUSTER) return 'Unsorted';
  const parts = project.split('/');
  return parts[parts.length - 1] || project;
}

export type { ClusterPosition };
