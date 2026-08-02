// Audio, v0.16: the game no longer synthesizes its own sounds — it names
// effects in the 8bit-sfx library and plays what the vendored engine renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, EVENT_NAMES } from '../src/audio/sfx.js';
import { AudioPlayer } from '../src/audio/engine.js';
import { render, rpgNames, SR } from '../vendor/8bit-sfx/index.js';
import { Game } from '../src/core/game.js';

const STEP = 1 / 60;
const IDLE = {};

function runSeconds(g, seconds, input = IDLE) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

function openGame(seed = 1) {
  const g = new Game(seed, { story: false });
  g.world.collides = () => false;
  return g;
}

// --- The sound table --------------------------------------------------------

test('every game event names a real 8bit-sfx effect at a sane gain', () => {
  const known = new Set(rpgNames());
  for (const [event, sound] of Object.entries(SOUNDS)) {
    assert.ok(known.has(sound.name), `${event} -> unknown effect ${sound.name}`);
    assert.ok(sound.gain > 0 && sound.gain <= 1, `${event}: gain ${sound.gain}`);
  }
  assert.equal(EVENT_NAMES.length, Object.keys(SOUNDS).length);
});

test('footsteps are the quietest things in the forest', () => {
  const step = SOUNDS['step-person'].gain;
  for (const name of ['meet', 'deliver', 'damage', 'menu-open', 'battle-start']) {
    assert.ok(step < SOUNDS[name].gain, `${name} should be louder than a footstep`);
  }
});

test('the vendored engine renders every effect the game asks for', () => {
  for (const event of EVENT_NAMES) {
    const samples = render(SOUNDS[event].name);
    assert.ok(samples.length > 0, `${event}: empty`);
    assert.ok(samples.length < SR * 3, `${event}: ${(samples.length / SR).toFixed(2)}s is too long`);
    let peak = 0;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak > 0.01, `${event}: silent`);
    assert.ok(peak <= 1.001, `${event}: clips at ${peak}`);
  }
});

// --- The player (fake AudioContext) ----------------------------------------

function fakeContext() {
  const made = { sources: 0, gains: 0, buffers: 0, started: 0 };
  const ctx = {
    made,
    currentTime: 0,
    sampleRate: 22050,
    state: 'running',
    destination: {},
    resume() {},
    createGain() {
      made.gains++;
      return { connect() {}, gain: { value: 0 } };
    },
    createBufferSource() {
      made.sources++;
      return {
        connect() {},
        buffer: null,
        start() {
          made.started++;
        },
      };
    },
    createBuffer(channels, len, rate) {
      made.buffers++;
      const data = new Float32Array(len);
      return { length: len, sampleRate: rate, getChannelData: () => data };
    },
  };
  return ctx;
}

test('the player renders, caches, and plays every game sound', () => {
  const ctx = fakeContext();
  const player = new AudioPlayer(() => ctx);
  player.resume();
  for (const name of EVENT_NAMES) player.play(name);
  assert.equal(ctx.made.started, EVENT_NAMES.length, 'every event played');
  assert.equal(ctx.made.buffers, EVENT_NAMES.length, 'one buffer per distinct effect');
  const before = ctx.made.buffers;
  for (const name of EVENT_NAMES) player.play(name);
  assert.equal(ctx.made.buffers, before, 'second pass is served from the cache');
});

test('muted or unresumed players stay silent, and resume() is idempotent', () => {
  const ctx = fakeContext();
  const player = new AudioPlayer(() => ctx);
  player.play('meet'); // before resume — no context yet
  assert.equal(ctx.made.started, 0);
  player.resume();
  player.resume(); // second resume must not rebuild
  assert.equal(ctx.made.gains, 1, 'one master gain');
  player.muted = true;
  player.play('meet');
  assert.equal(ctx.made.started, 0, 'muted plays nothing');
  player.muted = false;
  player.play('not-a-sound'); // unknown names are ignored
  assert.equal(ctx.made.started, 0);
});

