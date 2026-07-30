// Pixel sprites as string maps — one character per pixel, '.' transparent.
// Keys into SPRITE_COLORS (see palette.js). The person walks a 6-frame
// stride: contact (legs split wide, arms counter-swung), down (body bobs a
// pixel as the legs recoil), pass (tall, trailing knee lifted) — then the
// mirrored half-cycle for the other leg. B-frames are derived by mirroring
// the A-frames so the stride stays perfectly symmetric. The dog keeps its
// 2-frame trot. Both are moonlit silhouettes; sprites are authored facing
// right and flipped at draw time.

const mirror = (map) => map.map((row) => [...row].reverse().join(''));

const PERSON_STAND = [
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '...XXXX....',
  '..XXXXXX...',
  '..XXXXXX...',
  '..XXXXXX...',
  '..XXXXXX...',
  '...XXXX....',
  '...XXXX....',
  '...XXXX....',
  '...XX.XX...',
  '...XX.XX...',
  '...XX.XX...',
  '...XX.XX...',
  '...XX.XX...',
  '...XX.XX...',
];

// Contact: right leg planted far forward, left leg trailing, arms swung.
const PERSON_CONTACT_A = [
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '...XXXX....',
  '..XXXXXX...',
  '..XXXXX.X..',
  '.X.XXXX.X..',
  '.X.XXXX..X.',
  '...XXXX....',
  '...XXXX....',
  '...XXXX....',
  '...XX.XX...',
  '..XX...XX..',
  '.XX.....XX.',
  '.XX.....XX.',
  'XX.......XX',
  'XX.......XX',
];

// Down: the body drops a pixel as the legs pull back under it.
const PERSON_DOWN_A = [
  '...........',
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '...XXXX....',
  '..XXXXXX...',
  '..XXXXXX...',
  '..XXXXX.X..',
  '...XXXX....',
  '...XXXX....',
  '...XXXX....',
  '...XXXX....',
  '...XX.XX...',
  '..XX..XX...',
  '..XX...XX..',
  '..XX...XX..',
  '..XX...XX..',
];

// Pass: tall again, planted leg under the body, trailing knee lifted.
const PERSON_PASS_A = [
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '....XX.....',
  '...XXXX....',
  '..XXXXXX...',
  '..XXXXXX...',
  '..XXXXXX...',
  '..XXXXXX...',
  '...XXXX....',
  '...XXXX....',
  '...XXXX....',
  '...XXXX....',
  '..XX.XX....',
  '.....XX....',
  '.....XX....',
  '.....XX....',
  '.....XX....',
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

// Replace the authoring key 'X' with 'W' (moonlight) in the maps above.
for (const key of Object.keys(PERSON_FRAMES)) {
  PERSON_FRAMES[key] = PERSON_FRAMES[key].map((row) => row.replaceAll('X', 'W'));
}

export const DOG_FRAMES = {
  // Standing: tail up at the left, head and snout raised at the right.
  stand: [
    '..........XW.',
    'W.........WWW',
    '.W........WWW',
    '..WWWWWWWWWWW',
    '..WWWWWWWWW..',
    '..WWWWWWWW...',
    '..WW....WW...',
    '..WW....WW...',
    '..WW....WW...',
  ],
  // Trot A: legs split fore and aft.
  walkA: [
    '..........XW.',
    'W.........WWW',
    '.W........WWW',
    '..WWWWWWWWWWW',
    '..WWWWWWWWW..',
    '..WWWWWWWW...',
    '.WW......WW..',
    '.WW.......WW.',
    'WW.........WW',
  ],
  // Trot B: legs gathered.
  walkB: [
    '..........XW.',
    'W.........WWW',
    '.W........WWW',
    '..WWWWWWWWWWW',
    '..WWWWWWWWW..',
    '..WWWWWWWW...',
    '...WW..WW....',
    '...WW..WW....',
    '...WW..WW....',
  ],
};

// The dog's 'X' pixels (ear tip) are moonlight too.
for (const key of Object.keys(DOG_FRAMES)) {
  DOG_FRAMES[key] = DOG_FRAMES[key].map((row) => row.replaceAll('X', 'W'));
}

export const BALL_SPRITE = [
  '.P.',
  'PPP',
  '.P.',
];

export const HEART_SPRITE = [
  '.RR.RR.',
  'RRRRRRR',
  'RRRRRRR',
  '.RRRRR.',
  '..RRR..',
  '...R...',
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
