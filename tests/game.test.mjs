import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, CAPTION_TTL, FETCH_TIMEOUT } from '../src/core/game.js';
import { trunkBox } from '../src/core/world.js';

const STEP = 1 / 60;
const IDLE = {};

/** A game on an open field — fetch/AI tests shouldn't depend on tree layout. */
function openGame(seed = 1) {
  const g = new Game(seed);
  g.world.collides = () => false;
  return g;
}

test('starts controlling the person, dog nearby', () => {
  const g = new Game(1);
  assert.equal(g.active, 'person');
  assert.equal(g.activeChar.kind, 'person');
  assert.ok(Math.hypot(g.dog.x - g.person.x, g.dog.y - g.person.y) < 60);
});

test('swap is edge-triggered and announces the new character', () => {
  const g = openGame();
  g.update(STEP, { swap: true });
  assert.equal(g.active, 'dog');
  assert.equal(g.caption.text, 'YOU ARE THE DOG');
  g.update(STEP, { swap: true }); // still held — no re-trigger
  assert.equal(g.active, 'dog');
  g.update(STEP, {});
  g.update(STEP, { swap: true });
  assert.equal(g.active, 'person');
  assert.equal(g.caption.text, 'YOU ARE THE PERSON');
});

test('input moves the active character only (the other follows on its own)', () => {
  const g = openGame();
  const px = g.person.x;
  g.update(STEP, { right: true });
  assert.ok(g.person.x > px);
  g.update(STEP, { swap: true });
  const dogY = g.dog.y;
  const person = { x: g.person.x, y: g.person.y };
  g.update(STEP, { down: true });
  assert.ok(g.dog.y > dogY, 'down input moved the dog');
  assert.equal(g.person.x, person.x, 'person did not move while the dog is active');
  assert.equal(g.person.y, person.y);
});

test('captions expire after CAPTION_TTL', () => {
  const g = openGame();
  assert.ok(g.caption, 'greets with a caption');
  const steps = Math.ceil((CAPTION_TTL + 0.1) / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, IDLE);
  assert.equal(g.caption, null);
});

test('distant dog walks back to the person', () => {
  const g = openGame();
  g.dog.x = g.person.x + 120;
  g.dog.y = g.person.y;
  for (let i = 0; i < 600; i++) g.update(STEP, IDLE);
  const dist = Math.hypot(g.dog.x - g.person.x, g.dog.y - g.person.y);
  assert.ok(dist < 60, `dog should come along (dist ${dist.toFixed(1)})`);
});

test('full fetch cycle: throw, chase, return, GOOD DOG + heart', () => {
  const g = openGame();
  g.update(STEP, { action: true });
  assert.equal(g.fetch, 'thrown');
  assert.ok(g.ball, 'ball exists after a throw');
  assert.equal(g.caption.text, 'FETCH IS OUR FAVORITE GAME!');

  let sawReturning = false;
  let done = -1;
  for (let i = 0; i < 60 * 20; i++) {
    g.update(STEP, IDLE);
    if (g.fetch === 'returning') sawReturning = true;
    if (g.fetch === 'idle' && sawReturning) {
      done = i;
      break;
    }
  }
  assert.ok(sawReturning, 'dog picked the ball up');
  assert.ok(done >= 0, 'dog delivered the ball back');
  assert.equal(g.ball, null);
  assert.equal(g.caption.text, 'GOOD DOG');
  assert.ok(g.hearts.length > 0, 'a heart appears');
});

test('only the person throws, and only one ball at a time', () => {
  const g = openGame();
  g.update(STEP, { swap: true }); // control the dog
  g.update(STEP, {});
  g.update(STEP, { action: true });
  assert.equal(g.ball, null, 'dog cannot throw');
  g.update(STEP, { swap: true }); // back to person
  g.update(STEP, {});
  g.update(STEP, { action: true });
  const first = g.ball;
  assert.ok(first);
  g.update(STEP, {});
  g.update(STEP, { action: true });
  assert.equal(g.ball, first, 'second throw ignored while a fetch is live');
});

test('thrown ball decelerates to rest', () => {
  const g = openGame();
  g.update(STEP, { action: true });
  for (let i = 0; i < 240; i++) g.updateBall(STEP);
  const speed = Math.hypot(g.ball.vx, g.ball.vy);
  assert.ok(speed < 1, `ball should stop (speed ${speed.toFixed(2)})`);
});

test('hearts fade out', () => {
  const g = openGame();
  g.hearts.push({ x: 0, y: 0, t: 0.2 });
  for (let i = 0; i < 30; i++) g.update(STEP, IDLE);
  assert.equal(g.hearts.length, 0);
});

test('fetch survives a trunk directly between dog and ball (detour steering)', () => {
  // Regression: straight-line chasing wedged the dog on trunk corners and
  // soft-locked the fetch state machine forever. Real collision world here —
  // no openGame() stub.
  const g = new Game(1);
  const tree = g.world.chunkAt(0, 0).trees.find((t) => t.kind === 'tree');
  assert.ok(tree, 'seed 1 grows a tree in chunk 0,0');
  const b = trunkBox(tree);
  const cy = b.y + 3; // dog feet box overlaps the trunk rows at this height
  g.person.x = b.x - 30;
  g.person.y = cy;
  g.dog.x = b.x - 6; // wedged against the left trunk face...
  g.dog.y = cy;
  g.ball = { x: b.x + b.w + 30, y: cy, vx: 0, vy: 0, carried: false }; // ...ball on the right
  g.fetch = 'thrown';
  g.fetchTime = 0;

  let pickedUp = false;
  for (let i = 0; i < 60 * 20 && !pickedUp; i++) {
    g.update(STEP, IDLE);
    if (g.fetch === 'returning') pickedUp = true;
  }
  assert.ok(pickedUp, 'dog steered around the trunk and picked the ball up');
});

test('a hopeless fetch resets after FETCH_TIMEOUT instead of soft-locking', () => {
  const g = openGame();
  g.update(STEP, { action: true });
  assert.equal(g.fetch, 'thrown');
  g.ball.x = 1e7; // unreachable
  g.ball.vx = 0;
  g.ball.vy = 0;
  const steps = Math.ceil((FETCH_TIMEOUT + 1) / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, IDLE);
  assert.equal(g.fetch, 'idle');
  assert.equal(g.ball, null);
  g.update(STEP, {});
  g.update(STEP, { action: true });
  assert.ok(g.ball, 'throwing works again after the reset');
});

test('the ball cannot fly into a trunk — it drops at the trunk face', () => {
  const g = new Game(7); // real collision world
  const tree = g.world.chunkAt(0, 0).trees.find((t) => t.kind === 'tree');
  const b = trunkBox(tree);
  g.ball = { x: b.x - 10, y: b.y + 2, vx: 200, vy: 0, carried: false };
  for (let i = 0; i < 240; i++) g.updateBall(STEP);
  assert.ok(g.ball.x < b.x, 'ball stopped before entering the trunk');
  assert.equal(
    g.world.collides(g.ball.x - 1, g.ball.y - 1, 2, 2),
    false,
    'ball never rests inside a trunk box',
  );
});

test('same seed, same forest — the game world is reproducible', () => {
  const a = new Game(1337);
  const b = new Game(1337);
  assert.deepEqual(a.world.chunkAt(0, 0), b.world.chunkAt(0, 0));
  assert.deepEqual(a.world.chunkAt(-3, 5), b.world.chunkAt(-3, 5));
});
