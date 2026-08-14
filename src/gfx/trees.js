// Procedural trees — the signature look, rebuilt for 16-bit in v0.16.
//
// The reference's dither used 2x1 double-wide blocks (an Atari-era
// affectation): at the old 3x upscale every fleck was six device pixels
// across, which is most of why the game still read as 8-bit. Blocks are now
// single pixels, so a canopy has six times the horizontal resolution to
// describe an edge with.
//
// Shading is deliberate rather than random: a 4x4 ordered (Bayer) matrix
// blends each band into the next, so tiers read as lit planes falling into
// shadow instead of noise. The moon is high and to the right — canopy tops
// and right flanks climb the ramp, undersides and left flanks fall.
//
// The Secret-of-Mana pass: two interfering waves clump each canopy into
// rounded leaf-lobes, the gaps mostly fill with deep plum shadow instead of
// showing the night through, the inner lower-left of every tier falls into a
// smoke core, and moonlit crown flecks (plus rare fern accents) sit on top.
// And the conical pines are noir Christmas trees: sagging diagonal garlands
// of tiny lights wrap the canopy — magenta, pink, hot rose, gold, violet,
// blue — each with a bright core and a soft halo, twinkling as a pure
// function of (tree, light index, time). No Math.random anywhere.
//
// This module is pure geometry: treePixels() returns colored pixel offsets
// relative to the tree's anchor (trunk base center). The renderer rasterizes
// and caches them; tests pin determinism and bounds without a canvas.

import { mulberry32, hashCoords, pick } from '../core/rng.js';
import { PALETTE } from './palette.js';

export const BLOCK_W = 1; // one pixel per pixel, at last
export const BLOCK_H = 1;

// Bark: dirt and wine, dark. Index 0 is the shadow side, up toward the light.
const BARK_RAMP = [PALETTE.soil, PALETTE.plumDeep, PALETTE.dirt, PALETTE.clay, PALETTE.loam];

// Canopy ramps, darkest first. 'ember' is the violet forest; 'leafy' is the
// rarer smoke-and-moss crown.
const CANOPY_RAMPS = {
  ember: [PALETTE.plumDeep, PALETTE.plum, PALETTE.purple, PALETTE.violet, PALETTE.orchid],
  leafy: [PALETTE.pine, PALETTE.moss, PALETTE.smokeDeep, PALETTE.fern, PALETTE.smoke],
};

// Rare warm flecks caught in the crown.
const EMBERS = [PALETTE.magenta, PALETTE.pink, PALETTE.gold];

const LITTER_RAMP = [PALETTE.soil, PALETTE.dirt, PALETTE.clay, PALETTE.plumDeep];

// The garland bulbs. Three parallel arrays indexed together: the steady core,
// the dimmer halo that bleeds into the needles around it, and the hotter
// flare the core surges to at the top of its twinkle. Every entry is a
// palette color, and none of them is MOON — moonlight inverts to ink in
// heaven, where these have to keep reading as lights on the cream.
const LIGHT_CORES = [PALETTE.magenta, PALETTE.pink, PALETTE.hotRose, PALETTE.gold, PALETTE.violet, PALETTE.blue];
const LIGHT_HALOS = [PALETTE.purple, PALETTE.magenta, PALETTE.pink, PALETTE.brass, PALETTE.purple, PALETTE.waterEdge];
const LIGHT_FLARES = [PALETTE.pink, PALETTE.hotRose, PALETTE.goldRose, PALETTE.goldRose, PALETTE.orchid, PALETTE.orchid];

// 4x4 Bayer matrix, normalized to [0,1) — the classic ordered dither.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bayer = (x, y) => BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16;

/**
 * Pick a ramp color for a continuous lightness in [0,1], dithering between
 * the two nearest steps by screen position. This is what makes a gradient
 * read as one surface rather than as bands.
 */
function shade(ramp, level, x, y) {
  const t = Math.max(0, Math.min(0.999, level)) * (ramp.length - 1);
  const i = Math.floor(t);
  return ramp[i + (t - i > bayer(x, y) ? 1 : 0)] ?? ramp[ramp.length - 1];
}

