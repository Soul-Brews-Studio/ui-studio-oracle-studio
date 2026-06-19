// Per-zone floor textures for the town. A zone (team/campaign cluster) can be
// given a floor; the choice is stored in localStorage keyed by the zone id
// (the cluster key). A new team with no saved choice falls back to 'default'
// (no texture — the translucent tint over the stage grass).
export interface FloorTexture { id: string; name: string; url?: string; size?: number }

const A = '/assets/town';
// All textured (not flat): real cobblestone / earth / water / wood / brick / etc.
export const TEXTURES: FloorTexture[] = [
  { id: 'default', name: 'Default' },                                          // translucent over stage grass
  { id: 'grass', name: 'Grass', url: `${A}/grass.png`, size: 256 },
  { id: 'dark', name: 'Dark grass', url: `${A}/floor-dark.png`, size: 256 },
  { id: 'cobble', name: 'Cobble', url: `${A}/floor-cobble.png`, size: 64 },
  { id: 'darkcobble', name: 'Dark cobble', url: `${A}/floor-darkcobble.png`, size: 64 },
  { id: 'tile', name: 'Tile floor', url: `${A}/floor-tile.png`, size: 64 },
  { id: 'gravel', name: 'Gravel', url: `${A}/floor-gravel.png`, size: 64 },
  { id: 'dirt', name: 'Dirt', url: `${A}/floor-dirt.png`, size: 64 },
  { id: 'brick', name: 'Brick', url: `${A}/floor-brick.png`, size: 64 },
  { id: 'wood', name: 'Wood', url: `${A}/floor-wood.png`, size: 64 },
  { id: 'water', name: 'Water', url: `${A}/floor-water.png`, size: 64 },
  { id: 'lava', name: 'Lava', url: `${A}/floor-lava.png`, size: 64 },
];
export const textureById = (id: string): FloorTexture | undefined => TEXTURES.find((t) => t.id === id);

const LS = 'town:zone-textures';
export function loadZoneTextures(): Record<string, string> {
  try { const v = JSON.parse(localStorage.getItem(LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch { return {}; }
}
export function saveZoneTextures(map: Record<string, string>): void {
  try { localStorage.setItem(LS, JSON.stringify(map)); } catch { /* ignore */ }
}
