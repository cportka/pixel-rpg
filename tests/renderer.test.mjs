// Renderer smoke test against a fake canvas — catches interface breaks between
// game state and drawing without needing a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, SCREEN_W, SCREEN_H } from '../src/gfx/renderer.js';
import { Game } from '../src/core/game.js';

function fakeCanvas(w = SCREEN_W, h = SCREEN_H) {
  const ctx = {
    fillStyle: '#000000',
    ops: { fillRect: 0, drawImage: 0 },
    fillRect() { this.ops.fillRect++; },
    drawImage() { this.ops.drawImage++; },
  };
  return { width: w, height: h, ctx, getContext: () => ctx };
}

function makeRenderer(canvas) {
  return new Renderer(canvas, (w, h) => fakeCanvas(w, h));
}

test('renders a frame without throwing and paints pixels', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  const g = new Game(42);
  r.render(g);
  assert.ok(canvas.ctx.ops.fillRect > 100, 'background + sprites + text painted');
  assert.ok(canvas.ctx.ops.drawImage > 0, 'cached tree sprites blitted');
});

test('tree sprites are cached per full identity, not detailSeed alone', () => {
  const r = makeRenderer(fakeCanvas());
  const tree = { kind: 'tree', x: 0, y: 0, size: 40, variant: 'ember', detailSeed: 5 };
  const a = r.treeSprite(tree);
  const b = r.treeSprite(tree);
  assert.equal(a, b, 'identical trees share a cache entry');
  // Same detailSeed but different geometry — must NOT alias (birthday collisions
  // between independent 32-bit seeds are real over long sessions).
  const other = r.treeSprite({ ...tree, size: 12 });
  assert.notEqual(a, other, 'different size, different sprite');
  const bush = r.treeSprite({ ...tree, kind: 'bush' });
  assert.notEqual(a, bush, 'different kind, different sprite');
  assert.equal(r.treeCache.size, 3);
});

test('stale sprites are swept once the cache outgrows its cap', () => {
  const r = makeRenderer(fakeCanvas());
  for (let i = 0; i < 500; i++) {
    r.treeSprite({ kind: 'bush', x: 0, y: 0, size: 8, variant: 'ember', detailSeed: i });
  }
  assert.equal(r.treeCache.size, 500);
  r.frame = 500; // long since those were drawn
  const fresh = { kind: 'bush', x: 0, y: 0, size: 8, variant: 'ember', detailSeed: 9999 };
  r.treeSprite(fresh);
  r.sweepCache();
  assert.ok(r.treeCache.size < 10, `stale entries evicted (size ${r.treeCache.size})`);
  assert.ok(r.treeCache.size >= 1, 'recently used entry survives');
});

test('camera smoothing is dt-corrected (frame-rate independent)', () => {
  const g = new Game(42);
  const a = makeRenderer(fakeCanvas());
  const b = makeRenderer(fakeCanvas());
  a.updateCamera(g, 1 / 60);
  b.updateCamera(g, 1 / 30);
  g.person.x += 100;
  // One 30Hz frame should close the same gap as two 60Hz frames.
  a.updateCamera(g, 1 / 60);
  const a2 = a.updateCamera(g, 1 / 60);
  const b1 = b.updateCamera(g, 1 / 30);
  assert.ok(Math.abs(a2.x - b1.x) <= 1, `60Hz x2 (${a2.x}) ≈ 30Hz x1 (${b1.x})`);
});

test('camera starts snapped to the active character', () => {
  const r = makeRenderer(fakeCanvas());
  const g = new Game(42);
  g.person.x = 500;
  g.person.y = 300;
  const cam = r.updateCamera(g);
  assert.equal(cam.x, 500);
  assert.equal(cam.y, 294); // biased slightly up from the feet
});

test('camera eases toward a moved character', () => {
  const r = makeRenderer(fakeCanvas());
  const g = new Game(42);
  r.updateCamera(g);
  g.person.x += 100;
  const c1 = r.updateCamera(g);
  const c2 = r.updateCamera(g);
  assert.ok(c1.x > 0 && c1.x < g.person.x, 'eases, does not teleport');
  assert.ok(c2.x > c1.x, 'keeps closing in');
});

test('a full simulated minute renders from every camera state', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  const g = new Game(7);
  const inputs = [
    { right: true }, { down: true }, { left: true }, { up: true },
    { swap: true }, {}, { action: true }, {},
  ];
  for (let i = 0; i < 60 * 8; i++) {
    g.update(1 / 60, inputs[Math.floor(i / 60) % inputs.length]);
    r.render(g);
  }
  assert.ok(canvas.ctx.ops.fillRect > 0);
});
