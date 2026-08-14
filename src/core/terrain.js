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

export const REGION = 960; // px per region side (4x4 chunks)

// Every biome either plane can deal. Night keeps its five; heaven (v0.20)
// adds sun-struck ones — desert, beach, glacier — plus the island.
export const NIGHT_BIOMES = ['grass', 'oak', 'redwood', 'lake', 'mountain'];
export const HEAVEN_BIOMES = ['grass', 'oak', 'redwood', 'lake', 'mountain', 'desert', 'beach', 'glacier', 'island'];
export const BIOMES = NIGHT_BIOMES; // night's list, kept for existing callers

// Which biome table a seed deals from. Worlds register their plane at
// construction (deterministic per seed within a session; 'night' default).
const BIOME_SETS = new Map();
export function setBiomeSet(seed, set) {
  BIOME_SETS.set(seed >>> 0, set);
}
export function biomeSetOf(seed) {
  return BIOME_SETS.get(seed >>> 0) ?? 'night';
}

// Heaven's fixed places (region coordinates, heaven seeds only).
// The island sits well off the beaten path — reachable by swimming, or in
// style by boat. God lives on a lake shore ringed by redwoods. Neither
// region column carries a river (rx % 5 !== RIVER_COL).
export const ISLAND_REGION = { rx: 3, ry: -3 };
export const GOD_REGION = { rx: -2, ry: 2 };

export const RIVER_EVERY = 5; // a river column every 5 region-columns
export const RIVER_COL = 2; // ...on columns where rx % 5 === 2 (away from home)
export const RIVER_W = 39; // px across
export const BRIDGE_EVERY = 630; // px of river between bridges
export const BRIDGE_H = 21; // walkable span height
const MEANDER = 66; // max sideways drift (stays inside the column)
const MEANDER_STEP = 384; // px of y between meander control points

const SALT_BIOME = 0x7e77a917;
const SALT_RIVER = 0x52117e12;
const SALT_LAKE = 0x1a4e5a17;
const SALT_LODGE = 0x0cab1a50;
const SALT_SIGN = 0x516e0d17; // signs to God (heaven)
const SALT_MINO = 0x3417a0b5; // the minotaur's rare regions (heaven)
const SALT_TOWN = 0x707a57e1; // ghost towns (night)

/** Which region a world point falls in. */
export function regionAt(x, y) {
  return { rx: Math.floor(x / REGION), ry: Math.floor(y / REGION) };
}

/** True for the 2x2 home-woods block around the origin. */
export function isHomeRegion(rx, ry) {
  return (rx === 0 || rx === -1) && (ry === 0 || ry === -1);
}

/**
 * The region's biome — deterministic, weighted; home is always oak. Heaven
 * seeds deal from a wider deck, and hold two fixed places: the island (all
 * water but its heart) and God's lake, ringed by a redwood grove.
 */
export function biomeAt(seed, rx, ry) {
  if (isHomeRegion(rx, ry)) return 'oak';
  const heaven = biomeSetOf(seed) === 'heaven';
  if (heaven) {
    if (rx === ISLAND_REGION.rx && ry === ISLAND_REGION.ry) return 'island';
    if (rx === GOD_REGION.rx && ry === GOD_REGION.ry) return 'lake';
    if (Math.abs(rx - GOD_REGION.rx) <= 1 && Math.abs(ry - GOD_REGION.ry) <= 1) return 'redwood';
  }
  const r = coordRng((seed ^ SALT_BIOME) >>> 0, rx, ry)();
  if (!heaven) {
    if (r < 0.26) return 'grass';
    if (r < 0.56) return 'oak';
    if (r < 0.78) return 'redwood';
    if (r < 0.88) return 'lake';
    return 'mountain';
  }
  if (r < 0.16) return 'grass';
  if (r < 0.34) return 'oak';
  if (r < 0.5) return 'redwood';
  if (r < 0.64) return 'desert';
  if (r < 0.74) return 'beach';
  if (r < 0.84) return 'glacier';
  if (r < 0.94) return 'lake';
  return 'mountain';
}

