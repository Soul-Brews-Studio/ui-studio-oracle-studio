// Push-notification controls for Fleet Town. Installs the PWA push subscription
// and toggles two alerts, delivered by the fleet-server even when the app is
// closed: whole-team-idle (per team) and an agent waiting for input (per agent).
import { useEffect, useState } from 'react';

interface Prefs { teamIdle: boolean; waiting: boolean; teamsOff: string[]; agentsOff: string[] }
const DEFAULT: Prefs = { teamIdle: true, waiting: true, teamsOff: [], agentsOff: [] };
const LS = 'fleet-notif-prefs';

const hasWin = typeof window !== 'undefined';
const swOK = hasWin && 'serviceWorker' in navigator;
const pmOK = hasWin && 'PushManager' in window;
const supported = swOK && pmOK;
const isIOS = hasWin && /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => hasWin && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

function b64ToU8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const loadPrefs = (): Prefs => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return DEFAULT; } };
const post = (path: string, body: object) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export function Notifications({ teams, agents }: { teams: { key: string; name: string }[]; agents: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (sub) setEndpoint(sub.endpoint); }).catch(() => {});
  }, []);

  const syncPrefs = (next: Prefs) => {
    setPrefs(next);
    localStorage.setItem(LS, JSON.stringify(next));
    if (endpoint) void post('/__fleet/push/prefs', { endpoint, prefs: next });
  };
  const toggleIn = (list: 'teamsOff' | 'agentsOff', key: string) => {
    const cur = prefs[list];
    const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
    syncPrefs({ ...prefs, [list]: next });
  };

  async function enable() {
    if (!supported) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setPerm(permission);
      if (permission !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch('/__fleet/push/vapid').then((r) => r.json());
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
      await post('/__fleet/push/subscribe', { subscription: sub.toJSON(), prefs });
      setEndpoint(sub.endpoint);
    } catch (e) { console.error('push enable failed', e); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await post('/__fleet/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setEndpoint(null);
    } catch (e) { console.error('push disable failed', e); }
    finally { setBusy(false); }
  }
  async function sendTest() {
    if (!endpoint) return;
    setTestMsg('sending…');
    try {
      const r = await post('/__fleet/push/test', { endpoint }).then((x) => x.json());
      setTestMsg(r.ok ? `server sent ✓ (FCM ${r.statusCode}) — no popup? check OS / browser notification settings` : `error: ${r.statusCode || ''} ${r.error || ''}`);
    } catch { setTestMsg('request failed'); }
  }

  const on = !!endpoint && perm === 'granted';
  // Mobile-safe: fixed to the viewport so it never overflows off-screen on iOS.
  const panel: React.CSSProperties = {
    position: 'fixed', top: 52, right: 8, zIndex: 60,
    width: 'min(320px, calc(100vw - 16px))', maxHeight: 'calc(100vh - 72px)', overflowY: 'auto',
  };

  return (
    <div className="inline-block">
      <button onClick={() => setOpen((o) => !o)} className="px-2.5 py-1 rounded-full text-[11px]"
        style={{ background: on ? '#38bdf822' : 'transparent', color: on ? '#7dd3fc' : '#888', border: '1px solid rgba(255,255,255,0.1)' }}
        title="Notifications">🔔{on ? '' : '·'}</button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
          <div style={panel} className="rounded-xl border border-white/10 bg-[#10141a] p-3 text-[12px] text-white/80 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white/90">Notifications</span>
              <button onClick={() => setOpen(false)} className="text-white/40 text-[14px] leading-none px-1">✕</button>
            </div>

            {!supported && (
              <div className="space-y-1 text-white/70">
                <p>Push isn't available in this view.</p>
                <ul className="text-[11px] text-white/55">
                  <li>Service Worker: {swOK ? '✓' : '✗'}</li>
                  <li>Push API: {pmOK ? '✓' : '✗'}</li>
                  <li>Installed standalone: {standalone() ? '✓' : '✗'}</li>
                </ul>
                {isIOS && !standalone() && <p className="text-[11px] text-amber-300/80">iPhone/iPad: open in <b>Safari</b> → Share → <b>Add to Home Screen</b>, then launch from that icon (Safari only; needs iOS 16.4+).</p>}
                {isIOS && standalone() && !pmOK && <p className="text-[11px] text-amber-300/80">Looks like iOS &lt; 16.4 — Web Push needs iOS/iPadOS 16.4+.</p>}
              </div>
            )}

            {supported && !on && (
              <>
                <p className="mb-2 text-white/60">Get pinged when a team goes idle or an agent needs you — works on desktop &amp; installed-PWA mobile.</p>
                <button onClick={enable} disabled={busy} className="w-full rounded-lg py-1.5 text-[12px] font-semibold"
                  style={{ background: '#38bdf833', color: '#7dd3fc', border: '1px solid #38bdf855' }}>
                  {busy ? 'enabling…' : perm === 'denied' ? 'Notifications blocked — allow in browser' : 'Enable notifications'}
                </button>
              </>
            )}

            {supported && on && (
              <>
                <Section title="💤 Team idle" master={prefs.teamIdle} onMaster={(v) => syncPrefs({ ...prefs, teamIdle: v })}
                  items={teams} off={prefs.teamsOff} onToggle={(k) => toggleIn('teamsOff', k)} empty="no active teams" />
                <Section title="🔔 Needs input" master={prefs.waiting} onMaster={(v) => syncPrefs({ ...prefs, waiting: v })}
                  items={agents} off={prefs.agentsOff} onToggle={(k) => toggleIn('agentsOff', k)} empty="no agents" />
                <div className="mt-2 flex gap-2 border-t border-white/10 pt-2">
                  <button onClick={sendTest} className="flex-1 rounded-lg py-1 text-[11px]" style={{ background: '#ffffff10', color: '#bbb' }}>Send test</button>
                  <button onClick={disable} disabled={busy} className="flex-1 rounded-lg py-1 text-[11px]" style={{ background: '#f8717118', color: '#fca5a5' }}>Turn off</button>
                </div>
                {testMsg && <p className="mt-1 text-[10px] text-white/50 leading-snug">{testMsg}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// A toggle group: a master on/off plus a scrollable per-item opt-out list.
function Section({ title, master, onMaster, items, off, onToggle, empty }: {
  title: string; master: boolean; onMaster: (v: boolean) => void;
  items: { key?: string; id?: string; name: string }[]; off: string[]; onToggle: (key: string) => void; empty: string;
}) {
  return (
    <div className="mt-2 border-t border-white/10 pt-2">
      <Row label={title} bold checked={master} onChange={onMaster} />
      {master && (
        <div className="mt-1 max-h-36 overflow-auto pl-1">
          {items.length === 0 && <p className="text-[11px] text-white/35">{empty}</p>}
          {items.map((it) => {
            const k = (it.key ?? it.id) as string;
            return <Row key={k} label={it.name} small checked={!off.includes(k)} onChange={() => onToggle(k)} />;
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, checked, onChange, small, bold }: { label: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean; bold?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-2 ${small ? 'py-0.5' : 'py-1'} cursor-pointer`}>
      <span className={small ? 'text-[11px] text-white/70 truncate' : bold ? 'text-white/90 font-medium' : 'text-white/85'}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-sky-400 shrink-0" />
    </label>
  );
}
