// A district = one tmux session. Renders the orchestrator "town hall" (with the
// campaigns each dispatched), the team "plots" (count the plots = count the teams),
// and the "commons" for un-teamed / home / offline panes.
import type { FleetAgent } from '../../lib/fleet';
import type { TownDistrict } from '../../lib/town-group';
import { AgentTile } from './AgentTile';

interface Props {
  d: TownDistrict;
  registerRef: (id: string, el: HTMLElement | null) => void;
  dispatchMap: Map<string, FleetAgent[]>;
  setHoveredOrc: (id: string | null) => void;
  ringFor: (id: string) => string | undefined;
}

export function District({ d, registerRef, dispatchMap, setHoveredOrc, ringFor }: Props) {
  return (
    <section className="rounded-xl border border-white/[0.08] p-3" style={{ background: '#0c0c12' }}>
      <header className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-white/85 truncate">🏙 {d.session}</span>
          <span className="text-[10px] text-white/40 shrink-0">{d.plots.length} team{d.plots.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] text-white/45 shrink-0">
          <span title="working">🟢 {d.counts.working}</span>
          <span title="asleep">🟡 {d.counts.idle}</span>
          <span title="offline">⚪ {d.counts.offline}</span>
        </div>
      </header>

      {d.halls.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">🎩 town hall · dispatchers</div>
          <div className="flex flex-wrap gap-2.5">
            {d.halls.map((o) => {
              const sent = dispatchMap.get(o.id) ?? [];
              return (
                <div key={o.id} onMouseEnter={() => setHoveredOrc(o.id)} onMouseLeave={() => setHoveredOrc(null)}>
                  <AgentTile agent={o} registerRef={registerRef} ring={ringFor(o.id)} />
                  {sent.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pl-1">
                      {sent.map((w) => (
                        <span key={w.id} className="text-[9px] font-mono rounded px-1 py-0.5" style={{ background: '#c084fc1f', color: '#c9a6f5' }}>
                          ⇢ {w.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {d.plots.length > 0 && (
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {d.plots.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-dashed p-2"
              style={{ borderColor: 'rgba(255,255,255,0.13)', background: 'rgba(255,255,255,0.015)' }}
              title={p.description || undefined}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] font-semibold text-white/70 truncate">🏠 {p.name}</span>
                <span className="text-[9px] text-white/35 shrink-0">{p.members.length}</span>
                {!p.known && <span className="text-[8px] text-white/25 shrink-0" title="inferred from shared slug, not a maw team">~</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                {p.members.map((m) => (
                  <AgentTile key={m.id} agent={m} registerRef={registerRef} ring={ringFor(m.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {d.commons.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">commons</div>
          <div className="flex flex-wrap gap-1.5">
            {d.commons.map((m) => (
              <AgentTile key={m.id} agent={m} registerRef={registerRef} ring={ringFor(m.id)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
