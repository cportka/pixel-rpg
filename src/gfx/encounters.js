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

// --- Heaven (v0.17) ---------------------------------------------------------

// The angel (16 wide x 26 tall): what a zombie is on the other side of the
// television — a dark-robed figure with gold wings and a halo, rose-lit eyes,
// hem drifting. Base-center anchored, like the zombie it replaces.
// 'H' halo, 'R' robe, 'i' inner robe shadow, 'e' the rose eyes,
// 'w' wing, 'W' the lit wing tips.
export const ANGEL_SPRITE = [
  '......HHHH......',
  '.....H....H.....',
  '......RRRR......',
  '.....RRRRRR.....',
  '.....ReRReR.....',
  '.....RRRRRR.....',
  'w....RRRRRR....w',
  'ww..RRRRRRRR..ww',
  'www.RRRRRRRR.www',
  'wwwwRRiRRiRRwwww',
  'WwwwRRiRRiRRwwwW',
  'WwwwRRiRRiRRwwwW',
  '.WwwRRRRRRRRwwW.',
  '..WwRRRRRRRRwW..',
  '...wRRRRRRRRw...',
  '....RRRRRRRR....',
  '....RRRRRRRR....',
  '....RRRRRRRR....',
  '....RRRRRRRR....',
  '...RRRRRRRRR....',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '.RRRRRRRRRRRRR..',
  '.RRRRRRRRRRRRRR.',
  '.RR.RRRRRRRR.RR.',
];

export const ANGEL_COLORS = {
  // These read through the heaven remap onto cream ground, so the metals
  // are the DEEP end of the gold ramp — pale gold vanishes up there.
  H: PALETTE.amber,
  R: PALETTE.smokeDeep,
  i: PALETTE.moonshadow,
  e: PALETTE.magenta,
  w: PALETTE.amber,
  W: PALETTE.brass,
};

/** The angel's hover: a slow one-pixel float, nothing lurching about it. */
export function angelBob(time, phase) {
  return Math.sin(time * 1.3 + phase) > 0 ? -1 : 0;
}

// The cathedral of melted gold: what a burning dumpster is in heaven.
// Code-built like the mansion, and at the mansion's scale — 64 wide x 48
// tall — because the temple is the landmark of the higher plane: a central
// spire over a rose window and an open door pouring light, flanked by two
// capped towers, the west flank in amber shadow and the east catching gold.
// 'A' amber shadow side, 'B' brass, 'G' gold, 'g' golden-rose rims,
// 'M' the magenta rose window, 'D' the glowing door and window slits.
export const CATHEDRAL_SPRITE = (() => {
  const W = 64;
  const H = 48;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (x, y, ch) => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch;
  };
  // The central spire: a needle widening into the tower, rose-gold at the tip.
  for (let y = 0; y <= 14; y++) {
    const half = Math.max(1, Math.round((y * 7) / 14));
    for (let x = 32 - half; x <= 31 + half; x++) {
      const edge = x >= 31 + half - 1;
      put(x, y, y < 3 ? 'g' : edge ? 'g' : x < 30 ? 'A' : 'G');
    }
  }
  // The central tower, spire to ground.
  for (let y = 15; y < H; y++) {
    for (let x = 24; x <= 39; x++) {
      put(x, y, x < 27 ? 'A' : x > 37 ? 'g' : 'G');
    }
  }
  // The rose window: a magenta bloom with a golden heart.
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= 18) put(32 + dx, 22 + dy, d2 <= 2 ? 'g' : 'M');
    }
  }
  // The great door, arched, standing open with light pouring out.
  for (let y = 36; y < H; y++) {
    for (let x = 28; x <= 35; x++) put(x, y, 'D');
  }
  put(28, 35, 'D');
  put(35, 35, 'D');
  for (let x = 29; x <= 34; x++) put(x, 34, 'D');
  // Side towers with pyramidal caps and little gold finials.
  for (const [x0, lit] of [[6, false], [46, true]]) {
    put(x0 + 5, 4, 'g');
    put(x0 + 6, 4, 'g');
    for (let y = 5; y <= 11; y++) {
      const half = Math.round(((y - 4) * 6) / 7);
      for (let x = x0 + 6 - half; x <= x0 + 5 + half; x++) {
        put(x, y, x >= x0 + 5 + half - 1 ? 'g' : lit ? 'G' : 'B');
      }
    }
    for (let y = 12; y < H; y++) {
      for (let x = x0; x <= x0 + 11; x++) {
        put(x, y, x < x0 + 3 ? 'A' : x > x0 + 9 ? (lit ? 'g' : 'B') : lit ? 'G' : 'B');
      }
    }
    // Arched window slits, two floors of them, glowing.
    for (const wy of [17, 30]) {
      for (let y = wy; y <= wy + 6; y++) {
        for (let x = x0 + 5; x <= x0 + 7; x++) put(x, y, 'D');
      }
      put(x0 + 6, wy - 1, 'D');
    }
  }
  // The nave walls tying the towers to the crossing, with a roofline course.
  for (let y = 24; y < H; y++) {
    for (let x = 18; x <= 23; x++) put(x, y, y === 24 ? 'g' : 'B');
    for (let x = 40; x <= 45; x++) put(x, y, y === 24 ? 'g' : 'G');
  }
  // Buttresses stepping out at the feet of the outer walls.
  for (let y = 38; y < H; y++) {
    put(4, y, 'A');
    put(5, y, 'A');
    put(58, y, 'g');
    put(59, y, 'G');
  }
  return grid.map((row) => row.join(''));
})();

export const CATHEDRAL_COLORS = {
  A: PALETTE.amber,
  B: PALETTE.brass,
  G: PALETTE.gold,
  g: PALETTE.goldRose,
  M: PALETTE.magenta,
  D: PALETTE.goldRose,
};

/**
 * The pile of god, melted in: every donation raises the central spire by a
 * course of gold. Offsets relative to the cathedral's base center; the spire
 * tip starts 28 rows up. Capped so the temple outgrows nobody's screen.
 */
export function templeGrowthPixels(goldGiven) {
  const pixels = [];
  const courses = Math.min(8, goldGiven);
  for (let i = 0; i < courses; i++) {
    const y = -48 - i; // the spire tip sits 48 rows up
    pixels.push({ x: -1, y, c: i === courses - 1 ? PALETTE.goldRose : PALETTE.gold });
    pixels.push({ x: 0, y, c: PALETTE.gold });
  }
  return pixels;
}

/**
 * Raga shimmer: slow notes of light rising off the cathedral roof — the
 * endless music, made visible. Deterministic per time.
 */
export function ragaPixels(time) {
  const pixels = [];
  for (let n = 0; n < 5; n++) {
    const t = time * 0.6 + n * 1.7;
    const rise = (t % 3) / 3; // 0 at the roof, 1 fully risen
    if (rise > 0.9) continue;
    const x = Math.round(-20 + n * 10 + Math.sin(t * 2.1) * 2);
    const y = Math.round(-40 - rise * 16);
    pixels.push({ x, y, c: rise < 0.5 ? PALETTE.goldRose : PALETTE.hotRose });
  }
  return pixels;
}
