// Queue Town and the v0.21 systems: the wizard town's layout, Cortie's
// steel, Queebee's paper, scrolls cast and inscribed, leveled slots, and
// the zombies that finally walk toward dinner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, ABILITIES, PRICES, SCROLL_PRICES, PAPER_PRICE, BOOK_PRICE, SPELLS,
  ZOMBIE_LOCK, ZOMBIE_STEP, DC_FISTS,
} from '../src/core/game.js';
import { World } from '../src/core/world.js';
import { qtownAt, townAt, isWater, biomeAt } from '../src/core/terrain.js';
import { INTERIORS } from '../src/core/interiors.js';

const STEP = 1 / 60;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

function flatGame() {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  g.rest();
  runSeconds(g, 3.5);
  return g;
}

/** The nearest Queue Town to the origin at seed 1 (scanning outward). */
function findQtown(seed = 1) {
  for (let r = 1; r <= 30; r++) {
    for (let rx = -r; rx <= r; rx++) {
      for (let ry = -r; ry <= r; ry++) {
        if (Math.max(Math.abs(rx), Math.abs(ry)) !== r) continue;
        const q = qtownAt(seed, rx, ry);
        if (q) return q;
      }
    }
  }
  throw new Error('no Queue Town within 30 regions');
}

// --- Generation --------------------------------------------------------------

test('Queue Town deals only in night redwoods, deterministically, on dry ground', () => {
  let count = 0;
  for (let rx = -20; rx <= 20; rx++) {
    for (let ry = -20; ry <= 20; ry++) {
      const q = qtownAt(1, rx, ry);
      if (!q) continue;
      count++;
      assert.deepEqual(qtownAt(1, rx, ry), q, 'deterministic');
      assert.equal(biomeAt(1, rx, ry), 'redwood', 'wizards keep to the redwoods');
      assert.equal(townAt(1, rx, ry), null, 'never sharing a region with a ghost town');
      assert.equal(isWater(1, q.cx, q.cy), false, 'the square is dry');
      for (const spot of [q.cortie, q.queebee, q.sign, ...q.towers]) {
        assert.equal(isWater(1, spot.x, spot.y), false, 'fixtures refuse to drown');
      }
      assert.equal(q.towers.length, 2, 'two crooked towers');
      assert.ok(q.wizards.length >= 1 && q.wizards.length <= 5, 'a handful of grumps');
      for (const w of q.wizards) {
        assert.ok(w.variant >= 0 && w.variant < 3);
        assert.ok(typeof w.phase === 'number');
      }
    }
  }
  assert.ok(count >= 1, `wizard towns exist (${count} in 41x41)`);
});

test('shop walls are solid; the doors are exactly where the art says', () => {
  const q = findQtown();
  const w = new World(1);
  assert.ok(w.collides(q.cortie.x - 50 - 2, q.cortie.y - 4, 4, 4), 'Cortie wall solid');
  assert.equal(w.collides(q.cortie.x + 31 - 2, q.cortie.y - 4, 4, 4), false, 'Cortie door open (+31)');
  assert.ok(w.collides(q.queebee.x + 50 - 2, q.queebee.y - 4, 4, 4), 'Queebee wall solid');
  assert.equal(w.collides(q.queebee.x - 31 - 2, q.queebee.y - 4, 4, 4), false, 'Queebee door open (-31)');
  assert.ok(w.collides(q.towers[0].x - 2, q.towers[0].y - 4, 4, 4), 'tower base solid');
});

// --- The shops ---------------------------------------------------------------

/** flatGame teleported inside a shop, standing at the counter. */
function shopGame(kind) {
  const g = flatGame();
  g.enterInterior(kind, `${kind}:test`, { px: 0, py: 0, dx: -15, dy: 5 });
  assert.equal(g.location, kind);
  const counter = INTERIORS[kind].spots.find((s) => s.id === `${kind}-counter`);
  g.person.x = counter.x;
  g.person.y = counter.y + 10;
  runSeconds(g, 0.2);
  assert.ok(g.interactNearest(), 'the counter answers a click');
  assert.equal(g.choice?.kind, `spot:${kind}-counter`);
  return g;
}

test("Cortie sells the sword and the wand; short pockets buy nothing", () => {
  const g = shopGame('cortie');
  g.resolveChoice('wares');
  assert.equal(g.choice?.kind, 'cortie-buy');
  g.coins = PRICES.sword;
  g.resolveChoice('sword');
  assert.equal(g.hasSword, true, 'steel changes hands');
  assert.equal(g.coins, 0);
  assert.equal(g.choice?.kind, 'cortie-buy', 'the rack stays open');
  assert.equal(g.choice.options.some((o) => o.id === 'sword'), false, 'one sword each');
  g.resolveChoice('wand'); // 0 coins
  assert.equal(g.hasWand, false, 'no coin, no lightning');
  assert.match(g.caption.text, /NOT ENOUGH COIN/);
});