/**
 * A garland bulb's private hash — a pure function of the tree's identity and
 * the bulb's index along the strings, so a light keeps its phase, rate, and
 * halo side across every regeneration of the tree. Reads only fields the
 * renderer's sprite-cache key already includes (detailSeed, size).
 */
function lightHash(tree, index) {
  return hashCoords((tree.detailSeed ?? 0) >>> 0, Math.imul(index + 1, 0x9e3779b1) | 0, tree.size | 0);
}

/**
 * Generate a tree's (or bush's) pixels.
 * Returns { pixels: [{x, y, c}], minX, minY, maxX, maxY } with offsets
 * relative to the anchor at (0, 0) = trunk base center; negative y is up.
 *
 * `time` (seconds, optional) only twinkles the garland lights — geometry and
 * every other color are independent of it, and time = 0 keeps the whole
 * output a pure function of the tree object.
 */
export function treePixels(tree, time = 0) {
  const rng = mulberry32(tree.detailSeed);
  if (tree.kind === 'bush') return bushPixels(tree, rng);

  const pixels = [];
  const H = tree.size;
  const trunkH = Math.round(H * 0.6);
  const baseHalf = Math.max(2, Math.round(H * 0.055));

  // Trunk: a round-lit column that narrows as it rises, wandering slightly.
  // Lightness runs across the trunk (dark left, lit right) and drops toward
  // the canopy's shadow.
  let wobble = 0;
  for (let y = 0; y >= -trunkH; y--) {
    const t = -y / trunkH; // 0 at base, 1 at top
    const half = Math.max(1, Math.round(baseHalf * (1 - t * 0.45)));
    if (rng() < 0.22) wobble += rng() < 0.5 ? -1 : 1;
    wobble = Math.max(-3, Math.min(3, wobble));
    for (let x = -half; x <= half; x++) {
      const across = (x + half) / (2 * half || 1); // 0 left, 1 right
      let level = 0.15 + across * 0.75 - t * 0.2;
      if (rng() < 0.12) level -= 0.25; // bark scarring
      pixels.push({ x: x + wobble, y, c: shade(BARK_RAMP, level, x + wobble, y) });
    }
  }

  // Canopy: stacked tiers — an angular pine silhouette gone plush. Each tier
  // widens to a shelf whose edge now scallops roundly; the rows just under a
  // shelf fall into that tier's own shadow, and the crown of each tier
  // catches the moon. Two interfering waves (lobeA/lobeB) clump the interior
  // into rounded leaf-lobes, and the inner lower-left of each tier drops
  // into a plum-smoke core.
  const ramp = CANOPY_RAMPS[tree.variant] ?? CANOPY_RAMPS.ember;
  const canopyH = Math.max(12, Math.round(H * 0.56));
  const topY = -trunkH - canopyH;
  const canopyHalf = Math.max(6, Math.round(H * 0.38));
  const tiers = 2 + Math.floor(rng() * 2);
  const tierRows = Math.ceil(canopyH / tiers);
  const lobeA = rng() * Math.PI * 2;
  const lobeB = rng() * Math.PI * 2;
  const rowHalf = []; // final half-width per canopy row, for the garlands
  for (let row = 0; row < canopyH; row++) {
    const tier = Math.floor(row / tierRows);
    const inTier = (row % tierRows) / tierRows; // 0 at a tier's crown, 1 at its shelf
    const base = Math.round(((canopyHalf * (tier + 1)) / tiers) * (inTier + 0.12));
    // Rounded scallops along the shelves, plus the old torn edge — clamped
    // so the silhouette never grows past its former footprint.
    let half = base + Math.round(Math.sin(row * 1.9 + lobeA) * (0.6 + inTier));
    if (rng() < 0.25) half += rng() < 0.5 ? -1 : 1;
    half = Math.max(2, Math.min(half, base + 1));
    rowHalf[row] = half;
    const y = topY + row;
    for (let x = -half; x <= half; x++) {
      if (Math.abs(x) < half - 1 && rng() < 0.1) {
        if (rng() < 0.4) continue; // a real hole — the night shows through
        pixels.push({ x, y, c: PALETTE.plumDeep }); // most gaps fill with shadow
        continue;
      }
      const across = (x + half) / (2 * half || 1);
      // Lit on top of a tier and to the right; dark under the shelf.
      let level = 0.62 * across + 0.42 * (1 - inTier) - 0.12;
      // The SoM lobes: interference clumps the mass into rounded leaf-balls.
      level += 0.16 * Math.sin(x * 0.6 + row * 0.85 + lobeA) * Math.cos(x * 0.27 - row * 0.5 + lobeB);
      // Smoke core: the inner lower-left of every tier falls away.
      if (Math.abs(x) < half - 2) level -= 0.45 * (1 - across) * inTier;
      if (Math.abs(x) >= half - 1) level += 0.14; // the rim reads crisply
      let c = shade(ramp, level, x, y);
      if (inTier < 0.4 && across > 0.72 && rng() < (tier === 0 ? 0.06 : 0.03)) {
        // Every tier's crown catches the moon; the topmost outright.
        c = tier === 0 ? PALETTE.moonlight : PALETTE.orchid;
      } else if (Math.abs(x) < half - 2 && level < 0.25 && rng() < 0.04) {
        c = PALETTE.fog; // the deepest smoke pockets
      } else if (across > 0.45 && rng() < 0.014) {
        c = PALETTE.fern; // a stray fern leaf catching light
      } else if (rng() < 0.012) {
        c = pick(rng, EMBERS);
      }
      pixels.push({ x, y, c });
    }
  }

  // A few bare branch arms poking out of the canopy.
  const arms = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < arms; i++) {
    const dir = rng() < 0.5 ? -1 : 1;
    let ax = 0;
    let ay = -trunkH + Math.round(rng() * 5);
    const len = 3 + Math.floor(rng() * (H * 0.12));
    for (let s = 0; s < len; s++) {
      ax += dir;
      if (rng() < 0.45) ay -= 1;
      pixels.push({ x: ax, y: ay, c: shade(BARK_RAMP, dir > 0 ? 0.7 : 0.25, ax, ay) });
    }
  }

  // THE LIGHTS. Christmas trees in noir should be ridiculously lit up:
  // garland strings wrap the cone on sagging diagonals — alternating which
  // way they fall, a dotted plum wire between bulbs — and every few pixels a
  // bulb: 1px core + soft halo. Each bulb twinkles on its own phase and rate
  // (lightHash: pure in tree fields + bulb index), cycling steady → flare →
  // ebb with `time`. Drawn after the canopy so they sit on the needles;
  // bulb x is clamped a pixel inside the row edge so halos never widen the
  // silhouette. In heaven the same pixels remap — magenta, rose, gold, and
  // blue all still read on the cream.
  const strands = 3 + Math.round(canopyH / 7);
  const colorOffset = Math.floor(rng() * LIGHT_CORES.length);
  let bulb = 0;
  for (let s = 0; s < strands; s++) {
    const rA = Math.min(canopyH - 2, 2 + Math.round(((s + rng() * 0.6) / strands) * (canopyH - 7)));
    const drop = (2 + Math.floor(rng() * 3)) * (s % 2 === 0 ? 1 : -1);
    const rB = Math.max(1, Math.min(canopyH - 2, rA + drop));
    const sag = 1 + Math.floor(rng() * 2);
    const midRow = Math.max(1, Math.min(canopyH - 1, Math.round((rA + rB) / 2 + sag)));
    const width = Math.max(3, rowHalf[midRow] ?? 3);
    const samples = Math.max(6, 2 * width);
    for (let k = 0; k <= samples; k++) {
      const u = k / samples;
      const row = Math.max(1, Math.min(canopyH - 1, Math.round(rA + (rB - rA) * u + sag * Math.sin(Math.PI * u))));
      const half = rowHalf[row] ?? 2;
      const x = Math.max(-(half - 1), Math.min(half - 1, Math.round((u * 2 - 1) * (half - 1))));
      const y = topY + row;
      if (k % 3 !== 0) {
        if (k % 2 === 0) pixels.push({ x, y, c: PALETTE.plumDeep }); // the wire
        continue;
      }
      const ci = (bulb + colorOffset) % LIGHT_CORES.length;
      const h = lightHash(tree, bulb);
      bulb++;
      const phase = (h & 1023) / 1024;
      const rate = 0.5 + ((h >>> 10) & 255) / 160;
      const side = (h >>> 18) & 1 ? 1 : -1;
      const t = phase + time * rate;
      const tw = t - Math.floor(t);
      if (tw < 0.55) {
        // Steady: core plus one soft halo pixel.
        pixels.push({ x, y, c: LIGHT_CORES[ci] });
        pixels.push({ x: x + side, y, c: LIGHT_HALOS[ci] });
      } else if (tw < 0.85) {
        // Flare: the core surges hotter and the halo blooms around it.
        pixels.push({ x: x - 1, y, c: LIGHT_HALOS[ci] });
        pixels.push({ x: x + 1, y, c: LIGHT_HALOS[ci] });
        pixels.push({ x, y: y - 1, c: LIGHT_HALOS[ci] });
        pixels.push({ x, y, c: LIGHT_FLARES[ci] });
      } else {
        // Ebb: the bulb dims to its halo color — never fully dark.
        pixels.push({ x, y, c: LIGHT_HALOS[ci] });
      }
    }
  }

  // Fallen litter and root flare around the base, on the dirt.
  const litter = 10 + Math.floor(rng() * 14);
  for (let i = 0; i < litter; i++) {
    const x = Math.round((rng() - 0.5) * H * 0.8);
    const y = -Math.round(rng() * 3) + Math.floor(rng() * 3);
    pixels.push({ x, y, c: pick(rng, LITTER_RAMP) });
  }

  return withBounds(pixels);
}

