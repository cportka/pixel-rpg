// Queue Town (v0.21): the dark wizard town on the night plane. Wizards live
// here the way weather lives somewhere — permanently, and in a bad mood
// about it. Towers lean, shop signs hang from brass, and the only two
// residents who will sell you anything are Cortie (weapons) and Queebee
// (scrolls).
//
// House idiom throughout: string maps, one char per pixel, '.' transparent,
// equal-length rows, lit from the top-right moon, every color a PALETTE key.
// The big structures are code-built at module load and fully deterministic —
// texture comes from sin-hash noise, never Math.random. Night-side art; the
// heaven remap happens elsewhere and costs this module nothing.

import { PALETTE } from './palette.js';

// --- Small helpers -----------------------------------------------------------

function makeGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill('.'));
}

function gput(grid, x, y, ch) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = ch;
}

function gridRows(grid) {
  return grid.map((row) => row.join(''));
}

/** Deterministic 0..1 noise from an integer — sin-hash, no Math.random. */
function hash01(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Stamp a small map's non-'.' chars onto a grid at (x0, y0). */
function stamp(grid, x0, y0, map) {
  map.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      if (ch !== '.') gput(grid, x0 + dx, y0 + dy, ch);
    });
  });
}

// --- The wizards (16x28 each) ------------------------------------------------
//
// Three residents, all grumpy, all hunched: pointed hats, long robes, faces
// that are mostly shadow with a pair of lit eyes and a scowl cut into the
// dark. The third one carries a crooked staff and taps it when the mood
// lands, which is often.

// Grump A: plum robe, gold eyes, arms crossed like a closed door.
const WIZARD_A = [
  '.......h........',
  '......hh........',
  '......hhh.......',
  '.....hhhh.......',
  '.....hhhhh......',
  '....hhhhhh......',
  '....hhhhhhh.....',
  '...hhhhhhhh.....',
  '..HHHHHHHHHH....',
  '...ffffffff.....',
  '..feeffffeef....',
  '..ffffffffff....',
  '..fxxffffxxf....',
  '...fxxxxxxf.....',
  '..rrrrrrrrrrr...',
  '.rrrrrrrrrrrrr..',
  '.rrddddddddrrr..',
  '.rrdddddddddrr..',
  '.rrrrddddrrrrr..',
  '.rrrrrrrrrrrrm..',
  '.drrrrrrrrrrrm..',
  '.drrrrrrrrrrrm..',
  '.drrrrrrrrrrm...',
  '.ddrrrrrrrrrm...',
  '.ddrrrrrrrrrm...',
  '.dddrrrrrrrmm...',
  '.dddrrrrrrrrm...',
  '.ddddddddddmm...',
];

// Grump B: purple robe, blue eyes, and the crooked staff — magenta at the
// tip where something arcane never quite went out.
const WIZARD_B = [
  '.....hh.........',
  '.....hhh......S.',
  '....hhhh.....sS.',
  '....hhhhh....s..',
  '...hhhhhh....s..',
  '...hhhhhhh...s..',
  '..hhhhhhhh...s..',
  '.HHHHHHHHHH..s..',
  '...ffffffff..s..',
  '..feeffffeef.s..',
  '..ffffffffff.s..',
  '..fxxxxxxxxf.s..',
  '..rrrrrrrrrr.s..',
  '.rrrrrrrrrrrrs..',
  '.rrdddddddrrfs..',
  '.rrdddddddddrs..',
  '.rrrrddddrrrrs..',
  '.rrrrrrrrrrrrs..',
  '.drrrrrrrrrrrs..',
  '.drrrrrrrrrmms..',
  '.drrrrrrrrrrms..',
  '.drrrrrrrrrrms..',
  '.ddrrrrrrrrrms..',
  '.ddrrrrrrrrmms..',
  '.ddrrrrrrrrrms..',
  '.dddrrrrrrrmms..',
  '.dddrrrrrrrrmss.',
  '.ddddddddddmmss.',
];

