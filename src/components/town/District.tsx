// A district = one tmux session. Renders its clusters: a campaign card groups an
// orchestrator (lead, 👑) with the workers it dispatched; a team card is a
// leaderless maw team; commons holds un-teamed / home / offline panes.
import type { TownDistrict, TownCluster } from '../../lib/town-group';
import { AgentTile } from './AgentTile';

function ClusterCard({ c }: { c: TownCluster }) {
  const icon = c.kind === 'campaign' ? '🎩' : c.kind === 'team' ? '🏠' : null;
  const count = (c.lead ? 1 : 0) + c.members.length;
  const border = c.kind === 'campaign' ? 'rgba(192,132,252,0.45)' : c.kind === 'team' ? 'rgba(150,210,150,0.3)' : 'rgba(255,255,255,0.1)';
  const style = c.kind === 'commons'
    ? { borderColor: border, borderStyle: 'dotted' as const, background: 'rgba(255,255,255,0.015)' }
    : { borderColor: border, borderStyle: c.kind === 'campaign' ? ('solid' as const) : ('dashed' as const), background: c.kind === 'campaign' ? 'rgba(192,132,252,0.05)' : 'rgba(120,200,120,0.04)' };
  return (
    <div className="rounded-lg border p-2" style={style}>
      {c.kind !== 'commons' && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[11px] font-semibold text-white/75 truncate">{icon} {c.label}</span>
          <span className="text-[9px] text-white/35 shrink-0">{count}</span>
          {c.kind === 'team' && !c.known && <span className="text-[8px] text-white/25" title="inferred from shared slug">~</span>}
        </div>
      )}
      <div className={c.kind === 'commons' ? 'flex flex-wrap gap-1.5' : 'flex flex-col gap-1.5'}>
        {c.lead && <AgentTile agent={c.lead} ring="#c084fc" />}
        {c.members.map((m) => <AgentTile key={m.id} agent={m} />)}
      </div>
    </div>
  );
}

export function District({ d }: { d: TownDistrict }) {
  return (
    <section className="rounded-xl border border-white/[0.08] p-3" style={{ background: '#0c0c12' }}>
      <header className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-white/85 truncate">🏙 {d.session}</span>
          <span className="text-[10px] text-white/40 shrink-0">{d.clusters.filter((c) => c.kind !== 'commons').length} groups</span>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] text-white/45 shrink-0">
          <span title="working">🟢 {d.counts.working}</span>
          <span title="asleep">🟡 {d.counts.idle}</span>
          <span title="offline">⚪ {d.counts.offline}</span>
        </div>
      </header>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>
        {d.clusters.map((c) => <ClusterCard key={c.key} c={c} />)}
      </div>
    </section>
  );
}
