// Fleet Town — an ai-town-style live mirror of the tmux agent fleet.
// Roles → costumes, working/asleep/offline → animation; an orchestrator and the
// workers it dispatched (its maw campaign) sit together in one cluster. Map view =
// pixel sprites on a grass map; List view = readable cards. Mirror, never drives.
import { useMemo, useState } from 'react';
import { useFleet } from '../lib/fleet';
import type { FleetAgent } from '../lib/fleet';
import { groupTown } from '../lib/town-group';
import { District } from '../components/town/District';
import { PixelTown } from '../components/town/PixelTown';
import { AgentChat } from '../components/town/AgentChat';
import { NewAgent } from '../components/town/NewAgent';
import { Notifications } from '../components/town/Notifications';
import { StagingBand } from '../components/town/StagingBand';
import { UsagePanel } from '../components/town/UsagePanel';
import './Town.css';

type TownView = 'map' | 'list';

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
  const [view, setView] = useState<TownView>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const selected = selectedId ? state.agents.find((a) => a.id === selectedId) ?? null : null;
  const openAgent = (a: FleetAgent) => setSelectedId(a.id);

  const c = state.counts;
  // Alert "teams" = the town's orchestrator-led clusters (campaign/team), keyed by
  // cluster + named by the orchestrator — matching how team-idle alerts group.
  const teamGroups = useMemo(
    () => districts.flatMap((d) => d.clusters)
      .filter((c) => c.kind !== 'commons')
      .map((c) => ({ key: c.key, name: c.lead ? `${c.lead.role}${c.lead.label && c.lead.label !== 'oracle' ? '·' + c.lead.label : ''}` : c.label })),
    [districts],
  );
  const agentList = useMemo(
    () => state.agents.map((a) => ({ id: a.id, name: `${a.role}${a.label && a.label !== 'oracle' ? '·' + a.label : ''}` })),
    [state],
  );
  return (
    <div className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {c.waiting > 0 && (
          <span className="town-wait-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2466' }}>
            🔔 <span className="font-bold">{c.waiting}</span> waiting on you
          </span>
        )}
        <Chip dot="#4ade80" label="working" value={c.working} />
        <Chip dot="#fbbf24" label="asleep" value={c.idle} />
        <Chip dot="#555" label="offline" value={c.offline} />
        <Chip dot="#c084fc" label="teams" value={c.teams} />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="px-2.5 py-1 rounded-full text-[11px]"
            style={{ background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8055' }}
          >➕ new agent</button>
          <button
            onClick={() => setShowUsage(true)}
            className="px-2.5 py-1 rounded-full text-[11px]"
            style={{ background: '#a78bfa22', color: '#c4b5fd', border: '1px solid #a78bfa55' }}
            title="account usage / quota"
          >📊 usage</button>
          <Notifications teams={teamGroups} agents={agentList} />
          <span className="text-[10px] text-white/35 font-mono">{state.host || '…'} · {ago(lastOk)}</span>
          <div className="inline-flex rounded-full border border-white/10 overflow-hidden text-[11px]">
            {(['map', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-2.5 py-1"
                style={{ background: view === v ? '#c084fc22' : 'transparent', color: view === v ? '#d9bbff' : '#888' }}
              >
                {v === 'map' ? '🗺 Map' : '☰ List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-300">
          fleet probe error: {error}
        </div>
      )}

      {view === 'map' && <PixelTown state={state} onSelect={openAgent} />}

      {view === 'list' && (
        <div className="flex flex-col gap-3">
          {districts.map((d) => <District key={d.session} d={d} onSelect={openAgent} />)}
        </div>
      )}

      {selected && <AgentChat key={selected.id} agent={selected} onClose={() => setSelectedId(null)} />}
      {showNew && <NewAgent onClose={() => setShowNew(false)} />}
      {showUsage && <UsagePanel onClose={() => setShowUsage(false)} />}

      {loading && !state.agents.length && (
        <p className="text-center text-white/40 py-12">scanning the fleet…</p>
      )}
      {!loading && !state.agents.length && !error && (
        <p className="text-center text-white/40 py-12">no agent panes found in tmux.</p>
      )}

      <StagingBand />
    </div>
  );
}
