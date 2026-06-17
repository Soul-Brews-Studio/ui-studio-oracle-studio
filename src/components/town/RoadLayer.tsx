// SVG overlay drawing dispatch "roads" from each orchestrator to the worker(s)
// it dispatched. Measures live tile positions via refs (relative to the town
// container) and redraws on every fleet poll + on resize/scroll. Degrades to
// nothing if an endpoint isn't mounted yet — never throws.
import { useEffect, useState } from 'react';
import type { FleetRoad } from '../../lib/fleet';

interface Line { x1: number; y1: number; x2: number; y2: number; key: string }

interface Props {
  roads: FleetRoad[];
  container: { current: HTMLElement | null };
  refs: { current: Map<string, HTMLElement> };
  version: string | number; // bump → remeasure (we pass the fleet timestamp)
}

export function RoadLayer({ roads, container, refs, version }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    function measure() {
      const root = container.current;
      if (!root) return;
      const base = root.getBoundingClientRect();
      setSize({ w: base.width, h: base.height });
      const out: Line[] = [];
      for (const r of roads) {
        const a = refs.current.get(r.from);
        const b = refs.current.get(r.to);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        out.push({
          key: `${r.from}>${r.to}`,
          x1: ra.left + ra.width / 2 - base.left,
          y1: ra.top + ra.height / 2 - base.top,
          x2: rb.left + rb.width / 2 - base.left,
          y2: rb.top + rb.height / 2 - base.top,
        });
      }
      setLines(out);
    }
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [roads, version, container, refs]);

  if (!lines.length) return null;
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size.w}
      height={size.h}
      style={{ zIndex: 0 }}
    >
      {lines.map((l) => (
        <g key={l.key}>
          <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#c084fc" strokeOpacity={0.4} strokeWidth={1.5} className="town-road" />
          <circle cx={l.x2} cy={l.y2} r={3} fill="#c084fc" fillOpacity={0.6} />
        </g>
      ))}
    </svg>
  );
}
