// The mansion (v0.14): placement in the world, the walk-in interior, its
// beats (portrait, stairs, clock), and the 16-bit art passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE, MANSION_MAP, INTERIOR_W, INTERIOR_H, SPAWN, FURNISH,
  cellAt, mansionCollides, onDoor, nearStairs, nearPortrait, nearClock,
} from '../src/core/mansion.js';
import { regionInfo, regionLandmarks, isWater, REGION, regionHasRiver } from '../src/core/terrain.js';
import { World, generateChunk } from '../src/core/world.js';
import { Game, ABILITIES } from '../src/core/game.js';
import { SCREEN_W } from '../src/core/screen.js';
import {
  MANSION_SPRITE, MANSION_COLORS, mansionAtticLit,
  CLOCK_SPRITE, PORTRAIT_SPRITE, SHELF_SPRITE, TABLE_SPRITE, CHAIR_SPRITE,
  CANDELABRA_SPRITE, CHANDELIER_SPRITE, FURNISH_COLORS, flameColor,
} from '../src/gfx/structures.js';
import { PERSON_FRAMES, DOG_FRAMES, shadeFrames } from '../src/gfx/sprites.js';
import { PALETTE } from '../src/gfx/palette.js';

const STEP = 1 / 60;
const SEED = 77;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** A together game with a mansion planted just east of spawn. */
function mansionGame() {
  const g = new Game(1, { story: false });
  g.world.collides = () => false; // outdoor movement unobstructed
  runSeconds(g, 3.5);
  g.world.chunkAt(0, 0).mansions.push({ x: 60, y: 0 });
  return g;
}

function enter(g) {
  g.person.x = 60;
  g.person.y = 0; // inside the door zone
  g.update(STEP, {});
  return g;
}

// --- The interior map -------------------------------------------------------

test('the interior map is rectangular, walled, exactly one screen wide', () => {
  const w = MANSION_MAP[0].length;
  for (const row of MANSION_MAP) assert.equal(row.length, w, 'rectangular');
  assert.equal(INTERIOR_W, SCREEN_W, 'Maniac Mansion style: one fixed screen');
  assert.ok(INTERIOR_H < 360, 'fits the viewport');
  for (let cx = 0; cx < w; cx++) {
    assert.equal(MANSION_MAP[0][cx], '#', 'top border solid');
    const bottom = MANSION_MAP[MANSION_MAP.length - 1][cx];
    assert.ok(bottom === '#' || bottom === 'D', 'bottom is wall or the door');
  }
  for (const row of MANSION_MAP) {
    assert.equal(row[0], '#');
    assert.equal(row[w - 1], '#');
  }
  assert.ok(MANSION_MAP.some((r) => r.includes('D')), 'there is a way out');
  assert.ok(MANSION_MAP.some((r) => r.includes('L')), 'there is a locked stair');
});

test('walls, stairs, and solid furniture block; floors and the door do not', () => {
  assert.ok(mansionCollides(2, 2, 4, 3), 'the border wall is solid');
  assert.equal(mansionCollides(SPAWN.x, SPAWN.y - 4, 4, 3), false, 'the spawn is open floor');
  assert.ok(mansionCollides(14 * TILE + 4, TILE + 4, 4, 3), 'the stairs are locked');
  const shelf = FURNISH.find((f) => f.kind === 'shelf');
  assert.ok(mansionCollides(shelf.x - 2, shelf.y - 2, 4, 3), 'shelves are solid');
  const rug = FURNISH.find((f) => f.kind === 'rug');
  assert.equal(mansionCollides(rug.x - 2, rug.y - 2, 4, 3), false, 'the rug is walkable');
  assert.ok(onDoor(13 * TILE, 13 * TILE + 4), 'the door mat reads as the door');
  assert.equal(onDoor(SPAWN.x, SPAWN.y), false, 'the spawn is not on the mat');
});

test('solid furnishings stand on open floor, not inside walls', () => {
  for (const f of FURNISH) {
    const c = cellAt(f.x, f.y);
    assert.ok(c === '.' || f.kind === 'portrait', `${f.kind} at (${f.x},${f.y}) on '${c}'`);
  }
});

