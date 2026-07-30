import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, MAX_HP, COLLAPSE_HP, DC_SEARCH, DC_SMOTHER } from '../src/core/game.js';
import { World, generateChunk, CHUNK } from '../src/core/world.js';
import {
  DUMPSTER_SPRITE, DUMPSTER_COLORS, CAT_SPRITE, PSYCHE_CYCLE, firePixels, catRowColor,
} from '../src/gfx/encounters.js';
import { targetMarkerPixels } from '../src/gfx/effects.js';
import { PALETTE } from '../src/gfx/palette.js';

const STEP = 1 / 60;
const IDLE = {};

function runSeconds(g, seconds, input = IDLE) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** A together game on an open field with one planted encounter next door. */
function encounterGame(kind, x = 40, y = 0) {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  runSeconds(g, 3.5); // let the greeting caption clear
  if (kind === 'dumpster') g.world.chunkAt(0, 0).dumpsters.push({ x, y });
  if (kind === 'cat') g.world.chunkAt(0, 0).cats.push({ x, y, phase: 0 });
  return g;
}

function walkUntilChoice(g, seconds = 6) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps && !g.choice; i++) g.update(STEP, { right: true });
  return g.choice;
}

// --- Art & geometry ---------------------------------------------------------

test('encounter sprites are rectangular with known palette keys', () => {
  for (const row of DUMPSTER_SPRITE) {
    assert.equal(row.length, DUMPSTER_SPRITE[0].length);
    for (const ch of row) assert.ok(ch === '.' || ch in DUMPSTER_COLORS, `dumpster '${ch}'`);
  }
  for (const row of CAT_SPRITE) {
    assert.equal(row.length, CAT_SPRITE[0].length);
    assert.match(row, /^[.C]+$/);
  }
});

test('the fire flickers deterministically', () => {
  assert.deepEqual(firePixels(1.0), firePixels(1.0));
  assert.notDeepEqual(firePixels(1.0), firePixels(1.4), 'flames move');
  const palette = new Set(Object.values(PALETTE));
  for (const p of firePixels(2.2)) {
    assert.ok(palette.has(p.c));
    assert.ok(p.y < -8, 'flames burn above the dumpster body');
  }
});

test('the cat shimmers through the psychedelic cycle', () => {
  const seen = new Set();
  for (let frame = 0; frame < 8; frame++) seen.add(catRowColor(0, frame));
  assert.equal(seen.size, PSYCHE_CYCLE.length, 'every color gets a turn');
  assert.notEqual(catRowColor(0, 0), catRowColor(1, 0), 'rows band differently');
});

test('the move marker pulses three converging arrowheads', () => {
  assert.deepEqual(targetMarkerPixels(0.2), targetMarkerPixels(0.2));
  assert.notDeepEqual(targetMarkerPixels(0), targetMarkerPixels(0.31), 'it pulses');
  const pts = targetMarkerPixels(0);
  assert.equal(pts.length, 12, '3 arrowheads x 4 pixels');
  assert.equal(pts.filter((p) => p.apex).length, 3);
  assert.ok(pts.some((p) => p.y < 0), 'one arrow above');
  assert.ok(pts.some((p) => p.x < 0 && p.y > 0), 'one lower-left');
  assert.ok(pts.some((p) => p.x > 0 && p.y > 0), 'one lower-right');
  for (const p of pts) {
    const apexDist = Math.hypot(p.x, p.y);
    assert.ok(apexDist <= 10, 'marker stays tight around the target');
  }
});

// --- World generation -------------------------------------------------------

test('dumpsters and cats are rare and stay inside their chunks', () => {
  let dumpsters = 0;
  let cats = 0;
  const N = 40;
  for (let cx = 0; cx < N; cx++) {
    for (let cy = 0; cy < N; cy++) {
      const chunk = generateChunk(33, cx, cy);
      for (const d of chunk.dumpsters) {
        dumpsters++;
        assert.ok(d.x >= cx * CHUNK && d.x < (cx + 1) * CHUNK);
        assert.ok(d.y >= cy * CHUNK && d.y < (cy + 1) * CHUNK);
      }
      for (const c of chunk.cats) {
        cats++;
        assert.ok(c.x >= cx * CHUNK && c.x < (cx + 1) * CHUNK);
        assert.ok(c.y >= cy * CHUNK && c.y < (cy + 1) * CHUNK);
      }
    }
  }
  assert.ok(dumpsters > 0 && cats > 0, 'both encounters exist somewhere');
  assert.ok(dumpsters < N * N * 0.06 && cats < N * N * 0.06, 'both stay rare');
});

test('dumpsters block movement', () => {
  const w = new World(33);
  const chunk = w.chunkAt(0, 0);
  chunk.dumpsters.push({ x: 50, y: 50 });
  assert.ok(w.collides(48, 48, 4, 3), 'solid at the base');
  assert.equal(w.collides(50, 70, 4, 3), false, 'open ground below');
});

// --- D&D: HP, damage, healing ----------------------------------------------

test('the person starts at 10 HP and fetch heals', () => {
  const g = new Game(1, { story: false });
  assert.equal(g.hp, MAX_HP);
  g.hp = 4;
  g.heal(1);
  assert.equal(g.hp, 5);
  g.hp = MAX_HP;
  g.heal(3);
  assert.equal(g.hp, MAX_HP, 'healing caps at max');
});

