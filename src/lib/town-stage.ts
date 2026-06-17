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

const CELL = 80;
const PAD = 16;
const LABEL_H = 20;
const GAP = 18;
const STAGE_W = 1180;
const HEADER_H = 30;

function zoneSize(n: number) {
  const cols = Math.max(1, Math.min(Math.max(n, 1), Math.ceil(Math.sqrt(Math.max(n, 1) * 1.7))));
  const rows = Math.ceil(Math.max(n, 1) / cols);
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

    let x = 8, rowH = 0;
    for (const c of d.clusters) {
      const ids = c.lead ? [c.lead.id, ...c.members.map((m) => m.id)] : c.members.map((m) => m.id);
      if (!ids.length) continue;
      const sz = zoneSize(ids.length);
      if (x + sz.w > STAGE_W && x > 8) { x = 8; y += rowH + GAP; rowH = 0; }
      zones.push({ id: c.key, kind: c.kind, label: c.label, known: c.known, leadId: c.lead?.id, session: d.session, x, y, w: sz.w, h: sz.h, agentIds: ids });
      const home = { x: x + PAD, y: y + PAD + LABEL_H, w: sz.w - PAD * 2, h: sz.h - PAD * 2 - LABEL_H };
      for (const id of ids) placements[id] = { home };
      x += sz.w + GAP;
      rowH = Math.max(rowH, sz.h);
    }
    y += rowH + Math.round(GAP * 1.6);
  }

  return { width: STAGE_W, height: Math.ceil(y) + 8, zones, headers, placements };
}
