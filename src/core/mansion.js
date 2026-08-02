// The mansion interior — one floor, three rooms, one locked staircase.
//
// Pure data + collision, no DOM: a 26x14 grid of 16px cells that happens to
// be exactly one screen wide (416px), Maniac-Mansion style. '#' walls, '.'
// floor, 'D' the front door (walk onto it to leave), 'L' the staircase
// (solid; locked; nobody locks stairs, and yet). Furnishings are placed in
// interior world-pixels (base-center anchors) and the solid ones carry their
// own little boxes.

export const TILE = 24;

export const MANSION_MAP = [
  '##########################',
  '#.......#.....LL...#.....#',
  '#.......#.....LL...#.....#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '#........................#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '#.......#..........#.....#',
  '############DD############',
];

export const INTERIOR_W = MANSION_MAP[0].length * TILE; // 416 — one screen
export const INTERIOR_H = MANSION_MAP.length * TILE; // 224

// Where you stand when the door shuts itself behind you.
export const SPAWN = { x: 13 * TILE, y: INTERIOR_H - TILE - 6 };

// Furnishings: the library (left), the grand hall (center), the parlor
// (right). solid: true carries a base collision box {w, h}.
export const FURNISH = [
  { kind: 'shelf', x: 84, y: 51, solid: true, w: 24, h: 8 },
  { kind: 'shelf', x: 156, y: 51, solid: true, w: 24, h: 8 },
  { kind: 'candelabra', x: 108, y: 195, solid: true, w: 8, h: 5 },
  { kind: 'clock', x: 432, y: 54, solid: true, w: 12, h: 6 },
  { kind: 'portrait', x: 300, y: 45, solid: false },
  { kind: 'rug', x: 336, y: 225, solid: false },
  { kind: 'chandelier', x: 336, y: 144, solid: false },
  { kind: 'table', x: 540, y: 180, solid: true, w: 27, h: 9 },
  { kind: 'chair', x: 510, y: 183, solid: true, w: 11, h: 6 },
  { kind: 'candelabra', x: 570, y: 90, solid: true, w: 8, h: 5 },
];

/** The map character at an interior world-pixel ('#' outside the grid). */
export function cellAt(x, y) {
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  if (cy < 0 || cy >= MANSION_MAP.length || cx < 0 || cx >= MANSION_MAP[0].length) return '#';
  return MANSION_MAP[cy][cx];
}

/** Feet-box collision against walls, the locked stairs, and solid furniture. */
export function mansionCollides(x, y, w, h) {
  for (const [px, py] of [
    [x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2],
  ]) {
    const c = cellAt(px, py);
    if (c === '#' || c === 'L') return true;
  }
  for (const f of FURNISH) {
    if (!f.solid) continue;
    const half = f.w / 2;
    if (x < f.x + half && x + w > f.x - half && y < f.y + 1 && y + h > f.y - f.h) return true;
  }
  return false;
}

/**
 * Is this interior point on the front-door mat? Strictly the mat itself —
 * the spawn tile sits one cell above it, and matching that too would spin
 * arrivals straight back out the door.
 */
export function onDoor(x, y) {
  return cellAt(x, y) === 'D';
}

/**
 * Near the locked staircase? The band hugs the actual stair cells (cx 14-15)
 * so it cannot fire from the portrait's spot two tiles west.
 */
export function nearStairs(x, y) {
  return x > 14 * TILE - 6 && x < 16 * TILE + 6 && y < 4 * TILE;
}

/** Near the portrait? (It notices before you do.) */
export function nearPortrait(x, y) {
  const p = FURNISH.find((f) => f.kind === 'portrait');
  return Math.abs(x - p.x) < 33 && y < p.y + 51;
}

/** Near the grandfather clock? (You can hear it from here.) */
export function nearClock(x, y) {
  const c = FURNISH.find((f) => f.kind === 'clock');
  return Math.abs(x - c.x) < 60 && Math.abs(y - c.y) < 72;
}
