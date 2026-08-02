// Encounter art: the burning dumpster, the psychedelic cat, the genie lamp,
// the half-burnt pipe, and the zombie.
//
// v0.16 redrew every one of these ~1.5x larger for the finer screen and
// re-lit them from the top-right against the new palette — dirt and rust
// where things are old, gold where things burn, rose where things are alive
// and shouldn't be. Pure data + geometry; the renderer rasterizes.

import { PALETTE } from './palette.js';
import { BLOCK_W } from './trees.js';

// The dumpster (24 wide x 15 tall), anchored at its base center.
// 'l' lit lid, 'L' lid shadow, 'S' body, 'h' the moonlit right flank,
// 'p' rib grooves, 'r' rust bleeding down from them, 'F' wheels.
export const DUMPSTER_SPRITE = [
  '..llllllllllllllllllll..',
  '.llllllllllllllllllllll.',
  'LLLLLLLLLLLLLLLLLLLLLLLL',
  'SSSSSpSSSSSSSSpSSSSShhhh',
  'SSSSSpSSSSSSSSpSSSSShhhh',
  'SSSSSrSSSSSSSSrSSSSShhhh',
  'SSSSSpSSSSSSSSpSSSSShhhh',
  'SSSSSpSSSSSSSSpSSSSShhhh',
  'SSSSSrSSSSSSSSrSSSSShhhh',
  'SSSSSpSSSSSSSSpSSSSShhhh',
  'SSSSSpSSSSSSSSpSSSSShhhh',
  'SSSSSSSSSSSSSSSSSSSShhhh',
  'LLLLLLLLLLLLLLLLLLLLLLLL',
  '..FF..............FF....',
  '..FF..............FF....',
];

export const DUMPSTER_COLORS = {
  l: PALETTE.smoke,
  L: PALETTE.smokeDeep,
  S: PALETTE.dusk,
  h: PALETTE.plum,
  p: PALETTE.soil,
  r: PALETTE.amber,
  F: PALETTE.fog,
};

// The cat (16 wide x 12 tall): ears, head, body, curled tail, sitting.
// The renderer paints it in cycling psychedelic colors, row by row.
export const CAT_SPRITE = [
  '..C..C..........',
  '..CC.CC.......C.',
  '..CCCCC......CC.',
  '..CCCCC......CC.',
  '...CCCC......CC.',
  '...CCCCCCCCCCCC.',
  '...CCCCCCCCCCCCC',
  '...CCCCCCCCCCCC.',
  '...CCCCCCCCCCC..',
  '...CCC....CCC...',
  '...CCC....CCC...',
  '...CCC....CCC...',
];

// The cat shimmers through these, row by row, frame by frame.
export const PSYCHE_CYCLE = [PALETTE.magenta, PALETTE.violet, PALETTE.blue, PALETTE.pink];

const FLAME_COLORS = [PALETTE.amber, PALETTE.brass, PALETTE.gold, PALETTE.goldRose];

/**
 * Deterministic fire above a dumpster at a moment in time: five tongues of
 * oscillating height climbing the gold ramp from ember to pale rose, plus
 * the occasional floating spark. Offsets are relative to the dumpster's base
 * center; negative y is up. The dumpster is 15 tall, so flames start at -15.
 */
export function firePixels(time) {
  const pixels = [];
  const top = -15;
  for (let tongue = 0; tongue < 5; tongue++) {
    const x = -8 + tongue * 4;
    const h = 3 + Math.round(2.5 + 2.5 * Math.sin(time * 6 + tongue * 1.9));
    for (let i = 0; i < h; i++) {
      const band = Math.min(FLAME_COLORS.length - 1, Math.floor((i / h) * FLAME_COLORS.length));
      pixels.push({ x, y: top - i, c: FLAME_COLORS[band] });
      if (i < h - 2) pixels.push({ x: x + 1, y: top - i, c: FLAME_COLORS[Math.max(0, band - 1)] });
    }
    if (Math.sin(time * 9 + tongue * 2.4) > 0.55) {
      pixels.push({ x, y: top - h - 3, c: PALETTE.goldRose }); // a spark floats off
    }
  }
  return pixels;
}

/** The cat's row color at a given render frame — the psychedelic shimmer. */
export function catRowColor(row, frame) {
  return PSYCHE_CYCLE[(row + frame) % PSYCHE_CYCLE.length];
}

