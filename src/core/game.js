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
import { regionAt, regionLandmarks } from './terrain.js';
import { mulberry32, hashCoords } from './rng.js';
import { PERSON, DOG, makeCharacter, moveCharacter, updateFollower, feetBox } from './entities.js';

export const CAPTION_TTL = 3.2; // seconds a caption stays up
export const FETCH_TIMEOUT = 25; // seconds before a hopeless fetch resets
export const MEET_RADIUS = 30; // px at which the person finds the dog
export const HINT_PERIOD = 12; // seconds between whimper hints while alone
export const AMBIENT_PERIOD = 26; // seconds between ambient lines when together
export const TAP_ARRIVE = 3; // px at which a tap-move target counts as reached
export const TAP_GIVE_UP = 2.5; // seconds without progress before abandoning a tap target

// Simplified D&D (docs/RULES.md): ability checks (d20 + modifier) vs a DC.
export const MAX_HP = 10;
export const ABILITIES = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
export const DC_SEARCH = 10; // rummaging a burning dumpster: INT, easy-ish
export const DC_SMOTHER = 15; // putting out a fire bare-handed: STR, hard
export const DC_GENIE = 12; // charming a genie out of an old lamp: CHA
export const DC_VISION = 15; // the pipe (WIS): this good or better, the woods speak
export const DC_COUGH = 7; // the pipe: this bad or worse, you pay for it
export const DC_FISTS = 12; // punching a zombie: STR
export const DC_BONE = 9; // swinging the bone: STR, but it's a club
export const ZOMBIE_HP = 4;
export const ZOMBIE_BITE = 2;
export const BONE_WEIGHT = 5; // lbs — the club
export const MEAT_WEIGHT = 2; // lbs — the meat still on it
export const DRUNK_TIME = 600; // seconds the pipe's inebriation lasts (10 min)
export const DRUNK_WIS_BONUS = 2; // wisdom flows easier while the colors lean in
export const COLLAPSE_HP = 5; // where the dog's rescue leaves you

