// Renderer smoke test against a fake canvas — catches interface breaks between
// game state and drawing without needing a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Renderer, SCREEN_W, SCREEN_H, RENDER_FPS, uiButtons, choicePanel, captionMaxW, sheetLines, groundNoise,
} from '../src/gfx/renderer.js';
import { WALK_CYCLE_FPS } from '../src/gfx/sprites.js';
import { wrapText } from '../src/gfx/font.js';
import { Game } from '../src/core/game.js';
import { viewFor, setScreenSize, VIEW_MIN_W, VIEW_MIN_H } from '../src/core/screen.js';

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

test('the viewport is 624x540 — 2x upscale, half the pixel size of v0.14', () => {
  assert.equal(SCREEN_W, 624);
  assert.equal(SCREEN_H, 540);
  // Same physical picture as v0.14's 416x360 at 3x, with 1.5x the detail.
  assert.equal(SCREEN_W * 2, 1248);
  assert.equal(SCREEN_H * 2, 1080);
  assert.ok(SCREEN_W * 2 >= 1240 && SCREEN_H * 2 >= 1080, 'the promised minimum');
});

test('the mansion interior renders on a fake canvas without throwing', () => {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  g.world.chunkAt(0, 0).mansions.push({ x: 60, y: 0 });
  g.person.x = 60;
  g.person.y = 0;
  g.update(1 / 60, {});
  assert.equal(g.location, 'mansion');
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  r.render(g);
  assert.ok(canvas.ctx.ops.fillRect > 500, 'the interior painted floor, walls, furnishings');
  assert.equal(r.lastLocation, 'mansion');
  for (const [x, y, w, h] of canvas.ctx.rects) {
    assert.ok(x >= -1 && y >= -1 && x + w <= SCREEN_W + 1 && y + h <= SCREEN_H + 1,
      `interior pixel (${x},${y}) off screen`);
  }
});

test('caption wrap width follows the screen — live, since it resizes', () => {
  assert.equal(captionMaxW(), SCREEN_W - 40);
  // Long lines that orphan-wrapped on the 320 screen fit in one on 416.
  assert.equal(wrapText('IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)', captionMaxW()).length, 1);
  assert.equal(wrapText('A SOFT WHIMPER DRIFTS FROM THE NORTH', captionMaxW()).length, 1);
  try {
    setScreenSize(416, 360);
    assert.equal(captionMaxW(), 376, 'the wrap width tracks a resize');
  } finally {
    setScreenSize(624, 540);
  }
});

test('touch buttons exist only when together, on screen, not overlapping', () => {
  const alone = new Game(1);
  assert.deepEqual(uiButtons(alone), [], 'no buttons while alone');
  const together = new Game(1, { story: false });
  const buttons = uiButtons(together);
  assert.equal(buttons.length, 2);
  const ids = buttons.map((b) => b.id).sort();
  assert.deepEqual(ids, ['action', 'swap'], 'the sheet opens by double-tap, not a button');
  for (const b of buttons) {
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= SCREEN_W && b.y + b.h <= SCREEN_H, `${b.id} on screen`);
  }
  const [l, r] = [...buttons].sort((a, b) => a.x - b.x);
  assert.ok(l.x + l.w < r.x, 'buttons do not overlap');
});

test('screenToWorld maps the screen center to the camera position', () => {
  const r = makeRenderer(fakeCanvas());
  const g = new Game(42, { story: false });
  r.render(g);
  const w = r.screenToWorld(SCREEN_W / 2, SCREEN_H / 2);
  assert.ok(Math.abs(w.x - g.person.x) <= 2, `x ${w.x} ≈ ${g.person.x}`);
  assert.ok(Math.abs(w.y - (g.person.y - 6)) <= 2, `y ${w.y} ≈ ${g.person.y - 6}`);
  // A known offset round-trips.
  const w2 = r.screenToWorld(SCREEN_W / 2 + 25, SCREEN_H / 2 - 10);
  assert.ok(Math.abs(w2.x - w.x - 25) <= 0.001);
  assert.ok(Math.abs(w2.y - w.y + 10) <= 0.001);
});

test('rendering with a tap marker and touch UI paints in bounds', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  r.showTouchUI = true;
  const g = new Game(42, { story: false });
  g.setMoveTarget(g.person.x + 20, g.person.y + 10);
  r.render(g);
  assert.ok(canvas.ctx.ops.fillRect > 100);
});

test('an active glitch adds band self-blits to the frame', () => {
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  const g = new Game(42, { story: false });
  // Steady state: two clean renders of the identical scene blit the same
  // number of cached tree sprites.
  r.render(g);
  const afterFirst = canvas.ctx.ops.drawImage;
  r.render(g);
  const cleanPerFrame = canvas.ctx.ops.drawImage - afterFirst;
  g.triggerGlitch();
  const beforeGlitch = canvas.ctx.ops.drawImage;
  r.render(g);
  const glitchPerFrame = canvas.ctx.ops.drawImage - beforeGlitch;
  assert.ok(
    glitchPerFrame > cleanPerFrame,
    `glitch frame blits extra bands (${glitchPerFrame} vs ${cleanPerFrame})`,
  );
});

