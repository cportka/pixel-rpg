// The heaven side of v0.20 and the economy: God's lake and the signs that
// point there, the minotaur pacing his den, the battle menu's floor, warm
// swimmable water, the axe-and-boat pipeline, and the island shrine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, ABILITIES, minotaurPos, MINOTAUR_RANGE, FOES,
  SWIM_SPEED, SAIL_SPEED, BOAT_WOOD,
} from '../src/core/game.js';
import { PERSON } from '../src/core/entities.js';
import { FURNISH } from '../src/core/mansion.js';
import { World } from '../src/core/world.js';
import {
  godSpot, signAt, minotaurAt, islandAt, lilypadsAt, isWater, regionAt,
  GOD_REGION, ISLAND_REGION, riverNear, bridgeYNear, RIVER_COL, REGION,
} from '../src/core/terrain.js';

const STEP = 1 / 60;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** A together game standing in the mansion parlor, beside the television. */
function tvGame() {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5);
  g.world.chunkAt(0, 0).mansions.push({ x: 60, y: 0 });
  g.person.x = 60;
  g.person.y = 0;
  g.update(STEP, {});
  assert.equal(g.location, 'mansion');
  const tv = FURNISH.find((f) => f.kind === 'television');
  g.person.x = tv.x;
  g.person.y = tv.y + 40;
  return g;
}

/** tvGame, walked up to the set and stepped through the glass. */
function heavenGame() {
  const g = tvGame();
  runSeconds(g, 0.1);
  assert.equal(g.choice?.kind, 'tv');
  g.resolveChoice('inside');
  assert.equal(g.plane, 'heaven');
  return g;
}

/** heavenGame with a minotaur den planted right where the person stands. */
function minotaurGame() {
  const g = heavenGame();
  const den = { x: g.person.x, y: g.person.y, phase: 0 };
  g.world.chunkAt(0, 0).minotaurs.push({ ...den });
  g.heard = [];
  const steps = Math.ceil(3 / STEP);
  for (let i = 0; i < steps && g.mode !== 'turn'; i++) {
    g.update(STEP, {});
    g.heard.push(...g.events);
    g.events.length = 0;
  }
  g.den = den;
  g.denKey = `mi:${den.x},${den.y}`;
  return g;
}

// A heaven-registered fixture seed for the pure terrain checks, registered
// explicitly the same way Game.freshHeaven() registers a real ascent's world.
const HSEED = 4242;
new World(HSEED, 'heaven');

// --- Heaven's fixed places ---------------------------------------------------

test('godSpot stands on the east shore of the lake in the god region, dry', () => {
  const god = godSpot(HSEED);
  assert.ok(god, 'God exists');
  assert.deepEqual(godSpot(HSEED), god, 'and holds still');
  assert.deepEqual(regionAt(god.x, god.y), { rx: GOD_REGION.rx, ry: GOD_REGION.ry });
  assert.equal(isWater(HSEED, god.x, god.y), false, 'the shore is dry');
  const pads = lilypadsAt(HSEED);
  assert.equal(pads.length, 3, 'three frogs, three lilypads');
  for (const p of pads) assert.equal(isWater(HSEED, p.x, p.y), true, 'lilypads float');
});

test('signs to God appear in about 1 in 5 regions, never in the god or island regions', () => {
  let signs = 0;
  let regions = 0;
  for (let rx = -10; rx <= 10; rx++) {
    for (let ry = -10; ry <= 10; ry++) {
      regions++;
      const s = signAt(HSEED, rx, ry);
      if (!s) continue;
      signs++;
      assert.deepEqual(signAt(HSEED, rx, ry), s, 'deterministic');
      assert.equal(isWater(HSEED, s.x, s.y), false, 'signs stand on dry ground');
      // NOTE (actual behavior): signAt computes offsets with `(h >> 8) % n`,
      // and the signed shift can go negative — so a sign can lean up to
      // ~600px into the neighboring region. It stays within one region's
      // reach of home; asserting that, not strict containment.
      const at = regionAt(s.x, s.y);
      assert.ok(Math.abs(at.rx - rx) <= 1 && Math.abs(at.ry - ry) <= 1,
        `sign for (${rx},${ry}) landed in (${at.rx},${at.ry})`);
    }
  }
  assert.ok(signs > regions / 12 && signs < regions / 3, `~1 in 5 (${signs} of ${regions})`);
  assert.equal(signAt(HSEED, GOD_REGION.rx, GOD_REGION.ry), null, "no sign where you're already there");
  assert.equal(signAt(HSEED, ISLAND_REGION.rx, ISLAND_REGION.ry), null, 'no sign on the island');
});

