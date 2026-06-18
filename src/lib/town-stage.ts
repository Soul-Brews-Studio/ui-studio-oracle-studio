// Pure layout: districts → absolutely-positioned pixel "zones" on the town map,
// and a home rect per agent (the area its sprite wanders within). One zone per
// cluster: a campaign (orchestrator + its workers, together), a leaderless maw
// team, or the commons. District = tmux session.
import type { TownDistrict } from './town-group';

export interface StageZone {
  id: string;
  kind: 'campaign' | 'team' | 'commons';
  label: string;
  known?: boolean;
  leadId?: string;
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

const CELL = 124;      // screen room per sprite — bigger = more wander space
const PAD = 20;        // zone inner padding
const LABEL_H = 22;    // zone label strip
const GAP = 22;
const HEADER_H = 30;

// A zone's column count never exceeds `maxCols`, so a crowded zone (e.g. a big
// commons) wraps to more ROWS instead of overflowing the viewport — key for mobile.
function zoneSize(n: number, cell: number, pad: number, maxCols: number) {
  const cols = Math.min(maxCols, Math.max(1, Math.min(Math.max(n, 1), Math.ceil(Math.sqrt(Math.max(n, 1) * 1.6)))));
  const rows = Math.max(2, Math.ceil(Math.max(n, 1) / cols)); // ≥2 rows → vertical room to roam
  return { w: cols * cell + pad * 2, h: rows * cell + pad * 2 + LABEL_H };
}

export function buildStage(districts: TownDistrict[], stageWidth = 1180): Stage {
  // Responsive: shrink the cell/padding on narrow (mobile) widths.
  const narrow = stageWidth < 520;
  const cell = narrow ? 92 : CELL;
  const pad = narrow ? 12 : PAD;
  const gap = narrow ? 10 : GAP;
  const M = 8; // stage left/right margin
  const maxCols = Math.max(1, Math.floor((stageWidth - M * 2 - pad * 2) / cell));

  const zones: StageZone[] = [];
  const headers: StageHeader[] = [];
  const placements: Record<string, Placement> = {};
  let y = 8;

  for (const d of districts) {
    headers.push({ session: d.session, label: d.session, y, counts: d.counts });
    y += HEADER_H;

    let x = M, rowH = 0;
    for (const c of d.clusters) {
      const ids = c.lead ? [c.lead.id, ...c.members.map((m) => m.id)] : c.members.map((m) => m.id);
      if (!ids.length) continue;
      const sz = zoneSize(ids.length, cell, pad, maxCols);
      if (x + sz.w > stageWidth && x > M) { x = M; y += rowH + gap; rowH = 0; }
      zones.push({ id: c.key, kind: c.kind, label: c.label, known: c.known, leadId: c.lead?.id, session: d.session, x, y, w: sz.w, h: sz.h, agentIds: ids });
      const home = { x: x + pad, y: y + pad + LABEL_H, w: sz.w - pad * 2, h: sz.h - pad * 2 - LABEL_H };
      for (const id of ids) placements[id] = { home };
      x += sz.w + gap;
      rowH = Math.max(rowH, sz.h);
    }
    y += rowH + Math.round(gap * 1.6);
  }

  return { width: stageWidth, height: Math.ceil(y) + 8, zones, headers, placements };
}
