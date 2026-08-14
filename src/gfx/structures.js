// Terrain structures: the mysterious cabin, cave mouths, mountain rocks, and
// the mansion (outside and in). Pure data + geometry — the renderer
// rasterizes.
//
// v0.16 redrew all of it ~1.5x larger for the finer screen, against the new
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

// --- The television (v0.17) -------------------------------------------------

// An old set in the mansion's parlor, glowing rose with a channel that never
// broadcasts anything but heaven. 20 wide x 16 tall, base-center anchored.
// 'a' antenna, 'C' cabinet, 'c' cabinet shadow, 'S' the rose screen,
// 's' screen edge, 'k' knobs, 'L' legs.
export const TELEVISION_SPRITE = [
  '...a........a.......',
  '....a......a........',
  '.....a....a.........',
  '......a..a..........',
  '.......aa...........',
  '.CCCCCCCCCCCCCCCCCC.',
  'cCssssssssssssssCkCC',
  'cCsSSSSSSSSSSSSsCkCC',
  'cCsSSSSSSSSSSSSsCCCC',
  'cCsSSSSSSSSSSSSsCkCC',
  'cCsSSSSSSSSSSSSsCkCC',
  'cCsSSSSSSSSSSSSsCCCC',
  'cCssssssssssssssCCCC',
  '.CCCCCCCCCCCCCCCCCC.',
  '..LL............LL..',
  '..LL............LL..',
];

export const TELEVISION_COLORS = {
  a: PALETTE.smoke,
  C: PALETTE.clay,
  c: PALETTE.amber,
  S: PALETTE.pink,
  s: PALETTE.magenta,
  k: PALETTE.gold,
  L: PALETTE.amber,
};

// --- Upstairs (v0.20): the mansion's second floor furnishings ---------------
//
// Same idiom and the same FURNISH_COLORS ramp as the ground floor, so the
// two stories read as one house: smokeDeep case wood, plum upholstery,
// brass fittings, gold for anything lit, night for anything that is glass.

// The bed (30x14): a plum quilt, a smoke pillow, a headboard on the west
// wall side. Nobody has slept badly in it; nobody has slept in it at all.
export const BED_SPRITE = [
  'ttt...........................',
  'twwt..........................',
  'twwt..........................',
  'twwtsss.......................',
  'twwsssss......................',
  'twwsssssppppppppppppppppppppp.',
  'twwppppppppppppppppppppppppppp',
  'twpppwwppppwwppppwwppppwwppppp',
  'twpppppppppppppppppppppppppppp',
  'ttwwwwwwwwwwwwwwwwwwwwwwwwwwwt',
  'ttssssssssssssssssssssssssssst',
  '.tt.........................tt',
  '.tt.........................tt',
  '.tt.........................tt',
];

// The nightstand (10x13): two drawers and a candle that keeps its own hours.
export const NIGHTSTAND_SPRITE = [
  '....kk....',
  '....ss....',
  '....ss....',
  'tttttttttt',
  'twwwwwwwwt',
  'twwwwkwwwt',
  'twwwwwwwwt',
  'tttttttttt',
  'twwwwwwwwt',
  'twwwwkwwwt',
  'twwwwwwwwt',
  'tttttttttt',
  't........t',
];

// The telescope (14x16): a brass tube on a tripod, aimed out the window at
// the top-right — at the moon, or at whatever heaven the set downstairs gets.
export const TELESCOPE_SPRITE = [
  '...........gg.',
  '..........ggg.',
  '.........ggg..',
  '........ggg...',
  '.......ggg....',
  '......ggg.....',
  '.....ggk......',
  '.....kk.......',
  '.....tt.......',
  '....t..t......',
  '....t..t......',
  '...t....t.....',
  '...t....t.....',
  '..t......t....',
  '..t......t....',
  '.tt......tt...',
];

