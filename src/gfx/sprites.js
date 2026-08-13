// Pixel sprites as string maps — one character per pixel, '.' transparent.
// Keys into SPRITE_COLORS (see palette.js).
//
// v0.17 redrew the person LANKY: 14x32 (was a stocky 16x27) — an anime
// silhouette that is nearly half leg, with a swept fall of hair, a slim
// 4px torso, and long arms that hang free of the body. Silhouettes are
// authored in 'X' and shaded procedurally by shadeFrames(), which lights
// them from the top-right: right and top edges take moonlight, the interior
// takes moonshadow, the left flank falls to deep smoke, and the crown catches
// a rose-gold rim — the one warm light on a person in a dark wood.
//
// The walk is a 6-frame stride built to BOUNCE: contact (feet planted wide,
// hair trailing, body sunk one row), down (the deep beat — everything drops
// two more rows as the legs recoil), pass (the tallest frame, trailing foot
// flicked up behind). B-frames mirror the LEGS AND ARMS of the A-frames but
// keep the head and hair unmirrored — hair swept back is swept back for the
// whole stride, it does not swap sides every half-cycle. Standing still has
// its own two-frame sway, so the person is never a statue. The dog keeps its
// 2-frame trot. All maps are authored facing right, flipped at draw.

/** Mirror a frame's body while keeping rows above hairEnd (head, hair) as-is. */
const mirrorBody = (map, hairEnd) =>
  map.map((row, y) => (y < hairEnd ? row : [...row].reverse().join('')));

// Standing: contrapposto — weight settled, arms hanging long and a little
// free of the body, the hair swept back off the brow.
const PERSON_STAND = [
  '.....XXXXX....',
  '...XXXXXXXX...',
  '..XXXXXXXXX...',
  '...XXXXXXXX...',
  '....XXXXXXX...',
  '....XXXXXX....',
  '.....XXXX.....',
  '......XX......',
  '....XXXXXX....',
  '...XXXXXXXX...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '.....XXXX.....',
  '.....XXXX.....',
  '.....XXXX.....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '....XXX.XXX...',
];

// The idle sway: the head drifts a pixel, one arm floats out — a breath.
const PERSON_SWAY = [
  '......XXXXX...',
  '....XXXXXXXX..',
  '...XXXXXXXXX..',
  '....XXXXXXXX..',
  '.....XXXXXXX..',
  '.....XXXXXX...',
  '......XXXX....',
  '......XX......',
  '....XXXXXX....',
  '...XXXXXXXX...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '...X.XXXX..X..',
  '...X.XXXX..X..',
  '...X.XXXX..X..',
  '.....XXXX.....',
  '.....XXXX.....',
  '.....XXXX.....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '.....XX.XX....',
  '....XXX.XXX...',
];

// Contact: the wide beat — both feet planted far apart, arms counter-swung
// long, the hair streaming back, the whole figure sunk one row.
const PERSON_CONTACT_A = [
  '..............',
  '.....XXXXX....',
  '..XXXXXXXXX...',
  '.XXXXXXXXXX...',
  '....XXXXXXX...',
  '.....XXXXXX...',
  '.....XXXXX....',
  '......XXX.....',
  '.......XX.....',
  '.....XXXXXX...',
  '....XXXXXXXX..',
  '...X..XXXX.X..',
  '..X...XXXX..X.',
  '..X...XXXX..X.',
  '...X..XXXX..X.',
  '......XXXX....',
  '......XXXX....',
  '......XXXX....',
  '.....XXX.XX...',
  '....XXX..XXX..',
  '....XX....XX..',
  '...XXX....XXX.',
  '...XX......XX.',
  '..XXX......XXX',
  '..XX........XX',
  '.XXX........XX',
  '.XX.........XX',
  '.XX.........XX',
  'XXX.........XX',
  'XX..........XX',
  'XX..........XX',
  'XXX........XXX',
];

// Down: the deep beat of the bounce — the body drops two more rows and the
// legs recoil under it. This frame is what makes the walk springy.
const PERSON_DOWN_A = [
  '..............',
  '..............',
  '..............',
  '.....XXXXX....',
  '...XXXXXXXX...',
  '..XXXXXXXXX...',
  '...XXXXXXXX...',
  '....XXXXXXX...',
  '.....XXXXX....',
  '......XXX.....',
  '.......XX.....',
  '.....XXXXXX...',
  '....XXXXXXXX..',
  '....X.XXXX.X..',
  '....X.XXXX.X..',
  '....X.XXXX.X..',
  '......XXXX....',
  '......XXXX....',
  '......XXXX....',
  '.....XXX.XX...',
  '.....XX..XX...',
  '....XXX..XXX..',
  '....XX....XX..',
  '....XX....XX..',
  '...XXX....XX..',
  '...XX.....XXX.',
  '...XX......XX.',
  '...XX......XX.',
  '...XX......XX.',
  '...XX......XX.',
  '..XXX......XX.',
  '..XXX.....XXX.',
];

