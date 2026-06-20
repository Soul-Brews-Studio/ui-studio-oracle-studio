// ai-town pixel spritesheet geometry (public/assets/town/folk.png, 384×1024).
// 32 characters in a 4×8 grid: the 8 ai-town base bodies recolored into 4 hue
// palettes (orig / +60 / +140 / +220) stacked vertically — indices 0-7 originals,
// 8-15 the +60 set, 16-23 the +140 set, 24-31 the +220 set. Each character is a
// 96×128 block of 32px tiles: rows = down/left/right/up, columns = 3 walk frames.
// (Base frame layout from a16z-infra/ai-town data/spritesheets/f1.ts.)

export const SHEET_URL = '/assets/town/folk.png';
export const TILE = 32;
export const SCALE = 2;                 // render sprites at 2× (crisp via image-rendering:pixelated)
export const SPRITE = TILE * SCALE;     // 64px on screen

const CHARS_PER_ROW = 4;
const CHAR_W = 96;   // 3 frames × 32
const CHAR_H = 128;  // 4 directions × 32

export const SHEET_W = 384 * SCALE;
export const SHEET_H = 1024 * SCALE;   // 4 hue palettes × 256

// direction → row within a character block
export const DIR = { down: 0, left: 1, right: 2, up: 3 } as const;
export type Dir = 0 | 1 | 2 | 3;

/** background-position for a given character / direction-row / walk-frame, at SCALE. */
export function bgPos(charIndex: number, dir: number, frame: number): string {
  const ox = (charIndex % CHARS_PER_ROW) * CHAR_W + frame * TILE;
  const oy = Math.floor(charIndex / CHARS_PER_ROW) * CHAR_H + dir * TILE;
  return `${-ox * SCALE}px ${-oy * SCALE}px`;
}