// The study desk (26x13): papers, a gold inkwell, and drawers that lock.
export const DESK2_SPRITE = [
  '......kk..................',
  '.sssss..sssss.............',
  'ssssssssssssssssssssssssss',
  'wwwwwwwwwwwwwwwwwwwwwwwwww',
  '.tt.wwwwwwwwwwwwwwwww.tt..',
  '.tt.wwwwkwwwwwwkwwwww.tt..',
  '.tt.wwwwwwwwwwwwwwwww.tt..',
  '.tt.wwwwwwwwwwwwwwwww.tt..',
  '.tt...................tt..',
  '.tt...................tt..',
  '.tt...................tt..',
  '.tt...................tt..',
  'ttt...................ttt.',
];

// The second portrait (18x20): the same brass frame as downstairs, a
// different sitter — a violet figure this time. The eyes still follow; the
// renderer paints them.
export const PORTRAIT2_SPRITE = [
  'tttttttttttttttttt',
  'tggggggggggggggggt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGvvvvvvvGGGGgt',
  'tgGGGvGGGGGvGGGGgt',
  'tgGGGvvvvvvvGGGGgt',
  'tgGGGGvvvvvGGGGGgt',
  'tgGGGvvvvvvvGGGGgt',
  'tgGGvvvvvvvvvGGGgt',
  'tgGGvvvGGGvvvGGGgt',
  'tgGGvvvGGGvvvGGGgt',
  'tgGGvvvvvvvvvGGGgt',
  'tgGGvvvvvvvvvGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tgGGGGGGGGGGGGGGgt',
  'tggggggggggggggggt',
  'tttttttttttttttttt',
  '......tttttt......',
  '.......tttt.......',
];

// --- v0.21: the BIG exteriors ------------------------------------------------
//
// The owner's note: use the person (~30px) as the unit, and let the buildings
// tower the way a Secret of Mana town does. So the cabin goes to ~3
// person-heights, the mansion to ~5, and the ghost town keeps pace. These are
// all code-built at module load (the grids are too big to hand-letter) and
// fully deterministic — texture comes from an integer hash, never
// Math.random. Anchored at base center like everything else. Each doorway is
// exported as { dx, w }: the horizontal offset of the doorway's center from
// the sprite's bottom-center, and the doorway's width in pixels, so the walk
// code can line a person up with the dark.

function makeGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill('.'));
}

function gput(grid, x, y, ch) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = ch;
}

function gridRows(grid) {
  return grid.map((row) => row.join(''));
}

/** Deterministic 0..1 from an integer — texture noise without Math.random. */
function hashN(n) {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 13), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// --- The big cabin (130x90, ~3 person-heights) -------------------------------
//
// Log-timber under a deep-eaved roof, a stone chimney with a thin wisp of
// smoke still thinking about leaving, one gold window, and a doorway at
// bottom-center standing open on nothing at all.

