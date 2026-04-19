import { useEffect, useState } from 'react';
import { API_BASE } from '../api/oracle';

interface MenuItem {
  id: number;
  path: string;
  label: string;
  groupKey: string;
  parentId: number | null;
  position: number;
  enabled: boolean;
  access: string;
  source: string;
  icon: string | null;
  touchedAt: number | null;
}

const GROUPS = ['main', 'tools', 'admin', 'hidden'] as const;
const GROUP_COLORS: Record<string, string> = {
  main: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  tools: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  admin: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  hidden: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};
const SOURCE_COLORS: Record<string, string> = {
  route: 'bg-blue-500/10 text-blue-300',
  page: 'bg-cyan-500/10 text-cyan-300',
  plugin: 'bg-purple-500/10 text-purple-300',
  gist: 'bg-green-500/10 text-green-300',
  custom: 'bg-pink-500/10 text-pink-300',
};

export function MenuEditor() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/menu/items`);
      if (!res.ok) throw new Error(`load ${res.status}`);
      const data = await res.json();
      setItems(data.items || data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function patchItem(id: number, patch: Partial<MenuItem>) {
    try {
      const res = await fetch(`${API_BASE}/menu/items/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`patch ${res.status}`);
      showToast('Saved');
      await load();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function resetItem(id: number) {
    try {
      const res = await fetch(`${API_BASE}/menu/reset/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error(`reset ${res.status}`);
      showToast('Reset to default');
      await load();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm('Delete this menu item?')) return;
    try {
      const res = await fetch(`${API_BASE}/menu/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`delete ${res.status}`);
      showToast('Deleted');
      await load();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function addCustom() {
    const path = prompt('Path (e.g. /my-link):');
    if (!path) return;
    const label = prompt('Label:', path.replace(/^\//, '').replace(/^./, (c) => c.toUpperCase()));
    if (!label) return;
    try {
      const res = await fetch(`${API_BASE}/menu/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, label, group: 'main', order: 999, source: 'custom', access: 'public' }),
      });
      if (!res.ok) throw new Error(`create ${res.status}`);
      showToast('Created');
      await load();
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  const grouped: Record<string, MenuItem[]> = { main: [], tools: [], admin: [], hidden: [] };
  for (const it of items) {
    (grouped[it.groupKey] ?? (grouped[it.groupKey] = [])).push(it);
  }
  for (const g of GROUPS) grouped[g].sort((a, b) => a.position - b.position);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Menu Editor</h1>
          <p className="text-sm text-text-secondary mt-1">
            Edit the navbar. Routes seed defaults; your edits persist. {items.length} items.
          </p>
        </div>
        <button
          onClick={addCustom}
          className="px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-sm font-medium"
        >
          + Add Custom Item
        </button>
      </div>

      {loading && <div className="text-text-secondary">Loading…</div>}
      {error && <div className="text-red-400">Error: {error}</div>}

      {!loading && !error && GROUPS.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs border ${GROUP_COLORS[g]}`}>{g}</span>
            <span className="text-text-secondary text-sm">({grouped[g]?.length ?? 0})</span>
          </h2>
          <div className="space-y-1">
            {(grouped[g] ?? []).map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-elevated border border-border hover:border-accent/30 transition"
              >
                <input
                  type="checkbox"
                  checked={it.enabled}
                  onChange={(e) => patchItem(it.id, { enabled: e.target.checked })}
                  className="w-4 h-4"
                  title="Enabled"
                />
                <span className="text-xs text-text-secondary font-mono w-12">#{it.position}</span>
                <input
                  type="text"
                  defaultValue={it.label}
                  onBlur={(e) => {
                    if (e.target.value !== it.label) patchItem(it.id, { label: e.target.value });
                  }}
                  className="bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-1 font-medium flex-none w-40"
                />
                <code className="text-xs text-text-secondary font-mono flex-1 truncate">{it.path}</code>
                <span className={`px-2 py-0.5 rounded text-[10px] ${SOURCE_COLORS[it.source] ?? ''}`}>
                  {it.source}
                </span>
                {it.touchedAt && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    edited
                  </span>
                )}
                <select
                  value={it.groupKey}
                  onChange={(e) => patchItem(it.id, { groupKey: e.target.value })}
                  className="bg-bg-base border border-border rounded px-2 py-1 text-xs"
                >
                  {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <input
                  type="number"
                  defaultValue={it.position}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n) && n !== it.position) patchItem(it.id, { position: n });
                  }}
                  className="w-16 bg-bg-base border border-border rounded px-2 py-1 text-xs text-right"
                  title="Order"
                />
                {it.touchedAt && it.source === 'route' && (
                  <button
                    onClick={() => resetItem(it.id)}
                    className="text-xs text-text-secondary hover:text-accent"
                    title="Reset to route default"
                  >
                    reset
                  </button>
                )}
                <button
                  onClick={() => deleteItem(it.id)}
                  className="text-xs text-text-secondary hover:text-red-400"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
            {(grouped[g]?.length ?? 0) === 0 && (
              <div className="text-sm text-text-secondary italic px-3 py-2">(empty)</div>
            )}
          </div>
        </section>
      ))}

      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-lg bg-bg-elevated border border-accent/40 shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
