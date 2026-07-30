// The terrain layer: biomes, rivers, lakes, bridges, and region landmarks.
//
// A coarse grid of REGION-sized squares sits above the chunk grid (one region
// = 4x4 chunks). Each region's biome — and its landmark, if any — is a pure
// function of (seed, rx, ry), so terrain is lazy exactly like chunks: nothing
// exists until you walk toward it, and the same seed always unfolds the same
// world. Water is analytic (no storage): rivers meander down fixed columns,
// lakes are ellipses inside lake regions, and bridges interrupt rivers at
// deterministic intervals.
//
// The 2x2 block of regions around the origin is always the home oak woods, so
// every story opens on dry, walkable ground.

import { coordRng, hashCoords } from './rng.js';

export const REGION = 640; // px per region side (4x4 chunks)
export const BIOMES = ['grass', 'oak', 'redwood', 'lake', 'mountain'];

export const RIVER_EVERY = 5; // a river column every 5 region-columns
export const RIVER_COL = 2; // ...on columns where rx % 5 === 2 (away from home)
export const RIVER_W = 26; // px across
export const BRIDGE_EVERY = 420; // px of river between bridges
export const BRIDGE_H = 14; // walkable span height
const MEANDER = 44; // max sideways drift (stays inside the column)
const MEANDER_STEP = 256; // px of y between meander control points

const SALT_BIOME = 0x7e77a917;
const SALT_RIVER = 0x52117e12;
const SALT_LAKE = 0x1a4e5a17;
const SALT_LODGE = 0x0cab1a50;

/** Which region a world point falls in. */
export function regionAt(x, y) {
  return { rx: Math.floor(x / REGION), ry: Math.floor(y / REGION) };
}

/** True for the 2x2 home-woods block around the origin. */
export function isHomeRegion(rx, ry) {
  return (rx === 0 || rx === -1) && (ry === 0 || ry === -1);
}

/** The region's biome — deterministic, weighted; home is always oak. */
export function biomeAt(seed, rx, ry) {
  if (isHomeRegion(rx, ry)) return 'oak';
  const r = coordRng((seed ^ SALT_BIOME) >>> 0, rx, ry)();
  if (r < 0.26) return 'grass';
  if (r < 0.56) return 'oak';
  if (r < 0.78) return 'redwood';
  if (r < 0.88) return 'lake';
  return 'mountain';
}

/** Does this region-column carry a river? */
export function regionHasRiver(rx) {
  return ((rx % RIVER_EVERY) + RIVER_EVERY) % RIVER_EVERY === RIVER_COL;
}

/** Smoothstep-interpolated meander offset for a river band at height y. */
function meander(seed, band, y) {
  const y0 = Math.floor(y / MEANDER_STEP);
  const t = (y - y0 * MEANDER_STEP) / MEANDER_STEP;
  const at = (k) => (hashCoords((seed ^ SALT_RIVER) >>> 0, band, k) / 0x100000000 - 0.5) * 2 * MEANDER;
  const s = t * t * (3 - 2 * t);
  return at(y0) + (at(y0 + 1) - at(y0)) * s;
}

/** Center-line x of the river column nearest to x (may be far away). */
export function riverNear(seed, x, y) {
  const rc = Math.floor(x / REGION);
  const mod = ((rc % RIVER_EVERY) + RIVER_EVERY) % RIVER_EVERY;
  const bandCol = rc + (RIVER_COL - mod); // nearest river column at or above rc
  const candidates = [bandCol, bandCol - RIVER_EVERY];
  let best = null;
  for (const col of candidates) {
    const band = Math.round((col - RIVER_COL) / RIVER_EVERY);
    const center = col * REGION + REGION / 2 + meander(seed, band, y);
    if (!best || Math.abs(x - center) < Math.abs(x - best.center)) best = { center, band };
  }
  return best;
}

/** Is (x, y) inside a river's water? (Bridges are handled separately.) */
export function inRiver(seed, x, y) {
  const r = riverNear(seed, x, y);
  return Math.abs(x - r.center) <= RIVER_W / 2;
}