export const BIG_CABIN_SPRITE = (() => {
  const W = 130;
  const H = 90;
  const g = makeGrid(W, H);
  // The wisp: two pixels wide, drifting, sometimes not there.
  for (let y = 0; y <= 9; y++) {
    const drift = Math.round(Math.sin(y * 0.8 + 1.2) * 2);
    if (hashN(y * 31 + 7) > 0.25) {
      gput(g, 101 + drift, y, 'M');
      if (y > 2) gput(g, 102 + drift, y, 'M');
    }
  }
  // The roof: a broad pitch with deep eaves, shingle courses shadowed every
  // fourth row, the left third dithered into the dark, the right edge
  // catching goldRose off the moon.
  const roofTop = 12;
  const eaves = 40;
  for (let y = roofTop; y <= eaves; y++) {
    const t = (y - roofTop) / (eaves - roofTop);
    const half = Math.round(22 + t * 43);
    const xL = 65 - half;
    const xR = 64 + half;
    for (let x = xL; x <= xR; x++) {
      let ch = 'R';
      if ((y - roofTop) % 4 === 3) ch = 'r';
      if (x < 34 && (x + y) % 2 === 0) ch = 'r';
      if (x <= xL + 1) ch = 'r';
      if (x >= xR - 1) ch = y % 2 === 0 ? 'G' : 'R';
      gput(g, x, y, ch);
    }
  }
  // The chimney, stone by stone, buried into the pitch.
  for (let y = 10; y <= 26; y++) {
    for (let x = 96; x <= 107; x++) {
      let ch = hashN(x * 7 + y * 13) > 0.45 ? 'C' : 'c';
      if (y === 10) ch = 'Z';
      gput(g, x, y, ch);
    }
  }
  // The eaves' shadow lands on the wall, then the log courses: a soil seam
  // every fifth row, the right flank in clay where the moon reaches.
  for (let y = 41; y <= 42; y++) for (let x = 10; x <= 119; x++) gput(g, x, y, 'u');
  for (let y = 43; y <= 87; y++) {
    for (let x = 10; x <= 119; x++) {
      const seam = (y - 43) % 5 === 4;
      let ch;
      if (seam) ch = 'q';
      else if (x >= 96) ch = 'v';
      else if (x >= 88 && (x + y) % 2 === 0) ch = 'v';
      else ch = 'w';
      if (x <= 11) ch = 'q';
      if (x >= 118) ch = 'L';
      gput(g, x, y, ch);
    }
  }
  for (let y = 88; y <= 89; y++) for (let x = 8; x <= 121; x++) gput(g, x, y, 'f');
  // The one lit window, mullioned, with its glow dropped on the logs below.
  for (let y = 50; y <= 65; y++) {
    for (let x = 26; x <= 41; x++) {
      const frame = x === 26 || x === 41 || y === 50 || y === 65
        || x === 33 || x === 34 || y === 57 || y === 58;
      gput(g, x, y, frame ? 't' : 'W');
    }
  }
  for (let x = 25; x <= 42; x++) gput(g, x, 66, 't');
  for (let x = 29; x <= 38; x++) if (hashN(x * 5 + 1) > 0.35) gput(g, x, 67, 'a');
  // The doorway: framed, void, bottom-center, 14 wide and taller than anyone
  // who would use it.
  for (let x = 56; x <= 73; x++) {
    gput(g, x, 55, 't');
    gput(g, x, 56, 't');
  }
  for (let y = 55; y <= 87; y++) {
    gput(g, 56, y, 't');
    gput(g, 57, y, 't');
    gput(g, 72, y, 't');
    gput(g, 73, y, 't');
  }
  for (let y = 57; y <= 87; y++) for (let x = 58; x <= 71; x++) gput(g, x, y, 'D');
  for (let x = 54; x <= 75; x++) {
    gput(g, x, 88, 'p');
    gput(g, x, 89, 'p');
  }
  return gridRows(g);
})();

export const BIG_CABIN_COLORS = {
  M: PALETTE.smoke, // the wisp off the chimney
  Z: PALETTE.smoke, // the chimney cap catching the moon
  C: PALETTE.dusk, // chimney stone
  c: PALETTE.fog, // stone in shadow, mortar
  R: PALETTE.smoke, // lit shingles
  r: PALETTE.smokeDeep, // shingle course shadow, the dark side of the pitch
  G: PALETTE.goldRose, // rim accents along the moonlit roof edge
  u: PALETTE.fog, // the deep eaves' shadow on the logs
  w: PALETTE.dirt, // log courses
  v: PALETTE.clay, // logs on the moonlit flank
  q: PALETTE.soil, // seams between courses, the shadow corner
  L: PALETTE.loam, // log ends catching the moon
  f: PALETTE.soil, // foundation
  t: PALETTE.smokeDeep, // window and door framing
  W: PALETTE.gold, // the one lit window
  a: PALETTE.amber, // its glow on the wall below
  D: PALETTE.void, // the doorway, open on nothing
  p: PALETTE.clay, // the step
};

