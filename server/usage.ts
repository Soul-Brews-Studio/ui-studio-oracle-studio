// Per-account usage for the town. For each auth plan (a CLAUDE_CONFIG_DIR) we read
// `claude auth status --json` (identity + plan tier + confirms web/claude.ai auth,
// NOT api-key) and tally token usage from that dir's transcript JSONL over rolling
// windows. Exact subscription %-remaining isn't exposed by the CLI (only the TUI
// /usage has it), so token consumption per window is the reliable "how much used".
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PLANS_FILE = join(homedir(), '.fleet-town', 'auth-plans.json');
// A plan is EITHER dir-based (CLAUDE_CONFIG_DIR) or token-based (a web-auth OAuth
// token). dir '' + token '' = the default logged-in ~/.claude.
interface Plan { id: string; name: string; dir?: string; token?: string }
function loadPlans(): Plan[] {
  let plans: Plan[] = [{ id: 'default', name: 'Default', dir: '' }];
  try {
    const v = JSON.parse(readFileSync(PLANS_FILE, 'utf8'));
    if (Array.isArray(v?.plans) && v.plans.length) plans = v.plans;
  } catch { /* default only */ }
  if (!plans.some((p) => p.id === 'default')) plans.unshift({ id: 'default', name: 'Default', dir: '' });
  return plans;
}

// An API key (sk-ant-api…) is explicitly rejected — subscription web-auth only.
// Whether a token is genuinely web-auth is decided by `claude auth status`
// (authMethod === 'claude.ai'), NOT by a prefix guess — the CLI is the truth.
const isApiKey = (t: string) => /^sk-ant-api/i.test(t.trim());
const expandTilde = (d: string) => (d.startsWith('~') ? join(homedir(), d.slice(1).replace(/^[/\\]/, '')) : d);

// systemd launches the server with a minimal PATH that lacks ~/.local/bin (where
// `claude` lives) and ~/go/bin (ghq). Prepend them so child CLIs resolve.
const TOOL_PATH = [join(homedir(), '.local/bin'), join(homedir(), 'go/bin')].join(':');

// Build the env a plan runs under. A token plan injects CLAUDE_CODE_OAUTH_TOKEN
// (the web-auth slot — never ANTHROPIC_API_KEY); ANTHROPIC_API_KEY is always
// cleared so a stray shell key can't silently bill the API.
export function planEnv(p: Plan): Record<string, string> | { error: string } {
  const env = { ...process.env } as Record<string, string>;
  env.PATH = `${TOOL_PATH}:${env.PATH || ''}`;
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.CLAUDE_CONFIG_DIR;
  // A config-dir wins over a token when both are set: it's the richer, fully
  // isolated option (own login profile + own transcript dir for per-account usage).
  const token = (p.token || '').trim();
  if (p.dir) {
    env.CLAUDE_CONFIG_DIR = expandTilde(p.dir);
  } else if (token) {
    if (isApiKey(token)) return { error: 'API key not allowed — use a web-auth (subscription) token' };
    env.CLAUDE_CODE_OAUTH_TOKEN = token;
  }
  return env;
}

function authStatus(p: Plan): Record<string, unknown> {
  const env = planEnv(p);
  if ('error' in env) return { loggedIn: false, error: env.error };
  try {
    const out = execFileSync('claude', ['auth', 'status', '--json'], { encoding: 'utf8', env, timeout: 20000 });
    return JSON.parse(out);
  } catch (e) { return { loggedIn: false, error: (e as Error).message.slice(0, 120) }; }
}

interface Win { in: number; out: number; cache: number; msgs: number }
const zero = (): Win => ({ in: 0, out: 0, cache: 0, msgs: 0 });
function tokenUsage(dir: string) {
  const base = dir ? expandTilde(dir) : join(homedir(), '.claude');
  const root = join(base, 'projects');
  const now = Date.now();
  const W = { h5: now - 5 * 3600e3, d1: now - 24 * 3600e3, d7: now - 7 * 24 * 3600e3 };
  const acc = { h5: zero(), d1: zero(), d7: zero() };
  if (!existsSync(root)) return acc;
  let files: string[] = [];
  try {
    for (const d of readdirSync(root)) {
      const pd = join(root, d);
      try { for (const f of readdirSync(pd)) if (f.endsWith('.jsonl')) files.push(join(pd, f)); } catch { /* skip */ }
    }
  } catch { return acc; }
  for (const f of files) {
    let st; try { st = statSync(f); } catch { continue; }
    if (st.mtimeMs < W.d7 || st.size > 120_000_000) continue;     // only files touched in the window; skip huge
    let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line || line.indexOf('"usage"') === -1) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const u = (o.message?.usage) || o.usage; if (!u) continue;
      const ts = Date.parse(o.timestamp || '') || st.mtimeMs;
      const inc = (w: Win) => { w.in += u.input_tokens || 0; w.out += u.output_tokens || 0; w.cache += (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); w.msgs += 1; };
      if (ts >= W.h5) inc(acc.h5);
      if (ts >= W.d1) inc(acc.d1);
      if (ts >= W.d7) inc(acc.d7);
    }
  }
  return acc;
}

let snapshot: unknown[] = [];
export const getUsageSnapshot = () => snapshot;

const addWin = (a: Win, b: Win): Win => ({ in: a.in + b.in, out: a.out + b.out, cache: a.cache + b.cache, msgs: a.msgs + b.msgs });

function refresh() {
  try {
    // Resolve every plan to its auth identity + the local token usage of its dir.
    const resolved = loadPlans().map((p) => ({ plan: p, auth: authStatus(p), usage: tokenUsage(p.dir || '') }));

    // Group by ACCOUNT (email) — the user asked for usage PER ACCOUNT, and the
    // same login across config-dirs shares ONE real subscription quota. Local
    // transcript usage from each of that account's dirs is summed, so the same
    // account always shows the same number regardless of how many plans map to
    // it. Plans that aren't logged in / errored key by plan id so they show alone.
    const groups = new Map<string, { auth: Record<string, unknown>; plans: string[]; dirs: Set<string>; usage: { h5: Win; d1: Win; d7: Win } }>();
    for (const r of resolved) {
      const email = (r.auth.email as string) || '';
      const key = email || `plan:${r.plan.id}`;
      let g = groups.get(key);
      if (!g) { g = { auth: r.auth, plans: [], dirs: new Set(), usage: { h5: zero(), d1: zero(), d7: zero() } }; groups.set(key, g); }
      g.plans.push(r.plan.name);
      // Sum each distinct dir once (two plans on the same dir mustn't double-count).
      const dirKey = r.plan.dir || '~/.claude';
      if (!g.dirs.has(dirKey)) {
        g.dirs.add(dirKey);
        g.usage = { h5: addWin(g.usage.h5, r.usage.h5), d1: addWin(g.usage.d1, r.usage.d1), d7: addWin(g.usage.d7, r.usage.d7) };
      }
      if (r.auth.email && !g.auth.email) g.auth = r.auth; // prefer a logged-in identity for the group
    }
    snapshot = [...groups.values()].map((g) => ({
      name: (g.auth.email as string) || g.plans[0],
      auth: g.auth,
      plans: g.plans,
      usage: g.usage,
    }));
  } catch (e) { console.error('[usage] refresh failed', (e as Error).message); }
}

export function startUsage(ms = 300_000) { refresh(); setInterval(refresh, ms); } // every 5 min