// Pass: the tall beat — planted leg straight under the hips, the trailing
// foot flicked up behind, the figure at full stretch.
const PERSON_PASS_A = [
  '.....XXXXX....',
  '...XXXXXXXX...',
  '..XXXXXXXXX...',
  '...XXXXXXXX...',
  '....XXXXXXX...',
  '....XXXXXX....',
  '.....XXXX.....',
  '......XX......',
  '....XXXXXX....',
  '...XXXXXXXX...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '...X.XXXX.X...',
  '.....XXXX.....',
  '.....XXXX.....',
  '.....XXXX.....',
  '.....XXXX.....',
  '....XXX.XX....',
  '....XX..XX....',
  '...XXX..XX....',
  '...XX...XX....',
  '..XXX...XX....',
  '..XX....XX....',
  '........XX....',
  '........XX....',
  '........XX....',
  '........XX....',
  '........XX....',
  '........XX....',
  '........XX....',
  '.......XXXX...',
];

// Where each frame's un-mirrored zone ends (hair + head + neck rows): the
// body below mirrors for the B half-cycle, the hair above does not.
const HAIR_END = { contact: 9, down: 11, pass: 8 };

export const PERSON_FRAMES = {
  stand: PERSON_STAND,
  sway: PERSON_SWAY,
  contactA: PERSON_CONTACT_A,
  downA: PERSON_DOWN_A,
  passA: PERSON_PASS_A,
  contactB: mirrorBody(PERSON_CONTACT_A, HAIR_END.contact),
  downB: mirrorBody(PERSON_DOWN_A, HAIR_END.down),
  passB: mirrorBody(PERSON_PASS_A, HAIR_END.pass),
};

export const DOG_FRAMES = {
  // Standing: tail up at the left, head and pricked ear raised at the right.
  stand: [
    '..............XX...',
    '.............XXXX..',
    'X............XXXXX.',
    'XX..........XXXXXXX',
    '.XX.........XXXXXXX',
    '..XXXXXXXXXXXXXXXXX',
    '..XXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXX...',
    '..XXX.....XXXX.....',
    '..XXX.....XXXX.....',
    '..XXX.....XXXX.....',
    '..XXX.....XXXX.....',
  ],
  // Trot A: legs split fore and aft.
  walkA: [
    '..............XX...',
    '.............XXXX..',
    'X............XXXXX.',
    'XX..........XXXXXXX',
    '.XX.........XXXXXXX',
    '..XXXXXXXXXXXXXXXXX',
    '..XXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXX..',
    '.XXXXXXXXXXXXXXX...',
    '.XXX........XXXX...',
    'XXX..........XXXX..',
    'XX............XXXX.',
    'XX.............XXX.',
  ],
  // Trot B: legs gathered under the body.
  walkB: [
    '..............XX...',
    '.............XXXX..',
    'X............XXXXX.',
    'XX..........XXXXXXX',
    '.XX.........XXXXXXX',
    '..XXXXXXXXXXXXXXXXX',
    '..XXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXX...',
    '...XXX...XXXX......',
    '...XXX...XXXX......',
    '....XX...XXX.......',
    '....XX...XXX.......',
  ],
};