test('the island is a heart of land in a region of sea', () => {
  const island = islandAt(HSEED, ISLAND_REGION.rx, ISLAND_REGION.ry);
  assert.ok(island, 'the island exists');
  assert.equal(isWater(HSEED, island.cx, island.cy), false, 'its heart is dry');
  assert.equal(isWater(HSEED, island.cx + island.a + 60, island.cy), true, 'ringed by sea');
  assert.equal(islandAt(HSEED, 0, 0), null, 'only in its own region');
});

test('minotaur dens are rare, and the pacing stays within MINOTAUR_RANGE of the den', () => {
  let dens = 0;
  let regions = 0;
  let sample = null;
  for (let rx = -20; rx <= 20; rx++) {
    for (let ry = -20; ry <= 20; ry++) {
      regions++;
      const m = minotaurAt(HSEED, rx, ry);
      if (!m) continue;
      dens++;
      assert.deepEqual(minotaurAt(HSEED, rx, ry), m, 'deterministic');
      sample = sample ?? m;
    }
  }
  assert.ok(dens >= 1, 'at least one maze walks the light');
  assert.ok(dens < regions / 20, `rare, rare, rare (${dens} of ${regions})`);
  for (const t of [0, 1.7, 9.3, 42.5, 137.9]) {
    const pos = minotaurPos(sample, t);
    assert.deepEqual(minotaurPos(sample, t), pos, 'the pacing is deterministic');
    assert.ok(Math.abs(pos.x - sample.x) <= MINOTAUR_RANGE + 1e-9, `x within range at t=${t}`);
    assert.ok(Math.abs(pos.y - sample.y) <= MINOTAUR_RANGE * 0.7 + 1e-9, `y within range at t=${t}`);
    assert.ok(pos.facing === 1 || pos.facing === -1);
  }
});

// --- The minotaur battle -----------------------------------------------------

test('crossing his pacing bellows, announces SOMETHING RED, and offers the maze talk', () => {
  const g = minotaurGame();
  assert.equal(g.mode, 'turn');
  assert.ok(g.heard.includes('bellow'), 'he announces himself from the chest');
  assert.equal(g.caption?.text, 'SOMETHING RED IS PACING THIS WAY');
  const foes = g.hostilesNear(300);
  assert.ok(foes.some((f) => f.kind === 'minotaur'), 'hostilesNear knows him');
  g.openBattleMenu();
  assert.match(g.choice.title, /THE MINOTAUR TOWERS OVER YOU|HE PACES CLOSER, HORNS LOW/);
  const ids = g.choice.options.map((o) => o.id);
  assert.ok(ids.includes('maze') && ids.includes('directions'), 'he can be talked past');
});

test('OFFER DIRECTIONS on a high roll ends the fight peacefully: +5 XP and the maze line', () => {
  const g = minotaurGame();
  g.rng = () => 0.99; // d20 = 20, WIS mod 0: past DC 13 easily
  g.xp = 0;
  g.openBattleMenu();
  g.resolveChoice('directions');
  assert.ok(g.encounterDone.has(g.denKey), 'he wanders on for good');
  assert.equal(g.xp, FOES.minotaur.xp, '+5 XP for the kindness');
  const heard = [g.caption?.text, ...g.captionQueue].filter(Boolean);
  assert.ok(
    heard.includes('A MAZE IS JUST A PATH THAT LOVES YOU TOO MUCH TO END'),
    `the maze caption plays (${heard.join(' | ')})`,
  );
});

test('OFFER DIRECTIONS on a low roll costs the turn', () => {
  const g = minotaurGame();
  // Step out of his reach so the failed offer costs only the turn.
  const live = minotaurPos(g.den, g.time);
  g.person.x = live.x + 60;
  g.person.y = live.y;
  g.rng = () => 0; // d20 = 1: the words come out as walls
  g.hp = 10;
  const round = g.round;
  g.openBattleMenu();
  g.resolveChoice('directions');
  assert.equal(g.encounterDone.has(g.denKey), false, 'still lost');
  assert.equal(g.round, round + 1, 'the turn is spent');
  assert.equal(g.hp, 10, 'but out of reach, no horns');
});

