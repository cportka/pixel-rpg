// Terrain structures: the mysterious cabin, cave mouths, mountain rocks, and
// the mansion (outside and in). Pure data + geometry — the renderer
// rasterizes.
//
// v0.15 redrew all of it ~1.5x larger for the finer screen, against the new
// palette: dirt and plum for anything built, gold for anything lit, and the
// deep nature greens for anything the forest has started taking back.

import { PALETTE } from './palette.js';
import { mulberry32 } from '../core/rng.js';

// A mysterious cabin (30 wide x 15 tall), anchored at its base center.
// 'c' chimney, 'r' eaves shadow, 'R' lit roof, 'w' log walls, 'v' the moonlit
// flank, 'W' the window (lit gold, mostly), 'd' the door nobody has seen open.
export const CABIN_SPRITE = [
  '...........cc.................',
  '...........cc.................',
  '...........cc.................',
  '.....rrrrrrrrrrrrrrrrrr.......',
  '...rrRRRRRRRRRRRRRRRRRRrr.....',
  '.rrRRRRRRRRRRRRRRRRRRRRRRrr...',
  'rrRRRRRRRRRRRRRRRRRRRRRRRRRrr.',
  'wwwwwwwwwwwwwwwwwwwwwwwwvvvvvv',
  'wwwWWWWwwwwwwwwwwwwddddwvvvvvv',
  'wwwWWWWwwwwwwwwwwwwddddwvvvvvv',
  'wwwWWWWwwwwwwwwwwwwddddwvvvvvv',
  'wwwwwwwwwwwwwwwwwwwddddwvvvvvv',
  'wwwwwwwwwwwwwwwwwwwddddwvvvvvv',
  'wwwwwwwwwwwwwwwwwwwddddwvvvvvv',
  '..dddddddddddddddddddddddddd..',
];

export const CABIN_COLORS = {
  c: PALETTE.fog,
  r: PALETTE.smokeDeep,
  R: PALETTE.smoke,
  w: PALETTE.dirt,
  v: PALETTE.clay,
  W: PALETTE.gold,
  d: PALETTE.soil,
};

/** The cabin window is lit most of the time. Sometimes it isn't. */
export function cabinWindowLit(time) {
  return Math.sin(time * 0.6) > -0.75;
}

// A cave mouth in a rock face (27 wide x 15 tall), anchored at base center.
// 'R' rock, 'h' weathered highlight, 'd' rock in shadow, 'A' the dark inside.
export const CAVE_SPRITE = [
  '.........RRRRRRRRR.........',
  '......RRRRRRRRRRRRRRR......',
  '....dRRRRRRRRRRRRRRRhRR....',
  '...dRRRhRRRRRRRRRRRRhRRR...',
  '..dRRRRRRRRAAAAARRRRRRRRR..',
  '..dRRRRRRAAAAAAAAARRRRRRR..',
  '.dRRRRRRAAAAAAAAAAARRhRRRR.',
  '.dRRRhRAAAAAAAAAAAAARRRRRR.',
  'dRRRRRAAAAAAAAAAAAAAARRRRRR',
  'dRRRRAAAAAAAAAAAAAAAAARRRRR',
  'dRRRAAAAAAAAAAAAAAAAAAARRRR',
  'dRRRAAAAAAAAAAAAAAAAAAARRRR',
  'dRRAAAAAAAAAAAAAAAAAAAAARRR',
  'dRRAAAAAAAAAAAAAAAAAAAAARRR',
  'dRRAAAAAAAAAAAAAAAAAAAAARRR',
];

export const CAVE_COLORS = {
  R: PALETTE.dusk,
  h: PALETTE.smoke,
  d: PALETTE.soil,
  A: PALETTE.void,
};

/** Something glints inside the cave, briefly, now and then. */
export function caveGlint(time) {
  return Math.sin(time * 1.3) > 0.9;
}

/**
 * A rock as a deterministic angular mound, anchored at base center; negative
 * y is up. Lit from the top-right off the dirt ramp, so rocks sit in the
 * ground rather than on it.
 */
export function rockPixels(size, detailSeed) {
  const rng = mulberry32(detailSeed >>> 0);
  const h = Math.max(6, Math.round(size * 0.6));
  const halfW = Math.max(4, Math.round(size / 2));
  const RAMP = [PALETTE.soil, PALETTE.dirt, PALETTE.clay, PALETTE.loam, PALETTE.smoke];
  const pixels = [];
  for (let row = 0; row < h; row++) {
    const t = row / h; // 0 at base, 1 at top
    const half = Math.max(1, Math.round(halfW * (1 - t * t) + (rng() - 0.5) * 2));
    for (let dx = -half; dx <= half; dx++) {
      const across = (dx + half) / (2 * half || 1);
      let idx = Math.round(0.6 + across * 2.2 + t * 1.1);
      if (rng() < 0.12) idx -= 1;
      pixels.push({ x: dx, y: -row, c: RAMP[Math.max(0, Math.min(RAMP.length - 1, idx))] });
    }
  }
  return pixels;
}

