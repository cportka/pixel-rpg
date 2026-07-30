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

// An old lamp (10 wide x 6 tall), anchored at its base center.
// 's' body, 'v' the knob, 'L' the spout.
export const LAMP_SPRITE = [
  '.....v....',
  '....sss...',
  'L..ssssss.',
  'LLssssssss',
  '.sssssss..',
  '..sssss...',
];

export const LAMP_COLORS = {
  s: PALETTE.smoke,
  v: PALETTE.violet,
  L: PALETTE.smoke,
};

// A pipe (10 wide x 5 tall): long stem, upturned bowl, a pinch of the
// half-burnt green leaf on top. 'p' stem, 'P' bowl, 'g' the leaf.
export const PIPE_SPRITE = [
  '.......gg.',
  '......PPPP',
  '......PPPP',
  'ppppppPPP.',
  '......PP..',
];

export const PIPE_COLORS = {
  p: PALETTE.smokeDeep,
  P: PALETTE.plumDeep,
  g: PALETTE.leaf,
};

// A zombie (9 wide x 16 tall): arms out, mid-shamble, one magenta eye.
// 'Z' rotten flesh (the leaf green), 'e' the eye.
export const ZOMBIE_SPRITE = [
  '.ZZZ.....',
  '.ZeZ.....',
  '.ZZZ.....',
  '..Z......',
  '.ZZZZ....',
  '.ZZZZZZZZ',
  '.ZZZZZZZZ',
  '.ZZZZ....',
  '.ZZZZ....',
  '..ZZZ....',
  '..ZZZ....',
  '..Z.Z....',
  '..Z.Z....',
  '..Z.ZZ...',
  '.ZZ..Z...',
  '.ZZ..ZZ..',
];

export const ZOMBIE_COLORS = {
  Z: PALETTE.leaf,
  e: PALETTE.magenta,
};

/** The zombie's shamble: a 1px sway that lurches rather than glides. */
export function zombieSway(time, phase) {
  return Math.sin(time * 1.7 + phase) > 0.2 ? 1 : 0;
}

/**
 * The lamp's come-hither glint: a brief 4-point flash at the knob every
 * couple of seconds. Empty most of the time. Offsets relative to the
 * lamp's base center; the knob sits ~6px up.
 */
export function lampGlintPixels(time) {
  if (Math.sin(time * 2.1) < 0.92) return [];
  return [
    { x: 0, y: -7, c: PALETTE.moonlight },
    { x: -1, y: -7, c: PALETTE.violet },
    { x: 1, y: -7, c: PALETTE.violet },
    { x: 0, y: -8, c: PALETTE.violet },
    { x: 0, y: -6, c: PALETTE.violet },
  ];
}

/**
 * Thin smoke wisps curling off the pipe bowl (only while the leaf lasts).
 * Deterministic per time; offsets relative to the pipe's base center.
 */
export function pipeSmokePixels(time) {
  const pixels = [];
  for (let wisp = 0; wisp < 2; wisp++) {
    const rise = (time * 2.2 + wisp * 1.4) % 4;
    pixels.push({
      x: 3 + Math.round(Math.sin(time * 2.5 + wisp * 2.1 + rise)),
      y: -5 - Math.floor(rise),
      c: PALETTE.smoke,
    });
  }
  return pixels;
}

export { BLOCK_W };
