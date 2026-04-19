import { useEffect, useState } from 'react';
import { API_BASE } from '../../api/oracle';
import { cacheBus } from '../../lib/cache';

interface SourceInfo {
  url: string | null;
  hash: string | null;
  loaded_at: number | null;
  status: 'ok' | 'stale' | 'error' | 'none' | string;
  error?: string | null;
  official_url?: string | null;
}

const GIST_URL_RE = /^https:\/\/gist(\.githubusercontent\.com|\.github\.com)\//;

const STATUS_BADGE: Record<string, string> = {
  ok: 'bg-green-500/10 text-green-300 border-green-500/30',
  stale: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  error: 'bg-red-500/10 text-red-300 border-red-500/30',
  none: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

function relTime(ts: number | null): string {
  if (!ts) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - ts * (ts < 1e12 ? 1000 : 1)) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function truncHash(h: string | null): string {
  if (!h) return '—';
  return h.length > 10 ? h.slice(0, 10) : h;
}

interface Props {
  onChanged: () => void | Promise<void>;
  showToast: (msg: string) => void;
}

export function GistSourceConfig({ onChanged, showToast }: Props) {
  const [info, setInfo] = useState<SourceInfo | null>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fetchSource() {
    try {
      const res = await fetch(`${API_BASE}/menu/source`);
      if (!res.ok) throw new Error(`source ${res.status}`);
      const data: SourceInfo = await res.json();
      setInfo(data);
      if (data.url && !inputUrl) setInputUrl(data.url);
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  useEffect(() => { fetchSource(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function validate(url: string): boolean {
    if (!url) { setUrlError('URL required'); return false; }
    if (!GIST_URL_RE.test(url)) { setUrlError('Must be a gist.github(usercontent).com URL'); return false; }
    setUrlError(null);
    return true;
  }

  async function apply(url: string, mode: 'merge' | 'override') {
    if (!validate(url)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/source`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, mode }),
      });
      if (!res.ok) throw new Error(`load ${res.status}`);
      cacheBus.invalidate('menu');
      showToast(`Loaded (${mode})`);
      await fetchSource();
      await onChanged();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setBusy(false); }
  }

  async function clearSource() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/source`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`clear ${res.status}`);
      cacheBus.invalidate('menu');
      showToast('Cleared');
      await fetchSource();
      await onChanged();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setBusy(false); }
  }

  async function reload() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/reload`, { method: 'POST' });
      if (!res.ok) throw new Error(`reload ${res.status}`);
      cacheBus.invalidate('menu');
      showToast('Reloaded');
      await fetchSource();
      await onChanged();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setBusy(false); }
  }

  async function resetAll() {
    if (!confirm('Reset ALL menu edits and custom items? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/menu/reset-all`, { method: 'POST' });
      if (!res.ok) throw new Error(`reset-all ${res.status}`);
      cacheBus.invalidate('menu');
      showToast('Reset to defaults');
      await fetchSource();
      await onChanged();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setBusy(false); }
  }

  const status = info?.status ?? 'none';
  const badgeClass = STATUS_BADGE[status] ?? STATUS_BADGE.none;

  return (
    <section className="mb-8 rounded-xl border border-border bg-bg-elevated/50 p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Gist Source</h2>
        <span className={`px-2 py-0.5 rounded text-[10px] border ${badgeClass}`}>{status}</span>
        <code className="text-xs text-text-secondary font-mono truncate max-w-[40ch]" title={info?.url ?? undefined}>
          {info?.url ?? '(none)'}
        </code>
        <span className="text-xs text-text-secondary">hash: <code className="font-mono">{truncHash(info?.hash ?? null)}</code></span>
        <span className="text-xs text-text-secondary">loaded: {relTime(info?.loaded_at ?? null)}</span>
        {info?.error && <span className="text-xs text-red-400">({info.error})</span>}
      </div>

      <div>
        <div className="text-xs font-medium text-text-secondary mb-2">Apply Gist</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => { setInputUrl(e.target.value); if (urlError) setUrlError(null); }}
            placeholder="https://gist.githubusercontent.com/user/<id>/raw/..."
            className="flex-1 min-w-[320px] bg-bg-base border border-border rounded px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-clear-button]:hidden [&::-ms-clear]:hidden"
            style={{ WebkitAppearance: 'none' }}
            disabled={busy}
          />
          <button onClick={() => apply(inputUrl, 'merge')} disabled={busy} className="px-3 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-sm font-medium disabled:opacity-50">Load (merge)</button>
          <button onClick={() => apply(inputUrl, 'override')} disabled={busy} className="px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-sm font-medium disabled:opacity-50">Load (override)</button>
          <button onClick={clearSource} disabled={busy || !info?.url} className="px-3 py-2 rounded-lg bg-bg-base hover:bg-bg-elevated border border-border text-sm disabled:opacity-50">Clear</button>
          <button onClick={reload} disabled={busy || !info?.url} className="px-3 py-2 rounded-lg bg-bg-base hover:bg-bg-elevated border border-border text-sm disabled:opacity-50">Reload</button>
        </div>
        {urlError && <div className="text-xs text-red-400 mt-2">{urlError}</div>}
      </div>

      <div>
        <div className="text-xs font-medium text-text-secondary mb-2">Reset</div>
        <div className="flex items-center gap-2 flex-wrap">
          {info?.official_url && (
            <button
              onClick={() => apply(info.official_url!, 'override')}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 text-sm font-medium disabled:opacity-50"
              title={info.official_url}
            >
              Reset to Official
            </button>
          )}
          <button
            onClick={resetAll}
            disabled={busy}
            className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/40 text-sm font-medium disabled:opacity-50"
          >
            Reset All (danger)
          </button>
        </div>
      </div>
    </section>
  );
}
