export const TYPE_COLORS: Record<string, string> = {
  learning: '#60a5fa',
  principle: '#c084fc',
  retro: '#4ade80',
  trace: '#38bdf8',
  thread: '#a78bfa',
  resonance: '#fb7185',
  handoff: '#22d3ee',
};

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || '#888';
}
