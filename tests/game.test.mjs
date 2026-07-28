import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, CAPTION_TTL, FETCH_TIMEOUT, MEET_RADIUS, HINT_PERIOD, TAP_ARRIVE,
} from '../src/core/game.js';
import { trunkBox } from '../src/core/world.js';

const STEP = 1 / 60;
const IDLE = {};

/** A together-from-the-start game on an open field (fetch/AI unit tests). */
function openGame(seed = 1) {
  const g = new Game(seed, { story: false });
  g.world.collides = () => false;
  return g;
}

function runSeconds(g, seconds, input = IDLE) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

// --- Story: alone in the dark, then a friend -------------------------------

test('the story opens alone: no dog beside you, no swapping, no fetch', () => {
  const g = new Game(1);
  assert.equal(g.together, false);
  assert.equal(g.active, 'person');
  const dist = Math.hypot(g.dog.x - g.person.x, g.dog.y - g.person.y);
  assert.ok(dist >= 120, `the lost dog waits far away (${dist.toFixed(0)}px)`);
  assert.equal(g.caption.text, 'IN THE BEGINNING THERE WAS ONLY THE DARK');
  assert.equal(g.leashActive(), false);

  g.update(STEP, { swap: true });
  assert.equal(g.active, 'person', 'swap is ignored while alone');
  g.update(STEP, {});
  g.update(STEP, { action: true });
  assert.equal(g.ball, null, 'no fetch before the dog is found');
});

test('opening captions play in sequence', () => {
  const g = new Game(1);
  assert.equal(g.caption.text, 'IN THE BEGINNING THERE WAS ONLY THE DARK');
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.ok(g.caption, 'second line follows the first');
  assert.equal(g.caption.text, 'ONE SMALL PERSON, ALL ALONE IN THE WOODS');
});

test('whimper hints point toward the waiting dog in all four directions', () => {
  const cases = [
    [200, 0, 'EAST'],
    [-200, 0, 'WEST'],
    [0, 200, 'SOUTH'],
    [0, -200, 'NORTH'],
  ];
  for (const [ox, oy, dir] of cases) {
    const g = new Game(1);
    g.world.collides = () => false;
    g.dog.x = g.person.x + ox;
    g.dog.y = g.person.y + oy;
    runSeconds(g, 2 * CAPTION_TTL + 0.2); // let the opening lines pass
    g.hintTimer = HINT_PERIOD - 0.05; // arm the next whimper
    runSeconds(g, 0.2);
    assert.ok(g.caption, `a hint appeared (${dir})`);
    assert.equal(g.caption.text, `A SOFT WHIMPER DRIFTS FROM THE ${dir}`);
  }
});

test('the lost dog never spawns inside the opening viewport', () => {
  // Regression: the 170px spawn ring pokes into the 320x200 view's corners,
  // putting the "lost" dog on screen under "ALL ALONE IN THE WOODS".
  for (let seed = 1; seed <= 200; seed++) {
    const g = new Game(seed);
    // Opening camera sits at (0, -6); pad covers the 13x9 dog sprite.
    const visible = Math.abs(g.dog.x) < 168 && g.dog.y > -110 && g.dog.y < 106;
    assert.equal(visible, false, `seed ${seed}: dog visible at (${g.dog.x.toFixed(0)}, ${g.dog.y.toFixed(0)})`);
  }
});

test('the meeting story beat survives an immediate throw or swap', () => {
  // Regression: routine announcements clobbered the queued one-shot line
  // 'TOGETHER WE WILL FIND HOME' forever.
  const g = new Game(1);
  g.world.collides = () => false;
  g.person.x = g.dog.x - (MEET_RADIUS - 2);
  g.person.y = g.dog.y;
  g.update(STEP, IDLE);
  assert.equal(g.caption.text, 'A FRIENDLY LOST DOG!');
  g.update(STEP, { action: true }); // throw the ball right away
  assert.ok(g.ball, 'the throw itself still happens');
  assert.equal(g.caption.text, 'A FRIENDLY LOST DOG!', 'story line not clobbered');
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.equal(g.caption.text, 'TOGETHER WE WILL FIND HOME', 'second beat still plays');
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.equal(g.caption.text, 'FETCH IS OUR FAVORITE GAME!', 'routine line queued behind');
});

