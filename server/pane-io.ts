// Read/write a tmux pane for the agent chat window. Pane ids are validated to the
// `%NN` form and all tmux calls use execFile (no shell) so neither a pane id nor
// user text can inject options or commands.
import { execFileSync } from 'node:child_process';

const PANE_RE = /^%\d+$/;
export const validPane = (id: string) => PANE_RE.test(id || '');

/** Snapshot the pane's rendered text (last `lines` rows incl. some scrollback). */
export function capturePane(id: string, lines = 220): string {
  if (!validPane(id)) throw new Error('bad pane id');
  return execFileSync('tmux', ['capture-pane', '-p', '-t', id, '-S', `-${lines}`], {
    encoding: 'utf8', maxBuffer: 8_000_000,
  });
}

/** Type literal text into the pane, then submit with Enter. */
export function sendToPane(id: string, text: string): void {
  if (!validPane(id)) throw new Error('bad pane id');
  const t = (text ?? '').replace(/\r?\n/g, ' ').slice(0, 4000);
  execFileSync('tmux', ['send-keys', '-t', id, '-l', '--', t]); // -l literal, -- ends opts
  execFileSync('tmux', ['send-keys', '-t', id, 'Enter']);
}