// Doorway x 58..71 → center 64.5, dead on the sprite's bottom-center (65).
export const BIG_CABIN_DOOR = { dx: 0, w: 14 };

// --- The big mansion (230x170, ~5 person-heights) ----------------------------
//
// Three gabled stories, the attic window that still answers to
// mansionAtticLit, a porch on pale columns, and iron fence hints at both
// flanks. The 'A' region is void until the renderer decides otherwise.

export const BIG_MANSION_SPRITE = (() => {
  const W = 230;
  const H = 170;
  const g = makeGrid(W, H);
  // The gable, full width, lit pitch to the right, goldRose along its edge.
  const ridge = 4;
  const eavesY = 54;
  for (let y = ridge; y <= eavesY; y++) {
    const t = (y - ridge) / (eavesY - ridge);
    const half = Math.round(8 + t * 106);
    const xL = 115 - half;
    const xR = 114 + half;
    for (let x = xL; x <= xR; x++) {
      let ch = x > 115 ? 'S' : 'r';
      if (x > 115 && (y - ridge) % 3 === 0) ch = 'r';
      if (x <= xL + 1 || x >= xR - 1 || y >= eavesY - 1) ch = 'R';
      if (x >= xR - 1 && y % 2 === 1) ch = 'k';
      gput(g, x, y, ch);
    }
  }
  // The chimney, left of the ridge, through the dark pitch.
  for (let y = 0; y <= 36; y++) {
    for (let x = 40; x <= 52; x++) gput(g, x, y, y < 3 ? 'R' : 'c');
  }
  // The attic window. Mostly dark. Mostly.
  for (let y = 24; y <= 40; y++) {
    for (let x = 105; x <= 124; x++) {
      const frame = x <= 106 || x >= 123 || y <= 25 || y >= 39;
      gput(g, x, y, frame ? 't' : 'A');
    }
  }
  // Eaves band, then three stories of wall with the moonlit flank feathered.
  for (let x = 0; x < W; x++) {
    gput(g, x, eavesY, 'R');
    gput(g, x, eavesY + 1, 'R');
  }
  for (let y = 56; y <= 155; y++) {
    for (let x = 2; x <= 227; x++) {
      const lit = x >= 176 || (x >= 156 && (x + y) % 2 === 0);
      gput(g, x, y, lit ? 'V' : 'w');
    }
  }
  for (const ty of [88, 120]) for (let x = 2; x <= 227; x++) gput(g, x, ty, 't');
  // Tall windows, two stories of four — lit and dark trading places.
  const storyWin = (wy, litPattern) => {
    [16, 58, 158, 200].forEach((wx, i) => {
      for (let y = wy; y < wy + 24; y++) {
        for (let x = wx; x < wx + 12; x++) {
          const mull = x === wx + 5 || x === wx + 6 || y === wy + 11 || y === wy + 12;
          gput(g, x, y, mull ? 't' : litPattern[i] ? 'g' : 'n');
        }
      }
      for (let x = wx - 2; x < wx + 14; x++) gput(g, x, wy + 24, 't');
    });
  };
  storyWin(60, [0, 1, 1, 0]);
  storyWin(92, [1, 0, 0, 1]);
  // Ground floor: one dark window, one lit, either side of the porch.
  for (const wx of [16, 200]) {
    for (let y = 126; y < 150; y++) {
      for (let x = wx; x < wx + 12; x++) {
        const mull = x === wx + 5 || x === wx + 6 || y === 137 || y === 138;
        gput(g, x, y, mull ? 't' : wx === 16 ? 'n' : 'g');
      }
    }
    for (let x = wx - 2; x < wx + 14; x++) gput(g, x, 150, 't');
  }
  // The porch: a smoke slab on four pale columns.
  for (let y = 114; y <= 118; y++) {
    for (let x = 54; x <= 176; x++) gput(g, x, y, y === 114 ? 'S' : 'R');
  }
  for (const cx of [58, 92, 134, 168]) {
    for (let y = 119; y <= 155; y++) {
      gput(g, cx, y, 'P');
      gput(g, cx + 1, y, 'p');
      gput(g, cx + 2, y, 'P');
    }
  }
  // The door, its fanlight, and the knob. Still never locked.
  for (let y = 120; y <= 155; y++) for (let x = 105; x <= 124; x++) gput(g, x, y, 't');
  for (let y = 122; y <= 155; y++) for (let x = 107; x <= 122; x++) gput(g, x, y, 'd');
  for (let x = 108; x <= 121; x++) gput(g, x, 121, 'g');
  gput(g, 119, 140, 'k');
  gput(g, 120, 140, 'k');
  // Steps, with warm light spilling down them.
  for (let s = 0; s < 5; s++) {
    for (let x = 100 - s * 5; x <= 129 + s * 5; x++) gput(g, x, 156 + s, 'S');
  }
  for (let x = 109; x <= 120; x++) gput(g, x, 156, 'g');
  for (let x = 111; x <= 118; x++) gput(g, x, 157, 'g');
  for (let x = 113; x <= 116; x++) gput(g, x, 158, 'g');
  // Iron fence hints at the flanks, in front of the grounds.
  for (const [fx0, fx1] of [[0, 42], [187, 229]]) {
    for (let x = fx0; x <= fx1; x++) {
      gput(g, x, 160, 'i');
      gput(g, x, 165, 'i');
    }
    for (let x = fx0; x <= fx1; x += 4) {
      gput(g, x, 158, 'I');
      for (let y = 159; y <= 169; y++) gput(g, x, y, 'i');
    }
  }
  return gridRows(g);
})();

