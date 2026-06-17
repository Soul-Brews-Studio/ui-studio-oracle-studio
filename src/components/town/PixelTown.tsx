// Pixel-sprite town (ai-town style): each agent is a folk sprite that wanders its
// zone with a walk-cycle when working, stands with a 💤 when idle, fades when
// offline. Districts/plots are fenced zones on a grass map; dispatch roads link
// orchestrators to the workers they spawned. Same /__fleet/state data as the list view.
import { useEffect, useMemo, useRef } from 'react';
import type { FleetState } from '../../lib/fleet';
import { groupTown } from '../../lib/town-group';
import { buildStage } from '../../lib/town-stage';
import { costumeFor, charIndexFor } from '../../lib/role-costume';
import { SHEET_URL, SHEET_W, SHEET_H, SPRITE, bgPos } from '../../lib/sprite';

interface Actor {
  id: string; x: number; y: number; tx: number; ty: number;
  dir: number; frame: number; frameT: number; waitT: number;
  status: string; charIndex: number; home: { x: number; y: number; w: number; h: number };
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function pickTarget(a: Actor) {
  a.tx = rnd(a.home.x, a.home.x + Math.max(1, a.home.w - SPRITE));
  a.ty = rnd(a.home.y, a.home.y + Math.max(1, a.home.h - SPRITE));
  a.waitT = rnd(300, 1600); // pause on arrival
}

export function PixelTown({ state }: { state: FleetState }) {
  const districts = useMemo(() => groupTown(state), [state]);
  const stage = useMemo(() => buildStage(districts), [districts]);
  const actors = useRef<Map<string, Actor>>(new Map());
  const els = useRef<Map<string, HTMLDivElement>>(new Map());

  // Reconcile actor state with the current placements (add/update/remove).
  useEffect(() => {
    const live = new Set<string>();
    for (const a of state.agents) {
      const place = stage.placements[a.id];
      if (!place) continue;
      live.add(a.id);
      const home = place.home;
      let act = actors.current.get(a.id);
      if (!act) {
        act = { id: a.id, x: rnd(home.x, home.x + home.w - SPRITE), y: rnd(home.y, home.y + home.h - SPRITE), tx: 0, ty: 0, dir: 0, frame: 0, frameT: 0, waitT: rnd(0, 800), status: a.status, charIndex: charIndexFor(a.role), home };
        pickTarget(act);
        actors.current.set(a.id, act);
      } else {
        act.status = a.status; act.home = home; act.charIndex = charIndexFor(a.role);
        act.x = clamp(act.x, home.x, home.x + home.w - SPRITE);
        act.y = clamp(act.y, home.y, home.y + home.h - SPRITE);
      }
    }
    for (const id of [...actors.current.keys()]) if (!live.has(id)) { actors.current.delete(id); els.current.delete(id); }
  }, [stage, state]);

  // Single rAF drives every sprite (wander + walk-cycle), mutating the DOM directly.
  useEffect(() => {
    let raf = 0; let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(60, t - last) : 16; last = t;
      for (const act of actors.current.values()) {
        const el = els.current.get(act.id);
        if (!el) continue;
        if (act.status === 'working') {
          if (act.waitT > 0) { act.waitT -= dt; act.frame = 0; }
          else {
            const dx = act.tx - act.x, dy = act.ty - act.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 2) pickTarget(act);
            else {
              const sp = 0.035 * dt;
              act.x += (dx / dist) * sp; act.y += (dy / dist) * sp;
              act.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
              act.frameT += dt;
              if (act.frameT > 150) { act.frameT = 0; act.frame = (act.frame + 1) % 3; }
            }
          }
          el.style.backgroundPosition = bgPos(act.charIndex, act.dir, act.frame);
        } else {
          el.style.backgroundPosition = bgPos(act.charIndex, 0, 0);
        }
        el.style.transform = `translate(${act.x}px, ${act.y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const centers = (id: string) => {
    const p = stage.placements[id];
    return p ? { x: p.home.x + p.home.w / 2, y: p.home.y + p.home.h / 2 } : null;
  };

  return (
    <div className="town-stage" style={{ width: stage.width, height: stage.height }}>
      <svg className="absolute inset-0 pointer-events-none" width={stage.width} height={stage.height}>
        {state.roads.map((r) => {
          const a = centers(r.from), b = centers(r.to);
          if (!a || !b) return null;
          return <line key={`${r.from}>${r.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c084fc" strokeOpacity={0.5} strokeWidth={2} className="town-road" />;
        })}
      </svg>

      {stage.headers.map((h) => (
        <div key={h.session} className="town-district-label" style={{ left: 8, top: h.y }}>
          🏙 {h.session} <span className="town-dcount">🟢{h.counts.working} 🟡{h.counts.idle} ⚪{h.counts.offline}</span>
        </div>
      ))}

      {stage.zones.map((z) => (
        <div key={z.id} className={`town-zone town-zone-${z.kind}`} style={{ left: z.x, top: z.y, width: z.w, height: z.h }}>
          <span className="town-zone-label">
            {z.kind === 'hall' ? '🎩' : z.kind === 'plot' ? '🏠' : '·'} {z.label}
            {z.kind === 'plot' && !z.known ? ' ~' : ''}
          </span>
        </div>
      ))}

      {state.agents.map((a) => {
        const p = stage.placements[a.id];
        if (!p) return null;
        const cos = costumeFor(a.role);
        return (
          <div
            key={a.id}
            ref={(el) => { if (el) els.current.set(a.id, el); else els.current.delete(a.id); }}
            className={`town-actor town-actor-${a.status}`}
            style={{
              width: SPRITE, height: SPRITE,
              backgroundImage: `url(${SHEET_URL})`,
              backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
              backgroundPosition: bgPos(charIndexFor(a.role), 0, 0),
              transform: `translate(${p.home.x}px, ${p.home.y}px)`,
            }}
            title={`${a.windowName}\n${a.task || '—'}`}
          >
            <span className="town-nametag" style={{ borderColor: cos.color }}>
              <b style={{ color: cos.color }}>{cos.title}</b>
              {a.label && a.label !== 'oracle' ? <span className="town-nametag-slug">·{a.label}</span> : null}
            </span>
            {a.status === 'idle' && <span className="town-zzz town-zzz-pixel">z</span>}
          </div>
        );
      })}
    </div>
  );
}
