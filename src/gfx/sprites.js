// Pixel sprites as string maps — one character per pixel, '.' transparent.
// Keys into SPRITE_COLORS (see palette.js). Person and dog are plain white
// silhouettes like the reference footage; the dog is authored facing right
// and flipped at draw time.

export const PERSON_FRAMES = {
  // Legs slightly apart — the resting pose.
  stand: [
    '..WW..',
    '..WW..',
    '..WW..',
    '.WWWW.',
    '.WWWW.',
    '.WWWW.',
    '.WWWW.',
    '.W..W.',
    '.W..W.',
    '.W..W.',
    '.W..W.',
    '.W..W.',
  ],
  // Stride: legs swing wide.
  walkA: [
    '..WW..',
    '..WW..',
    '..WW..',
    '.WWWW.',
    '.WWWW.',
    '.WWWW.',
    '.WWWW.',
    '.W..W.',
    '.W..W.',
    '.W..W.',
    'W....W',
    'W....W',
  ],
  // Pass: legs together.
  walkB: [
    '..WW..',
    '..WW..',
    '..WW..',
    '.WWWW.',
    '.WWWW.',
    '.WWWW.',
    '.WWWW.',
    '..WW..',
    '..WW..',
    '..WW..',
    '..WW..',
    '..WW..',
  ],
};

export const DOG_FRAMES = {
  // Standing, tail up, facing right.
  stand: [
    '..........W.',
    'W........WW.',
    '.W.......WWW',
    '..WWWWWWWWW.',
    '..WWWWWWWW..',
    '..W.....W...',
    '..W.....W...',
    '..W.....W...',
  ],
  // Trot: legs split fore/aft.
  walkA: [
    '..........W.',
    'W........WW.',
    '.W.......WWW',
    '..WWWWWWWWW.',
    '..WWWWWWWW..',
    '.W.......W..',
    '.W........W.',
    'W.........W.',
  ],
  // Trot: legs gathered.
  walkB: [
    '..........W.',
    'W........WW.',
    '.W.......WWW',
    '..WWWWWWWWW.',
    '..WWWWWWWW..',
    '...W...W....',
    '...W...W....',
    '...W...W....',
  ],
};

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

/** Walk cycle: pick a frame set's frame from an animation clock. */
export function walkFrame(frames, walking, animTime) {
  if (!walking) return frames.stand;
  const seq = [frames.walkA, frames.stand, frames.walkB, frames.stand];
  return seq[Math.floor(animTime * 8) % seq.length];
}

/** Width/height of a sprite map. */
export function spriteSize(map) {
  return { w: map[0].length, h: map.length };
}
