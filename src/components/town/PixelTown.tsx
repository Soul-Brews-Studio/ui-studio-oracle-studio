// Pixel-sprite town (ai-town style): each agent is a folk sprite that wanders its
// zone with a walk-cycle when working, stands with a 💤 when idle, fades when
// offline. Districts/plots are fenced zones on a grass map; dispatch roads link
// orchestrators to the workers they spawned. Same /__fleet/state data as the list view.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { FleetState, FleetAgent } from '../../lib/fleet';
import { groupTown } from '../../lib/town-group';
import { buildStage } from '../../lib/town-stage';
import { costumeFor, charIndexFor, ctxColor, activityEmoji } from '../../lib/role-costume';
import { SHEET_URL, SHEET_W, SHEET_H, SPRITE, bgPos } from '../../lib/sprite';
import { buildProps } from '../../lib/town-props';
import { loadZoneTextures, saveZoneTextures, textureById } from '../../lib/textures';
import { TexturePicker } from './TexturePicker';

interface Actor {
  id: string; x: number; y: number; tx: number; ty: number;
  dir: number; frame: number; frameT: number; waitT: number;
  status: string; charIndex: number; home: { x: number; y: number; w: number; h: number };
  pinned?: boolean; // dragged to a fixed spot — stops wandering / re-clamping
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DRAG_PAUSE_MS = 2000; // after a drop, the sprite stands here this long, then wanders on

function pickTarget(a: Actor) {
  a.tx = rnd(a.home.x, a.home.x + Math.max(1, a.home.w - SPRITE));
  a.ty = rnd(a.home.y, a.home.y + Math.max(1, a.home.h - SPRITE));
  a.waitT = rnd(300, 1600); // pause on arrival
}

export function PixelTown({ state, onSelect }: { state: FleetState; onSelect: (a: FleetAgent) => void }) {
  const districts = useMemo(() => groupTown(state), [state]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1180);
  const stage = useMemo(() => buildStage(districts, width), [districts, width]);
  const props = useMemo(() => buildProps(stage), [stage]);
  const [zoneTex, setZoneTex] = useState<Record<string, string>>(loadZoneTextures);
  const [picking, setPicking] = useState<{ id: string; label: string } | null>(null);
  const actors = useRef<Map<string, Actor>>(new Map());
  const els = useRef<Map<string, HTMLDivElement>>(new Map());
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);
  // Animated decorations (campfire/windmill/sparkle): the rAF cycles their frames.
  const propEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const animState = useRef<Map<string, { frame: number; t: number }>>(new Map());
  const animsRef = useRef(props.anims);
  const reduceRef = useRef(false);

