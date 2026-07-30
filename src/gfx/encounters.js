// Encounter art: the burning dumpster and the psychedelic cat.
//
// The dumpster is a static sprite with a deterministic time-driven fire on
// top; the cat is a static silhouette the renderer paints in cycling
// psychedelic colors. Pure data + geometry — the renderer rasterizes.

import { PALETTE } from './palette.js';
import { BLOCK_W } from './trees.js';

// Dumpster sprite map (16 wide x 10 tall), anchored at its base center.
// 's' lid, 'S' body, 'p' grooves, 'F' wheels.
export const DUMPSTER_SPRITE = [
  '.ssssssssssssss.',
  'ssssssssssssssss',
  'SSSSpSSSSSSpSSSS',
  'SSSSpSSSSSSpSSSS',
  'SSSSpSSSSSSpSSSS',
  'SSSSpSSSSSSpSSSS',
  'SSSSpSSSSSSpSSSS',
  'SSSSpSSSSSSpSSSS',
  'SSSSSSSSSSSSSSSS',
  '..FF........FF..',
];

export const DUMPSTER_COLORS = {
  s: PALETTE.smoke,
  S: PALETTE.smokeDeep,
  p: PALETTE.plumDeep,
  F: PALETTE.fog,
};

// The cat (11 wide x 8 tall): ears, head, body, curled-up tail, sitting.
export const CAT_SPRITE = [
  '.C.C.......',
  '.CCC......C',
  '.CCC......C',
  '..CCCCCCC.C',
  '..CCCCCCCCC',
  '..CCCCCCCC.',
  '..CC...CC..',
  '..CC...CC..',
];

// The cat shimmers through these, row by row, frame by frame.
export const PSYCHE_CYCLE = [PALETTE.magenta, PALETTE.violet, PALETTE.blue, PALETTE.pink];

const FLAME_COLORS = [PALETTE.purple, PALETTE.magenta, PALETTE.pink];

/**
 * Deterministic fire above a dumpster at a moment in time: four flame
 * tongues of oscillating height (2x1 blocks, violet base → pink tip) plus
 * the occasional ember. Offsets are relative to the dumpster's base center;
 * negative y is up. The dumpster is 10 tall, so flames start at y = -10.
 */
export function firePixels(time) {
  const pixels = [];
  const top = -10;
  for (let tongue = 0; tongue < 4; tongue++) {
    const x = -6 + tongue * 4;
    const h = 2 + Math.round(1.5 + 1.5 * Math.sin(time * 6 + tongue * 1.9));
    for (let i = 0; i < h; i++) {
      const band = Math.min(FLAME_COLORS.length - 1, Math.floor((i / h) * FLAME_COLORS.length));
      pixels.push({ x, y: top - i, c: FLAME_COLORS[band] });
    }
    if (Math.sin(time * 9 + tongue * 2.4) > 0.55) {
      pixels.push({ x, y: top - h - 2, c: PALETTE.pink }); // an ember floats off
    }
  }
  return pixels;
}

/** The cat's row color at a given render frame — the psychedelic shimmer. */
export function catRowColor(row, frame) {
  return PSYCHE_CYCLE[(row + frame) % PSYCHE_CYCLE.length];
}

export { BLOCK_W };