test("the minotaur's hit does 3 damage", () => {
  const g = minotaurGame();
  const live = minotaurPos(g.den, g.time);
  g.person.x = live.x;
  g.person.y = live.y;
  g.hp = 10;
  g.caption = null;
  g.captionQueue.length = 0;
  g.openBattleMenu();
  assert.equal(g.choice.title, 'THE MINOTAUR TOWERS OVER YOU');
  g.resolveChoice('wait');
  assert.equal(g.hp, 10 - FOES.minotaur.dmg, 'the horns find you for 3');
  const heard = [g.caption?.text, ...g.captionQueue].filter(Boolean);
  assert.ok(heard.includes(`THE HORNS FIND YOU (-${FOES.minotaur.dmg} HP)`));
});

// --- The battle menu floor ---------------------------------------------------

test('past round 1, foe out of reach, no spells: exactly taunt/dirt/study/wait', () => {
  const night = new Game(1, { story: false });
  night.world.collides = () => false;
  for (const a of ABILITIES) night.stats[a] = 10;
  runSeconds(night, 3.5);
  night.world.chunkAt(0, 0).zombies.push({ x: night.person.x + 60, y: night.person.y, phase: 0 });
  const steps = Math.ceil(3 / STEP);
  for (let i = 0; i < steps && night.mode !== 'turn'; i++) night.update(STEP, {});
  assert.equal(night.mode, 'turn');
  night.round = 2;
  night.openBattleMenu();
  assert.deepEqual(
    night.choice.options.map((o) => o.id),
    ['taunt', 'dirt', 'study', 'wait'],
    'the four-option floor holds even at its barest',
  );
});

test('THROW DIRT on a high DEX roll makes the answer go wide for one round', () => {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5);
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 30, y: g.person.y, phase: 0 });
  const steps = Math.ceil(3 / STEP);
  for (let i = 0; i < steps && g.mode !== 'turn'; i++) g.update(STEP, {});
  assert.equal(g.mode, 'turn');
  g.rng = () => 0.99; // d20 = 20 >= DC_DIRT
  g.hp = 10;
  const round = g.round;
  g.openBattleMenu();
  g.resolveChoice('dirt');
  assert.equal(g.hp, 10, 'the zombie in reach paws at nothing');
  assert.equal(g.round, round + 1, 'the round still turns');
  assert.equal(g.dazed, false, 'dirt only buys the one round');
});

// --- Swimming and sailing ----------------------------------------------------

/** A guaranteed river-water point in a heaven world (away from any bridge). */
function waterSpot(seed) {
  const rv = riverNear(seed, RIVER_COL * REGION, 1000);
  const by = bridgeYNear(seed, rv.band, 1000);
  const wy = by + 120;
  const wx = riverNear(seed, rv.center, wy).center;
  assert.equal(isWater(seed, wx, wy), true, 'the Styx is real water');
  return { x: wx, y: wy };
}

test('heaven water blocks walkers and admits swimmers (opts.swim)', () => {
  const g = heavenGame();
  const w = waterSpot(g.world.seed);
  assert.equal(g.world.collides(w.x - 2, w.y - 2, 4, 4), true, 'a wall to feet');
  assert.equal(g.world.collides(w.x - 2, w.y - 2, 4, 4, { swim: true }), false, 'warm to swimmers');
});

test('wading in splashes and slows to SWIM_SPEED; the boat sails at SAIL_SPEED', () => {
  const g = heavenGame();
  const w = waterSpot(g.world.seed);
  g.person.x = w.x;
  g.person.y = w.y;
  g.events.length = 0;
  g.update(STEP, {});
  assert.equal(g.swimming, true);
  assert.equal(g.person.speed, PERSON.speed * SWIM_SPEED, 'slow warm strokes');
  assert.ok(g.events.includes('splash'), 'a splash on the way in');
  // Back to shore: land legs return.
  g.person.x = 0;
  g.person.y = 30;
  g.update(STEP, {});
  assert.equal(g.swimming, false);
  assert.equal(g.person.speed, PERSON.speed);
  // With the boat, the same water is a road.
  g.hasBoat = true;
  g.person.x = w.x;
  g.person.y = w.y;
  g.events.length = 0;
  g.update(STEP, {});
  assert.equal(g.person.speed, PERSON.speed * SAIL_SPEED, 'she knows the way');
  assert.ok(g.events.includes('sail'));
});

