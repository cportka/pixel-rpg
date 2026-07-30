// Terrain structures: the mysterious cabin, cave mouths, and mountain rocks.
// Pure data + geometry in the neo-noir palette — the renderer rasterizes.

import { PALETTE } from './palette.js';
import { mulberry32 } from '../core/rng.js';

// A mysterious cabin (20 wide x 10 tall), anchored at its base center.
// 'c' chimney, 'r' eaves, 'R' roof, 'w' log walls, 'W' the window
// (lit magenta, mostly), 'd' the door nobody has seen open.
export const CABIN_SPRITE = [
  '........cc..........',
  '........cc..........',
  '....rrrrrrrrrrrr....',
  '..rrRRRRRRRRRRRRrr..',
  'rrRRRRRRRRRRRRRRRRrr',
  'wwwwwwwwwwwwwwwwwwww',
  'wwWWWwwwwwwwwwdddwww',
  'wwWWWwwwwwwwwwdddwww',
  'wwwwwwwwwwwwwwdddwww',
  'wwwwwwwwwwwwwwdddwww',
];

export const CABIN_COLORS = {
  c: PALETTE.smoke,
  r: PALETTE.smokeDeep,
  R: PALETTE.fog,
  w: PALETTE.plumDeep,
  W: PALETTE.magenta,
  d: PALETTE.fog,
};

/** The cabin window is lit most of the time. Sometimes it isn't. */
export function cabinWindowLit(time) {
  return Math.sin(time * 0.6) > -0.75;
}

// A cave mouth in a rock face (18 wide x 10 tall), anchored at base center.
// 'R' rock, 'h' weathered highlight, 'A' the dark of the mouth.
export const CAVE_SPRITE = [
  '......RRRRRR......',
  '....RRRRRRRRRR....',
  '...RRhRRRRRRhRR...',
  '..RRRRRAAAARRRRR..',
  '..RRRRAAAAAARRRR..',
  '.RRRhRAAAAAARRRRR.',
  '.RRRRAAAAAAAARRRR.',
  'RRRRRAAAAAAAARRRRR',
  'RRRRAAAAAAAAAARRRR',
  'RRRRAAAAAAAAAARRRR',
];

export const CAVE_COLORS = {
  R: PALETTE.smokeDeep,
  h: PALETTE.smoke,
  A: PALETTE.void,
};

/** Something glints inside the cave, briefly, now and then. */
export function caveGlint(time) {
  return Math.sin(time * 1.3) > 0.9;
}

/**
 * A rock as a deterministic angular mound of pixels, anchored at base
 * center; negative y is up. Body smokeDeep, moonlit top edge, fog shadow.
 */
export function rockPixels(size, detailSeed) {
  const rng = mulberry32(detailSeed >>> 0);
  const h = Math.max(4, Math.round(size * 0.6));
  const halfW = Math.max(3, Math.round(size / 2));
  const pixels = [];
  for (let row = 0; row < h; row++) {
    const t = row / h; // 0 at base, 1 at top
    const half = Math.max(1, Math.round(halfW * (1 - t * t) + (rng() - 0.5) * 2));
    for (let dx = -half; dx <= half; dx++) {
      let c = PALETTE.smokeDeep;
      if (row === h - 1 || (dx === -half && rng() < 0.6)) c = PALETTE.smoke;
      else if (row === 0) c = PALETTE.fog;
      pixels.push({ x: dx, y: -row, c });
    }
  }
  return pixels;
}

/** A grass tuft: three leaf-green pixels in a tiny V. */
export const TUFT_PIXELS = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 1, y: -1 },
];