// Grump C: smokeDeep robe, magenta eyes, hunched furthest of the three —
// the hat tip gave up on vertical years ago.
const WIZARD_C = [
  '................',
  '....hh..........',
  '...hhhh.........',
  '....hhhh........',
  '.....hhhh.......',
  '.....hhhhh......',
  '....hhhhhhh.....',
  '...hhhhhhhh.....',
  '..HHHHHHHHHH....',
  '...ffffffff.....',
  '..feeffffeef....',
  '..ffffffffff....',
  '..fxxxxxxxxf....',
  '.rrrrrrrrrrrr...',
  '.rrrrrrrrrrrrr..',
  '.rrddddddddrrr..',
  '.rrdddddddddrr..',
  '.rrrrddddrrrrm..',
  '.rrrrrrrrrrrrm..',
  '.drrrrrrrrrrrm..',
  '.drrrrrrrrrrm...',
  '.drrrrrrrrrrm...',
  '.ddrrrrrrrrrm...',
  '.ddrrrrrrrrmm...',
  '.ddrrrrrrrrrm...',
  '.dddrrrrrrrmm...',
  '.dddrrrrrrrrm...',
  '.ddddddddddmm...',
];

export const WIZARD_SPRITES = [
  {
    map: WIZARD_A,
    colors: {
      h: PALETTE.plum, // the hat
      H: PALETTE.plumDeep, // its brim, pulled low
      f: PALETTE.night, // the face keeps to itself
      e: PALETTE.gold, // except the eyes
      x: PALETTE.void, // and the scowl
      r: PALETTE.plum, // the robe
      d: PALETTE.plumDeep, // its shadow side
      m: PALETTE.violet, // the moon finds one edge anyway
    },
  },
  {
    map: WIZARD_B,
    colors: {
      h: PALETTE.purple,
      H: PALETTE.plumDeep,
      f: PALETTE.night,
      e: PALETTE.blue, // cold eyes
      x: PALETTE.void,
      r: PALETTE.purple,
      d: PALETTE.plumDeep,
      m: PALETTE.violet,
      s: PALETTE.clay, // the crooked staff
      S: PALETTE.magenta, // whatever still glows at its tip
    },
  },
  {
    map: WIZARD_C,
    colors: {
      h: PALETTE.smokeDeep,
      H: PALETTE.plumDeep,
      f: PALETTE.night,
      e: PALETTE.magenta, // eyes like the wrong end of a spell
      x: PALETTE.void,
      r: PALETTE.smokeDeep,
      d: PALETTE.plumDeep,
      m: PALETTE.smoke,
    },
  },
];

// The grump clock: moods advance on ~0.4s beats, chunky like everything else.
const GRUMP_TICK = 0.4;

/**
 * A wizard's idle grump. Pure in (time, phase); phase keeps the three from
 * sulking in unison. Returns { frame, dx, dy }:
 *   frame: 'idle' | 'slump' | 'tap'
 *     'idle'  — stand there disapproving (usually with dx = dy = 0);
 *     'slump' — the shoulders give up a pixel: draw the body dy lower;
 *     'tap'   — the staff lifts for a beat (staffless wizards render idle).
 *   dx: head-shake offset in pixels (-1 | 0 | 1) — apply to the head rows
 *       only (rows above the shoulders), the body stays planted;
 *   dy: slump drop in pixels (0 | 1) — apply to the whole figure.
 */
export function wizardGrump(time, phase) {
  const tick = Math.floor(time / GRUMP_TICK) + Math.floor(phase * 71.7);
  const r = hash01(tick * 7 + 5);
  if (r > 0.9) return { frame: 'tap', dx: 0, dy: 0 };
  if (r > 0.78) return { frame: 'slump', dx: 0, dy: 1 };
  if (r > 0.66) return { frame: 'idle', dx: hash01(tick * 11 + 3) > 0.5 ? 1 : -1, dy: 0 };
  return { frame: 'idle', dx: 0, dy: 0 };
}

