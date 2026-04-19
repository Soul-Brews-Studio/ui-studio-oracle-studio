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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

function SortableRow({
  item,
  onPatch,
  onReset,
  onDelete,
}: {
  item: MenuItem;
  onPatch: (id: number, patch: Partial<MenuItem>) => void;
  onReset: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-elevated border border-border hover:border-accent/30 transition"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-text-secondary hover:text-accent select-none px-1"
        title="Drag to reorder"
      >
        ⋮⋮
      </span>
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onPatch(item.id, { enabled: e.target.checked })}
        className="w-4 h-4"
        title="Enabled"
      />
      <span className="text-xs text-text-secondary font-mono w-10">#{item.position}</span>
      <input
        type="text"
        defaultValue={item.label}
        onBlur={(e) => { if (e.target.value !== item.label) onPatch(item.id, { label: e.target.value }); }}
        className="bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-1 font-medium flex-none w-40"
      />
      <code className="text-xs text-text-secondary font-mono flex-1 truncate">{item.path}</code>
      <span className={`px-2 py-0.5 rounded text-[10px] ${SOURCE_COLORS[item.source] ?? ''}`}>{item.source}</span>
      {item.touchedAt && (
        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">edited</span>
      )}
      <select
        value={item.groupKey}
        onChange={(e) => onPatch(item.id, { groupKey: e.target.value })}
        className="bg-bg-base border border-border rounded px-2 py-1 text-xs"
      >
        {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      {item.touchedAt && item.source === 'route' && (
        <button onClick={() => onReset(item.id)} className="text-xs text-text-secondary hover:text-accent" title="Reset">reset</button>
      )}
      <button onClick={() => onDelete(item.id)} className="text-xs text-text-secondary hover:text-red-400" title="Delete">✕</button>
    </div>
  );
}

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