export const BIG_MANSION_COLORS = {
  c: PALETTE.fog, // the chimney
  R: PALETTE.smokeDeep, // roof edges, eaves, porch underside
  r: PALETTE.dusk, // the dark pitch and its shingle courses
  S: PALETTE.smoke, // the lit pitch, the porch slab, the steps
  k: PALETTE.goldRose, // rim accents, and the knob
  A: PALETTE.void, // the attic — the renderer swaps in gold via mansionAtticLit
  t: PALETTE.smokeDeep, // trims, sills, frames
  w: PALETTE.dirt, // walls
  V: PALETTE.clay, // the moonlit flank
  g: PALETTE.gold, // lit windows, the fanlight, the spill on the steps
  n: PALETTE.night, // dark windows
  d: PALETTE.soil, // the door
  p: PALETTE.moonshadow, // porch column shadow
  P: PALETTE.smoke, // porch column faces
  i: PALETTE.fog, // the iron fence
  I: PALETTE.smokeDeep, // its finials
};

// Doorway x 107..122 → center 114.5, dead on bottom-center (115).
export const BIG_MANSION_DOOR = { dx: 0, w: 16 };

// --- The big ruins (~3 person-heights each) ----------------------------------
//
// The ghost town at town scale: sagging rooflines, boarded void windows,
// exposed rafters where the roof gave up, and a moonshadow rim on every
// break line — the moon inspects the damage nightly.