test('Queebee: buy a scroll, buy a page, inscribe forever — or cast it free', () => {
  const g = shopGame('queebee');
  g.resolveChoice('wares');
  assert.equal(g.choice?.kind, 'queebee-buy');
  g.coins = SCROLL_PRICES.bolt + SCROLL_PRICES.mend + PAPER_PRICE;
  g.resolveChoice('bolt');
  assert.equal(g.scrolls.bolt, 1, 'one scroll of BOLT');
  g.resolveChoice('mend');
  assert.equal(g.scrolls.mend, 1);
  g.resolveChoice('paper');
  assert.equal(g.paper, 1);
  assert.equal(g.coins, 0);
  // Inscribe BOLT: page + scroll spent, spell forever.
  g.resolveChoice('back');
  g.resolveChoice('leave');
  g.inscribeScroll('bolt');
  assert.equal(g.spells.includes('bolt'), true, 'BOLT is yours forever');
  assert.equal(g.paper, 0, 'the page is spent');
  assert.equal(g.scrolls.bolt, 0, 'so is the scroll');
  // Cast MEND straight off the scroll: free, no slots involved.
  for (const lv of [1, 2, 3]) g.slots[lv] = 0;
  g.hp = 5;
  g.castScroll('mend');
  assert.equal(g.hp, 7, 'the scroll casts without a slot');
  assert.equal(g.scrolls.mend, 0, 'and burns');
});

test('the blank book inscribes without spending pages', () => {
  const g = flatGame();
  g.scrolls.shield = 1;
  g.paper = 0;
  g.inscribeScroll('shield');
  assert.equal(g.spells.includes('shield'), false, 'nothing to write on');
  g.hasBook = true;
  g.inscribeScroll('shield');
  assert.equal(g.spells.includes('shield'), true, 'the book takes the ink');
  assert.equal(g.scrolls.shield, 0);
});

test('a bigger slot burns for a smaller spell when the shelf is empty', () => {
  const g = flatGame();
  g.spells.push('ember'); // L1
  g.slots[1] = 0;
  g.slots[2] = 1;
  g.castSpell('ember');
  assert.equal(g.slots[2], 0, 'the L2 slot burned');
  assert.ok(
    [g.caption?.text, ...g.captionQueue].includes('A BIGGER SLOT BURNS FOR A SMALLER SPELL'),
  );
});

// --- Wizards -----------------------------------------------------------------

test('wizards are grumpy, clickable, and never hostile', () => {
  const g = flatGame();
  g.world.chunkAt(0, 0).wizards.push({ x: g.person.x + 20, y: g.person.y, phase: 0, variant: 1 });
  runSeconds(g, 0.5);
  assert.equal(g.mode, 'free', 'no battle from a grump');
  assert.ok(g.interactNearest(), 'the wizard answers, reluctantly');
  assert.equal(g.choice?.kind, 'wizard');
  assert.ok(g.choice.options.length >= 4);
  g.resolveChoice('hat');
  assert.ok(g.hearts.length >= 1, 'the hat preens');
});

// --- Zombies walk now --------------------------------------------------------

test('a zombie in lock range shambles toward you; out of range it holds its post', () => {
  const g = flatGame();
  const zx = g.person.x + ZOMBIE_LOCK - 10;
  g.world.chunkAt(0, 0).zombies.push({ x: zx, y: g.person.y, phase: 0 });
  const z = g.world.chunkAt(0, 0).zombies.at(-1);
  const before = g.zombiePos(z).x;
  runSeconds(g, 1);
  assert.ok(g.zombiePos(z).x < before, 'it closed distance');
  // A far zombie does not move.
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + ZOMBIE_LOCK * 3, y: g.person.y, phase: 0 });
  const far = g.world.chunkAt(0, 0).zombies.at(-1);
  runSeconds(g, 1);
  assert.equal(g.zombiePos(far).x, far.x, 'beyond the lock it never noticed you');
});

test('in battle, an out-of-reach zombie closes ZOMBIE_STEP on its turn', () => {
  const g = flatGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 100, y: g.person.y, phase: 0 });
  const z = g.world.chunkAt(0, 0).zombies.at(-1);
  runSeconds(g, 0.4); // battle engages at 120
  assert.equal(g.mode, 'turn');
  const before = g.zombiePos(z).x - g.person.x;
  g.openBattleMenu();
  g.resolveChoice('wait');
  const after = g.zombiePos(z).x - g.person.x;
  assert.ok(before - after >= ZOMBIE_STEP - 8, `it stepped in (${before} -> ${after})`);
});

test('sword and wand join the battle menu once bought', () => {
  const g = flatGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 10, y: g.person.y, phase: 0 });
  runSeconds(g, 0.4);
  assert.equal(g.mode, 'turn');
  g.hasSword = true;
  g.hasWand = true;
  g.openBattleMenu();
  const ids = g.choice.options.map((o) => o.id);
  assert.ok(ids.includes('sword') && ids.includes('wand'), 'both steel and lightning');
  // The wand answers to INT: a flat-10 mind flicks for 2.
  g.rng = () => 0.99;
  g.resolveChoice('wand');
  assert.match(g.caption.text, /THE WAND CRACKS VIOLET|VIOLET SPARKS/);
});

test(`fists at DC ${DC_FISTS} with min 1 damage make zombies hard, not hopeless`, () => {
  const g = flatGame();
  g.stats.str = 2;
  assert.equal(g.fistDamage(), 1, 'even the weakest fists land one');
});
