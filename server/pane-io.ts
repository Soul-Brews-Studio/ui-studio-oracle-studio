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

/** Send text to the pane, then submit with Enter. Multi-line messages go via a
 *  bracketed paste so newlines are INSERTED into the agent's input (the CLI treats
 *  it as a paste) instead of submitting each line; single-line keeps the proven
 *  literal path. */
export function sendToPane(id: string, text: string): void {
  if (!validPane(id)) throw new Error('bad pane id');
  const t = (text ?? '').slice(0, 8000);
  if (/\r?\n/.test(t)) {
    execFileSync('tmux', ['set-buffer', '-b', 'fleetmsg', '--', t]);
    execFileSync('tmux', ['paste-buffer', '-p', '-d', '-b', 'fleetmsg', '-t', id]); // -p bracketed, -d drop buffer
  } else {
    execFileSync('tmux', ['send-keys', '-t', id, '-l', '--', t]); // -l literal, -- ends opts
  }
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

// A live TUI selection menu (AskUserQuestion / numbered choices) blocking on a human
// answer — signalled by the CURSORED option (❯ on a numbered line, brewbot's
// CLAUDE_MENU_RE) or the full menu footer. Scanned ONLY in the bottom region (the
// active menu sits just above the input box); menu-like text in the conversation /
// scrollback above must NOT trip it — else a session merely *writing about* menus
// (e.g. this feature's own code) flags itself (the brewbot 2026-06-17 self-watch FP).
const MENU_RE = [/^[ \t]*❯[ \t]*\d+[.)]/m, /Enter to select[^\n]{0,40}(navigate|cancel)/i];

/** True when the pane is parked on a menu waiting for our input. Cheap (visible screen). */
export function paneNeedsInput(id: string): boolean {
  if (!validPane(id)) return false;
  try {
    const t = execFileSync('tmux', ['capture-pane', '-p', '-t', id], { encoding: 'utf8', maxBuffer: 2_000_000 });
    const bottom = t.split('\n').filter((l) => l.trim()).slice(-10).join('\n');
    return MENU_RE.some((re) => re.test(bottom));
  } catch { return false; }
}
