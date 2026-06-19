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

// Role → character index on the folk spritesheet (now 32: 8 base bodies × 4 hue
// palettes, indices 0-7 orig / 8-15 +60 / 16-23 +140 / 24-31 +220). Every known
// role gets a UNIQUE body+colour, spread across palettes so co-present roles look
// distinct (the costume colour + name-tag still back this up).
const CHAR_INDEX: Record<string, number> = {
  // orig palette (0-7)
  'brew-ops': 0, 'next-architect': 1, 'next-live-tester': 2, 'next-dev': 3,
  'next-ui': 4, 'orchestrator': 5, 'next-tester': 6, 'pg-tester': 7,
  // +60 palette (8-15)
  'nextbot-dev': 11, 'next-writer': 12, 'next-pm': 13, 'next-code-reviewer': 14,
  'next-impl': 9,
  // +140 palette (16-23)
  'pg-writer': 18, 'bot-writer': 22, 'next-investigator': 23,
  // +220 palette (24-31)
  'finance-auditor': 24,
};

export function charIndexFor(role: string): number {
  if (role in CHAR_INDEX) return CHAR_INDEX[role];
  let h = 0;
  for (const c of role) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 32; // unknown roles spread across all 32 bodies
}

/** Colour for a remaining-context % (green healthy → red nearly full). */
export function ctxColor(pct: number): string {
  return pct > 50 ? '#4ade80' : pct > 20 ? '#fbbf24' : '#f87171';
}

// Activity emoji guessed from the agent's current task (ai-town shows an emoji
// "activity" above the head). Ordered most-specific first; falls back to 💭.
const ACTIVITY: Array<[RegExp, string]> = [
  [/deploy|ship|release|rollout|prod|staging|vercel|wrangler/i, '🚀'],
  [/\bpr\b|pull request|merge|commit|push|rebase/i, '📤'],
  [/test|journey|e2e|playwright|smoke|live-?test|verify run/i, '🧪'],
  [/migrat|schema|\bsql\b|\bdb\b|drizzle|dedupe|index/i, '🗄️'],
  [/investigat|trace|root cause|diagnos|debug|reproduce/i, '🔍'],
  [/fix|bug|patch|repair|hotfix|broken/i, '🔧'],
  [/review|audit|seal|ratif|approve|gate/i, '🔎'],
  [/write|doc|charter|spec|\badr\b|retro|runbook/i, '📝'],
  [/\bui\b|portal|design|page|render|component|css/i, '🎨'],
  [/build|workflow|orchestrat|dispatch|scaffold|campaign/i, '⚙️'],
  [/search|index|memory|arra|vault/i, '🔭'],
];

export function activityEmoji(task: string): string {
  const t = task || '';
  for (const [re, emoji] of ACTIVITY) if (re.test(t)) return emoji;
  return '💭';
}
