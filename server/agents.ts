// Spawn a new agent (brewbot /new). Roles come from the maw fleet configs
// (window name minus the -oracle suffix); spawning runs `maw wake <role> --wt
// <slug> --fresh`, which maw turns into a fresh worktree + tmux pane + booted CLI.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { planById, planAccessToken, planIsPassthrough } from './usage';

const HOME = homedir();
const MAW = join(HOME, '.bun/bin/maw');
const FLEET_DIR = join(HOME, '.config/maw/fleet');
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/i;

// The running maw execs src/cli.ts from this primary checkout. Account-pinning
// needs the `--env` wake flag (maw PR feat/wake-env); maw's arg parser is
// PERMISSIVE, so without the flag --env is silently dropped (agent would run on
// the wrong account). Detect support by reading the live source, so we fail loud.
const MAW_SRC = join(HOME, 'Code/github.com/Soul-Brews-Studio/maw-js/src/cli/top-aliases.ts');
function mawSupportsEnv(): boolean {
  try { return existsSync(MAW_SRC) && readFileSync(MAW_SRC, 'utf8').includes('"--env"'); }
  catch { return false; }
}
// maw needs the user's tool PATH (bun for its shebang, ghq to locate repos, git/tmux);
// the systemd service runs with a minimal PATH, so prepend the login locations.
const TOOL_PATH = [
  join(HOME, '.bun/bin'), join(HOME, 'go/bin'), join(HOME, '.local/bin'),
  '/usr/local/bin', '/usr/bin', '/bin', '/snap/bin',
].join(':');

/** Wakeable role names from the maw fleet configs (deduped, sorted). */
export function listRoles(): string[] {
  const set = new Set<string>();
  let files: string[] = [];
  try { files = readdirSync(FLEET_DIR).filter((f) => f.endsWith('.json')); } catch { return []; }
  for (const f of files) {
    try {
      const j = JSON.parse(readFileSync(join(FLEET_DIR, f), 'utf8'));
      for (const w of (j?.windows ?? []) as Array<{ name?: string }>) {
        if (w?.name) set.add(w.name.replace(/-oracle$/, ''));
      }
    } catch { /* skip malformed */ }
  }
  return [...set].sort();
}

/** Spawn `role` on worktree `slug` via `maw wake`. An optional `planId` pins the
 *  agent to a specific Claude account by injecting its web-auth token
 *  (CLAUDE_CODE_OAUTH_TOKEN) — keeping the default config dir so MCP/hooks/skills
 *  stay intact. Needs the maw `--env` flag (maw PR feat/wake-env). Returns maw's output. */
export function spawnAgent(role: string, slug: string, planId?: string): string {
  if (!listRoles().includes(role)) throw new Error(`unknown role: ${role}`);
  if (!SLUG_RE.test(slug)) throw new Error('slug must be alphanumeric/dash, ≤31 chars');
  const args = ['wake', role, '--wt', slug, '--fresh'];
  if (planId) {
    const plan = planById(planId);
    if (!plan) throw new Error(`unknown plan: ${planId}`);
    if (!planIsPassthrough(plan)) {            // a pinned account → inject its web-auth token
      if (!mawSupportsEnv()) throw new Error('account-pinning needs the maw --env flag (PR feat/wake-env) — not in the running maw yet; merge it + resync the maw primary, or spawn on the default account');
      const token = planAccessToken(plan);
      if (!token) throw new Error(`no web-auth token for plan "${plan.name}" (open that account once to refresh)`);
      args.push('--env', `CLAUDE_CODE_OAUTH_TOKEN=${token}`);
    }
  }
  return execFileSync(MAW, args, {
    encoding: 'utf8', timeout: 120_000, maxBuffer: 4_000_000,
    env: { ...process.env, PATH: `${TOOL_PATH}:${process.env.PATH || ''}` },
  });
}
