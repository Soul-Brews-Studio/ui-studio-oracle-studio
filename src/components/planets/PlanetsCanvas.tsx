import { KnowledgeMap } from 'knowledge-map-3d';
import type { MapDocument, ClusterMeta, NebulaMeta } from 'knowledge-map-3d';
import { TYPE_COLORS } from '../../lib/type-colors';

interface Props {
  documents: MapDocument[];
  clusters: ClusterMeta[];
  nebulae: NebulaMeta[];
  highlightIds: Set<string>;
  onDocumentClick: (doc: MapDocument) => void;
  onClusterClick?: (cluster: ClusterMeta) => void;
}

export function PlanetsCanvas({
  documents,
  clusters,
  nebulae,
  highlightIds,
  onDocumentClick,
  onClusterClick,
}: Props) {
  return (
    <KnowledgeMap
      documents={documents}
      clusters={clusters}
      nebulae={nebulae}
      highlightIds={highlightIds}
      onDocumentClick={onDocumentClick}
      onClusterClick={onClusterClick}
      typeColors={TYPE_COLORS}
      embedded
      heightMode="auto"
      className="w-full h-full"
    />
  );
}
