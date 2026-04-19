import { useMemo } from 'react';
import { KnowledgeMap } from 'knowledge-map-3d';
import type { MapDocument, ClusterMeta, NebulaMeta } from 'knowledge-map-3d';

function demoData(): { documents: MapDocument[]; clusters: ClusterMeta[]; nebulae: NebulaMeta[] } {
  const clusterPositions = [
    { id: 'c-core', label: 'Oracle Core', cx: 0, cy: 0, cz: 0 },
    { id: 'c-routes', label: 'Routes', cx: 14, cy: 2, cz: -4 },
    { id: 'c-plugins', label: 'Plugins', cx: -12, cy: -3, cz: 6 },
    { id: 'c-tests', label: 'Tests', cx: 3, cy: 12, cz: 3 },
  ];

  const docs: MapDocument[] = [];
  const clusters: ClusterMeta[] = [];

  clusterPositions.forEach((c, ci) => {
    const n = 8 + (ci % 3);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const r = 2 + (i % 3);
      docs.push({
        id: `${c.id}-d${i}`,
        type: ci === 0 ? 'concept' : ci === 1 ? 'route' : ci === 2 ? 'plugin' : 'test',
        sourceFile: `${c.label}/item-${i}.ts`,
        concepts: [c.label.toLowerCase()],
        project: 'arra-oracle-v3',
        x: c.cx + Math.cos(angle) * r,
        y: c.cy + Math.sin(angle) * r * 0.5,
        z: c.cz + Math.sin(angle * 2) * r * 0.3,
        clusterId: c.id,
        orbitRadius: r,
        orbitSpeed: 0.002 + (i % 5) * 0.0005,
        orbitPhase: angle,
        orbitTilt: (i % 7) * 0.1,
        parentId: null,
        moonCount: 0,
        createdAt: Date.now() - i * 86_400_000,
        contentLength: 1000 + i * 200,
      });
    }
    clusters.push({
      id: c.id,
      label: c.label,
      docCount: n,
      cx: c.cx,
      cy: c.cy,
      cz: c.cz,
      radius: 8,
      concepts: [c.label.toLowerCase()],
      starDocId: null,
    });
  });

  const nebulae: NebulaMeta[] = [
    {
      id: 'n-core-routes',
      clusterA: 'c-core',
      clusterB: 'c-routes',
      cx: 7,
      cy: 1,
      cz: -2,
      strength: 0.6,
      color: '#7c3aed',
    },
    {
      id: 'n-core-plugins',
      clusterA: 'c-core',
      clusterB: 'c-plugins',
      cx: -6,
      cy: -1.5,
      cz: 3,
      strength: 0.4,
      color: '#f59e0b',
    },
  ];

  return { documents: docs, clusters, nebulae };
}

export function Planets() {
  const { documents, clusters, nebulae } = useMemo(demoData, []);
  return (
    <div className="w-full h-[calc(100vh-110px)] bg-black">
      <KnowledgeMap
        documents={documents}
        clusters={clusters}
        nebulae={nebulae}
        embedded={false}
      />
    </div>
  );
}
