// Chat message presets (templates) for the agent chat — stored in localStorage,
// shared across all agent windows. A preset's text may contain a literal
// "<prompt>" marker: applying it drops the marker and parks the caret there so
// you finish typing from that spot.
export interface ChatPreset { id: string; name: string; text: string }

const LS = 'town:chat-presets';
export const PROMPT_MARK = '<prompt>';

export const DEFAULT_PRESETS: ChatPreset[] = [
  { id: 'status', name: 'Status?', text: 'What are you working on right now, and are you blocked on anything?' },
  { id: 'summarize', name: 'Summarize', text: 'Give me a 3-bullet summary of <prompt>' },
  { id: 'gist', name: 'Gist it', text: 'Save your last full response as a GitHub gist (gh gist create, secret) and reply with ONLY the url.' },
  { id: 'continue', name: 'Continue', text: 'continue' },
];

export function loadPresets(): ChatPreset[] {
  try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); return Array.isArray(v) ? v : DEFAULT_PRESETS; }
  catch { return DEFAULT_PRESETS; }
}
export function savePresets(list: ChatPreset[]): void {
  try { localStorage.setItem(LS, JSON.stringify(list)); } catch { /* ignore */ }
}
export const newId = (): string => 'p' + Math.random().toString(36).slice(2, 9);