// --- Cortie, the weapon merchant (18x30) -------------------------------------
//
// Broader than any wizard has a right to be. Leather apron over the robes,
// brass buckles, a sword slung across the back — hilt over one shoulder,
// point minding its own business below the other hip — and gold eyes that
// have already sized up what you can afford.
export const CORTIE_SPRITE = [
  '..P...............',
  '.PPP..hhhhh.......',
  '..g...hhhhhh......',
  '..g..hhhhhhh......',
  '..g..HHHHHHHH.....',
  '..g..ffffffff.....',
  '..g..fyffffyf.....',
  '..gg.ffffffff.....',
  '...g.wwwwwwww.....',
  '.....rrrrrrrrr....',
  '..rrrrrrrrrrrrrr..',
  '.rrrrrrrrrrrrrrr..',
  '.rraaaaaaaaaarrr..',
  '.rraaaaaaaaaarrrm.',
  '.rraabbaaaaaarrrm.',
  '.rraaaaaaaaaarrrm.',
  '.rraaaaaaaaaarrrm.',
  '.rraaaaaaaaaarrrm.',
  '.rraaaaaaaaaarrm..',
  '.rraaaaaaaaaarrm..',
  '.rraabbaaaaaarrm..',
  '.rraaaaaaaaaarrm..',
  '.rraaaaaaaaaarrm..',
  '.rrraaaaaaaarrrm..',
  '.rrrraaaaaarrrrm..',
  '.rrrrrrrrrrrrrm...',
  '.grrrrrrrrrrrrm...',
  '..g.rrr...rrr.....',
  '....BBB...BBB.....',
  '...BBBB...BBBB....',
];

export const CORTIE_COLORS = {
  h: PALETTE.plumDeep, // the hat: shorter, wider, more practical
  H: PALETTE.smokeDeep, // its brim
  f: PALETTE.night, // the face in shadow
  y: PALETTE.gold, // appraising eyes
  w: PALETTE.smoke, // the beard
  r: PALETTE.plumDeep, // the robe underneath
  m: PALETTE.smoke, // the moon on one arm
  a: PALETTE.clay, // the leather apron
  b: PALETTE.brass, // its buckles
  P: PALETTE.brass, // the sword's crossguard over the shoulder
  g: PALETTE.smoke, // grip above, blade sliver below
  B: PALETTE.soil, // boots that have stood at a forge
};

// --- Queebee, the scroll merchant (16x30) ------------------------------------
//
// Tall the way a ladder is tall. Spectacles (two gold pixels, the town's
// entire supply of optimism), a scroll tucked under one arm, and the left
// sleeve ink-stained past apology.
export const QUEEBEE_SPRITE = [
  '.......h........',
  '......hh........',
  '......hhh.......',
  '.....hhhh.......',
  '.....hhhhh......',
  '....hhhhhh......',
  '....hhhhhhh.....',
  '..HHHHHHHHHH....',
  '...ffffffff.....',
  '..fyffffyff.....',
  '...ffffffff.....',
  '...fxxxxxxf.....',
  '...rrrrrrrr.....',
  '..rrrrrrrrrr....',
  '..rrrrrrrrrrm...',
  '.irrrrrrrrrrm...',
  '.irrrrrnnnnnn...',
  '.iirrrrnnnnnn...',
  '.irrrrrrddddd...',
  '.iirrrrrrrrm....',
  '..rrrrrrrrrm....',
  '..drrrrrrrrm....',
  '..drrrrrrrrm....',
  '..drrrrrrrm.....',
  '..ddrrrrrrm.....',
  '..ddrrrrrrm.....',
  '..dddrrrrmm.....',
  '..dddrrrrrm.....',
  '...rrr..rrr.....',
  '...BBB..BBB.....',
];

export const QUEEBEE_COLORS = {
  h: PALETTE.purple, // the hat, taller than necessary
  H: PALETTE.plumDeep, // the brim
  f: PALETTE.night, // the face
  y: PALETTE.gold, // the spectacles: two gold pixels
  x: PALETTE.void, // a thin, editorial mouth
  r: PALETTE.purple, // the robe
  d: PALETTE.plumDeep, // its shadow side
  m: PALETTE.violet, // the moonlit edge
  n: PALETTE.moonlight, // the scroll under one arm
  i: PALETTE.bloodDeep, // the ink-stained sleeve
  B: PALETTE.soil, // thin boots
};

// --- The wizard tower (90x200, ~6 person-heights) ----------------------------
//
// Stone all the way up, until it decides to be a conical roof that never
// learned plumb. Arcane windows glow violet-on-magenta at whatever heights
// suited the builder that day, and a faint orchid rune band circles the
// waist. Code-built; the crook is geometry, not chance.

