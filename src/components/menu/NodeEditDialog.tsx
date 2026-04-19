import { useEffect, useState } from 'react';
import type { MenuItem } from './SortableRow';

interface Props {
  item: MenuItem;
  allItems: MenuItem[];
  onClose: () => void;
  onSave: (patch: Partial<MenuItem>) => Promise<void> | void;
}

const GROUPS = ['main', 'tools', 'admin', 'hidden'];

function isDescendant(candidateId: number, ofId: number, items: MenuItem[]): boolean {
  if (candidateId === ofId) return true;
  const children = items.filter((i) => i.parentId === ofId);
  return children.some((c) => isDescendant(candidateId, c.id, items));
}

export function NodeEditDialog({ item, allItems, onClose, onSave }: Props) {
  const [label, setLabel] = useState(item.label);
  const [path, setPath] = useState(item.path);
  const [groupKey, setGroupKey] = useState(item.groupKey);
  const [parentId, setParentId] = useState<number | null>(item.parentId ?? null);
  const [host, setHost] = useState<string>(item.host ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parentOptions = allItems.filter((i) => !isDescendant(i.id, item.id, allItems));

  async function submit() {
    setSaving(true);
    try {
      const patch: Partial<MenuItem> = {};
      if (label !== item.label) patch.label = label;
      if (path !== item.path) patch.path = path;
      if (groupKey !== item.groupKey) patch.groupKey = groupKey;
      if ((parentId ?? null) !== (item.parentId ?? null)) patch.parentId = parentId;
      const hostTrim = host.trim();
      const hostFinal = hostTrim === '' ? null : hostTrim;
      if (hostFinal !== (item.host ?? null)) patch.host = hostFinal;
      if (Object.keys(patch).length > 0) await onSave(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-bg-elevated border border-border shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit menu item</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-accent text-xl leading-none" aria-label="Close">×</button>
        </div>

        <label className="block text-sm">
          <span className="text-text-secondary">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full bg-bg-base border border-border rounded px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-text-secondary">Route (path)</span>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="mt-1 w-full bg-bg-base border border-border rounded px-3 py-2 font-mono text-xs"
          />
        </label>

        <label className="block text-sm">
          <span className="text-text-secondary">Group</span>
          <select
            value={groupKey}
            onChange={(e) => setGroupKey(e.target.value)}
            className="mt-1 w-full bg-bg-base border border-border rounded px-3 py-2"
          >
            {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-text-secondary">Parent</span>
          <select
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value === '' ? null : Number(e.target.value))}
            className="mt-1 w-full bg-bg-base border border-border rounded px-3 py-2"
          >
            <option value="">(root)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.label} — {p.path}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-text-secondary">Host</span>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="null = all hosts, e.g. vector.*"
            className="mt-1 w-full bg-bg-base border border-border rounded px-3 py-2 font-mono text-xs"
          />
          <p className="text-xs text-text-secondary mt-1">Leave blank for all hosts. Glob patterns supported (e.g. <code>vector.*</code>).</p>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-border hover:border-accent/40">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm rounded bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 disabled:opacity-50"
          >{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
