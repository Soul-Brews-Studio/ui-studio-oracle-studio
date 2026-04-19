import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface MenuItem {
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

export const GROUPS = ['main', 'tools', 'admin', 'hidden'] as const;

export const GROUP_COLORS: Record<string, string> = {
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

interface Props {
  item: MenuItem;
  onPatch: (id: number, patch: Partial<MenuItem>) => void;
  onReset: (id: number) => void;
  onDelete: (id: number) => void;
}

export function SortableRow({ item, onPatch, onReset, onDelete }: Props) {
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
