// Walkable interiors (v0.20) — one registry for every roofed place.
//
// The mansion's ground floor started it (mansion.js, kept intact for its
// tests and its history); this module generalizes the idea: each interior is
// a tile map ('#' wall, '.' floor, 'D' the way out, 'S' stairs, plus
// per-kind specials), a spawn point, furnishings with optional collision
// boxes, and named SPOTS — proximity triggers the game turns into menus.
// Pure data + collision, no DOM, no gfx imports.

import {
  TILE as MANSION_TILE, MANSION_MAP, FURNISH as MANSION_FURNISH,
  SPAWN as MANSION_SPAWN, mansionCollides,
} from './mansion.js';

export const TILE = 24;

// --- The mansion, upstairs (v0.20: the lock rusted through) -----------------
// Same 26-wide footprint as downstairs. 'S' is the stairwell back down —
// landing on it descends. A moonlit window band runs the north wall of the
// bedroom (west) and the study (east).
export const MANSION2_MAP = [
  '####################',
  '#.W..W.#..SS#..W.W.#',
  '#......#..SS#......#',
  '#......#....#......#',
  '#..................#',
  '#......#....#......#',
  '#......#....#......#',
  '#......#....#......#',
  '#......#....#......#',
  '####################',
];

export const MANSION2_FURNISH = [
  { kind: 'bed', x: 60, y: 66, solid: true, w: 30, h: 10 },
  { kind: 'nightstand', x: 108, y: 60, solid: true, w: 10, h: 6 },
  { kind: 'telescope', x: 396, y: 54, solid: true, w: 12, h: 6 },
  { kind: 'desk2', x: 384, y: 156, solid: true, w: 24, h: 8 },
  { kind: 'portrait2', x: 228, y: 100, solid: false },
  { kind: 'rug', x: 240, y: 150, solid: false },
];

// --- The cathedral nave (heaven) --------------------------------------------
// One long room of gold: altar at the north, pews in ranks, the pile of god
// growing in the northeast corner, singers along the west wall who never
// stop handing each other the melody.
export const CATHEDRAL_MAP = [
  '##################',
  '#................#',
  '#................#',
  '#................#',
  '#................#',
  '#................#',
  '#................#',
  '#................#',
  '#................#',
  '########DD########',
];

export const CATHEDRAL_FURNISH = [
  { kind: 'altar', x: 216, y: 66, solid: true, w: 22, h: 8 },
  { kind: 'pile', x: 360, y: 72, solid: true, w: 26, h: 9 },
  { kind: 'brazier', x: 150, y: 60, solid: true, w: 8, h: 5 },
  { kind: 'brazier', x: 282, y: 60, solid: true, w: 8, h: 5 },
  { kind: 'pew', x: 150, y: 126, solid: true, w: 28, h: 6 },
  { kind: 'pew', x: 288, y: 126, solid: true, w: 28, h: 6 },
  { kind: 'pew', x: 150, y: 162, solid: true, w: 28, h: 6 },
  { kind: 'pew', x: 288, y: 162, solid: true, w: 28, h: 6 },
  { kind: 'singer', x: 48, y: 96, solid: true, w: 10, h: 5 },
  { kind: 'singer', x: 42, y: 138, solid: true, w: 10, h: 5 },
  { kind: 'singer', x: 51, y: 180, solid: true, w: 10, h: 5 },
];

// --- The cabin (night) ------------------------------------------------------
// One room. A stove, a cot, a table, a lantern — and an axe on the wall
// pegs, which is exactly the kind of thing a person building a boat in
// another world entirely might want.
export const CABIN_MAP = [
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '####DD####',
];

export const CABIN_FURNISH = [
  { kind: 'stove', x: 40, y: 52, solid: true, w: 14, h: 7 },
  { kind: 'wallaxe', x: 120, y: 42, solid: false },
  { kind: 'cot', x: 190, y: 64, solid: true, w: 26, h: 8 },
  { kind: 'table_small', x: 110, y: 104, solid: true, w: 16, h: 6 },
  { kind: 'lantern', x: 160, y: 100, solid: true, w: 6, h: 4 },
];

// --- The bail-bonds office (night, ghost-town outskirts) --------------------
// The detective works out of here: a desk under a brass lamp, a wall of
// files, and a corkboard where red strings chase a suspect who is extremely
// the Devil.
export const OFFICE_MAP = [
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#####DD#####',
];

export const OFFICE_FURNISH = [
  { kind: 'corkboard', x: 144, y: 42, solid: false },
  { kind: 'filecabinet', x: 44, y: 48, solid: true, w: 12, h: 6 },
  { kind: 'desk', x: 140, y: 96, solid: true, w: 26, h: 8 },
  { kind: 'coatrack', x: 240, y: 52, solid: true, w: 8, h: 5 },
  { kind: 'doorsign', x: 216, y: 150, solid: false },
];

// --- Queue Town's shops (v0.21) ---------------------------------------------
// Two tight rooms. Cortie's smells of oil and whetstone; Queebee's of ink
// and a century of paper.
export const SHOP_MAP = [
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#####DD#####',
];

export const CORTIE_FURNISH = [
  { kind: 'counter', x: 144, y: 72, solid: true, w: 28, h: 8 },
  { kind: 'weaponrack', x: 52, y: 46, solid: true, w: 24, h: 8 },
  { kind: 'wandcase', x: 232, y: 50, solid: true, w: 18, h: 6 },
];

