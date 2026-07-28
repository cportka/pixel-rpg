// Game state: the story, who you control, the follow AI, captions, and fetch.
//
// Pure logic — no DOM, no canvas — so the whole simulation runs under
// `node --test`. The renderer reads this state; input is passed in as a plain
// object each update: { up, down, left, right, swap, action } (booleans).
//
// Story (docs/STORY.md): the game opens at the beginning of the universe with
// only the person, alone in the lonely dark woods. Somewhere out there waits
// a friendly lost dog. Finding it attaches the leash, unlocks swapping and
// fetch, and begins the long walk home together.

import { World, CHUNK } from './world.js';
import { mulberry32 } from './rng.js';
import { PERSON, DOG, makeCharacter, moveCharacter, updateFollower, feetBox } from './entities.js';

export const CAPTION_TTL = 3.2; // seconds a caption stays up
export const FETCH_TIMEOUT = 25; // seconds before a hopeless fetch resets
export const MEET_RADIUS = 30; // px at which the person finds the dog
export const HINT_PERIOD = 12; // seconds between whimper hints while alone
export const AMBIENT_PERIOD = 26; // seconds between ambient lines when together
export const TAP_ARRIVE = 3; // px at which a tap-move target counts as reached
export const TAP_GIVE_UP = 2.5; // seconds without progress before abandoning a tap target

const DOG_SPAWN_MIN = 170; // px from the person the lost dog waits
const DOG_SPAWN_MAX = 240;

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

const OPENING_LINES = [
  'IN THE BEGINNING THERE WAS ONLY THE DARK',
  'ONE SMALL PERSON, ALL ALONE IN THE WOODS',
];
const MEETING_LINES = ['A FRIENDLY LOST DOG!', 'TOGETHER WE WILL FIND HOME'];
const AMBIENT_LINES = [
  'FETCH IS OUR FAVORITE GAME!',
  'THE WOODS FEEL WARMER NOW',
  'HOME IS OUT THERE SOMEWHERE',
];

export class Game {
  /**
   * @param {number} seed world seed
   * @param {{story?: boolean}} opts story: false starts past the opening —
   *   dog already found and leashed (used by tests and quick demos).
   */
  constructor(seed = 1, { story = true } = {}) {
    this.world = new World(seed);
    this.rng = mulberry32(seed ^ 0x9e3779b9); // gameplay stream, separate from worldgen
    this.person = makeCharacter(PERSON, 0, 0);
    this.active = 'person';
    this.time = 0;

    this.caption = null; // { text, t }
    this.captionQueue = [];
    this.captionSticky = false; // one-shot story lines resist being clobbered
    this.hearts = []; // { x, y, t }
    this.ball = null; // { x, y, vx, vy, carried }
    this.fetch = 'idle'; // idle | thrown | returning
    this.fetchTime = 0; // how long the current fetch has been running
    this.nav = { stuck: 0, detour: 0, side: 1 }; // dog AI steering state
    this.moveTarget = null; // { x, y } — tap/click-to-move destination
    this.tapNav = { stuck: 0, detour: 0, side: 1 }; // steering state for tap-move
    this.tapStall = 0; // time without progress toward the tap target
    this.tapLastDist = Infinity;
    this.hintTimer = 0;
    this.ambientTimer = 0;
    this.ambientIndex = 0;
    this._prevSwap = false;
    this._prevAction = false;

    if (story) {
      this.together = false;
      this.dog = makeCharacter(DOG, ...this.placeLostDog());
      for (const line of OPENING_LINES) this.say(line);
    } else {
      this.together = true;
      this.dog = makeCharacter(DOG, -18, 8);
      this.say('FETCH IS OUR FAVORITE GAME!');
    }
  }

