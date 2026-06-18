// Push-notification controls for Fleet Town. Lets you install the PWA's push
// subscription and toggle two alerts — whole-team-idle (per team) and an agent
// waiting for input — delivered by the fleet-server even when the app is closed.
import { useEffect, useState } from 'react';

interface Prefs { teamIdle: boolean; waiting: boolean; teamsOff: string[] }
const DEFAULT: Prefs = { teamIdle: true, waiting: true, teamsOff: [] };
const LS = 'fleet-notif-prefs';

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

function b64ToU8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const loadPrefs = (): Prefs => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch { return DEFAULT; } };
const post = (path: string, body: object) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export function Notifications({ teams }: { teams: string[] }) {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [busy, setBusy] = useState(false);

  // Reflect an already-installed subscription on load.
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
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await post('/__fleet/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setEndpoint(null);
    } catch (e) { console.error('push disable failed', e); }
    finally { setBusy(false); }
  }

  const on = !!endpoint && perm === 'granted';
  const toggleTeam = (t: string) => {
    const off = prefs.teamsOff.includes(t) ? prefs.teamsOff.filter((x) => x !== t) : [...prefs.teamsOff, t];
    syncPrefs({ ...prefs, teamsOff: off });
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="px-2.5 py-1 rounded-full text-[11px]"
        style={{ background: on ? '#38bdf822' : 'transparent', color: on ? '#7dd3fc' : '#888', border: '1px solid rgba(255,255,255,0.1)' }}
        title="Notifications">🔔{on ? '' : '·'}</button>

      {open && (
        <div className="absolute right-0 mt-1 z-50 w-64 rounded-xl border border-white/10 bg-[#10141a] p-3 text-[12px] text-white/80 shadow-2xl">
          {!supported && <p className="text-white/50">Push not supported in this browser.</p>}
          {supported && !on && (
            <>
              <p className="mb-2 text-white/60">Get pinged when a team goes idle or an agent needs you — works on desktop &amp; installed-PWA mobile.</p>
              <button onClick={enable} disabled={busy}
                className="w-full rounded-lg py-1.5 text-[12px] font-semibold"
                style={{ background: '#38bdf833', color: '#7dd3fc', border: '1px solid #38bdf855' }}>
                {busy ? 'enabling…' : perm === 'denied' ? 'Notifications blocked — allow in browser' : 'Enable notifications'}
              </button>
            </>
          )}
          {supported && on && (
            <>
              <Row label="💤 Team-idle alerts" checked={prefs.teamIdle} onChange={(v) => syncPrefs({ ...prefs, teamIdle: v })} />
              <Row label="🔔 Needs-input alerts" checked={prefs.waiting} onChange={(v) => syncPrefs({ ...prefs, waiting: v })} />
              {prefs.teamIdle && teams.length > 0 && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">Per-team idle alerts</p>
                  <div className="max-h-40 overflow-auto">
                    {teams.map((t) => (
                      <Row key={t} label={t} small checked={!prefs.teamsOff.includes(t)} onChange={() => toggleTeam(t)} />
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2 flex gap-2 border-t border-white/10 pt-2">
                <button onClick={() => endpoint && post('/__fleet/push/test', { endpoint })}
                  className="flex-1 rounded-lg py-1 text-[11px]" style={{ background: '#ffffff10', color: '#bbb' }}>Send test</button>
                <button onClick={disable} disabled={busy}
                  className="flex-1 rounded-lg py-1 text-[11px]" style={{ background: '#f8717118', color: '#fca5a5' }}>Turn off</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, checked, onChange, small }: { label: string; checked: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-2 ${small ? 'py-0.5' : 'py-1'} cursor-pointer`}>
      <span className={small ? 'text-[11px] text-white/70 truncate' : 'text-white/85'}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-sky-400" />
    </label>
  );
}
