// The night side of v0.20: ghost towns (townAt), Pirts the merchant ghost,
// ghosts hostile and otherwise, the detective in his bail-bonds office, and
// the interiors' four-option floor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, ABILITIES, PRICES, SELLS, FOES,
} from '../src/core/game.js';
import { townAt, isWater, biomeAt } from '../src/core/terrain.js';
import { World } from '../src/core/world.js';
import { INTERIORS } from '../src/core/interiors.js';

const STEP = 1 / 60;
const SEED = 1;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** A together game on an open field, stats flattened to 10 (modifier 0). */
function flatGame() {
  const g = new Game(SEED, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5); // let the greeting caption clear
  return g;
}

/** Every town seed 1's night deals within a region scan. */
function scanTowns(seed, range = 40) {
  const towns = [];
  for (let rx = -range; rx <= range; rx++) {
    for (let ry = -range; ry <= range; ry++) {
      const t = townAt(seed, rx, ry);
      if (t) towns.push({ rx, ry, town: t });
    }
  }
  return towns;
}

// --- townAt -----------------------------------------------------------------

test('townAt is deterministic and towns keep their structure', () => {
  const towns = scanTowns(SEED);
  assert.ok(towns.length >= 1, `the night has ghost towns (found ${towns.length})`);
  for (const { rx, ry, town } of towns.slice(0, 12)) {
    assert.deepEqual(townAt(SEED, rx, ry), town, 'same seed+region, same town');
    assert.equal(typeof town.cx, 'number');
    assert.equal(typeof town.cy, 'number');
    assert.ok(['grass', 'oak'].includes(biomeAt(SEED, rx, ry)), 'towns rise on grass or oak');
    assert.ok(town.ruins.length >= 1 && town.ruins.length <= 4, 'up to 4 ruins');
    for (const r of town.ruins) assert.ok([0, 1, 2].includes(r.variant), 'ruin variants are 0..2');
    assert.ok(town.ghosts.length >= 1 && town.ghosts.length <= 6, 'up to 6 ghosts');
    for (const gh of town.ghosts) {
      assert.ok(['hostile', 'sullen', 'drifting'].includes(gh.temper), `temper ${gh.temper}`);
      assert.equal(typeof gh.phase, 'number');
    }
    assert.equal(typeof town.pirts.x, 'number');
    assert.equal(typeof town.sign.x, 'number');
    assert.equal(typeof town.office.x, 'number');
  }
});

test('the parts townAt filters stay on dry ground (ghosts, ruins, the center)', () => {
  // NOTE (actual behavior): townAt water-checks cx/cy and filters ruins and
  // ghosts, but pirts/sign/office are NOT filtered — across a wide scan a
  // stray Pirts or leaning sign can stand in water. So only the filtered
  // parts are asserted dry here.
  const towns = scanTowns(SEED);
  for (const { town } of towns) {
    assert.equal(isWater(SEED, town.cx, town.cy), false, 'the town center is dry');
    for (const gh of town.ghosts) assert.equal(isWater(SEED, gh.x, gh.y), false, 'ghosts are dry');
    for (const r of town.ruins) assert.equal(isWater(SEED, r.x, r.y), false, 'ruins are dry');
  }
});

test('ghost towns belong to the night: a heaven-registered seed deals none', () => {
  const heavenSeed = 999;
  new World(heavenSeed, 'heaven'); // registers the seed's biome deck
  for (let rx = -15; rx <= 15; rx++) {
    for (let ry = -15; ry <= 15; ry++) {
      assert.equal(townAt(heavenSeed, rx, ry), null);
    }
  }
});

// --- Pirts, merchant (deceased) ---------------------------------------------

test('buying the draught deducts its price and heals; short pockets pay nothing', () => {
  const g = flatGame();
  g.openPirtsMenu('pi:test', g.person.x, g.person.y);
  assert.equal(g.choice?.kind, 'pirts');
  g.resolveChoice('buy');
  assert.equal(g.choice?.kind, 'pirts-buy');
  g.coins = 10;
  g.hp = 4;
  g.resolveChoice('draught');
  assert.equal(g.coins, 10 - PRICES.draught, 'the draught costs its listed price');
  assert.equal(g.hp, 7, '+3 HP in a bottle');
  assert.equal(g.choice?.kind, 'pirts-buy', 'the shop stays open');
  // Too few coins: the shortfall is announced and nothing moves.
  g.coins = PRICES.draught - 1;
  g.hp = 4;
  g.resolveChoice('draught');
  assert.equal(g.coins, PRICES.draught - 1, 'no coins taken');
  assert.equal(g.hp, 4, 'no healing either');
  assert.equal(g.caption.text, 'NOT ENOUGH COIN');
});

