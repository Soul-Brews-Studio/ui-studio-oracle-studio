// Detect which Claude account a pane's agent runs on, for the town badge.
// maw injects `CLAUDE_CODE_OAUTH_TOKEN=<oat> claude …` (account-pinned spawns), so
// the claude process carries that token in its environment. We read it from
// /proc, match it to a plan, and cache per pane (the token is fixed for the
// process's life). No token in the env → the default logged-in account (no badge).
import { readFileSync, existsSync } from 'node:fs';
import { loadPlans, planAccessToken } from './usage';

// paneId → resolved plan label (or '' for default). Cleared when the pane's pid changes.
const cache = new Map<string, { pid: number; label: string }>();

// Find the `claude` process under a pane's shell pid (BFS, depth-limited).
function claudePid(rootPid: number): number | null {
  const seen = new Set<number>();
  let frontier = [rootPid];
  for (let depth = 0; depth < 4 && frontier.length; depth++) {
    const next: number[] = [];
    for (const pid of frontier) {
      if (seen.has(pid)) continue;
      seen.add(pid);
      try {
        const comm = readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
        if (comm === 'claude') return pid;
      } catch { continue; }
      try {
        const kids = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim();
        if (kids) for (const k of kids.split(/\s+/)) next.push(Number(k));
      } catch { /* no children file */ }
    }
    frontier = next;
  }
  return null;
}

function envToken(pid: number): string | null {
  try {
    const raw = readFileSync(`/proc/${pid}/environ`, 'utf8'); // NUL-separated KEY=VAL
    for (const kv of raw.split('\0')) {
      if (kv.startsWith('CLAUDE_CODE_OAUTH_TOKEN=')) return kv.slice('CLAUDE_CODE_OAUTH_TOKEN='.length);
    }
  } catch { /* unreadable */ }
  return null;
}

// Match an env token to a plan name (exact, against current plan tokens).
function planForToken(token: string): string {
  for (const p of loadPlans()) {
    if (planAccessToken(p) === token) return p.name;
  }
  return 'pinned'; // a pinned account whose token has since rotated — name unknown
}

/** Plan label for a pane (cached). '' = default logged-in account (no badge). */
export function planForPane(paneId: string, panePid: number): string {
  if (!panePid || !existsSync(`/proc/${panePid}`)) return '';
  const hit = cache.get(paneId);
  if (hit && hit.pid === panePid) return hit.label;
  const cpid = claudePid(panePid);
  const token = cpid ? envToken(cpid) : null;
  const label = token ? planForToken(token) : '';
  cache.set(paneId, { pid: panePid, label });
  return label;
}

/** Drop cache entries for panes no longer present. */
export function prunePlanCache(livePaneIds: Set<string>): void {
  for (const id of [...cache.keys()]) if (!livePaneIds.has(id)) cache.delete(id);
}
