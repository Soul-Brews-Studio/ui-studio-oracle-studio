import { useEffect, useState } from 'react';
import { API_BASE } from '../api/oracle';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { GistSourceConfig } from '../components/menu/GistSourceConfig';
import { SortableRow, GROUPS, GROUP_COLORS, type MenuItem } from '../components/menu/SortableRow';

export function MenuEditor() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function patchItem(id: number, patch: Partial<MenuItem>) {
    try {
      const res = await fetch(`${API_BASE}/menu/items/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error(`patch ${res.status}`);
      showToast('Saved'); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
  }
  async function resetItem(id: number) {
    try {
      const res = await fetch(`${API_BASE}/menu/reset/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error(`reset ${res.status}`);
      showToast('Reset'); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
  }
  async function deleteItem(id: number) {
    if (!confirm('Delete this menu item?')) return;
    try {
      const res = await fetch(`${API_BASE}/menu/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`delete ${res.status}`);
      showToast('Deleted'); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
  }
  async function addCustom() {
    const path = prompt('Path (e.g. /my-link):'); if (!path) return;
    const label = prompt('Label:', path.replace(/^\//, '').replace(/^./, (c) => c.toUpperCase())); if (!label) return;
    try {
      const res = await fetch(`${API_BASE}/menu/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, label, group: 'main', order: 999, source: 'custom', access: 'public' }) });
      if (!res.ok) throw new Error(`create ${res.status}`);
      showToast('Created'); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); }
  }

  async function handleDragEnd(group: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const groupItems = items.filter((i) => i.groupKey === group).sort((a, b) => a.position - b.position);
    const oldIdx = groupItems.findIndex((i) => i.id === active.id);
    const newIdx = groupItems.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(groupItems, oldIdx, newIdx);
    const payload = reordered.map((i, idx) => ({ id: i.id, parentId: i.parentId, position: (idx + 1) * 10 }));
    setItems((prev) => prev.map((i) => {
      const upd = payload.find((p) => p.id === i.id);
      return upd ? { ...i, position: upd.position } : i;
    }));
    try {
      const res = await fetch(`${API_BASE}/menu/reorder`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: payload }) });
      if (!res.ok) throw new Error(`reorder ${res.status}`);
      showToast('Reordered'); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); await load(); }
  }

  const grouped: Record<string, MenuItem[]> = { main: [], tools: [], admin: [], hidden: [] };
  for (const it of items) (grouped[it.groupKey] ?? (grouped[it.groupKey] = [])).push(it);
  for (const g of GROUPS) grouped[g].sort((a, b) => a.position - b.position);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Menu Editor</h1>
          <p className="text-sm text-text-secondary mt-1">Drag ⋮⋮ to reorder. Routes seed defaults; edits persist. {items.length} items.</p>
        </div>
        <button onClick={addCustom} className="px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-sm font-medium">+ Add Custom Item</button>
      </div>

      <GistSourceConfig onChanged={load} showToast={showToast} />

      {loading && <div className="text-text-secondary">Loading…</div>}
      {error && <div className="text-red-400">Error: {error}</div>}

      {!loading && !error && GROUPS.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs border ${GROUP_COLORS[g]}`}>{g}</span>
            <span className="text-text-secondary text-sm">({grouped[g]?.length ?? 0})</span>
          </h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(g, e)}>
            <SortableContext items={(grouped[g] ?? []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {(grouped[g] ?? []).map((it) => (
                  <SortableRow key={it.id} item={it} onPatch={patchItem} onReset={resetItem} onDelete={deleteItem} />
                ))}
                {(grouped[g]?.length ?? 0) === 0 && <div className="text-sm text-text-secondary italic px-3 py-2">(empty)</div>}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      ))}

      {toast && <div className="fixed bottom-6 right-6 px-4 py-2 rounded-lg bg-bg-elevated border border-accent/40 shadow-lg text-sm">{toast}</div>}
    </div>
  );
}
