// The v0.9 D&D layer: rolled abilities, modifiers, the drunk timer, the
// character sheet, the meaty bone, and the zombie fight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, MAX_HP, COLLAPSE_HP, ABILITIES,
  DC_FISTS, DC_BONE, ZOMBIE_HP, ZOMBIE_BITE, DRUNK_TIME, DRUNK_WIS_BONUS,
} from '../src/core/game.js';
import { generateChunk, CHUNK } from '../src/core/world.js';
import { ZOMBIE_SPRITE, ZOMBIE_COLORS, zombieSway } from '../src/gfx/encounters.js';
import { SCREEN_W, SCREEN_H, choicePanel, sheetLines } from '../src/gfx/renderer.js';

const STEP = 1 / 60;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** A together game on an open field, stats flattened to 10 (modifier 0). */
function flatGame() {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5); // let the greeting caption clear
  return g;
}

/**
 * Walk up to a planted zombie until its menu opens. Sound events are drained
 * per step into g.heard (mirroring main.js) so the cap can't swallow them.
 */
function zombieGame({ bone = false } = {}) {
  const g = flatGame();
  g.hasBone = bone;
  g.world.chunkAt(0, 0).zombies.push({ x: 40, y: 0, phase: 0 });
  g.heard = [];
  const steps = Math.ceil(6 / STEP);
  for (let i = 0; i < steps && !g.choice; i++) {
    g.update(STEP, { right: true });
    g.heard.push(...g.events);
    g.events.length = 0;
  }
  return g;
}

// --- Abilities and modifiers ------------------------------------------------

test('abilities are rolled 3d6 at the beginning of the universe', () => {
  const g = new Game(7, { story: false });
  assert.deepEqual(Object.keys(g.stats).sort(), [...ABILITIES].sort());
  for (const a of ABILITIES) {
    assert.ok(Number.isInteger(g.stats[a]), `${a} is a whole score`);
    assert.ok(g.stats[a] >= 3 && g.stats[a] <= 18, `${a} in 3..18 (got ${g.stats[a]})`);
  }
  const g2 = new Game(7, { story: false });
  assert.deepEqual(g2.stats, g.stats, 'same seed, same person');
  assert.notDeepEqual(new Game(8, { story: false }).stats, g.stats, 'a different seed rolls anew');
});

test('modifiers follow the classic table, and the pipe sharpens wisdom', () => {
  const g = flatGame();
  for (const [score, expected] of [[3, -4], [8, -1], [10, 0], [11, 0], [12, 1], [15, 2], [18, 4]]) {
    g.stats.str = score;
    assert.equal(g.mod('str'), expected, `STR ${score}`);
  }
  g.stats.str = 10;
  assert.equal(g.mod('wis'), 0);
  g.drunk = 100;
  assert.equal(g.mod('wis'), DRUNK_WIS_BONUS, 'drunk wisdom flows easier');
  assert.equal(g.mod('int'), 0, 'only wisdom is sharpened');
});

test('roll captions show the modifier only when nonzero', () => {
  const g = flatGame();
  g.rng = () => 0.5; // d20 roll of 11
  assert.equal(g.rollText(g.check('str')), 'D20: 11');
  g.stats.str = 14;
  assert.equal(g.rollText(g.check('str')), 'D20: 11+2');
  g.stats.str = 8;
  assert.equal(g.rollText(g.check('str')), 'D20: 11-1');
});

// --- The drunk timer --------------------------------------------------------

test('the inebriation wears off and the world settles back down', () => {
  const g = flatGame();
  g.drunk = 0.5;
  runSeconds(g, 1);
  assert.equal(g.drunk, 0);
  assert.equal(g.caption.text, 'THE WORLD SETTLES BACK DOWN');
  // ...and it only says so once.
  runSeconds(g, 4);
  assert.equal(g.caption, null);
});

test('the drunk timer keeps draining while a menu is open', () => {
  const g = flatGame();
  g.drunk = DRUNK_TIME;
  g.update(STEP, { sheet: true });
  assert.ok(g.choice, 'sheet open');
  runSeconds(g, 1);
  assert.ok(g.drunk < DRUNK_TIME, 'time passes even mid-menu');
});

// --- The character sheet ----------------------------------------------------

