// Town art (v0.20): the NIGHT side grows a ghost town — a main street of
// boarded ruins, the ghosts that never left it, Pirts the merchant ghost
// (the one warm thing on the street), a detective who followed a case out
// here and never followed it back, and the furniture for two interiors:
// a one-room cabin and a bail-bonds office.
//
// The ghosts don't float so much as BUFFER: ghostMosh() tears them into
// displaced row-bands and drops the signal entirely for beats, the way a
// bad stream dies mid-frame. Deterministic, ticked at ~0.15s so the tearing
// reads as digital at 15fps. Everything else is the house idiom — string
// maps, one char per pixel, '.' transparent, lit from the top-right,
// every color a PALETTE key.

import { PALETTE } from './palette.js';

// --- Ghosts -----------------------------------------------------------------
//
// Three residents. Bodies are smoke over smokeDeep — translucent by palette,
// not by alpha — with a moonshadow rim where the moon still bothers to find
// them, and one pair of lit eyes each. Hems taper ragged: nobody down here
// gets a clean edge.

// The wisp (14x18): small, quick-looking even standing still.
const GHOST_WISP = [
  '.....ssss.....',
  '...dssssssm...',
  '..dsssssssmm..',
  '..dsesssesmm..',
  '..dsssssssmm..',
  '.ddssssssssm..',
  '.dsssssssssm..',
  '.dsssssssssmm.',
  '.dsssssssssmm.',
  '.ddssssssssm..',
  '..dsssssssm...',
  '..dssssssss...',
  '..dsss.ssss...',
  '..dss..sss....',
  '..ds...ss..s..',
  '..d.....s..s..',
  '..s.....s.....',
  '........s.....',
];

// The tall one (12x22): a column of smoke that remembers being a person.
const GHOST_TALL = [
  '....ssss....',
  '...dssssm...',
  '..dssssssm..',
  '..dsessesm..',
  '..dssssssm..',
  '..dssssssm..',
  '.ddssssssm..',
  '.dsssssssm..',
  '.dsssssssmm.',
  '.dsssssssmm.',
  '.dsssssssm..',
  '.dsssssssm..',
  '.ddssssssm..',
  '..dsssssm...',
  '..dsssssm...',
  '..dssssss...',
  '..dss.sss...',
  '..ds..sss...',
  '..ds...ss...',
  '..s.....s...',
  '.......ss...',
  '..s.........',
];

// The stout one (16x16): broad, settled, going nowhere slowly.
const GHOST_STOUT = [
  '.....ssssss.....',
  '...dssssssssm...',
  '..dssssssssssm..',
  '..dssesssessm...',
  '.ddssssssssssm..',
  '.dssssssssssssm.',
  '.dssssssssssssm.',
  '.dsssssssssssmm.',
  '.dsssssssssssmm.',
  '.dssssssssssssm.',
  '.ddssssssssssm..',
  '..dssssssssssm..',
  '..dsss.ssss.ss..',
  '..dss..sss...s..',
  '..ds....ss...s..',
  '..s......s......',
];

export const GHOST_SPRITES = [
  {
    map: GHOST_WISP,
    colors: {
      s: PALETTE.smoke,
      d: PALETTE.smokeDeep,
      m: PALETTE.moonshadow,
      e: PALETTE.magenta,
    },
  },
  {
    map: GHOST_TALL,
    colors: {
      s: PALETTE.smoke,
      d: PALETTE.smokeDeep,
      m: PALETTE.moonshadow,
      e: PALETTE.blue,
    },
  },
  {
    map: GHOST_STOUT,
    colors: {
      s: PALETTE.smoke,
      d: PALETTE.smokeDeep,
      m: PALETTE.moonshadow,
      e: PALETTE.magenta,
    },
  },
];

// The datamosh clock: state advances on ~0.15s ticks so the tearing steps
// like a dropped frame instead of sliding like cloth.
const MOSH_TICK = 0.15;

