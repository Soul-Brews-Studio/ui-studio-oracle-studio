import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClusterMeta, MapDocument, NebulaMeta } from 'knowledge-map-3d';
import {
  getMap,
  getMap3d,
  getOracles,
  getStats,
} from '../api/oracle';
import type { MapDocument as ApiMapDocument, Stats } from '../api/oracle';
import { buildPlanetsGraph } from '../lib/planets';

export interface UsePlanetsData {
  documents: MapDocument[];
  clusters: ClusterMeta[];
  nebulae: NebulaMeta[];
  stats: Stats | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  model: string | undefined;
  setModel: (m: string | undefined) => void;
}

const EMPTY_ORACLES = {
  projects: [],
  identities: [],
  total_projects: 0,
  total_identities: 0,
};

export function usePlanetsData(initialModel?: string): UsePlanetsData {
  const [documents, setDocuments] = useState<MapDocument[]>([]);
  const [clusters, setClusters] = useState<ClusterMeta[]>([]);
  const [nebulae, setNebulae] = useState<NebulaMeta[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | undefined>(initialModel);
  const [tick, setTick] = useState(0);
  const reqId = useRef(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let apiDocs: ApiMapDocument[];
        try {
          const map = await getMap3d(model);
          apiDocs = map.documents ?? [];
        } catch {
          const map2d = await getMap();
          apiDocs = (map2d.documents ?? []).map((d) => ({ ...d, z: 0 }));
        }

        const [oracles, statsResp] = await Promise.all([
          getOracles().catch(() => EMPTY_ORACLES),
          getStats().catch<Stats | null>(() => null),
        ]);

        if (id !== reqId.current) return;

        const graph = buildPlanetsGraph(
          apiDocs,
          oracles.projects,
          statsResp ?? undefined,
        );
        setDocuments(graph.documents);
        setClusters(graph.clusters);
        setNebulae(graph.nebulae);
        setStats(statsResp);
        setLoading(false);
      } catch (e) {
        if (id !== reqId.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
  }, [model, tick]);

  return {
    documents,
    clusters,
    nebulae,
    stats,
    loading,
    error,
    reload,
    model,
    setModel,
  };
}
