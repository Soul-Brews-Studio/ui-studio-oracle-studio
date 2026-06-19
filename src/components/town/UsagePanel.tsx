// Per-account usage view: each auth plan's identity (email, plan tier, web-auth
// confirmation) + token usage over rolling windows (last 5h / today / 7d).
import { useEffect, useState } from 'react';

interface Win { in: number; out: number; cache: number; msgs: number }
interface Account {
  id: string; name: string;
  auth: { loggedIn?: boolean; authMethod?: string; apiProvider?: string; email?: string; subscriptionType?: string; error?: string };
  usage: { h5: Win; d1: Win; d7: Win };
  sharedUsage?: boolean;
}

// Web/subscription auth (NOT an API key). Browser login = 'claude.ai' (carries
// email/tier); a `claude setup-token` token = 'oauth_token' (no profile, still
// firstParty subscription). An API key would be 'apiKey' → not web.
const isWeb = (a: Account['auth']) =>
  !!a.loggedIn && a.apiProvider !== 'thirdParty' && (a.authMethod === 'claude.ai' || a.authMethod === 'oauth_token');

const fmt = (n: number): string =>
  n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);

function Windows({ u }: { u: Account['usage'] }) {
  const rows: Array<[string, Win]> = [['last 5h', u.h5], ['today', u.d1], ['7 days', u.d7]];
  return (
    <table className="w-full mt-2 text-[11px]">
      <thead><tr className="text-white/40">
        <th className="text-left font-normal">window</th><th className="text-right font-normal">msgs</th>
        <th className="text-right font-normal">out</th><th className="text-right font-normal">in</th><th className="text-right font-normal">cache</th>
      </tr></thead>
      <tbody>
        {rows.map(([label, w]) => (
          <tr key={label} className="text-white/80">
            <td className="text-white/55">{label}</td>
            <td className="text-right font-mono">{fmt(w.msgs)}</td>
            <td className="text-right font-mono text-sky-300">{fmt(w.out)}</td>
            <td className="text-right font-mono">{fmt(w.in)}</td>
            <td className="text-right font-mono text-white/45">{fmt(w.cache)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function UsagePanel({ onClose }: { onClose: () => void }) {
  const [accts, setAccts] = useState<Account[] | null>(null);
  useEffect(() => { fetch('/__fleet/usage').then((r) => r.json()).then(setAccts).catch(() => setAccts([])); }, []);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-[min(560px,94vw)] max-h-[88vh] overflow-auto rounded-xl border border-white/15 bg-[#0c0c12] p-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-[14px] text-white/90">📊 Account usage</span>
          <button onClick={onClose} className="text-white/50 hover:text-white/90 text-sm">✕</button>
        </div>
        <p className="text-[11px] text-white/40 mb-3">Token usage per plan (subscription %-left isn’t exposed by the CLI — this is consumption per window).</p>
        {!accts && <p className="text-[12px] text-white/40 py-6 text-center">loading…</p>}
        {accts && !accts.length && <p className="text-[12px] text-white/40 py-6 text-center">no accounts</p>}
        <div className="flex flex-col gap-3">
          {(accts || []).map((a) => {
            const web = isWeb(a.auth);
            return (
              <div key={a.id} className="rounded-lg border border-white/10 p-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[12px] text-white/90">{a.name}</span>
                  {a.auth.email && <span className="text-[11px] text-white/50 font-mono">{a.auth.email}</span>}
                  {a.auth.subscriptionType && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#a78bfa22', color: '#c4b5fd', border: '1px solid #a78bfa55' }}>
                      {a.auth.subscriptionType.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto"
                    style={web ? { background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8055' }
                      : { background: '#f8717122', color: '#fca5a5', border: '1px solid #f8717155' }}>
                    {web
                      ? (a.auth.authMethod === 'oauth_token' ? '🌐 web (token)' : '🌐 web (subscription)')
                      : a.auth.loggedIn ? `⚠ ${a.auth.authMethod || 'non-web'}` : '✗ not logged in'}
                  </span>
                </div>
                {a.auth.error && <p className="text-[10px] text-red-300 mt-1">{a.auth.error}</p>}
                {a.sharedUsage && <p className="text-[10px] text-amber-300/70 mt-1">⚠ token plan shares the default transcript dir — usage below isn’t isolated to this account</p>}
                <Windows u={a.usage} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