/** Deterministic 0..1 noise from an integer — sin-hash, no Math.random. */
function hash01(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The ghosts' datamosh. Returns { visible, bands }: when visible is false
 * the ghost drops out entirely for that beat (the stream died); bands are
 * 1-3 horizontal row-band displacements { y0, y1, dx } (rows y0..y1-1 shift
 * dx pixels, dx in -3..3) — digital tearing, not drift. Pure in (time,
 * phase); phase keeps the residents from glitching in unison.
 */
export function ghostMosh(time, phase) {
  const tick = Math.floor(time / MOSH_TICK) + Math.floor(phase * 97.7);
  const visible = hash01(tick * 3 + 1) > 0.12; // now and then: nobody there
  const bands = [];
  const n = 1 + Math.floor(hash01(tick * 5 + 2) * 3);
  for (let i = 0; i < n; i++) {
    const y0 = Math.floor(hash01(tick * 7 + i * 13 + 3) * 18);
    const h = 2 + Math.floor(hash01(tick * 11 + i * 17 + 4) * 4);
    const dx = Math.round(hash01(tick * 13 + i * 19 + 5) * 6) - 3;
    bands.push({ y0, y1: y0 + h, dx });
  }
  return { visible, bands };
}

/**
 * A ghost's momentary tint flicker: the whole figure recolors for a tick,
 * chroma ghosting off a dying channel. Mostly smoke; sometimes the blue of
 * static, rarely the magenta of something still alive in there. Pure in
 * (time, phase).
 */
export function moshTint(time, phase) {
  const tick = Math.floor(time / MOSH_TICK) + Math.floor(phase * 31.3);
  const r = hash01(tick * 17 + 9);
  if (r > 0.94) return PALETTE.magenta;
  if (r > 0.88) return PALETTE.blue;
  if (r > 0.8) return PALETTE.moonshadow;
  return PALETTE.smoke;
}

// --- Pirts, the merchant ghost (16x20) --------------------------------------
//
// Dead, sure, but open for business. Wide-brim hat with a brass band, a
// satchel that still smells of clay and coin, one hand up mid-wave, and
// gold where his eyes were. He reads WARM against the other residents —
// commerce survives everything.
export const PIRTS_SPRITE = [
  '.mm.............',
  '.mm...HHHH......',
  '.mm..HHHHHH.....',
  '..m..BBBBBB.....',
  '..s.HHHHHHHHHH..',
  '..s..ssssss.....',
  '..ss.sessse.....',
  '..ssssssssss....',
  '...dssssssssm...',
  '...dssssssssmc..',
  '..dssssssssmc...',
  '..dsssssssscaa..',
  '..dssssssssaaag.',
  '..dsssssssscaa..',
  '..dssssssssm....',
  '..dsss.ssssm....',
  '..dss..sssm.....',
  '..ds....ss...s..',
  '..s......s...s..',
  '.........s......',
];

export const PIRTS_COLORS = {
  H: PALETTE.clay, // the hat: felt that was somebody's once
  B: PALETTE.brass, // the band: still jaunty about it
  s: PALETTE.smoke,
  d: PALETTE.smokeDeep,
  m: PALETTE.moonshadow,
  e: PALETTE.gold, // eyes that light up at the sight of a customer
  c: PALETTE.clay, // satchel strap and flap
  a: PALETTE.amber, // the satchel body
  g: PALETTE.gold, // the coin glint at the satchel's mouth
};

// --- The detective (14x26) --------------------------------------------------
//
// Human, which out here is the strange part. Trench coat in clay and loam
// with the moon on its amber flank, a belted middle, a hat pulled low, and
// a cigarette whose hotRose ember is the only thing about him still burning.
// The posture is the case: head hung forward, shoulders down.
export const DETECTIVE_SPRITE = [
  '....hhhh......',
  '...hhhhhh.....',
  '...bbbbbb.....',
  '..hhhhhhhhh...',
  '....ffff......',
  '....ffff......',
  '..Ewwfff......',
  '.....fff......',
  '...cllllaa....',
  '..clllllllaa..',
  '..clllllllaa..',
  '..cllllllla...',
  '..cllllllla...',
  '..cllllllla...',
  '..cllllllla...',
  '..cbbbbbbba...',
  '..cllllllla...',
  '..cllllllla...',
  '..clllllllaa..',
  '..clllllllaa..',
  '..cllllllllaa.',
  '..cllllllllaa.',
  '..cll.llll.a..',
  '..ccc..ccc....',
  '..ccc..ccc....',
  '.cccc..cccc...',
];

export const DETECTIVE_COLORS = {
  h: PALETTE.soil, // the hat, pulled low
  b: PALETTE.plumDeep, // hat band and coat belt
  f: PALETTE.moonshadow, // the face the moon gets
  E: PALETTE.hotRose, // the cigarette's ember
  w: PALETTE.moonlight, // the cigarette itself
  c: PALETTE.clay, // coat, shadow side
  l: PALETTE.loam, // coat body
  a: PALETTE.amber, // coat, the flank the moon finds
};

// --- The ruins --------------------------------------------------------------
//
// Three facades, code-built like the cathedral because sag is geometry:
// the roofline bows on a sine, the windows are void behind soil boards,
// and nothing here has been gold for a long time. 's' shadow flank (soil),
// 'F' wall, 'R' roof, 'r' the moonlit rim on the right, 'B' boards, 'o'
// the void behind them.
function buildRuin({ w, h, sag, windows, door, porch, collapse }) {
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));
  const put = (x, y, ch) => {
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = ch;
  };
  const roofTop = 3;
  const roofY = (x) => roofTop + Math.round(sag * Math.sin((Math.PI * x) / (w - 1)));
  for (let x = 0; x < w; x++) {
    if (collapse && x >= w - collapse) continue; // the corner that gave up
    const ry = roofY(x);
    put(x, ry, 'R');
    put(x, ry + 1, 'R');
    if (x > w * 0.5) put(x, ry - 1, 'r'); // the moon still rims the ridge
    for (let y = ry + 2; y < h; y++) {
      put(x, y, x < 3 ? 's' : x >= w - 2 ? 'r' : 'F');
    }
  }
  if (collapse) {
    // where the roof went, the wall steps down after it
    for (let x = w - collapse; x < w; x++) {
      const top = roofTop + 2 + (x - (w - collapse)) * 2;
      for (let y = top; y < h; y++) put(x, y, x >= w - 2 ? 'r' : 'F');
      put(x, top, 's'); // the ragged broken course
    }
  }
  // Boarded windows: void behind, soil nailed across. No light in any of them.
  for (const [wx, wy] of windows) {
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        put(wx + dx, wy + dy, dy % 2 === 1 ? 'B' : 'o');
      }
    }
  }
  if (door !== undefined) {
    // A doorway with no door left to close
    for (let y = h - 8; y < h; y++) {
      for (let x = door; x < door + 5; x++) put(x, y, 'o');
    }
    put(door + 2, h - 9, 'o'); // where the frame bowed
  }
  if (porch) {
    // The porch roof is leaving the porch, one course at a time
    const { x0, x1, y } = porch;
    for (let x = x0; x <= x1; x++) {
      const py = y + Math.round(((x - x0) / (x1 - x0)) * 2);
      put(x, py, 'R');
      if (x > (x0 + x1) / 2) put(x, py - 1, 'r');
    }
    for (let py = y + 1; py < h; py++) {
      put(x0 + 1, py, 's'); // the plumb post
      put(x1 - 1 + (py > h - 4 ? 1 : 0), py, 's'); // the one that buckled
    }
  }
  return grid.map((row) => row.join(''));
}