function buildBigRuin({ w, h, sag, windows, door, doorW = 12, porch, collapse = 0, gaps = [] }) {
  const g = makeGrid(w, h);
  const roofTop = 5;
  const roofY = (x) => roofTop + Math.round(sag * Math.sin((Math.PI * x) / (w - 1)));
  for (let x = 0; x < w; x++) {
    if (collapse && x >= w - collapse) continue;
    const ry = roofY(x);
    const inGap = gaps.some(([a, b]) => x >= a && x <= b);
    if (inGap) {
      // The roof surface is gone here: rafter stubs every third pixel,
      // void between, a moon rim along the tear.
      gput(g, x, ry - 1, 'M');
      for (let y = ry; y <= ry + 2; y++) gput(g, x, y, x % 3 === 0 ? 'E' : 'o');
    } else {
      gput(g, x, ry, 'R');
      gput(g, x, ry + 1, 'R');
      gput(g, x, ry + 2, 'R');
      if (x > w * 0.5) gput(g, x, ry - 1, 'r');
    }
    for (let y = ry + 3; y < h; y++) gput(g, x, y, x < 4 ? 's' : x >= w - 3 ? 'r' : 'F');
  }
  if (collapse) {
    // The corner that quit: the wall steps down after the roof, the broken
    // course moon-rimmed, rafters leaning into the gap.
    const brokenTop = (x) => roofTop + 4 + Math.round((x - (w - collapse)) * 1.6);
    for (let x = w - collapse; x < w; x++) {
      const top = brokenTop(x);
      if (top >= h) continue;
      for (let y = top + 1; y < h; y++) gput(g, x, y, x >= w - 3 ? 'r' : 'F');
      gput(g, x, top, 'M');
    }
    // Exposed rafters: snapped studs rising from the broken course, two
    // pixels wide, moon-tipped — the framing the roof left behind.
    for (let i = 0; i < 4; i++) {
      const sx = w - collapse + 5 + i * Math.max(6, Math.floor(collapse / 4));
      if (sx >= w - 4) break;
      const top = brokenTop(sx);
      if (top >= h) break;
      const stubTop = Math.max(0, top - 6);
      for (let y = stubTop; y < top; y++) {
        gput(g, sx, y, 'E');
        gput(g, sx + 1, y, y === stubTop ? 'M' : 'E');
      }
    }
  }
  // Boarded windows: void behind, soil nailed across. Still no light in any.
  for (const [wx, wy] of windows) {
    for (let dy = 0; dy < 12; dy++) {
      for (let dx = 0; dx < 10; dx++) {
        gput(g, wx + dx, wy + dy, dy % 3 === 2 ? 'B' : 'o');
      }
    }
  }
  // A doorway with no door left to close, tall enough for anyone who isn't
  // coming back anyway.
  const doorH = 34;
  for (let y = h - doorH; y < h; y++) {
    for (let x = door; x < door + doorW; x++) gput(g, x, y, 'o');
  }
  gput(g, door + Math.floor(doorW / 2), h - doorH - 1, 'o');
  gput(g, door + Math.floor(doorW / 2) + 1, h - doorH - 1, 'o');
  if (porch) {
    // The porch roof is leaving; two posts hold, one leans.
    const { x0, x1, y } = porch;
    for (let x = x0; x <= x1; x++) {
      const py = y + Math.round(((x - x0) / (x1 - x0)) * 4);
      gput(g, x, py, 'R');
      gput(g, x, py + 1, 'R');
      if (x > (x0 + x1) / 2) gput(g, x, py - 1, 'r');
    }
    const mid = Math.round((x0 + x1) / 2);
    [x0 + 2, mid - 20, mid + 20, x1 - 3].forEach((px, i) => {
      for (let py = y + 2; py < h; py++) {
        const lean = i === 2 && py > h - 10 ? 1 : 0;
        gput(g, px + lean, py, 's');
        gput(g, px + lean + 1, py, 's');
      }
    });
  }
  return gridRows(g);
}

const BIG_RUIN_COLORS = {
  R: PALETTE.plumDeep, // what remains of the roof
  r: PALETTE.smokeDeep, // the moon along ridge and flank
  F: PALETTE.dusk, // the walls
  s: PALETTE.soil, // the shadow flank, the porch posts
  B: PALETTE.soil, // the boards
  o: PALETTE.void, // behind the boards, and every doorway
  E: PALETTE.clay, // exposed rafters
  M: PALETTE.moonshadow, // the rim on every break line
};

