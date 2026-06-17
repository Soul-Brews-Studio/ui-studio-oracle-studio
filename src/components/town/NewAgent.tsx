// "New agent" form (brewbot /new): pick a role, enter a slug, spawn via
// `maw wake <role> --wt <slug> --fresh`. The agent appears on the map next poll.
import { useEffect, useState } from 'react';
import { fetchRoles, newAgent } from '../../lib/fleet';
import { costumeFor } from '../../lib/role-costume';

export function NewAgent({ onClose }: { onClose: () => void }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchRoles().then((r) => { setRoles(r); if (r[0]) setRole(r[0]); }).catch((e) => setErr((e as Error).message));
  }, []);

  const create = async () => {
    if (!role || !slug.trim() || busy) return;
    setBusy(true); setErr(null);
    try { await newAgent(role, slug.trim()); setDone(true); setTimeout(onClose, 1200); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const cos = role ? costumeFor(role.replace(/-\d+$/, '')) : null; // next-dev-1 → next-dev costume

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-white/15 p-4" style={{ background: '#0c0c12' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[14px] font-semibold text-white/90">➕ New agent</span>
          {cos && <span style={{ fontSize: 16 }}>{cos.emoji}</span>}
          <button onClick={onClose} className="ml-auto text-white/50 hover:text-white/90 text-sm">✕</button>
        </div>

        <label className="block text-[11px] text-white/50 mb-1">role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={busy}
          className="w-full mb-3 rounded px-2 py-1.5 text-[12px]"
          style={{ background: '#101018', border: '1px solid rgba(255,255,255,0.12)', color: '#e0e0e0' }}
        >
          {roles.length === 0 && <option value="">loading…</option>}
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className="block text-[11px] text-white/50 mb-1">slug (worktree / task name)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
          disabled={busy}
          autoFocus
          placeholder="e.g. fixlogin"
          className="w-full mb-3 rounded px-2 py-1.5 text-[12px] outline-none"
          style={{ background: '#101018', border: '1px solid rgba(255,255,255,0.12)', color: '#e0e0e0' }}
        />

        {err && <div className="mb-2 text-[11px] text-red-300">⚠ {err}</div>}
        {done && <div className="mb-2 text-[11px] text-green-300">✓ spawned {role}/{slug}</div>}

        <div className="flex items-center gap-2">
          <button
            onClick={create}
            disabled={busy || !role || !slug.trim()}
            className="px-3 py-1.5 rounded text-[12px] disabled:opacity-40"
            style={{ background: '#4ade8022', color: '#4ade80', border: '1px solid #4ade8055' }}
          >{busy ? 'spawning…' : 'create'}</button>
          <span className="text-[10px] text-white/35 font-mono truncate">maw wake {role || '…'} --wt {slug || '…'} --fresh</span>
        </div>
      </div>
    </div>
  );
}
