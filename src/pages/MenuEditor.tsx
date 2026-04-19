import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../api/oracle';
import { cacheBus } from '../lib/cache';
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
import type { MenuItem } from '../components/menu/SortableRow';
import { TreeRow } from '../components/menu/TreeRow';
import { NodeEditDialog } from '../components/menu/NodeEditDialog';

type SiblingKey = string; // `${parentId ?? 'root'}`

function siblingKey(parentId: number | null): SiblingKey {
  return parentId == null ? 'root' : String(parentId);
}

export function MenuEditor() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  async function act(label: string, fn: () => Promise<Response>) {
    try {
      const res = await fn();
      if (!res.ok) throw new Error(`${label} ${res.status}`);
      cacheBus.invalidate('menu');
      showToast(label); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); await load(); }
  }

  const JSON_H = { 'content-type': 'application/json' };
  const patchItem = (id: number, patch: Partial<MenuItem>) =>
    act('Saved', () => fetch(`${API_BASE}/menu/items/${id}`, { method: 'PATCH', headers: JSON_H, body: JSON.stringify(patch) }));
  const resetItem = (id: number) =>
    act('Reset', () => fetch(`${API_BASE}/menu/reset/${id}`, { method: 'POST' }));
  const deleteItem = (id: number) => {
    if (!confirm('Delete this menu item?')) return;
    return act('Deleted', () => fetch(`${API_BASE}/menu/items/${id}`, { method: 'DELETE' }));
  };
  async function addCustom() {
    const path = prompt('Path (e.g. /my-link):'); if (!path) return;
    const label = prompt('Label:', path.replace(/^\//, '').replace(/^./, (c) => c.toUpperCase())); if (!label) return;
    const body = JSON.stringify({ path, label, group: 'main', order: 999, source: 'custom', access: 'public' });
    await act('Created', () => fetch(`${API_BASE}/menu/items`, { method: 'POST', headers: JSON_H, body }));
  }

  // Group by parent — one DndContext per sibling group for within-parent reorder.
  const siblings = useMemo(() => {
    const map = new Map<SiblingKey, MenuItem[]>();
    for (const it of items) {
      const key = siblingKey(it.parentId ?? null);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [items]);

  const hasChildren = useMemo(() => {
    const set = new Set<number>();
    for (const it of items) if (it.parentId != null) set.add(it.parentId);
    return set;
  }, [items]);

  async function handleDragEnd(parentId: number | null, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const group = siblings.get(siblingKey(parentId)) ?? [];
    const oldIdx = group.findIndex((i) => i.id === active.id);
    const newIdx = group.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(group, oldIdx, newIdx);
    const payload = reordered.map((i, idx) => ({ id: i.id, parentId, position: (idx + 1) * 10 }));
    setItems((prev) => prev.map((i) => {
      const upd = payload.find((p) => p.id === i.id);
      return upd ? { ...i, position: upd.position } : i;
    }));
    try {
      const res = await fetch(`${API_BASE}/menu/reorder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      if (!res.ok) throw new Error(`reorder ${res.status}`);
      cacheBus.invalidate('menu');
      showToast('Reordered'); await load();
    } catch (e) { showToast(`Error: ${e instanceof Error ? e.message : e}`); await load(); }
  }

  function renderSiblings(parentId: number | null, depth: number): React.ReactNode {
    const group = siblings.get(siblingKey(parentId)) ?? [];
    if (group.length === 0 && parentId == null) {
      return <div className="text-sm text-text-secondary italic px-3 py-2">(empty)</div>;
    }
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(parentId, e)}>
        <SortableContext items={group.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {group.map((it) => (
              <div key={it.id}>
                <TreeRow
                  item={it}
                  depth={depth}
                  hasChildren={hasChildren.has(it.id)}
                  onPatch={patchItem}
                  onEdit={setEditing}
                  onReset={resetItem}
                  onDelete={deleteItem}
                />
                {hasChildren.has(it.id) && renderSiblings(it.id, depth + 1)}
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Menu Editor</h1>
          <p className="text-sm text-text-secondary mt-1">
            Tree view — drag ⋮⋮ to reorder within siblings. Click <span className="text-accent">edit</span> to change parent, host, or group. {items.length} items.
          </p>
        </div>
        <button onClick={addCustom} className="px-4 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-sm font-medium">+ Add Custom Item</button>
      </div>

      <GistSourceConfig onChanged={load} showToast={showToast} />

      {loading && <div className="text-text-secondary">Loading…</div>}
      {error && <div className="text-red-400">Error: {error}</div>}

      {!loading && !error && (
        <section className="mb-8">
          {renderSiblings(null, 0)}
        </section>
      )}

      {editing && (
        <NodeEditDialog
          item={editing}
          allItems={items}
          onClose={() => setEditing(null)}
          onSave={(patch) => patchItem(editing.id, patch)}
        />
      )}

      {toast && <div className="fixed bottom-6 right-6 px-4 py-2 rounded-lg bg-bg-elevated border border-accent/40 shadow-lg text-sm">{toast}</div>}
    </div>
  );
}
