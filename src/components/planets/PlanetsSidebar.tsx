import type { ClusterMeta } from 'knowledge-map-3d';
import type { Stats } from '../../api/oracle';
import { TYPE_COLORS } from '../../lib/type-colors';
import { EngineList } from './EngineList';

interface Props {
  stats: Stats | null;
  clusters: ClusterMeta[];
  totalDocs: number;
  typeCounts: Record<string, number>;
  matchCount: number;
  selectedProject: string | null;
  onSelectProject: (project: string | null) => void;
  model: string | undefined;
  onSetModel: (m: string | undefined) => void;
}

export function PlanetsSidebar({
  stats,
  clusters,
  totalDocs,
  typeCounts,
  matchCount,
  selectedProject,
  onSelectProject,
  model,
  onSetModel,
}: Props) {
  const sorted = [...clusters].sort((a, b) => b.docCount - a.docCount);

  return (
    <div className="w-[260px] bg-bg-card border-l border-border p-6 flex flex-col overflow-hidden">
      <h2 className="text-xl font-bold text-text-primary mb-1">Planets</h2>
      <span className="text-[11px] font-mono text-text-muted mb-4 block">
        {clusters.length} cluster{clusters.length === 1 ? '' : 's'} active
      </span>

      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
        {stats?.total != null && (
          <Stat value={stats.total} label="Total Indexed" />
        )}
        <Stat value={totalDocs} label="Documents Mapped" />

        {Object.entries(typeCounts).map(([type, count]) => (
          <Stat
            key={type}
            value={count}
            label={`${type}s`}
            color={TYPE_COLORS[type]}
          />
        ))}

        <EngineList
          engines={stats?.vectors ?? []}
          model={model}
          onSetModel={onSetModel}
        />

        {sorted.length > 0 && (
          <ProjectList
            clusters={sorted}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
          />
        )}

        {matchCount > 0 && (
          <>
            <div className="h-px bg-border my-1" />
            <Stat value={matchCount} label="Search Matches" color="#4ade80" />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-xl font-bold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-text-muted capitalize">{label}</span>
    </div>
  );
}

function ProjectList({
  clusters,
  selectedProject,
  onSelectProject,
}: {
  clusters: ClusterMeta[];
  selectedProject: string | null;
  onSelectProject: (p: string | null) => void;
}) {
  return (
    <>
      <div className="h-px bg-border my-1" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wide text-text-muted">
          Projects
        </span>
        {selectedProject && (
          <button
            onClick={() => onSelectProject(null)}
            className="text-[9px] font-mono text-accent cursor-pointer hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {clusters.map((c) => {
          const isSel = selectedProject === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelectProject(isSel ? null : c.id)}
              className={`flex items-center justify-between py-1 px-1.5 gap-2 rounded-md cursor-pointer text-left transition-all duration-150 border-none ${
                isSel ? 'bg-accent/15' : 'bg-transparent hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`text-xs truncate ${isSel ? 'text-accent font-semibold' : 'text-text-primary'}`}
                title={c.id}
              >
                {c.label}
              </span>
              <span
                className={`text-[9px] tabular-nums ${isSel ? 'text-accent' : 'text-text-muted'}`}
              >
                {c.docCount}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