function bushPixels(bush, rng) {
  // Rounded bushes: still a diamond footprint, lit from the top-right like
  // everything — but the mass now clumps into lobes, its gaps fill with plum
  // shadow, and the crown takes an orchid rim and the odd fern leaf.
  const pixels = [];
  const ramp = CANOPY_RAMPS[bush.variant] ?? CANOPY_RAMPS.ember;
  const rx = Math.max(4, Math.round(bush.size * 0.9));
  const ry = Math.max(3, Math.round(bush.size * 0.5));
  const lobeA = rng() * Math.PI * 2;
  for (let row = 0; row <= ry * 2; row++) {
    let half = Math.round(rx * (1 - Math.abs(row - ry) / (ry + 0.0001)));
    if (rng() < 0.3) half += rng() < 0.5 ? -1 : 1;
    if (half < 1) continue;
    const y = -ry * 2 + row;
    const down = row / (ry * 2); // 0 at the crown, 1 at the ground
    for (let x = -half; x <= half; x++) {
      if (Math.abs(x) < half - 1 && rng() < 0.12) {
        if (rng() < 0.5) continue;
        pixels.push({ x, y, c: PALETTE.plumDeep });
        continue;
      }
      const across = (x + half) / (2 * half || 1);
      let level = 0.55 * across + 0.4 * (1 - down) - 0.05;
      level += 0.14 * Math.sin(x * 0.7 + row * 0.9 + lobeA);
      let c = shade(ramp, level, x, y);
      if (down < 0.3 && across > 0.7 && rng() < 0.05) c = PALETTE.orchid;
      else if (across > 0.5 && rng() < 0.012) c = PALETTE.fern;
      pixels.push({ x, y, c });
    }
  }
  return withBounds(pixels);
}

function withBounds(pixels) {
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const p of pixels) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + BLOCK_W - 1 > maxX) maxX = p.x + BLOCK_W - 1;
    if (p.y > maxY) maxY = p.y;
  }
  return { pixels, minX, minY, maxX, maxY };
}
