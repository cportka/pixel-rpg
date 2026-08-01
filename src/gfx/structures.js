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

// ---------------------------------------------------------------------------
// The mansion (v0.14): a brooding two-story facade in the woods — gabled
// roof, chimney, one attic window that is sometimes lit and should not be,
// tall brass-lit windows, and a door that was never locked. Built by code so
// the 56x42 grid stays exact; anchored at base center like everything else.

export const MANSION_SPRITE = (() => {
  const W = 56;
  const H = 42;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (x, y, ch) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch;
  };
  // Chimney, left of the gable.
  for (let y = 0; y <= 7; y++) for (let x = 12; x <= 15; x++) put(x, y, 'c');
  // Gable roof.
  for (let y = 0; y <= 15; y++) {
    const half = Math.round(2 + (y * 26) / 15);
    for (let x = 28 - half; x <= 27 + half; x++) {
      const edge = x <= 28 - half + 1 || x >= 27 + half - 1 || y === 15;
      if (grid[y][x] === '.') put(x, y, edge ? 'R' : 'r');
    }
  }
  // The attic window. Mostly dark. Mostly.
  for (let y = 7; y <= 10; y++) for (let x = 26; x <= 29; x++) put(x, y, 'A');
  // Eaves, then two stories of wall — the moonlit flank on the right,
  // feathered in with a checkerboard so it reads as light, not paint.
  for (let x = 0; x < W; x++) put(x, 16, 'R');
  for (let y = 17; y <= 39; y++) {
    for (let x = 0; x < W; x++) {
      const lit = x >= W - 14 || (x >= W - 20 && (x + y) % 2 === 0);
      put(x, y, lit ? 'V' : 'w');
    }
  }
  for (let x = 0; x < W; x++) put(x, 28, 't');
  // Upper-floor windows (two lit, two dark), with sills.
  [6, 20, 32, 46].forEach((wx, i) => {
    for (let y = 19; y <= 25; y++) for (let x = wx; x < wx + 4; x++) put(x, y, i % 2 === 0 ? 'g' : 'G');
    for (let x = wx - 1; x <= wx + 4; x++) put(x, 26, 't');
  });
  // Ground-floor windows.
  for (const wx of [6, 46]) {
    for (let y = 31; y <= 36; y++) for (let x = wx; x < wx + 4; x++) put(x, y, wx === 6 ? 'G' : 'g');
    for (let x = wx - 1; x <= wx + 4; x++) put(x, 37, 't');
  }
  // The door, its frame, and the brass knob.
  for (let y = 30; y <= 39; y++) for (let x = 23; x <= 32; x++) put(x, y, 'd');
  for (let y = 29; y <= 39; y++) {
    put(22, y, 't');
    put(33, y, 't');
  }
  for (let x = 22; x <= 33; x++) put(x, 29, 't');
  put(31, 35, 'k');
  // Steps — with a spill of warm light from under the door. Come in.
  for (let x = 20; x <= 35; x++) put(x, 40, 'S');
  for (let x = 18; x <= 37; x++) put(x, 41, 'S');
  for (let x = 26; x <= 29; x++) put(x, 40, 'g');
  put(27, 41, 'g');
  put(28, 41, 'g');
  return grid.map((row) => row.join(''));
})();

export const MANSION_COLORS = {
  c: PALETTE.fog,
  R: PALETTE.smoke,
  r: PALETTE.smokeDeep,
  A: PALETTE.fog, // the renderer swaps this to brass when the attic wakes
  w: PALETTE.plumDeep,
  V: PALETTE.plum,
  t: PALETTE.smoke,
  g: PALETTE.brass,
  G: PALETTE.fog,
  d: PALETTE.umbra,
  k: PALETTE.brass,
  S: PALETTE.smokeDeep,
};

/** The attic window lights for a few seconds at a time. Nobody is up there. */
export function mansionAtticLit(time) {
  return Math.sin(time * 0.43) > 0.82;
}

