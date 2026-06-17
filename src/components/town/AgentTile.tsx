// One agent = one avatar tile. Costume (emoji + colour) identifies the ROLE;
// the label tag distinguishes duplicate roles; the status dot/animation shows
// working (walking) vs asleep (✳ + drifting z) vs offline (greyed).
import { costumeFor } from '../../lib/role-costume';
import type { FleetAgent } from '../../lib/fleet';

const STATUS_DOT: Record<FleetAgent['status'], string> = {
  working: '#4ade80',
  idle: '#fbbf24',
  offline: '#555',
};

interface Props {
  agent: FleetAgent;
  registerRef?: (id: string, el: HTMLElement | null) => void;
  ring?: string;
}

export function AgentTile({ agent, registerRef, ring }: Props) {
  const c = costumeFor(agent.role);
  const dot = STATUS_DOT[agent.status];
  return (
    <div
      ref={(el) => registerRef?.(agent.id, el)}
      className={`town-${agent.status} relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 border`}
      style={{
        background: '#0f0f14',
        borderColor: ring ?? 'rgba(255,255,255,0.08)',
        boxShadow: ring ? `0 0 0 1px ${ring}, 0 0 10px ${ring}55` : undefined,
        opacity: agent.status === 'offline' ? 0.5 : 1,
        minWidth: 150,
        maxWidth: 230,
      }}
      title={`${agent.windowName}\n${agent.task || '—'}`}
    >
      <div
        className="town-avatar grid place-items-center rounded-full shrink-0"
        style={{ width: 34, height: 34, background: c.color + '22', border: `1.5px solid ${c.color}`, fontSize: 18 }}
      >
        <span>{c.emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold truncate" style={{ color: c.color }}>{c.title}</span>
          {agent.label && agent.label !== 'oracle' && (
            <span className="text-[10px] font-mono truncate text-white/45">·{agent.label}</span>
          )}
        </div>
        <div className="text-[10.5px] truncate text-white/50">{agent.task || '—'}</div>
      </div>
      <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 w-4">
        <span
          className="rounded-full"
          style={{ width: 8, height: 8, background: dot, boxShadow: agent.status === 'working' ? `0 0 6px ${dot}` : undefined }}
        />
        {agent.status === 'idle' && <span className="town-zzz text-[9px] leading-none text-white/45">z</span>}
        {agent.status === 'working' && <span className="text-[8px] font-mono leading-none text-white/45">{agent.glyph || '•'}</span>}
      </div>
    </div>
  );
}
