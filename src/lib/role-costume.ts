// Role identity + costume map for the Fleet Town view.
//
// Pure module — no browser or node deps — so the server probe (server/fleet-probe.ts)
// and the React page share ONE source of truth for how a tmux window name maps to a
// role and how that role is drawn. Roles repeat in the fleet (e.g. 4× orchestrator),
// so the costume identifies the role and the parsed `label` distinguishes duplicates.

export interface Costume {
  emoji: string;
  color: string; // primary hex — avatar bg + accents
  title: string; // human label for the role
}

// Canonical roles from .agent/AGENTS.md §5 roster + ~/.config/maw/maw.config.json `agents`.
const COSTUMES: Record<string, Costume> = {
  'orchestrator':       { emoji: '🎩', color: '#c084fc', title: 'Orchestrator' },
  'brew-ops':           { emoji: '🍺', color: '#fbbf24', title: 'Brew-Ops' },
  'next-architect':     { emoji: '📐', color: '#818cf8', title: 'Architect' },
  'next-impl':          { emoji: '🔧', color: '#22d3ee', title: 'Impl-Architect' },
  'next-dev':           { emoji: '👷', color: '#38bdf8', title: 'Dev' },
  'next-live-tester':   { emoji: '🧪', color: '#4ade80', title: 'Live-Tester' },
  'next-tester':        { emoji: '🔬', color: '#2dd4bf', title: 'Tester' },
  'next-code-reviewer': { emoji: '🔎', color: '#fb7185', title: 'Reviewer' },
  'next-investigator':  { emoji: '🕵️', color: '#e879f9', title: 'Investigator' },
  'next-writer':        { emoji: '✍️', color: '#a3e635', title: 'Writer' },
  'next-pm':            { emoji: '📋', color: '#fb923c', title: 'PM' },
  'next-ui':            { emoji: '🎨', color: '#f472b6', title: 'UI' },
  'nextbot-dev':        { emoji: '🤖', color: '#94a3b8', title: 'Bot-Dev' },
  'pg-tester':          { emoji: '🔍', color: '#2dd4bf', title: 'PG-Tester' },
  'pg-writer':          { emoji: '📝', color: '#34d399', title: 'PG-Writer' },
  'bot-writer':         { emoji: '📜', color: '#facc15', title: 'Bot-Writer' },
  'finance-auditor':    { emoji: '💰', color: '#f59e0b', title: 'Finance-Auditor' },
};

const DEFAULT_COSTUME: Costume = { emoji: '🧭', color: '#64748b', title: 'Agent' };

// Longest role name first → correct longest-prefix matching
// (so "next-live-tester-x" matches next-live-tester, not next-…).
const ROLE_KEYS = Object.keys(COSTUMES).sort((a, b) => b.length - a.length);

export interface ParsedWindow {
  role: string;  // canonical role key, or leading segment if unknown
  label: string; // remaining slug (campaign / task); '' when none
}

/** Parse a tmux window name like "next-live-tester-multitx2" → { role, label }. */
export function parseWindow(windowName: string): ParsedWindow {
  const name = (windowName || '').trim();
  for (const role of ROLE_KEYS) {
    if (name === role) return { role, label: '' };
    if (name.startsWith(role + '-')) return { role, label: name.slice(role.length + 1) };
  }
  const dash = name.indexOf('-');
  if (dash === -1) return { role: name || 'agent', label: '' };
  return { role: name.slice(0, dash), label: name.slice(dash + 1) };
}

export function costumeFor(role: string): Costume {
  return COSTUMES[role] ?? DEFAULT_COSTUME;
}

export const KNOWN_ROLES = ROLE_KEYS;

// Role → ai-town character index (0–7 = f1–f8 on the folk spritesheet). Only 8
// sprites for ~17 roles, so some share a body — the costume colour + name-tag
// still disambiguate. Indices chosen so commonly co-present roles differ.
const CHAR_INDEX: Record<string, number> = {
  'brew-ops': 0, 'next-architect': 1, 'next-live-tester': 2, 'next-dev': 3,
  'next-ui': 4, 'orchestrator': 5, 'next-tester': 6, 'pg-tester': 7,
  'next-impl': 1, 'pg-writer': 2, 'nextbot-dev': 3, 'next-writer': 4,
  'next-pm': 5, 'next-code-reviewer': 6, 'next-investigator': 7,
  'bot-writer': 6, 'finance-auditor': 0,
};

export function charIndexFor(role: string): number {
  if (role in CHAR_INDEX) return CHAR_INDEX[role];
  let h = 0;
  for (const c of role) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 8;
}

/** Colour for a remaining-context % (green healthy → red nearly full). */
export function ctxColor(pct: number): string {
  return pct > 50 ? '#4ade80' : pct > 20 ? '#fbbf24' : '#f87171';
}
