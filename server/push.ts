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

const DIR = join(homedir(), '.fleet-town');
const VAPID_FILE = join(DIR, 'vapid.json');
const SUBS_FILE = join(DIR, 'push-subs.json');

interface Prefs { teamIdle: boolean; waiting: boolean; teamsOff: string[] }
interface Sub { endpoint: string; sub: webpush.PushSubscription; prefs: Prefs }
const DEFAULT_PREFS: Prefs = { teamIdle: true, waiting: true, teamsOff: [] };

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

async function send(s: Sub, payload: object) {
  try {
    await webpush.sendNotification(s.sub, JSON.stringify(payload));
  } catch (e: unknown) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) remove(s.endpoint); // subscription dead → drop it
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
    if (s) await send(s, { title: 'Fleet Town', body: 'Notifications are on ✅', tag: 'test' });
    return Response.json({ ok: !!s });
  }
  return null;
}

// ---- detection loop ----
type Agent = { id: string; status: string; waiting?: boolean; team?: string | null; role?: string; label?: string };
type State = { agents: Agent[] };

let prevIdleTeams = new Set<string>();
let prevWaiting = new Set<string>();

function idleTeams(agents: Agent[]): Map<string, true> {
  const groups = new Map<string, Agent[]>();
  for (const a of agents) {
    if (!a.team) continue;
    let arr = groups.get(a.team);
    if (!arr) { arr = []; groups.set(a.team, arr); }
    arr.push(a);
  }
  const out = new Map<string, true>();
  for (const [team, members] of groups) {
    if (members.length > 0 && members.every((m) => m.status === 'idle')) out.set(team, true);
  }
  return out;
}

async function tick(getState: () => Promise<State>) {
  let state: State;
  try { state = await getState(); } catch { return; }
  const agents = state.agents || [];

  const idle = idleTeams(agents);
  for (const team of idle.keys()) {
    if (prevIdleTeams.has(team)) continue;                       // already alerted
    for (const s of subs) if (s.prefs.teamIdle && !s.prefs.teamsOff.includes(team)) {
      void send(s, { title: '💤 Team idle', body: `${team} — every agent is asleep`, tag: `team-${team}`, renotify: true });
    }
  }
  prevIdleTeams = new Set(idle.keys());

  const waitingNow = new Set<string>();
  for (const a of agents) if (a.waiting) {
    waitingNow.add(a.id);
    if (prevWaiting.has(a.id)) continue;
    const who = `${a.role || 'agent'}${a.label && a.label !== 'oracle' ? '·' + a.label : ''}`;
    for (const s of subs) if (s.prefs.waiting) {
      void send(s, { title: '🔔 Needs your input', body: `${who} is waiting at a menu`, tag: `wait-${a.id}`, url: '/town', sticky: true });
    }
  }
  prevWaiting = waitingNow;
}

export function startNotifyLoop(getState: () => Promise<State>, ms = 8000) {
  setInterval(() => void tick(getState), ms);
}