// Interior furnishings — small sprites, all base-center anchored.

// A grandfather clock (8x18): plum case, brass face, long pendulum slot.
export const CLOCK_SPRITE = [
  'tttttttt',
  'twwwwwwt',
  'twggggwt',
  'twggggwt',
  'twwkkwwt',
  'twwwwwwt',
  'tw.kk.wt',
  'tw.kk.wt',
  'tw..k.wt',
  'tw..k.wt',
  'tw.k..wt',
  'tw.k..wt',
  'tw..k.wt',
  'twwwwwwt',
  'twwwwwwt',
  'tttttttt',
  't......t',
  'tt....tt',
];

// An old portrait (12x13): brass frame, a dark canvas, two moonlit eyes the
// renderer positions itself — they follow whoever is in the room.
export const PORTRAIT_SPRITE = [
  'tttttttttttt',
  'tGGGGGGGGGGt',
  'tGGGGGGGGGGt',
  'tGGwGGGGwGGt',
  'tGGGGGGGGGGt',
  'tGGGGGGGGGGt',
  'tGGGwwwwGGGt',
  'tGGGGGGGGGGt',
  'tGGGGGGGGGGt',
  'tGGGGGGGGGGt',
  'tGGGGGGGGGGt',
  'tttttttttttt',
  '.....tt.....',
];

// A bookshelf (16x13): plum case, spines mostly muted with one ember each —
// a noir library, not a jukebox.
export const SHELF_SPRITE = [
  'tttttttttttttttt',
  'tppvvpptpvvpmppt',
  'tppvvpptpvvpmppt',
  'tttttttttttttttt',
  'tvppvtppvppbppvt',
  'tvppvtppvppbppvt',
  'tttttttttttttttt',
  'tpvpptmppvtppvpt',
  'tpvpptmppvtppvpt',
  'tttttttttttttttt',
  't..............t',
  't..............t',
  'tt............tt',
];

// A long table (18x9) and a chair (7x9) — plum tops with a smoke rim so the
// parlor reads as furnished, not empty.
export const TABLE_SPRITE = [
  'ssssssssssssssssss',
  'spppppppppppppppps',
  'ssssssssssssssssss',
  '.t..............t.',
  '.t..............t.',
  '.t..............t.',
  '.t..............t.',
  '.t..............t.',
  '.tt............tt.',
];
export const CHAIR_SPRITE = [
  'sssss..',
  'sppps..',
  'sppps..',
  'sppsss.',
  'sp...s.',
  'sssssss',
  't.....t',
  't.....t',
  't.....t',
];

// A candelabra (7x12) — the renderer animates its flames.
export const CANDELABRA_SPRITE = [
  '.......',
  'k..k..k',
  'k..k..k',
  'kkkkkkk',
  '...k...',
  '...k...',
  '...k...',
  '..kkk..',
  '...k...',
  '...k...',
  '..kkk..',
  '.kkkkk.',
];

// A chandelier (16x9), hanging over the hall.
export const CHANDELIER_SPRITE = [
  '.......kk.......',
  '.......kk.......',
  '.......kk.......',
  'g......kk......g',
  'kg.....kk.....gk',
  '.kkkkkkkkkkkkkk.',
  '..k....kk....k..',
  '...kkkkkkkkkk...',
  '................',
];

export const FURNISH_COLORS = {
  t: PALETTE.smokeDeep,
  s: PALETTE.smoke,
  w: PALETTE.plumDeep,
  g: PALETTE.brass,
  G: PALETTE.fog,
  k: PALETTE.brass,
  v: PALETTE.violet,
  m: PALETTE.magenta,
  b: PALETTE.blue,
  p: PALETTE.plum,
};

/** Candle/attic flames sway between brass and magenta at a slow flicker. */
export function flameColor(time, phase = 0) {
  return Math.sin(time * 6 + phase) > 0.2 ? PALETTE.brass : PALETTE.magenta;
}
