// Procedural dithered trees — the signature look of the reference footage:
// noisy horizontal-banded trunks, canopies of scattered flecks, and a spray
// of fallen litter at the base. Re-themed neo-noir: smoke and plum purples
// with magenta ember flecks in a violet-black void.
//
// The reference's dither is built from 2x1 pixel blocks (classic Atari-style
// double-wide pixels), so every emitted pixel here sits on an even x and is
// rendered BLOCK_W wide. This module is pure geometry: treePixels() returns
// colored block offsets relative to the tree's anchor (trunk base center).
// The renderer rasterizes and caches them; tests pin determinism and bounds
// without a canvas.

import { mulberry32, pick } from '../core/rng.js';
import { PALETTE } from './palette.js';

export const BLOCK_W = 2; // each emitted pixel is a 2x1 block
export const BLOCK_H = 1;

const TRUNK_COLORS = [
  PALETTE.plumDeep,
  PALETTE.purple,
  PALETTE.violet,
  PALETTE.smokeDeep,
  PALETTE.fog,
];

const CANOPY_MIX = {
  // 'ember' — the dominant look: burning violet with magenta flecks.
  ember: [
    PALETTE.violet, PALETTE.violet, PALETTE.purple, PALETTE.purple, PALETTE.plumDeep,
    PALETTE.magenta, PALETTE.smoke, PALETTE.smokeDeep,
  ],
  // 'leafy' — smoke-crowned trees with electric flecks.
  leafy: [
    PALETTE.smoke, PALETTE.smoke, PALETTE.smokeDeep, PALETTE.smokeDeep,
    PALETTE.violet, PALETTE.magenta, PALETTE.purple,
  ],
};

const LITTER_COLORS = [
  PALETTE.purple,
  PALETTE.violet,
  PALETTE.smoke,
  PALETTE.smokeDeep,
  PALETTE.fog,
];

// 16-bit depth: the moon sits top-right, so the canopy's left flank and each
// tier's underside step one tone darker, and the top tier's right rim takes
// the occasional moonlit glint. One lookup, no new geometry.
const DARKER = new Map([
  [PALETTE.violet, PALETTE.purple],
  [PALETTE.purple, PALETTE.plum],
  [PALETTE.plum, PALETTE.plumDeep],
  [PALETTE.smoke, PALETTE.smokeDeep],
  [PALETTE.smokeDeep, PALETTE.fog],
  [PALETTE.plumDeep, PALETTE.fog],
]);

const snap = (x) => 2 * Math.round(x / 2);

/**
 * Generate a tree's (or bush's) blocks.
 * Returns { pixels: [{x, y, c}], minX, minY, maxX, maxY } with offsets
 * relative to the anchor at (0, 0) = trunk base center; negative y is up.
 * Each pixel is a BLOCK_W x BLOCK_H block whose left edge is x (always even);
 * maxX already accounts for block width.
 */
