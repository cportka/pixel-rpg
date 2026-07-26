import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, hashCoords, coordRng, pick } from '../src/core/rng.js';

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('mulberry32 streams differ across seeds', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  const seqA = Array.from({ length: 8 }, () => a());
  const seqB = Array.from({ length: 8 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test('mulberry32 output stays in [0, 1)', () => {
  const rng = mulberry32(0xdeadbeef);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('hashCoords spreads neighboring coordinates apart', () => {
  const seen = new Set();
  for (let x = -10; x <= 10; x++) {
    for (let y = -10; y <= 10; y++) {
      seen.add(hashCoords(7, x, y));
    }
  }
  assert.equal(seen.size, 21 * 21, 'neighboring chunk hashes collided');
});

test('hashCoords depends on the seed', () => {
  assert.notEqual(hashCoords(1, 5, 5), hashCoords(2, 5, 5));
});

test('coordRng is reproducible per coordinate', () => {
  const a = coordRng(9, 3, -4);
  const b = coordRng(9, 3, -4);
  assert.equal(a(), b());
});

test('pick always returns an element of the array', () => {
  const rng = mulberry32(5);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 200; i++) assert.ok(arr.includes(pick(rng, arr)));
});