test('finding the dog: hearts, captions, leash, and unlocked swapping', () => {
  const g = new Game(1);
  g.world.collides = () => false;
  g.person.x = g.dog.x - (MEET_RADIUS - 2); // step inside the meet radius
  g.person.y = g.dog.y;
  g.update(STEP, IDLE);
  assert.equal(g.together, true);
  assert.equal(g.caption.text, 'A FRIENDLY LOST DOG!');
  assert.ok(g.hearts.length >= 2, 'hearts appear');
  assert.equal(g.leashActive(), true);
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.equal(g.caption.text, 'TOGETHER WE WILL FIND HOME');

  g.update(STEP, { swap: true });
  assert.equal(g.active, 'dog', 'swapping unlocked after meeting');
});

test('the lost dog spawns on open ground', () => {
  for (const seed of [1, 2, 3, 99, 1234]) {
    const g = new Game(seed);
    const b = {
      x: g.dog.x - g.dog.feetW / 2,
      y: g.dog.y - g.dog.feetH,
      w: g.dog.feetW,
      h: g.dog.feetH,
    };
    assert.equal(g.world.collides(b.x, b.y, b.w, b.h), false, `seed ${seed}: dog inside a trunk`);
  }
});

// --- Together: control, follow, captions -----------------------------------

test('story:false starts together, dog nearby, fetch greeting up', () => {
  const g = new Game(1, { story: false });
  assert.equal(g.together, true);
  assert.ok(Math.hypot(g.dog.x - g.person.x, g.dog.y - g.person.y) < 60);
  assert.equal(g.caption.text, 'FETCH IS OUR FAVORITE GAME!');
  assert.equal(g.leashActive(), true);
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

test('captions expire after CAPTION_TTL and the queue drains in order', () => {
  const g = openGame();
  assert.ok(g.caption, 'greets with a caption');
  runSeconds(g, CAPTION_TTL + 0.1);
  assert.equal(g.caption, null);
  g.say('ONE');
  g.say('TWO');
  g.say('THREE'); // three lines so FIFO vs LIFO is distinguishable
  assert.equal(g.caption.text, 'ONE');
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.equal(g.caption.text, 'TWO');
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.equal(g.caption.text, 'THREE');
  runSeconds(g, CAPTION_TTL + 0.05);
  assert.equal(g.caption, null);
});

test('distant dog walks back to the person', () => {
  const g = openGame();
  g.dog.x = g.person.x + 120;
  g.dog.y = g.person.y;
  runSeconds(g, 10);
  const dist = Math.hypot(g.dog.x - g.person.x, g.dog.y - g.person.y);
  assert.ok(dist < 60, `dog should come along (dist ${dist.toFixed(1)})`);
});

// --- Fetch ------------------------------------------------------------------

test('full fetch cycle: throw, chase, return, GOOD DOG + heart', () => {
  const g = openGame();
  g.update(STEP, { action: true });
  assert.equal(g.fetch, 'thrown');
  assert.ok(g.ball, 'ball exists after a throw');
  assert.equal(g.caption.text, 'FETCH IS OUR FAVORITE GAME!');
  assert.equal(g.leashActive(), false, 'the leash slips off for fetch');

  let sawReturning = false;
  let done = false;
  for (let i = 0; i < 60 * 20 && !done; i++) {
    g.update(STEP, IDLE);
    if (g.fetch === 'returning') sawReturning = true;
    if (g.fetch === 'idle' && sawReturning) done = true;
  }
  assert.ok(sawReturning, 'dog picked the ball up');
  assert.ok(done, 'dog delivered the ball back');
  assert.equal(g.ball, null);
  assert.equal(g.caption.text, 'GOOD DOG');
  assert.ok(g.hearts.length > 0, 'a heart appears');
  assert.equal(g.leashActive(), true, 'leash returns with the ball');
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
  runSeconds(g, 0.5);
  assert.equal(g.hearts.length, 0);
});

test('fetch survives a trunk directly between dog and ball (detour steering)', () => {
  // Regression: straight-line chasing wedged the dog on trunk corners and
  // soft-locked the fetch state machine forever. Real collision world here.
  const g = new Game(1, { story: false });
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
  runSeconds(g, FETCH_TIMEOUT + 1);
  assert.equal(g.fetch, 'idle');
  assert.equal(g.ball, null);
  g.update(STEP, {});
  g.update(STEP, { action: true });
  assert.ok(g.ball, 'throwing works again after the reset');
});

test('the ball cannot fly into a trunk — it drops at the trunk face', () => {
  const g = new Game(7, { story: false }); // real collision world
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

// --- Tap / click to move -----------------------------------------------------

test('a tap target walks the active character there and arrives', () => {
  const g = openGame();
  const tx = g.person.x + 50;
  const ty = g.person.y + 30;
  g.setMoveTarget(tx, ty);
  runSeconds(g, 5);
  assert.equal(g.moveTarget, null, 'target cleared on arrival');
  const dist = Math.hypot(g.person.x - tx, g.person.y - ty);
  assert.ok(dist <= TAP_ARRIVE + 1, `arrived (${dist.toFixed(1)}px away)`);
  assert.equal(g.person.walking, false, 'stops walking at the target');
});

test('keyboard input cancels a tap target', () => {
  const g = openGame();
  g.setMoveTarget(g.person.x + 100, g.person.y);
  g.update(STEP, { down: true });
  assert.equal(g.moveTarget, null);
});

test('swapping control clears the tap target', () => {
  const g = openGame();
  g.setMoveTarget(g.person.x + 100, g.person.y);
  g.update(STEP, { swap: true });
  assert.equal(g.moveTarget, null, 'the old target belonged to the person');
});

test('tap-move works while alone and can walk into the meeting', () => {
  const g = new Game(1);
  g.world.collides = () => false;
  g.setMoveTarget(g.dog.x, g.dog.y); // tap directly on the waiting dog
  runSeconds(g, 8);
  assert.equal(g.together, true, 'walked all the way to the dog and met it');
});

test('tap moves the dog when the dog is active', () => {
  const g = openGame();
  g.update(STEP, { swap: true });
  const tx = g.dog.x + 40;
  const ty = g.dog.y - 25;
  g.setMoveTarget(tx, ty);
  runSeconds(g, 4);
  assert.ok(Math.hypot(g.dog.x - tx, g.dog.y - ty) <= TAP_ARRIVE + 1, 'dog arrived');
});

test('a tap on a trunk is abandoned instead of wedging forever', () => {
  const g = new Game(1, { story: false }); // real collision world
  const tree = g.world.chunkAt(0, 0).trees.find((t) => t.kind === 'tree');
  const b = trunkBox(tree);
  g.person.x = b.x - 20;
  g.person.y = b.y + 2;
  g.setMoveTarget(b.x + b.w / 2, b.y + 2); // dead center of the trunk
  runSeconds(g, 10);
  assert.equal(g.moveTarget, null, 'gave up on the unreachable target');
  const px = g.person.x;
  g.update(STEP, { left: true });
  assert.ok(g.person.x < px, 'keyboard control works normally afterward');
});

test('same seed, same forest — the game world is reproducible', () => {
  const a = new Game(1337);
  const b = new Game(1337);
  assert.deepEqual(a.world.chunkAt(0, 0), b.world.chunkAt(0, 0));
  assert.deepEqual(a.world.chunkAt(-3, 5), b.world.chunkAt(-3, 5));
  assert.equal(a.dog.x, b.dog.x, 'the lost dog waits in the same place');
  assert.equal(a.dog.y, b.dog.y);
});