// --- Placement in the world -------------------------------------------------

test('mansions are rare forest landmarks, never wet, never doubled with cabins', () => {
  let mansions = 0;
  for (let rx = -20; rx <= 20; rx++) {
    for (let ry = -20; ry <= 20; ry++) {
      const info = regionInfo(SEED, rx, ry);
      if (!info.mansion) continue;
      mansions++;
      assert.ok(['oak', 'redwood', 'grass'].includes(info.biome));
      assert.equal(info.cabin, null, 'one landmark per region');
      assert.equal(isWater(SEED, info.mansion.x, info.mansion.y), false);
      assert.ok(info.mansion.x >= rx * REGION && info.mansion.x < (rx + 1) * REGION);
    }
  }
  assert.ok(mansions > 0, 'somewhere, a mansion');
  assert.ok(mansions < 90, `...but rarely (${mansions} in 41x41 regions)`);
  const marks = (() => {
    for (let rx = -20; rx <= 20; rx++) {
      for (let ry = -20; ry <= 20; ry++) {
        if (regionInfo(SEED, rx, ry).mansion) return regionLandmarks(SEED, rx, ry);
      }
    }
    return null;
  })();
  assert.equal(marks.mansion, true, 'the map remembers it');
});

test('the facade blocks movement — except the doorway', () => {
  const w = new World(SEED);
  w.chunkAt(0, 0).mansions.push({ x: 80, y: 40 });
  assert.ok(w.collides(60, 36, 4, 3), 'the west wing is solid');
  assert.ok(w.collides(96, 36, 4, 3), 'the east wing is solid');
  assert.equal(w.collides(78, 38, 4, 3), false, 'the doorway is open');
});

// --- Entering and leaving ---------------------------------------------------

test('stepping into the doorway takes you inside; the door mat leads out', () => {
  const g = enter(mansionGame());
  assert.equal(g.location, 'mansion');
  assert.equal(g.person.x, SPAWN.x);
  assert.equal(g.person.y, SPAWN.y);
  assert.ok(Math.abs(g.dog.x - SPAWN.x) <= 24, 'the dog comes along');
  assert.equal(g.caption.text, 'THE DOOR WAS NOT LOCKED');
  assert.ok(g.captionQueue.includes('IT SHUT ITSELF BEHIND YOU ANYWAY'));

  g.person.x = 13 * TILE;
  g.person.y = 13 * TILE + 4; // onto the mat
  g.update(STEP, {});
  assert.equal(g.location, 'world');
  assert.equal(g.person.y, 10, 'back outside, below the door');
  g.update(STEP, {});
  assert.equal(g.location, 'world', 'no revolving door');
});

test('interior walls actually stop you', () => {
  // 3s at 46px/s would reach x=346 on open ground; the hall's east wall at
  // x=304 must hold the person at ~301 (feet-box edge). The margin proves
  // the wall did the stopping, not the clock.
  const g = enter(mansionGame());
  g.person.x = SPAWN.x;
  g.person.y = SPAWN.y;
  runSeconds(g, 5, { right: true });
  const wall = 19 * TILE; // the hall's east wall
  assert.ok(g.person.x < wall, `the east wall held (x=${g.person.x.toFixed(1)})`);
  assert.ok(g.person.x > wall - 20, 'the person actually reached the wall');
  assert.ok(g.location === 'mansion', 'still inside');
});

test('a second visit gets the shorter greeting', () => {
  const g = enter(mansionGame());
  g.person.x = 13 * TILE;
  g.person.y = 13 * TILE + 4;
  g.update(STEP, {}); // out
  runSeconds(g, 12); // let captions drain
  enter(g);
  assert.equal(g.caption.text, 'THE MANSION AGAIN. IT REMEMBERS YOU');
});

// --- Interior beats ---------------------------------------------------------