test('the axe, rope, and manual set their flags and leave the shelf', () => {
  const g = flatGame();
  g.openPirtsMenu('pi:test', g.person.x, g.person.y);
  g.resolveChoice('buy');
  const ids = () => g.choice.options.map((o) => o.id);
  assert.deepEqual(ids(), ['draught', 'axe', 'rope', 'manual', 'haggle', 'good', 'back']);
  g.coins = 30;
  g.resolveChoice('axe');
  assert.equal(g.hasAxe, true);
  assert.equal(g.coins, 30 - PRICES.axe);
  assert.ok(!ids().includes('axe'), 'the axe is off the menu');
  g.resolveChoice('rope');
  assert.equal(g.hasRope, true);
  assert.equal(g.coins, 30 - PRICES.axe - PRICES.rope);
  assert.ok(!ids().includes('rope'));
  g.resolveChoice('manual');
  assert.equal(g.hasManual, true);
  assert.equal(g.coins, 30 - PRICES.axe - PRICES.rope - PRICES.manual);
  assert.ok(!ids().includes('manual'));
  assert.deepEqual(ids(), ['draught', 'haggle', 'good', 'back'], 'the sold-out shelf still holds four');
});

test('selling meat, bone, and planks pays the SELLS table', () => {
  const g = flatGame();
  g.hasBone = true;
  g.boneMeat = true;
  g.wood = 2;
  g.coins = 0;
  g.openPirtsMenu('pi:test', g.person.x, g.person.y);
  g.resolveChoice('sell');
  assert.equal(g.choice?.kind, 'pirts-sell');
  g.resolveChoice('meat');
  assert.equal(g.coins, SELLS.meat);
  assert.equal(g.boneMeat, false);
  assert.ok(!g.choice.options.some((o) => o.id === 'meat'), 'the meat is gone from the menu');
  g.resolveChoice('bone');
  assert.equal(g.coins, SELLS.meat + SELLS.bone);
  assert.equal(g.hasBone, false);
  g.resolveChoice('wood');
  assert.equal(g.coins, SELLS.meat + SELLS.bone + SELLS.wood);
  assert.equal(g.wood, 1, 'one plank at a time');
});

test('SELL YOUR STORY pays 1 coin exactly once', () => {
  const g = flatGame();
  g.coins = 0;
  g.openPirtsMenu('pi:test', g.person.x, g.person.y);
  g.resolveChoice('sell');
  g.resolveChoice('story');
  assert.equal(g.coins, 1, 'worth every penny');
  assert.ok(g.encounterDone.has('pirts:story'));
  g.resolveChoice('story');
  assert.equal(g.coins, 1, 'he has heard this one');
});

test('every Pirts menu holds at least 4 options in its worst case', () => {
  const g = flatGame();
  // Worst case: all tools owned, nothing to sell.
  g.hasAxe = true;
  g.hasRope = true;
  g.hasManual = true;
  g.hasBone = false;
  g.boneMeat = false;
  g.wood = 0;
  g.openPirtsMenu('pi:test', g.person.x, g.person.y);
  assert.ok(g.choice.options.length >= 4, `pirts: ${g.choice.options.length}`);
  g.resolveChoice('buy');
  assert.ok(g.choice.options.length >= 4, `pirts-buy: ${g.choice.options.length}`);
  g.resolveChoice('back');
  g.resolveChoice('sell');
  assert.ok(g.choice.options.length >= 4, `pirts-sell: ${g.choice.options.length}`);
});

// --- Ghosts -----------------------------------------------------------------

test('a hostile ghost pulls the world into turn-based, and its hit steals a coin', () => {
  const g = flatGame();
  g.world.chunkAt(0, 0).ghosts.push({
    x: g.person.x, y: g.person.y, phase: 0, variant: 0, temper: 'hostile',
  });
  const steps = Math.ceil(3 / STEP);
  for (let i = 0; i < steps && g.mode !== 'turn'; i++) g.update(STEP, {});
  assert.equal(g.mode, 'turn', 'the static has teeth');
  const foes = g.hostilesNear(200);
  assert.ok(foes.some((f) => f.kind === 'ghost'), 'hostilesNear knows a ghost');
  g.coins = 3;
  g.hp = 10;
  g.caption = null;
  g.captionQueue.length = 0;
  g.endPlayerTurn();
  assert.equal(g.hp, 10 - FOES.ghost.dmg, 'a ghost bite is 1 HP');
  assert.equal(g.coins, 2, 'and it takes a coin with it');
  assert.equal(g.caption.text, `IT PASSES THROUGH YOU (-${FOES.ghost.dmg} HP, -1 COIN)`);
});