export function treePixels(tree) {
  const rng = mulberry32(tree.detailSeed);
  if (tree.kind === 'bush') return bushPixels(tree, rng);

  const pixels = [];
  const H = tree.size;
  const trunkH = Math.round(H * 0.62);
  const baseHalf = Math.max(2, Math.round(H * 0.09));

  // Trunk: horizontal dithered bands, narrowing and wobbling as they rise.
  let wobble = 0;
  for (let y = 0; y >= -trunkH; y--) {
    const t = -y / trunkH; // 0 at base, 1 at top
    const half = Math.max(1, Math.round(baseHalf * (1 - t * 0.55)));
    if (rng() < 0.3) wobble += rng() < 0.5 ? -2 : 2;
    wobble = Math.max(-4, Math.min(4, wobble));
    const rowColor = pick(rng, TRUNK_COLORS);
    for (let x = -snap(half); x <= half; x += BLOCK_W) {
      if (rng() < 0.82) {
        let c = rng() < 0.25 ? pick(rng, TRUNK_COLORS) : rowColor;
        // The trunk's left flank falls into shadow; the right edge stays lit.
        if (x < 0 && DARKER.has(c) && rng() < 0.6) c = DARKER.get(c);
        pixels.push({ x: x + wobble, y, c });
      }
    }
  }

  // Canopy: stacked jagged tiers — an angular pine silhouette. Each tier
  // widens linearly to a hard shelf, then the next tier resets narrow; the
  // rim rows jitter so the edge stays torn rather than geometric-clean.
  const mix = CANOPY_MIX[tree.variant] ?? CANOPY_MIX.ember;
  const canopyH = Math.max(8, Math.round(H * 0.55));
  const topY = -trunkH - canopyH;
  const canopyHalf = Math.max(4, Math.round(H * 0.4));
  const tiers = 2 + Math.floor(rng() * 2);
  const tierRows = Math.ceil(canopyH / tiers);
  for (let row = 0; row < canopyH; row++) {
    const tier = Math.floor(row / tierRows);
    const frac = ((row % tierRows) + 1) / tierRows;
    const shelfRow = (row % tierRows) === tierRows - 1; // a tier's underside
    let half = Math.round((canopyHalf * (tier + 1)) / tiers) * frac;
    if (rng() < 0.4) half += rng() < 0.5 ? -2 : 2; // jagged edge
    half = Math.max(2, Math.round(half));
    const y = topY + row;
    for (let x = -snap(half); x <= half; x += BLOCK_W) {
      // Rim blocks always land so the angles read crisply; the fill dithers.
      if (Math.abs(x) >= half - 1 || rng() < 0.72) {
        let c = pick(rng, mix);
        // Shade the moon-away side and each shelf's underside one tone down.
        if ((x < -half * 0.3 || shelfRow) && DARKER.has(c) && rng() < 0.8) {
          c = DARKER.get(c);
        }
        // The top tier's upper-right rim catches the moon now and then.
        if (tier === 0 && row < tierRows && x >= half - 3 && rng() < 0.18) {
          c = PALETTE.moonlight;
        }
        pixels.push({ x, y, c });
      }
    }
  }

  // A few bare branch arms poking out of the canopy.
  const arms = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < arms; i++) {
    const dir = rng() < 0.5 ? -BLOCK_W : BLOCK_W;
    let ax = 0;
    let ay = -trunkH + Math.round(rng() * 4);
    const len = 2 + Math.floor(rng() * (H * 0.1));
    for (let s = 0; s < len; s++) {
      ax += dir;
      if (rng() < 0.5) ay -= 1;
      pixels.push({ x: ax, y: ay, c: pick(rng, TRUNK_COLORS) });
    }
  }

  // Fallen litter around the base.
  const litter = 6 + Math.floor(rng() * 10);
  for (let i = 0; i < litter; i++) {
    const x = snap((rng() - 0.5) * H * 0.7);
    const y = -Math.round(rng() * 3) + Math.floor(rng() * 3);
    pixels.push({ x, y, c: pick(rng, LITTER_COLORS) });
  }

  return withBounds(pixels);
}

function bushPixels(bush, rng) {
  // Angular bushes: a jagged diamond instead of a soft blob.
  const pixels = [];
  const mix = CANOPY_MIX[bush.variant] ?? CANOPY_MIX.ember;
  const rx = Math.max(3, Math.round(bush.size * 0.7));
  const ry = Math.max(2, Math.round(bush.size * 0.4));
  for (let row = 0; row <= ry * 2; row++) {
    let half = Math.round(rx * (1 - Math.abs(row - ry) / (ry + 0.0001)));
    if (rng() < 0.35) half += rng() < 0.5 ? -2 : 2;
    if (half < 1) continue;
    const y = -ry * 2 + row;
    for (let x = -snap(half); x <= half; x += BLOCK_W) {
      if (Math.abs(x) >= half - 1 || rng() < 0.7) {
        let c = pick(rng, mix);
        if (x < -half * 0.3 && DARKER.has(c) && rng() < 0.8) c = DARKER.get(c);
        pixels.push({ x, y, c });
      }
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
