// Web Push for Fleet Town — installs a notification pipeline so a phone/desktop
// PWA gets pinged even when the page is backgrounded/closed.
//
// Two alerts (matching the UI toggles in Notifications.tsx):
//   1. a whole team goes idle (every member asleep) — per-team opt-out
//   2. an agent is waiting for input at a TUI menu (the 🔔 state)
//
// Edge-triggered: we remember the previous state and only push on the TRANSITION
// into a condition, so you get one ping per event, not one every poll.
import webpush from 'web-push';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { groupTown } from '../src/lib/town-group';
import type { FleetState } from '../src/lib/fleet';

const DIR = join(homedir(), '.fleet-town');
const VAPID_FILE = join(DIR, 'vapid.json');
const SUBS_FILE = join(DIR, 'push-subs.json');

interface Prefs { teamIdle: boolean; waiting: boolean; teamsOff: string[]; agentsOff: string[] }
interface Sub { endpoint: string; sub: webpush.PushSubscription; prefs: Prefs }
const DEFAULT_PREFS: Prefs = { teamIdle: true, waiting: true, teamsOff: [], agentsOff: [] };

function load<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}
function save(file: string, data: unknown) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

// VAPID keys: generate once, persist. Public key is shipped to the client.
let vapid = load<{ publicKey: string; privateKey: string } | null>(VAPID_FILE, null);
if (!vapid?.publicKey) { vapid = webpush.generateVAPIDKeys(); save(VAPID_FILE, vapid); }
webpush.setVapidDetails('mailto:admin@fleet.town', vapid.publicKey, vapid.privateKey);

let subs: Sub[] = load<Sub[]>(SUBS_FILE, []);
const persist = () => save(SUBS_FILE, subs);

function upsert(sub: webpush.PushSubscription, prefs?: Partial<Prefs>) {
  const existing = subs.find((s) => s.endpoint === sub.endpoint);
  if (existing) existing.prefs = { ...existing.prefs, ...prefs };
  else subs.push({ endpoint: sub.endpoint, sub, prefs: { ...DEFAULT_PREFS, ...prefs } });
  persist();
}
function setPrefs(endpoint: string, prefs: Partial<Prefs>) {
  const s = subs.find((x) => x.endpoint === endpoint);
  if (s) { s.prefs = { ...s.prefs, ...prefs }; persist(); }
}
function remove(endpoint: string) { subs = subs.filter((s) => s.endpoint !== endpoint); persist(); }

async function send(s: Sub, payload: object): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  try {
    const res = await webpush.sendNotification(s.sub, JSON.stringify(payload));
    return { ok: true, statusCode: res.statusCode };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    if (err.statusCode === 404 || err.statusCode === 410) remove(s.endpoint); // dead → drop
    console.error('[push] send failed', err.statusCode, err.body || err.message);
    return { ok: false, statusCode: err.statusCode, error: err.body || err.message };
  }
}

// ---- HTTP: handle /__fleet/push/* (returns null for non-push paths) ----
export async function handlePush(req: Request, p: string): Promise<Response | null> {
  if (p === '/__fleet/push/vapid') return Response.json({ publicKey: vapid!.publicKey });
  if (p === '/__fleet/push/subscribe' && req.method === 'POST') {
    const b = (await req.json()) as { subscription: webpush.PushSubscription; prefs?: Partial<Prefs> };
    upsert(b.subscription, b.prefs);
    return Response.json({ ok: true });
  }
  if (p === '/__fleet/push/prefs' && req.method === 'POST') {
    const b = (await req.json()) as { endpoint: string; prefs: Partial<Prefs> };
    setPrefs(b.endpoint, b.prefs);
    return Response.json({ ok: true });
  }
  if (p === '/__fleet/push/unsubscribe' && req.method === 'POST') {
    const b = (await req.json()) as { endpoint: string };
    remove(b.endpoint);
    return Response.json({ ok: true });
  }
  if (p === '/__fleet/push/test' && req.method === 'POST') {
    const b = (await req.json()) as { endpoint: string };
    const s = subs.find((x) => x.endpoint === b.endpoint);
    if (!s) return Response.json({ ok: false, error: 'no subscription stored on server — re-enable' });
    const r = await send(s, { title: 'Fleet Town', body: 'Notifications are on ✅', tag: 'test', sticky: true });
    return Response.json(r);
  }
  return null;
}

// ---- detection loop ----
let prevIdleTeams = new Set<string>();
let prevWaiting = new Set<string>();

const named = (a: { role?: string; label?: string }) =>
  `${a.role || 'orchestrator'}${a.label && a.label !== 'oracle' ? '·' + a.label : ''}`;

// Campaign/team clusters (per town-group) that are FULLY idle. A "team" is the
// orchestrator-led cluster — keyed by cluster key and named by its orchestrator,
// NOT a bare maw-team name (owner: the team == the orchestrator that leads it).
function idleClusters(state: FleetState): Map<string, { name: string; members: string[] }> {
  const out = new Map<string, { name: string; members: string[] }>();
  for (const d of groupTown(state)) {
    for (const c of d.clusters) {
      if (c.kind === 'commons') continue;
      const all = c.lead ? [c.lead, ...c.members] : c.members;
      if (all.length > 0 && all.every((m) => m.status === 'idle')) {
        out.set(c.key, { name: c.lead ? named(c.lead) : c.label, members: all.map(named) });
      }
    }
  }
  return out;
}

async function tick(getState: () => Promise<FleetState>) {
  let state: FleetState;
  try { state = await getState(); } catch { return; }

  const idle = idleClusters(state);
  for (const [key, info] of idle) {
    if (prevIdleTeams.has(key)) continue;                        // already alerted
    const shown = info.members.slice(0, 4).join(', ');
    const more = info.members.length > 4 ? `, +${info.members.length - 4} more` : '';
    for (const s of subs) if (s.prefs.teamIdle && !s.prefs.teamsOff.includes(key)) {
      void send(s, { title: `💤 ${info.name} — whole team idle`, body: `All asleep: ${shown}${more}`, tag: `team-${key}`, renotify: true });
    }
  }
  prevIdleTeams = new Set(idle.keys());

  const waitingNow = new Set<string>();
  for (const a of state.agents) if (a.waiting) {
    waitingNow.add(a.id);
    if (prevWaiting.has(a.id)) continue;
    for (const s of subs) if (s.prefs.waiting && !(s.prefs.agentsOff || []).includes(a.id)) {
      void send(s, { title: `🔔 ${named(a)} needs input`, body: 'Waiting at a TUI menu — tap to answer', tag: `wait-${a.id}`, url: '/town', sticky: true });
    }
  }
  prevWaiting = waitingNow;
}

export function startNotifyLoop(getState: () => Promise<FleetState>, ms = 8000) {
  setInterval(() => void tick(getState), ms);
}
