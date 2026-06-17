// Conversation history for the agent chat. A Claude TUI uses the alternate screen,
// so `tmux capture-pane` only ever yields the current screen (~no scrollback). The
// real history lives in the session transcript (~/.claude/projects/<enc>/*.jsonl);
// this reads that and renders the user/assistant turns as scrollable text.
import { execFileSync } from 'node:child_process';
import { statSync, openSync, readSync, closeSync } from 'node:fs';
import { newestJsonl } from './context';

const PANE_RE = /^%\d+$/;

function paneCwd(id: string): string {
  if (!PANE_RE.test(id)) throw new Error('bad pane id');
  return execFileSync('tmux', ['display-message', '-p', '-t', id, '#{pane_current_path}'], { encoding: 'utf8' }).trim();
}

// Tail the last ~2MB so very long transcripts stay cheap to parse.
function tailLines(path: string, bytes = 2_000_000): string[] {
  const size = statSync(path).size;
  const start = Math.max(0, size - bytes);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, 'r');
  try { readSync(fd, buf, 0, buf.length, start); } finally { closeSync(fd); }
  let text = buf.toString('utf8');
  if (start > 0) { const nl = text.indexOf('\n'); if (nl >= 0) text = text.slice(nl + 1); }
  return text.split('\n').filter(Boolean);
}

type Block = { type?: string; text?: string; name?: string; content?: unknown };

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const out: string[] = [];
  for (const b of content as Block[]) {
    if (b?.type === 'text' && b.text) out.push(b.text);
    else if (b?.type === 'tool_use') out.push(`⚙️ [tool: ${b.name}]`);
    else if (b?.type === 'tool_result') {
      const c = b.content;
      const t = typeof c === 'string' ? c : Array.isArray(c) ? (c as Block[]).map((x) => x?.text || '').join('') : '';
      out.push(`↩︎ [tool result] ${t.slice(0, 300)}`);
    }
  }
  return out.join('\n');
}

/** Rendered conversation history (last `maxMsgs` turns) for the pane's session. */
export function transcriptFor(id: string, maxMsgs = 300): string {
  const path = newestJsonl(paneCwd(id));
  if (!path) return '(no transcript found for this agent)';
  const msgs: string[] = [];
  for (const line of tailLines(path)) {
    let j: { type?: string; message?: { role?: string; model?: string; content?: unknown } };
    try { j = JSON.parse(line); } catch { continue; }
    if (j?.type !== 'user' && j?.type !== 'assistant') continue;
    const txt = textOf(j?.message?.content).trim();
    if (!txt) continue;
    const who = j.type === 'user' ? '🧑 user' : `🤖 ${j.message?.model?.includes('opus') ? 'opus' : 'assistant'}`;
    msgs.push(`\n──────── ${who} ────────\n${txt}`);
  }
  return msgs.slice(-maxMsgs).join('\n') || '(transcript empty)';
}