export const BIG_RUIN_SPRITES = [
  // The general store, collapsed over whatever stock was left.
  {
    map: buildBigRuin({
      w: 140,
      h: 92,
      sag: 5,
      windows: [
        [14, 32],
        [34, 32],
        [96, 32],
        [116, 32],
      ],
      door: 64,
      collapse: 26,
    }),
    colors: BIG_RUIN_COLORS,
    door: { dx: 0, w: 12 }, // doorway x 64..75, centered on bottom-center
  },
  // The hotel: the biggest building, the emptiest, porch mid-goodbye.
  {
    map: buildBigRuin({
      w: 150,
      h: 110,
      sag: 7,
      windows: [
        [12, 26],
        [36, 26],
        [64, 26],
        [92, 26],
        [120, 26],
        [12, 60],
        [126, 60],
      ],
      door: 69,
      porch: { x0: 6, x1: 143, y: 70 },
      gaps: [[52, 68]],
    }),
    colors: BIG_RUIN_COLORS,
    door: { dx: 0, w: 12 }, // doorway x 69..80, centered on bottom-center
  },
  // The one whose corner quit first. Whatever it was, it's this now.
  {
    map: buildBigRuin({
      w: 126,
      h: 96,
      sag: 4,
      windows: [
        [16, 34],
        [42, 34],
        [68, 34],
      ],
      door: 30,
      collapse: 34,
    }),
    colors: {
      ...BIG_RUIN_COLORS,
      R: PALETTE.soil,
      F: PALETTE.plumDeep,
      B: PALETTE.dusk,
    },
    door: { dx: -27, w: 12 }, // doorway x 30..41, west of center
  },
];

// --- The big bail-bonds office (130x90) --------------------------------------
//
// Brick, a cornice with moonlit coping, one big amber window with 'BB'
// painted on the glass, a lit transom over an open door, and a brass
// bracket swinging a board that says the same two letters.

export const BIG_OFFICE_SPRITE = (() => {
  const W = 130;
  const H = 90;
  const g = makeGrid(W, H);
  // Brick courses: a mortar row every fourth, joints staggered by band,
  // the moonlit flank in plum, the odd brick gone dusk.
  for (let y = 6; y <= 87; y++) {
    for (let x = 8; x <= 121; x++) {
      const band = Math.floor((y - 6) / 4);
      const mortarRow = (y - 6) % 4 === 3;
      const joint = (x + band * 4) % 9 === 0;
      let ch = mortarRow || joint ? 'j' : x >= 104 ? 'l' : 'b';
      if (!mortarRow && !joint && hashN(x * 13 + y * 29) > 0.93) ch = 'v';
      gput(g, x, y, ch);
    }
  }
  // Cornice: coping in smoke, goldRose glints on the moon side, corbels under.
  for (let x = 6; x <= 123; x++) {
    gput(g, x, 4, 'C');
    gput(g, x, 5, 'C');
  }
  for (let x = 100; x <= 123; x += 3) gput(g, x, 3, 'G');
  for (let x = 8; x <= 121; x += 6) {
    gput(g, x, 6, 't');
    gput(g, x + 1, 6, 't');
  }
  for (let y = 88; y <= 89; y++) for (let x = 6; x <= 123; x++) gput(g, x, y, 'q');
  // The big front window, amber-lit, 'BB' in gold on the glass.
  for (let y = 34; y <= 69; y++) {
    for (let x = 20; x <= 75; x++) {
      const frame = x <= 21 || x >= 74 || y <= 35 || y >= 68;
      gput(g, x, y, frame ? 't' : 'a');
    }
  }
  const BGLYPH = ['gggg.', 'g...g', 'g...g', 'gggg.', 'g...g', 'g...g', 'gggg.'];
  const stampB = (x0, y0) => {
    BGLYPH.forEach((row, dy) => {
      [...row].forEach((bit, dxg) => {
        if (bit !== 'g') return;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) gput(g, x0 + dxg * 2 + sx, y0 + dy * 2 + sy, 'g');
        }
      });
    });
  };
  stampB(36, 44);
  stampB(50, 44);
  for (let x = 18; x <= 77; x++) gput(g, x, 70, 't');
  for (let x = 26; x <= 69; x++) if (hashN(x * 3 + 5) > 0.35) gput(g, x, 71, 'a');
  // The transom, lit, then the door below it, open.
  for (let y = 50; y <= 55; y++) {
    for (let x = 88; x <= 105; x++) {
      const frame = x <= 89 || x >= 104 || y === 50;
      gput(g, x, y, frame ? 't' : 'a');
    }
  }
  for (let y = 56; y <= 87; y++) {
    gput(g, 88, y, 't');
    gput(g, 89, y, 't');
    gput(g, 104, y, 't');
    gput(g, 105, y, 't');
  }
  for (let y = 56; y <= 87; y++) for (let x = 90; x <= 103; x++) gput(g, x, y, 'D');
  for (let x = 86; x <= 107; x++) {
    gput(g, x, 88, 'p');
    gput(g, x, 89, 'p');
  }
  // The sign bracket: a brass arm off the left shoulder, braced back into
  // the brick, chains down to a weathered board. It also says BB.
  for (let x = 0; x <= 12; x++) gput(g, x, 16, 'k');
  gput(g, 12, 17, 'k');
  gput(g, 13, 18, 'k');
  gput(g, 14, 19, 'k');
  gput(g, 15, 20, 'k');
  gput(g, 2, 17, 'c');
  gput(g, 2, 18, 'c');
  gput(g, 9, 17, 'c');
  gput(g, 9, 18, 'c');
  for (let y = 19; y <= 28; y++) for (let x = 0; x <= 11; x++) gput(g, x, y, 'o');
  const SMALL_B = ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'];
  for (const bx of [2, 6]) {
    SMALL_B.forEach((row, dy) => {
      [...row].forEach((bit, dxg) => {
        if (bit === 'x') gput(g, bx + dxg, 21 + dy, 'x');
      });
    });
  }
  return gridRows(g);
})();

