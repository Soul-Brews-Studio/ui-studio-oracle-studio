// Pure grouping: FleetState → districts (one per tmux session) each holding
// the orchestrator "town hall", team "plots", and the un-teamed "commons".
// Keeps Town.tsx lean and the layout logic unit-testable.
import type { FleetAgent, FleetState } from './fleet';

export interface TownPlot {
  name: string;
  known: boolean;
  description?: string;
  members: FleetAgent[];
}

export interface TownDistrict {
  session: string;
  halls: FleetAgent[];   // orchestrators (dispatchers)
  plots: TownPlot[];     // campaigns with ≥1 live member
  commons: FleetAgent[]; // un-teamed / home / offline panes
  counts: { working: number; idle: number; offline: number };
}

// working first, then idle, then offline — keeps the eye on what's active.
const rank = (a: FleetAgent) => (a.status === 'working' ? 0 : a.status === 'idle' ? 1 : 2);

export function groupTown(state: FleetState): TownDistrict[] {
  const bySession = new Map<string, FleetAgent[]>();
  for (const a of state.agents) {
    const arr = bySession.get(a.session) ?? [];
    arr.push(a);
    bySession.set(a.session, arr);
  }
  const teamMeta = new Map(state.teams.map((t) => [t.name, t]));

  const districts: TownDistrict[] = [];
  for (const [session, agents] of bySession) {
    const halls = agents.filter((a) => a.isOrchestrator).sort((x, y) => rank(x) - rank(y));
    const plotMap = new Map<string, TownPlot>();
    const commons: FleetAgent[] = [];
    for (const a of agents) {
      if (a.isOrchestrator) continue;
      if (a.team) {
        let p = plotMap.get(a.team);
        if (!p) {
          const meta = teamMeta.get(a.team);
          p = { name: a.team, known: meta?.known ?? false, description: meta?.description, members: [] };
          plotMap.set(a.team, p);
        }
        p.members.push(a);
      } else {
        commons.push(a);
      }
    }
    const plots = [...plotMap.values()].sort((x, y) => x.name.localeCompare(y.name));
    for (const p of plots) p.members.sort((x, y) => rank(x) - rank(y));
    commons.sort((x, y) => rank(x) - rank(y));
    districts.push({
      session, halls, plots, commons,
      counts: {
        working: agents.filter((a) => a.status === 'working').length,
        idle: agents.filter((a) => a.status === 'idle').length,
        offline: agents.filter((a) => a.status === 'offline').length,
      },
    });
  }
  return districts.sort((a, b) => a.session.localeCompare(b.session));
}
