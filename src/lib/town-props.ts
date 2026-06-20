// Ambient props for Fleet Town — purely decorative nature (trees/bushes/rocks/
// grass tufts) and animated objects (campfire, windmill, water sparkle) scattered
// over the grass between zones. Reflects the map's *atmosphere* only — never agent
// state (Oracle/Shadow P-002/P-003: the town mirrors, it never drives or implies).
//
// Placement is DETERMINISTIC and seeded by GRID CELL, not by the agent set: a
// prop's spot is a pure function of where it sits on the map, so props stay put
// as agents come and go. A prop is dropped only when its cell is clear of every
// zone, so it simply hides when a zone grows over it (instead of teleporting).
//
// The ground + nature decos are the Cainos "Pixel Art Top Down - Basic" set (one
// cohesive 32px pack; decos ship with transparent backgrounds + baked shadows).
// The animated campfire/windmill/sparkle are ai-town sheets (no Cainos equivalent)
// and keep ai-town's frame geometry. See public/assets/town/CREDITS.md.
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
export interface DecoSpec { url: string; w: number; h: number }  // on-screen render px (aspect-correct)

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
} satisfies Record<string, AnimSpec>;
export type AnimKind = keyof typeof ANIMS;

// Static nature decorations (Cainos, transparent + baked shadow). Render px is 2×
// the trimmed native size, matching the folk-sprite / grass 2× pixel scale.
export const DECOS = {
  tree: { url: `${A}/tree.png`, w: 256, h: 272 },  // native 128×136 — the lush landmark
  bush: { url: `${A}/bush.png`, w: 64, h: 62 },    // native 32×31
  rock: { url: `${A}/rock.png`, w: 58, h: 54 },    // native 29×27
  tuft: { url: `${A}/tuft.png`, w: 98, h: 20 },    // native 49×10 — grass clump
} satisfies Record<string, DecoSpec>;
export type DecoKind = keyof typeof DECOS;

// A single Cainos statue monument — the town's landmark (replaces the off-set
// ai-town windmill). Placed once in the open top-right grass.
export const LANDMARK: DecoSpec = { url: `${A}/landmark.png`, w: 92, h: 146 };

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

// Does a w×h box at (x,y) intersect any zone (grown by margin `m`)?
function overlapsZone(x: number, y: number, w: number, h: number, zones: StageZone[], m: number): boolean {
  for (const z of zones) {
    if (x + w > z.x - m && x < z.x + z.w + m && y + h > z.y - m && y < z.y + z.h + m) return true;
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

      if (roll < 0.12) {                                      // water sparkles
        const s = ANIMS.sparkle.size;
        if (!overlapsZone(x, y, s, s, zones, 4))
          anims.push({ id: `s${cx}-${cy}`, x, y, spec: ANIMS.sparkle });
      } else {                                                // the rest is nature
        const spec = roll < 0.40 ? DECOS.tuft : roll < 0.66 ? DECOS.bush
          : roll < 0.86 ? DECOS.rock : DECOS.tree;
        if (!overlapsZone(x, y, spec.w, spec.h, zones, 4))
          decos.push({ id: `d${cx}-${cy}`, x, y, spec });
      }
    }
  }

  // One statue landmark: first clear spot scanning the top-right grass.
  outer: for (let gx = Math.floor(width * 0.62); gx + LANDMARK.w < width - 6; gx += GRID) {
    for (let gy = 6; gy + LANDMARK.h < height - 6; gy += GRID) {
      if (!overlapsZone(gx, gy, LANDMARK.w, LANDMARK.h, zones, 10)) {
        decos.push({ id: 'landmark', x: gx, y: gy, spec: LANDMARK });
        break outer;
      }
    }
  }

  return { decos, anims };
}