export const BIG_OFFICE_COLORS = {
  C: PALETTE.smoke, // moonlit coping
  G: PALETTE.goldRose, // glints along it
  b: PALETTE.plumDeep, // brick
  l: PALETTE.plum, // brick on the moonlit flank
  j: PALETTE.soil, // mortar
  v: PALETTE.dusk, // the odd off-color brick
  q: PALETTE.soil, // foundation
  t: PALETTE.smokeDeep, // frames, sill, corbels
  a: PALETTE.amber, // the big lit window, the transom, the spill
  g: PALETTE.gold, // the 'BB' painted on the glass
  D: PALETTE.void, // the door stands open
  p: PALETTE.clay, // the threshold step
  k: PALETTE.brass, // the sign bracket
  c: PALETTE.fog, // its chains
  o: PALETTE.loam, // the hanging board
  x: PALETTE.soil, // what the board says. BB.
};

// Doorway x 90..103 → center 96.5, east of bottom-center (65).
export const BIG_OFFICE_DOOR = { dx: 32, w: 14 };

/**
 * The set's living static: warm sparks drifting inside the screen, and a
 * soft spill of rose on the floor below. Offsets relative to the base
 * center; the screen interior spans x -7..6, y -9..-4.
 */
export function tvGlowPixels(time) {
  const pixels = [];
  const tick = Math.floor(time * 10);
  for (let i = 0; i < 6; i++) {
    const h = ((tick + i * 37) * 2654435761) >>> 0;
    const x = -7 + (h % 14);
    const y = -9 + ((h >> 4) % 6);
    pixels.push({ x, y, c: (h >> 8) & 1 ? PALETTE.hotRose : PALETTE.goldRose });
  }
  // The rose spill on the parquet, breathing slowly.
  if (Math.sin(time * 1.1) > -0.4) {
    pixels.push({ x: -4, y: 1, c: PALETTE.plum });
    pixels.push({ x: 0, y: 1, c: PALETTE.plum });
    pixels.push({ x: 4, y: 1, c: PALETTE.plum });
  }
  return pixels;
}
