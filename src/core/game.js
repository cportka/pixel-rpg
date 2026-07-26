// Game state: who you control, the follow AI, captions, and fetch.
//
// Pure logic — no DOM, no canvas — so the whole simulation runs under
// `node --test`. The renderer reads this state; input is passed in as a plain
// object each update: { up, down, left, right, swap, action } (booleans).

import { World, CHUNK } from './world.js';
import { mulberry32 } from './rng.js';
import { PERSON, DOG, makeCharacter, moveCharacter, updateFollower, feetBox } from './entities.js';

export const CAPTION_TTL = 3.2; // seconds a caption stays up
export const FETCH_TIMEOUT = 25; // seconds before a hopeless fetch resets

const BALL_THROW_SPEED = 130; // px/s
const BALL_DRAG = 140; // px/s^2
const PICKUP_RADIUS = 7;
const DELIVER_RADIUS = 12;
const HEART_TTL = 1.6;

// Detour steering: the AI notices it stopped making progress toward its
// target (wedged on a trunk) and sidesteps perpendicular for a moment.
const STUCK_PROGRESS = 0.3; // fraction of full speed below which we count as stuck
const STUCK_DELAY = 0.25; // seconds of no progress before detouring
const DETOUR_TIME = 0.45; // seconds spent sidestepping

export class Game {
  constructor(seed = 1) {
    this.world = new World(seed);
    this.rng = mulberry32(seed ^ 0x9e3779b9); // gameplay stream, separate from worldgen
    this.person = makeCharacter(PERSON, 0, 0);
    this.dog = makeCharacter(DOG, -18, 8);
    this.active = 'person';
    this.time = 0;

    this.caption = null; // { text, t }
    this.hearts = []; // { x, y, t }
    this.ball = null; // { x, y, vx, vy, carried }
    this.fetch = 'idle'; // idle | thrown | returning
    this.fetchTime = 0; // how long the current fetch has been running
    this.nav = { stuck: 0, detour: 0, side: 1 }; // dog AI steering state
    this._prevSwap = false;
    this._prevAction = false;

    this.say('FETCH IS OUR FAVORITE GAME!');
  }

  get activeChar() {
    return this.active === 'person' ? this.person : this.dog;
  }

  get otherChar() {
    return this.active === 'person' ? this.dog : this.person;
  }

  say(text) {
    this.caption = { text, t: CAPTION_TTL };
  }

  swapControl() {
    this.active = this.active === 'person' ? 'dog' : 'person';
    this.otherChar.following = false;
    this.say(this.active === 'person' ? 'YOU ARE THE PERSON' : 'YOU ARE THE DOG');
  }

  /** Person throws the pink ball in the direction they face. */
  throwBall() {
    if (this.fetch !== 'idle') return;
    const p = this.person;
    let x = p.x + p.facing * 6;
    let y = p.y - 6;
    if (this.world.collides(x - 1, y - 1, 2, 2)) {
      x = p.x; // facing straight into a trunk — drop at their feet instead
      y = p.y - 1;
    }
    this.ball = {
      x,
      y,
      vx: p.facing * BALL_THROW_SPEED,
      vy: -10 + this.rng() * 20,
      carried: false,
    };
    this.fetch = 'thrown';
    this.fetchTime = 0;
    this.nav = { stuck: 0, detour: 0, side: 1 };
    this.say('FETCH IS OUR FAVORITE GAME!');
  }

  update(dt, input = {}) {
    this.time += dt;

    // Edge-detect swap/action so a held key fires once.
    if (input.swap && !this._prevSwap) this.swapControl();
    this._prevSwap = !!input.swap;
    if (input.action && !this._prevAction && this.active === 'person') this.throwBall();
    this._prevAction = !!input.action;

    // Player-controlled character.
    const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    moveCharacter(this.activeChar, dirX, dirY, dt, this.world);

    // The other one follows — unless the dog is mid-fetch, which takes priority.
    const dogBusy = this.fetch !== 'idle' && this.active === 'person';
    if (!dogBusy) {
      updateFollower(this.otherChar, this.activeChar, dt, this.world);
    }

    this.updateBall(dt);
    this.updateFetchAI(dt);

    // Timers.
    if (this.caption) {
      this.caption.t -= dt;
      if (this.caption.t <= 0) this.caption = null;
    }
    for (const h of this.hearts) h.t -= dt;
    this.hearts = this.hearts.filter((h) => h.t > 0);

    // Far-away chunks regenerate deterministically, so cache them only nearby.
    const c = this.activeChar;
    this.world.prune(Math.floor(c.x / CHUNK), Math.floor(c.y / CHUNK));
  }