export const TOWER_SPRITE = (() => {
  const W = 90;
  const H = 200;
  const g = makeGrid(W, H);
  // The roof cone, y 0..64: the centerline drifts — that's the crook.
  const roofH = 64;
  for (let y = 0; y <= roofH; y++) {
    const t = y / roofH;
    const cx = Math.round(52 + (45 - 52) * t + 3 * Math.sin(t * 3.1));
    const half = Math.round(2 + t * 40);
    for (let x = cx - half; x <= cx + half; x++) {
      let ch = x > cx + Math.round(half * 0.35) ? 'Q' : 'q';
      if (y % 5 === 4) ch = 'q';
      if (x <= cx - half + 1 || x >= cx + half - 1 || y >= roofH - 1) ch = 'R';
      if (x >= cx + half - 1 && y % 3 === 1) ch = 'G';
      gput(g, x, y, ch);
    }
  }
  // The finial: one magenta point above the tip, off-axis like the rest.
  gput(g, 52, 0, 'A');
  // The body, y 65..199: a stone taper widening toward the ground.
  for (let y = 65; y < H; y++) {
    const half = Math.round(24 + ((y - 65) / 134) * 12);
    for (let x = 45 - half; x <= 45 + half; x++) {
      let ch = x >= 45 + half - 8 ? 'v' : 'w';
      if (hash01(x * 13 + y * 29) > 0.94) ch = 'z';
      if (x <= 45 - half + 2) ch = 'D';
      if (x === 45 + half) ch = 'm';
      gput(g, x, y, ch);
    }
  }
  // The eave shadow where the cone overhangs the stone.
  for (let x = 19; x <= 71; x++) {
    gput(g, x, 65, 'D');
    gput(g, x, 66, 'D');
  }
  // Arcane windows at irregular heights: arched, violet, magenta at heart.
  const windows = [
    { wx: 30, wy: 76 },
    { wx: 56, wy: 92 },
    { wx: 38, wy: 112 },
    { wx: 24, wy: 140 },
    { wx: 54, wy: 156 },
  ];
  for (const { wx, wy } of windows) {
    for (let dy = 0; dy < 12; dy++) {
      const inset = dy === 0 ? 2 : dy === 1 ? 1 : 0;
      for (let dx = inset; dx < 7 - inset; dx++) {
        const core = dx >= 2 && dx <= 4 && dy >= 4 && dy <= 8;
        gput(g, wx + dx, wy + dy, core ? 'A' : 'V');
      }
      gput(g, wx + inset - 1, wy + dy, 'f');
      gput(g, wx + 7 - inset, wy + dy, 'f');
    }
    for (let dx = 0; dx < 7; dx++) gput(g, wx + dx, wy + 12, 'f');
  }
  // The rune band: a faint orchid script circling the waist. Strokes land
  // only on stone — the script does not float off the wall.
  const runePut = (x, y) => {
    if (g[y][x] !== '.') gput(g, x, y, 'O');
  };
  for (let x = 14; x <= 76; x++) {
    if (hash01(x * 7 + 11) > 0.55) {
      runePut(x, 128 + ((x * 5) % 4));
      if (hash01(x * 17 + 3) > 0.8) runePut(x, 127);
    }
  }
  // The base flare, settling into the ground.
  for (let y = 192; y < H; y++) {
    const half = 36 + Math.floor((y - 192) / 4);
    for (let x = 45 - half; x <= 45 + half; x++) {
      if (g[y][x] === '.') gput(g, x, y, x > 45 ? 'v' : 'D');
    }
  }
  return gridRows(g);
})();

export const TOWER_COLORS = {
  q: PALETTE.plumDeep, // the cone's dark pitch and course lines
  Q: PALETTE.plum, // the pitch the moon reaches
  R: PALETTE.smokeDeep, // edges and eaves
  G: PALETTE.goldRose, // rim glints along the moonlit edge
  A: PALETTE.magenta, // the finial, and every window's heart
  w: PALETTE.dusk, // tower stone
  v: PALETTE.plum, // stone on the moonlit flank
  z: PALETTE.fog, // the odd stone gone dark
  D: PALETTE.soil, // the shadow flank and the eave shadow
  m: PALETTE.smokeDeep, // the rim the moon draws down the right edge
  V: PALETTE.violet, // arcane glass
  f: PALETTE.void, // window reveals
  O: PALETTE.orchid, // the rune band, faint
};

// --- The two shops (120x85 each) ---------------------------------------------
//
// Same timber-framed carcass, different souls: Cortie's hangs a sword over
// the door and racks blades in a dim amber window; Queebee's hangs a scroll
// and stacks books against warm candlelight.