test('the portrait opens its menu once, and only once', () => {
  const g = enter(mansionGame());
  const p = FURNISH.find((f) => f.kind === 'portrait');
  g.person.x = p.x;
  g.person.y = 56;
  g.update(STEP, {});
  g.interactNearest(); // v0.21: you notice the portrait, not the reverse
  assert.ok(g.choice, 'the portrait answers');
  assert.equal(g.choice.kind, 'portrait');
  assert.equal(g.choice.title, 'AN OLD PORTRAIT');
  g.resolveChoice('look');
  assert.equal(g.caption.text, 'IT IS NO ONE YOU KNOW');
  assert.ok(g.captionQueue.includes('IT KNOWS YOU, THOUGH'));
  runSeconds(g, 1);
  assert.equal(g.interactNearest(), false, 'seen once is seen forever');
  assert.equal(g.choice, null);
});

test('the lock rusted through: the stairs climb to the second floor and back', () => {
  const g = enter(mansionGame());
  runSeconds(g, 8); // let the entry captions drain (say() queues politely)
  const worldReturn = g.mansionReturn;
  g.person.x = 14 * TILE + 8;
  g.person.y = 3 * TILE;
  g.update(STEP, {});
  assert.equal(g.location, 'mansion2', 'up the stairs');
  assert.equal(g.caption.text, 'THE LOCK HAS RUSTED THROUGH');
  assert.ok(g.captionQueue.includes('THE STAIRS REMEMBER FEET. THEY CREAK ANYWAY'));
  assert.equal(g.mansionReturn, worldReturn, 'the way back outside rides along');
  // Walk onto the stairwell tiles: back down, still inside the mansion.
  g.person.x = 14.5 * 24;
  g.person.y = 1.5 * 24;
  g.update(STEP, {});
  assert.equal(g.location, 'mansion', 'back on the ground floor');
  assert.equal(g.mansionReturn, worldReturn, 'and the exit still leads outside');

  const clock = FURNISH.find((f) => f.kind === 'clock');
  g.person.x = clock.x;
  g.person.y = clock.y + 20;
  g.events.length = 0;
  runSeconds(g, 2.2);
  assert.ok(g.events.includes('clock'), 'tick');
});

test('the stairs zone does not reach the portrait — beats stay separate', () => {
  const p = FURNISH.find((f) => f.kind === 'portrait');
  assert.equal(nearStairs(p.x, 56), false, 'the portrait spot is not "near the stairs"');
  assert.equal(nearStairs(SPAWN.x, 56), false, 'nor is the walk straight up from spawn');
  assert.ok(nearStairs(15 * TILE, 40), 'the stairs themselves are');
});

test('the world stays outside: no encounters, no fetch, no memory refresh', () => {
  const g = enter(mansionGame());
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x, y: g.person.y, phase: 0 });
  // Interior coords alias region (0,0), which is already memorized — so pin
  // the freeze by deleting a key: an indoor memory sweep would restore it.
  g.memory.delete('0,0');
  runSeconds(g, 1.5);
  assert.equal(g.choice, null, 'world zombies cannot follow you in');
  assert.equal(g.memory.has('0,0'), false, 'memory only refreshes under the sky');
  g.update(STEP, { action: true });
  assert.equal(g.ball, null, 'no fetch indoors');
  assert.ok(
    g.caption?.text === 'NOT IN HERE' || g.captionQueue.includes('NOT IN HERE'),
    'the house declines the ball',
  );
});

test('sheet attacks indoors hit only the dark, not aliased world zombies', () => {
  const g = enter(mansionGame());
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x, y: g.person.y, phase: 0 });
  g.update(STEP, { sheet: true });
  g.resolveChoice('str');
  g.resolveChoice('punch');
  assert.equal(g.caption.text, 'YOU PUNCH AT THE DARK. IT DOES NOT MIND');
  assert.equal(g.choice, null, 'no fight menu materialized indoors');
});

test('stepping outside can never land you inside something solid', () => {
  const g = mansionGame();
  enter(g);
  assert.equal(g.location, 'mansion');
  // A hostile lawn: everything above y=30 is suddenly solid — the doorstep
  // included. The exit probe must find the clear ground further out.
  g.world.collides = (x, y) => y < 30;
  g.person.x = 13 * TILE;
  g.person.y = 13 * TILE + 4;
  g.update(STEP, {});
  assert.equal(g.location, 'world');
  const b = {
    x: g.person.x - g.person.feetW / 2,
    y: g.person.y - g.person.feetH,
    w: g.person.feetW,
    h: g.person.feetH,
  };
  assert.equal(g.world.collides(b.x, b.y, b.w, b.h), false, 'the exit spot is clear ground');
});

