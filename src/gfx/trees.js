// Procedural trees — the signature look, rebuilt for 16-bit in v0.15.
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
// This module is pure geometry: treePixels() returns colored pixel offsets
// relative to the tree's anchor (trunk base center). The renderer rasterizes
// and caches them; tests pin determinism and bounds without a canvas.

import { mulberry32, pick } from '../core/rng.js';
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
 * Generate a tree's (or bush's) pixels.
 * Returns { pixels: [{x, y, c}], minX, minY, maxX, maxY } with offsets
 * relative to the anchor at (0, 0) = trunk base center; negative y is up.
 */
export function treePixels(tree) {
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

  // Canopy: stacked jagged tiers — an angular pine silhouette. Each tier
  // widens to a hard shelf; the rows just under a shelf fall into that
  // tier's own shadow, and the crown of each tier catches the moon.
  const ramp = CANOPY_RAMPS[tree.variant] ?? CANOPY_RAMPS.ember;
  const canopyH = Math.max(12, Math.round(H * 0.56));
  const topY = -trunkH - canopyH;
  const canopyHalf = Math.max(6, Math.round(H * 0.38));
  const tiers = 2 + Math.floor(rng() * 2);
  const tierRows = Math.ceil(canopyH / tiers);
  for (let row = 0; row < canopyH; row++) {
    const tier = Math.floor(row / tierRows);
    const inTier = (row % tierRows) / tierRows; // 0 at a tier's crown, 1 at its shelf
    let half = Math.round(((canopyHalf * (tier + 1)) / tiers) * (inTier + 0.12));
    if (rng() < 0.3) half += rng() < 0.5 ? -1 : 1; // torn edge
    half = Math.max(2, half);
    const y = topY + row;
    for (let x = -half; x <= half; x++) {
      if (Math.abs(x) < half - 1 && rng() < 0.14) continue; // gaps in the mass
      const across = (x + half) / (2 * half || 1);
      // Lit on top of a tier and to the right; dark under the shelf.
      let level = 0.62 * across + 0.42 * (1 - inTier) - 0.12;
      if (Math.abs(x) >= half - 1) level += 0.14; // the rim reads crisply
      let c = shade(ramp, level, x, y);
      if (tier === 0 && inTier < 0.4 && across > 0.72 && rng() < 0.05) {
        c = PALETTE.moonlight; // the crown catches the moon outright
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
  // Angular bushes: a jagged diamond, lit from the top-right like everything.
  const pixels = [];
  const ramp = CANOPY_RAMPS[bush.variant] ?? CANOPY_RAMPS.ember;
  const rx = Math.max(4, Math.round(bush.size * 0.9));
  const ry = Math.max(3, Math.round(bush.size * 0.5));
  for (let row = 0; row <= ry * 2; row++) {
    let half = Math.round(rx * (1 - Math.abs(row - ry) / (ry + 0.0001)));
    if (rng() < 0.3) half += rng() < 0.5 ? -1 : 1;
    if (half < 1) continue;
    const y = -ry * 2 + row;
    const down = row / (ry * 2); // 0 at the crown, 1 at the ground
    for (let x = -half; x <= half; x++) {
      if (Math.abs(x) < half - 1 && rng() < 0.12) continue;
      const across = (x + half) / (2 * half || 1);
      const level = 0.55 * across + 0.4 * (1 - down) - 0.05;
      pixels.push({ x, y, c: shade(ramp, level, x, y) });
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
