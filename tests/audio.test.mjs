import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, EVENT_NAMES } from '../src/audio/sfx.js';
import { AudioPlayer } from '../src/audio/engine.js';
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

const WAVES = ['square', 'triangle', 'sawtooth', 'sine'];

test('every sound is a well-formed list of soft, short segments', () => {
  for (const [name, segments] of Object.entries(SOUNDS)) {
    assert.ok(Array.isArray(segments) && segments.length > 0, `${name} empty`);
    for (const s of segments) {
      assert.ok(s.type === 'tone' || s.type === 'noise', `${name}: type '${s.type}'`);
      if (s.type === 'tone') assert.ok(WAVES.includes(s.wave), `${name}: wave '${s.wave}'`);
      assert.ok(s.f0 >= 40 && s.f0 <= 4000, `${name}: f0 ${s.f0}`);
      if (s.f1 !== undefined) assert.ok(s.f1 >= 40 && s.f1 <= 4000, `${name}: f1 ${s.f1}`);
      assert.ok(s.d > 0 && s.d <= 1, `${name}: duration ${s.d}`);
      assert.ok(s.v > 0 && s.v <= 0.2, `${name}: volume ${s.v} (keep it soft)`);
      if (s.t !== undefined) assert.ok(s.t >= 0 && s.t < 1, `${name}: offset ${s.t}`);
    }
    const end = Math.max(...segments.map((s) => (s.t ?? 0) + s.d));
    assert.ok(end <= 1.2, `${name} runs ${end}s — chip sounds stay short`);
  }
});

test('footsteps are the quietest things in the forest', () => {
  const stepVol = Math.max(...SOUNDS['step-person'].map((s) => s.v));
  for (const name of ['meet', 'deliver', 'damage', 'menu-open']) {
    const vol = Math.max(...SOUNDS[name].map((s) => s.v));
    assert.ok(stepVol < vol, `${name} should be louder than a footstep`);
  }
});

// --- The engine (fake AudioContext) ----------------------------------------

function fakeContext() {
  const made = { oscillators: 0, noises: 0, gains: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const node = () => ({ connect() {} });
  const ctx = {
    made,
    currentTime: 0,
    sampleRate: 22050,
    state: 'running',
    destination: {},
    resume() {},
    createGain() {
      made.gains++;
      return { ...node(), gain: param() };
    },
    createOscillator() {
      made.oscillators++;
      return { ...node(), type: '', frequency: param(), start() {}, stop() {} };
    },
    createBufferSource() {
      made.noises++;
      return { ...node(), buffer: null, loop: false, start() {}, stop() {} };
    },
    createBiquadFilter() {
      return { ...node(), type: '', Q: param(), frequency: param() };
    },
    createBuffer(channels, len) {
      return { getChannelData: () => new Float32Array(len) };
    },
  };
  return ctx;
}

test('the engine synthesizes every sound without throwing', () => {
  const ctx = fakeContext();
  const player = new AudioPlayer(() => ctx);
  player.resume();
  for (const name of EVENT_NAMES) player.play(name);
  assert.ok(ctx.made.oscillators > 0, 'tones were scheduled');
  assert.ok(ctx.made.noises > 0, 'noise was scheduled');
});

test('muted or unresumed players stay silent, and resume() is idempotent', () => {
  const ctx = fakeContext();
  const player = new AudioPlayer(() => ctx);
  player.play('meet'); // before resume — no context yet
  assert.equal(ctx.made.oscillators, 0);
  player.resume();
  player.resume(); // second resume must not rebuild
  assert.equal(ctx.made.gains, 1, 'one master gain');
  player.muted = true;
  player.play('meet');
  assert.equal(ctx.made.oscillators, 0, 'muted plays nothing');
  player.play('not-a-sound'); // unknown names are ignored
});

test('drunk intensity plays louder but never past the safety clamp', () => {
  const ctx = fakeContext();
  const peaks = [];
  const origCreateGain = ctx.createGain.bind(ctx);
  ctx.createGain = () => {
    const g = origCreateGain();
    g.gain.setValueAtTime = (v) => peaks.push(v);
    return g;
  };
  const player = new AudioPlayer(() => ctx);
  player.resume();
  player.play('damage');
  const sober = Math.max(...peaks);
  peaks.length = 0;
  player.intensity = 1.7;
  player.play('damage');
  const drunk = Math.max(...peaks);
  assert.ok(drunk > sober, 'the colors and sounds lean closer');
  assert.ok(drunk <= 0.25, 'still inside the clamp');
  peaks.length = 0;
  player.intensity = 100;
  player.play('damage');
  assert.ok(Math.max(...peaks) <= 0.25, 'the clamp is absolute');
});

test('the noise buffer is deterministic and built once', () => {
  const player = new AudioPlayer(fakeContext);
  player.resume();
  const a = player.noiseBuffer();
  const b = player.noiseBuffer();
  assert.equal(a, b);
});

// --- The game emits the right events ---------------------------------------

test('walking emits paced footsteps for both characters', () => {
  const g = openGame();
  g.events.length = 0;
  runSeconds(g, 2, { right: true });
  const personSteps = g.events.filter((e) => e === 'step-person').length;
  assert.ok(personSteps >= 3, `person stepped (${personSteps})`);
  // The dog followed once the leash stretched — it walks too.
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
  // Play through everything noisy and check each event maps to the table.
  const g = openGame();
  runSeconds(g, 1, { right: true });
  g.update(STEP, { swap: true });
  g.update(STEP, {});
  g.update(STEP, { swap: true });
  g.update(STEP, {});
  g.update(STEP, { action: true }); // throw
  runSeconds(g, 15); // full fetch: pickup + deliver
  g.world.chunkAt(0, 0).dumpsters.push({ x: g.person.x + 10, y: g.person.y });
  runSeconds(g, 1); // menu opens
  g.update(STEP, { down: true }); // menu-move
  g.rng = () => 0; // failed search: roll + damage
  g.resolveChoice('search');
  runSeconds(g, 0.5);
  assert.ok(g.events.length > 0);
  for (const e of g.events) {
    assert.ok(e in SOUNDS, `event '${e}' has no sound`);
  }
});

test('captions blip and whimpers whimper', () => {
  const g = new Game(1); // story mode: opening caption already shown
  assert.ok(g.events.includes('caption'), 'the opening line blipped');
  g.world.collides = () => false;
  g.dog.x = g.person.x + 200;
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
  g.person.x = g.dog.x - 20;
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
