// Fleet Town — an ai-town-style live mirror of the tmux agent fleet.
// Roles → costumes, working/asleep/offline → animation, teams → plots, and
// orchestrators → a town hall with dispatch roads. Reflects reality; never drives it.
import { useMemo, useRef, useState } from 'react';
import { useFleet } from '../lib/fleet';
import type { FleetAgent } from '../lib/fleet';
import { groupTown } from '../lib/town-group';
import { costumeFor, KNOWN_ROLES } from '../lib/role-costume';
import { District } from '../components/town/District';
import { RoadLayer } from '../components/town/RoadLayer';
import './Town.css';

function Chip({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/70">
      <span className="rounded-full" style={{ width: 8, height: 8, background: dot }} />
      <span className="font-semibold text-white/90">{value}</span> {label}
    </span>
  );
}

function ago(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  return s < 2 ? 'just now' : `${s}s ago`;
}

export function Town() {
  const { state, loading, error, lastOk } = useFleet(2000);
  const districts = useMemo(() => groupTown(state), [state]);
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const [hoveredOrc, setHoveredOrc] = useState<string | null>(null);

  const dispatchMap = useMemo(() => {
    const byId = new Map(state.agents.map((a) => [a.id, a]));
    const m = new Map<string, FleetAgent[]>();
    for (const r of state.roads) {
      const w = byId.get(r.to);
      if (!w) continue;
      const arr = m.get(r.from) ?? [];
      arr.push(w);
      m.set(r.from, arr);
    }
    return m;
  }, [state]);

  const registerRef = (id: string, el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };
  const ringFor = (id: string): string | undefined => {
    if (!hoveredOrc) return undefined;
    if (id === hoveredOrc) return '#c084fc';
    return dispatchMap.get(hoveredOrc)?.some((w) => w.id === id) ? '#c084fc' : undefined;
  };

  const rolesPresent = useMemo(() => {
    const set = new Set(state.agents.map((a) => a.role));
    return KNOWN_ROLES.filter((r) => set.has(r));
  }, [state]);

  const c = state.counts;
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-5">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white/90">🏘 Fleet Town</h1>
            <p className="text-[12px] text-white/45">
              live mirror of the tmux agent fleet · {state.host || '…'} · updated {ago(lastOk)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip dot="#4ade80" label="working" value={c.working} />
            <Chip dot="#fbbf24" label="asleep" value={c.idle} />
            <Chip dot="#555" label="offline" value={c.offline} />
            <Chip dot="#c084fc" label="teams" value={c.teams} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/55">
          {rolesPresent.map((r) => {
            const cos = costumeFor(r);
            return (
              <span key={r} className="inline-flex items-center gap-1">
                <span style={{ fontSize: 14 }}>{cos.emoji}</span>
                <span style={{ color: cos.color }}>{cos.title}</span>
              </span>
            );
          })}
          <span className="text-white/30">·</span>
          <span className="text-white/40">⠂ spinner = working · ✳ = asleep · grey = offline · 🎩→ dispatch road</span>
        </div>
      </header>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-300">
          fleet probe error: {error}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <RoadLayer roads={state.roads} container={containerRef} refs={refs} version={state.ts} />
        <div className="relative z-10 flex flex-col gap-3">
          {districts.map((d) => (
            <District
              key={d.session}
              d={d}
              registerRef={registerRef}
              dispatchMap={dispatchMap}
              setHoveredOrc={setHoveredOrc}
              ringFor={ringFor}
            />
          ))}
        </div>
      </div>

      {loading && !state.agents.length && (
        <p className="text-center text-white/40 py-12">scanning the fleet…</p>
      )}
      {!loading && !state.agents.length && !error && (
        <p className="text-center text-white/40 py-12">no agent panes found in tmux.</p>
      )}
    </div>
  );
}
