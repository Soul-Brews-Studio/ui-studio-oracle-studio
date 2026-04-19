// Type → hex palette + age lightness modifier. Pure data-only.

export const TYPE_COLORS: Record<string, string> = {
  principle: '#60a5fa',
  learning: '#a78bfa',
  retro: '#fbbf24',
  unknown: '#888888',
};

const FALLBACK = '#888888';

export function clusterColorFromTypes(counts: Record<string, number>): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const [type, n] of Object.entries(counts)) {
    if (!n || n <= 0) continue;
    const [cr, cg, cb] = hexToRgb(TYPE_COLORS[type] ?? FALLBACK);
    r += cr * n;
    g += cg * n;
    b += cb * n;
    total += n;
  }
  if (total === 0) return FALLBACK;
  return rgbToHex(Math.round(r / total), Math.round(g / total), Math.round(b / total));
}

export function planetColor(type: string, ageDays: number): string {
  const base = TYPE_COLORS[type] ?? FALLBACK;
  let shift = 0;
  if (ageDays < 7) shift = 0.2;
  else if (ageDays > 30) shift = -0.2;
  return shiftLightness(base, shift);
}

export function ageInDays(createdAt: number | null | undefined, now: number = Date.now()): number {
  if (createdAt == null) return Infinity;
  return Math.max(0, (now - createdAt) / 86_400_000);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}

function shiftLightness(hex: string, delta: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (delta === 0) return hex;
  if (delta > 0) {
    return rgbToHex(
      Math.round(r + (255 - r) * delta),
      Math.round(g + (255 - g) * delta),
      Math.round(b + (255 - b) * delta),
    );
  }
  const f = 1 + delta;
  return rgbToHex(Math.round(r * f), Math.round(g * f), Math.round(b * f));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