test('collapse at 0 HP: the dog watches over you, back at 5', () => {
  const g = new Game(1, { story: false });
  g.hp = 1;
  g.damage(1);
  assert.equal(g.hp, COLLAPSE_HP);
  assert.equal(g.caption.text, 'YOU COLLAPSE. THE DOG WATCHES OVER YOU');
  assert.ok(g.glitch.t > 0.35, 'collapse glitches hard');
});

// --- Encounter menus --------------------------------------------------------

test('walking up to a burning dumpster opens the choice menu and freezes the walk', () => {
  const g = encounterGame('dumpster');
  const choice = walkUntilChoice(g);
  assert.ok(choice, 'menu opened');
  assert.equal(choice.kind, 'dumpster');
  assert.equal(choice.title, 'A DUMPSTER BURNS IN THE DARK');
  assert.equal(choice.options.length, 3);
  const px = g.person.x;
  g.update(STEP, { right: true });
  assert.equal(g.person.x, px, 'movement frozen while the menu is open');
});

test('menu navigation: up/down are edge-triggered, action confirms', () => {
  const g = encounterGame('dumpster');
  walkUntilChoice(g);
  assert.equal(g.choiceIndex, 0);
  g.update(STEP, { down: true });
  assert.equal(g.choiceIndex, 1);
  g.update(STEP, { down: true }); // held — no repeat
  assert.equal(g.choiceIndex, 1);
  g.update(STEP, {});
  g.update(STEP, { up: true });
  assert.equal(g.choiceIndex, 0);
  g.update(STEP, {});
  g.choiceIndex = 2; // WALK AWAY
  g.update(STEP, { action: true });
  assert.equal(g.choice, null, 'action resolves the menu');
});

test('search success: d20 shown, +1 HP, dumpster spent', () => {
  const g = encounterGame('dumpster');
  const choice = walkUntilChoice(g);
  g.hp = 5;
  g.rng = () => 0.99; // roll 20
  g.resolveChoice('search');
  assert.equal(g.hp, 6);
  assert.equal(g.caption.text, `D20: 20 - YOU FIND A WARM BONE (+1 HP)`);
  assert.ok(g.encounterDone.has(choice.key), 'no second search');
});

test('search failure burns you', () => {
  const g = encounterGame('dumpster');
  walkUntilChoice(g);
  g.hp = 5;
  g.rng = () => 0; // roll 1
  g.resolveChoice('search');
  assert.equal(g.hp, 4);
  assert.match(g.caption.text, /^D20: 1 - THE FIRE BITES YOU/);
});

test('smothering the fire: DC 15, success puts it out for good', () => {
  const g = encounterGame('dumpster');
  const choice = walkUntilChoice(g);
  g.rng = () => 0.99; // roll 20 >= DC_SMOTHER
  g.resolveChoice('putout');
  assert.ok(g.dumpstersOut.has(choice.key), 'fire is out');
  assert.ok(g.encounterDone.has(choice.key));
  assert.match(g.caption.text, /SOMEHOW YOU SMOTHER IT/);
  assert.ok(DC_SMOTHER > DC_SEARCH, 'smothering is the harder check');
});

test('failed smothering is harmless and retryable after walking away', () => {
  const g = encounterGame('dumpster');
  const choice = walkUntilChoice(g);
  g.hp = 7;
  g.rng = () => 0.5; // roll 11 < 15
  g.resolveChoice('putout');
  assert.equal(g.hp, 7, 'no damage');
  assert.equal(g.encounterDone.has(choice.key), false, 'not spent');
  // Still standing next to it: cooldown holds the menu shut.
  runSeconds(g, 1.5);
  assert.equal(g.choice, null, 'cooldown prevents instant re-open');
  // Walk far away and back: it re-arms.
  runSeconds(g, 2.5, { left: true });
  const reopened = walkUntilChoice(g, 8);
  assert.ok(reopened, 're-armed after leaving');
});

test('the psychedelic cat: talking makes him vanish, unharmed', () => {
  const g = encounterGame('cat');
  const choice = walkUntilChoice(g);
  assert.equal(choice.title, 'A PSYCHEDELIC CAT REGARDS YOU');
  g.hp = 8;
  g.resolveChoice('talk');
  assert.equal(g.hp, 8, 'no scratch');
  assert.equal(g.caption.text, 'THE CAT DISSOLVES INTO STATIC');
  assert.ok(g.encounterDone.has(choice.key), 'the cat is gone for good');
});

test('the psychedelic cat: anything else earns a scratch (-1 HP)', () => {
  for (const id of ['pet', 'grab']) {
    const g = encounterGame('cat');
    const choice = walkUntilChoice(g);
    g.hp = 8;
    g.resolveChoice(id);
    assert.equal(g.hp, 7, `${id} gets scratched`);
    assert.equal(g.caption.text, 'THE CAT SCRATCHES YOU (-1 HP) AND VANISHES');
    assert.ok(g.encounterDone.has(choice.key));
    runSeconds(g, 1.5);
    assert.equal(g.choice, null, 'a vanished cat never reopens the menu');
  }
});

test('the dog walks past encounters unbothered', () => {
  const g = encounterGame('dumpster');
  g.update(STEP, { swap: true }); // control the dog
  g.update(STEP, {});
  const steps = Math.ceil(6 / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, { right: true });
  assert.equal(g.choice, null, 'no menu while playing the dog');
});
