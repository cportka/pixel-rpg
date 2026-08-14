// Creature art for v0.20's heaven: the red minotaur pacing his maze, God
// (a cricket), the frogs who menace Him, signposts that point the way, a
// boat for the pale Styx, an island shrine, and the furniture of the
// cathedral nave.
//
// Everything here renders on the OTHER side of the television glass, so the
// draw-time heaven remap applies: blood stays true red, magenta stays hot,
// moonlight turns to ink, and the pale golds fade into the cream — which is
// why the outlines that must read up there are amber and brass. Pure data +
// deterministic geometry; the renderer rasterizes. No dice anywhere.

import { PALETTE } from './palette.js';

// --- The minotaur -----------------------------------------------------------
//
// 22 wide x 30 tall, anchored at its base center, authored facing right.
// The one true red in the game. Massive shoulders, a waist that remembers
// being smaller, the head dropped a degree — he is searching, not charging.
// 'B' blood body, 'b' bloodDeep west flank, 'h' moonlight horns (ink in
// heaven), 'n' the gold nose ring, 'H' bloodDeep hooves, 'r' a hot-rose rim
// where the light finds a shoulder.

const MINOTAUR_UPPER = [
  '...h..............h...',
  '..hh..............hh..',
  '...hh............hh...',
  '....hh..bBBBBB..hh....',
  '.....hhbBBBBBBBhh.....',
  '.......bBBBBBBB.......',
  '......bBBBBBBBBB......',
  '......bBBBnnBBBB......',
  '.bbBBBBBBBBBBBBBBBrr..',
  'bbbBBBBBBBBBBBBBBBBBr.',
  'bbbBBBBBBBBBBBBBBBBBB.',
  'bbBBBBBBBBBBBBBBBBBB..',
  '.bbBBBBBBBBBBBBBBBB...',
  '.bbBB.BBBBBBBBBB.BB...',
  '.bBB..bBBBBBBBB..BB...',
  '.bBB..bBBBBBBBB..BB...',
  '.bBB..bBBBBBB....BB...',
  '.bBBB.bBBBBBB....BBB..',
];

const MINOTAUR_LEGS_STAND = [
  '......bBBBBBBB........',
  '......bBBBBBBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......bBB..BBB........',
  '......HHH..HHH........',
  '......HHH..HHH........',
];

const MINOTAUR_LEGS_A = [
  '......bBBBBBBB........',
  '.....bBBBBBBBB........',
  '.....bBB...BBB........',
  '....bBB....BBBB.......',
  '....bBB....BBB........',
  '...bBB......BBB.......',
  '...bBB......BBB.......',
  '...bBB.......BBB......',
  '...bBB.......BBB......',
  '...bBB.......BBB......',
  '...HHH.......HHH......',
  '...HHH.......HHH......',
];

const MINOTAUR_LEGS_B = [
  '......bBBBBBBB........',
  '......bBBBBBBBB.......',
  '......bBB...BBB.......',
  '.......bBB...BBBB.....',
  '.......bBB....BBB.....',
  '.......bBB....BBB.....',
  '........bBB....BBB....',
  '........bBB....BBB....',
  '........bBB.....BBB...',
  '........bBB.....BBB...',
  '........HHH.....HHH...',
  '........HHH.....HHH...',
];

export const MINOTAUR_FRAMES = {
  stand: [...MINOTAUR_UPPER, ...MINOTAUR_LEGS_STAND],
  walkA: [...MINOTAUR_UPPER, ...MINOTAUR_LEGS_A],
  walkB: [...MINOTAUR_UPPER, ...MINOTAUR_LEGS_B],
};

export const MINOTAUR_COLORS = {
  B: PALETTE.blood,
  b: PALETTE.bloodDeep,
  h: PALETTE.moonlight,
  n: PALETTE.gold,
  H: PALETTE.bloodDeep,
  r: PALETTE.hotRose,
};

/**
 * The minotaur's wander: a slow lissajous that never repeats itself in any
 * way that matters and never arrives anywhere at all — the maze of his life,
 * paced at one lap per ~40 seconds inside a ~90px radius. Returns { dx, dy,
 * facing }, facing from the sign of the dx derivative so he always looks
 * where he is going, for whatever good it does him.
 */
