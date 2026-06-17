// Per-agent context-window usage, mirroring brewbot's /ctx.
// For a pane's cwd → newest Claude transcript in ~/.claude/projects/<encoded>/ →
// the last assistant message's loaded tokens (input + cache_creation + cache_read)
// vs the model's window. Returns REMAINING percent (0–100).
import { readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROJECTS = join(homedir(), '.claude/projects');
// Claude Code names project dirs by replacing '/' and '.' with '-' (encode_cwd).
const encode = (cwd: string) => cwd.replace(/[/.]/g, '-');

export interface CtxResult { pct: number; tokens: number; ctxMax: number; model: string }
const cache = new Map<string, { mtimeMs: number; res: CtxResult | null }>();

function newestJsonl(cwd: string): string | null {
  const dir = join(PROJECTS, encode(cwd));
  let best: { path: string; m: number } | null = null;
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const p = join(dir, f);
      const m = statSync(p).mtimeMs;
      if (!best || m > best.m) best = { path: p, m };
    }
  } catch { return null; }
  return best?.path ?? null;
}

// Read only the tail — the last assistant-usage line sits near the end of the file.
function tailLines(path: string, bytes = 262144): string[] {
  const size = statSync(path).size;
  const start = Math.max(0, size - bytes);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, 'r');
  try { readSync(fd, buf, 0, buf.length, start); } finally { closeSync(fd); }
  let text = buf.toString('utf8');
  if (start > 0) { const nl = text.indexOf('\n'); if (nl >= 0) text = text.slice(nl + 1); }
  return text.split('\n').filter(Boolean);
}

function tierFor(model: string, tokens: number): number {
  let max = 200000;
  if (/\[1m\]|-1m/.test(model) || /claude-(opus-4-(6|7|8)|sonnet-4-)/.test(model)) max = 1000000;
  if (tokens > max) max = 1000000; // a session can't load past its real window → prove 1M
  return max;
}

/** Remaining-context % for the newest Claude session under `cwd`, or null. */
export function contextForCwd(cwd: string): CtxResult | null {
  if (!cwd) return null;
  const path = newestJsonl(cwd);
  if (!path) return null;
  const mtimeMs = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtimeMs === mtimeMs) return hit.res;

  let tokens = 0, model = '';
  try {
    const lines = tailLines(path);
    for (let i = lines.length - 1; i >= 0; i--) {
      let j: { type?: string; message?: { model?: string; usage?: Record<string, number> } };
      try { j = JSON.parse(lines[i]); } catch { continue; }
      const u = j?.type === 'assistant' ? j?.message?.usage : null;
      if (u && u.input_tokens != null) {
        tokens = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
        model = j.message?.model || '';
        break;
      }
    }
  } catch { /* unreadable */ }

  const res = tokens
    ? { pct: Math.max(0, 100 - Math.min(100, Math.round((tokens * 100) / tierFor(model, tokens)))), tokens, ctxMax: tierFor(model, tokens), model }
    : null;
  cache.set(path, { mtimeMs, res });
  return res;
}