/** A grass tuft: leaf-green blades in a tiny fan. */
export const TUFT_PIXELS = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 1, y: -1 },
  { x: 2, y: -1 },
  { x: 1, y: -2 },
];

// ---------------------------------------------------------------------------
// The mansion: a brooding facade in the woods — gabled roof, chimney, one
// attic window that is sometimes lit and should not be, tall gold-lit
// windows, and a door that was never locked. Built by code so the 84x63 grid
// stays exact; anchored at base center like everything else.

export const MANSION_SPRITE = (() => {
  const W = 84;
  const H = 63;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (x, y, ch) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch;
  };
  // Chimney, left of the gable.
  for (let y = 0; y <= 11; y++) for (let x = 18; x <= 23; x++) put(x, y, y < 2 ? 'R' : 'c');
  // Gable roof: shingled in two tones, lit on the right pitch.
  for (let y = 0; y <= 23; y++) {
    const half = Math.round(3 + (y * 39) / 23);
    for (let x = 42 - half; x <= 41 + half; x++) {
      const edge = x <= 42 - half + 1 || x >= 41 + half - 1 || y === 23;
      const litPitch = x > 42;
      if (grid[y][x] === '.') put(x, y, edge ? 'R' : litPitch && y % 3 !== 0 ? 'S' : 'r');
    }
  }
  // The attic window. Mostly dark. Mostly.
  for (let y = 11; y <= 16; y++) for (let x = 39; x <= 44; x++) put(x, y, 'A');
  // Eaves, then two stories of wall — the moonlit flank feathered in.
  for (let x = 0; x < W; x++) put(x, 24, 'R');
  for (let y = 25; y <= 59; y++) {
    for (let x = 0; x < W; x++) {
      const lit = x >= W - 21 || (x >= W - 30 && (x + y) % 2 === 0);
      put(x, y, lit ? 'V' : 'w');
    }
  }
  for (let x = 0; x < W; x++) put(x, 42, 't');
  // Upper-floor windows (two lit, two dark), with sills.
  [9, 30, 48, 69].forEach((wx, i) => {
    for (let y = 29; y <= 38; y++) for (let x = wx; x < wx + 6; x++) put(x, y, i % 2 === 0 ? 'g' : 'G');
    for (let x = wx - 1; x <= wx + 6; x++) put(x, 39, 't');
  });
  // Ground-floor windows.
  for (const wx of [9, 69]) {
    for (let y = 46; y <= 54; y++) for (let x = wx; x < wx + 6; x++) put(x, y, wx === 9 ? 'G' : 'g');
    for (let x = wx - 1; x <= wx + 6; x++) put(x, 55, 't');
  }
  // The door, its frame, and the brass knob.
  for (let y = 45; y <= 59; y++) for (let x = 35; x <= 48; x++) put(x, y, 'd');
  for (let y = 44; y <= 59; y++) {
    put(34, y, 't');
    put(49, y, 't');
  }
  for (let x = 34; x <= 49; x++) put(x, 44, 't');
  put(46, 53, 'k');
  // Steps, with warm light spilling from under the door. Come in.
  for (let x = 30; x <= 53; x++) put(x, 60, 'S');
  for (let x = 27; x <= 56; x++) put(x, 61, 'S');
  for (let x = 24; x <= 59; x++) put(x, 62, 'S');
  for (let x = 39; x <= 44; x++) put(x, 60, 'g');
  for (let x = 40; x <= 43; x++) put(x, 61, 'g');
  put(41, 62, 'g');
  put(42, 62, 'g');
  return grid.map((row) => row.join(''));
})();

export const MANSION_COLORS = {
  c: PALETTE.fog,
  R: PALETTE.smokeDeep,
  r: PALETTE.dusk,
  S: PALETTE.smoke,
  A: PALETTE.void, // the renderer swaps this to gold when the attic wakes
  w: PALETTE.dirt,
  V: PALETTE.clay,
  t: PALETTE.smokeDeep,
  g: PALETTE.gold,
  G: PALETTE.night,
  d: PALETTE.soil,
  k: PALETTE.goldRose,
};

/** The attic window lights for a few seconds at a time. Nobody is up there. */
export function mansionAtticLit(time) {
  return Math.sin(time * 0.43) > 0.82;
}

// Interior furnishings — small sprites, all base-center anchored.