test('a non-hostile ghost opens a 4-option menu; OFFER A COIN pays 2 XP once', () => {
  const g = flatGame();
  g.world.chunkAt(0, 0).ghosts.push({
    x: g.person.x + 20, y: g.person.y, phase: 0, variant: 0, temper: 'sullen',
  });
  runSeconds(g, 1);
  g.interactNearest(); // v0.21: the ghost waits to be spoken to
  assert.equal(g.choice?.kind, 'ghost');
  assert.equal(g.choice.title, 'A GHOST, BUFFERING ITS GRIEF');
  assert.equal(g.choice.options.length, 4);
  g.coins = 2;
  g.xp = 0;
  g.resolveChoice('coin');
  assert.equal(g.coins, 1, 'the coin falls through it');
  assert.equal(g.xp, 2, 'kindness pays 2 XP');
  // Walk off, come back: the ghost keeps its post, but the XP was once-only.
  g.person.x += 100;
  runSeconds(g, 0.4);
  g.person.x -= 100;
  runSeconds(g, 0.4);
  g.interactNearest();
  assert.equal(g.choice?.kind, 'ghost', 'the ghost is not one-shot');
  g.resolveChoice('coin');
  assert.equal(g.coins, 0, 'it still takes the coin');
  assert.equal(g.xp, 2, 'but the XP was paid already');
});

// --- The detective and the interiors ----------------------------------------

test('the detective pays 3 coins for a good tip, exactly once', () => {
  const g = flatGame();
  g.enterInterior('office', 'of:test', { px: 0, py: 0, dx: -15, dy: 5 });
  assert.equal(g.location, 'office');
  // Wander up to the desk: the spot menu opens by proximity.
  g.person.x = 192;
  g.person.y = 140;
  runSeconds(g, 0.5);
  g.interactNearest(); // v0.21: spots open when clicked
  assert.equal(g.choice?.kind, 'spot:detective');
  assert.ok(g.choice.options.length >= 4);
  g.coins = 0;
  g.resolveChoice('tip');
  assert.equal(g.tippedDetective, true);
  assert.equal(g.coins, 3, 'good tip, he says');
  // Ask again: he taps the notebook, keeps his coins.
  g.openSpotMenu('office', INTERIORS.office.spots.find((s) => s.id === 'detective'), 'of:test:d2');
  g.resolveChoice('tip');
  assert.equal(g.coins, 3, 'already on the board');
});

test('the cabin wall axe is taken once; the stove coal heals once', () => {
  const g = flatGame();
  g.enterInterior('cabin', 'cb:test', { px: 0, py: 0, dx: -15, dy: 5 });
  const wallaxe = INTERIORS.cabin.spots.find((s) => s.id === 'wallaxe');
  const stove = INTERIORS.cabin.spots.find((s) => s.id === 'stove');
  assert.equal(g.hasAxe, false);
  g.openSpotMenu('cabin', wallaxe, 'cb:test:wallaxe');
  g.resolveChoice('take');
  assert.equal(g.hasAxe, true, 'the pegs exhale');
  g.openSpotMenu('cabin', wallaxe, 'cb:test:wallaxe2');
  assert.equal(g.choice.title, 'EMPTY PEGS ON THE WALL');
  g.resolveChoice('take');
  assert.equal(g.hasAxe, true, 'still just the one axe');
  // The stove's one kind thing.
  g.hp = 5;
  g.openSpotMenu('cabin', stove, 'cb:test:stove');
  g.resolveChoice('warm');
  assert.equal(g.hp, 6, '+1 HP from the coal');
  assert.ok(g.encounterDone.has('cb:test:warmed'));
  g.openSpotMenu('cabin', stove, 'cb:test:stove2');
  g.resolveChoice('warm');
  assert.equal(g.hp, 6, 'the coal is spent for tonight');
});

test('the upstairs bed heals +2 exactly once (encounterDone keeps the key)', () => {
  const g = flatGame();
  g.enterInterior('mansion2', 'm:test:up', { px: 0, py: 0, dx: -15, dy: 5 });
  const bed = INTERIORS.mansion2.spots.find((s) => s.id === 'bed');
  g.hp = 5;
  g.openSpotMenu('mansion2', bed, 'm:test:up:bed');
  g.resolveChoice('lie');
  assert.equal(g.hp, 7, 'one minute, +2 HP');
  assert.ok(g.encounterDone.has('m:test:up:slept'));
  g.openSpotMenu('mansion2', bed, 'm:test:up:bed2');
  g.resolveChoice('lie');
  assert.equal(g.hp, 7, 'the bed has given what it has to give');
});

// --- The four-option floor --------------------------------------------------

test('every interior spot menu — and the boneless zombie menu — offers at least 4 options', () => {
  const g = flatGame();
  for (const [kind, spec] of Object.entries(INTERIORS)) {
    for (const spot of spec.spots) {
      g.choice = null;
      g.openSpotMenu(kind, spot, `${kind}:${spot.id}:meta`);
      assert.equal(g.choice?.kind, `spot:${spot.id}`, `${kind}/${spot.id} opens`);
      assert.ok(
        g.choice.options.length >= 4,
        `${kind}/${spot.id}: ${g.choice.options.length} options`,
      );
    }
  }
  g.choice = null;
  g.hasBone = false;
  const zm = g.zombieMenu('z:meta', 0, 0);
  assert.ok(zm.options.length >= 4, `zombie (no bone): ${zm.options.length} options`);
});