function buildShop({ winX0, winX1, doorX0, signX0 }) {
  const W = 120;
  const H = 85;
  const g = makeGrid(W, H);
  // The roof: deep-eaved pitch, moonlit right edge.
  const roofTop = 4;
  const eaves = 30;
  for (let y = roofTop; y <= eaves; y++) {
    const t = (y - roofTop) / (eaves - roofTop);
    const half = Math.round(18 + t * 41);
    const xL = 60 - half;
    const xR = 59 + half;
    for (let x = xL; x <= xR; x++) {
      let ch = 'R';
      if ((y - roofTop) % 4 === 3) ch = 'r';
      if (x < 30 && (x + y) % 2 === 0) ch = 'r';
      if (x <= xL + 1) ch = 'r';
      if (x >= xR - 1) ch = y % 2 === 0 ? 'G' : 'R';
      gput(g, x, y, ch);
    }
  }
  // Eave shadow, then the timber-framed wall: plum plaster, soil posts.
  for (let y = 31; y <= 32; y++) for (let x = 8; x <= 111; x++) gput(g, x, y, 'u');
  for (let y = 33; y <= 82; y++) {
    for (let x = 8; x <= 111; x++) {
      let ch = x >= 94 ? 'v' : 'F';
      if (x <= 9 || x >= 110 || (x - 8) % 17 === 0) ch = 't';
      if (y === 48 || y === 49) ch = 't';
      gput(g, x, y, ch);
    }
  }
  for (let y = 83; y <= 84; y++) for (let x = 6; x <= 113; x++) gput(g, x, y, 'q');
  // The display window: clay-framed, content stamped by the caller.
  for (let y = 42; y <= 72; y++) {
    for (let x = winX0; x <= winX1; x++) {
      const frame = x <= winX0 + 1 || x >= winX1 - 1 || y <= 43 || y >= 71;
      gput(g, x, y, frame ? 'T' : 'W');
    }
  }
  for (let x = winX0 - 1; x <= winX1 + 1; x++) gput(g, x, 73, 'T');
  // The door: framed, void, a step below.
  for (let x = doorX0 - 2; x <= doorX0 + 15; x++) {
    gput(g, x, 50, 'T');
    gput(g, x, 51, 'T');
  }
  for (let y = 50; y <= 82; y++) {
    gput(g, doorX0 - 2, y, 'T');
    gput(g, doorX0 - 1, y, 'T');
    gput(g, doorX0 + 14, y, 'T');
    gput(g, doorX0 + 15, y, 'T');
  }
  for (let y = 52; y <= 82; y++) {
    for (let x = doorX0; x <= doorX0 + 13; x++) gput(g, x, y, 'D');
  }
  for (let x = doorX0 - 4; x <= doorX0 + 17; x++) {
    gput(g, x, 83, 'p');
    gput(g, x, 84, 'p');
  }
  // The sign bracket: brass arm, fog chains; the shape hangs from the caller.
  for (let x = signX0; x <= signX0 + 12; x++) gput(g, x, 35, 'k');
  gput(g, signX0 + 3, 36, 'c');
  gput(g, signX0 + 3, 37, 'c');
  gput(g, signX0 + 9, 36, 'c');
  gput(g, signX0 + 9, 37, 'c');
  return g;
}

// Cortie's hanging sign: a sword, point down, honest advertising. The two
// outer rails take the chains.
const SIGN_SWORD = [
  '..k.....k',
  '..k.HH..k',
  '..k.HH..k',
  'kkkkkkkkk',
  '....SS...',
  '....SS...',
  '....SS...',
  '....SS...',
  '....SS...',
  '....SS...',
  '.....S...',
];

// Queebee's hanging sign: a scroll, half unrolled, violet ribbon.
const SIGN_SCROLL = [
  'nn.....nn',
  'nNNNNNNNn',
  '.NNNNNNN.',
  '.NNNNNNN.',
  '.NNVVNNN.',
  '.NNNNNNN.',
  'nNNNNNNNn',
  'nn.....nn',
];

// A blade silhouette for the weapon rack in Cortie's window (dark on amber).
const RACK_BLADE = [
  '.X.',
  '.X.',
  'XXX',
  '.X.',
  '.X.',
  '.X.',
  '.X.',
  '.X.',
];