// An old lamp (15 wide x 9 tall), anchored at its base center.
// 'b' lit brass, 'B' brass in shadow, 'v' the knob, 'L' the spout.
export const LAMP_SPRITE = [
  '........v......',
  '.......bbb.....',
  '.....bbbbbbb...',
  'L...bbbbbbbbbb.',
  'LL.BbbbbbbbbbbB',
  'LLBBbbbbbbbbbBB',
  '.BBBbbbbbbbbBB.',
  '..BBBbbbbbbBB..',
  '...BBBBBBBBB...',
];

export const LAMP_COLORS = {
  b: PALETTE.brass,
  B: PALETTE.amber,
  v: PALETTE.gold,
  L: PALETTE.amber,
};

// A pipe (15 wide x 8 tall): long stem, upturned bowl, a pinch of the
// half-burnt green leaf on top. 'p' stem, 'P' bowl, 'q' bowl shadow,
// 'g' the leaf.
export const PIPE_SPRITE = [
  '..........ggg..',
  '.........PPPPP.',
  '.........PPPPPP',
  '........qPPPPPP',
  'pppppppppqPPPP.',
  'pppppppppqPPP..',
  '..........qPP..',
  '...........q...',
];

export const PIPE_COLORS = {
  p: PALETTE.clay,
  P: PALETTE.plum,
  q: PALETTE.plumDeep,
  g: PALETTE.leaf,
};

// A zombie (14 wide x 24 tall): arms out, mid-shamble, one magenta eye.
// 'Z' rotten flesh, 'z' its shadow side, 'e' the eye, 'g' gore.
export const ZOMBIE_SPRITE = [
  '...ZZZZ.......',
  '..zZZZZ.......',
  '..zZeZZ.......',
  '..zZZZZ.......',
  '...zZZ........',
  '....Z.........',
  '..zZZZZ.......',
  '..zZZZZZZZZZZZ',
  '.zZZZZZZZZZZZZ',
  '.zZZZZZg......',
  '.zZZZZZ.......',
  '.zZZZZZ.......',
  '.zZZZZZ.......',
  '.zZZZZ........',
  '..zZZZ........',
  '..zZZZ........',
  '..zZ.Z........',
  '..zZ.Z........',
  '..zZ.zZ.......',
  '..zZ..Z.......',
  '.zZZ..zZ......',
  '.zZ....Z......',
  'zZZ....zZ.....',
  'zZZ....zZZ....',
];

export const ZOMBIE_COLORS = {
  Z: PALETTE.fern,
  z: PALETTE.moss,
  e: PALETTE.magenta,
  g: PALETTE.plum,
};

/** The zombie's shamble: a 1px sway that lurches rather than glides. */
export function zombieSway(time, phase) {
  return Math.sin(time * 1.7 + phase) > 0.2 ? 1 : 0;
}

/**
 * The lamp's come-hither glint: a brief gold flash at the knob every couple
 * of seconds. Empty most of the time. Offsets relative to the lamp's base
 * center; the knob sits ~9px up.
 */
export function lampGlintPixels(time) {
  if (Math.sin(time * 2.1) < 0.92) return [];
  return [
    { x: 0, y: -10, c: PALETTE.goldRose },
    { x: -1, y: -10, c: PALETTE.gold },
    { x: 1, y: -10, c: PALETTE.gold },
    { x: 0, y: -12, c: PALETTE.gold },
    { x: 0, y: -8, c: PALETTE.gold },
    { x: -2, y: -10, c: PALETTE.brass },
    { x: 2, y: -10, c: PALETTE.brass },
  ];
}

/**
 * Thin smoke wisps curling off the pipe bowl (only while the leaf lasts).
 * Deterministic per time; offsets relative to the pipe's base center.
 */
export function pipeSmokePixels(time) {
  const pixels = [];
  for (let wisp = 0; wisp < 3; wisp++) {
    const rise = (time * 2.2 + wisp * 1.4) % 6;
    pixels.push({
      x: 5 + Math.round(Math.sin(time * 2.5 + wisp * 2.1 + rise) * 2),
      y: -8 - Math.floor(rise),
      c: wisp === 0 ? PALETTE.smoke : PALETTE.smokeDeep,
    });
  }
  return pixels;
}

export { BLOCK_W };
