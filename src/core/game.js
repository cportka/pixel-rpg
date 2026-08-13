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
import {
  regionAt, regionLandmarks, REGION, RIVER_COL, RIVER_W, riverNear, bridgeYNear, isWater,
} from './terrain.js';
import { SCREEN_W, SCREEN_H } from './screen.js';
import {
  SPAWN as MANSION_SPAWN, mansionCollides, onDoor, nearStairs, nearPortrait, nearClock,
  nearTelevision,
} from './mansion.js';
import { mulberry32, hashCoords } from './rng.js';
import { PERSON, DOG, makeCharacter, moveCharacter, updateFollower, feetBox } from './entities.js';

export const CAPTION_TTL = 3.2; // seconds a caption stays up
export const FETCH_TIMEOUT = 25; // seconds before a hopeless fetch resets
export const MEET_RADIUS = 45; // px at which the person finds the dog
export const HINT_PERIOD = 12; // seconds between whimper hints while alone
export const HEAVEN_SEED_SALT = 0x48454156; // 'HEAV' — heaven's world derives from it
export const BASK_HEAL = 1; // HP an angel's light pools in you
export const AMBIENT_PERIOD = 26; // seconds between ambient lines when together
export const TAP_ARRIVE = 5; // px at which a tap-move target counts as reached
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
export const START_STAT = 2; // everyone starts small; levels grow you
export const XP_PER_LEVEL = 10; // flat: every level costs 10 XP
export const LEVEL_POINTS = 2; // +1s to hand out per level, together or apart
export const XP_DOG = 4; // finding the friendly lost dog
export const XP_ZOMBIE = 1; // per zombie put back down

// Magic (v0.16). The half-burnt leaf never hurt anyone — it teaches. Each
// vision hands over the next spell in the book; casting spends focus, which
// comes back slowly under the open sky.
export const SPELLS = [
  {
    id: 'ember',
    name: 'EMBER',
    cost: 1,
    blurb: 'A ROSE-GOLD FLAME. 3 DAMAGE',
  },
  {
    id: 'ward',
    name: 'WARD',
    cost: 1,
    blurb: 'THE NEXT BITE FINDS NOTHING',
  },
  {
    id: 'moonlight',
    name: 'MOONLIGHT',
    cost: 2,
    blurb: 'DRINK THE MOON. +3 HP',
  },
];
export const FOCUS_BASE = 3; // focus = 3 + WIS modifier
export const FOCUS_REGEN = 20; // seconds per point of focus recovered

// Turn-based combat (v0.16). Hostiles close by pull the world out of free
// movement: you get a step budget and one action per turn, then they answer.
export const BATTLE_RADIUS = 120; // px at which a hostile engages you
export const BATTLE_LEAVE = 200; // px you must put between you to disengage
export const BATTLE_MOVE = 60; // px of movement per turn

// The remembered map (docs/RULES.md has none of this; memory keeps its own
// rules). Regions near the person refresh; the rest fade over minutes.
export const MEM_FRESH = 90; // s a memory stays sharp (landmarks and all)
export const MEM_FADED = 300; // s until only the barest outline remains
const ENCOUNTER_RADIUS = 39; // px at which an encounter opens its menu
const ENCOUNTER_REARM = 66; // walk this far away before it can re-open

const DOG_SPAWN_MIN = 360; // px from the person the lost dog waits
const DOG_SPAWN_MAX = 480; // (outside the 416x360 opening view, whimper range)