test('drunk intensity plays louder but never past full scale', () => {
  const ctx = fakeContext();
  const gains = [];
  const origGain = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const g = origGain();
    Object.defineProperty(g.gain, 'value', { set: (v) => gains.push(v), get: () => 0 });
    return g;
  };
  const player = new AudioPlayer(() => ctx);
  player.resume();
  gains.length = 0;
  player.play('caption'); // a quiet one, with headroom to lean into
  const sober = gains.at(-1);
  player.intensity = 1.7;
  player.play('caption');
  const drunk = gains.at(-1);
  assert.ok(drunk > sober, 'the colors and sounds lean closer');
  player.intensity = 100;
  player.play('caption');
  assert.ok(gains.at(-1) <= 1, 'the clamp is absolute');
  player.play('damage'); // already at full gain sober — cannot exceed it
  assert.ok(gains.at(-1) <= 1);
});

// --- The game emits the right events ---------------------------------------

test('walking emits paced footsteps for both characters', () => {
  const g = openGame();
  g.events.length = 0;
  runSeconds(g, 2, { right: true });
  const personSteps = g.events.filter((e) => e === 'step-person').length;
  assert.ok(personSteps >= 3, `person stepped (${personSteps})`);
  const dogSteps = g.events.filter((e) => e === 'step-dog').length;
  assert.ok(dogSteps >= 1, `dog pattered (${dogSteps})`);
});

test('standing still is silent', () => {
  const g = openGame();
  runSeconds(g, 4); // greeting expires, nobody moves
  g.events.length = 0;
  runSeconds(g, 2);
  assert.deepEqual(g.events, []);
});

test('every emitted event name has a sound', () => {
  const g = openGame();
  runSeconds(g, 1, { right: true });
  g.update(STEP, { swap: true });
  g.update(STEP, {});
  g.update(STEP, { swap: true });
  g.update(STEP, {});
  g.update(STEP, { action: true }); // throw
  runSeconds(g, 15); // full fetch: pickup + deliver
  g.world.chunkAt(0, 0).dumpsters.push({ x: g.person.x + 15, y: g.person.y });
  runSeconds(g, 1); // menu opens
  g.update(STEP, { down: true }); // menu-move
  g.rng = () => 0; // failed search: roll + damage
  g.resolveChoice('search');
  runSeconds(g, 0.5);
  g.learnSpell(); // spell-learn
  g.castSpell('ember'); // spell-cast
  assert.ok(g.events.length > 0);
  for (const e of g.events) {
    assert.ok(e in SOUNDS, `event '${e}' has no sound`);
  }
});

test('captions blip and whimpers whimper', () => {
  const g = new Game(1); // story mode: opening caption already shown
  assert.ok(g.events.includes('caption'), 'the opening line blipped');
  g.world.collides = () => false;
  g.dog.x = g.person.x + 300;
  g.dog.y = g.person.y;
  runSeconds(g, 2 * 3.2 + 0.3);
  g.events.length = 0;
  g.hintTimer = 11.99;
  runSeconds(g, 0.3);
  assert.ok(g.events.includes('whimper'), 'the hint whimpers instead of blipping');
});

test('the big beats emit their signature sounds', () => {
  const g = new Game(1);
  g.world.collides = () => false;
  g.person.x = g.dog.x - 30;
  g.person.y = g.dog.y;
  g.events.length = 0;
  g.update(STEP, IDLE);
  assert.ok(g.events.includes('meet'));

  const g2 = openGame();
  g2.hp = 1;
  g2.events.length = 0;
  g2.damage(1);
  assert.ok(g2.events.includes('damage'));
  assert.ok(g2.events.includes('collapse'));
});

test('the event queue is capped so undrained games cannot grow it forever', () => {
  const g = openGame();
  for (let i = 0; i < 200; i++) g.emit('caption');
  assert.ok(g.events.length <= 32);
});