const SHOP_CORTIE_MAP = (() => {
  const g = buildShop({ winX0: 20, winX1: 63, doorX0: 84, signX0: 78 });
  // The rack in the window: four blades on a rail, dark against the amber.
  for (let x = 26; x <= 57; x++) gput(g, x, 52, 'X');
  for (const bx of [27, 35, 43, 51]) stamp(g, bx, 46, RACK_BLADE);
  stamp(g, 79, 38, SIGN_SWORD);
  return gridRows(g);
})();

const SHOP_CORTIE_COLORS = {
  R: PALETTE.smoke, // lit shingles
  r: PALETTE.smokeDeep, // the dark of the pitch
  G: PALETTE.goldRose, // the moonlit roof edge
  u: PALETTE.fog, // eave shadow
  F: PALETTE.plumDeep, // plaster
  v: PALETTE.plum, // plaster on the moonlit flank
  t: PALETTE.soil, // the timber frame
  q: PALETTE.soil, // foundation
  T: PALETTE.clay, // window and door casings
  W: PALETTE.amber, // forge-dim light in the glass
  X: PALETTE.night, // the rack and its blades, silhouetted
  D: PALETTE.void, // the door stands open
  p: PALETTE.clay, // the step
  k: PALETTE.brass, // the bracket, and the sign's crossguard
  c: PALETTE.fog, // chains
  H: PALETTE.clay, // the sign-sword's grip
  S: PALETTE.smoke, // its blade
};

const SHOP_QUEEBEE_MAP = (() => {
  const g = buildShop({ winX0: 56, winX1: 99, doorX0: 22, signX0: 29 });
  // Stacked books silhouetted against candlelight, and the candle itself.
  for (const [sx, sh] of [[60, 5], [66, 8], [72, 4], [78, 7], [86, 6]]) {
    for (let dy = 0; dy < sh; dy++) {
      for (let dx = 0; dx < 5; dx++) gput(g, sx + dx, 70 - dy, 'X');
    }
  }
  gput(g, 93, 66, 'X');
  gput(g, 94, 66, 'X');
  for (let y = 67; y <= 70; y++) {
    gput(g, 93, y, 'X');
    gput(g, 94, y, 'X');
  }
  gput(g, 93, 64, 'A');
  gput(g, 94, 65, 'A');
  stamp(g, 31, 38, SIGN_SCROLL);
  return gridRows(g);
})();

const SHOP_QUEEBEE_COLORS = {
  R: PALETTE.smoke,
  r: PALETTE.smokeDeep,
  G: PALETTE.goldRose,
  u: PALETTE.fog,
  F: PALETTE.plumDeep,
  v: PALETTE.plum,
  t: PALETTE.soil,
  q: PALETTE.soil,
  T: PALETTE.clay,
  W: PALETTE.gold, // candlelit, warmer than Cortie's
  X: PALETTE.night, // book stacks, and the candle's own silhouette
  A: PALETTE.goldRose, // the flame
  D: PALETTE.void,
  p: PALETTE.clay,
  k: PALETTE.brass,
  c: PALETTE.fog,
  N: PALETTE.moonlight, // the sign-scroll's paper
  n: PALETTE.moonshadow, // its rolled ends
  V: PALETTE.violet, // the ribbon
};

// The shops ship as { map, colors, door } — door is { dx, w }: the offset of
// the doorway's center from the sprite's bottom-center, and its width.
export const SHOP_CORTIE_SPRITE = {
  map: SHOP_CORTIE_MAP,
  colors: SHOP_CORTIE_COLORS,
  door: { dx: 31, w: 14 }, // doorway x 84..97 → center 90.5, east of center (60)
};

export const SHOP_QUEEBEE_SPRITE = {
  map: SHOP_QUEEBEE_MAP,
  colors: SHOP_QUEEBEE_COLORS,
  door: { dx: -31, w: 14 }, // doorway x 22..35 → center 28.5, west of center (60)
};

