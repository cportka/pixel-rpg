// The television and heaven (v0.17): the plane behind the mansion's glass —
// rose and gold, angels where the zombies were, cathedrals where the
// dumpsters burned, and Cerberus beckoning you back across the Styx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, ABILITIES, MEET_RADIUS, HEAVEN_SEED_SALT, BASK_HEAL, MAX_HP,
} from '../src/core/game.js';
import { FURNISH, nearTelevision } from '../src/core/mansion.js';
import { isWater, riverNear } from '../src/core/terrain.js';
import { PALETTE, HEAVEN, heavenColor, HEAVEN_SPARKLES } from '../src/gfx/palette.js';
import { ANGEL_SPRITE, ANGEL_COLORS, CATHEDRAL_SPRITE, CATHEDRAL_COLORS, angelBob, templeGrowthPixels, ragaPixels } from '../src/gfx/encounters.js';
import { TELEVISION_SPRITE, TELEVISION_COLORS, tvGlowPixels } from '../src/gfx/structures.js';
import { CERBERUS_FRAMES, PERSON_FRAMES, walkFrame, spriteSize, IDLE_SWAY_HZ } from '../src/gfx/sprites.js';
import { Renderer, SCREEN_W, SCREEN_H } from '../src/gfx/renderer.js';
import { EVENT_NAMES } from '../src/audio/sfx.js';

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

// --- The palette ------------------------------------------------------------

test('heaven shadows every night color under the same key', () => {
  assert.deepEqual(Object.keys(HEAVEN).sort(), Object.keys(PALETTE).sort());
  for (const k of Object.keys(PALETTE)) {
    assert.equal(heavenColor(PALETTE[k]), HEAVEN[k], k);
  }
  assert.equal(heavenColor('#123456'), '#123456', 'unknown colors pass through');
  assert.notEqual(HEAVEN.void, PALETTE.void, 'the void turns to light');
  assert.ok(HEAVEN_SPARKLES.length >= 3, 'heaven has its own gold dust');
});

test('heaven inverts the values: light ground, ink figures, shadows that still work', () => {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };
  assert.ok(lum(HEAVEN.void) > 200, 'the ground is bright cream');
  assert.ok(lum(HEAVEN.moonlight) < 90, 'figures and words are ink');
  assert.ok(lum(HEAVEN.umbra) < lum(HEAVEN.void), 'shadows fall darker than the ground');
  assert.ok(lum(HEAVEN.gold) > lum(PALETTE.gold), 'gold only gets warmer');
});

// --- The television ---------------------------------------------------------

test('the parlor holds a television, and its menu offers the way up', () => {
  const tv = FURNISH.find((f) => f.kind === 'television');
  assert.ok(tv, 'the set is furnished');
  assert.ok(tv.solid, 'you cannot walk through it (only into it)');
  assert.ok(nearTelevision(tv.x, tv.y + 40));
  assert.equal(nearTelevision(tv.x - 200, tv.y), false);
  const g = tvGame();
  g.heard = [];
  const steps = Math.ceil(1 / STEP);
  for (let i = 0; i < steps && !g.choice; i++) {
    g.update(STEP, {});
    g.heard.push(...g.events);
    g.events.length = 0;
  }
  assert.equal(g.choice?.kind, 'tv');
  assert.equal(g.choice.title, 'AN OLD TELEVISION, WARM WITH ROSE LIGHT');
  assert.deepEqual(g.choice.options.map((o) => o.id), ['inside', 'channel', 'away']);
  assert.ok(g.heard.includes('tv'), 'the set hums as you come near');
});

test('every channel is the same warm light', () => {
  const g = tvGame();
  runSeconds(g, 0.1);
  g.resolveChoice('channel');
  assert.equal(g.caption.text, 'EVERY CHANNEL IS THE SAME WARM LIGHT');
  assert.equal(g.plane, 'night', 'changing channels is not stepping inside');
});

test('stepping away holds the menu until you actually walk off', () => {
  const g = tvGame();
  runSeconds(g, 0.1);
  g.resolveChoice('away');
  assert.equal(g.choice, null);
  runSeconds(g, 0.5);
  assert.equal(g.choice, null, 'the cooldown holds while you stand there');
  g.person.y += 80; // walk away and come back
  runSeconds(g, 0.2);
  g.person.y -= 80;
  runSeconds(g, 0.2);
  assert.equal(g.choice?.kind, 'tv', 'the set re-arms — heaven is patient');
});

// --- The ascent -------------------------------------------------------------

