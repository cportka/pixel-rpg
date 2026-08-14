import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, MAX_HP, COLLAPSE_HP, ABILITIES,
  DC_SEARCH, DC_SMOTHER, DC_GENIE, DC_VISION, DC_COUGH, DRUNK_TIME, SPELLS,
} from '../src/core/game.js';
import { World, generateChunk, CHUNK } from '../src/core/world.js';
import {
  DUMPSTER_SPRITE, DUMPSTER_COLORS, CAT_SPRITE, PSYCHE_CYCLE, firePixels, catRowColor,
  LAMP_SPRITE, LAMP_COLORS, PIPE_SPRITE, PIPE_COLORS, lampGlintPixels, pipeSmokePixels,
} from '../src/gfx/encounters.js';
import { targetMarkerPixels, MARKER_NEON } from '../src/gfx/effects.js';
import { PALETTE } from '../src/gfx/palette.js';

const STEP = 1 / 60;
const IDLE = {};

function runSeconds(g, seconds, input = IDLE) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

const KIND_FIELDS = { dumpster: 'dumpsters', cat: 'cats', lamp: 'lamps', pipe: 'pipes' };

/**
 * A together game on an open field with one planted encounter next door.
 * Stats are flattened to 10 (modifier 0) so the rng-stubbed roll thresholds
 * and exact "D20: n" captions below stay seed-independent.
 */
function encounterGame(kind, x = 40, y = 0) {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5); // let the greeting caption clear
  g.world.chunkAt(0, 0)[KIND_FIELDS[kind]].push({ x, y, phase: 0 });
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