// The remembered map (docs/RULES.md has none of this; memory keeps its own
// rules). Regions near the person refresh; the rest fade over minutes.
export const MEM_FRESH = 90; // s a memory stays sharp (landmarks and all)
export const MEM_FADED = 300; // s until only the barest outline remains
const ENCOUNTER_RADIUS = 26; // px at which an encounter opens its menu
const ENCOUNTER_REARM = 44; // walk this far away before it can re-open

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

    // Ability scores, rolled 3d6 each at the beginning of the universe.
    this.stats = {};
    for (const a of ABILITIES) {
      this.stats[a] =
        3 + Math.floor(this.rng() * 6) + Math.floor(this.rng() * 6) + Math.floor(this.rng() * 6);
    }

    this.caption = null; // { text, t }
    this.captionQueue = [];
    this.captionSticky = false; // one-shot story lines resist being clobbered
    this.events = []; // sound-event names for main.js to drain (capped)
    this.stepAcc = { person: 0, dog: 0 }; // distance walked since the last footstep
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
    this.seenInflatables = false; // the encounter caption plays once
    this.inflatableCheck = 0;
    this.glitch = { t: 0, dur: 1, seed: 0 }; // transition glitch: remaining/total time + burst seed

    // Home exists, somewhere far — a fixed direction per seed (Act 3
    // groundwork; today only the genie will tell you about it).
    this.homeAngle = (hashCoords(seed >>> 0, 999, 999) / 0x100000000) * Math.PI * 2;

    // Simplified D&D state.
    this.hp = MAX_HP;
    this.drunk = 0; // seconds of pipe inebriation remaining
    this.hasBone = false; // the dumpster bone doubles as a club
    this.boneMeat = false; // ...and starts with meat on it (+2 HP when eaten)
    this.zombieHp = new Map(); // per-zombie fight state, keyed like encounters
    this.choice = null; // active menu: { kind, key, x, y, title, options: [{id, label}] }
    this.choiceIndex = 0;
    this.choiceCooldown = null; // { key, x, y } — recently closed, re-arms at distance
    this.encounterDone = new Set(); // encounter keys that resolved for good
    this.dumpstersOut = new Set(); // dumpsters whose fire was smothered
    this.encounterCheck = 0;

    // What the person remembers of the world: region key → landmarks +
    // when they last saw it. Never forgotten outright — only faded.
    this.memory = new Map();
    this.memoryCheck = 0;

    this._prevUp = false;
    this._prevDown = false;
    this._prevSwap = false;
    this._prevAction = false;
    this._prevSheet = false;
    this._prevMap = false;

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

  /** Queue a named sound event for the frontend to play (capped, droppable). */
  emit(name) {
    if (this.events.length < 32) this.events.push(name);
  }

  /** Put a caption on screen now, with its talk blip. */
  displayCaption(text) {
    this.caption = { text, t: CAPTION_TTL };
    this.emit(text.startsWith('A SOFT WHIMPER') ? 'whimper' : 'caption');
  }

  /** Show a caption now, or queue it behind the one on screen. */
  say(text) {
    if (!this.caption) {
      this.displayCaption(text);
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

  /** Roll a d20 from the gameplay rng stream. */
  d20() {
    this.emit('roll');
    return 1 + Math.floor(this.rng() * 20);
  }

  /** D&D modifier for an ability — drunkenness sharpens wisdom, oddly. */
  mod(ability) {
    let m = Math.floor((this.stats[ability] - 10) / 2);
    if (ability === 'wis' && this.drunk > 0) m += DRUNK_WIS_BONUS;
    return m;
  }

  /** An ability check: d20 + modifier vs nothing in particular yet. */
  check(ability) {
    const roll = this.d20();
    const mod = this.mod(ability);
    return { roll, mod, total: roll + mod };
  }

  /** Caption-ready roll text: "D20: 14+2" (mod shown only when nonzero). */
  rollText(c) {
    const m = c.mod === 0 ? '' : c.mod > 0 ? `+${c.mod}` : `${c.mod}`;
    return `D20: ${c.roll}${m}`;
  }

  /** Fist damage scales with raw strength: floor(STR / 4). */
  fistDamage() {
    return Math.floor(this.stats.str / 4);
  }

  /** The bone is a club: fist damage +1 (so it always does something). */
  boneDamage() {
    return this.fistDamage() + 1;
  }

  /** How much the person can haul: STR x 10 + CON x 20 lbs. */
  carryCapacity() {
    return this.stats.str * 10 + this.stats.con * 20;
  }

  /** What they're hauling now. The forest travels light, so far. */
  carriedWeight() {
    return (this.hasBone ? BONE_WEIGHT : 0) + (this.boneMeat ? MEAT_WEIGHT : 0);
  }

  /** Which compass way is home? (The genie knows.) */
  homeCompass() {
    const dx = Math.cos(this.homeAngle);
    const dy = Math.sin(this.homeAngle);
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'EAST' : 'WEST') : dy > 0 ? 'SOUTH' : 'NORTH';
  }

  /** Lose HP; at 0 the dog drags you back from the brink. */
  damage(n) {
    this.hp = Math.max(0, this.hp - n);
    this.emit('damage');
    this.triggerGlitch(0.3);
    if (this.hp === 0) {
      this.hp = COLLAPSE_HP;
      this.emit('collapse');
      this.triggerGlitch(0.6);
      this.announce([
        this.together ? 'YOU COLLAPSE. THE DOG WATCHES OVER YOU' : 'YOU COLLAPSE. THE DARK IS PATIENT',
      ]);
    }
  }

  heal(n) {
    this.hp = Math.min(MAX_HP, this.hp + n);
  }

  /** Kick off a brief transition glitch (renderer reads this.glitch). */
  triggerGlitch(duration = 0.35) {
    this.glitch = {
      t: duration,
      dur: duration,
      seed: Math.floor(this.rng() * 0xffffffff) >>> 0,
    };
  }

  swapControl() {
    if (!this.together) return;
    this.active = this.active === 'person' ? 'dog' : 'person';
    this.otherChar.following = false;
    this.clearMoveTarget(); // the old target belonged to the other character
    this.emit('swap');
    this.triggerGlitch();
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
    this.emit('meet');
    this.triggerGlitch(0.5); // the big one — the universe changes shape here
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
    this.emit('throw');
    this.triggerGlitch(0.25);
    this.announce(['FETCH IS OUR FAVORITE GAME!']);
  }

  /** Advance the timers that keep running even while a menu is open. */
  tickTimers(dt) {
    if (this.caption) {
      this.caption.t -= dt;
      if (this.caption.t <= 0) {
        this.caption = null;
        const next = this.captionQueue.shift();
        if (next) this.displayCaption(next);
        else this.captionSticky = false; // the protected sequence has drained
      }
    }
    for (const h of this.hearts) h.t -= dt;
    this.hearts = this.hearts.filter((h) => h.t > 0);
    if (this.glitch.t > 0) this.glitch.t = Math.max(0, this.glitch.t - dt);
    if (this.drunk > 0) {
      this.drunk = Math.max(0, this.drunk - dt);
      if (this.drunk === 0) this.say('THE WORLD SETTLES BACK DOWN');
    }
  }

  /** True while a world-pausing screen (inventory or map) is up. */
  menuPaused() {
    return !!this.choice && (this.choice.kind === 'sheet' || this.choice.kind === 'map');
  }

  update(dt, input = {}) {
    // A choice menu freezes the walk: up/down select, action confirms.
    // The inventory and map screens go further and pause the world outright —
    // no time, no timers, no drunk countdown while you read.
    if (this.choice) {
      const paused = this.menuPaused();
      if (!paused) this.time += dt;
      const n = this.choice.options.length;
      if (input.up && !this._prevUp) {
        this.choiceIndex = (this.choiceIndex + n - 1) % n;
        this.emit('menu-move');
      }
      if (input.down && !this._prevDown) {
        this.choiceIndex = (this.choiceIndex + 1) % n;
        this.emit('menu-move');
      }
      if (input.action && !this._prevAction) this.resolveChoice(this.choice.options[this.choiceIndex].id);
      this._prevUp = !!input.up;
      this._prevDown = !!input.down;
      this._prevAction = !!input.action;
      this._prevSwap = !!input.swap;
      this._prevSheet = !!input.sheet;
      this._prevMap = !!input.map;
      if (!paused) this.tickTimers(dt);
      return;
    }

    this.time += dt;

    // Edge-detect swap/action/sheet/map so a held key fires once.
    if (input.swap && !this._prevSwap) this.swapControl();
    this._prevSwap = !!input.swap;
    if (input.action && !this._prevAction && this.active === 'person') this.throwBall();
    this._prevAction = !!input.action;
    if (input.sheet && !this._prevSheet) this.openSheet();
    this._prevSheet = !!input.sheet;
    if (input.map && !this._prevMap) this.openMap();
    this._prevMap = !!input.map;
    this._prevUp = !!input.up;
    this._prevDown = !!input.down;
    if (this.choice) return; // a pause screen opened this very tick — freeze now

    // Snapshot positions so footsteps can be paced by distance walked.
    const prevPX = this.person.x;
    const prevPY = this.person.y;
    const prevDX = this.dog.x;
    const prevDY = this.dog.y;

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

    // Soft footsteps, paced by distance actually covered this tick.
    this.stepAcc.person += Math.hypot(this.person.x - prevPX, this.person.y - prevPY);
    this.stepAcc.dog += Math.hypot(this.dog.x - prevDX, this.dog.y - prevDY);
    if (this.stepAcc.person >= 9) {
      this.stepAcc.person = 0;
      this.emit('step-person');
    }
    if (this.stepAcc.dog >= 7) {
      this.stepAcc.dog = 0;
      this.emit('step-dog');
    }

    this.tickTimers(dt);

    // Rare encounters open their menus when the person wanders close.
    this.encounterCheck += dt;
    if (this.encounterCheck >= 0.3) {
      this.encounterCheck = 0;
      this.checkEncounters();
    }

    // Coming upon the dancing inflatables plays a one-shot caption.
    this.inflatableCheck += dt;
    if (!this.seenInflatables && this.inflatableCheck >= 0.5) {
      this.inflatableCheck = 0;
      const a = this.activeChar;
      if (this.world.inflatablesInRect(a.x - 70, a.y - 70, 140, 140).length > 0) {
        this.seenInflatables = true;
        this.emit('inflatables');
        this.triggerGlitch(0.5);
        this.announce(['THE INFLATABLES DANCE. NO ONE KNOWS WHY']);
        this.captionSticky = true; // one-shot — protect it like the meeting
      }
    }

    // The person quietly memorizes the regions around them.
    this.memoryCheck += dt;
    if (this.memoryCheck >= 0.5) {
      this.memoryCheck = 0;
      this.updateMemory();
    }

    // Far-away chunks regenerate deterministically, so cache them only nearby.
    const c = this.activeChar;
    this.world.prune(Math.floor(c.x / CHUNK), Math.floor(c.y / CHUNK));
  }

  /** Refresh the person's memory of the regions in sight (3x3 around them). */
  updateMemory() {
    const { rx, ry } = regionAt(this.person.x, this.person.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${rx + dx},${ry + dy}`;
        const marks = regionLandmarks(this.world.seed, rx + dx, ry + dy);
        this.memory.set(key, { rx: rx + dx, ry: ry + dy, ...marks, seenAt: this.time });
      }
    }
  }

  /** How well a memory entry is remembered right now. */
  memoryLevel(entry) {
    const age = this.time - entry.seenAt;
    return age < MEM_FRESH ? 'fresh' : age < MEM_FADED ? 'faded' : 'outline';
  }

  /** The map screen: everything the person remembers, faded by time. Pauses. */
  openMap() {
    this.openChoice({
      kind: 'map',
      key: 'map',
      x: this.person.x,
      y: this.person.y,
      title: 'WHAT YOU REMEMBER',
      options: [{ id: 'close', label: 'CLOSE' }],
    });
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

  /** Freeze the walk and put a menu up (also used by chained menus). */
  openChoice(choice) {
    this.choice = choice;
    this.choiceIndex = 0;
    this.clearMoveTarget();
    this.emit('menu-open');
    this.triggerGlitch(0.25);
  }

  /** Open encounter menus for whatever the person walks up to. */
  checkEncounters() {
    if (this.active !== 'person') return; // the dog is unbothered by all of it
    const p = this.person;
    // Re-arm a recently closed menu only once you've actually walked away.
    if (this.choiceCooldown) {
      const cd = this.choiceCooldown;
      if (Math.hypot(cd.x - p.x, cd.y - p.y) > ENCOUNTER_REARM) this.choiceCooldown = null;
    }
    const blocked = (key) => this.encounterDone.has(key) || this.choiceCooldown?.key === key;
    const near = (method) =>
      this.world[method](p.x - ENCOUNTER_RADIUS, p.y - ENCOUNTER_RADIUS, ENCOUNTER_RADIUS * 2, ENCOUNTER_RADIUS * 2);

    const KINDS = [
      {
        method: 'dumpstersInRect',
        prefix: 'd',
        kind: 'dumpster',
        title: 'A DUMPSTER BURNS IN THE DARK',
        options: [
          { id: 'search', label: 'SEARCH THE DUMPSTER' },
          { id: 'putout', label: 'PUT OUT THE FIRE (HOW?)' },
          { id: 'walkaway', label: 'WALK AWAY' },
        ],
      },
      {
        method: 'catsInRect',
        prefix: 'c',
        kind: 'cat',
        title: 'A PSYCHEDELIC CAT REGARDS YOU',
        options: [
          { id: 'talk', label: 'TALK TO HIM' },
          { id: 'pet', label: 'PET HIM' },
          { id: 'grab', label: 'GRAB HIM' },
        ],
      },
      {
        method: 'lampsInRect',
        prefix: 'l',
        kind: 'lamp',
        title: 'AN OLD LAMP GLINTS IN THE LITTER',
        options: [
          { id: 'rub', label: 'RUB THE LAMP' },
          { id: 'walkaway', label: 'LEAVE IT BE' },
        ],
      },
      {
        method: 'pipesInRect',
        prefix: 'p',
        kind: 'pipe',
        title: 'A PIPE OF HALF-BURNT GREEN LEAF',
        options: [
          { id: 'smoke', label: 'SMOKE THE PIPE' },
          { id: 'sniff', label: 'SNIFF IT' },
          { id: 'walkaway', label: 'LEAVE IT BE' },
        ],
      },
    ];

    for (const spec of KINDS) {
      for (const f of near(spec.method)) {
        const key = `${spec.prefix}:${f.x},${f.y}`;
        if (blocked(key)) continue;
        this.openChoice({ kind: spec.kind, key, x: f.x, y: f.y, title: spec.title, options: spec.options });
        return;
      }
    }

    // Zombies get their own path: options depend on the bone, and they groan.
    for (const z of near('zombiesInRect')) {
      const key = `z:${z.x},${z.y}`;
      if (blocked(key)) continue;
      this.emit('zombie');
      this.openChoice(this.zombieMenu(key, z.x, z.y));
      return;
    }
  }

  /** Resolve the open menu (docs/RULES.md has the numbers). */
  resolveChoice(id) {
    const c = this.choice;
    if (!c) return;
    this.choice = null;
    this.choiceIndex = 0;
    this.choiceCooldown = { key: c.key, x: c.x, y: c.y };
    this.emit('menu-confirm');

    if (c.kind === 'dumpster') {
      if (id === 'search') {
        this.encounterDone.add(c.key);
        const r = this.check('int');
        if (r.total >= DC_SEARCH) {
          this.hasBone = true;
          this.boneMeat = true;
          this.emit('heal');
          this.hearts.push({ x: c.x, y: c.y - 16, t: 1.6 });
          this.announce([`${this.rollText(r)} - YOU PULL OUT A MEATY BONE`]);
          this.openChoice({
            kind: 'bone',
            key: `${c.key}:bone`,
            x: c.x,
            y: c.y,
            title: 'A MEATY BONE',
            options: [
              { id: 'eat', label: 'GNAW OFF THE MEAT (+2 HP)' },
              { id: 'save', label: 'SAVE IT FOR LATER' },
            ],
          });
        } else {
          this.announce([`${this.rollText(r)} - THE FIRE BITES YOU (-1 HP)`]);
          this.damage(1);
        }
      } else if (id === 'putout') {
        const r = this.check('str');
        if (r.total >= DC_SMOTHER) {
          this.dumpstersOut.add(c.key);
          this.encounterDone.add(c.key);
          this.triggerGlitch(0.4);
          this.announce([`${this.rollText(r)} - SOMEHOW YOU SMOTHER IT`]);
        } else {
          this.announce([`${this.rollText(r)} - WITH WHAT? IT BURNS ON`]);
        }
      }
      // walkaway: nothing — the cooldown lets you leave in peace.
    } else if (c.kind === 'bone') {
      if (id === 'eat') this.eatBoneMeat();
      else this.announce(['YOU POCKET THE MEATY BONE']);
    } else if (c.kind === 'sheet') {
      if (id === 'eat') this.eatBoneMeat();
      else if (id === 'fists' || id === 'bone') this.attackFromSheet(id);
      else if (id === 'ball') this.throwBall();
      // close: nothing.
    } else if (c.kind === 'map') {
      // close: the world resumes.
    } else if (c.kind === 'zombie') {
      this.resolveZombie(c, id);
    } else if (c.kind === 'cat') {
      this.encounterDone.add(c.key); // however this goes, the cat is gone
      this.triggerGlitch(0.4);
      if (id === 'talk') {
        this.emit('vanish');
        this.announce(['THE CAT DISSOLVES INTO STATIC']);
      } else {
        this.emit('vanish');
        this.announce(['THE CAT SCRATCHES YOU (-1 HP) AND VANISHES']);
        this.damage(1);
      }
    } else if (c.kind === 'lamp') {
      if (id === 'rub') {
        const r = this.check('cha');
        const roll = r.total;
        if (roll >= DC_GENIE) {
          this.emit('genie');
          this.triggerGlitch(0.5);
          this.announce([`${this.rollText(r)} - A GENIE BILLOWS OUT IN VIOLET SMOKE`]);
          // Chain straight into the wish menu (same key: resolving any wish
          // finishes the lamp).
          this.openChoice({
            kind: 'genie',
            key: c.key,
            x: c.x,
            y: c.y,
            title: 'THE GENIE OFFERS ONE WISH',
            options: [
              { id: 'health', label: 'WISH FOR HEALTH' },
              { id: 'home', label: 'WISH FOR HOME' },
              { id: 'wishes', label: 'WISH FOR MORE WISHES' },
            ],
          });
        } else {
          this.announce([`${this.rollText(r)} - ONLY DUST AND A FAINT COUGH INSIDE`]);
        }
      }
      // walkaway: the lamp keeps glinting.
    } else if (c.kind === 'genie') {
      this.encounterDone.add(c.key); // one wish, then lamp and genie are gone
      this.triggerGlitch(0.5);
      if (id === 'health') {
        this.hp = MAX_HP;
        this.emit('heal');
        this.hearts.push({ x: c.x, y: c.y - 14, t: 1.6 });
        this.announce(['YOUR WOUNDS UNWIND (FULL HP)']);
      } else if (id === 'home') {
        this.announce([`THE GENIE POINTS. HOME IS FAR TO THE ${this.homeCompass()}`]);
      } else {
        this.announce(['THE GENIE ROLLS HIS EYES AND VANISHES']);
      }
    } else if (c.kind === 'pipe') {
      if (id === 'smoke') {
        this.encounterDone.add(c.key); // the leaf only had one bowl in it
        const r = this.check('wis');
        if (r.total >= DC_VISION) {
          this.drunk = DRUNK_TIME;
          this.emit('vision');
          this.emit('drunk');
          this.triggerGlitch(1.2); // the long one
          this.announce([
            `${this.rollText(r)} - THE STARS LEAN CLOSER`,
            'A VISION: THE INFLATABLES DANCE AT THE CENTER OF ALL THINGS',
            'THE COLORS LEAN CLOSER TOO (DRUNK 10:00)',
          ]);
        } else if (r.total <= DC_COUGH) {
          this.announce([`${this.rollText(r)} - YOU COUGH FOR A FULL MINUTE (-1 HP)`, 'THE PIPE IS SPENT']);
          this.damage(1);
        } else {
          this.announce([`${this.rollText(r)} - NOTHING. PROBABLY OAK LEAF`, 'THE PIPE IS SPENT']);
        }
      } else if (id === 'sniff') {
        this.announce(['IT SMELLS LIKE REGRET AND LAWN CLIPPINGS']);
      }
      // walkaway: it keeps smoldering.
    }
  }

  /** Gnaw the meat off the dumpster bone: +2 HP, the bone remains a club. */
  eatBoneMeat() {
    if (!this.boneMeat) return;
    this.boneMeat = false;
    this.heal(2);
    this.emit('eat');
    this.announce(['YOU GNAW OFF THE MEAT (+2 HP). THE BONE REMAINS']);
  }

  /**
   * The action & inventory screen (I key, or double-click your character).
   * Pauses the world; offers whatever you can do with what you carry.
   */
  openSheet() {
    const person = this.active === 'person';
    this.openChoice({
      kind: 'sheet',
      key: 'sheet',
      x: this.person.x,
      y: this.person.y,
      title: 'YOU',
      options: [
        ...(this.boneMeat ? [{ id: 'eat', label: 'GNAW THE BONE MEAT (+2 HP)' }] : []),
        ...(person && this.hasBone ? [{ id: 'bone', label: 'SWING THE BONE' }] : []),
        ...(person ? [{ id: 'fists', label: 'ATTACK WITH FISTS' }] : []),
        ...(person && this.together && this.fetch === 'idle'
          ? [{ id: 'ball', label: 'THROW THE BALL' }]
          : []),
        { id: 'close', label: 'CLOSE' },
      ],
    });
  }

  /** Swing from the inventory at whatever undead thing is in reach. */
  attackFromSheet(id) {
    const p = this.person;
    const zombies = this.world.zombiesInRect(
      p.x - ENCOUNTER_RADIUS, p.y - ENCOUNTER_RADIUS, ENCOUNTER_RADIUS * 2, ENCOUNTER_RADIUS * 2,
    );
    for (const z of zombies) {
      const key = `z:${z.x},${z.y}`;
      if (this.encounterDone.has(key)) continue;
      this.resolveZombie({ kind: 'zombie', key, x: z.x, y: z.y }, id);
      return;
    }
    this.emit('throw'); // the whoosh of hitting nothing
    this.announce([
      id === 'bone' ? 'YOU SWING AT THE DARK. IT DOES NOT MIND' : 'YOU PUNCH AT THE DARK. IT DOES NOT MIND',
    ]);
  }

  /** The zombie fight menu (options depend on what you're carrying). */
  zombieMenu(key, x, y) {
    return {
      kind: 'zombie',
      key,
      x,
      y,
      title: 'A ZOMBIE SHAMBLES IN PLACE',
      options: [
        { id: 'befriend', label: 'TRY TO BEFRIEND IT' },
        { id: 'fists', label: 'ATTACK WITH FISTS' },
        ...(this.hasBone ? [{ id: 'bone', label: 'SWING THE BONE' }] : []),
        { id: 'run', label: 'RUN AWAY' },
      ],
    };
  }

  resolveZombie(c, id) {
    if (id === 'run') return; // it is not fast. the cooldown covers your exit.
    const hp = this.zombieHp.get(c.key) ?? ZOMBIE_HP;

    if (id === 'befriend') {
      this.announce(['THE ZOMBIE DOES NOT WANT FRIENDS']);
      this.zombieBites(c);
      return;
    }

    const weapon = id === 'bone' && this.hasBone;
    const r = this.check('str');
    const dc = weapon ? DC_BONE : DC_FISTS;
    const dmg = weapon ? this.boneDamage() : this.fistDamage();
    if (r.total >= dc) {
      if (dmg <= 0) {
        // A STR-3 punch lands and accomplishes nothing. No bite either —
        // you did, technically, hit it.
        this.announce([`${this.rollText(r)} - YOUR FISTS BOUNCE OFF HARMLESSLY`]);
        this.openChoice(this.zombieMenu(c.key, c.x, c.y));
        return;
      }
      const left = hp - dmg;
      if (weapon) this.emit('bonk');
      if (left <= 0) {
        this.encounterDone.add(c.key);
        this.zombieHp.delete(c.key);
        this.emit('vanish');
        this.triggerGlitch(0.4);
        this.announce([
          `${this.rollText(r)} - ${weapon ? 'BONK! THE BONE RINGS TRUE' : 'YOU LAND ONE'}`,
          'THE ZOMBIE CRUMBLES. THE FOREST EXHALES',
        ]);
      } else {
        this.zombieHp.set(c.key, left);
        this.announce([`${this.rollText(r)} - ${weapon ? 'BONK! IT STAGGERS' : 'YOU LAND ONE. IT STAGGERS'}`]);
        this.openChoice(this.zombieMenu(c.key, c.x, c.y));
      }
    } else {
      this.announce([`${this.rollText(r)} - YOU MISS`]);
      this.zombieBites(c);
    }
  }

  /** The zombie's answer to everything. Too weak, and it samples your brain. */
  zombieBites(c) {
    this.emit('zombie');
    const lethal = this.hp <= ZOMBIE_BITE;
    this.damage(ZOMBIE_BITE);
    if (lethal) {
      // Brains, partially eaten. The fight ends; the cooldown lets you crawl off.
      this.stats.int = Math.max(1, this.stats.int - 1);
      this.announce([
        'IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)',
        this.together ? 'THE DOG DRAGS YOU AWAY' : 'YOU WAKE ALONE, AND LIGHTER',
      ]);
    } else {
      this.say(`IT BITES (-${ZOMBIE_BITE} HP)`);
      this.openChoice(this.zombieMenu(c.key, c.x, c.y));
    }
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
        this.emit('pickup');
        this.triggerGlitch(0.2);
      }
    } else if (this.fetch === 'returning') {
      b.x = dog.x + dog.facing * 6;
      b.y = dog.y - 4;
      if (dogIsAI) this.aiMoveToward(dog, person.x, person.y, dt);
      if (Math.hypot(person.x - dog.x, person.y - dog.y) <= DELIVER_RADIUS) {
        this.ball = null;
        this.fetch = 'idle';
        this.emit('deliver');
        this.triggerGlitch(0.25);
        this.heal(1); // a good game of fetch mends the heart (docs/RULES.md)
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