// Cerberus (v0.17): what the dog is in heaven — the same good boy, three
// heads fanned toward you, beckoning back across the Styx. 24x15, trot
// cadence borrowed from the dog.
export const CERBERUS_FRAMES = {
  stand: [
    '..............XX...XX...',
    '.....X.......XXXX.XXXX..',
    '.....XX......XXXXX.XXXXX',
    '......XX.....XXXXXXXXXXX',
    '.......X..XX.XXXXXXXXXX.',
    '.......XXXXX.XXXXXXXXXXX',
    '.......XXXXXXXXXXXXXXXX.',
    '.......XXXXXXXXXXXXXX...',
    '.......XXXXXXXXXXXXX....',
    '.......XXXXXXXXXXXX.....',
    '.......XXXXXXXXXXX......',
    '.......XXX.....XXX......',
    '.......XXX.....XXX......',
    '.......XXX.....XXX......',
    '.......XXX.....XXX......',
  ],
  walkA: [
    '..............XX...XX...',
    '.....X.......XXXX.XXXX..',
    '.....XX......XXXXX.XXXXX',
    '......XX.....XXXXXXXXXXX',
    '.......X..XX.XXXXXXXXXX.',
    '.......XXXXX.XXXXXXXXXXX',
    '.......XXXXXXXXXXXXXXXX.',
    '.......XXXXXXXXXXXXXX...',
    '.......XXXXXXXXXXXXX....',
    '......XXXXXXXXXXXXX.....',
    '......XXXXXXXXXXXX......',
    '......XXX.......XXX.....',
    '.....XXX.........XXX....',
    '....XXX...........XXX...',
    '....XX.............XXX..',
  ],
  walkB: [
    '..............XX...XX...',
    '.....X.......XXXX.XXXX..',
    '.....XX......XXXXX.XXXXX',
    '......XX.....XXXXXXXXXXX',
    '.......X..XX.XXXXXXXXXX.',
    '.......XXXXX.XXXXXXXXXXX',
    '.......XXXXXXXXXXXXXXXX.',
    '.......XXXXXXXXXXXXXX...',
    '.......XXXXXXXXXXXXX....',
    '.......XXXXXXXXXXXX.....',
    '.......XXXXXXXXXXX......',
    '........XXX...XXX.......',
    '........XXX...XXX.......',
    '.........XX...XX........',
    '.........XX...XX........',
  ],
};

/**
 * The 16-bit shading pass. The moon sits high and to the right, so:
 * right and top edges take moonlight, the body interior takes moonshadow,
 * the left flank falls to deep smoke, and the top-right rim of the head and
 * shoulders catches a rose-gold kiss. Only tones change — the silhouette and
 * the cadence are untouched, which is what the tests pin.
 */
export function shadeFrames(map) {
  const h = map.length;
  const at = (x, y) => (map[y] && map[y][x]) || '.';
  const lit = (x, y) => at(x, y) !== '.';
  return map.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === '.') return ch;
        const edgeRight = !lit(x + 1, y);
        const edgeTop = !lit(x, y - 1);
        if (edgeRight && edgeTop && y < h * 0.32) return 'r'; // the warm crown
        if (edgeRight || edgeTop) return 'W';
        if (!lit(x - 1, y)) return 'd';
        return 's';
      })
      .join(''),
  );
}

for (const frames of [PERSON_FRAMES, DOG_FRAMES, CERBERUS_FRAMES]) {
  for (const key of Object.keys(frames)) {
    frames[key] = shadeFrames(frames[key].map((row) => row.replaceAll('X', 'W')));
  }
}

export const BALL_SPRITE = [
  '.PPP.',
  'PPPPP',
  'PPWPP',
  'PPPPP',
  '.PPP.',
];

export const HEART_SPRITE = [
  '.RR..RR.',
  'RRRRRRRR',
  'RRRRRRRR',
  'RRRRRRRR',
  '.RRRRRR.',
  '..RRRR..',
  '...RR...',
];

// Walk cadence, matched to the reference: the cycle advances ~7.5 steps/sec
// (a frame change every couple of 15Hz render ticks), so the stride reads
// chunky instead of fluttering.
export const WALK_CYCLE_FPS = 7.5;

// The idle sway alternates at this rate — a slow breath, not a march.
export const IDLE_SWAY_HZ = 1.25;

/**
 * Walk cycle: pick a frame set's frame from an animation clock. Standing
 * still is its own two-frame sway (when the set has one): pass idleTime —
 * a clock that keeps running while the character is planted, e.g. game
 * time — so the sway breathes even though animTime is frozen.
 */
export function walkFrame(frames, walking, animTime, idleTime = 0) {
  if (!walking) {
    if (frames.sway && Math.floor(idleTime * IDLE_SWAY_HZ) % 2 === 1) return frames.sway;
    return frames.stand;
  }
  const seq = frames.contactA
    ? [frames.contactA, frames.downA, frames.passA, frames.contactB, frames.downB, frames.passB]
    : [frames.walkA, frames.walkB];
  return seq[Math.floor(animTime * WALK_CYCLE_FPS) % seq.length];
}

/** Width/height of a sprite map. */
export function spriteSize(map) {
  return { w: map[0].length, h: map.length };
}
