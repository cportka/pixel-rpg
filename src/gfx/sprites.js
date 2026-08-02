// Pixel sprites as string maps — one character per pixel, '.' transparent.
// Keys into SPRITE_COLORS (see palette.js).
//
// v0.16 redrew both characters ~1.5x larger for the finer screen: the person
// is 16x27 (was 11x18), the dog 19x14 (was 13x9), so at the new 2x upscale
// they occupy the same physical space with half again the detail. Silhouettes
// are authored in 'X' and shaded procedurally by shadeFrames(), which lights
// them from the top-right: right and top edges take moonlight, the interior
// takes moonshadow, the left flank falls to deep smoke, and the crown catches
// a rose-gold rim — the one warm light on a person in a dark wood.
//
// The person walks a 6-frame stride: contact (legs split wide, arms
// counter-swung), down (body bobs as the legs recoil), pass (tall, trailing
// knee lifted) — then the mirrored half-cycle. B-frames are derived by
// mirroring the A-frames so the stride stays perfectly symmetric. The dog
// keeps its 2-frame trot. Both are authored facing right, flipped at draw.

const mirror = (map) => map.map((row) => [...row].reverse().join(''));

const PERSON_STAND = [
  '......XXXX......',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '......XXXX......',
  '......XXXX......',
  '....XXXXXXXX....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '....XXXXXXXX....',
  '....XXXXXXXX....',
  '....XXX..XXX....',
  '....XXX..XXX....',
  '....XXX..XXX....',
  '....XXX..XXX....',
  '....XXX..XXX....',
  '....XXX..XXX....',
  '....XXX..XXX....',
  '...XXXX..XXXX...',
];

// Contact: right leg planted far forward, left trailing, arms counter-swung.
const PERSON_CONTACT_A = [
  '......XXXX......',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '......XXXX......',
  '......XXXX......',
  '....XXXXXXXX....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXX.X.',
  '.X.XXXXXXXXXX.XX',
  '.X.XXXXXXXXXX..X',
  'XX.XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '....XXXXXXXX....',
  '....XXX..XXX....',
  '...XXX....XXX...',
  '..XXX......XXX..',
  '..XXX......XXX..',
  '.XXX........XXX.',
  '.XXX........XXX.',
  'XXX..........XXX',
  'XXX..........XXX',
  'XXX..........XXX',
];

// Down: the body drops as the legs pull back under it.
const PERSON_DOWN_A = [
  '................',
  '......XXXX......',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '......XXXX......',
  '......XXXX......',
  '....XXXXXXXX....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXX.X.',
  '..XXXXXXXXXXX.XX',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '....XXXXXXXX....',
  '....XXX..XXX....',
  '...XXX...XXX....',
  '...XXX....XXX...',
  '..XXX.....XXX...',
  '..XXX.....XXXX..',
  '..XXX......XXX..',
  '..XXX......XXX..',
  '..XXX......XXX..',
  '..XXX......XXX..',
];

// Pass: tall again, planted leg under the body, trailing knee lifted.
const PERSON_PASS_A = [
  '......XXXX......',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '.....XXXXXX.....',
  '......XXXX......',
  '......XXXX......',
  '....XXXXXXXX....',
  '...XXXXXXXXXX...',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '....XXXXXXXX....',
  '....XXXXXXXX....',
  '...XXXX..XXX....',
  '..XXX....XXX....',
  '.....X...XXX....',
  '.........XXX....',
  '.........XXX....',
  '.........XXX....',
  '.........XXX....',
  '........XXXX....',
];

export const PERSON_FRAMES = {
  stand: PERSON_STAND,
  contactA: PERSON_CONTACT_A,
  downA: PERSON_DOWN_A,
  passA: PERSON_PASS_A,
  contactB: mirror(PERSON_CONTACT_A),
  downB: mirror(PERSON_DOWN_A),
  passB: mirror(PERSON_PASS_A),
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

for (const key of Object.keys(PERSON_FRAMES)) {
  PERSON_FRAMES[key] = shadeFrames(PERSON_FRAMES[key].map((row) => row.replaceAll('X', 'W')));
}
for (const key of Object.keys(DOG_FRAMES)) {
  DOG_FRAMES[key] = shadeFrames(DOG_FRAMES[key].map((row) => row.replaceAll('X', 'W')));
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

/** Walk cycle: pick a frame set's frame from an animation clock. */
export function walkFrame(frames, walking, animTime) {
  if (!walking) return frames.stand;
  const seq = frames.contactA
    ? [frames.contactA, frames.downA, frames.passA, frames.contactB, frames.downB, frames.passB]
    : [frames.walkA, frames.walkB];
  return seq[Math.floor(animTime * WALK_CYCLE_FPS) % seq.length];
}

/** Width/height of a sprite map. */
export function spriteSize(map) {
  return { w: map[0].length, h: map.length };
}
