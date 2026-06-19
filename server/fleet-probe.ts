// Fleet probe — turns live tmux + maw team state into one FleetState JSON.
//
// Mirror, not simulator (Oracle/Shadow P-002/P-003): this only reflects what tmux
// reports; it never drives an agent. Importable by the Vite endpoint plugin and
// runnable standalone:  bun server/fleet-probe.ts
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { parseWindow } from '../src/lib/role-costume';
import { contextForCwd } from './context';
import { paneNeedsInput } from './pane-io';
import { planForPane, prunePlanCache } from './plan-detect';
import type { FleetState, FleetAgent, FleetTeam, FleetRoad, AgentStatus } from '../src/lib/fleet';

const SEP = '<|FLEET|>'; // printable token — safe vs. titles (spaces / Thai / punctuation)
const FMT = [
  '#{session_name}',
  '#{window_index}.#{pane_index}',
  '#{window_name}',
  '#{pane_title}',
  '#{pane_current_command}',
  '#{pane_id}', // %NN — matches a team's createdByPane (set by `maw team create`)
  '#{pane_current_path}', // cwd → resolve the Claude transcript for context %
  '#{pane_pid}', // shell pid → find the claude child → which Claude account (plan badge)
].join(SEP);

const TEAMS_DIR = join(homedir(), '.claude/teams');

function firstRune(s: string): string {
  const t = (s || '').replace(/^\s+/, '');
  return t ? Array.from(t)[0] : '';
}

function isBraille(ch: string): boolean {
  if (!ch) return false;
  const c = ch.codePointAt(0)!;
  return c >= 0x2800 && c <= 0x28ff; // braille block = Claude Code's working spinner
}

const IDLE_GLYPHS = new Set(['✳', '✶', '✲', '*']);

function statusOf(cmd: string, glyph: string): AgentStatus {
  if (cmd !== 'claude') return 'offline';      // bash / shell pane = empty desk
  if (isBraille(glyph)) return 'working';       // animated spinner = actively working
  return 'idle';                                // ✳ (or other) while claude = awaiting
}

/** Strip a single leading status glyph (and following space) off the title. */
function taskText(title: string, glyph: string): string {
  let t = (title || '').replace(/^\s+/, '');
  if (glyph && (isBraille(glyph) || IDLE_GLYPHS.has(glyph)) && t.startsWith(glyph)) {
    t = t.slice(glyph.length);
  }
  return t.replace(/^\s+/, '').trim();
}

/** Team names backed by ~/.claude/teams/<name>/config.json (with descriptions). */
interface TeamMeta { description: string; createdByPane?: string }
interface PaneRole { role: string; team: string }

/**
 * Read team configs → (a) per-team meta, (b) a pane→role map from each member's
 * `tmuxPaneId`. The pane map is the authoritative role+team signal: maw can split
 * many agents into ONE window (orchestrator + spawned workers), so the window-name
 * prefix mislabels them all as the lead — the member's recorded pane fixes that.
 */
