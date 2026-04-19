import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MenuItem } from './SortableRow';
import { GROUP_COLORS } from './SortableRow';

const SOURCE_COLORS: Record<string, string> = {
  route: 'bg-blue-500/10 text-blue-300',
  page: 'bg-cyan-500/10 text-cyan-300',
  plugin: 'bg-purple-500/10 text-purple-300',
  gist: 'bg-green-500/10 text-green-300',
  custom: 'bg-pink-500/10 text-pink-300',
};

interface Props {
  item: MenuItem;
  depth: number;
  hasChildren: boolean;
  onPatch: (id: number, patch: Partial<MenuItem>) => void;
  onEdit: (item: MenuItem) => void;
  onReset: (id: number) => void;
  onDelete: (id: number) => void;
}

export function TreeRow({ item, depth, hasChildren, onPatch, onEdit, onReset, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: depth * 24,
  };
  const host = item.host ?? null;
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
        title="Drag to reorder within siblings"
      >
        ⋮⋮
      </span>
      <span className="text-xs text-text-secondary w-4 text-center" title={hasChildren ? 'Has children' : ''}>
        {hasChildren ? '▸' : '·'}
      </span>
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onPatch(item.id, { enabled: e.target.checked })}
        className="w-4 h-4"
        title="Enabled"
      />
      <span className="text-xs text-text-secondary font-mono w-10">#{item.position}</span>
      <span className="font-medium flex-none w-40 truncate">{item.label}</span>
      <code className="text-xs text-text-secondary font-mono flex-1 truncate">{item.path}</code>
      <span className={`px-2 py-0.5 rounded text-[10px] border ${GROUP_COLORS[item.groupKey] ?? ''}`}>{item.groupKey}</span>
      <span className={`px-2 py-0.5 rounded text-[10px] ${SOURCE_COLORS[item.source] ?? ''}`}>{item.source}</span>
      {host && (
        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono" title="Host filter">
          {host}
        </span>
      )}
      {item.touchedAt && (
        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">edited</span>
      )}
      <button onClick={() => onEdit(item)} className="text-xs text-text-secondary hover:text-accent" title="Edit">edit</button>
      {item.touchedAt && item.source === 'route' && (
        <button onClick={() => onReset(item.id)} className="text-xs text-text-secondary hover:text-accent" title="Reset">reset</button>
      )}
      <button onClick={() => onDelete(item.id)} className="text-xs text-text-secondary hover:text-red-400" title="Delete">✕</button>
    </div>
  );
}
