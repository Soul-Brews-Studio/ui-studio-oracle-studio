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
import type { FleetState, FleetAgent, FleetTeam, FleetRoad, AgentStatus } from '../src/lib/fleet';

const SEP = '<|FLEET|>'; // printable token — safe vs. titles (spaces / Thai / punctuation)
const FMT = [
  '#{session_name}',
  '#{window_index}.#{pane_index}',
  '#{window_name}',
  '#{pane_title}',
  '#{pane_current_command}',
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
function knownTeams(): Map<string, string> {
  const m = new Map<string, string>();
  try {
    for (const dir of readdirSync(TEAMS_DIR)) {
      const cfg = join(TEAMS_DIR, dir, 'config.json');
      if (!existsSync(cfg)) continue;
      try {
        const j = JSON.parse(readFileSync(cfg, 'utf8'));
        m.set(dir, typeof j?.description === 'string' ? j.description : '');
      } catch { /* skip malformed */ }
    }
  } catch { /* no teams dir */ }
  return m;
}

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readPanes(): string[][] {
  const out = execFileSync('tmux', ['list-panes', '-a', '-F', FMT], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((line) => line.split(SEP));
}

export async function getFleetState(): Promise<FleetState> {
  const known = knownTeams();
  const rows = readPanes();

  // First pass → agents (team assignment needs slug frequencies, computed below).
  const slugCount = new Map<string, number>();
  const draft = rows.map(([session, winpane, windowName, title, cmd]) => {
    const { role, label } = parseWindow(windowName || '');
    const glyph = firstRune(title || '');
    if (label && label !== 'oracle') slugCount.set(label, (slugCount.get(label) ?? 0) + 1);
    return {
      id: `${session}:${winpane}`,
      session, windowName: windowName || '', role, label,
      glyph, task: taskText(title || '', glyph),
      status: statusOf(cmd || '', glyph),
      isOrchestrator: role === 'orchestrator',
    };
  });

  const agents: FleetAgent[] = draft.map((d) => {
    // A slug becomes a team plot when it's a real maw team OR shared by >1 live pane.
    // Orchestrators are halls, never plot members; `oracle` home panes go to commons.
    const isTeam =
      !d.isOrchestrator && !!d.label && d.label !== 'oracle' &&
      (known.has(d.label) || (slugCount.get(d.label) ?? 0) > 1);
    return { ...d, team: isTeam ? d.label : null };
  });

  // Teams (only those with ≥1 live member render — dead maw teams are skipped).
  const teamMap = new Map<string, FleetTeam>();
  for (const a of agents) {
    if (!a.team) continue;
    let t = teamMap.get(a.team);
    if (!t) {
      t = { name: a.team, session: a.session, members: [], known: known.has(a.team), description: known.get(a.team) || undefined };
      teamMap.set(a.team, t);
    }
    t.members.push(a.id);
  }
  const teams = [...teamMap.values()].sort((x, y) => x.name.localeCompare(y.name));

  // Dispatch roads: orchestrator → worker whose slug extends the orchestrator's slug
  // (e.g. orchestrator-botlog → next-dev-botlogbot). Best-effort; honest when absent.
  const roads: FleetRoad[] = [];
  for (const o of agents) {
    if (!o.isOrchestrator) continue;
    const key = norm(o.label);
    if (key.length < 2) continue;
    for (const w of agents) {
      if (w.id === o.id || w.isOrchestrator) continue;
      if (norm(w.label).startsWith(key)) roads.push({ from: o.id, to: w.id });
    }
  }

  const counts = {
    working: agents.filter((a) => a.status === 'working').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    offline: agents.filter((a) => a.status === 'offline').length,
    teams: teams.length,
    agents: agents.length,
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
