// Game state: who you control, the follow AI, captions, and fetch.
//
// Pure logic — no DOM, no canvas — so the whole simulation runs under
// `node --test`. The renderer reads this state; input is passed in as a plain
// object each update: { up, down, left, right, swap, action } (booleans).

import { World } from './world.js';
import { mulberry32 } from './rng.js';
import { PERSON, DOG, makeCharacter, moveCharacter, updateFollower } from './entities.js';

export const CAPTION_TTL = 3.2; // seconds a caption stays up

const BALL_THROW_SPEED = 130; // px/s
const BALL_DRAG = 140; // px/s^2
const PICKUP_RADIUS = 7;
const DELIVER_RADIUS = 12;
const HEART_TTL = 1.6;

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
    this.ball = {
      x: p.x + p.facing * 6,
      y: p.y - 6,
      vx: p.facing * BALL_THROW_SPEED,
      vy: -10 + this.rng() * 20,
      carried: false,
    };
    this.fetch = 'thrown';
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
  }

  updateBall(dt) {
    const b = this.ball;
    if (!b || b.carried) return;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const drop = Math.max(0, speed - BALL_DRAG * dt);
      const k = speed > 0 ? drop / speed : 0;
      b.vx *= k;
      b.vy *= k;
    }
  }

  updateFetchAI(dt) {
    const b = this.ball;
    if (!b) return;
    const dog = this.dog;
    const person = this.person;
    const dogIsAI = this.active === 'person';

    if (this.fetch === 'thrown') {
      if (dogIsAI) moveCharacter(dog, b.x - dog.x, b.y - dog.y, dt, this.world);
      if (Math.hypot(b.x - dog.x, b.y - (dog.y - 3)) <= PICKUP_RADIUS) {
        b.carried = true;
        this.fetch = 'returning';
      }
    } else if (this.fetch === 'returning') {
      b.x = dog.x + dog.facing * 6;
      b.y = dog.y - 4;
      if (dogIsAI) moveCharacter(dog, person.x - dog.x, person.y - dog.y, dt, this.world);
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