  // Drag a sprite to reposition it (separate overlapping agents); a no-move
  // press is treated as a click → open the chat. Dragged actors are pinned.
  const onDown = (e: ReactPointerEvent<HTMLDivElement>, a: FleetAgent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: a.id, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    d.moved = true;
    const act = actors.current.get(d.id);
    const st = stageRef.current;
    if (!act || !st) return;
    const r = st.getBoundingClientRect();
    act.pinned = true;
    act.x = clamp(e.clientX - r.left - SPRITE / 2, 0, Math.max(0, r.width - SPRITE));
    act.y = clamp(e.clientY - r.top - SPRITE / 2, 0, Math.max(0, r.height - SPRITE));
    const el = els.current.get(d.id);
    if (el) el.style.transform = `translate(${act.x}px, ${act.y}px)`;
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>, a: FleetAgent) => {
    const d = drag.current;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!d || d.id !== a.id) return;
    if (!d.moved) { onSelect(a); return; } // a press without movement = click → open chat
    // Dropped after a drag: don't freeze it — pause where it landed, then wander on.
    const act = actors.current.get(a.id);
    if (act) { act.pinned = false; act.waitT = DRAG_PAUSE_MS; act.frame = 0; }
  };

  // Fill the available width — the walking area grows with the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        // Zones rebuild every poll; only re-target when the rect VALUE changed,
        // else a stale target may sit outside the new home and pin the sprite to a wall.
        const moved = act.home.x !== home.x || act.home.y !== home.y || act.home.w !== home.w || act.home.h !== home.h;
        act.status = a.status; act.home = home; act.charIndex = charIndexFor(a.role);
        if (!act.pinned) {
          act.x = clamp(act.x, home.x, home.x + Math.max(0, home.w - SPRITE));
          act.y = clamp(act.y, home.y, home.y + Math.max(0, home.h - SPRITE));
          if (moved) pickTarget(act);
        }
      }
    }
    for (const id of [...actors.current.keys()]) if (!live.has(id)) { actors.current.delete(id); els.current.delete(id); }
  }, [stage, state]);

  // Keep the animated-prop frame counters in sync with the current placements.
  useEffect(() => {
    animsRef.current = props.anims;
    const live = new Set(props.anims.map((a) => a.id));
    for (const id of [...animState.current.keys()]) if (!live.has(id)) { animState.current.delete(id); propEls.current.delete(id); }
    for (const a of props.anims) if (!animState.current.has(a.id)) animState.current.set(a.id, { frame: 0, t: 0 });
  }, [props]);

  // Single rAF drives every sprite (wander + walk-cycle) AND the ambient prop
  // frame cycling, mutating the DOM directly.
  useEffect(() => {
    reduceRef.current = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(60, t - last) : 16; last = t;
      for (const act of actors.current.values()) {
        const el = els.current.get(act.id);
        if (!el) continue;
        if (act.status === 'working' && !act.pinned) {
          if (act.waitT > 0) { act.waitT -= dt; act.frame = 0; }
          else {
            const dx = act.tx - act.x, dy = act.ty - act.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 2) pickTarget(act);
            else {
              const sp = 0.035 * dt;
              const nx = act.x + (dx / dist) * sp;
              const ny = act.y + (dy / dist) * sp;
              const maxX = act.home.x + Math.max(0, act.home.w - SPRITE);
              const maxY = act.home.y + Math.max(0, act.home.h - SPRITE);
              const cx = clamp(nx, act.home.x, maxX);
              const cy = clamp(ny, act.home.y, maxY);
              act.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
              act.frameT += dt;
              if (act.frameT > 150) { act.frameT = 0; act.frame = (act.frame + 1) % 3; }
              act.x = cx; act.y = cy;
              if (cx !== nx || cy !== ny) pickTarget(act); // hit a wall → turn around
            }
          }
          el.style.backgroundPosition = bgPos(act.charIndex, act.dir, act.frame);
        } else {
          el.style.backgroundPosition = bgPos(act.charIndex, 0, 0);
        }
        el.style.transform = `translate(${act.x}px, ${act.y}px)`;
      }
      // Advance the animated decorations (frozen when reduced-motion is set).
      for (const a of animsRef.current) {
        const el = propEls.current.get(a.id);
        const st = animState.current.get(a.id);
        if (!el || !st) continue;
        if (!reduceRef.current) {
          st.t += dt;
          const period = 1000 / a.spec.fps;
          if (st.t >= period) { st.t -= period; st.frame = (st.frame + 1) % a.spec.frames.length; }
        }
        const k = a.spec.size / a.spec.fw;
        const [fx, fy] = a.spec.frames[st.frame];
        el.style.backgroundPosition = `${-fx * k}px ${-fy * k}px`;
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
    <div ref={wrapRef} className="w-full">
    <div ref={stageRef} className="town-stage" style={{ width: stage.width, height: stage.height }}>
      {/* Ambient scenery — pure decoration on the grass, behind every agent. */}
      {props.decos.map((d) => (
        <div key={d.id} className="town-deco" style={{
          width: d.spec.w, height: d.spec.h,
          backgroundImage: `url(${d.spec.url})`, backgroundSize: `${d.spec.w}px ${d.spec.h}px`,
          transform: `translate(${d.x}px, ${d.y}px)`,
        }} />
      ))}
      {props.anims.map((a) => {
        const k = a.spec.size / a.spec.fw;
        return (
          <div key={a.id} className="town-anim"
            ref={(el) => { if (el) propEls.current.set(a.id, el); else propEls.current.delete(a.id); }}
            style={{
              width: a.spec.size, height: a.spec.size,
              backgroundImage: `url(${a.spec.url})`,
              backgroundSize: `${a.spec.sheetW * k}px ${a.spec.sheetH * k}px`,
              transform: `translate(${a.x}px, ${a.y}px)`,
            }} />
        );
      })}

      <svg className="absolute inset-0 pointer-events-none" width={stage.width} height={stage.height}>
        {state.roads.map((r) => {
          // skip roads inside one cluster (lead + workers already sit together)
          if (stage.placements[r.from]?.home === stage.placements[r.to]?.home) return null;
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

      {stage.zones.map((z) => {
        const tex = textureById(zoneTex[z.id] || 'default');
        return (
          <div key={z.id} className={`town-zone town-zone-${z.kind}`} style={{
            left: z.x, top: z.y, width: z.w, height: z.h,
            ...(tex?.url ? { backgroundImage: `url(${tex.url})`, backgroundSize: `${tex.size}px`, backgroundRepeat: 'repeat', imageRendering: 'pixelated' as const } : {}),
          }}>
            <span className="town-zone-label">
              {z.kind === 'campaign' ? '🎩' : z.kind === 'team' ? '🏠' : '·'} {z.label}
              {z.kind === 'team' && !z.known ? ' ~' : ''}
            </span>
            <button className="town-zone-paint" title="change floor texture"
              onClick={(e) => { e.stopPropagation(); setPicking({ id: z.id, label: z.label }); }}>🎨</button>
          </div>
        );
      })}

      {state.agents.map((a) => {
        const p = stage.placements[a.id];
        if (!p) return null;
        const cos = costumeFor(a.role);
        return (
          <div
            key={a.id}
            ref={(el) => { if (el) els.current.set(a.id, el); else els.current.delete(a.id); }}
            className={`town-actor town-actor-${a.status}${a.waiting ? ' town-actor-wait' : ''}`}
            onPointerDown={(e) => onDown(e, a)}
            onPointerMove={onMove}
            onPointerUp={(e) => onUp(e, a)}
            style={{
              width: SPRITE, height: SPRITE,
              cursor: 'grab', touchAction: 'none',
              backgroundImage: `url(${SHEET_URL})`,
              backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
              backgroundPosition: bgPos(charIndexFor(a.role), 0, 0),
              transform: `translate(${p.home.x}px, ${p.home.y}px)`,
            }}
            title={`${a.windowName}\n${a.task || '—'}\n(drag to move · click to open session)`}
          >
            {a.isOrchestrator && <span className="town-crown">👑</span>}
            <span className="town-nametag" style={{ borderColor: cos.color }}>
              <b style={{ color: cos.color }}>{cos.title}</b>
              {a.label && a.label !== 'oracle' ? <span className="town-nametag-slug">·{a.label}</span> : null}
              {a.ctxPct != null ? <span className="town-nametag-slug" style={{ color: ctxColor(a.ctxPct) }}> {a.ctxPct}%</span> : null}
              {a.plan ? <span className="town-plan-badge" title={`Claude account: ${a.plan}`}>🔑{a.plan}</span> : null}
            </span>
            {a.waiting ? (
              <span className="town-bubble town-bubble-wait" title="waiting for your input — click to answer the menu">🔔</span>
            ) : a.status === 'working' ? (
              <span className="town-bubble town-bubble-work" title={a.task || ''}>{activityEmoji(a.task)}</span>
            ) : a.status === 'idle' ? (
              <span className="town-bubble town-bubble-idle">💤</span>
            ) : null}
          </div>
        );
      })}
    </div>
    {picking && (
      <TexturePicker
        zoneLabel={picking.label}
        current={zoneTex[picking.id] || 'default'}
        onPick={(id) => {
          const m = { ...zoneTex };
          if (id === 'default') delete m[picking.id]; else m[picking.id] = id;
          setZoneTex(m); saveZoneTextures(m);
        }}
        onClose={() => setPicking(null)}
      />
    )}
    </div>
  );
}