export function minotaurWander(time, phase) {
  const w = (Math.PI * 2) / 40; // one circuit of the maze every ~40s
  const dx = Math.round(80 * Math.sin(w * time + phase));
  const dy = Math.round(40 * Math.sin(2 * w * time + phase * 1.7));
  const facing = Math.cos(w * time + phase) >= 0 ? 1 : -1;
  return { dx, dy, facing };
}

// --- God --------------------------------------------------------------------
//
// 8 wide x 6 tall. A cricket. The greens sink almost into heaven's cream,
// which is the point: God is small, and easy to miss, and singing anyway.
// 'p' pine antennae and legs, 'm' moss shade, 'f' fern body, 'g' one gold eye.

export const CRICKET_SPRITE = [
  '.p....p.',
  '..pp.p..',
  '.mffffg.',
  'mfffffm.',
  '.mffff..',
  '..p..p..',
];

export const CRICKET_COLORS = {
  p: PALETTE.pine,
  m: PALETTE.moss,
  f: PALETTE.fern,
  g: PALETTE.gold,
};

/**
 * The chirp: silence, mostly. Every ~2.5s a short phrase — two notes,
 * sometimes three — climbs away above the cricket and is gone. Offsets
 * relative to the cricket's base center; negative y is up. Deterministic:
 * God does not roll dice.
 */
export function cricketChirp(time) {
  const period = 2.5;
  const t = time % period;
  if (t > 0.5) return [];
  const count = 2 + (Math.floor(time / period) % 2); // two notes, sometimes three
  const lift = Math.floor(t * 4); // the phrase rises as it plays
  const pixels = [];
  for (let i = 0; i < count; i++) {
    pixels.push({
      x: 2 + i * 2,
      y: -5 - i * 2 - lift,
      c: i === count - 1 ? PALETTE.goldRose : PALETTE.gold,
    });
  }
  return pixels;
}

// --- The frogs --------------------------------------------------------------
//
// 10 wide x 8 tall, authored facing LEFT — toward God, the way a menace
// faces. 'f' fern hide, 'm' moss shade, 'p' pine pupils, 'T' the magenta
// throat, which stays hot on the cream so you can see what it wants.

export const FROG_SPRITE = [
  '.ff...ff..',
  '.fpf..fpf.',
  'ffffffffff',
  'TTffffffm.',
  'TTfffffmm.',
  '.mffffffm.',
  '.mm.ff.mm.',
  '.m......m.',
];

export const FROG_COLORS = {
  f: PALETTE.fern,
  m: PALETTE.moss,
  p: PALETTE.pine,
  T: PALETTE.magenta,
};

// The lilypad under the frog: 14 wide x 6 tall, a fern pad with a leaf-lit
// rim toward the top-right and the customary wedge bitten out of the east.

export const LILYPAD_SPRITE = [
  '....fflllll...',
  '..ffffllllll..',
  '.fffffffff..ll',
  '.ffffffffffll.',
  '..ffffffffff..',
  '....ffffff....',
];

export const LILYPAD_COLORS = {
  f: PALETTE.fern,
  l: PALETTE.leaf,
};

/**
 * The menace: nothing, mostly — a frog is patient. Every ~6s the tongue
 * snaps out toward negative x (toward God) and holds ~0.4s: a 4-7px magenta
 * line, pink at the tip, offsets relative to the frog's base center. The
 * length cycles deterministically per strike; phase staggers the chorus.
 */
export function frogMenace(time, phase) {
  const period = 6;
  const t = (time + phase) % period;
  if (t > 0.4) return { tongue: [] };
  const strike = Math.floor((time + phase) / period);
  const len = 4 + (strike % 4); // 4-7px, a different reach each time
  const tongue = [];
  for (let i = 1; i <= len; i++) {
    tongue.push({
      x: -5 - i, // out past the left edge of the sprite
      y: -4,
      c: i === len ? PALETTE.pink : PALETTE.magenta,
    });
  }
  return { tongue };
}

// --- Signposts to God -------------------------------------------------------
//
// 14 wide x 20 tall, anchored at base center. A wooden post holding up a
// blank board — the board says nothing until signArrowPixels paints the
// direction on it. 'c' clay wood, 'o' loam where the light lands.

export const SIGNPOST_SPRITE = [
  '..oooooooooo..',
  '.ccccccccccco.',
  '.ccccccccccco.',
  '.ccccccccccco.',
  '.ccccccccccco.',
  '.ccccccccccco.',
  '.ccccccccccco.',
  '.oooooooooooo.',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '......cco.....',
  '.....ccoo.....',
];

