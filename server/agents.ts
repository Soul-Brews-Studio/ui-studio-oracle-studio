// Spawn a new agent (brewbot /new). Roles come from the maw fleet configs
// (window name minus the -oracle suffix); spawning runs `maw wake <role> --wt
// <slug> --fresh`, which maw turns into a fresh worktree + tmux pane + booted CLI.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();
const MAW = join(HOME, '.bun/bin/maw');
const FLEET_DIR = join(HOME, '.config/maw/fleet');
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/i;
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

/** Spawn `role` on worktree `slug` via `maw wake`. Returns maw's output. */
export function spawnAgent(role: string, slug: string): string {
  if (!listRoles().includes(role)) throw new Error(`unknown role: ${role}`);
  if (!SLUG_RE.test(slug)) throw new Error('slug must be alphanumeric/dash, ≤31 chars');
  return execFileSync(MAW, ['wake', role, '--wt', slug, '--fresh'], {
    encoding: 'utf8', timeout: 120_000, maxBuffer: 4_000_000,
    env: { ...process.env, PATH: `${TOOL_PATH}:${process.env.PATH || ''}` },
  });
}