// --- 16-bit art passes ------------------------------------------------------

test('the mansion facade is rectangular, palette-true, and its attic wakes', () => {
  for (const row of MANSION_SPRITE) {
    assert.equal(row.length, MANSION_SPRITE[0].length, 'rectangular');
    for (const ch of row) assert.ok(ch === '.' || ch in MANSION_COLORS, `'${ch}' known`);
  }
  assert.ok(MANSION_SPRITE.some((r) => r.includes('A')), 'it has its attic window');
  assert.ok(MANSION_SPRITE.some((r) => r.includes('d')), 'it has its door');
  const states = new Set();
  for (let t = 0; t < 30; t += 0.5) states.add(mansionAtticLit(t));
  assert.equal(states.size, 2, 'the attic light comes and goes');
});

test('furnishing sprites are rectangular with known colors', () => {
  for (const sprite of [
    CLOCK_SPRITE, PORTRAIT_SPRITE, SHELF_SPRITE, TABLE_SPRITE,
    CHAIR_SPRITE, CANDELABRA_SPRITE, CHANDELIER_SPRITE,
  ]) {
    for (const row of sprite) {
      assert.equal(row.length, sprite[0].length, 'rectangular');
      for (const ch of row) assert.ok(ch === '.' || ch in FURNISH_COLORS, `'${ch}' known`);
    }
  }
  const flames = new Set();
  for (let t = 0; t < 4; t += 0.1) flames.add(flameColor(t));
  assert.deepEqual([...flames].sort(), [PALETTE.gold, PALETTE.goldRose].sort());
});

test('character shading keeps the silhouette and the cadence', () => {
  const shape = (m) => m.map((r) => r.replace(/[sdr]/g, 'W'));
  const inner = shadeFrames(['WWWWW', 'WWWWW', 'WWWWW', 'WWWWW', 'WWWWW']);
  assert.equal(inner[2][2], 's', 'interior pixels fall into moonshadow');
  assert.equal(inner[2][4], 'W', 'the right edge stays moonlit');
  assert.equal(inner[2][0], 'd', 'the left flank falls to deep smoke');
  assert.equal(inner[0][4], 'r', 'the crown catches a rose-gold rim');
  let shaded = 0;
  for (const frames of [PERSON_FRAMES, DOG_FRAMES]) {
    for (const map of Object.values(frames)) {
      for (const row of map) {
        assert.match(row, /^[.Wsdr]+$/, 'moonlight, moonshadow, deep smoke, rose rim, air');
        shaded += (row.match(/[sdr]/g) ?? []).length;
      }
      assert.deepEqual(shape(shadeFrames(shape(map))), shape(map), 'shading is shape-stable');
    }
  }
  assert.ok(shaded > 20, `the pair carry real shading (${shaded} px)`);
});

test('the door shuts the fight outside — no turn-based mode indoors', () => {
  // Regression: the interior loop returns before checkBattle, so a fight you
  // walked in on would keep the mode frame and the step budget forever.
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  g.world.chunkAt(0, 0).mansions.push({ x: 60, y: 0 });
  g.world.chunkAt(0, 0).zombies.push({ x: -10, y: -20, phase: 0 });
  g.person.x = 0; // out on the lawn, clear of the doorway
  g.person.y = 0;
  runSeconds(g, 0.4); // the battle check notices the zombie
  assert.equal(g.mode, 'turn', 'engaged on the lawn');
  g.person.x = 60;
  g.person.y = 0;
  g.update(1 / 60, {});
  assert.equal(g.location, 'mansion');
  assert.equal(g.mode, 'free', 'the fight stays on the lawn');
  assert.deepEqual(g.battleFoes, []);
  runSeconds(g, 1);
  assert.equal(g.mode, 'free', 'and does not follow you in');
});