const BALL_THROW_SPEED = 195; // px/s
const BALL_DRAG = 210; // px/s^2
const PICKUP_RADIUS = 11;
const DELIVER_RADIUS = 18;
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

    // Ability scores: everyone begins the universe at 2 across the board.
    // Levels (XP_PER_LEVEL apart) hand out LEVEL_POINTS +1s each to grow.
    this.stats = {};
    for (const a of ABILITIES) this.stats[a] = START_STAT;
    this.level = 1;
    this.xp = 0;
    this.statPoints = 0; // unspent level-up +1s (the level menu collects them)

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

    // The two planes (v0.17). 'night' is the world below; 'heaven' waits
    // behind the mansion television's glass. Each plane keeps its own world,
    // memory, and encounter state; the one not being lived in sits stashed.
    this.plane = 'night';
    this.planeStash = null; // the other plane's snapshot (null until first ascent)
    this.goldGiven = 0; // courses added to the pile of god (heaven-wide)
    this.styxSeen = false; // the river announces itself once per ascent

    // Magic and battle (v0.16).
    this.spells = []; // spell ids learned, in the order the leaf taught them
    this.focus = this.maxFocus();
    this.focusTimer = 0;
    this.warded = false; // WARD eats the next bite
    this.mode = 'free'; // 'free' | 'turn' — the world's two gears
    this.turn = 'you'; // whose move, while turn-based
    this.moveLeft = 0; // px of movement left in your turn
    this.battleFoes = []; // hostile keys currently engaged
    this.round = 0;
    this.battleCheck = 0;

    // Where the pair are: the open world, or inside a mansion.
    this.location = 'world';
    this.mansionKey = null; // which mansion, while inside
    this.mansionReturn = null; // world position to restore on the way out
    this.clockTick = 0; // the grandfather clock's patience

    this._prevUp = false;
    this._prevDown = false;
    this._prevLeft = false;
    this._prevRight = false;
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
      // Visible at start? (Opening camera sits at (0, -6); pad for the sprite.)
      if (Math.abs(x) < SCREEN_W / 2 + 8 && y > -(SCREEN_H / 2 + 16) && y < SCREEN_H / 2 + 8) continue;
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

  /** The collision surface for wherever we are (world, or mansion walls). */
  phys() {
    return this.location === 'mansion' ? { collides: mansionCollides } : this.world;
  }

  /** Step through the front door. The world position waits outside. */
  enterMansion(m) {
    const key = `m:${m.x},${m.y}`;
    this.location = 'mansion';
    this.mansionKey = key;
    this.mansionReturn = { px: m.x, py: m.y + 10, dx: m.x - 17, dy: m.y + 15 };
    this.person.x = MANSION_SPAWN.x;
    this.person.y = MANSION_SPAWN.y;
    if (this.together) {
      this.dog.x = MANSION_SPAWN.x - 20;
      this.dog.y = MANSION_SPAWN.y + 3;
    }
    this.clearMoveTarget();
    this.ball = null;
    this.fetch = 'idle';
    // The interior runs its own loop and never reaches checkBattle, so a
    // fight you walked in on has to be let go at the threshold — otherwise
    // the mode frame and the step budget follow you inside for good.
    if (this.mode === 'turn') this.endBattle('THE DOOR SHUTS THE FIGHT OUTSIDE');
    this.emit('door');
    this.triggerGlitch(0.5);
    if (!this.encounterDone.has(`${key}:in`)) {
      this.encounterDone.add(`${key}:in`);
      this.announce(['THE DOOR WAS NOT LOCKED', 'IT SHUT ITSELF BEHIND YOU ANYWAY']);
    } else {
      this.announce(['THE MANSION AGAIN. IT REMEMBERS YOU']);
    }
  }

  /** Back out the front door into the night. */
  exitMansion() {
    this.location = 'world';
    const r = this.mansionReturn;
    // The lawn is not guaranteed clear (a tree can grow right up to the
    // steps) — probe outward from the doorstep for open ground so stepping
    // out can never wedge the pair inside something solid.
    const spot = this.findClearSpot(r.px, r.py, this.person);
    this.person.x = spot.x;
    this.person.y = spot.y;
    if (this.together) {
      const ds = this.findClearSpot(spot.x - 17, spot.y + 5, this.dog);
      this.dog.x = ds.x;
      this.dog.y = ds.y;
    }
    this.mansionKey = null;
    this.clearMoveTarget();
    this.emit('door');
    this.triggerGlitch(0.4);
    this.say('THE NIGHT AIR AGAIN');
  }

  /** The nearest collision-free stand for a character, spiraling outward. */
  findClearSpot(x, y, ch) {
    for (const [dx, dy] of [
      [0, 0], [0, 9], [12, 6], [-12, 6], [0, 18], [24, 12], [-24, 12],
      [0, 30], [36, 18], [-36, 18], [0, 45], [48, 24], [-48, 24],
    ]) {
      const b = feetBox(ch, x + dx, y + dy);
      if (!this.world.collides(b.x, b.y, b.w, b.h)) return { x: x + dx, y: y + dy };
    }
    return { x, y }; // give up gracefully; the detour steering can still wiggle out
  }

  /** Interior beats: the exit door, the portrait, the stairs, the clock. */
  /** Everything that belongs to one plane and must not leak into the other. */
  snapshotPlane() {
    return {
      world: this.world,
      memory: this.memory,
      encounterDone: this.encounterDone,
      zombieHp: this.zombieHp,
      choiceCooldown: this.choiceCooldown,
      px: this.person.x,
      py: this.person.y,
      dx: this.dog.x,
      dy: this.dog.y,
      together: this.together,
      location: this.location,
      mansionKey: this.mansionKey,
      mansionReturn: this.mansionReturn,
      ball: this.ball,
      fetch: this.fetch,
      styxSeen: this.styxSeen,
    };
  }

  restorePlane(snap) {
    this.world = snap.world;
    this.memory = snap.memory;
    this.encounterDone = snap.encounterDone;
    this.zombieHp = snap.zombieHp;
    this.choiceCooldown = snap.choiceCooldown;
    this.person.x = snap.px;
    this.person.y = snap.py;
    this.dog.x = snap.dx;
    this.dog.y = snap.dy;
    this.together = snap.together;
    this.location = snap.location;
    this.mansionKey = snap.mansionKey;
    this.mansionReturn = snap.mansionReturn;
    this.ball = snap.ball;
    this.fetch = snap.fetch;
    this.styxSeen = snap.styxSeen;
    this.clearMoveTarget();
  }

  /**
   * A fresh heaven, built on first ascent: its own world from a salted seed,
   * you alone on the west side of the Styx, and Cerberus — the shape your dog
   * takes up here — waiting on the east bank by the nearest bridge,
   * beckoning you back down.
   */
  freshHeaven() {
    const hseed = (this.world.seed ^ HEAVEN_SEED_SALT) >>> 0;
    const world = new World(hseed);
    const px = 0;
    const py = 30;
    // The nearest Styx east of home: its column center, and the bridge you
    // will cross it on. Cerberus sits past the far bank, level with the deck.
    const river = riverNear(hseed, RIVER_COL * REGION, py);
    const by = bridgeYNear(hseed, river.band, py);
    const spot = { x: river.center + RIVER_W + 36, y: by };
    return {
      world,
      memory: new Map(),
      encounterDone: new Set(),
      zombieHp: new Map(),
      choiceCooldown: null,
      px,
      py,
      dx: spot.x,
      dy: spot.y,
      together: false,
      location: 'world',
      mansionKey: null,
      mansionReturn: null,
      ball: null,
      fetch: 'idle',
      styxSeen: false,
    };
  }

  /** Step inside the television. (From heaven, any television leads back.) */
  enterHeaven() {
    if (this.plane === 'heaven') return this.returnFromHeaven();
    const night = this.snapshotPlane();
    this.restorePlane(this.planeStash ?? this.freshHeaven());
    this.planeStash = night;
    this.plane = 'heaven';
    if (this.mode === 'turn') this.endBattle('NOTHING UP HERE WANTS TO FIGHT YOU');
    this.emit('ascend');
    this.triggerGlitch(0.9);
    this.announce([
      'THE GLASS IS NOT GLASS. YOU STEP THROUGH',
      'EVERYTHING UP HERE IS ROSE AND GOLD',
      'A THREE-THROATED HOWL ROLLS ACROSS THE LIGHT',
    ]);
    this.hintTimer = HINT_PERIOD - 3; // the first howl points the way soon
  }

  /** Cerberus carries you back down. Night resumes exactly where it paused. */
  returnFromHeaven() {
    if (this.plane !== 'heaven') return;
    const heaven = this.snapshotPlane();
    this.restorePlane(this.planeStash);
    this.planeStash = heaven;
    this.plane = 'night';
    // Standing back in front of the set: hold its menu until you walk away.
    if (this.location === 'mansion') {
      this.choiceCooldown = { key: `${this.mansionKey}:tv`, x: this.person.x, y: this.person.y };
    }
    this.emit('descend');
    this.triggerGlitch(0.9);
    this.announce([
      'CERBERUS CARRIES YOU DOWN, GENTLE AS A MOTHER',
      'THE NIGHT AGAIN. IT MISSED YOU',
    ]);
  }

  updateMansion(dt) {
    const p = this.person;
    if (this.active === 'person' && onDoor(p.x, p.y)) {
      this.exitMansion();
      return;
    }
    // Re-arm a closed menu once you actually walk away (the television is
    // the one mansion encounter that comes back).
    if (this.choiceCooldown) {
      const cd = this.choiceCooldown;
      if (Math.hypot(cd.x - p.x, cd.y - p.y) > ENCOUNTER_REARM) this.choiceCooldown = null;
    }
    const pk = `${this.mansionKey}:port`;
    if (!this.choice && !this.encounterDone.has(pk) && nearPortrait(p.x, p.y)) {
      // The menu owns the screen: retire any routine caption still up.
      if (!this.captionSticky) {
        this.caption = null;
        this.captionQueue.length = 0;
      }
      this.openChoice({
        kind: 'portrait',
        key: pk,
        x: p.x,
        y: p.y,
        title: 'AN OLD PORTRAIT',
        options: [
          { id: 'look', label: 'LOOK CLOSER' },
          { id: 'away', label: 'LOOK AWAY' },
        ],
      });
      return;
    }
    const tk = `${this.mansionKey}:tv`;
    if (!this.choice && this.choiceCooldown?.key !== tk && nearTelevision(p.x, p.y)) {
      if (!this.captionSticky) {
        this.caption = null;
        this.captionQueue.length = 0;
      }
      this.emit('tv');
      this.openChoice({
        kind: 'tv',
        key: tk,
        x: p.x,
        y: p.y,
        title: this.plane === 'heaven' ? 'THE TELEVISION SHOWS THE NIGHT BELOW' : 'AN OLD TELEVISION, WARM WITH ROSE LIGHT',
        options: [
          { id: 'inside', label: 'STEP INSIDE' },
          { id: 'channel', label: 'CHANGE THE CHANNEL' },
          { id: 'away', label: 'STEP AWAY' },
        ],
      });
      return;
    }
    const sk = `${this.mansionKey}:stairs`;
    if (!this.encounterDone.has(sk) && nearStairs(p.x, p.y)) {
      this.encounterDone.add(sk);
      // say(), not announce(): the portrait's payoff lines must survive
      // walking from one beat straight into the other.
      this.say('THE STAIRS ARE LOCKED');
      this.say('WHO LOCKS STAIRS?');
    }
    this.clockTick += dt;
    if (this.clockTick >= 2) {
      this.clockTick = 0;
      if (nearClock(p.x, p.y)) this.emit('clock');
    }
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
    const my = Math.min(this.person.y, this.dog.y) - 21;
    this.hearts.push({ x: mx - 6, y: my, t: HEART_TTL }, { x: mx + 6, y: my - 5, t: HEART_TTL * 1.2 });
    this.gainXp(XP_DOG); // finding a friend is most of the point
  }

  /** Person throws the pink ball in the direction they face. */
  throwBall() {
    if (this.location !== 'world') {
      this.say('NOT IN HERE');
      return;
    }
    if (!this.together || this.fetch !== 'idle') return;
    const p = this.person;
    let x = p.x + p.facing * 9;
    let y = p.y - 9;
    if (this.world.collides(x - 2, y - 2, 3, 3)) {
      x = p.x; // facing straight into a trunk — drop at their feet instead
      y = p.y - 2;
    }
    this.ball = {
      x,
      y,
      vx: p.facing * BALL_THROW_SPEED,
      vy: -15 + this.rng() * 30,
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
      if (this.drunk === 0) {
        this.say('THE WORLD SETTLES BACK DOWN');
        // Inebriation lends WIS, and WIS is the focus pool — sobering up
        // takes the borrowed points back rather than leaving you over full.
        this.focus = Math.min(this.focus, this.maxFocus());
      }
    }
    // Focus seeps back under the open sky, a point at a time.
    if (this.spells.length && this.focus < this.maxFocus()) {
      this.focusTimer += dt;
      if (this.focusTimer >= FOCUS_REGEN) {
        this.focusTimer = 0;
        this.focus++;
      }
    }
  }

  /** True while a world-pausing screen (inventory, detail, map, level) is up. */
  menuPaused() {
    return !!this.choice && ['sheet', 'detail', 'map', 'levelup', 'spell'].includes(this.choice.kind);
  }

  /** Earn experience; every XP_PER_LEVEL of it is a level and 2 stat points. */
  gainXp(n) {
    this.xp += n;
    this.say(`+${n} XP`);
    this.emit('xp');
    let leveled = false;
    while (this.xp >= XP_PER_LEVEL) {
      this.xp -= XP_PER_LEVEL;
      this.level++;
      this.statPoints += LEVEL_POINTS;
      leveled = true;
    }
    if (leveled) {
      this.emit('levelup');
      this.triggerGlitch(0.5);
      this.announce([`LEVEL ${this.level}!`, `CHOOSE ${this.statPoints} STAT POINTS`]);
      if (!this.choice) this.openLevelUp();
    }
  }

  /** The level-up menu: spend +1s one at a time (same stat twice is fine). */
  openLevelUp() {
    this.openChoice({
      kind: 'levelup',
      key: 'levelup',
      x: this.person.x,
      y: this.person.y,
      title: `PICK +1 (${this.statPoints} LEFT)`,
      options: ABILITIES.map((a) => ({
        id: a,
        label: `${a.toUpperCase()} ${this.stats[a]} > ${this.stats[a] + 1}`,
      })),
    });
  }

  update(dt, input = {}) {
    // A choice menu freezes the walk: up/down (or left/right, for the icon
    // grid) select, action confirms. Pause screens go further and stop the
    // world outright — no time, no timers, no drunk countdown while you read.
    if (this.choice) {
      const paused = this.menuPaused();
      if (!paused) this.time += dt;
      const n = this.choice.options.length;
      if ((input.up && !this._prevUp) || (input.left && !this._prevLeft)) {
        this.choiceIndex = (this.choiceIndex + n - 1) % n;
        this.emit('menu-move');
      }
      if ((input.down && !this._prevDown) || (input.right && !this._prevRight)) {
        this.choiceIndex = (this.choiceIndex + 1) % n;
        this.emit('menu-move');
      }
      if (input.action && !this._prevAction) this.resolveChoice(this.choice.options[this.choiceIndex].id);
      this._prevUp = !!input.up;
      this._prevDown = !!input.down;
      this._prevLeft = !!input.left;
      this._prevRight = !!input.right;
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
    if (input.action && !this._prevAction && this.active === 'person') {
      if (this.mode === 'turn') this.openBattleMenu();
      else this.throwBall();
    }
    this._prevAction = !!input.action;
    if (input.sheet && !this._prevSheet) this.openSheet();
    this._prevSheet = !!input.sheet;
    if (input.map && !this._prevMap) this.openMap();
    this._prevMap = !!input.map;
    this._prevUp = !!input.up;
    this._prevDown = !!input.down;
    this._prevLeft = !!input.left;
    this._prevRight = !!input.right;
    if (this.choice) return; // a pause screen opened this very tick — freeze now

    // While turn-based you move on a budget, and only on your own turn.
    let dirXLock = false;
    const budgeted = this.mode === 'turn' && this.active === 'person';
    if (budgeted && (this.turn !== 'you' || this.moveLeft <= 0)) {
      dirXLock = true;
    }
    // Snapshot positions so footsteps can be paced by distance walked.
    const prevPX = this.person.x;
    const prevPY = this.person.y;
    const prevDX = this.dog.x;
    const prevDY = this.dog.y;

    // Player-controlled character: keys win over a tap target.
    const dirX = dirXLock ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dirY = dirXLock ? 0 : (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dirXLock) this.clearMoveTarget();
    if (dirX !== 0 || dirY !== 0) {
      this.clearMoveTarget();
      moveCharacter(this.activeChar, dirX, dirY, dt, this.phys());
    } else if (this.moveTarget) {
      this.updateTapMove(dt);
    } else {
      moveCharacter(this.activeChar, 0, 0, dt, this.phys());
    }

    if (this.together) {
      // The other one follows — unless the dog is mid-fetch, which takes priority.
      const dogBusy = this.fetch !== 'idle' && this.active === 'person';
      if (!dogBusy) {
        updateFollower(this.otherChar, this.activeChar, dt, this.phys());
      }
      if (this.location === 'world') {
        this.updateBall(dt);
        this.updateFetchAI(dt);
        this.updateAmbient(dt);
      }
    } else if (this.location === 'world') {
      this.updateAlone(dt);
    }

    // Soft footsteps, paced by distance actually covered this tick.
    const walkedPerson = Math.hypot(this.person.x - prevPX, this.person.y - prevPY);
    if (budgeted && this.turn === 'you' && walkedPerson > 0) {
      this.moveLeft = Math.max(0, this.moveLeft - walkedPerson);
      if (this.moveLeft === 0 && !this.choice) this.openBattleMenu();
    }
    this.stepAcc.person += walkedPerson;
    this.stepAcc.dog += Math.hypot(this.dog.x - prevDX, this.dog.y - prevDY);
    if (this.stepAcc.person >= 14) {
      this.stepAcc.person = 0;
      this.emit('step-person');
    }
    if (this.stepAcc.dog >= 11) {
      this.stepAcc.dog = 0;
      this.emit('step-dog');
    }

    this.tickTimers(dt);

    // Inside the mansion, the interior runs its own small world.
    if (this.location === 'mansion') {
      this.updateMansion(dt);
      return;
    }

    // The mansion door: step into the doorway and you're inside.
    if (this.active === 'person') {
      const p = this.person;
      for (const m of this.world.mansionsInRect(p.x - 60, p.y - 60, 120, 120)) {
        if (Math.abs(p.x - m.x) < 8 && p.y > m.y - 6 && p.y < m.y + 5) {
          this.enterMansion(m);
          return;
        }
      }
    }

    // The world's gear: hostiles nearby drop it into turn-based.
    this.battleCheck += dt;
    if (this.battleCheck >= 0.3) {
      this.battleCheck = 0;
      this.checkBattle();
    }

    // Rare encounters open their menus when the person wanders close.
    this.encounterCheck += dt;
    if (this.encounterCheck >= 0.3) {
      this.encounterCheck = 0;
      if (this.plane === 'heaven' && !this.styxSeen) {
        const px = this.person.x;
        const py = this.person.y;
        const hs = this.world.seed;
        if (
          isWater(hs, px + 60, py) || isWater(hs, px - 60, py) ||
          isWater(hs, px, py + 60) || isWater(hs, px, py - 60)
        ) {
          this.styxSeen = true;
          this.announce(['THE RIVER STYX, SILVER AND PATIENT', 'CERBERUS WAITS ON THE FAR BANK']);
        }
      }
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
    if (this.choice) return; // never clobber an open menu (e.g. a level-up)
    if (this.location !== 'world') return; // the mansion has its own manners
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
      // In heaven the dumpster spots hold cathedrals instead: same rng draws,
      // very different landlord.
      this.plane === 'heaven'
        ? {
            method: 'dumpstersInRect',
            prefix: 'd',
            kind: 'cathedral',
            title: 'A CATHEDRAL OF MELTED GOLD',
            options: [
              { id: 'listen', label: 'LISTEN TO THE RAGAS' },
              { id: 'gold', label: 'ADD TO THE PILE OF GOD' },
              { id: 'walkaway', label: 'STEP BACK INTO THE LIGHT' },
            ],
          }
        : {
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
    // While turn-based, the round structure owns them instead. In heaven the
    // same spots hold angels, and the angels hold no grudges.
    if (this.mode === 'turn') return;
    for (const z of near('zombiesInRect')) {
      const key = `z:${z.x},${z.y}`;
      if (blocked(key)) continue;
      if (this.plane === 'heaven') {
        this.emit('blessing');
        this.openChoice({
          kind: 'angel',
          key,
          x: z.x,
          y: z.y,
          title: 'AN ANGEL CONSIDERS YOU',
          options: [
            { id: 'befriend', label: 'TRY TO BEFRIEND IT' },
            { id: 'bask', label: 'BASK IN ITS LIGHT' },
            { id: 'ask', label: 'ASK THE WAY HOME' },
            { id: 'walkaway', label: 'LEAVE IT BE' },
          ],
        });
        return;
      }
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
    // Only world encounters claim the (single) re-arm cooldown slot; closing
    // a pause screen — or the mansion's portrait — must not wipe the
    // cooldown of an encounter you fled outside.
    if (!['sheet', 'detail', 'map', 'levelup', 'portrait', 'spell', 'battle'].includes(c.kind)) {
      this.choiceCooldown = { key: c.key, x: c.x, y: c.y };
    }
    this.emit('menu-confirm');

    if (c.kind === 'dumpster') {
      if (id === 'search') {
        this.encounterDone.add(c.key);
        const r = this.check('int');
        if (r.total >= DC_SEARCH) {
          this.hasBone = true;
          this.boneMeat = true;
          this.emit('heal');
          this.hearts.push({ x: c.x, y: c.y - 24, t: 1.6 });
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
      if (id === 'spells') this.openSpellMenu();
      else if (id !== 'close') this.openIconDetail(id);
    } else if (c.kind === 'detail') {
      if (id === 'back') this.openSheet();
      else if (id === 'eat') this.eatBoneMeat();
      else if (id === 'punch') this.attackFromSheet('fists');
      else if (id === 'swing') this.attackFromSheet('bone');
      else if (id === 'throw') this.throwBall();
    } else if (c.kind === 'levelup') {
      if (ABILITIES.includes(id) && this.statPoints > 0) {
        this.stats[id]++;
        this.statPoints--;
        this.emit('heal');
        if (this.statPoints > 0) this.openLevelUp();
        else this.announce(['YOU FEEL SHARPER']);
      }
    } else if (c.kind === 'map') {
      // close: the world resumes.
    } else if (c.kind === 'portrait') {
      this.encounterDone.add(c.key); // it only needs to be seen once
      if (id === 'look') this.announce(['IT IS NO ONE YOU KNOW', 'IT KNOWS YOU, THOUGH']);
      else this.announce(['THE EYES FOLLOW YOU ANYWAY']);
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
        this.hearts.push({ x: c.x, y: c.y - 21, t: 1.6 });
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
          // The leaf is not a drug, it is a teacher. The vision hands you a
          // spell — and the colors stay leaned in for ten minutes.
          this.drunk = DRUNK_TIME;
          this.emit('vision');
          this.emit('drunk');
          this.triggerGlitch(1.2); // the long one
          this.announce([
            `${this.rollText(r)} - THE STARS LEAN CLOSER`,
            'A VISION: THE INFLATABLES DANCE AT THE CENTER OF ALL THINGS',
            'THE COLORS LEAN CLOSER TOO (DRUNK 10:00)',
          ]);
          this.learnSpell();
        } else if (r.total <= DC_COUGH) {
          // No damage: the smoke is never the thing that hurts you. It just
          // doesn't take, and the woods stay quiet.
          this.announce([
            `${this.rollText(r)} - THE SMOKE GOES NOWHERE`,
            'NO VISION. THE PIPE IS SPENT',
          ]);
        } else {
          this.announce([`${this.rollText(r)} - NOTHING. PROBABLY OAK LEAF`, 'THE PIPE IS SPENT']);
        }
      } else if (id === 'sniff') {
        this.announce(['IT SMELLS LIKE REGRET AND LAWN CLIPPINGS']);
      }
      // walkaway: it keeps smoldering.
    } else if (c.kind === 'battle') {
      if (id === 'wait') {
        this.say('YOU HOLD YOUR GROUND');
        this.endPlayerTurn();
      } else if (id === 'befriend') {
        this.announce(['THE ZOMBIE DOES NOT WANT FRIENDS']);
        this.endPlayerTurn();
      } else if (id === 'cast') {
        this.openSpellMenu();
      } else {
        const foe = this.nearestFoe();
        if (!foe) this.endPlayerTurn();
        else this.resolveZombie({ kind: 'zombie', key: `z:${foe.x},${foe.y}`, x: foe.x, y: foe.y }, id);
      }
    } else if (c.kind === 'spell') {
      if (id !== 'back') this.castSpell(id);
      else if (this.mode === 'turn') this.openBattleMenu();
      else this.openSheet();
    } else if (c.kind === 'tv') {
      if (id === 'inside') {
        this.enterHeaven(); // (from heaven, the set shows the night — and leads there)
      } else if (id === 'channel') {
        this.emit('tv');
        this.announce(['EVERY CHANNEL IS THE SAME WARM LIGHT', 'ONE OF THEM HUMS A LITTLE HIGHER']);
      }
      // 'away': the cooldown covers your retreat.
    } else if (c.kind === 'cathedral') {
      if (id === 'listen') {
        this.emit('raga');
        this.triggerGlitch(0.6);
        const lines = [
          'THE RAGAS DO NOT END. THEY HAND EACH OTHER THE MELODY',
          'THE SINGERS NOD. YOU WERE ALWAYS PART OF THE CHORD',
        ];
        if (this.spells.length && this.focus < this.maxFocus()) {
          this.focus = this.maxFocus();
          lines.push('YOUR FOCUS RETURNS, ALL OF IT');
        }
        this.announce(lines);
      } else if (id === 'gold') {
        this.emit('gold');
        this.goldGiven++;
        this.announce([
          'YOU ADD WHAT YOU CAN TO THE PILE OF GOD',
          'THEY MELT IT IN. THE SPIRE CLIMBS ONE COURSE HIGHER',
        ]);
      }
      // walkaway: the music follows you out anyway.
    } else if (c.kind === 'angel') {
      if (id === 'befriend') {
        this.emit('meet');
        this.hearts.push(
          { x: c.x - 6, y: c.y - 30, t: HEART_TTL },
          { x: c.x + 6, y: c.y - 36, t: HEART_TTL * 1.2 },
        );
        this.announce(['IT WAS NEVER GOING TO BITE YOU', 'UP HERE, FRIENDSHIP IS THE RESTING STATE']);
      } else if (id === 'bask') {
        this.emit('blessing');
        this.heal(BASK_HEAL);
        this.announce([`LIGHT POOLS IN YOUR CHEST (+${BASK_HEAL} HP)`]);
      } else if (id === 'ask') {
        this.announce([
          'ONE LONG SLEEVE POINTS TOWARD THE STYX',
          'CERBERUS WILL CARRY YOU. HOME IS BELOW',
        ]);
      }
      // walkaway: it was going to let you anyway.
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
   * Pauses the world. Icon-based: six stat icons plus whatever you carry;
   * picking one opens its little detail window (openIconDetail).
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
        ...ABILITIES.map((a) => ({ id: a, label: a.toUpperCase(), icon: a })),
        ...(this.spells.length ? [{ id: 'spells', label: 'SPELLS', icon: 'spells' }] : []),
        ...(this.hasBone ? [{ id: 'bone', label: 'BONE', icon: 'bone' }] : []),
        ...(this.boneMeat ? [{ id: 'meat', label: 'MEAT', icon: 'meat' }] : []),
        ...(person && this.together && this.fetch === 'idle'
          ? [{ id: 'ball', label: 'BALL', icon: 'ball' }]
          : []),
        { id: 'close', label: 'CLOSE' },
      ],
    });
  }

  /**
   * A little window explaining an icon — the stat's score, modifier, and
   * what answers to it, or an item's numbers — plus its actions.
   */
  openIconDetail(id) {
    const person = this.active === 'person';
    const fmt = (m) => (m >= 0 ? `+${m}` : `${m}`);
    const statBody = (a) => [
      `SCORE ${this.stats[a]}  MOD ${fmt(this.mod(a))}`,
      `CHECKS ROLL D20${fmt(this.mod(a))}`,
    ];
    const DETAILS = {
      str: {
        title: 'STRENGTH',
        body: [...statBody('str'), `FISTS DEAL ${this.fistDamage()} DMG`, `THE BONE DEALS ${this.boneDamage()}`],
        options: person ? [{ id: 'punch', label: 'PUNCH SOMETHING' }] : [],
      },
      int: {
        title: 'INTELLIGENCE',
        body: [...statBody('int'), 'SEARCHING DUMPSTERS IS DC 10', 'ZOMBIES FIND IT DELICIOUS'],
        options: [],
      },
      wis: {
        title: 'WISDOM',
        body: [
          ...statBody('wis'),
          'THE PIPE ANSWERS TO IT (DC 15)',
          ...(this.drunk > 0 ? ['+2 WHILE THE COLORS LEAN IN'] : []),
        ],
        options: [],
      },
      dex: {
        title: 'DEXTERITY',
        body: [...statBody('dex'), 'NOTHING ASKS FOR IT YET', 'IT WAITS'],
        options: [],
      },
      con: {
        title: 'CONSTITUTION',
        body: [...statBody('con'), 'CARRY: STR X 10 + CON X 20', `= ${this.carryCapacity()} LBS`],
        options: [],
      },
      cha: {
        title: 'CHARISMA',
        body: [...statBody('cha'), 'GENIES ANSWER TO CHARM (DC 12)'],
        options: [],
      },
      bone: {
        title: 'THE BONE',
        body: [`A GOOD CLUB: DC 9, ${this.boneDamage()} DMG`, `WEIGHS ${BONE_WEIGHT} LBS`],
        options: person ? [{ id: 'swing', label: 'SWING THE BONE' }] : [],
      },
      meat: {
        title: 'MEAT ON THE BONE',
        body: ['GNAW FOR +2 HP. ONE SERVING', `WEIGHS ${MEAT_WEIGHT} LBS`],
        options: [{ id: 'eat', label: 'GNAW OFF THE MEAT (+2 HP)' }],
      },
      ball: {
        title: 'THE PINK BALL',
        body: ['FETCH MENDS THE HEART (+1 HP)'],
        options: [{ id: 'throw', label: 'THROW THE BALL' }],
      },
    };
    const d = DETAILS[id];
    if (!d) return;
    this.openChoice({
      kind: 'detail',
      key: `detail:${id}`,
      x: this.person.x,
      y: this.person.y,
      title: d.title,
      body: d.body,
      options: [...d.options, { id: 'back', label: 'BACK' }],
    });
  }

  /** Swing from the inventory at whatever undead thing is in reach. */
  attackFromSheet(id) {
    const p = this.person;
    // Indoors, interior coordinates would alias world chunks near the origin
    // — and the mansion keeps no zombies anyway. You swing at the dark.
    const zombies = this.location !== 'world' ? [] : this.world.zombiesInRect(
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

  // --- Magic ---------------------------------------------------------------

  /** Focus pool: 3 + WIS modifier, never below 1. */
  maxFocus() {
    return Math.max(1, FOCUS_BASE + this.mod('wis'));
  }

  /** A vision teaches the next spell in the book (if any are left). */
  learnSpell() {
    const next = SPELLS.find((s) => !this.spells.includes(s.id));
    if (!next) {
      this.say('THE LEAF HAS NOTHING LEFT TO TEACH');
      return;
    }
    this.spells.push(next.id);
    this.focus = this.maxFocus();
    this.emit('spell-learn');
    this.say(`YOU LEARN ${next.name}: ${next.blurb}`);
  }

  /** The spell menu — from the sheet, or as a battle action. */
  openSpellMenu() {
    if (this.spells.length === 0) {
      this.say('YOU KNOW NO SPELLS. THE LEAF KNOWS SOME');
      return;
    }
    this.openChoice({
      kind: 'spell',
      key: 'spell',
      x: this.person.x,
      y: this.person.y,
      title: `FOCUS ${this.focus} OF ${this.maxFocus()}`,
      body: SPELLS.filter((s) => this.spells.includes(s.id)).map((s) => `${s.name}: ${s.blurb}`),
      options: [
        ...SPELLS.filter((s) => this.spells.includes(s.id)).map((s) => ({
          id: s.id,
          label: `${s.name} (${s.cost})`,
        })),
        { id: 'back', label: 'BACK' },
      ],
    });
  }

  /** Cast a known spell, if focus allows. Costs your turn in battle. */
  castSpell(id) {
    const spell = SPELLS.find((s) => s.id === id);
    if (!spell || !this.spells.includes(id)) return;
    if (this.focus < spell.cost) {
      this.emit('spell-fail');
      this.announce(['NOT ENOUGH FOCUS. THE WORDS SCATTER']);
      if (this.mode === 'turn') this.endPlayerTurn();
      return;
    }
    this.focus -= spell.cost;
    this.triggerGlitch(0.35);
    if (id === 'ember') {
      this.emit('spell-cast');
      const target = this.nearestFoe();
      if (!target) {
        this.announce(['EMBER BLOOMS AND FINDS NOTHING TO BURN']);
      } else {
        const key = `z:${target.x},${target.y}`;
        const left = (this.zombieHp.get(key) ?? ZOMBIE_HP) - 3;
        if (left <= 0) {
          this.encounterDone.add(key);
          this.zombieHp.delete(key);
          this.emit('vanish');
          this.announce(['EMBER TAKES IT. THE ZOMBIE GOES OUT LIKE A CANDLE']);
          this.gainXp(XP_ZOMBIE);
        } else {
          this.zombieHp.set(key, left);
          this.announce(['EMBER BITES. THE ZOMBIE BURNS AND KEEPS COMING']);
        }
      }
    } else if (id === 'ward') {
      this.warded = true;
      this.emit('ward');
      this.announce(['A WARD SETTLES OVER YOU, THIN AS FROST']);
    } else if (id === 'moonlight') {
      this.emit('heal');
      this.heal(3);
      this.hearts.push({ x: this.person.x, y: this.person.y - 30, t: 1.6 });
      this.announce(['YOU DRINK THE MOON (+3 HP)']);
    }
    if (this.mode === 'turn') this.endPlayerTurn();
  }

  // --- Turn-based combat ---------------------------------------------------

  /** Hostiles (living zombies) within a radius of the person. */
  hostilesNear(radius) {
    if (this.location !== 'world') return [];
    if (this.plane === 'heaven') return []; // angels do not bite
    const p = this.person;
    return this.world
      .zombiesInRect(p.x - radius, p.y - radius, radius * 2, radius * 2)
      .filter((z) => !this.encounterDone.has(`z:${z.x},${z.y}`))
      .filter((z) => Math.hypot(z.x - p.x, z.y - p.y) <= radius);
  }

  /** The closest living hostile, or null. */
  nearestFoe() {
    const p = this.person;
    const near = this.hostilesNear(BATTLE_LEAVE);
    let best = null;
    for (const z of near) {
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      if (!best || d < best.d) best = { ...z, d };
    }
    return best;
  }

  /**
   * The world has two gears. Something hostile close by drops it into
   * turn-based; putting distance between you lets it go again.
   */
  checkBattle() {
    if (this.location !== 'world') {
      if (this.mode === 'turn') this.endBattle();
      return;
    }
    if (this.mode === 'free') {
      const foes = this.hostilesNear(BATTLE_RADIUS);
      if (foes.length) this.startBattle(foes);
    } else if (this.hostilesNear(BATTLE_LEAVE).length === 0) {
      this.endBattle();
    }
  }

  startBattle(foes) {
    this.mode = 'turn';
    this.turn = 'you';
    this.round = 1;
    this.moveLeft = BATTLE_MOVE;
    this.battleFoes = foes.map((z) => `z:${z.x},${z.y}`);
    this.clearMoveTarget();
    this.emit('battle-start');
    this.triggerGlitch(0.5);
    this.announce(['SOMETHING IS CLOSE', 'TURN-BASED: ONE MOVE, ONE ACTION']);
  }

  endBattle(line = 'THE WOODS LET GO. YOU MOVE FREELY AGAIN') {
    this.mode = 'free';
    this.turn = 'you';
    this.battleFoes = [];
    this.warded = false;
    this.emit('battle-end');
    this.say(line);
  }

  /** The battle action menu — your one action for the turn. */
  openBattleMenu() {
    const foe = this.nearestFoe();
    const inReach = foe && foe.d <= ENCOUNTER_RADIUS;
    this.openChoice({
      kind: 'battle',
      key: 'battle',
      x: this.person.x,
      y: this.person.y,
      title: inReach ? 'A ZOMBIE IS ON YOU' : 'IT SHAMBLES CLOSER',
      options: [
        // The first round still lets you try the friendly thing.
        ...(this.round <= 1 ? [{ id: 'befriend', label: 'TRY TO BEFRIEND IT' }] : []),
        ...(inReach ? [{ id: 'fists', label: 'ATTACK WITH FISTS' }] : []),
        ...(inReach && this.hasBone ? [{ id: 'bone', label: 'SWING THE BONE' }] : []),
        ...(this.spells.length ? [{ id: 'cast', label: 'CAST A SPELL' }] : []),
        { id: 'wait', label: 'HOLD YOUR GROUND' },
      ],
    });
  }

  /** Your action is spent — the hostiles answer, then it's your move again. */
  endPlayerTurn() {
    if (this.mode !== 'turn') return;
    this.turn = 'foes';
    const p = this.person;
    for (const z of this.hostilesNear(ENCOUNTER_RADIUS)) {
      if (this.warded) {
        this.warded = false;
        this.emit('ward');
        this.say('THE WARD TAKES THE BITE FOR YOU');
        continue;
      }
      this.emit('zombie');
      const lethal = this.hp <= ZOMBIE_BITE;
      this.damage(ZOMBIE_BITE);
      if (lethal) {
        this.stats.int = Math.max(1, this.stats.int - 1);
        this.announce([
          'IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)',
          this.together ? 'THE DOG DRAGS YOU AWAY' : 'YOU WAKE ALONE, AND LIGHTER',
        ]);
      } else {
        this.say(`IT BITES (-${ZOMBIE_BITE} HP)`);
      }
      break; // one bite per round; the woods are not that cruel
    }
    void p;
    this.turn = 'you';
    this.round++;
    this.moveLeft = BATTLE_MOVE;
    this.emit('turn');
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
        if (this.mode === 'turn') this.endPlayerTurn();
        else this.openChoice(this.zombieMenu(c.key, c.x, c.y));
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
        this.gainXp(XP_ZOMBIE);
        if (this.mode === 'turn') this.endPlayerTurn();
      } else {
        this.zombieHp.set(c.key, left);
        this.announce([`${this.rollText(r)} - ${weapon ? 'BONK! IT STAGGERS' : 'YOU LAND ONE. IT STAGGERS'}`]);
        if (this.mode === 'turn') this.endPlayerTurn();
        else this.openChoice(this.zombieMenu(c.key, c.x, c.y));
      }
    } else {
      this.announce([`${this.rollText(r)} - YOU MISS`]);
      if (this.mode === 'turn') this.endPlayerTurn();
      else this.zombieBites(c);
    }
  }

  /** The zombie's answer to everything. Too weak, and it samples your brain. */
  zombieBites(c) {
    this.emit('zombie');
    const lethal = this.hp <= ZOMBIE_BITE;
    this.damage(ZOMBIE_BITE);
    if (lethal) {
      // Brains, partially eaten. The fight ends; the cooldown lets you crawl
      // off — stamped on the ZOMBIE explicitly, since a sheet-launched attack
      // otherwise leaves the slot on the detail window and the fight would
      // force-reopen over your unconscious body.
      this.choiceCooldown = { key: c.key, x: c.x, y: c.y };
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

  /**
   * Alone in the dark: the lost dog waits; soft whimpers point the way.
   * Alone in heaven: Cerberus waits across the Styx, and his three-throated
   * howl points the way back down.
   */
  updateAlone(dt) {
    const dx = this.dog.x - this.person.x;
    const dy = this.dog.y - this.person.y;
    if (Math.hypot(dx, dy) <= MEET_RADIUS) {
      if (this.plane === 'heaven') this.returnFromHeaven();
      else this.meetDog();
      return;
    }
    this.hintTimer += dt;
    if (this.hintTimer >= HINT_PERIOD && !this.caption && this.captionQueue.length === 0) {
      this.hintTimer = 0;
      const compass = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'EAST' : 'WEST') : dy > 0 ? 'SOUTH' : 'NORTH';
      this.say(
        this.plane === 'heaven'
          ? `A THREE-THROATED HOWL ROLLS FROM THE ${compass}`
          : `A SOFT WHIMPER DRIFTS FROM THE ${compass}`,
      );
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
      moveCharacter(ch, (-dy / len) * nav.side, (dx / len) * nav.side, dt, this.phys());
      return;
    }
    const before = Math.hypot(tx - ch.x, ty - ch.y);
    moveCharacter(ch, tx - ch.x, ty - ch.y, dt, this.phys());
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
      const b = feetBox(ch, ch.x + px * s * 12, ch.y + py * s * 12);
      return !this.phys().collides(b.x, b.y, b.w, b.h);
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
      if (Math.hypot(b.x - dog.x, b.y - (dog.y - 5)) <= PICKUP_RADIUS) {
        b.carried = true;
        this.fetch = 'returning';
        this.nav = { stuck: 0, detour: 0, side: 1 };
        this.emit('pickup');
        this.triggerGlitch(0.2);
      }
    } else if (this.fetch === 'returning') {
      b.x = dog.x + dog.facing * 9;
      b.y = dog.y - 6;
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
          y: Math.min(person.y, dog.y) - 21,
          t: HEART_TTL,
        });
      }
    }
  }
}
