// Pure grouping: FleetState → districts (one per tmux session), each holding
// "clusters". A cluster co-locates an orchestrator with the workers it dispatched
// (campaign), or a leaderless maw team, or the commons. Ownership is taken from the
// dispatch roads (orchestrator slug ⊑ worker slug == the maw campaign/team name).
import type { FleetAgent, FleetState } from './fleet';

export interface TownCluster {
  key: string;
  kind: 'campaign' | 'team' | 'commons';
  lead: FleetAgent | null;   // the orchestrator, for campaign clusters
  label: string;             // campaign slug / team name / 'commons'
  known: boolean;            // team backed by ~/.claude/teams/<name>/config.json
  members: FleetAgent[];     // workers (excludes the lead)
  session: string;           // district it renders in
}
export interface TownDistrict {
  session: string;
  clusters: TownCluster[];
  counts: { working: number; idle: number; offline: number };
}

const rank = (a: FleetAgent) => (a.status === 'working' ? 0 : a.status === 'idle' ? 1 : 2);
const bySt = (x: FleetAgent, y: FleetAgent) => rank(x) - rank(y);
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const a = m.get(k) ?? []; a.push(v); m.set(k, a); };

export function groupTown(state: FleetState): TownDistrict[] {
  const byId = new Map(state.agents.map((a) => [a.id, a]));

  // worker → orchestrator(s) that dispatched it (from roads); longest slug wins.
  const owners = new Map<string, FleetAgent[]>();
  for (const r of state.roads) { const o = byId.get(r.from); if (o) push(owners, r.to, o); }
  const ownerOf = (id: string) =>
    (owners.get(id) ?? []).slice().sort((a, b) => b.label.length - a.label.length)[0] ?? null;

  const ownedBy = new Map<string, FleetAgent[]>();
  const claimed = new Set<string>();
  for (const a of state.agents) {
    if (a.isOrchestrator) continue;
    const o = ownerOf(a.id);
    if (o) { push(ownedBy, o.id, a); claimed.add(a.id); }
  }

  const teamMeta = new Map(state.teams.map((t) => [t.name, t]));
  const clusters: TownCluster[] = [];

  // 1) campaign clusters: orchestrator + its dispatched workers
  for (const o of state.agents.filter((a) => a.isOrchestrator)) {
    clusters.push({ key: `camp:${o.id}`, kind: 'campaign', lead: o, label: o.label || 'orchestrator', known: false, members: (ownedBy.get(o.id) ?? []).slice().sort(bySt), session: o.session });
  }
  // 2) leaderless maw teams: unclaimed workers grouped by team
  const teams = new Map<string, FleetAgent[]>();
  for (const a of state.agents) {
    if (a.isOrchestrator || claimed.has(a.id) || !a.team) continue;
    push(teams, a.team, a); claimed.add(a.id);
  }
  for (const [name, members] of teams) {
    clusters.push({ key: `team:${name}`, kind: 'team', lead: null, label: name, known: teamMeta.get(name)?.known ?? false, members: members.sort(bySt), session: members[0].session });
  }

  // assemble districts by display-session; commons = whatever is left
  const sessions = new Map<string, TownDistrict>();
  const dist = (s: string) => {
    let d = sessions.get(s);
    if (!d) { d = { session: s, clusters: [], counts: { working: 0, idle: 0, offline: 0 } }; sessions.set(s, d); }
    return d;
  };
  for (const c of clusters) dist(c.session).clusters.push(c);
  for (const a of state.agents) {
    if (a.isOrchestrator || claimed.has(a.id)) continue;
    const d = dist(a.session);
    let cm = d.clusters.find((c) => c.kind === 'commons');
    if (!cm) { cm = { key: `commons:${a.session}`, kind: 'commons', lead: null, label: 'commons', known: false, members: [], session: a.session }; d.clusters.push(cm); }
    cm.members.push(a);
  }

  const order = { campaign: 0, team: 1, commons: 2 };
  for (const d of sessions.values()) {
    const all = d.clusters.flatMap((c) => (c.lead ? [c.lead, ...c.members] : c.members));
    d.counts = {
      working: all.filter((a) => a.status === 'working').length,
      idle: all.filter((a) => a.status === 'idle').length,
      offline: all.filter((a) => a.status === 'offline').length,
    };
    d.clusters.forEach((c) => { if (c.kind === 'commons') c.members.sort(bySt); });
    d.clusters.sort((x, y) => order[x.kind] - order[y.kind] || x.label.localeCompare(y.label));
  }
  return [...sessions.values()].sort((a, b) => a.session.localeCompare(b.session));
}