test('stepping inside swaps the whole plane: world, memory, encounters, dog', () => {
  const g = tvGame();
  const nightWorld = g.world;
  const nightMemory = g.memory;
  const nightDone = g.encounterDone;
  runSeconds(g, 0.1);
  g.events.length = 0;
  g.resolveChoice('inside');
  assert.equal(g.plane, 'heaven');
  assert.equal(g.location, 'world', 'heaven opens under the sky');
  assert.notEqual(g.world, nightWorld, 'a different world');
  assert.equal(g.world.seed, (nightWorld.seed ^ HEAVEN_SEED_SALT) >>> 0, 'derived from the night seed');
  assert.notEqual(g.memory, nightMemory, 'a fresh memory');
  assert.notEqual(g.encounterDone, nightDone, 'nothing resolved up here yet');
  assert.equal(g.together, false, 'you arrive alone');
  assert.ok(g.events.includes('ascend'));
  assert.ok(
    g.captionQueue.includes('EVERYTHING UP HERE IS ROSE AND GOLD') ||
      g.caption.text === 'THE GLASS IS NOT GLASS. YOU STEP THROUGH',
  );
});

test('stats, spells, and inventory ride along — they are the soul', () => {
  const g = tvGame();
  g.hasBone = true;
  g.spells.push('ember');
  g.stats.wis = 12;
  g.hp = 7;
  g.xp = 3;
  runSeconds(g, 0.1);
  g.resolveChoice('inside');
  assert.equal(g.hasBone, true);
  assert.deepEqual(g.spells, ['ember']);
  assert.equal(g.stats.wis, 12);
  assert.equal(g.hp, 7);
  assert.equal(g.xp, 3);
});

test('Cerberus waits across the Styx, and the howls point toward him', () => {
  const g = heavenGame();
  const hseed = g.world.seed;
  // He sits on the far side of the river from where you arrive — level with
  // a bridge (the deck is dry, that is the way across), so probe the water
  // a stretch downstream of the deck.
  assert.ok(g.dog.x > g.person.x, 'east of you');
  const river = riverNear(hseed, g.dog.x, g.dog.y);
  assert.ok(
    river.center > g.person.x && river.center < g.dog.x,
    `the Styx runs between you (${g.person.x} < ${Math.round(river.center)} < ${g.dog.x})`,
  );
  const downstream = riverNear(hseed, g.dog.x, g.dog.y + 200);
  assert.ok(isWater(hseed, downstream.center, g.dog.y + 200), 'and it is real water');
  // Drain the arrival lines, then force the next hint tick and catch it.
  runSeconds(g, 11);
  g.caption = null;
  g.captionQueue.length = 0;
  g.hintTimer = 99;
  runSeconds(g, 0.3);
  assert.match(
    g.caption?.text ?? '',
    /THREE-THROATED HOWL ROLLS FROM THE (EAST|WEST|NORTH|SOUTH)/,
    'a howl points the way',
  );
});

test('the Styx announces itself when you first reach the water', () => {
  const g = heavenGame();
  g.person.x = g.dog.x - 130; // just west of the far bank, near the river
  runSeconds(g, 0.5);
  assert.ok(g.styxSeen);
  const heard = [g.caption?.text, ...g.captionQueue].filter(Boolean);
  assert.ok(heard.includes('THE RIVER STYX, SILVER AND PATIENT'));
});

// --- Angels and cathedrals --------------------------------------------------

test('angels are not hostile: no turn-based mode in heaven', () => {
  const g = heavenGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 50, y: g.person.y, phase: 0 });
  runSeconds(g, 1);
  assert.equal(g.mode, 'free', 'nothing up here starts a fight');
  assert.deepEqual(g.hostilesNear(500), []);
});

test('the zombie spot holds an angel, and befriending finally works', () => {
  const g = heavenGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 30, y: g.person.y, phase: 0 });
  g.heard = [];
  const steps = Math.ceil(2 / STEP);
  for (let i = 0; i < steps && !g.choice; i++) {
    g.update(STEP, {});
    g.heard.push(...g.events);
    g.events.length = 0;
  }
  assert.equal(g.choice?.kind, 'angel');
  assert.equal(g.choice.title, 'AN ANGEL CONSIDERS YOU');
  assert.ok(g.heard.includes('blessing'), 'it chimes instead of groaning');
  const hp0 = (g.hp = 8);
  g.resolveChoice('befriend');
  assert.equal(g.hp, hp0, 'no bite. there was never going to be a bite');
  assert.equal(g.caption.text, 'IT WAS NEVER GOING TO BITE YOU');
  assert.ok(g.hearts.length >= 2, 'hearts, at last');
});

