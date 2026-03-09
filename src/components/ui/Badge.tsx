import { getTypeColor } from '../../lib/type-colors';

interface BadgeProps {
  type: string;
  label?: string;
  className?: string;
}

export function Badge({ type, label, className = '' }: BadgeProps) {
  const color = getTypeColor(type);
  return (
    <span
      className={`text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${className}`}
      style={{ background: `${color}20`, color }}
    >
      {label || type}
    </span>
  );
}
