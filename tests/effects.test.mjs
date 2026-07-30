import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glitchFrame, starPixels, starSize, GLITCH_TIME, GLITCH_TINTS } from '../src/gfx/effects.js';
import { PALETTE } from '../src/gfx/palette.js';
import { Game } from '../src/core/game.js';

const STEP = 1 / 60;

test('glitchFrame is deterministic per (seed, frame) and varies across frames', () => {
  assert.deepEqual(glitchFrame(7, 3, 1, 320, 200), glitchFrame(7, 3, 1, 320, 200));
  assert.notDeepEqual(glitchFrame(7, 3, 1, 320, 200), glitchFrame(7, 4, 1, 320, 200));
  assert.notDeepEqual(glitchFrame(7, 3, 1, 320, 200), glitchFrame(8, 3, 1, 320, 200));
});

test('glitch bands and noise stay in bounds with sane magnitudes', () => {
  for (let frame = 0; frame < 30; frame++) {
    const fx = glitchFrame(123, frame, 1, 320, 200);
    assert.ok(fx.bands.length >= 1, 'at least one band-slip');
    for (const b of fx.bands) {
      assert.ok(b.y >= 0 && b.y + b.h <= 200, 'band inside the screen');
      assert.ok(b.h >= 2 && b.h <= 8, 'band is a thin slice');
      assert.ok(b.dx !== 0 && Math.abs(b.dx) <= 10, 'slip is visible but small');
    }
    for (const n of fx.noise) {
      assert.ok(n.x >= 0 && n.x + n.w <= 320 && n.y >= 0 && n.y + n.h <= 200);
      assert.ok(GLITCH_TINTS.includes(n.c), 'noise uses the loud palette');
    }
  }
  for (const c of GLITCH_TINTS) assert.match(c, /^#[0-9a-f]{6}$/);
  assert.ok(GLITCH_TIME > 0);
});

test('starPixels: dark stars vanish, peak stars grow long angular spikes', () => {
  assert.deepEqual(starPixels(0, 2), []);
  assert.deepEqual(starPixels(0.05, 3), []);
  assert.deepEqual(starPixels(0.2, 2), [{ x: 0, y: 0 }], 'dim = a single point');
  const mid = starPixels(0.5, 2);
  const peak = starPixels(0.95, 2);
  assert.ok(peak.length > mid.length, 'the peak is more dramatic');
  // Long axis spikes at the peak (size 2 → arm length 1+2+2 = 5).
  const has = (pts, x, y) => pts.some((p) => p.x === x && p.y === y);
  assert.ok(has(peak, 5, 0) && has(peak, -5, 0) && has(peak, 0, 5) && has(peak, 0, -5), 'axis spikes');
  assert.ok(has(peak, 1, 1) && has(peak, -1, -1), 'diagonal glint');
  // Symmetric by construction.
  for (const p of peak) {
    assert.ok(has(peak, -p.x, p.y) && has(peak, p.x, -p.y), `symmetric around (${p.x},${p.y})`);
  }
});

test('bigger stars reach further', () => {
  const small = starPixels(0.95, 1);
  const big = starPixels(0.95, 3);
  const reach = (pts) => Math.max(...pts.map((p) => Math.abs(p.x)));
  assert.ok(reach(big) > reach(small));
});

test('starSize derives 1..3 from existing sparkle fields', () => {
  for (let tint = 0; tint < 3; tint++) {
    for (let phase = 0; phase < 6.3; phase += 0.7) {
      const size = starSize({ tint, phase });
      assert.ok(size >= 1 && size <= 3, `size ${size}`);
    }
  }
});

test('transitions trigger glitches that decay to zero', () => {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  assert.equal(g.glitch.t, 0, 'no glitch at rest');

  g.update(STEP, { swap: true }); // swap
  assert.ok(g.glitch.t > 0, 'swap glitches');
  const seed1 = g.glitch.seed;

  for (let i = 0; i < 60; i++) g.update(STEP, {});
  assert.equal(g.glitch.t, 0, 'glitch decays');

  g.update(STEP, { swap: true }); // back to person
  assert.ok(g.glitch.t > 0);
  assert.notEqual(g.glitch.seed, seed1, 'each burst gets its own seed');

  for (let i = 0; i < 60; i++) g.update(STEP, {});
  g.update(STEP, { action: true }); // throw
  assert.ok(g.glitch.t > 0, 'a throw glitches');
  assert.ok(g.glitch.dur > 0 && g.glitch.t <= g.glitch.dur);
});

test('meeting the dog fires the big glitch', () => {
  const g = new Game(1);
  g.world.collides = () => false;
  g.person.x = g.dog.x - 20;
  g.person.y = g.dog.y;
  g.update(STEP, {});
  assert.equal(g.together, true);
  assert.ok(g.glitch.t > 0.35, 'the meeting burst runs longer than a routine one');
});
