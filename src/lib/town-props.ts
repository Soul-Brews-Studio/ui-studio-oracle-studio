// Ambient props for Fleet Town — purely decorative nature (trees/bushes/flowers/
// logs) and animated objects (campfire, windmill, water sparkle) scattered over
// the grass between zones. Reflects the map's *atmosphere* only — never agent
// state (Oracle/Shadow P-002/P-003: the town mirrors, it never drives or implies).
//
// Placement is DETERMINISTIC and seeded by GRID CELL, not by the agent set: a
// prop's spot is a pure function of where it sits on the map, so props stay put
// as agents come and go. A prop is dropped only when its cell is clear of every
// zone, so it simply hides when a zone grows over it (instead of teleporting).
//
// Sprites come from ai-town's Gentle Forest tileset (CC0) — see
// public/assets/town/CREDITS.md. The animated sheets keep ai-town's frame
// geometry (data/animations/*.json); decoration PNGs are pre-trimmed crops.
import type { Stage, StageZone } from './town-stage';

const A = '/assets/town';

export interface AnimSpec {
  url: string;
  fw: number; fh: number;            // source frame size (px)
  sheetW: number; sheetH: number;    // full sheet size (px)
  frames: Array<[number, number]>;   // top-left of each frame in the sheet
  fps: number;
  size: number;                      // on-screen render box (px)
}
export interface DecoSpec { url: string; size: number }

// Animated objects. Frame coords mirror ai-town data/animations/*.json.
export const ANIMS = {
  campfire: {
    url: `${A}/campfire.png`, fw: 32, fh: 32, sheetW: 128, sheetH: 32,
    frames: [[0, 0], [32, 0], [64, 0], [96, 0]], fps: 8, size: 34,
  },
  sparkle: {
    url: `${A}/sparkle.png`, fw: 32, fh: 32, sheetW: 96, sheetH: 96,
    frames: [[0, 0], [32, 0], [64, 0]], fps: 6, size: 24,
  },
  windmill: {
    url: `${A}/windmill.png`, fw: 208, fh: 208, sheetW: 624, sheetH: 624,
    frames: [[0, 0], [208, 0], [416, 0], [0, 208], [208, 208], [416, 208], [0, 416], [208, 416]],
    fps: 7, size: 104,
  },
} satisfies Record<string, AnimSpec>;
export type AnimKind = keyof typeof ANIMS;

// Static nature decorations (pre-trimmed square PNGs).
export const DECOS = {
  tree:    { url: `${A}/tree.png`,    size: 58 },
  bush:    { url: `${A}/bush.png`,    size: 38 },
  flowers: { url: `${A}/flowers.png`, size: 34 },
  logs:    { url: `${A}/logs.png`,    size: 40 },
} satisfies Record<string, DecoSpec>;
export type DecoKind = keyof typeof DECOS;

export interface PlacedDeco { id: string; x: number; y: number; spec: DecoSpec }
export interface PlacedAnim { id: string; x: number; y: number; spec: AnimSpec }
export interface TownProps { decos: PlacedDeco[]; anims: PlacedAnim[] }

// Deterministic [0,1) hash of an integer (mulberry-ish finalizer).
function hash1(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const rng = (a: number, b: number) => hash1(((a * 73856093) ^ (b * 19349663)) >>> 0);

// Does a `size`-box at (x,y) intersect any zone (grown by margin `m`)?
function overlapsZone(x: number, y: number, size: number, zones: StageZone[], m: number): boolean {
  for (const z of zones) {
    if (x + size > z.x - m && x < z.x + z.w + m && y + size > z.y - m && y < z.y + z.h + m) return true;
  }
  return false;
}

const GRID = 76;       // candidate spacing (px)
const FILL = 0.42;     // fraction of clear cells that get a prop

// Compute the decorative props for a built stage. Pure + deterministic.
export function buildProps(stage: Stage): TownProps {
  const { width, height, zones } = stage;
  const decos: PlacedDeco[] = [];
  const anims: PlacedAnim[] = [];

  // A campfire always burns at the centre of every team/campaign cluster — the
  // group's "hearth" that its members wander around. Intentionally placed inside
  // the zone (skips the overlap check); commons is loose individuals, not a team.
  for (const z of zones) {
    if (z.kind === 'commons') continue;
    const s = ANIMS.campfire.size;
    anims.push({ id: `hearth-${z.id}`, x: z.x + z.w / 2 - s / 2, y: z.y + z.h / 2 - s / 2, spec: ANIMS.campfire });
  }

  for (let gx = 6; gx + GRID < width; gx += GRID) {
    for (let gy = 6; gy + GRID < height; gy += GRID) {
      const cx = Math.round(gx / GRID), cy = Math.round(gy / GRID);
      if (rng(cx, cy) > FILL) continue;                       // this cell stays empty
      const x = gx + rng(cx + 11, cy) * (GRID - 44);          // jitter within the cell
      const y = gy + rng(cx, cy + 7) * (GRID - 44);
      const roll = rng(cx + 3, cy + 5);

      if (roll < 0.14) {                                      // water sparkles
        if (!overlapsZone(x, y, ANIMS.sparkle.size, zones, 4))
          anims.push({ id: `s${cx}-${cy}`, x, y, spec: ANIMS.sparkle });
      } else {                                                // the rest is nature
        const spec = roll < 0.56 ? DECOS.tree : roll < 0.76 ? DECOS.bush
          : roll < 0.90 ? DECOS.flowers : DECOS.logs;
        if (!overlapsZone(x, y, spec.size, zones, 4))
          decos.push({ id: `d${cx}-${cy}`, x, y, spec });
      }
    }
  }

  // One windmill landmark: first clear spot scanning the top-right grass.
  const wm = ANIMS.windmill;
  outer: for (let gx = Math.floor(width * 0.62); gx + wm.size < width - 6; gx += GRID) {
    for (let gy = 6; gy + wm.size < height - 6; gy += GRID) {
      if (!overlapsZone(gx, gy, wm.size, zones, 10)) {
        anims.push({ id: 'windmill', x: gx, y: gy, spec: wm });
        break outer;
      }
    }
  }

  return { decos, anims };
}
