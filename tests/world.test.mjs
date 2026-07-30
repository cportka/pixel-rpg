import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, generateChunk, trunkBox, CHUNK, TREE_VARIANTS } from '../src/core/world.js';

test('generateChunk is deterministic', () => {
  assert.deepEqual(generateChunk(42, 3, -2), generateChunk(42, 3, -2));
});

test('different seeds produce different forests', () => {
  const a = JSON.stringify(generateChunk(1, 0, 0));
  const b = JSON.stringify(generateChunk(2, 0, 0));
  assert.notEqual(a, b);
});

test('chunk content lands inside the chunk bounds with sane fields', () => {
  for (let cx = -2; cx <= 2; cx++) {
    for (let cy = -2; cy <= 2; cy++) {
      const chunk = generateChunk(99, cx, cy);
      assert.ok(chunk.trees.length >= 1, 'every chunk grows something');
      for (const t of chunk.trees) {
        assert.ok(t.x >= cx * CHUNK && t.x < (cx + 1) * CHUNK);
        assert.ok(t.y >= cy * CHUNK && t.y < (cy + 1) * CHUNK);
        assert.ok(['tree', 'bush'].includes(t.kind));
        assert.ok(TREE_VARIANTS.includes(t.variant));
        assert.ok(t.size > 0);
        assert.ok(Number.isInteger(t.detailSeed) && t.detailSeed >= 0);
      }
      for (const s of chunk.sparkles) {
        assert.ok(s.x >= cx * CHUNK && s.x < (cx + 1) * CHUNK);
        assert.ok(s.y >= cy * CHUNK && s.y < (cy + 1) * CHUNK);
      }
    }
  }
});

test('World caches chunks (same object back)', () => {
  const w = new World(7);
  assert.equal(w.chunkAt(1, 1), w.chunkAt(1, 1));
});

test('treesInRect returns trees overlapping the view', () => {
  const w = new World(7);
  const chunk = w.chunkAt(0, 0);
  const t = chunk.trees[0];
  const found = w.treesInRect(t.x - 10, t.y - 10, 20, 20);
  assert.ok(found.some((f) => f.x === t.x && f.y === t.y));
});

test('collides is true on a trunk and false in open space', () => {
  const w = new World(7);
  const tree = w.chunkAt(0, 0).trees.find((t) => t.kind === 'tree');
  assert.ok(tree, 'expected at least one tree in chunk 0,0');
  const b = trunkBox(tree);
  assert.ok(w.collides(b.x + 1, b.y + 1, 2, 2), 'center of a trunk should collide');

  // Find a spot at least 40px from every trunk in a 3x3 chunk neighborhood.
  let free = null;
  outer: for (let x = 0; x < CHUNK && !free; x += 7) {
    for (let y = 0; y < CHUNK; y += 7) {
      const near = w.treesInRect(x - 60, y - 60, 120, 120).filter((t) => t.kind === 'tree');
      if (near.every((t) => Math.hypot(t.x - x, t.y - y) > 40)) {
        free = { x, y };
        continue outer;
      }
    }
  }
  assert.ok(free, 'expected an open clearing somewhere in the chunk');
  assert.equal(w.collides(free.x, free.y, 6, 3), false);
});

test('prune bounds the chunk cache and eviction is lossless', () => {
  const w = new World(5);
  for (let cx = 0; cx < 18; cx++) {
    for (let cy = 0; cy < 18; cy++) w.chunkAt(cx, cy);
  }
  const farBefore = JSON.stringify(w.chunkAt(17, 17));
  assert.equal(w.chunks.size, 324);
  w.prune(0, 0);
  assert.ok(w.chunks.size < 324, 'far chunks were evicted');
  assert.ok(w.chunks.has('0,0'), 'nearby chunks were kept');
  assert.equal(w.chunks.has('17,17'), false, 'distant chunk was dropped');
  assert.equal(JSON.stringify(w.chunkAt(17, 17)), farBefore, 'regenerates identically');
});

test('prune below the threshold is a no-op', () => {
  const w = new World(5);
  w.chunkAt(0, 0);
  w.chunkAt(50, 50);
  w.prune(0, 0);
  assert.ok(w.chunks.has('50,50'), 'small caches are left alone');
});

test('sparklesInRect only returns sparkles inside the rect', () => {
  const w = new World(11);
  for (const s of w.sparklesInRect(0, 0, CHUNK, CHUNK)) {
    assert.ok(s.x >= 0 && s.x <= CHUNK && s.y >= 0 && s.y <= CHUNK);
  }
});

test('inflatable groves are rare, well-formed, and stay in their chunk', () => {
  let groves = 0;
  let dancers = 0;
  const N = 40;
  for (let cx = 0; cx < N; cx++) {
    for (let cy = 0; cy < N; cy++) {
      const chunk = generateChunk(21, cx, cy);
      if (chunk.inflatables.length === 0) continue;
      groves++;
      dancers += chunk.inflatables.length;
      for (const f of chunk.inflatables) {
        assert.ok(f.x >= cx * CHUNK && f.x < (cx + 1) * CHUNK, 'x in chunk');
        assert.ok(f.y >= cy * CHUNK && f.y < (cy + 1) * CHUNK, 'y in chunk');
        assert.ok(f.h >= 22 && f.h <= 32, 'tube height sane');
        assert.ok(f.tint >= 0 && f.tint < 4);
        assert.ok(f.speed > 0);
      }
      assert.ok(chunk.inflatables.length >= 2 && chunk.inflatables.length <= 4, 'groves come in groups');
    }
  }
  assert.ok(groves > 0, 'the forest does contain inflatables somewhere');
  assert.ok(groves < N * N * 0.1, `they stay rare (${groves}/${N * N} chunks)`);
  assert.ok(dancers >= groves * 2);
});

test('inflatablesInRect finds a grove near the rect', () => {
  const w = new World(21);
  let found = null;
  outer: for (let cx = 0; cx < 40; cx++) {
    for (let cy = 0; cy < 40; cy++) {
      const chunk = w.chunkAt(cx, cy);
      if (chunk.inflatables.length > 0) {
        found = chunk.inflatables[0];
        break outer;
      }
    }
  }
  assert.ok(found, 'expected a grove within 1600 chunks');
  const hits = w.inflatablesInRect(found.x - 10, found.y - 10, 20, 20);
  assert.ok(hits.some((f) => f.x === found.x && f.y === found.y));
});
