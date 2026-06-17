// Pure layout: districts → absolutely-positioned pixel "zones" on the town map,
// and a home rect per agent (the area its sprite wanders within). District = tmux
// session; zones = orchestrator Town Hall, each team plot, and the commons.
import type { TownDistrict } from './town-group';

export interface StageZone {
  id: string;
  kind: 'hall' | 'plot' | 'commons';
  label: string;
  known?: boolean;
  session: string;
  x: number; y: number; w: number; h: number;
  agentIds: string[];
}
export interface StageHeader { session: string; label: string; y: number; counts: TownDistrict['counts'] }
export interface Placement { home: { x: number; y: number; w: number; h: number } }
export interface Stage {
  width: number; height: number;
  zones: StageZone[];
  headers: StageHeader[];
  placements: Record<string, Placement>;
}

const CELL = 80;      // screen room per sprite (64px sprite + name-tag)
const PAD = 16;       // zone inner padding
const LABEL_H = 20;   // zone label strip
const GAP = 18;
const STAGE_W = 1180;
const HEADER_H = 30;

function zoneSize(n: number) {
  const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 1.7))));
  const rows = Math.ceil(n / cols);
  return { w: cols * CELL + PAD * 2, h: rows * CELL + PAD * 2 + LABEL_H };
}

export function buildStage(districts: TownDistrict[]): Stage {
  const zones: StageZone[] = [];
  const headers: StageHeader[] = [];
  const placements: Record<string, Placement> = {};
  let y = 8;

  for (const d of districts) {
    headers.push({ session: d.session, label: d.session, y, counts: d.counts });
    y += HEADER_H;

    const defs: Array<{ kind: StageZone['kind']; label: string; known?: boolean; ids: string[] }> = [];
    if (d.halls.length) defs.push({ kind: 'hall', label: 'Town Hall', ids: d.halls.map((a) => a.id) });
    for (const p of d.plots) defs.push({ kind: 'plot', label: p.name, known: p.known, ids: p.members.map((m) => m.id) });
    if (d.commons.length) defs.push({ kind: 'commons', label: 'commons', ids: d.commons.map((a) => a.id) });

    let x = 8, rowH = 0;
    for (const z of defs) {
      const sz = zoneSize(z.ids.length);
      if (x + sz.w > STAGE_W && x > 8) { x = 8; y += rowH + GAP; rowH = 0; }
      zones.push({ id: `${d.session}|${z.kind}|${z.label}`, kind: z.kind, label: z.label, known: z.known, session: d.session, x, y, w: sz.w, h: sz.h, agentIds: z.ids });
      const home = { x: x + PAD, y: y + PAD + LABEL_H, w: sz.w - PAD * 2, h: sz.h - PAD * 2 - LABEL_H };
      for (const id of z.ids) placements[id] = { home };
      x += sz.w + GAP;
      rowH = Math.max(rowH, sz.h);
    }
    y += rowH + Math.round(GAP * 1.6);
  }

  return { width: STAGE_W, height: Math.ceil(y) + 8, zones, headers, placements };
}