function readTeams(): { meta: Map<string, TeamMeta>; paneRole: Map<string, PaneRole> } {
  const meta = new Map<string, TeamMeta>();
  const paneRole = new Map<string, PaneRole>();
  try {
    for (const dir of readdirSync(TEAMS_DIR)) {
      const cfg = join(TEAMS_DIR, dir, 'config.json');
      if (!existsSync(cfg)) continue;
      try {
        const j = JSON.parse(readFileSync(cfg, 'utf8'));
        meta.set(dir, {
          description: typeof j?.description === 'string' ? j.description : '',
          createdByPane: typeof j?.createdByPane === 'string' && j.createdByPane ? j.createdByPane : undefined,
        });
        for (const m of (j?.members ?? []) as Array<{ name?: string; tmuxPaneId?: string }>) {
          if (m?.tmuxPaneId && m?.name) paneRole.set(m.tmuxPaneId, { role: m.name, team: dir });
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* no teams dir */ }
  return { meta, paneRole };
}

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readPanes(): string[][] {
  const out = execFileSync('tmux', ['list-panes', '-a', '-F', FMT], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((line) => line.split(SEP));
}

export async function getFleetState(): Promise<FleetState> {
  const { meta: known, paneRole } = readTeams();
  const rows = readPanes();

  // First pass → agents (team assignment needs slug frequencies, computed below).
  const slugCount = new Map<string, number>();
  const draft = rows.map(([session, winpane, windowName, title, cmd, paneId, cwd, panePid]) => {
    // Prefer the maw team's per-pane role over the window-name prefix (handles
    // multiple agents split into one window — see readTeams). canonicalize via
    // parseWindow so e.g. "next-dev-1" maps to the next-dev costume.
    const mapped = paneRole.get(paneId || '');
    const win = parseWindow(windowName || '');
    const role = mapped ? parseWindow(mapped.role).role : win.role;
    const label = mapped ? mapped.team : win.label;
    const glyph = firstRune(title || '');
    if (!mapped && label && label !== 'oracle') slugCount.set(label, (slugCount.get(label) ?? 0) + 1);
    return {
      id: `${session}:${winpane}`,
      paneId: paneId || '',
      cwd: cwd || '',
      panePid: Number(panePid) || 0,
      mappedTeam: mapped?.team ?? null,
      session, windowName: windowName || '', role, label,
      glyph, task: taskText(title || '', glyph),
      status: statusOf(cmd || '', glyph),
      isOrchestrator: role === 'orchestrator',
    };
  });
  const idByPane = new Map(draft.filter((d) => d.paneId).map((d) => [d.paneId, d.id]));

  prunePlanCache(new Set(draft.map((d) => d.paneId)));
  const agents: FleetAgent[] = draft.map(({ cwd, mappedTeam, panePid, ...rest }) => {
    // A pane is a team member when maw mapped it (mappedTeam), or its slug is a real
    // maw team / shared by >1 live pane. Orchestrators are leads, never plot members.
    const isTeam = !rest.isOrchestrator && (
      mappedTeam != null ||
      (!!rest.label && rest.label !== 'oracle' && (known.has(rest.label) || (slugCount.get(rest.label) ?? 0) > 1))
    );
    const ctx = rest.status === 'offline' ? null : contextForCwd(cwd);
    // An idle pane parked on a TUI menu is BLOCKED on a human answer, not just done.
    const waiting = rest.status === 'idle' ? paneNeedsInput(rest.paneId) : false;
    // Which Claude account this agent runs on ('' = default logged-in → no badge).
    const plan = rest.status === 'offline' ? '' : planForPane(rest.paneId, panePid);
    return { ...rest, team: isTeam ? (mappedTeam ?? rest.label) : null, ctxPct: ctx?.pct, ctxModel: ctx?.model, waiting, plan: plan || undefined };
  });

  // Dispatch roads: orchestrator → worker whose slug extends the orchestrator's slug
  // (e.g. orchestrator-botlog → next-dev-botlogbot). Best-effort; honest when absent.
  const roads: FleetRoad[] = [];
  const roadSet = new Set<string>();
  const addRoad = (from: string, to: string) => {
    if (from === to) return;
    const k = `${from}|${to}`;
    if (!roadSet.has(k)) { roadSet.add(k); roads.push({ from, to }); }
  };
  for (const o of agents) {
    if (!o.isOrchestrator) continue;
    const key = norm(o.label);
    if (key.length < 2) continue;
    for (const w of agents) {
      if (w.id === o.id || w.isOrchestrator) continue;
      if (norm(w.label).startsWith(key)) addRoad(o.id, w.id);
    }
  }

  // Authoritative ownership: a team config's createdByPane (set by `maw team create`)
  // names the orchestrator pane that spawned it — link it to its members even when
  // the slugs don't match (e.g. orchestrator-live-payout → team "adminview").
  for (const [name, meta] of known) {
    if (!meta.createdByPane) continue;
    const ownerId = idByPane.get(meta.createdByPane);
    const owner = ownerId && agents.find((a) => a.id === ownerId);
    if (!owner || !owner.isOrchestrator) continue;
    for (const m of agents) if (m.team === name) addRoad(owner.id, m.id);
  }

  // Teams (only those with ≥1 live member render — dead maw teams are skipped).
  const teamMap = new Map<string, FleetTeam>();
  for (const a of agents) {
    if (!a.team) continue;
    let t = teamMap.get(a.team);
    if (!t) {
      t = { name: a.team, session: a.session, members: [], known: known.has(a.team), description: known.get(a.team)?.description || undefined };
      teamMap.set(a.team, t);
    }
    t.members.push(a.id);
  }
  const teams = [...teamMap.values()].sort((x, y) => x.name.localeCompare(y.name));

  const counts = {
    working: agents.filter((a) => a.status === 'working').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    offline: agents.filter((a) => a.status === 'offline').length,
    teams: teams.length,
    agents: agents.length,
    waiting: agents.filter((a) => a.waiting).length,
  };

  return { ts: new Date().toISOString(), host: hostname(), agents, teams, roads, counts };
}

// Standalone CLI (Bun): print FleetState as pretty JSON.
if ((import.meta as unknown as { main?: boolean }).main) {
  getFleetState()
    .then((s) => console.log(JSON.stringify(s, null, 2)))
    .catch((e) => {
      console.error('fleet-probe failed:', (e as Error).message);
      process.exit(1);
    });
}