export const SIGNPOST_COLORS = {
  c: PALETTE.clay,
  o: PALETTE.loam,
};

/**
 * The arrow on the board: a 7px shaft through the board's center pointing
 * along `angle` (radians, screen coords — y grows downward), with two amber
 * barbs at the head. Brass and amber so it still reads on heaven's cream.
 * Offsets relative to the signpost's base center; the board face sits ~16px
 * up. Every signpost points to God; only the angle differs.
 */
export function signArrowPixels(angle) {
  const cx = 0;
  const cy = -16;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const pixels = [];
  for (let i = -3; i <= 3; i++) {
    pixels.push({
      x: cx + Math.round(ux * i),
      y: cy + Math.round(uy * i),
      c: PALETTE.brass,
    });
  }
  // The barbs: one step back from the tip, one step to either side.
  for (const s of [1, -1]) {
    pixels.push({
      x: cx + Math.round(ux * 2 - uy * s),
      y: cy + Math.round(uy * 2 + ux * s),
      c: PALETTE.amber,
    });
  }
  return pixels;
}

// --- The boat ---------------------------------------------------------------
//
// 26 wide x 14 tall, anchored at base center. A little wooden thing for a
// pale river: amber-and-brass hull, clay planking, and a small moonlight
// sail that turns to ink on the far side — a dark triangle on silver water.
// 'c' clay mast and planks, 'M' the sail, 'a' amber shadow, 's' lit brass.

export const BOAT_SPRITE = [
  '............c.............',
  '............cM............',
  '............cMM...........',
  '............cMMM..........',
  '............cMMMM.........',
  '............cMMMMM........',
  '............cMMMMMM.......',
  '............cMMMMMMM......',
  '............c.............',
  '.ssssssssssssssssssssssss.',
  'aaccccccccccccccccccccccss',
  '.aaccccccccccccccccccccss.',
  '..aaacccccccccccccccccss..',
  '....aaaaaaaassssssssss....',
];

export const BOAT_COLORS = {
  c: PALETTE.clay,
  M: PALETTE.moonlight,
  a: PALETTE.amber,
  s: PALETTE.brass,
};

// --- The island shrine ------------------------------------------------------
//
// 18 wide x 22 tall, anchored at base center. Stacked stones the color of
// smoke, an offering bowl of gold on top, and one rose-gold glint above it —
// somebody left something, once. 'S' smoke stone, 'D' smokeDeep shadow,
// 'g' the gold bowl, 'G' the glint.

export const SHRINE_SPRITE = [
  '.........G........',
  '.......gggg.......',
  '......gggggg......',
  '.....DDSSSSS......',
  '....DDSSSSSSS.....',
  '....DDSSSSSSS.....',
  '.....DDSSSSS......',
  '...DDSSSSSSSSS....',
  '..DDSSSSSSSSSSS...',
  '..DDSSSSSSSSSSS...',
  '..DDSSSSSSSSSS....',
  '...DDSSSSSSSS.....',
  '..DDSSSSSSSSSSSS..',
  '.DDSSSSSSSSSSSSSS.',
  '.DDSSSSSSSSSSSSSS.',
  '.DDSSSSSSSSSSSSS..',
  '..DDSSSSSSSSSSS...',
  '.DDSSSSSSSSSSSSSS.',
  'DDDSSSSSSSSSSSSSSS',
  'DDDSSSSSSSSSSSSSSS',
  'DDDSSSSSSSSSSSSSS.',
  '.DDDSSSSSSSSSSSS..',
];

export const SHRINE_COLORS = {
  S: PALETTE.smoke,
  D: PALETTE.smokeDeep,
  g: PALETTE.gold,
  G: PALETTE.goldRose,
};

// --- The cathedral nave -----------------------------------------------------
//
// Interior furnishings, each { map, colors }, base-center anchored. The nave
// runs on the deep end of the gold ramp — amber and brass carry the shapes,
// gold fills them, rose-gold is spent one glint at a time.

