// Per-account subscription quota: how much of each limit window is LEFT (5-hour
// session + 7-day weekly + weekly Opus), from the same OAuth usage endpoint the
// CLI /usage uses. Bars show remaining; reset times shown alongside.
import { useEffect, useState } from 'react';

interface QuotaWin { used: number; resetsAt: string }
interface Quota { fiveHour?: QuotaWin; sevenDay?: QuotaWin; sevenDayOpus?: QuotaWin; error?: string }
interface Account {
  name: string;
  auth: { loggedIn?: boolean; authMethod?: string; apiProvider?: string; email?: string; subscriptionType?: string; error?: string };
  plans: string[];
  quota: Quota;
}

// Web/subscription auth (NOT api key). 'claude.ai' = browser login, 'oauth_token'
// = setup-token; both firstParty subscription. 'apiKey'/thirdParty fail.
const isWeb = (a: Account['auth']) =>
  !!a.loggedIn && a.apiProvider !== 'thirdParty' && (a.authMethod === 'claude.ai' || a.authMethod === 'oauth_token');

function resetIn(iso: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!isFinite(ms) || ms <= 0) return 'now';
  const h = Math.floor(ms / 3600e3), m = Math.round((ms % 3600e3) / 60e3);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h >= 1 ? `${h}h ${m}m` : `${m}m`;
}

function Bar({ label, w }: { label: string; w?: QuotaWin }) {
  if (!w) return null;
  const left = Math.max(0, Math.min(100, 100 - w.used));
  const col = left > 50 ? '#4ade80' : left > 20 ? '#fbbf24' : '#f87171';
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="font-mono" style={{ color: col }}>{Math.round(left)}% left</span>
      </div>
      <div className="h-2 rounded mt-1 overflow-hidden" style={{ background: '#ffffff14' }}>
        <div style={{ width: `${left}%`, height: '100%', background: col }} />
      </div>
      <div className="text-[10px] text-white/35 mt-0.5">used {Math.round(w.used)}% · resets in {resetIn(w.resetsAt)}</div>
    </div>
  );
}

export function UsagePanel({ onClose }: { onClose: () => void }) {
  const [accts, setAccts] = useState<Account[] | null>(null);
  useEffect(() => { fetch('/__fleet/usage').then((r) => r.json()).then(setAccts).catch(() => setAccts([])); }, []);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-[min(520px,94vw)] max-h-[88vh] overflow-auto rounded-xl border border-white/15 bg-[#0c0c12] p-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-[14px] text-white/90">📊 Account quota</span>
          <button onClick={onClose} className="text-white/50 hover:text-white/90 text-sm">✕</button>
        </div>
        <p className="text-[11px] text-white/40 mb-3">Subscription limits remaining per account (the same data as the CLI <code className="text-sky-300">/usage</code>).</p>
        {!accts && <p className="text-[12px] text-white/40 py-6 text-center">loading…</p>}
        {accts && !accts.length && <p className="text-[12px] text-white/40 py-6 text-center">no accounts</p>}
        <div className="flex flex-col gap-3">
          {(accts || []).map((a, i) => {
            const web = isWeb(a.auth);
            const q = a.quota || {};
            return (
              <div key={a.auth.email || a.name || i} className="rounded-lg border border-white/10 p-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[12px] text-white/90 font-mono">{a.auth.email || a.name}</span>
                  {a.auth.subscriptionType && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#a78bfa22', color: '#c4b5fd', border: '1px solid #a78bfa55' }}>
                      {a.auth.subscriptionType.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto"
                    style={web ? { background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8055' }
                      : { background: '#f8717122', color: '#fca5a5', border: '1px solid #f8717155' }}>
                    {web ? (a.auth.authMethod === 'oauth_token' ? '🌐 web (token)' : '🌐 web (subscription)')
                      : a.auth.loggedIn ? `⚠ ${a.auth.authMethod || 'non-web'}` : '✗ not logged in'}
                  </span>
                </div>
                <p className="text-[10px] text-white/40 mt-0.5">plans: {a.plans.join(', ')}</p>
                {a.auth.error && <p className="text-[10px] text-red-300 mt-1">{a.auth.error}</p>}
                {q.error && <p className="text-[10px] text-amber-300/80 mt-1">quota: {q.error}</p>}
                {!q.error && !q.fiveHour && !q.sevenDay && <p className="text-[10px] text-white/40 mt-1">no quota data</p>}
                <Bar label="Session (5h)" w={q.fiveHour} />
                <Bar label="Weekly (all models)" w={q.sevenDay} />
                <Bar label="Weekly (Opus)" w={q.sevenDayOpus} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