/** The island's land ellipse (heaven's island region only; null otherwise). */
export function islandAt(seed, rx, ry) {
  if (biomeAt(seed, rx, ry) !== 'island') return null;
  return {
    cx: rx * REGION + REGION / 2,
    cy: ry * REGION + REGION / 2,
    a: REGION * 0.22,
    b: REGION * 0.16,
  };
}

/** Where God is (heaven seeds): the east shore of the lake in GOD_REGION. */
export function godSpot(seed) {
  const lake = lakeAt(seed, GOD_REGION.rx, GOD_REGION.ry);
  if (!lake) return null;
  return { x: Math.round(lake.cx + lake.a + 21), y: Math.round(lake.cy) };
}

/**
 * The lilypads where the frogs sit, menacing God from the water — three of
 * them, in the lake's eastern reach.
 */
export function lilypadsAt(seed) {
  const lake = lakeAt(seed, GOD_REGION.rx, GOD_REGION.ry);
  if (!lake) return [];
  const r = coordRng((seed ^ SALT_SIGN) >>> 0, GOD_REGION.rx, GOD_REGION.ry);
  const pads = [];
  for (let i = 0; i < 3; i++) {
    pads.push({
      x: Math.round(lake.cx + lake.a * (0.35 + r() * 0.4)),
      y: Math.round(lake.cy + (r() - 0.5) * lake.b * 1.1),
      phase: r() * Math.PI * 2,
    });
  }
  return pads;
}

/** A sign to God in this heaven region (about 1 in 5), or null. */
export function signAt(seed, rx, ry) {
  if (biomeSetOf(seed) !== 'heaven') return null;
  if (rx === GOD_REGION.rx && ry === GOD_REGION.ry) return null; // you're here
  if (biomeAt(seed, rx, ry) === 'island') return null;
  const h = hashCoords((seed ^ SALT_SIGN) >>> 0, rx, ry);
  if (h % 5 !== 0) return null;
  const x = rx * REGION + 120 + ((h >> 8) % (REGION - 240));
  const y = ry * REGION + 120 + ((h >> 16) % (REGION - 240));
  if (isWater(seed, x, y)) return null;
  return { x, y };
}

/** The minotaur's home region (heaven, rare rare rare), or null. */
export function minotaurAt(seed, rx, ry) {
  if (biomeSetOf(seed) !== 'heaven') return null;
  if (isHomeRegion(rx, ry)) return null;
  const biome = biomeAt(seed, rx, ry);
  if (biome === 'island' || biome === 'lake') return null;
  if (Math.abs(rx - GOD_REGION.rx) <= 1 && Math.abs(ry - GOD_REGION.ry) <= 1) return null;
  const h = hashCoords((seed ^ SALT_MINO) >>> 0, rx, ry);
  if (h % 53 !== 0) return null; // rare, rare, rare
  return {
    x: rx * REGION + REGION * 0.35 + ((h >> 8) % Math.round(REGION * 0.3)),
    y: ry * REGION + REGION * 0.35 + ((h >> 16) % Math.round(REGION * 0.3)),
    phase: ((h >> 4) % 628) / 100,
  };
}

/**
 * The ghost town of this night region (about 1 in 45 dry grass/oak regions),
 * or null: a handful of ruins, the merchant ghost Pirts, a leaning sign, the
 * bail-bonds office on the outskirts, and the ghosts themselves — each with
 * a temperament dealt at generation.
 */
