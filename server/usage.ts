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

// A token is web-auth (subscription) iff it's an OAuth token (sk-ant-oat…). An API
// key (sk-ant-api…) is NOT allowed — the whole point is subscription auth.
const isWebToken = (t: string) => /^sk-ant-oat/i.test(t.trim());
const isApiKey = (t: string) => /^sk-ant-api/i.test(t.trim());

// Build the env a plan runs under. NEVER pass an API key; a dir/token plan
// explicitly clears ANTHROPIC_API_KEY so a stray shell key can't bill the API.
export function planEnv(p: Plan): Record<string, string> | { error: string } {
  const env = { ...process.env } as Record<string, string>;
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  delete env.CLAUDE_CONFIG_DIR;
  const token = (p.token || '').trim();
  if (token) {
    if (isApiKey(token)) return { error: 'API key not allowed — use a web-auth (sk-ant-oat) token' };
    if (!isWebToken(token)) return { error: 'token is not a recognised web-auth (sk-ant-oat) token' };
    env.CLAUDE_CODE_OAUTH_TOKEN = token;
  } else if (p.dir) {
    env.CLAUDE_CONFIG_DIR = p.dir;
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
  const root = join(dir || join(homedir(), '.claude'), 'projects');
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

function refresh() {
  try {
    snapshot = loadPlans().map((p) => ({
      id: p.id, name: p.name,
      auth: authStatus(p),
      // Token usage tallies per config-dir. Token-based plans share the default
      // projects dir (no separate dir), so their window is the shared default —
      // flagged so the UI can note it isn't plan-isolated.
      usage: tokenUsage(p.dir || ''),
      sharedUsage: !!(p.token && !p.dir),
    }));
  } catch (e) { console.error('[usage] refresh failed', (e as Error).message); }
}

export function startUsage(ms = 300_000) { refresh(); setInterval(refresh, ms); } // every 5 min