test('the sheet opens on I, freezes the walk, and reopens without cooldown', () => {
  const g = flatGame();
  g.update(STEP, { sheet: true });
  assert.ok(g.choice, 'sheet open');
  assert.equal(g.choice.kind, 'sheet');
  assert.equal(g.choice.title, 'YOU');
  assert.deepEqual(g.choice.options.map((o) => o.id), ['close'], 'no meat, just close');
  const px = g.person.x;
  g.update(STEP, { right: true });
  assert.equal(g.person.x, px, 'walk frozen while reading');
  g.update(STEP, {});
  g.update(STEP, { action: true }); // CLOSE
  assert.equal(g.choice, null);
  g.update(STEP, {});
  g.update(STEP, { sheet: true });
  assert.ok(g.choice, 'the sheet is not an encounter — it reopens at once');
});

test('with meat on the bone, the sheet offers the gnaw (+2 HP)', () => {
  const g = flatGame();
  g.hasBone = true;
  g.boneMeat = true;
  g.hp = 4;
  g.update(STEP, { sheet: true });
  assert.deepEqual(g.choice.options.map((o) => o.id), ['eat', 'close']);
  g.resolveChoice('eat');
  assert.equal(g.hp, 6);
  assert.equal(g.boneMeat, false);
  assert.ok(g.hasBone, 'the club remains');
  g.update(STEP, {});
  g.update(STEP, { sheet: true });
  assert.deepEqual(g.choice.options.map((o) => o.id), ['close'], 'the offer is gone');
});

test('sheet lines show stats, HP, drunkenness, and the bone', () => {
  const g = flatGame();
  const lines = sheetLines(g);
  assert.equal(lines.length, 4, 'sober and boneless: stats + HP only');
  assert.equal(lines[0], `STR ${g.stats.str}  DEX ${g.stats.dex}`);
  assert.equal(lines[3], `HP ${g.hp} OF ${MAX_HP}`);
  g.drunk = 599;
  g.hasBone = true;
  g.boneMeat = true;
  const more = sheetLines(g);
  assert.ok(more[2].includes('(+2)'), 'drunk wisdom is annotated');
  assert.ok(more.includes('DRUNK 9:59'), 'the timer reads M:SS');
  assert.ok(more.includes('BONE (MEATY)'));
  g.boneMeat = false;
  assert.ok(sheetLines(g).includes('BONE (A GOOD CLUB)'));
});

test('the sheet panel reserves room for its body lines, on screen', () => {
  const g = flatGame();
  g.hasBone = true;
  g.drunk = 60;
  g.openSheet();
  const panel = choicePanel(g);
  assert.equal(panel.body.length, 6, 'stats x3, HP, DRUNK, BONE');
  assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.w <= SCREEN_W && panel.y + panel.h <= SCREEN_H);
  for (const row of panel.rows) {
    assert.ok(row.y >= panel.y && row.y + row.h <= panel.y + panel.h + 2, 'rows inside the panel');
  }
});

// --- The zombie -------------------------------------------------------------

test('a zombie shambles up: groan, menu, no bone option bare-handed', () => {
  const g = zombieGame();
  assert.ok(g.choice, 'the zombie menu opened');
  assert.equal(g.choice.kind, 'zombie');
  assert.equal(g.choice.title, 'A ZOMBIE SHAMBLES IN PLACE');
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'fists', 'run']);
  assert.ok(g.heard.includes('zombie'), 'it groaned on approach');
});

test('befriending the zombie just gets you bitten (-2 HP)', () => {
  const g = zombieGame();
  g.hp = 8;
  g.resolveChoice('befriend');
  assert.equal(g.hp, 8 - ZOMBIE_BITE);
  assert.equal(g.caption.text, 'THE ZOMBIE DOES NOT WANT FRIENDS');
  assert.ok(g.captionQueue.includes(`IT BITES (-${ZOMBIE_BITE} HP)`));
  assert.ok(g.choice, 'it is still coming — the fight menu reopens');
  assert.equal(g.choice.kind, 'zombie');
});

test('fists: DC 12, 2 damage — two clean hits drop it', () => {
  const g = zombieGame();
  const key = g.choice.key;
  g.rng = () => 0.99; // roll 20
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20 - YOU LAND ONE. IT STAGGERS');
  assert.equal(g.zombieHp.get(key), ZOMBIE_HP - 2);
  assert.ok(g.choice, 'half-dead is not dead');
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20 - YOU LAND ONE');
  assert.ok(g.captionQueue.includes('THE ZOMBIE CRUMBLES. THE FOREST EXHALES'));
  assert.ok(g.encounterDone.has(key), 'it stays down');
  assert.equal(g.zombieHp.has(key), false, 'fight state cleaned up');
  assert.equal(g.choice, null);
});

