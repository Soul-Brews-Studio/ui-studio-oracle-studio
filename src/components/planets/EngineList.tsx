import type { Stats } from '../../api/oracle';

type Engine = NonNullable<Stats['vectors']>[number];

interface Props {
  engines: Engine[];
  model: string | undefined;
  onSetModel: (m: string | undefined) => void;
}

export function EngineList({ engines, model, onSetModel }: Props) {
  if (engines.length === 0) return null;
  const activeKey = model ?? 'bge-m3';

  return (
    <>
      <div className="h-px bg-border my-1" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wide text-text-muted">
          Embedding Engines
        </span>
        <span className="text-[9px] font-mono text-text-muted">LanceDB</span>
      </div>
      {engines.map((v) => {
        const active = activeKey === v.key;
        return (
          <button
            key={v.key}
            onClick={() => v.enabled && onSetModel(v.key)}
            disabled={!v.enabled}
            className={`flex flex-col gap-0.5 p-2 rounded-lg border text-left transition-all duration-150 ${
              active
                ? 'border-accent/40 bg-accent/5'
                : v.enabled
                ? 'border-border bg-white/[0.02] hover:border-border-hover cursor-pointer'
                : 'border-border-subtle opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary">
                {v.key}
              </span>
              <span
                className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded ${
                  active
                    ? 'bg-accent/20 text-accent'
                    : v.enabled
                    ? 'bg-success/20 text-success'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {active ? 'Active' : v.enabled ? 'Switch' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-mono">{v.model}</span>
              <span className="text-[9px] text-text-muted tabular-nums">
                {v.count.toLocaleString()}
              </span>
            </div>
          </button>
        );
      })}
    </>
  );
}