export function townAt(seed, rx, ry) {
  if (biomeSetOf(seed) !== 'night') return null;
  if (isHomeRegion(rx, ry)) return null;
  const biome = biomeAt(seed, rx, ry);
  if (biome !== 'grass' && biome !== 'oak') return null;
  const h = hashCoords((seed ^ SALT_TOWN) >>> 0, rx, ry);
  if (h % 45 !== 0) return null;
  const cx = rx * REGION + REGION / 2 + ((h >> 8) % 120) - 60;
  const cy = ry * REGION + REGION / 2 + ((h >> 16) % 120) - 60;
  if (isWater(seed, cx, cy)) return null;
  const r = coordRng((seed ^ SALT_TOWN) >>> 0, rx, ry);
  const ruins = [
    { x: cx - 150, y: cy - 45, variant: 0 },
    { x: cx - 30, y: cy - 100, variant: 1 },
    { x: cx + 95, y: cy - 60, variant: 2 },
    { x: cx + 175, y: cy + 20, variant: Math.floor(r() * 3) },
  ].filter((b) => !isWater(seed, b.x, b.y));
  const ghosts = [];
  for (let i = 0; i < 6; i++) {
    const angle = r() * Math.PI * 2;
    const dist = 50 + r() * 130;
    const roll = r();
    ghosts.push({
      x: Math.round(cx + Math.cos(angle) * dist),
      y: Math.round(cy + Math.sin(angle) * dist),
      phase: r() * Math.PI * 2,
      variant: Math.floor(r() * 3),
      temper: roll < 0.3 ? 'hostile' : roll < 0.6 ? 'sullen' : 'drifting',
    });
  }
  return {
    cx,
    cy,
    ruins,
    ghosts: ghosts.filter((g) => !isWater(seed, g.x, g.y)),
    pirts: { x: cx + 8, y: cy + 42 },
    sign: { x: cx - 45, y: cy + 118 },
    office: { x: cx + 245, y: cy + 150 },
  };
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

/** Is (x, y) water — river (minus bridges), lake, or the island's sea? */
export function isWater(seed, x, y) {
  const { rx, ry } = regionAt(x, y);
  const island = islandAt(seed, rx, ry);
  if (island) {
    // The island region is all water except its heart of land.
    const dx = (x - island.cx) / island.a;
    const dy = (y - island.cy) / island.b;
    return dx * dx + dy * dy > 1;
  }
  const river = riverNear(seed, x, y);
  if (Math.abs(x - river.center) <= RIVER_W / 2) {
    if (Math.abs(y - bridgeYNear(seed, river.band, y)) > BRIDGE_H / 2) return true;
  }
  const lake = lakeAt(seed, rx, ry);
  if (!lake) return false;
  const dx = (x - lake.cx) / lake.a;
  const dy = (y - lake.cy) / lake.b;
  return dx * dx + dy * dy <= 1;
}

/**
 * A region's fixed contents: its biome, its lake, and its landmark if any —
 * a mysterious cabin (some forest/grass regions), a brooding mansion (rarer
 * still, same roll so older worlds keep their cabins where they were), or a
 * cave mouth (every mountain region). Landmarks that would drown are
 * dropped, not moved.
 */
export function regionInfo(seed, rx, ry) {
  const biome = biomeAt(seed, rx, ry);
  const info = {
    rx,
    ry,
    biome,
    cabin: null,
    mansion: null,
    cave: null,
    lake: lakeAt(seed, rx, ry),
    // v0.20 landmarks (each null unless this region carries one). These use
    // their own salted hashes, so the cabin/mansion/cave draws below are
    // byte-identical to older versions.
    island: islandAt(seed, rx, ry),
    sign: signAt(seed, rx, ry),
    minotaur: minotaurAt(seed, rx, ry),
    town: townAt(seed, rx, ry),
  };
  const r = coordRng((seed ^ SALT_LODGE) >>> 0, rx, ry);
  if (!isHomeRegion(rx, ry) && (biome === 'oak' || biome === 'redwood' || biome === 'grass')) {
    const roll = r();
    const x = rx * REGION + Math.floor(REGION * (0.15 + r() * 0.7));
    const y = ry * REGION + Math.floor(REGION * (0.15 + r() * 0.7));
    if (roll < 0.1 && !isWater(seed, x, y)) info.cabin = { x, y };
    else if (roll < 0.14 && !isWater(seed, x, y)) info.mansion = { x, y };
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
    mansion: !!info.mansion,
    cave: !!info.cave,
    water: info.biome === 'lake' || river || info.biome === 'island',
    // Rivers cross a bridge at least once per region height (spacing math:
    // max bridge gap 945px < REGION 960).
    bridge: river,
    town: !!info.town,
    island: !!info.island,
    god: biomeSetOf(seed) === 'heaven' && rx === GOD_REGION.rx && ry === GOD_REGION.ry,
  };
}