test('the bone is the better club: DC 9, 3 damage, and it bonks', () => {
  const g = zombieGame({ bone: true });
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'fists', 'bone', 'run']);
  const key = g.choice.key;
  g.events.length = 0;
  g.rng = () => 0.45; // roll 10: lands with the bone, would miss bare-handed
  g.resolveChoice('bone');
  assert.ok(g.events.includes('bonk'));
  assert.equal(g.caption.text, 'D20: 10 - BONK! IT STAGGERS');
  assert.equal(g.zombieHp.get(key), ZOMBIE_HP - 3);
  g.resolveChoice('bone'); // 1 HP left, 3 damage
  assert.equal(g.caption.text, 'D20: 10 - BONK! THE BONE RINGS TRUE');
  assert.ok(g.captionQueue.includes('THE ZOMBIE CRUMBLES. THE FOREST EXHALES'));
  assert.ok(g.encounterDone.has(key));
  assert.ok(DC_BONE < DC_FISTS, 'the club is the easier swing');
});

test('a miss means teeth: bitten (-2 HP) and the zombie looms again', () => {
  const g = zombieGame();
  g.hp = 9;
  g.rng = () => 0.3; // roll 7 < DC_FISTS
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 7 - YOU MISS');
  assert.equal(g.hp, 9 - ZOMBIE_BITE);
  assert.ok(g.captionQueue.includes(`IT BITES (-${ZOMBIE_BITE} HP)`));
  assert.ok(g.choice, 'the fight is not over');
});

test('too weak: the lethal bite samples your brain (-1 INT) and ends the fight', () => {
  const g = zombieGame();
  const int0 = g.stats.int;
  g.hp = ZOMBIE_BITE; // the next bite fells you
  g.rng = () => 0; // roll 1 — a miss
  g.resolveChoice('fists');
  assert.equal(g.stats.int, int0 - 1);
  assert.equal(g.hp, COLLAPSE_HP, 'the collapse catches you');
  assert.equal(g.caption.text, 'IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)');
  assert.ok(g.captionQueue.includes('THE DOG DRAGS YOU AWAY'));
  assert.equal(g.choice, null, 'no menu over your unconscious body');
  runSeconds(g, 1.2);
  assert.equal(g.choice, null, 'the cooldown lets you crawl off');
});

test('INT can never be eaten below 1', () => {
  const g = zombieGame();
  g.stats.int = 1;
  g.hp = ZOMBIE_BITE;
  g.rng = () => 0;
  g.resolveChoice('fists');
  assert.equal(g.stats.int, 1);
});

test('running away costs nothing — the cooldown covers your exit', () => {
  const g = zombieGame();
  g.hp = 8;
  g.resolveChoice('run');
  assert.equal(g.choice, null);
  assert.equal(g.hp, 8, 'no parting bite');
  runSeconds(g, 1.2);
  assert.equal(g.choice, null, 'cooldown holds while you stand there shaking');
});

// --- World generation and art -----------------------------------------------

test('zombies generate rarely and stay inside their chunks', () => {
  let zombies = 0;
  const N = 40;
  for (let cx = 0; cx < N; cx++) {
    for (let cy = 0; cy < N; cy++) {
      const chunk = generateChunk(33, cx, cy);
      for (const z of chunk.zombies) {
        zombies++;
        assert.ok(z.x >= cx * CHUNK && z.x < (cx + 1) * CHUNK);
        assert.ok(z.y >= cy * CHUNK && z.y < (cy + 1) * CHUNK);
        assert.equal(typeof z.phase, 'number');
      }
    }
  }
  assert.ok(zombies > 0, 'the dead walk somewhere');
  assert.ok(zombies < N * N * 0.05, '...but rarely');
});

test('the zombie sprite is rectangular with known colors, and it lurches', () => {
  for (const row of ZOMBIE_SPRITE) {
    assert.equal(row.length, ZOMBIE_SPRITE[0].length, 'rectangular');
    for (const ch of row) assert.ok(ch === '.' || ch in ZOMBIE_COLORS, `zombie '${ch}'`);
  }
  assert.ok(ZOMBIE_SPRITE.some((row) => row.includes('e')), 'it keeps its eye');
  assert.equal(zombieSway(1.3, 0), zombieSway(1.3, 0), 'deterministic');
  const seen = new Set();
  for (let t = 0; t < 4; t += 0.1) seen.add(zombieSway(t, 0));
  assert.deepEqual([...seen].sort(), [0, 1], 'the shamble lurches between two poses');
});