test('choicePanel geometry: null when closed, on-screen rows when open', () => {
  const g = new Game(1, { story: false });
  assert.equal(choicePanel(g), null);
  g.choice = {
    kind: 'dumpster',
    key: 'd:0,0',
    x: 0,
    y: 0,
    title: 'A DUMPSTER BURNS IN THE DARK',
    options: [
      { id: 'search', label: 'SEARCH THE DUMPSTER' },
      { id: 'putout', label: 'PUT OUT THE FIRE (HOW?)' },
      { id: 'walkaway', label: 'WALK AWAY' },
    ],
  };
  const panel = choicePanel(g);
  assert.equal(panel.rows.length, 3);
  assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.w <= SCREEN_W && panel.y + panel.h <= SCREEN_H);
  for (const row of panel.rows) {
    assert.ok(row.y >= panel.y && row.y + row.h <= panel.y + panel.h + 2, 'rows inside the panel');
  }
  // Renders without throwing, with the menu and HP HUD up.
  const canvas = fakeCanvas();
  const r = makeRenderer(canvas);
  r.render(g);
  assert.ok(canvas.ctx.ops.fillRect > 100);
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

// --- The two gears, on screen -----------------------------------------------

test('turn-based locks a frame around the screen; free mode draws none', () => {
  const g = new Game(42, { story: false });
  const free = fakeCanvas();
  makeRenderer(free).render(g);
  const freeEdges = free.ctx.rects.filter(([, , w, h]) => w === SCREEN_W && h === 3).length;

  g.startBattle([{ x: g.person.x + 30, y: g.person.y }]);
  const turn = fakeCanvas();
  makeRenderer(turn).render(g);
  const turnEdges = turn.ctx.rects.filter(([, , w, h]) => w === SCREEN_W && h === 3).length;
  assert.equal(freeEdges, 0, 'free mode leaves the edges alone');
  assert.equal(turnEdges, 2, 'turn-based rules a bar across the top and bottom');
  assert.ok(
    turn.ctx.rects.some(([x, , w, h]) => x === SCREEN_W - 3 && w === 3 && h === SCREEN_H),
    'and down both sides',
  );
});

test('the move budget shows as a bar that shrinks as you walk', () => {
  const g = new Game(42, { story: false });
  g.startBattle([{ x: g.person.x + 30, y: g.person.y }]);
  const full = fakeCanvas();
  makeRenderer(full).drawModeFrame(g);
  g.moveLeft = 0;
  const spent = fakeCanvas();
  makeRenderer(spent).drawModeFrame(g);
  // The bar is drawn twice: the amber trough, then the rose-gold fill on top.
  const bar = (c) => c.ctx.rects.filter(([, y, , h]) => y === 21 && h === 3);
  assert.equal(bar(full).length, 2, 'trough and fill');
  assert.equal(bar(full).at(-1)[2], bar(full)[0][2], 'a full budget fills the trough');
  assert.equal(bar(spent).at(-1)[2], 0, 'and an empty one empties it');
});

test('the sheet grows a focus line once the leaf has taught you', () => {
  const g = new Game(42, { story: false });
  assert.equal(sheetLines(g).some((l) => l.startsWith('FOCUS')), false);
  g.learnSpell();
  const lines = sheetLines(g);
  assert.ok(lines.some((l) => l === `FOCUS ${g.focus} OF ${g.maxFocus()}`));
  assert.ok(lines.some((l) => l.startsWith('SPELLS: ')));
});

test('ground noise is smooth: neighbours differ by a little, not a lot', () => {
  // Regression (v0.16 art pass): a raw per-block hash tiled the forest floor
  // into visible squares. Smoothed noise must fade instead of stepping.
  let biggestStep = 0;
  for (let y = -60; y < 60; y++) {
    for (let x = -60; x < 60; x++) {
      const here = groundNoise(9, x, y, 9);
      biggestStep = Math.max(biggestStep, Math.abs(groundNoise(9, x + 1, y, 9) - here));
      biggestStep = Math.max(biggestStep, Math.abs(groundNoise(9, x, y + 1, 9) - here));
    }
  }
  assert.ok(biggestStep < 0.2, `no hard lattice edges (worst neighbour step ${biggestStep.toFixed(3)})`);
  assert.equal(groundNoise(9, 3, -7, 9), groundNoise(9, 3, -7, 9), 'and deterministic');
  // It still uses the whole range, so thresholds mean something.
  const vals = [];
  for (let i = 0; i < 4000; i++) vals.push(groundNoise(9, i % 200, (i / 200) | 0, 9));
  assert.ok(Math.min(...vals) < 0.2 && Math.max(...vals) > 0.8, 'full range');
});

// --- The view policy (v0.19: no fixed aspect) --------------------------------

test('viewFor fills every window edge to edge with a sane amount of world', () => {
  const cases = [
    // [availW, availH, dpr, wantScale, wantW, wantH, why]
    [1920, 1080, 1, 2, 960, 540, 'plain 1080p: the reference density, wider'],
    [2560, 1440, 1, 2, 1280, 720, 'maximized 1440p: see MORE world'],
    [3840, 2160, 1, 3, 1280, 720, '4K hits the draw-cost cap and zooms out no further'],
    [1170, 2532, 3, 3, 390, 844, 'portrait phone: native-CSS-sized art, tall view'],
    [2532, 1170, 3, 3, 844, 390, 'landscape phone'],
    [2560, 1600, 2, 3, 853, 533, 'retina laptop keeps ~1.5 css px per game px'],
    [5120, 1440, 1, 4, 1280, 360, 'ultrawide bottoms out at the minimum height'],
  ];
  for (const [w, h, dpr, scale, vw, vh, why] of cases) {
    const v = viewFor(w, h, dpr);
    assert.equal(v.scale, scale, `${why}: scale`);
    assert.equal(v.w, vw, `${why}: width`);
    assert.equal(v.h, vh, `${why}: height`);
    // The whole point: the canvas covers the window (within a pixel of rounding).
    assert.ok(Math.abs(v.w * v.scale - w) <= v.scale, `${why}: fills horizontally`);
    assert.ok(Math.abs(v.h * v.scale - h) <= v.scale, `${why}: fills vertically`);
  }
  // Tiny embeds shrink fractionally but never below the UI minimums - 40.
  const tiny = viewFor(400, 340, 1);
  assert.ok(tiny.scale < 1, 'sub-1x shrinks');
  assert.ok(tiny.w >= VIEW_MIN_W - 40 && tiny.h >= VIEW_MIN_H - 40, 'menus keep their room');
  // Degenerate mid-layout measurements stay sane.
  const degenerate = viewFor(0, 0, 1);
  assert.ok(degenerate.w > 0 && degenerate.h > 0 && degenerate.scale > 0);
});

test('the world renders at a resized viewport, edge to edge', () => {
  try {
    setScreenSize(960, 540);
    const canvas = fakeCanvas(960, 540);
    const r = makeRenderer(canvas);
    const g = new Game(42, { story: false });
    r.render(g);
    assert.ok(
      canvas.ctx.rects.some(([x, y, w, h]) => x === 0 && y === 0 && w === 960 && h === 540),
      'the background fill spans the whole wider screen',
    );
    for (const [x, y, w, h] of canvas.ctx.rects) {
      assert.ok(x >= -20 && y >= -20 && x + w <= 980 && y + h <= 560, `pixel (${x},${y}) way off screen`);
    }
    // The HUD minimap hugs the REAL top-right corner.
    const g2 = new Game(42, { story: false });
    canvas.ctx.rects.length = 0;
    r.render(g2);
    void g2;
  } finally {
    setScreenSize(624, 540);
  }
});

test('a portrait viewport clamps the mansion camera to the interior', () => {
  try {
    setScreenSize(390, 700);
    const g = new Game(1, { story: false });
    g.world.collides = () => false;
    g.world.chunkAt(0, 0).mansions.push({ x: 60, y: 0 });
    g.person.x = 60;
    g.person.y = 0;
    g.update(1 / 60, {});
    assert.equal(g.location, 'mansion');
    const r = makeRenderer(fakeCanvas(390, 700));
    // Far west: the camera pins to the interior's left edge.
    g.person.x = 30;
    r.render(g);
    assert.equal(r.lastViewX, 0, 'pinned left');
    // Far east: pins to the right edge, never past it.
    g.person.x = 600;
    r.render(g);
    assert.equal(r.lastViewX, 624 - 390, 'pinned right');
    // Standing center: the camera follows.
    g.person.x = 312;
    r.render(g);
    assert.equal(r.lastViewX, 312 - 195, 'follows the person');
  } finally {
    setScreenSize(624, 540);
  }
});

test('on a big view the lost dog still spawns outside the opening screen', () => {
  try {
    setScreenSize(1280, 720);
    const g = new Game(7); // story mode: alone, dog placed by the ring
    const d = Math.hypot(g.dog.x, g.dog.y);
    assert.ok(d >= 640, `the dog waits beyond the wider view (${Math.round(d)}px out)`);
    assert.ok(
      Math.abs(g.dog.x) > 1280 / 2 + 8 || g.dog.y <= -(720 / 2 + 16) || g.dog.y >= 720 / 2 + 8,
      'and is not visible on frame one',
    );
  } finally {
    setScreenSize(624, 540);
  }
});