const RUIN_NIGHT_COLORS = {
  R: PALETTE.plumDeep,
  r: PALETTE.smokeDeep,
  F: PALETTE.dusk,
  s: PALETTE.soil,
  B: PALETTE.soil,
  o: PALETTE.void,
};

export const RUIN_SPRITES = [
  // The general store, probably. Three windows nobody looks out of.
  {
    map: buildRuin({
      w: 36,
      h: 26,
      sag: 3,
      windows: [
        [6, 11],
        [16, 11],
        [26, 11],
      ],
      door: 15,
    }),
    colors: RUIN_NIGHT_COLORS,
  },
  // The hotel: the biggest building and the emptiest, porch mid-departure.
  {
    map: buildRuin({
      w: 40,
      h: 30,
      sag: 4,
      windows: [
        [6, 12],
        [17, 12],
        [30, 12],
        [6, 20],
      ],
      door: 17,
      porch: { x0: 2, x1: 37, y: 19 },
    }),
    colors: RUIN_NIGHT_COLORS,
  },
  // The one with the fallen corner. Whatever it was, it's this now.
  {
    map: buildRuin({
      w: 34,
      h: 28,
      sag: 3,
      windows: [
        [5, 12],
        [14, 12],
      ],
      door: 22,
      collapse: 8,
    }),
    colors: {
      R: PALETTE.soil,
      r: PALETTE.smokeDeep,
      F: PALETTE.plumDeep,
      s: PALETTE.soil,
      B: PALETTE.dusk,
      o: PALETTE.void,
    },
  },
];

