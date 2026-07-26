import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSON, DOG, makeCharacter, moveCharacter, updateFollower, feetBox,
  FOLLOW_START, FOLLOW_STOP,
} from '../src/core/entities.js';
import { World, trunkBox } from '../src/core/world.js';
import { mulberry32 } from '../src/core/rng.js';

const openWorld = { collides: () => false };

test('moveCharacter moves at the configured speed', () => {
  const ch = makeCharacter(PERSON, 0, 0);
  moveCharacter(ch, 1, 0, 1, openWorld);
  assert.ok(Math.abs(ch.x - PERSON.speed) < 1e-9);
  assert.equal(ch.y, 0);
  assert.ok(ch.walking);
});

test('diagonal movement is normalized (no speed boost)', () => {
  const ch = makeCharacter(PERSON, 0, 0);
  moveCharacter(ch, 1, 1, 1, openWorld);
  const dist = Math.hypot(ch.x, ch.y);
  assert.ok(Math.abs(dist - PERSON.speed) < 1e-6, `moved ${dist}, expected ${PERSON.speed}`);
});

test('facing flips with horizontal movement and sticks', () => {
  const ch = makeCharacter(DOG, 0, 0);
  moveCharacter(ch, -1, 0, 0.1, openWorld);
  assert.equal(ch.facing, -1);
  moveCharacter(ch, 0, 1, 0.1, openWorld);
  assert.equal(ch.facing, -1, 'vertical movement keeps prior facing');
  moveCharacter(ch, 1, 0, 0.1, openWorld);
  assert.equal(ch.facing, 1);
});

test('zero direction means standing still', () => {
  const ch = makeCharacter(PERSON, 5, 5);
  const moved = moveCharacter(ch, 0, 0, 1, openWorld);
  assert.equal(moved, false);
  assert.equal(ch.walking, false);
  assert.equal(ch.x, 5);
});

test('a wall on one axis still allows sliding on the other', () => {
  const wallRight = { collides: (x) => x + 6 > 10 }; // feet box may not cross x=10
  const ch = makeCharacter(PERSON, 5, 0);
  moveCharacter(ch, 1, 1, 1, wallRight);
  assert.ok(ch.x < 10, 'blocked horizontally');
  assert.ok(ch.y > 0, 'slid vertically');
});

test('characters never end a random walk stuck inside a trunk', () => {
  const world = new World(1234);
  const ch = makeCharacter(DOG, 5, 5);
  const rng = mulberry32(77);
  for (let i = 0; i < 600; i++) {
    moveCharacter(ch, rng() * 2 - 1, rng() * 2 - 1, 1 / 30, world);
    const b = feetBox(ch);
    assert.equal(world.collides(b.x, b.y, b.w, b.h), false, `step ${i} penetrated a trunk`);
  }
});

test('trunk blocks a straight charge', () => {
  const world = new World(7);
  const tree = world.chunkAt(0, 0).trees.find((t) => t.kind === 'tree');
  const b = trunkBox(tree);
  const ch = makeCharacter(PERSON, b.x - 10, b.y + b.h - 1);
  for (let i = 0; i < 120; i++) moveCharacter(ch, 1, 0, 1 / 60, world);
  const fb = feetBox(ch);
  assert.ok(fb.x + fb.w <= b.x + 0.001, 'stopped at the trunk face');
});

test('follower starts beyond FOLLOW_START and settles inside FOLLOW_STOP', () => {
  const leader = makeCharacter(PERSON, 0, 0);
  const dog = makeCharacter(DOG, FOLLOW_START + 20, 0);
  // Far: starts following and closes distance.
  updateFollower(dog, leader, 0.1, openWorld);
  assert.ok(dog.following);
  const before = dog.x;
  updateFollower(dog, leader, 0.1, openWorld);
  assert.ok(dog.x < before, 'moving toward the leader');
  // Run until settled — the stop check precedes movement, so the settle
  // distance is bounded by FOLLOW_STOP itself, not the looser start radius.
  for (let i = 0; i < 400; i++) updateFollower(dog, leader, 1 / 30, openWorld);
  assert.equal(dog.following, false);
  assert.ok(Math.hypot(dog.x, dog.y) <= FOLLOW_STOP, 'ended inside the stop radius');
});

test('follower inside the start radius stays put', () => {
  const leader = makeCharacter(PERSON, 0, 0);
  const dog = makeCharacter(DOG, FOLLOW_STOP + 2, 0);
  updateFollower(dog, leader, 0.1, openWorld);
  assert.equal(dog.following, false);
  assert.equal(dog.x, FOLLOW_STOP + 2);
});