/** The y of the bridge nearest to y along a river band. */
export function bridgeYNear(seed, band, y) {
  const k = Math.floor(y / BRIDGE_EVERY);
  let best = Infinity;
  for (const kk of [k - 1, k, k + 1]) {
    const j = hashCoords((seed ^ SALT_RIVER) >>> 0, band ^ 0x5a5a5a, kk) / 0x100000000;
    const by = kk * BRIDGE_EVERY + (0.25 + j * 0.5) * BRIDGE_EVERY;
    if (Math.abs(by - y) < Math.abs(best - y)) best = by;
  }
  return best;
}

/** Is (x, y) on a bridge deck (walkable, drawn as planks)? */
export function onBridge(seed, x, y) {
  const r = riverNear(seed, x, y);
  if (Math.abs(x - r.center) > RIVER_W / 2 + 3) return false;
  return Math.abs(y - bridgeYNear(seed, r.band, y)) <= BRIDGE_H / 2;
}

/** The lake ellipse of a lake region (null otherwise). */
export function lakeAt(seed, rx, ry) {
  if (biomeAt(seed, rx, ry) !== 'lake') return null;
  const r = coordRng((seed ^ SALT_LAKE) >>> 0, rx, ry);
  return {
    cx: rx * REGION + REGION * (0.35 + r() * 0.3),
    cy: ry * REGION + REGION * (0.35 + r() * 0.3),
    a: REGION * (0.16 + r() * 0.12),
    b: REGION * (0.12 + r() * 0.12),
  };
}

/** Is (x, y) water — river (minus bridges) or lake? */
export function isWater(seed, x, y) {
  const river = riverNear(seed, x, y);
  if (Math.abs(x - river.center) <= RIVER_W / 2) {
    if (Math.abs(y - bridgeYNear(seed, river.band, y)) > BRIDGE_H / 2) return true;
  }
  const { rx, ry } = regionAt(x, y);
  const lake = lakeAt(seed, rx, ry);
  if (!lake) return false;
  const dx = (x - lake.cx) / lake.a;
  const dy = (y - lake.cy) / lake.b;
  return dx * dx + dy * dy <= 1;
}

/**
 * A region's fixed contents: its biome, its lake, and its landmark if any —
 * a mysterious cabin (some forest/grass regions) or a cave mouth (every
 * mountain region). Landmarks that would drown are dropped, not moved.
 */
export function regionInfo(seed, rx, ry) {
  const biome = biomeAt(seed, rx, ry);
  const info = { rx, ry, biome, cabin: null, cave: null, lake: lakeAt(seed, rx, ry) };
  const r = coordRng((seed ^ SALT_LODGE) >>> 0, rx, ry);
  if (!isHomeRegion(rx, ry) && (biome === 'oak' || biome === 'redwood' || biome === 'grass')) {
    const roll = r();
    const x = rx * REGION + Math.floor(REGION * (0.15 + r() * 0.7));
    const y = ry * REGION + Math.floor(REGION * (0.15 + r() * 0.7));
    if (roll < 0.1 && !isWater(seed, x, y)) info.cabin = { x, y };
  } else if (biome === 'mountain') {
    const x = rx * REGION + Math.floor(REGION * (0.25 + r() * 0.5));
    const y = ry * REGION + Math.floor(REGION * (0.25 + r() * 0.5));
    if (!isWater(seed, x, y)) info.cave = { x, y };
  }
  return info;
}

/** What a region contributes to the remembered map. */
export function regionLandmarks(seed, rx, ry) {
  const info = regionInfo(seed, rx, ry);
  const river = regionHasRiver(rx);
  return {
    biome: info.biome,
    cabin: !!info.cabin,
    cave: !!info.cave,
    water: info.biome === 'lake' || river,
    // Rivers cross a bridge at least once per region height (spacing math:
    // max bridge gap 630px < REGION 640).
    bridge: river,
  };
}