// --- The town sign (18x22) --------------------------------------------------
//
// A board on a post, both leaning, neither falling — the town's whole
// philosophy. The lettering weathered past reading a long time ago.
export const TOWN_SIGN_SPRITE = [
  '..........MMMM....',
  '......MMMMBBBBb...',
  '..MMMMBBBBBBBBb...',
  '..BBBBBBxBBxBBb...',
  '..BxxBBxBBBxBBb...',
  '..BBBBxBBBBBBBb...',
  '..bBBBBBBBBBbb....',
  '...bbbbBBbbbb.....',
  '........Pp........',
  '........Pp........',
  '........Pp........',
  '.......Pp.........',
  '.......Pp.........',
  '.......Pp.........',
  '......Pp..........',
  '......Pp..........',
  '......Pp..........',
  '......Pp..........',
  '.....pPp..........',
  '.....pPpp.........',
  '....ppPpp.........',
  '....ppppp.........',
];

export const TOWN_SIGN_COLORS = {
  B: PALETTE.loam, // the board face
  b: PALETTE.clay, // its underside and edges
  M: PALETTE.smoke, // the moon along the top edge
  x: PALETTE.soil, // what's left of the name
  P: PALETTE.clay, // the post
  p: PALETTE.soil, // the post's dark side
};

// --- The bail-bonds office --------------------------------------------------
//
// Somebody in this town still posts bond. The corkboard says why: every
// red string on it runs back to the same card in the middle.

// The corkboard is code-built so the strings can actually be strings —
// Bresenham threads of blood between brass pins, moonlight note-cards
// underneath. 'f' frame, 'k' cork, 'n' cards, 'P' pins, 'r'/'R' the strings.
const CORKBOARD_MAP = (() => {
  const W = 24;
  const H = 16;
  const grid = Array.from({ length: H }, () => Array(W).fill('k'));
  for (let x = 0; x < W; x++) {
    grid[0][x] = 'f';
    grid[H - 1][x] = 'f';
  }
  for (let y = 0; y < H; y++) {
    grid[y][0] = 'f';
    grid[y][W - 1] = 'f';
  }
  const cards = [
    { x: 2, y: 2, w: 4, h: 3 },
    { x: 16, y: 2, w: 4, h: 3 },
    { x: 9, y: 6, w: 4, h: 3 }, // the card in the middle. Always the middle.
    { x: 3, y: 10, w: 4, h: 3 },
    { x: 17, y: 10, w: 4, h: 3 },
  ];
  for (const c of cards) {
    for (let dy = 0; dy < c.h; dy++) {
      for (let dx = 0; dx < c.w; dx++) grid[c.y + dy][c.x + dx] = 'n';
    }
  }
  const pin = (c) => [c.x + Math.floor(c.w / 2), c.y];
  const line = (a, b, ch) => {
    let [x0, y0] = a;
    const [x1, y1] = b;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (grid[y0][x0] === 'k') grid[y0][x0] = ch; // thread over cork only
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };
  line(pin(cards[0]), pin(cards[2]), 'r');
  line(pin(cards[1]), pin(cards[2]), 'R');
  line(pin(cards[3]), pin(cards[2]), 'r');
  line(pin(cards[4]), pin(cards[2]), 'R');
  line(pin(cards[0]), pin(cards[4]), 'r');
  for (const c of cards) {
    const [px, py] = pin(c);
    grid[py][px] = 'P';
  }
  return grid.map((row) => row.join(''));
})();