  /**
   * A collision-free spot for the lost dog, a walk away from the person —
   * and outside the opening viewport, so "ALL ALONE IN THE WOODS" is true
   * on frame one (the 170px spawn ring otherwise pokes into screen corners).
   */
  placeLostDog() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = DOG_SPAWN_MIN + this.rng() * (DOG_SPAWN_MAX - DOG_SPAWN_MIN);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      if (Math.abs(x) < 170 && y > -112 && y < 108) continue; // visible at start
      const b = feetBox({ feetW: DOG.feetW, feetH: DOG.feetH, x, y }, x, y);
      if (!this.world.collides(b.x, b.y, b.w, b.h)) return [x, y];
    }
    return [DOG_SPAWN_MAX, 0]; // forests are sparse; this is effectively unreachable
  }

  get activeChar() {
    return this.active === 'person' ? this.person : this.dog;
  }

  get otherChar() {
    return this.active === 'person' ? this.dog : this.person;
  }

  /** The dotted leash shows whenever the pair walk together (not mid-fetch). */
  leashActive() {
    return this.together && this.fetch === 'idle';
  }

  /** Show a caption now, or queue it behind the one on screen. */
  say(text) {
    if (!this.caption) {
      this.caption = { text, t: CAPTION_TTL };
    } else if (this.captionQueue.length < 4) {
      this.captionQueue.push(text);
    }
  }

  /**
   * Replace whatever is showing with a fresh sequence of lines — unless a
   * one-shot story sequence is still playing, in which case the new lines
   * queue politely behind it (routine lines must not eat story beats).
   */
  announce(lines) {
    if (this.captionSticky) {
      for (const line of lines) this.say(line);
      return;
    }
    this.caption = null;
    this.captionQueue = [];
    for (const line of lines) this.say(line);
  }

  swapControl() {
    if (!this.together) return;
    this.active = this.active === 'person' ? 'dog' : 'person';
    this.otherChar.following = false;
    this.clearMoveTarget(); // the old target belonged to the other character
    this.announce([this.active === 'person' ? 'YOU ARE THE PERSON' : 'YOU ARE THE DOG']);
  }

  /** Tap/click-to-move: walk the active character to a world position. */
  setMoveTarget(x, y) {
    this.moveTarget = { x, y };
    this.tapNav = { stuck: 0, detour: 0, side: 1 };
    this.tapStall = 0;
    this.tapLastDist = Infinity;
  }

  clearMoveTarget() {
    this.moveTarget = null;
    this.tapStall = 0;
    this.tapLastDist = Infinity;
  }

  /** The person finds the friendly lost dog. */
  meetDog() {
    this.together = true;
    this.dog.following = false;
    this.announce(MEETING_LINES);
    this.captionSticky = true; // this beat plays exactly once — protect it
    this.ambientTimer = 0;
    const mx = (this.person.x + this.dog.x) / 2;
    const my = Math.min(this.person.y, this.dog.y) - 14;
    this.hearts.push({ x: mx - 4, y: my, t: HEART_TTL }, { x: mx + 4, y: my - 3, t: HEART_TTL * 1.2 });
  }

  /** Person throws the pink ball in the direction they face. */
  throwBall() {
    if (!this.together || this.fetch !== 'idle') return;
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
    this.announce(['FETCH IS OUR FAVORITE GAME!']);
  }

  update(dt, input = {}) {
    this.time += dt;

    // Edge-detect swap/action so a held key fires once.
    if (input.swap && !this._prevSwap) this.swapControl();
    this._prevSwap = !!input.swap;
    if (input.action && !this._prevAction && this.active === 'person') this.throwBall();
    this._prevAction = !!input.action;

    // Player-controlled character: keys win over a tap target.
    const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dirX !== 0 || dirY !== 0) {
      this.clearMoveTarget();
      moveCharacter(this.activeChar, dirX, dirY, dt, this.world);
    } else if (this.moveTarget) {
      this.updateTapMove(dt);
    } else {
      moveCharacter(this.activeChar, 0, 0, dt, this.world);
    }

    if (this.together) {
      // The other one follows — unless the dog is mid-fetch, which takes priority.
      const dogBusy = this.fetch !== 'idle' && this.active === 'person';
      if (!dogBusy) {
        updateFollower(this.otherChar, this.activeChar, dt, this.world);
      }
      this.updateBall(dt);
      this.updateFetchAI(dt);
      this.updateAmbient(dt);
    } else {
      this.updateAlone(dt);
    }

    // Timers.
    if (this.caption) {
      this.caption.t -= dt;
      if (this.caption.t <= 0) {
        this.caption = null;
        const next = this.captionQueue.shift();
        if (next) this.caption = { text: next, t: CAPTION_TTL };
        else this.captionSticky = false; // the protected sequence has drained
      }
    }
    for (const h of this.hearts) h.t -= dt;
    this.hearts = this.hearts.filter((h) => h.t > 0);

    // Far-away chunks regenerate deterministically, so cache them only nearby.
    const c = this.activeChar;
    this.world.prune(Math.floor(c.x / CHUNK), Math.floor(c.y / CHUNK));
  }

  /** Walk toward the tap target; give up if a trunk makes it hopeless. */
  updateTapMove(dt) {
    const ch = this.activeChar;
    const t = this.moveTarget;
    const dist = Math.hypot(t.x - ch.x, t.y - ch.y);
    if (dist <= TAP_ARRIVE) {
      this.clearMoveTarget();
      ch.walking = false;
      return;
    }
    this.aiMoveToward(ch, t.x, t.y, dt, this.tapNav);
    const after = Math.hypot(t.x - ch.x, t.y - ch.y);
    if (this.tapLastDist - after < ch.speed * dt * 0.2) {
      this.tapStall += dt;
    } else {
      this.tapStall = 0;
    }
    this.tapLastDist = after;
    if (this.tapStall > TAP_GIVE_UP) this.clearMoveTarget(); // e.g. tapped a trunk
  }

  /** Alone in the dark: the lost dog waits; soft whimpers point the way. */
  updateAlone(dt) {
    const dx = this.dog.x - this.person.x;
    const dy = this.dog.y - this.person.y;
    if (Math.hypot(dx, dy) <= MEET_RADIUS) {
      this.meetDog();
      return;
    }
    this.hintTimer += dt;
    if (this.hintTimer >= HINT_PERIOD && !this.caption && this.captionQueue.length === 0) {
      this.hintTimer = 0;
      const compass = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'EAST' : 'WEST') : dy > 0 ? 'SOUTH' : 'NORTH';
      this.say(`A SOFT WHIMPER DRIFTS FROM THE ${compass}`);
    }
  }

  /** Occasional ambient story lines once the pair walk together. */
  updateAmbient(dt) {
    this.ambientTimer += dt;
    if (this.ambientTimer >= AMBIENT_PERIOD && !this.caption && this.fetch === 'idle') {
      this.ambientTimer = 0;
      this.say(AMBIENT_LINES[this.ambientIndex % AMBIENT_LINES.length]);
      this.ambientIndex++;
    }
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
  aiMoveToward(ch, tx, ty, dt, nav = this.nav) {
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
        this.announce(['GOOD DOG']);
        this.hearts.push({
          x: (person.x + dog.x) / 2,
          y: Math.min(person.y, dog.y) - 14,
          t: HEART_TTL,
        });
      }
    }
  }
}
