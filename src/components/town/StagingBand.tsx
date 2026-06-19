// Staging-env status as a pixel "district": each service is a Cainos building on
// grass, glowing by health (green up / amber degraded / red down). Mirrors live
// health checks only (Oracle/Shadow — reflects, never drives). Click → detail.
import { useState } from 'react';
import { useEnv } from '../../lib/env';

const A = '/assets/town';
// kind → building sprite + an icon badge. Unknown kinds fall back to a wall.
const SPRITE: Record<string, { url: string; emoji: string; w: number; h: number }> = {
  worker: { url: `${A}/bldg-gate.png`, emoji: '☁️', w: 92, h: 82 },
  web: { url: `${A}/bldg-wall.png`, emoji: '🖥️', w: 60, h: 90 },
  supabase: { url: `${A}/bldg-wall.png`, emoji: '🗄️', w: 60, h: 90 },
};
const FALLBACK = { url: `${A}/bldg-wall.png`, emoji: '📦', w: 60, h: 90 };
const COLOR: Record<string, string> = { up: '#4ade80', degraded: '#fbbf24', down: '#f87171' };
const PIP: Record<string, string> = { up: '🟢', degraded: '🟡', down: '🔴' };

function ago(iso: string): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

export function StagingBand() {
  const env = useEnv(10000);
  const [open, setOpen] = useState<string | null>(null);
  if (!env.length) return null;
  const up = env.filter((e) => e.status === 'up').length;

  return (
    <div className="staging-band">
      <div className="staging-title">🏙 Staging <span className="staging-sub">{up}/{env.length} up</span></div>
      <div className="staging-row">
        {env.map((e) => {
          const sp = SPRITE[e.kind] || FALLBACK;
          const col = COLOR[e.status] || '#64748b';
          return (
            <div key={e.name} className={`staging-svc staging-${e.status}`} onClick={() => setOpen(open === e.name ? null : e.name)}>
              <div className="staging-bldg" style={{
                width: sp.w, height: sp.h,
                backgroundImage: `url(${sp.url})`, backgroundSize: `${sp.w}px ${sp.h}px`,
                filter: `drop-shadow(0 0 7px ${col}) drop-shadow(0 2px 2px rgba(0,0,0,0.4))`,
              }}>
                <span className="staging-emoji">{sp.emoji}</span>
              </div>
              <div className="staging-label"><span>{PIP[e.status] || '⚪'}</span> {e.label}</div>
              {open === e.name && (
                <div className="staging-detail" onClick={(ev) => ev.stopPropagation()}>
                  <div><b style={{ color: col }}>{e.status.toUpperCase()}</b> · HTTP {e.code || '—'} · {e.ms}ms</div>
                  <div className="staging-detail-sub">checked {ago(e.checkedAt)}</div>
                  <a href={e.url} target="_blank" rel="noreferrer">{e.url.replace(/^https?:\/\//, '')}</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