// One file-cabinet drawer: face, brass handle, face, divider. Nobody has
// opened the bottom one in years.
const CABINET_DRAWER = [
  'FFFFFFFFFFee',
  'FFFFhhhhFFee',
  'FFFFFFFFFFee',
  'ddddddddddee',
];

export const OFFICE_FURNISH = {
  // The desk (26x14): papers that are all the same case, and a brass lamp
  // burning gold over them anyway.
  desk: {
    map: [
      '..................gggg....',
      '.................gggggg...',
      '...................LL.....',
      '...................LL.....',
      '...nnnnn..nnnn....LLLL....',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'tttttttttttttttttttttttttt',
      '.ll.tttttttttttttttttt.ll.',
      '.ll.tttttkttttttkttttt.ll.',
      '.ll.tttttttttttttttttt.ll.',
      '.ll.tttttttttttttttttt.ll.',
      '.ll....................ll.',
      '.ll....................ll.',
      'lll....................lll',
    ],
    colors: {
      g: PALETTE.gold, // the lamp's lit shade
      L: PALETTE.brass, // stem and base
      n: PALETTE.moonlight, // the papers
      T: PALETTE.loam, // desktop catching the lamp
      t: PALETTE.clay, // the front and drawers
      k: PALETTE.brass, // drawer pulls
      l: PALETTE.soil, // legs
    },
  },
  // The file cabinet (12x20): four drawers of people who ran.
  filecabinet: {
    map: [
      'eeeeeeeeeeee',
      ...CABINET_DRAWER,
      ...CABINET_DRAWER,
      ...CABINET_DRAWER,
      ...CABINET_DRAWER,
      'FFFFFFFFFFee',
      'dddddddddddd',
      'dddddddddddd',
    ],
    colors: {
      e: PALETTE.smokeDeep, // the moonlit right edge and top
      F: PALETTE.dusk, // drawer faces
      h: PALETTE.brass, // handles
      d: PALETTE.soil, // dividers and plinth
    },
  },
  // The corkboard (24x16): see above. The strings are the whole office.
  corkboard: {
    map: CORKBOARD_MAP,
    colors: {
      f: PALETTE.clay, // the frame
      k: PALETTE.loam, // cork
      n: PALETTE.moonlight, // note-cards
      P: PALETTE.brass, // pins
      r: PALETTE.blood, // the strings
      R: PALETTE.bloodDeep, // the older strings
    },
  },
  // The door plate (12x8): 'BB', engraved. It doesn't say whose.
  doorsign: {
    map: [
      'gggggggggggg',
      'bbbbbbbbbbbg',
      'bBBBbbBBBbbg',
      'bBbBbbBbBbbg',
      'bBBbbbBBbbbg',
      'bBbBbbBbBbbg',
      'bBBBbbBBBbbg',
      'aaaaaaaaaaaa',
    ],
    colors: {
      g: PALETTE.gold, // the lit rim
      b: PALETTE.brass, // the plate
      B: PALETTE.soil, // the letters, cut deep
      a: PALETTE.amber, // the bottom in shadow
    },
  },
  // The coat rack (10x18): one hat, one coat, no owner in either.
  coatrack: {
    map: [
      '....pp....',
      '.hh.pp.kk.',
      'hhhhpp..k.',
      '....pp.cc.',
      '....ppcccc',
      '....ppcccc',
      '....ppcccc',
      '....pp.ccc',
      '....pp.ccc',
      '....pp.cc.',
      '....pp....',
      '....pp....',
      '....pp....',
      '....pp....',
      '...pppp...',
      '..pppppp..',
      '.pp.pp.pp.',
      '.pp.pp.pp.',
    ],
    colors: {
      p: PALETTE.clay, // the pole and feet
      k: PALETTE.brass, // hooks
      h: PALETTE.soil, // the hat nobody claimed
      c: PALETTE.plumDeep, // the coat nobody claimed either
    },
  },
};