// THE PILE OF GOD: 26 wide x 18 tall, code-built like the cathedral itself.
// A mound of everything ever given — gold flecked with brass, amber tucked
// in the hollows, the east slope catching rose light, one glint at the crown.
const PILE_MAP = (() => {
  const W = 26;
  const H = 18;
  const grid = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let y = 2; y < H; y++) {
    const half = Math.round(((y - 1) * 12) / (H - 2));
    for (let x = 13 - half; x <= 12 + half; x++) {
      let ch;
      if (x <= 13 - half + 1) ch = 'a'; // the west slope keeps its shadow
      else if (x >= 12 + half - 1) ch = 'G'; // the east slope takes the light
      else {
        const v = (x * 7 + y * 13) % 9; // deterministic treasure speckle
        ch = v === 0 ? 'a' : v < 3 ? 's' : 'g';
      }
      grid[y][x] = ch;
    }
  }
  grid[1][12] = 'g';
  grid[1][13] = 'g';
  grid[0][13] = 'G'; // the crown glint
  return grid.map((row) => row.join(''));
})();

export const CATHEDRAL_FURNISH = {
  // A pew: 28x8. Long enough to hold everyone who never comes.
  pew: {
    map: [
      'ssssssssssssssssssssssssssss',
      'aaaaaaaaaaaaaaaaaaaaaaaaaass',
      'aaaaaaaaaaaaaaaaaaaaaaaaaass',
      'ssssssssssssssssssssssssssss',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaas',
      '.aa......................aa.',
      '.aa......................aa.',
      '.aa......................aa.',
    ],
    colors: {
      a: PALETTE.amber,
      s: PALETTE.brass,
    },
  },
  // The altar: 22x16, gold under a magenta cloth that stays hot on the cream.
  altar: {
    map: [
      'ssssssssssssssssssssss',
      'aggggggggggggggggggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'agggMMMMMMMMMMMMgggggs',
      'aggggggggggggggggggggs',
      'aggggggggggggggggggggs',
      'aggggggggggggggggggggs',
      'aggggggggggggggggggggs',
      'aggggggggggggggggggggs',
      'aaaaaaaaaaaaaaaaaaaaaa',
    ],
    colors: {
      g: PALETTE.gold,
      a: PALETTE.amber,
      s: PALETTE.brass,
      M: PALETTE.magenta,
    },
  },
  // The raga singer: 10x18, a dark robe, an open mouth, and the one gold
  // note that never stops leaving it.
  singer: {
    map: [
      '...RRRR...',
      '..RRRRRR..',
      '..RRRRRR.n',
      '..RiooiRnn',
      '..RRooRR..',
      '..RRRRRR..',
      '.RRRRRRRR.',
      '.RRRRRRRR.',
      '.RRiRRiRR.',
      '.RRiRRiRR.',
      '.RRiRRiRR.',
      '.RRiRRiRR.',
      '.RRiRRiRR.',
      '.RRiRRiRR.',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
      'RR.RRRR.RR',
    ],
    colors: {
      R: PALETTE.smokeDeep,
      i: PALETTE.moonshadow,
      o: PALETTE.plumDeep,
      n: PALETTE.gold,
    },
  },
  // THE PILE OF GOD: 26x18. See above. It only ever gets taller.
  pile: {
    map: PILE_MAP,
    colors: {
      g: PALETTE.gold,
      s: PALETTE.brass,
      G: PALETTE.goldRose,
      a: PALETTE.amber,
    },
  },
  // A brazier: 10x14, a brass bowl on a stem, burning gold. Nobody feeds it.
  brazier: {
    map: [
      '....gG....',
      '...gGGg...',
      '...gGGg...',
      '..ggGGgg..',
      '..gggggg..',
      '.ssssssss.',
      '.aassssss.',
      '..aasssss.',
      '...aasss..',
      '....as....',
      '....as....',
      '....as....',
      '...a..s...',
      '..aa..ss..',
    ],
    colors: {
      g: PALETTE.gold,
      G: PALETTE.goldRose,
      s: PALETTE.brass,
      a: PALETTE.amber,
    },
  },
};

/**
 * The pile grows: two coins per donation stacked on the crown, capped at 16
 * pixels so devotion outgrows nobody's screen. Same covenant as
 * templeGrowthPixels. Offsets relative to the pile's base center; the crown
 * glint sits 18 rows up, so the new coins start above it. The freshest pair
 * is rose-gold — for a moment, the newest gift is the brightest.
 */
export function pileGrowthPixels(goldGiven) {
  const pixels = [];
  const total = Math.min(16, goldGiven * 2);
  for (let i = 0; i < total; i++) {
    const course = i >> 1;
    const x = i % 2 === 0 ? -1 : 0;
    pixels.push({
      x,
      y: -19 - course,
      c: i >= total - 2 ? PALETTE.goldRose : PALETTE.gold,
    });
  }
  return pixels;
}
