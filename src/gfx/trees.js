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
        const c = rng() < 0.25 ? pick(rng, TRUNK_COLORS) : rowColor;
        pixels.push({ x: x + wobble, y, c });
      }
    }
  }

  // Canopy: scattered blocks in an ellipse over the trunk top, denser inward.
  const mix = CANOPY_MIX[tree.variant] ?? CANOPY_MIX.ember;
  const rx = Math.max(5, Math.round(H * 0.42));
  const ry = Math.max(4, Math.round(H * 0.3));
  const cy = -trunkH - Math.round(ry * 0.5);
  const n = Math.round(rx * ry * 1.6);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()); // area-uniform, then thinned near the rim
    if (r > 0.55 && rng() < (r - 0.55) * 1.6) continue;
    const x = snap(Math.cos(a) * r * rx);
    const y = cy + Math.round(Math.sin(a) * r * ry);
    pixels.push({ x, y, c: pick(rng, mix) });
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
  const pixels = [];
  const mix = CANOPY_MIX[bush.variant] ?? CANOPY_MIX.ember;
  const rx = Math.max(3, Math.round(bush.size * 0.7));
  const ry = Math.max(2, Math.round(bush.size * 0.38));
  const n = Math.round(rx * ry * 1.8);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    if (r > 0.6 && rng() < (r - 0.6) * 1.8) continue;
    pixels.push({
      x: snap(Math.cos(a) * r * rx),
      y: -ry + Math.round(Math.sin(a) * r * ry),
      c: pick(rng, mix),
    });
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