// --- The cabin --------------------------------------------------------------
//
// One room, and everything in it earns its keep: heat, sleep, wood, a
// table, and a lantern for the part of the night the stove can't reach.
export const CABIN_FURNISH = {
  // The stove (16x18): pot-bellied iron, amber behind the grate, two gold
  // pixels where the fire actually lives.
  stove: {
    map: [
      '......PP........',
      '......PP........',
      '......PP........',
      '.....dddd.......',
      '....SSSSSSd.....',
      '...SSSSSSSSd....',
      '..SSSSSSSSSSd...',
      '..SSSEEEESSSd...',
      '..SSEEGGEESSd...',
      '..SSEEGGEESSd...',
      '..SSSEEEESSSd...',
      '..SSSSSSSSSSd...',
      '..SSSSSSSSSSd...',
      '...SSSSSSSSd....',
      '....SSSSSSd.....',
      '.....SSSS.......',
      '...ll....ll.....',
      '...ll....ll.....',
    ],
    colors: {
      P: PALETTE.soil, // the flue
      d: PALETTE.smokeDeep, // the moonlit iron rim
      S: PALETTE.dusk, // the belly
      E: PALETTE.amber, // the ember glow behind the grate
      G: PALETTE.gold, // the fire itself
      l: PALETTE.soil, // legs
    },
  },
  // The cot (24x10): a plum blanket, a moonshadow pillow, honest legs.
  cot: {
    map: [
      '.PPPP...................',
      'PPPPPPBBBBBBBBBBBBBBBBB.',
      'PPPPPPBBBBBBBBBBBBBBBBBB',
      'bbbbbbbbbbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbbbbbbbbbb',
      'FFFFFFFFFFFFFFFFFFFFFFFF',
      'ffffffffffffffffffffffff',
      '.ll..................ll.',
      '.ll..................ll.',
      'lll..................lll',
    ],
    colors: {
      P: PALETTE.moonshadow, // the pillow
      B: PALETTE.plum, // the blanket
      b: PALETTE.plumDeep, // the blanket over the edge
      F: PALETTE.loam, // the rail the moon finds
      f: PALETTE.clay, // the frame
      l: PALETTE.soil, // legs
    },
  },
  // The wall axe (14x10): hung on two pegs, brass head, clay haft, one
  // gold line along the edge. Kept sharp. Kept close.
  wallaxe: {
    map: [
      '..........HHH.',
      '.........HHHHe',
      '.........hHHHe',
      '......ssshHHe.',
      '...sssssshhh..',
      '.ssssss..p....',
      'ssss.....p....',
      '..p...........',
      '..p...........',
      '..p...........',
    ],
    colors: {
      H: PALETTE.brass, // the head
      h: PALETTE.amber, // the cheek in shadow
      e: PALETTE.gold, // the edge, moonlit
      s: PALETTE.clay, // the haft
      p: PALETTE.soil, // the pegs
    },
  },
  // The small table (16x10): four legs and no argument.
  table_small: {
    map: [
      '.TTTTTTTTTTTTTT.',
      'TTtTTTTTtTTTTTtT',
      'tttttttttttttttt',
      '.ll..........ll.',
      '.ll..........ll.',
      '.ll..........ll.',
      '.ll..........ll.',
      '.ll..........ll.',
      '.ll..........ll.',
      'lll..........lll',
    ],
    colors: {
      T: PALETTE.loam, // the top
      t: PALETTE.clay, // grain and the front edge
      l: PALETTE.soil, // legs
    },
  },
  // The lantern (8x12): amber glass around a gold flame with a goldRose
  // heart — the cabin's whole argument against the dark.
  lantern: {
    map: [
      '...hh...',
      '..h..h..',
      '.cccccc.',
      '.cggggc.',
      '.cgFFgc.',
      '.cgoogc.',
      '.cgFFgc.',
      '.cggggc.',
      '.cccccc.',
      '..cccc..',
      '.bbbbbb.',
      '.bbbbbb.',
    ],
    colors: {
      h: PALETTE.brass, // the bail handle
      c: PALETTE.soil, // the cage
      g: PALETTE.amber, // glass, glowing
      F: PALETTE.gold, // the flame
      o: PALETTE.goldRose, // its hottest point
      b: PALETTE.clay, // the base
    },
  },
};