// --- The town sign (20x26) ---------------------------------------------------
//
// 'QUEUE TOWN', says the board, to anyone who can still read weathered soil
// on loam by moonlight. Nobody can. The glyph in the corner glows anyway —
// arcane script doesn't weather, it waits.
export const QTOWN_SIGN_SPRITE = [
  '..........mmmm......',
  '.....mmmmmBBBBb.....',
  '.mmmmBBBBBBBBBb.....',
  '.BBBBBxBBxBBxBb.....',
  '.BxxBBxBxBBBxBb.....',
  '.BBBBBBBBxBBBBb.....',
  '.BxBxBBxBBBxgGb.....',
  '.BBBBBBBBBBBGgb.....',
  '.bBBBBBBBBBBBb......',
  '..bbbbBBBbbbb.......',
  '........Pp..........',
  '........Pp..........',
  '........Pp..........',
  '.......Pp...........',
  '.......Pp...........',
  '.......Pp...........',
  '......Pp............',
  '......Pp............',
  '......Pp............',
  '......Pp............',
  '......Pp............',
  '.....pPp............',
  '.....pPpp...........',
  '....ppPpp...........',
  '....ppppp...........',
  '....ppppp...........',
];

export const QTOWN_SIGN_COLORS = {
  B: PALETTE.loam, // the board face
  b: PALETTE.clay, // its underside and edges
  m: PALETTE.smoke, // the moon along the top edge
  x: PALETTE.soil, // what's left of QUEUE TOWN
  g: PALETTE.violet, // the arcane glyph, glowing
  G: PALETTE.magenta, // its hot center
  P: PALETTE.clay, // the post
  p: PALETTE.soil, // the post's dark side
};

// --- Shop interiors ----------------------------------------------------------
//
// Furnishings for both shops, same idiom as the mansion and cabin interiors:
// small base-center-anchored maps, clay-and-soil casework, gold for anything
// lit, violet/magenta for anything that hums.