  updateBall(dt) {
    const b = this.ball;
    if (!b || b.carried) return;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    if (this.world.collides(nx - 1, ny - 1, 2, 2)) {
      b.vx = 0; // bonk — the ball drops at the trunk's foot, still reachable
      b.vy = 0;
    } else {
      b.x = nx;
      b.y = ny;
    }
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const drop = Math.max(0, speed - BALL_DRAG * dt);
      const k = drop / speed;
      b.vx *= k;
      b.vy *= k;
    }
  }

  /**
   * Move the AI dog toward a target, sidestepping when a trunk stalls it.
   * Straight-line chasing wedges on trunk corners (the slide component decays
   * to zero); progress tracking + a perpendicular detour breaks the wedge.
   */
  aiMoveToward(ch, tx, ty, dt) {
    const nav = this.nav;
    if (nav.detour > 0) {
      nav.detour -= dt;
      const dx = tx - ch.x;
      const dy = ty - ch.y;
      const len = Math.hypot(dx, dy) || 1;
      moveCharacter(ch, (-dy / len) * nav.side, (dx / len) * nav.side, dt, this.world);
      return;
    }
    const before = Math.hypot(tx - ch.x, ty - ch.y);
    moveCharacter(ch, tx - ch.x, ty - ch.y, dt, this.world);
    const after = Math.hypot(tx - ch.x, ty - ch.y);
    if (before - after < ch.speed * dt * STUCK_PROGRESS && before > PICKUP_RADIUS) {
      nav.stuck += dt;
      if (nav.stuck >= STUCK_DELAY) {
        nav.stuck = 0;
        nav.detour = DETOUR_TIME;
        nav.side = this.pickFreeSide(ch, tx, ty);
      }
    } else {
      nav.stuck = 0;
    }
  }

  /** Which perpendicular side of the path is open to step toward? */
  pickFreeSide(ch, tx, ty) {
    const dx = tx - ch.x;
    const dy = ty - ch.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const open = (s) => {
      const b = feetBox(ch, ch.x + px * s * 8, ch.y + py * s * 8);
      return !this.world.collides(b.x, b.y, b.w, b.h);
    };
    if (open(1)) return 1;
    if (open(-1)) return -1;
    return this.rng() < 0.5 ? 1 : -1;
  }

  updateFetchAI(dt) {
    const b = this.ball;
    if (!b) return;
    const dog = this.dog;
    const person = this.person;
    const dogIsAI = this.active === 'person';

    this.fetchTime += dt;
    if (this.fetchTime > FETCH_TIMEOUT && this.fetch === 'thrown') {
      // Safety net: the ball ended up somewhere hopeless — forget it.
      this.ball = null;
      this.fetch = 'idle';
      return;
    }

    if (this.fetch === 'thrown') {
      if (dogIsAI) this.aiMoveToward(dog, b.x, b.y, dt);
      if (Math.hypot(b.x - dog.x, b.y - (dog.y - 3)) <= PICKUP_RADIUS) {
        b.carried = true;
        this.fetch = 'returning';
        this.nav = { stuck: 0, detour: 0, side: 1 };
      }
    } else if (this.fetch === 'returning') {
      b.x = dog.x + dog.facing * 6;
      b.y = dog.y - 4;
      if (dogIsAI) this.aiMoveToward(dog, person.x, person.y, dt);
      if (Math.hypot(person.x - dog.x, person.y - dog.y) <= DELIVER_RADIUS) {
        this.ball = null;
        this.fetch = 'idle';
        this.say('GOOD DOG');
        this.hearts.push({
          x: (person.x + dog.x) / 2,
          y: Math.min(person.y, dog.y) - 14,
          t: HEART_TTL,
        });
      }
    }
  }
}