export const QUEEBEE_FURNISH = [
  { kind: 'counter', x: 144, y: 72, solid: true, w: 28, h: 8 },
  { kind: 'bookshelf', x: 48, y: 46, solid: true, w: 22, h: 8 },
  { kind: 'scrollrack', x: 236, y: 48, solid: true, w: 20, h: 7 },
  { kind: 'inkdesk', x: 236, y: 118, solid: true, w: 24, h: 7 },
];

// --- The registry -----------------------------------------------------------
// spots: named proximity triggers the game turns into menus/beats.
// { id, x, y, r } — id keys game.updateInterior's switch.
export const INTERIORS = {
  mansion: {
    tile: MANSION_TILE,
    map: MANSION_MAP,
    furnish: MANSION_FURNISH,
    spawn: MANSION_SPAWN,
    style: 'mansion',
    spots: [], // the mansion keeps its bespoke beats (portrait, stairs, clock, tv)
  },
  mansion2: {
    tile: TILE,
    map: MANSION2_MAP,
    furnish: MANSION2_FURNISH,
    spawn: { x: 10 * TILE, y: 3 * TILE + 6 }, // beside the stairwell
    style: 'mansion',
    spots: [
      { id: 'telescope', x: 396, y: 66, r: 36 },
      { id: 'portrait2', x: 228, y: 120, r: 32 },
      { id: 'bed', x: 66, y: 72, r: 32 },
    ],
  },
  cathedral: {
    tile: TILE,
    map: CATHEDRAL_MAP,
    furnish: CATHEDRAL_FURNISH,
    spawn: { x: 9 * TILE, y: 9 * TILE - 18 },
    style: 'cathedral',
    spots: [
      { id: 'altar', x: 216, y: 78, r: 40 },
      { id: 'pile', x: 360, y: 84, r: 40 },
      { id: 'singer', x: 48, y: 138, r: 44 },
    ],
  },
  cabin: {
    tile: TILE,
    map: CABIN_MAP,
    furnish: CABIN_FURNISH,
    spawn: { x: 5 * TILE, y: 6 * TILE - 18 },
    style: 'cabin',
    spots: [
      { id: 'wallaxe', x: 120, y: 54, r: 32 },
      { id: 'stove', x: 40, y: 62, r: 30 },
    ],
  },
  office: {
    tile: TILE,
    map: OFFICE_MAP,
    furnish: OFFICE_FURNISH,
    spawn: { x: 6 * TILE, y: 7 * TILE - 18 },
    style: 'office',
    spots: [
      { id: 'detective', x: 144, y: 108, r: 40 },
      { id: 'corkboard', x: 144, y: 56, r: 32 },
    ],
  },
  cortie: {
    tile: TILE,
    map: SHOP_MAP,
    furnish: CORTIE_FURNISH,
    spawn: { x: 6 * TILE, y: 6 * TILE - 18 },
    style: 'shop',
    spots: [
      { id: 'cortie-counter', x: 144, y: 84, r: 40 },
      { id: 'weaponrack', x: 52, y: 58, r: 30 },
      { id: 'wandcase', x: 232, y: 62, r: 30 },
    ],
  },
  queebee: {
    tile: TILE,
    map: SHOP_MAP,
    furnish: QUEEBEE_FURNISH,
    spawn: { x: 6 * TILE, y: 6 * TILE - 18 },
    style: 'shop',
    spots: [
      { id: 'queebee-counter', x: 144, y: 84, r: 40 },
      { id: 'bookshelf', x: 48, y: 58, r: 30 },
      { id: 'scrollrack', x: 236, y: 60, r: 30 },
      { id: 'inkdesk', x: 236, y: 128, r: 30 },
    ],
  },
};

export const INTERIOR_KINDS = Object.keys(INTERIORS);

/** Pixel dimensions of an interior. */
export function interiorSize(kind) {
  const spec = INTERIORS[kind];
  return { w: spec.map[0].length * spec.tile, h: spec.map.length * spec.tile };
}

/** The map character at an interior pixel ('#' outside the grid). */
export function interiorCellAt(kind, x, y) {
  const spec = INTERIORS[kind];
  const cx = Math.floor(x / spec.tile);
  const cy = Math.floor(y / spec.tile);
  if (cy < 0 || cy >= spec.map.length || cx < 0 || cx >= spec.map[0].length) return '#';
  return spec.map[cy][cx];
}

/** Feet-box collision inside an interior: walls plus solid furnishings. */
export function interiorCollides(kind, x, y, w, h) {
  if (kind === 'mansion') return mansionCollides(x, y, w, h); // bespoke (locked stairs history)
  for (const [px, py] of [
    [x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2],
  ]) {
    if (interiorCellAt(kind, px, py) === '#') return true;
  }
  for (const f of INTERIORS[kind].furnish) {
    if (!f.solid) continue;
    const half = f.w / 2;
    if (x < f.x + half && x + w > f.x - half && y < f.y + 1 && y + h > f.y - f.h) return true;
  }
  return false;
}

/** Standing on the way out ('D'), or on the stairs ('S')? */
export function interiorOnDoor(kind, x, y) {
  return interiorCellAt(kind, x, y) === 'D';
}
export function interiorOnStairs(kind, x, y) {
  return interiorCellAt(kind, x, y) === 'S';
}