test('the move marker is a neon ring collapsing onto the target', () => {
  assert.deepEqual(targetMarkerPixels(0.2), targetMarkerPixels(0.2), 'deterministic');
  assert.notDeepEqual(targetMarkerPixels(0), targetMarkerPixels(0.31), 'it pulses');
  const early = targetMarkerPixels(0.01); // ring freshly snapped out
  const late = targetMarkerPixels(0.55); // most of the way collapsed
  const spread = (pts) => Math.max(...pts.map((p) => Math.abs(p.x)));
  assert.ok(spread(early) > spread(late), 'the ring contracts toward the tap');
  for (const t of [0.05, 0.2, 0.4]) {
    const pts = targetMarkerPixels(t);
    const neon = new Set([...MARKER_NEON.ring, MARKER_NEON.trail, MARKER_NEON.core, MARKER_NEON.ping]);
    for (const p of pts) {
      assert.ok(neon.has(p.c), `every pixel is neon (got ${p.c})`);
      assert.ok(Math.abs(p.x) <= 14 && Math.abs(p.y) <= 10, 'stays tight around the target');
    }
    assert.ok(
      Math.max(...pts.map((p) => Math.abs(p.y))) < Math.max(...pts.map((p) => Math.abs(p.x))),
      'squashed into a ground ellipse, not a floating circle',
    );
    assert.ok(pts.some((p) => p.x === 0 && p.y === 0), 'a hot core at the tap point');
    assert.ok(pts.some((p) => p.c === MARKER_NEON.trail), 'the magenta ghost trails it');
    for (const c of MARKER_NEON.ring) {
      assert.ok(pts.some((p) => p.c === c), 'both rim neons present');
    }
  }
  assert.ok(
    targetMarkerPixels(0.05).some((p) => p.c === MARKER_NEON.ping),
    'a moonlit ping greets each fresh ring',
  );
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
  assert.equal(choice.options.length, 4);
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

test('search success: d20 shown, a meaty bone, and a gnaw-or-save menu', () => {
  const g = encounterGame('dumpster');
  const choice = walkUntilChoice(g);
  g.rng = () => 0.99; // roll 20
  g.resolveChoice('search');
  assert.equal(g.caption.text, 'D20: 20 - YOU PULL OUT A MEATY BONE');
  assert.ok(g.hasBone && g.boneMeat, 'the bone is yours, meat and all');
  assert.ok(g.encounterDone.has(choice.key), 'no second search');
  assert.ok(g.choice, 'the bone menu chained open');
  assert.equal(g.choice.kind, 'bone');
  assert.equal(g.choice.options.length, 4);
  g.hp = 5;
  g.resolveChoice('eat');
  assert.equal(g.hp, 7, 'gnawing the meat heals +2');
  assert.equal(g.boneMeat, false);
  assert.ok(g.hasBone, 'the bone remains a club');
  assert.equal(g.caption.text, 'YOU GNAW OFF THE MEAT (+2 HP). THE BONE REMAINS');
});

test('saving the bone keeps the meat for later', () => {
  const g = encounterGame('dumpster');
  walkUntilChoice(g);
  g.hp = 5;
  g.rng = () => 0.99;
  g.resolveChoice('search');
  g.resolveChoice('save');
  assert.equal(g.caption.text, 'YOU POCKET THE MEATY BONE');
  assert.ok(g.hasBone && g.boneMeat, 'meat intact');
  assert.equal(g.hp, 5, 'no healing until you gnaw it');
  assert.equal(g.choice, null);
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

// --- The genie lamp ---------------------------------------------------------

test('a failed rub finds only dust, and the lamp can be tried again', () => {
  const g = encounterGame('lamp');
  const choice = walkUntilChoice(g);
  assert.equal(choice.title, 'AN OLD LAMP GLINTS IN THE LITTER');
  g.rng = () => 0; // roll 1 < DC_GENIE
  g.resolveChoice('rub');
  assert.equal(g.choice, null, 'no genie this time');
  assert.match(g.caption.text, /^D20: 1 - ONLY DUST/);
  assert.equal(g.encounterDone.has(choice.key), false, 'lamp not spent');
});

test('a good rub summons the genie: chained wish menu on the same key', () => {
  const g = encounterGame('lamp');
  const choice = walkUntilChoice(g);
  g.rng = () => 0.99; // roll 20 >= DC_GENIE
  g.resolveChoice('rub');
  assert.ok(g.choice, 'the wish menu opened immediately');
  assert.equal(g.choice.kind, 'genie');
  assert.equal(g.choice.key, choice.key);
  assert.equal(g.choice.title, 'THE GENIE OFFERS ONE WISH');
  assert.equal(g.choice.options.length, 3);
  assert.match(g.caption.text, /A GENIE BILLOWS OUT IN VIOLET SMOKE/);
  assert.ok(DC_GENIE >= 10 && DC_GENIE < DC_SMOTHER, 'genie sits between the dumpster DCs');
});

test('wishing for health restores full HP and spends the lamp', () => {
  const g = encounterGame('lamp');
  const choice = walkUntilChoice(g);
  g.hp = 2;
  g.rng = () => 0.99;
  g.resolveChoice('rub');
  g.resolveChoice('health');
  assert.equal(g.hp, MAX_HP);
  assert.equal(g.caption.text, 'YOUR WOUNDS UNWIND (FULL HP)');
  assert.ok(g.encounterDone.has(choice.key), 'lamp gone for good');
  runSeconds(g, 1.5);
  assert.equal(g.choice, null, 'no menu over a spent lamp');
});

test('wishing for home reveals the seed-fixed home direction', () => {
  const g = encounterGame('lamp');
  walkUntilChoice(g);
  g.rng = () => 0.99;
  g.resolveChoice('rub');
  g.resolveChoice('home');
  const dir = g.homeCompass();
  assert.ok(['NORTH', 'SOUTH', 'EAST', 'WEST'].includes(dir));
  assert.equal(g.caption.text, `THE GENIE POINTS. HOME IS FAR TO THE ${dir}`);
  const g2 = new Game(1, { story: false });
  assert.equal(g2.homeCompass(), dir, 'home direction is fixed per seed');
});

test('wishing for more wishes gets you nothing at all', () => {
  const g = encounterGame('lamp');
  const choice = walkUntilChoice(g);
  g.hp = 4;
  g.rng = () => 0.99;
  g.resolveChoice('rub');
  g.resolveChoice('wishes');
  assert.equal(g.hp, 4, 'nothing gained');
  assert.equal(g.caption.text, 'THE GENIE ROLLS HIS EYES AND VANISHES');
  assert.ok(g.encounterDone.has(choice.key), 'and the lamp is gone anyway');
});

// --- The pipe ---------------------------------------------------------------

test('smoking the pipe, high roll: a vision, a long glitch, ten drunk minutes', () => {
  const g = encounterGame('pipe');
  const choice = walkUntilChoice(g);
  assert.equal(choice.title, 'A PIPE OF HALF-BURNT GREEN LEAF');
  g.rng = () => 0.99; // roll 20 >= DC_VISION
  g.resolveChoice('smoke');
  assert.match(g.caption.text, /^D20: 20 - THE STARS LEAN CLOSER/);
  assert.ok(g.captionQueue.includes('A VISION: THE INFLATABLES DANCE AT THE CENTER OF ALL THINGS'));
  assert.ok(g.captionQueue.includes('THE COLORS LEAN CLOSER TOO (DRUNK 10:00)'));
  assert.equal(g.drunk, DRUNK_TIME, 'ten minutes of inebriation');
  assert.ok(g.glitch.dur >= 1, 'the long psychedelic glitch');
  assert.ok(g.encounterDone.has(choice.key), 'one bowl only');
});

test('smoking the pipe, low roll: the smoke goes nowhere — and never hurts you', () => {
  const g = encounterGame('pipe');
  walkUntilChoice(g);
  g.hp = 6;
  g.rng = () => 0; // roll 1 <= DC_COUGH
  g.resolveChoice('smoke');
  assert.equal(g.hp, 6, 'the leaf is a teacher, not a wound');
  assert.match(g.caption.text, /^D20: 1 - THE SMOKE GOES NOWHERE/);
  assert.ok(g.captionQueue.includes('NO VISION. THE PIPE IS SPENT'));
  assert.equal(g.drunk, 0, 'no inebriation without a vision');
  assert.deepEqual(g.spells, [], 'and no spell either');
});

test('a vision teaches the first spell in the book', () => {
  const g = encounterGame('pipe');
  walkUntilChoice(g);
  g.hp = 6;
  g.events.length = 0;
  g.rng = () => 0.99; // roll 20 >= DC_VISION
  g.resolveChoice('smoke');
  assert.equal(g.hp, 6, 'still no damage on the way up');
  assert.deepEqual(g.spells, [SPELLS[0].id], 'the leaf hands over EMBER');
  assert.equal(g.focus, g.maxFocus(), 'and tops you up');
  assert.ok(g.events.includes('spell-learn'));
  assert.ok(
    g.captionQueue.some((l) => l.startsWith(`YOU LEARN ${SPELLS[0].name}`)),
    'the vision names what it taught',
  );
});

test('smoking the pipe, middle roll: probably oak leaf', () => {
  const g = encounterGame('pipe');
  walkUntilChoice(g);
  g.hp = 6;
  g.rng = () => 0.5; // roll 11 — between the bands
  g.resolveChoice('smoke');
  assert.equal(g.hp, 6, 'harmless');
  assert.match(g.caption.text, /^D20: 11 - NOTHING. PROBABLY OAK LEAF/);
  assert.ok(g.captionQueue.includes('THE PIPE IS SPENT'));
  assert.equal(g.drunk, 0, 'oak leaf does nothing');
  assert.ok(DC_COUGH < DC_VISION, 'the bands are ordered');
});

test('sniffing is harmless and does not spend the pipe', () => {
  const g = encounterGame('pipe');
  const choice = walkUntilChoice(g);
  g.hp = 6;
  g.resolveChoice('sniff');
  assert.equal(g.hp, 6);
  assert.equal(g.caption.text, 'IT SMELLS LIKE REGRET AND LAWN CLIPPINGS');
  assert.equal(g.encounterDone.has(choice.key), false);
});

test('lamp and pipe art: sprites well-formed, glint and wisps animate', () => {
  for (const [sprite, colors] of [[LAMP_SPRITE, LAMP_COLORS], [PIPE_SPRITE, PIPE_COLORS]]) {
    for (const row of sprite) {
      assert.equal(row.length, sprite[0].length);
      for (const ch of row) assert.ok(ch === '.' || ch in colors, `unknown '${ch}'`);
    }
  }
  assert.deepEqual(pipeSmokePixels(1.1), pipeSmokePixels(1.1));
  assert.notDeepEqual(pipeSmokePixels(1.1), pipeSmokePixels(1.6), 'wisps drift');
  let flashes = 0;
  for (let t = 0; t < 6; t += 0.05) if (lampGlintPixels(t).length > 0) flashes++;
  assert.ok(flashes > 0, 'the lamp glints sometimes');
  assert.ok(flashes < 40, '...but only sometimes');
});

test('lamps and pipes generate rarely and inside their chunks', () => {
  let lamps = 0;
  let pipes = 0;
  const N = 40;
  for (let cx = 0; cx < N; cx++) {
    for (let cy = 0; cy < N; cy++) {
      const chunk = generateChunk(33, cx, cy);
      for (const l of chunk.lamps) {
        lamps++;
        assert.ok(l.x >= cx * CHUNK && l.x < (cx + 1) * CHUNK);
        assert.ok(l.y >= cy * CHUNK && l.y < (cy + 1) * CHUNK);
      }
      for (const p of chunk.pipes) {
        pipes++;
        assert.ok(p.x >= cx * CHUNK && p.x < (cx + 1) * CHUNK);
        assert.ok(p.y >= cy * CHUNK && p.y < (cy + 1) * CHUNK);
      }
    }
  }
  assert.ok(lamps > 0 && pipes > 0, 'both exist somewhere');
  assert.ok(lamps < N * N * 0.05 && pipes < N * N * 0.05, 'both stay rare');
});

test('the dog walks past encounters unbothered', () => {
  const g = encounterGame('dumpster');
  g.update(STEP, { swap: true }); // control the dog
  g.update(STEP, {});
  const steps = Math.ceil(6 / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, { right: true });
  assert.equal(g.choice, null, 'no menu while playing the dog');
});