test('basking pools light in your chest', () => {
  const g = heavenGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 30, y: g.person.y, phase: 0 });
  runSeconds(g, 1);
  assert.equal(g.choice?.kind, 'angel');
  g.hp = 5;
  g.resolveChoice('bask');
  assert.equal(g.hp, 5 + BASK_HEAL);
  assert.equal(g.caption.text, `LIGHT POOLS IN YOUR CHEST (+${BASK_HEAL} HP)`);
  g.hp = MAX_HP;
  runSeconds(g, 3);
});

test('the dumpster spot holds a cathedral; ragas restore focus; gold grows the spire', () => {
  const g = heavenGame();
  g.world.chunkAt(0, 0).dumpsters.push({ x: g.person.x + 30, y: g.person.y });
  runSeconds(g, 1);
  assert.equal(g.choice?.kind, 'cathedral');
  assert.equal(g.choice.title, 'A CATHEDRAL OF MELTED GOLD');
  g.spells.push('ember');
  g.focus = 0;
  g.events.length = 0;
  g.resolveChoice('listen');
  assert.equal(g.focus, g.maxFocus(), 'the music hands your focus back');
  assert.ok(g.events.includes('raga'));
  // Walk away (past the re-arm distance), return, donate.
  g.person.x += 150;
  runSeconds(g, 0.3);
  g.person.x -= 150;
  runSeconds(g, 0.5);
  assert.equal(g.choice?.kind, 'cathedral', 'cathedrals are never one-shot');
  const before = g.goldGiven;
  g.resolveChoice('gold');
  assert.equal(g.goldGiven, before + 1);
  assert.ok(g.captionQueue.includes('THEY MELT IT IN. THE SPIRE CLIMBS ONE COURSE HIGHER'));
  assert.equal(templeGrowthPixels(g.goldGiven).length, Math.min(8, g.goldGiven) * 2);
});

// --- The descent ------------------------------------------------------------

test('reaching Cerberus carries you back — night resumes exactly where it paused', () => {
  const g = heavenGame();
  const heavenWorld = g.world;
  g.events.length = 0;
  // Skip the pilgrimage: stand beside him.
  g.person.x = g.dog.x - (MEET_RADIUS - 5);
  g.person.y = g.dog.y;
  g.update(STEP, {});
  assert.equal(g.plane, 'night');
  assert.equal(g.location, 'mansion', 'back in the parlor');
  assert.equal(g.together, true, 'the dog is a dog again, at your side');
  assert.ok(g.events.includes('descend'));
  assert.equal(g.caption.text, 'CERBERUS CARRIES YOU DOWN, GENTLE AS A MOTHER');
  // Re-entering resumes the SAME heaven, not a fresh one.
  g.person.y += 80;
  runSeconds(g, 0.2);
  g.person.y -= 80;
  runSeconds(g, 0.2);
  assert.equal(g.choice?.kind, 'tv');
  g.resolveChoice('inside');
  assert.equal(g.world, heavenWorld, 'heaven remembers you');
});

test('in heaven, the television shows the night below — and leads there', () => {
  const g = heavenGame();
  g.world.chunkAt(0, 0).mansions.push({ x: g.person.x, y: g.person.y });
  g.update(STEP, {});
  assert.equal(g.location, 'mansion', 'heaven has mansions too');
  const tv = FURNISH.find((f) => f.kind === 'television');
  g.person.x = tv.x;
  g.person.y = tv.y + 40;
  runSeconds(g, 0.2);
  assert.equal(g.choice?.kind, 'tv');
  assert.equal(g.choice.title, 'THE TELEVISION SHOWS THE NIGHT BELOW');
  g.resolveChoice('inside');
  assert.equal(g.plane, 'night', 'any set is a way home');
});

// --- Art and sound ----------------------------------------------------------

test('heaven art is well-formed: angel, cathedral, television, Cerberus', () => {
  for (const [name, sprite, colors] of [
    ['angel', ANGEL_SPRITE, ANGEL_COLORS],
    ['cathedral', CATHEDRAL_SPRITE, CATHEDRAL_COLORS],
    ['television', TELEVISION_SPRITE, TELEVISION_COLORS],
  ]) {
    for (const row of sprite) {
      assert.equal(row.length, sprite[0].length, `${name}: rectangular`);
      for (const ch of row) assert.ok(ch === '.' || ch in colors, `${name}: unknown '${ch}'`);
    }
  }
  assert.ok(CATHEDRAL_SPRITE.length > 20, 'the cathedral is a real temple');
  const sizes = new Set(Object.values(CERBERUS_FRAMES).map((m) => JSON.stringify(spriteSize(m))));
  assert.equal(sizes.size, 1, 'Cerberus frames share one canvas');
  assert.deepEqual(angelBob(0, 0), angelBob(0, 0), 'the hover is deterministic');
  assert.deepEqual(tvGlowPixels(1.5), tvGlowPixels(1.5), 'so is the static');
  assert.notDeepEqual(tvGlowPixels(1.5), tvGlowPixels(2.7), 'but it does flicker');
  assert.ok(ragaPixels(2).every((p) => p.y < -20), 'the music rises off the roof');
});

