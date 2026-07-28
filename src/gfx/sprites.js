// Pixel sprites as string maps — one character per pixel, '.' transparent.
// Keys into SPRITE_COLORS (see palette.js). Redrawn from the reference
// footage: a tall thin person (~18px) with a visible arm swing, and a dog
// with a raised head, snout, ear, and trotting legs. Both are moonlit
// silhouettes; the dog is authored facing right and flipped at draw time.

export const PERSON_FRAMES = {
  // At rest: legs a hair apart, arms at the sides.
  stand: [
    '...XX....',
    '...XX....',
    '...XX....',
    '...XX....',
    '..XXXXX..',
    '.XXXXXXX.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '..XX.XX..',
    '..XX.XX..',
    '..XX.XX..',
    '..XX.XX..',
    '..XX.XX..',
    '..XX.XX..',
  ],
  // Contact A: right leg + left arm forward (facing right).
  walkA: [
    '...XX....',
    '...XX....',
    '...XX....',
    '...XX....',
    '..XXXXX..',
    '.XXXXXXX.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '.X.XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '..XX.XX..',
    '.XX...XX.',
    '.XX...XX.',
    'XX.....XX',
    'XX.....XX',
    'XX.....XX',
  ],
  // Passing: legs gathered under the body.
  walkB: [
    '...XX....',
    '...XX....',
    '...XX....',
    '...XX....',
    '..XXXXX..',
    '.XXXXXXX.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '...XXX...',
    '...XXX...',
    '...XXX...',
    '...XXX...',
    '...XXX...',
    '...XXX...',
  ],
  // Contact B: the mirror stride.
  walkC: [
    '...XX....',
    '...XX....',
    '...XX....',
    '...XX....',
    '..XXXXX..',
    '.XXXXXXX.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '.X.XXX.X.',
    '...XXX.X.',
    '..XXXXX..',
    '..XXXXX..',
    '..XX.XX..',
    '.XX...XX.',
    '.XX...XX.',
    'XX.....XX',
    'XX.....XX',
    'XX.....XX',
  ],
};

// Replace the palette key 'X' with 'W' (moonlight) in the maps above — the
// frames are authored with X for legibility.
for (const frames of [PERSON_FRAMES]) {
  for (const key of Object.keys(frames)) {
    frames[key] = frames[key].map((row) => row.replaceAll('X', 'W'));
  }
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
  const seq = [frames.walkA, frames.walkB, frames.walkC ?? frames.walkA, frames.walkB];
  return seq[Math.floor(animTime * WALK_CYCLE_FPS) % seq.length];
}

/** Width/height of a sprite map. */
export function spriteSize(map) {
  return { w: map[0].length, h: map.length };
}