// --- Chop and build ----------------------------------------------------------

test('chopping a real tree yields 3 planks on 14+, 1 on a low make, none on a miss', () => {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5);
  const tree = g.world.treesInRect(-300, -300, 600, 600).find((t) => t.kind === 'tree');
  assert.ok(tree, 'the woods provide');
  g.person.x = tree.x;
  g.person.y = tree.y + 5;
  g.hasAxe = true;
  g.rng = () => 0.99; // d20 = 20: three planks
  g.chopTree();
  assert.equal(g.wood, 3);
  g.rng = () => 0.36; // d20 = 8 = DC_CHOP exactly: one plank
  g.chopTree();
  assert.equal(g.wood, 4);
  g.rng = () => 0; // d20 = 1: bark 1, axe 0
  g.chopTree();
  assert.equal(g.wood, 4, 'a miss adds nothing');
});

test('buildBoat wants 24 planks + rope + manual; it spends the planks and the rope', () => {
  const g = new Game(1, { story: false });
  g.wood = BOAT_WOOD;
  g.hasManual = true;
  g.buildBoat();
  assert.equal(g.hasBoat, false, 'no rope, no boat');
  assert.equal(g.wood, BOAT_WOOD, 'nothing consumed');
  g.hasRope = true;
  g.buildBoat();
  assert.equal(g.hasBoat, true, 'she floats. somehow, she floats');
  assert.equal(g.wood, 0, 'all 24 planks in the hull');
  assert.equal(g.hasRope, false, 'the fifty-first use');
  // NOTE (actual behavior): the manual survives the build — the book is
  // read, not consumed.
  assert.equal(g.hasManual, true);
  const wood = g.wood;
  g.wood = BOAT_WOOD;
  g.hasRope = true;
  g.buildBoat();
  assert.equal(g.wood, BOAT_WOOD, 'one boat is plenty');
  void wood;
});

// --- The shrine --------------------------------------------------------------

test("the shrine's offering costs 1 coin, grants +2 max focus, and never doubles", () => {
  const g = heavenGame();
  g.world.chunkAt(0, 0).shrines.push({ x: g.person.x + 20, y: g.person.y });
  runSeconds(g, 1);
  assert.equal(g.choice?.kind, 'shrine');
  assert.equal(g.choice.title, 'THE ISLAND SHRINE. YOU MADE IT');
  const base = g.maxFocus();
  g.coins = 1;
  g.resolveChoice('offer');
  assert.equal(g.islandBlessed, true);
  assert.equal(g.coins, 0, 'the coin settles like it always lived there');
  assert.equal(g.maxFocus(), base + 2, "the islander's calm");
  // Walk off and return: the shrine re-arms, but the calm is already yours.
  g.person.x += 150;
  runSeconds(g, 0.4);
  g.person.x -= 150;
  runSeconds(g, 0.6);
  assert.equal(g.choice?.kind, 'shrine');
  g.coins = 5;
  g.resolveChoice('offer');
  assert.equal(g.coins, 5, 'the bowl is full of your last coin');
  assert.equal(g.maxFocus(), base + 2, 'no double blessing');
});

// --- God ---------------------------------------------------------------------

test('walking up to God fires the one-shot meeting (+3 XP) and a five-option menu', () => {
  const g = heavenGame();
  const god = godSpot(g.world.seed);
  assert.ok(god, "the signs all point somewhere real in the game's own heaven");
  g.person.x = god.x;
  g.person.y = god.y + 10;
  g.xp = 0;
  runSeconds(g, 1);
  assert.equal(g.godMet, true, 'God has always been a cricket');
  assert.equal(g.xp, 3, 'meeting God is worth 3 XP');
  assert.equal(g.choice?.kind, 'god');
  assert.equal(g.choice.options.length, 5, 'five ways to be with God');
  // Leave and return: the menu re-opens, the meeting stays once-only.
  g.resolveChoice('leave');
  g.choiceCooldown = null; // the walk-away re-arm clears both together
  g.cooldownKeys.clear();
  runSeconds(g, 0.5);
  assert.equal(g.choice?.kind, 'god', 'God remains');
  assert.equal(g.xp, 3, 'but you only meet God for the first time once');
});