export const SHOP_FURNISH = {
  // The counter (28x14): loam top, plum front panels, brass corner studs.
  counter: {
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'tttttttttttttttttttttttttttt',
      'cppppppppppppppppppppppppppc',
      'cpbbpppppppppppppppppppbbppc',
      'cppppppppppppppppppppppppppc',
      'cppppppppppppppppppppppppppc',
      'cppppppppppppppppppppppppppc',
      'cpbbpppppppppppppppppppbbppc',
      'cppppppppppppppppppppppppppc',
      'cppppppppppppppppppppppppppc',
      'cccccccccccccccccccccccccccc',
      'ssssssssssssssssssssssssssss',
      'ss........................ss',
      'ss........................ss',
    ],
    colors: {
      T: PALETTE.loam, // the top the moon (or a candle) finds
      t: PALETTE.clay, // its front edge
      p: PALETTE.plum, // panels
      b: PALETTE.brass, // corner studs
      c: PALETTE.soil, // stiles and rails
      s: PALETTE.soil, // plinth and feet
    },
  },
  // The weapon rack (24x18): three swords hung, two wands below — steel for
  // the arm, violet and magenta for the other kind of argument.
  weaponrack: {
    map: [
      'ffffffffffffffffffffffff',
      'fPPPPPPPPPPPPPPPPPPPPPPf',
      'fP..hh....hh....hh....Pf',
      'fP..hh....hh....hh....Pf',
      'fP.bbbb..bbbb..bbbb...Pf',
      'fP..SS....SS....SS....Pf',
      'fP..SS....SS....SS....Pf',
      'fP..SS....SS....SS....Pf',
      'fP..SS....SS....SS....Pf',
      'fP..SS....SS....SS....Pf',
      'fP...S.....S.....S....Pf',
      'fPPPPPPPPPPPPPPPPPPPPPPf',
      'fP..V......M......V...Pf',
      'fP..ww....ww......ww..Pf',
      'fP..ww....ww......ww..Pf',
      'fP..ww....ww......ww..Pf',
      'fPPPPPPPPPPPPPPPPPPPPPPf',
      'ffffffffffffffffffffffff',
    ],
    colors: {
      f: PALETTE.clay, // the frame
      P: PALETTE.plumDeep, // the back panel
      h: PALETTE.clay, // grips
      b: PALETTE.brass, // crossguards
      S: PALETTE.smoke, // blades
      w: PALETTE.clay, // wand shafts
      V: PALETTE.violet, // two wands' tips
      M: PALETTE.magenta, // the third's
    },
  },
  // The wand case (18x12): glass over velvet, three wands, two glints.
  wandcase: {
    map: [
      'ffffffffffffffffff',
      'fGGGGGGGGGGGGGGGgf',
      'fGVwwwwGGGGGGGgGGf',
      'fGGGGGGGGGGGgGGGGf',
      'fGGwwwwMGGgGGGGGGf',
      'fGGGGGGGgGGGGGGGGf',
      'fGBwwwwGGGGGGGGGGf',
      'fGGGGGGGGGGGGGGGGf',
      'ffffffffffffffffff',
      'ssssssssssssssssss',
      'ss..............ss',
      'ss..............ss',
    ],
    colors: {
      f: PALETTE.clay, // the case
      G: PALETTE.night, // the glass, dark
      g: PALETTE.moonlight, // the glints across it
      w: PALETTE.clay, // the wands on velvet
      V: PALETTE.violet, // tips again: violet,
      M: PALETTE.magenta, // magenta,
      B: PALETTE.blue, // and one cold blue
      s: PALETTE.soil, // the stand
    },
  },
  // The bookshelf (22x20): spines in every purple the town owns.
  bookshelf: {
    map: [
      'tttttttttttttttttttttt',
      'tpvopmpvvpotpvpombpvpt',
      'tpvopmpvvpotpvpombpvpt',
      'tpvopmpvvpotpvpombpvpt',
      'tttttttttttttttttttttt',
      'tvpmpotpvpvpmpotvpvpbt',
      'tvpmpotpvpvpmpotvpvpbt',
      'tvpmpotpvpvpmpotvpvpbt',
      'tttttttttttttttttttttt',
      'tpopvmpvptpvopvpmpvvpt',
      'tpopvmpvptpvopvpmpvvpt',
      'tpopvmpvptpvopvpmpvvpt',
      'tttttttttttttttttttttt',
      'tvvpopmpptpvpvpopvmppt',
      'tvvpopmpptpvpvpopvmppt',
      'tvvpopmpptpvpvpopvmppt',
      'tttttttttttttttttttttt',
      't....................t',
      'tt..................tt',
      'tt..................tt',
    ],
    colors: {
      t: PALETTE.smokeDeep, // the case
      p: PALETTE.plum, // most spines
      v: PALETTE.violet, // the louder ones
      m: PALETTE.magenta, // the ones that hum
      o: PALETTE.orchid, // the pale ones
      b: PALETTE.blue, // and two cold ones
    },
  },
  // The scroll rack (20x16): pigeonholes, most of them full, the empty two
  // exactly where a customer's hand would go first.
  scrollrack: {
    map: [
      'ffffffffffffffffffff',
      'fdnnndfdnnndfdnnndff',
      'fdnnndfdnnndfdnnndff',
      'fdnnndfdnnndfdnnndff',
      'ffffffffffffffffffff',
      'fooooofdnnndfdnnndff',
      'fooooofdnnndfdnnndff',
      'fooooofdnnndfdnnndff',
      'ffffffffffffffffffff',
      'fdnnndfooooofdnnndff',
      'fdnnndfooooofdnnndff',
      'fdnnndfooooofdnnndff',
      'ffffffffffffffffffff',
      'f..................f',
      'ff................ff',
      'ff................ff',
    ],
    colors: {
      f: PALETTE.clay, // the rack
      d: PALETTE.smokeDeep, // hole shadow
      n: PALETTE.moonlight, // rolled scroll ends
      o: PALETTE.void, // the empty holes
    },
  },
  // The ink desk (24x14): candle, quill, and a page that was going well
  // until the third line.
  inkdesk: {
    map: [
      '............kk..........',
      '............KK..........',
      '............KK..........',
      '.....q......KK..........',
      '......q.nnnnKKn..iP.....',
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'tttttttttttttttttttttttt',
      '.ll.tttttttttttttttt.ll.',
      '.ll.ttttbttttttbtttt.ll.',
      '.ll.tttttttttttttttt.ll.',
      '.ll.tttttttttttttttt.ll.',
      '.ll..................ll.',
      '.ll..................ll.',
      'lll..................lll',
    ],
    colors: {
      k: PALETTE.goldRose, // the flame's heart
      K: PALETTE.gold, // the candle
      q: PALETTE.moonshadow, // the quill, leaning
      n: PALETTE.moonlight, // the page
      i: PALETTE.bloodDeep, // the ink that missed it
      P: PALETTE.plumDeep, // the ink pot
      T: PALETTE.loam, // the desktop
      t: PALETTE.clay, // front and drawers
      b: PALETTE.brass, // drawer pulls
      l: PALETTE.soil, // legs
    },
  },
};
