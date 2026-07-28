// Renderer smoke test against a fake canvas — catches interface breaks between
// game state and drawing without needing a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, SCREEN_W, SCREEN_H, RENDER_FPS } from '../src/gfx/renderer.js';
import { WALK_CYCLE_FPS } from '../src/gfx/sprites.js';
import { Game } from '../src/core/game.js';

function fakeCanvas(w = SCREEN_W, h = SCREEN_H) {
  const ctx = {
    fillStyle: '#000000',
    ops: { fillRect: 0, drawImage: 0 },
    rects: [],
    fillRect(x, y, rw, rh) {
      this.ops.fillRect++;
      this.rects.push([x, y, rw, rh]);
    },
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

test('renders the together state (leash path) without throwing', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  const g = new Game(42, { story: false });
  assert.ok(g.leashActive());
  r.render(g);
  assert.ok(canvas.ctx.ops.fillRect > 100);
});

test('the presentation cadence constants match the reference footage', () => {
  assert.equal(RENDER_FPS, 15, 'presentation cadence is the reference ~15 fps');
  assert.equal(WALK_CYCLE_FPS, 7.5, 'walk cycle advances at half the render rate');
});

test('no leash is drawn while alone; it appears once the pair meet', () => {
  const r = makeRenderer(fakeCanvas());
  const g = new Game(42); // story mode: alone
  let leashCalls = 0;
  r.drawLeash = () => leashCalls++;
  r.render(g);
  assert.equal(leashCalls, 0, 'alone: no leash');
  g.meetDog();
  r.render(g);
  assert.equal(leashCalls, 1, 'together: leash drawn');
});

test('captions anchored at screen corners stay fully on screen', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  const text = 'IN THE BEGINNING THERE WAS ONLY THE DARK'; // wraps to 2 lines
  for (const [ax, ay] of [[0, 0], [SCREEN_W, SCREEN_H], [0, SCREEN_H], [SCREEN_W, 0]]) {
    canvas.ctx.rects.length = 0;
    r.drawCaption(text, ax, ay);
    assert.ok(canvas.ctx.rects.length > 0, 'caption painted');
    for (const [x, y, w, h] of canvas.ctx.rects) {
      assert.ok(x >= 0 && y >= 0 && x + w <= SCREEN_W && y + h <= SCREEN_H,
        `pixel (${x},${y}) off screen for anchor (${ax},${ay})`);
    }
  }
});

test('drawLeash paints a run of marching dots between the pair', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  const g = new Game(42, { story: false });
  g.person.x = 0;
  g.person.y = 0;
  g.dog.x = 40;
  g.dog.y = 0;
  const before = canvas.ctx.ops.fillRect;
  r.drawLeash(g, -160, -100);
  const dots = canvas.ctx.ops.fillRect - before;
  assert.ok(dots >= 8, `a 40px leash paints several dots (got ${dots})`);
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
  const g = new Game(7, { story: false });
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
