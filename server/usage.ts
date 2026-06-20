// Per-account usage for the town. For each auth plan (a CLAUDE_CONFIG_DIR) we read
// `claude auth status --json` for identity (email/tier, confirms web-not-api auth),
// and the REAL subscription quota from the same OAuth endpoint the CLI's /usage
// uses: GET https://api.anthropic.com/api/oauth/usage with the dir's OAuth access
// token (from <dir>/.credentials.json) → 5-hour (session) + 7-day (weekly)
// utilisation %, so "remaining" = 100 − used. The access token is read server-side
// and sent only to api.anthropic.com over TLS — never logged or sent to the client.
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PLANS_FILE = join(homedir(), '.fleet-town', 'auth-plans.json');
// A plan is EITHER dir-based (CLAUDE_CONFIG_DIR) or token-based (a web-auth OAuth
// token). dir '' + token '' = the default logged-in ~/.claude.
export interface Plan { id: string; name: string; dir?: string; token?: string }
export function loadPlans(): Plan[] {
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

// Read the live OAuth access token from a config-dir's credentials.
function accessToken(dir: string): string | null {
  const base = dir ? expandTilde(dir) : join(homedir(), '.claude');
  const f = join(base, '.credentials.json');
  if (!existsSync(f)) return null;
  try {
    const t = JSON.parse(readFileSync(f, 'utf8'))?.claudeAiOauth?.accessToken;
    return typeof t === 'string' && t.startsWith('sk-ant-oat') ? t : null;
  } catch { return null; }
}

/** Plan id+name list for the spawn UI (default first). */
export function listPlans(): Array<{ id: string; name: string }> {
  return loadPlans().map((p) => ({ id: p.id, name: p.name }));
}
/** Look up a plan by id (for the spawn endpoint). */
export function planById(id: string): Plan | undefined {
  return loadPlans().find((p) => p.id === id);
}
/** The plan's web-auth token: an explicit `token`, else read from its config-dir. */
export function planAccessToken(p: Plan): string | null {
  const tok = (p.token || '').trim();
  if (tok && tok.startsWith('sk-ant-oat')) return tok;
  return accessToken(p.dir || '');
}
/** A plan is the true passthrough (use the logged-in ~/.claude, no injection)
 *  only when it pins NO dir and NO token. A named plan with a dir still injects. */
export function planIsPassthrough(p: Plan): boolean {
  return !p.dir && !(p.token || '').trim();
}

// One quota limit, mirroring the CLI /usage breakdown. `used` is the % consumed
// (the CLI shows "X% used"); the UI derives "left" = 100 − used.
export interface QuotaLimit { label: string; kind: string; used: number; resetsAt: string; active: boolean }
export interface Quota { limits?: QuotaLimit[]; error?: string; stale?: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Label each limit exactly like the Claude /usage UI.
function labelLimit(kind: string, model?: string): string {
  if (kind === 'session') return 'Session (5h)';
  if (kind === 'weekly_all') return 'Weekly · All models';
  if (kind === 'weekly_scoped') return `Weekly · ${model || 'scoped'}`;
  return kind;
}

// Real subscription quota from the OAuth usage endpoint (what the CLI /usage uses).
// The `limits[]` array is the authoritative, labelled source (kind + scope.model).
async function fetchQuota(token: string): Promise<Quota> {
  // /api/oauth/usage rate-limits in bursts (429); one short retry clears most of
  // them. A 429 that survives the retry falls back to the last-good cache (refresh()).
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
        headers: { authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429 && attempt < 1) { await sleep(2000); continue; }
      if (res.status === 429) return { error: 'rate-limited — will refresh when the window clears' };
      if (!res.ok) return { error: `usage ${res.status}${res.status === 401 ? ' (token expired — open this account once to refresh)' : ''}` };
      const d = await res.json() as { limits?: Array<{ kind?: string; percent?: number; resets_at?: string; is_active?: boolean; scope?: { model?: { display_name?: string } } }> };
      const limits = (d.limits || [])
        .filter((L) => typeof L.percent === 'number')
        .map((L) => ({
          label: labelLimit(L.kind || '', L.scope?.model?.display_name),
          kind: L.kind || '',
          used: L.percent as number,
          resetsAt: L.resets_at || '',
          active: !!L.is_active,
        }));
      return { limits };
    } catch (e) {
      if (attempt < 1) { await sleep(2000); continue; }
      return { error: (e as Error).message.slice(0, 100) };
    }
  }
}

let snapshot: unknown[] = [];
export const getUsageSnapshot = () => snapshot;

// Last good quota per account — so a 429/timeout keeps showing the last real
// numbers (flagged stale) instead of blanking the panel. PERSISTED to disk so a
// server restart (which empties memory) still shows the last successful read while
// the accounts are rate-limited; only a fresh good read replaces it.
const CACHE_FILE = join(homedir(), '.fleet-town', 'usage-cache.json');
function loadCache(): Array<[string, Quota]> {
  try { return Object.entries(JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, Quota>); }
  catch { return []; }
}
const lastGood = new Map<string, Quota>(loadCache());
function saveCache() {
  try { writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(lastGood))); } catch { /* best-effort */ }
}

async function refresh() {
  try {
    // Resolve every plan → its auth identity + its dir's live OAuth token.
    const resolved = loadPlans().map((p) => ({ plan: p, auth: authStatus(p), token: accessToken(p.dir || '') }));

    // Group by ACCOUNT (email): plans that log into the same account share ONE
    // real subscription quota, so they collapse into one card. Plans not logged
    // in / errored key by plan id so they still show.
    const groups = new Map<string, { auth: Record<string, unknown>; plans: string[]; token: string | null }>();
    for (const r of resolved) {
      const email = (r.auth.email as string) || '';
      const key = email || `plan:${r.plan.id}`;
      let g = groups.get(key);
      if (!g) { g = { auth: r.auth, plans: [], token: null }; groups.set(key, g); }
      g.plans.push(r.plan.name);
      if (!g.token && r.token) g.token = r.token;             // any of the account's tokens works
      if (r.auth.email && !g.auth.email) g.auth = r.auth;
    }

    // SEQUENTIAL with a gap — don't burst the rate-limited usage endpoint.
    const out: unknown[] = [];
    const gs = [...groups.values()];
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      const key = (g.auth.email as string) || g.plans.join(',');
      let quota: Quota = g.token ? await fetchQuota(g.token) : { error: 'no OAuth token on disk for this account' };
      if (quota.limits?.length) lastGood.set(key, quota);                    // a good read → remember it
      else if (quota.error && lastGood.has(key)) quota = { ...lastGood.get(key)!, stale: true }; // transient error → keep last-good
      out.push({ name: (g.auth.email as string) || g.plans[0], auth: g.auth, plans: g.plans, quota });
      if (i < gs.length - 1) await sleep(1500);
    }
    snapshot = out;
    saveCache(); // persist any new good reads so a restart survives a rate-limited stretch
  } catch (e) { console.error('[usage] refresh failed', (e as Error).message); }
}

export function startUsage(ms = 300_000) { void refresh(); setInterval(() => void refresh(), ms); } // every 5 min