// A grandfather clock (12x27): plum case, gold face, long pendulum slot.
export const CLOCK_SPRITE = [
  '..tttttttt..',
  '.twwwwwwwwt.',
  'ttwwwwwwwwtt',
  'twwggggggwwt',
  'twwggggggwwt',
  'twwggkkggwwt',
  'twwggggggwwt',
  'twwwwwwwwwwt',
  'twwwwwwwwwwt',
  'tww..kk..wwt',
  'tww..kk..wwt',
  'tww...k..wwt',
  'tww...k..wwt',
  'tww..k...wwt',
  'tww..k...wwt',
  'tww...k..wwt',
  'tww...k..wwt',
  'tww..kk..wwt',
  'twwwwwwwwwwt',
  'twwwwwwwwwwt',
  'twwwwwwwwwwt',
  'ttwwwwwwwwtt',
  '.tttttttttt.',
  '.t........t.',
  '.t........t.',
  'tt........tt',
  'tt........tt',
];

// An old portrait (18x20): brass frame, a dark canvas, two moonlit eyes the
// renderer positions itself — they follow whoever is in the room.
export const PORTRAIT_SPRITE = [
  'tttttttttttttttttt',
  'tggggggggggggggggt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGwGGGGwGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGwwwwGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tggggggggggggggggt',
  'tttttttttttttttttt',
  '......tttttt......',
  '.......tttt.......',
];

// A bookshelf (24x20): plum case, spines mostly muted with one ember each.
export const SHELF_SPRITE = [
  'tttttttttttttttttttttttt',
  'tppvvpptppvvppmppvvpppvt',
  'tppvvpptppvvppmppvvpppvt',
  'tppvvpptppvvppmppvvpppvt',
  'tttttttttttttttttttttttt',
  'tvppvtppvppbppvtppvppppt',
  'tvppvtppvppbppvtppvppppt',
  'tvppvtppvppbppvtppvppppt',
  'tttttttttttttttttttttttt',
  'tpvpptmppvtppvppptvppppt',
  'tpvpptmppvtppvppptvppppt',
  'tpvpptmppvtppvppptvppppt',
  'tttttttttttttttttttttttt',
  'tppvppptvppmppvtppvppppt',
  'tppvppptvppmppvtppvppppt',
  'tttttttttttttttttttttttt',
  't......................t',
  't......................t',
  'tt....................tt',
  'tt....................tt',
];

// A long table (27x14) and a chair (11x14).
export const TABLE_SPRITE = [
  'sssssssssssssssssssssssssss',
  'sppppppppppppppppppppppppps',
  'sppppppppppppppppppppppppps',
  'sssssssssssssssssssssssssss',
  '..t.....................t..',
  '..t.....................t..',
  '..t.....................t..',
  '..t.....................t..',
  '..t.....................t..',
  '..t.....................t..',
  '..t.....................t..',
  '..t.....................t..',
  '.tt.....................tt.',
  '.tt.....................tt.',
];
export const CHAIR_SPRITE = [
  'sssssss....',
  'sppppps....',
  'sppppps....',
  'sppppps....',
  'sppppps....',
  'ssppssss...',
  'spp....s...',
  'sssssssss..',
  'sssssssss..',
  't.......t..',
  't.......t..',
  't.......t..',
  't.......t..',
  't.......t..',
];

// A candelabra (11x18) — the renderer animates its flames.
export const CANDELABRA_SPRITE = [
  '...........',
  '.k....k....',
  '.k....k...k',
  '.k....k...k',
  '.kkkkkkkkkk',
  '......k....',
  '......k....',
  '......k....',
  '......k....',
  '.....kkk...',
  '......k....',
  '......k....',
  '......k....',
  '.....kkk...',
  '....kkkkk..',
  '...kkkkkkk.',
  '..ttttttttt',
  '..ttttttttt',
];

// A chandelier (24x14), hanging over the hall.
export const CHANDELIER_SPRITE = [
  '...........kk...........',
  '...........kk...........',
  '...........kk...........',
  '...........kk...........',
  'g..........kk..........g',
  'kg.........kk.........gk',
  'kkg........kk........gkk',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  '..kk.......kk.......kk..',
  '...kkkkkkkkkkkkkkkkkk...',
  '.....kkkkkkkkkkkkkk.....',
  '........kkkkkkkk........',
  '........................',
  '........................',
];

export const FURNISH_COLORS = {
  t: PALETTE.smokeDeep,
  s: PALETTE.smoke,
  w: PALETTE.plumDeep,
  g: PALETTE.brass,
  G: PALETTE.night,
  k: PALETTE.gold,
  v: PALETTE.violet,
  m: PALETTE.magenta,
  b: PALETTE.blue,
  p: PALETTE.plum,
};

/** Candle/attic flames sway between gold and rose at a slow flicker. */
export function flameColor(time, phase = 0) {
  return Math.sin(time * 6 + phase) > 0.2 ? PALETTE.goldRose : PALETTE.gold;
}
