// Read/write a tmux pane for the agent chat window. Pane ids are validated to the
// `%NN` form and all tmux calls use execFile (no shell) so neither a pane id nor
// user text can inject options or commands.
import { execFileSync } from 'node:child_process';

const PANE_RE = /^%\d+$/;
export const validPane = (id: string) => PANE_RE.test(id || '');

/** Snapshot the pane's rendered text — `lines` rows of history (default deep). */
export function capturePane(id: string, lines = 3000): string {
  if (!validPane(id)) throw new Error('bad pane id');
  const n = Math.min(20000, Math.max(50, Math.floor(lines) || 3000));
  return execFileSync('tmux', ['capture-pane', '-p', '-t', id, '-S', `-${n}`], {
    encoding: 'utf8', maxBuffer: 16_000_000,
  });
}

/** Type literal text into the pane, then submit with Enter. */
export function sendToPane(id: string, text: string): void {
  if (!validPane(id)) throw new Error('bad pane id');
  const t = (text ?? '').replace(/\r?\n/g, ' ').slice(0, 4000);
  execFileSync('tmux', ['send-keys', '-t', id, '-l', '--', t]); // -l literal, -- ends opts
  execFileSync('tmux', ['send-keys', '-t', id, 'Enter']);
}

// Named keys for driving a stuck TUI menu (allowlist → tmux key names).
const KEYS: Record<string, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  enter: 'Enter', esc: 'Escape', tab: 'Tab', space: 'Space', backspace: 'BSpace',
};

/** Send a single named navigation key (no trailing Enter) — for TUI selection. */
export function sendKey(id: string, key: string): void {
  if (!validPane(id)) throw new Error('bad pane id');
  const k = KEYS[(key || '').toLowerCase()];
  if (!k) throw new Error('bad key');
  execFileSync('tmux', ['send-keys', '-t', id, k]);
}

/** Close the agent's session by killing its tmux pane (brewbot /close). */
export function closePane(id: string): void {
  if (!validPane(id)) throw new Error('bad pane id');
  execFileSync('tmux', ['kill-pane', '-t', id]);
}
