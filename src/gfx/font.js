// Bold pixel font for the retro captions, copied from the reference footage:
// 8px tall, 2px-thick vertical stems, rounded corners, variable width
// (a narrow 'I', like the classic 8-bit faces). Pure data + geometry here;
// the renderer rasterizes.

export const GLYPH_H = 8;
export const TRACKING = 2; // px between glyphs
export const SPACE_W = 4; // width of the space "glyph"
export const LINE_GAP = 2; // px between wrapped caption lines

export const GLYPHS = {
  A: [
    '.XXXXX.',
    'XX...XX',
    'XX...XX',
    'XXXXXXX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
  ],
  B: [
    'XXXXXX.',
    'XX...XX',
    'XX...XX',
    'XXXXXX.',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XXXXXX.',
  ],
  C: [
    '.XXXXX.',
    'XX...XX',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX...XX',
    '.XXXXX.',
  ],
  D: [
    'XXXXXX.',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XXXXXX.',
  ],
  E: [
    'XXXXXXX',
    'XX.....',
    'XX.....',
    'XXXXXX.',
    'XX.....',
    'XX.....',
    'XX.....',
    'XXXXXXX',
  ],
  F: [
    'XXXXXXX',
    'XX.....',
    'XX.....',
    'XXXXXX.',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
  ],
  G: [
    '.XXXXX.',
    'XX...XX',
    'XX.....',
    'XX.....',
    'XX..XXX',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
  ],
  H: [
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XXXXXXX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
  ],
  I: [
    'XX',
    'XX',
    'XX',
    'XX',
    'XX',
    'XX',
    'XX',
    'XX',
  ],
  J: [
    '....XX',
    '....XX',
    '....XX',
    '....XX',
    '....XX',
    'XX..XX',
    'XX..XX',
    '.XXXX.',
  ],
  K: [
    'XX...XX',
    'XX..XX.',
    'XX.XX..',
    'XXXX...',
    'XX.XX..',
    'XX..XX.',
    'XX...XX',
    'XX...XX',
  ],
  L: [
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
    'XXXXXXX',
  ],
  M: [
    'XX....XX',
    'XXX..XXX',
    'XXXXXXXX',
    'XX.XX.XX',
    'XX....XX',
    'XX....XX',
    'XX....XX',
    'XX....XX',
  ],
  N: [
    'XX...XX',
    'XXX..XX',
    'XXXX.XX',
    'XX.XXXX',
    'XX..XXX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
  ],
  O: [
    '.XXXXX.',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
  ],
  P: [
    'XXXXXX.',
    'XX...XX',
    'XX...XX',
    'XXXXXX.',
    'XX.....',
    'XX.....',
    'XX.....',
    'XX.....',
  ],
  Q: [
    '.XXXXX.',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX.X.XX',
    'XX..XX.',
    '.XXX.XX',
  ],
  R: [
    'XXXXXX.',
    'XX...XX',
    'XX...XX',
    'XXXXXX.',
    'XX.XX..',
    'XX..XX.',
    'XX...XX',
    'XX...XX',
  ],
  S: [
    '.XXXXXX',
    'XX.....',
    'XX.....',
    '.XXXXX.',
    '.....XX',
    '.....XX',
    '.....XX',
    'XXXXXX.',
  ],
  T: [
    'XXXXXX',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
  ],
  U: [
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
  ],
  V: [
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    '.XX.XX.',
    '.XX.XX.',
    '..XXX..',
  ],
  W: [
    'XX....XX',
    'XX....XX',
    'XX....XX',
    'XX.XX.XX',
    'XX.XX.XX',
    'XXXXXXXX',
    'XXX..XXX',
    'XX....XX',
  ],
  X: [
    'XX...XX',
    'XX...XX',
    '.XX.XX.',
    '..XXX..',
    '..XXX..',
    '.XX.XX.',
    'XX...XX',
    'XX...XX',
  ],
  Y: [
    'XX..XX',
    'XX..XX',
    'XX..XX',
    '.XXXX.',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
  ],
  Z: [
    'XXXXXXX',
    '.....XX',
    '....XX.',
    '...XX..',
    '..XX...',
    '.XX....',
    'XX.....',
    'XXXXXXX',
  ],
  0: [
    '.XXXXX.',
    'XX...XX',
    'XX..XXX',
    'XX.X.XX',
    'XXX..XX',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
  ],
  1: [
    '..XX..',
    '.XXX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    '..XX..',
    'XXXXXX',
  ],
  2: [
    '.XXXXX.',
    'XX...XX',
    '.....XX',
    '....XX.',
    '...XX..',
    '..XX...',
    'XX.....',
    'XXXXXXX',
  ],
  3: [
    'XXXXXX.',
    '.....XX',
    '.....XX',
    '..XXXX.',
    '.....XX',
    '.....XX',
    'XX...XX',
    '.XXXXX.',
  ],
  4: [
    '...XXX.',
    '..XXXX.',
    '.XX.XX.',
    'XX..XX.',
    'XXXXXXX',
    '....XX.',
    '....XX.',
    '....XX.',
  ],
  5: [
    'XXXXXXX',
    'XX.....',
    'XX.....',
    'XXXXXX.',
    '.....XX',
    '.....XX',
    'XX...XX',
    '.XXXXX.',
  ],
  6: [
    '.XXXXX.',
    'XX.....',
    'XX.....',
    'XXXXXX.',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
  ],
  7: [
    'XXXXXXX',
    '.....XX',
    '....XX.',
    '...XX..',
    '..XX...',
    '..XX...',
    '..XX...',
    '..XX...',
  ],
  8: [
    '.XXXXX.',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
    'XX...XX',
    'XX...XX',
    'XX...XX',
    '.XXXXX.',
  ],
  9: [
    '.XXXXX.',
    'XX...XX',
    'XX...XX',
    '.XXXXXX',
    '.....XX',
    '.....XX',
    '.....XX',
    '.XXXXX.',
  ],
  '!': [
    'XX',
    'XX',
    'XX',
    'XX',
    'XX',
    'XX',
    '..',
    'XX',
  ],
  '.': [
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'XX',
    'XX',
  ],
  ',': [
    '..',
    '..',
    '..',
    '..',
    '..',
    'XX',
    'XX',
    'X.',
  ],
  "'": [
    'XX',
    'XX',
    'X.',
    '..',
    '..',
    '..',
    '..',
    '..',
  ],
  '?': [
    '.XXXXX.',
    'XX...XX',
    '.....XX',
    '....XX.',
    '...XX..',
    '...XX..',
    '.......',
    '...XX..',
  ],
  '-': [
    '.....',
    '.....',
    '.....',
    'XXXXX',
    'XXXXX',
    '.....',
    '.....',
    '.....',
  ],
  '+': [
    '......',
    '..XX..',
    '..XX..',
    'XXXXXX',
    'XXXXXX',
    '..XX..',
    '..XX..',
    '......',
  ],
  '(': [
    '.XX',
    'XX.',
    'XX.',
    'XX.',
    'XX.',
    'XX.',
    'XX.',
    '.XX',
  ],
  ')': [
    'XX.',
    '.XX',
    '.XX',
    '.XX',
    '.XX',
    '.XX',
    '.XX',
    'XX.',
  ],
  ':': [
    '..',
    '..',
    'XX',
    'XX',
    '..',
    'XX',
    'XX',
    '..',
  ],
};

/** Width of one glyph (variable-width font). Space and unknowns get SPACE_W. */
export function glyphWidth(ch) {
  const glyph = GLYPHS[ch];
  return glyph ? glyph[0].length : SPACE_W;
}

/** Pixel width of a string at scale 1 (glyphs + tracking, no trailing gap). */
export function measureText(text) {
  const up = text.toUpperCase();
  if (up.length === 0) return 0;
  let w = 0;
  for (const ch of up) w += glyphWidth(ch) + TRACKING;
  return w - TRACKING;
}

/**
 * The lit pixels of a string as [{x, y}] offsets from the text's top-left.
 * Case-insensitive; characters without a glyph advance like a space.
 */
export function textPixels(text) {
  const out = [];
  let cx = 0;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (let y = 0; y < GLYPH_H; y++) {
        const row = glyph[y];
        for (let x = 0; x < row.length; x++) {
          if (row[x] === 'X') out.push({ x: cx + x, y });
        }
      }
    }
    cx += glyphWidth(ch) + TRACKING;
  }
  return out;
}

/** Greedy word-wrap: split text into lines no wider than maxWidth px. */
export function wrapText(text, maxWidth) {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (line.length > 0 && measureText(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}