test('the ascent has sounds, and they are wired', () => {
  for (const name of ['tv', 'ascend', 'descend', 'raga', 'blessing', 'gold']) {
    assert.ok(EVENT_NAMES.includes(name), `${name} is in the sound map`);
  }
});

// --- Rendering --------------------------------------------------------------

function fakeCanvas(w = SCREEN_W, h = SCREEN_H) {
  const ctx = {
    fillStyle: '#000000',
    ops: { fillRect: 0, drawImage: 0 },
    fills: new Set(),
    fillRect(x, y, rw, rh) {
      this.ops.fillRect++;
      this.fills.add(this.fillStyle);
      void x; void y; void rw; void rh;
    },
    drawImage() { this.ops.drawImage++; },
  };
  return { width: w, height: h, ctx, getContext: () => ctx };
}

test('a heaven frame paints cream and gold, never the night void', () => {
  const g = heavenGame();
  const canvas = fakeCanvas();
  const r = new Renderer(canvas, (w, h) => fakeCanvas(w, h));
  r.render(g);
  assert.ok(canvas.ctx.ops.fillRect > 100, 'heaven painted');
  assert.ok(canvas.ctx.fills.has(HEAVEN.void), 'the ground is cream');
  assert.equal(canvas.ctx.fills.has(PALETTE.void), false, 'no night void leaks through');
  // Descend and render again: the night returns, through the same renderer.
  g.person.x = g.dog.x;
  g.person.y = g.dog.y;
  g.update(STEP, {});
  assert.equal(g.plane, 'night');
  canvas.ctx.fills.clear();
  r.render(g);
  assert.ok(canvas.ctx.fills.has(PALETTE.parquet) || canvas.ctx.fills.has(PALETTE.fog), 'the parlor again');
});

test('tree rasters are cached per plane, so heaven trees are not night trees', () => {
  const g = new Game(5, { story: false });
  const r = new Renderer(fakeCanvas(), (w, h) => fakeCanvas(w, h));
  r.setPlane('night');
  const tree = { kind: 'tree', variant: 'ember', size: 3, detailSeed: 42 };
  const night = r.treeSprite(tree);
  r.setPlane('heaven');
  const heaven = r.treeSprite(tree);
  assert.notEqual(night, heaven, 'two cache entries');
  assert.ok(heaven.canvas.ctx.fills.size > 0);
  for (const c of heaven.canvas.ctx.fills) {
    assert.equal(c, heavenColor(c), `heaven raster color ${c} is a heaven color`);
  }
  void g;
});

// --- The lanky person (v0.17) -----------------------------------------------

test('the person is lanky now: legs are nearly half the silhouette', () => {
  const { w, h } = spriteSize(PERSON_FRAMES.stand);
  assert.ok(h / w >= 2.1, `anime proportions (${w}x${h})`);
  // Count leg rows: from the first row where the silhouette splits in two
  // columns of legs down to the feet.
  const rows = PERSON_FRAMES.stand.map((r) => r.replace(/[^.]/g, 'X'));
  const legStart = rows.findIndex((r) => /X+\.+X+/.test(r.replace(/^\.+|\.+$/g, '')) && rows.indexOf(r) > h / 2);
  assert.ok(h - legStart >= h * 0.4, `long legs (${h - legStart} of ${h} rows)`);
});

test('standing still breathes: a two-frame sway on its own slow clock', () => {
  const stand = walkFrame(PERSON_FRAMES, false, 0, 0);
  const sway = walkFrame(PERSON_FRAMES, false, 0, 1 / IDLE_SWAY_HZ);
  assert.equal(stand, PERSON_FRAMES.stand);
  assert.equal(sway, PERSON_FRAMES.sway);
  assert.notDeepEqual(stand, sway, 'the sway is a different pose');
  assert.equal(walkFrame(PERSON_FRAMES, false, 99, 2 / IDLE_SWAY_HZ), PERSON_FRAMES.stand, 'and it alternates');
});

test('the walk bounces: the down frame sits lower than the pass frame', () => {
  const top = (map) => map.findIndex((row) => [...row].some((ch) => ch !== '.'));
  assert.ok(top(PERSON_FRAMES.downA) >= top(PERSON_FRAMES.passA) + 2, 'a real vertical drop');
  assert.ok(top(PERSON_FRAMES.contactA) > top(PERSON_FRAMES.passA), 'contact sits between');
});
