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
  godSpot, lilypadsAt,
} from './terrain.js';
import { SCREEN_W, SCREEN_H } from './screen.js';
import {
  SPAWN as MANSION_SPAWN, mansionCollides, onDoor, nearStairs, nearClock,
  FURNISH as MANSION_FURNISH_LIST,
} from './mansion.js';
import {
  INTERIORS, interiorCollides, interiorOnDoor, interiorOnStairs,
} from './interiors.js';
import { mulberry32, hashCoords } from './rng.js';
import { PERSON, DOG, makeCharacter, moveCharacter, updateFollower, feetBox } from './entities.js';

export const CAPTION_TTL = 3.2; // seconds a caption stays up
export const FETCH_TIMEOUT = 25; // seconds before a hopeless fetch resets
export const MEET_RADIUS = 45; // px at which the person finds the dog
export const HINT_PERIOD = 12; // seconds between whimper hints while alone
export const HEAVEN_SEED_SALT = 0x48454156; // 'HEAV' — heaven's world derives from it
export const BASK_HEAL = 1; // HP an angel's light pools in you

// The foe table (v0.20): everything that answers on its turn. Ghosts pass
// through you and take a coin with them; the minotaur hits like a wall
// looking for a door.
export const FOES = {
  zombie: { hp: 4, dmg: 2, xp: 1, name: 'THE ZOMBIE' },
  ghost: { hp: 2, dmg: 1, xp: 1, steals: 1, name: 'THE GHOST' },
  minotaur: { hp: 8, dmg: 3, xp: 5, name: 'THE MINOTAUR' },
};
export const DC_DIRECTIONS = 13; // WIS: offering the minotaur a way onward
export const DC_AXE = 11; // STR: the axe splits the difference between fist and bone
export const DC_DIRT = 10; // DEX: dirt in the eyes buys one clean round
export const DC_CHOP = 8; // STR: trees are mostly willing; better rolls, more planks
export const MINOTAUR_RANGE = 90; // px of maze he paces around his den

// The economy (v0.20). Coins are the soul's pocket change — they ride
// through the television with you.
export const PRICES = {
  draught: 3, // +3 HP in a bottle
  axe: 8,
  rope: 2,
  manual: 12, // HOW TO BUILD A BOAT, ghost-press edition
  sword: 15, // Cortie's honest steel
  wand: 20, // Cortie's crooked little lightning rod
};
export const SELLS = { meat: 2, bone: 4, wood: 1 };
export const BOAT_WOOD = 24; // planks a boat wants
export const WEIGHT = { wood: 1, axe: 6, rope: 2, manual: 1, lamp: 3, pipe: 1 }; // lbs
export const SWIM_SPEED = 0.45; // of walking speed; heaven's water is warm
export const SAIL_SPEED = 1.25; // the boat knows the way
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
export const DC_FISTS = 10; // punching a zombie: STR (v0.21: hard, not hopeless)
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

// Magic (v0.21): spells come in LEVELS now, and casting spends SLOTS that
// only a REST gives back — a bed, a warm stove, the ragas, sitting with God.
// Your mind sets the slots: INT shapes level 1, WIS level 2, CHA level 3.
// The leaf still teaches the book in order; scrolls (Queebee's shelf) can be
// cast once for free, or inscribed forever with paper or the book.
export const SPELLS = [
  { id: 'ember', name: 'EMBER', level: 1, blurb: 'A ROSE-GOLD FLAME. 3 DAMAGE' },
  { id: 'ward', name: 'WARD', level: 1, blurb: 'THE NEXT BITE FINDS NOTHING' },
  { id: 'moonlight', name: 'MOONLIGHT', level: 2, blurb: 'DRINK THE MOON. +3 HP' },
  // Scroll-taught (v0.21): Queebee stocks these.
  { id: 'bolt', name: 'BOLT', level: 1, blurb: 'A VIOLET DART. 2 + INT DAMAGE', scroll: true },
  { id: 'mend', name: 'MEND', level: 1, blurb: 'SMALL STITCHES OF LIGHT. +2 HP', scroll: true },
  { id: 'shield', name: 'SHIELD', level: 2, blurb: 'A WARD THAT TAKES TWO BITES', scroll: true },
  { id: 'starfall', name: 'STARFALL', level: 3, blurb: 'THE SKY LEANS IN. 4 TO ALL IN REACH', scroll: true },
];
export const SLOT_LEVELS = [1, 2, 3];
export const SCROLL_PRICES = { bolt: 4, mend: 4, shield: 7, starfall: 12 };
export const PAPER_PRICE = 1;
export const BOOK_PRICE = 8;
export const DC_WAND = 10; // INT: the wand answers to an educated flick

// Turn-based combat (v0.16). Hostiles close by pull the world out of free
// movement: you get a step budget and one action per turn, then they answer.
export const BATTLE_RADIUS = 120; // px at which a hostile engages you
export const BATTLE_LEAVE = 200; // px you must put between you to disengage
export const BATTLE_MOVE = 60; // px of movement per turn

// The remembered map (docs/RULES.md has none of this; memory keeps its own
// rules). Regions near the person refresh; the rest fade over minutes.
export const MEM_FRESH = 90; // s a memory stays sharp (landmarks and all)
export const MEM_FADED = 300; // s until only the barest outline remains
const ENCOUNTER_RADIUS = 39; // px of battle reach (bites, swings)
const ENCOUNTER_REARM = 66; // walk this far before a self-opening menu re-arms
export const INTERACT_REACH = 48; // px within which a click opens its menu at once

// v0.21: zombies lock on. In free mode they shamble toward warm brains in
// range; in battle they close the gap on their turn.
export const ZOMBIE_LOCK = 150; // px at which a zombie notices you
export const ZOMBIE_SPEED = 36; // px/s of hungry shamble (you walk 69)
export const ZOMBIE_STEP = 26; // px it closes per battle round
export const ZOMBIE_LEASH = 140; // px from its post a zombie will wander

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

// The lamp's menu reopens after a polish, so it lives here once.
const LAMP_TITLE = 'AN OLD LAMP GLINTS IN THE LITTER';
const LAMP_OPTIONS = [
  { id: 'rub', label: 'RUB THE LAMP' },
  { id: 'polish', label: 'POLISH IT ON YOUR SLEEVE' },
  { id: 'ear', label: 'HOLD IT TO YOUR EAR' },
  { id: 'take', label: 'TAKE THE LAMP' },
  { id: 'walkaway', label: 'LEAVE IT BE' },
];

/**
 * Where a minotaur stands at a moment: a slow lissajous around his den —
 * the maze of this life has no exit, so he paces it forever. Pure, shared
 * with the renderer.
 */
export function minotaurPos(m, time) {
  const dx = Math.sin(time * 0.16 + m.phase) * MINOTAUR_RANGE;
  const dy = Math.sin(time * 0.23 + m.phase * 1.7) * MINOTAUR_RANGE * 0.7;
  return {
    x: m.x + dx,
    y: m.y + dy,
    facing: Math.cos(time * 0.16 + m.phase) >= 0 ? 1 : -1,
  };
}

/** Where a ghost drifts at a moment — a slow haunt around its post. */
export function ghostPos(g, time) {
  return {
    x: g.x + Math.sin(time * 0.5 + g.phase) * 26,
    y: g.y + Math.cos(time * 0.37 + g.phase) * 18,
  };
}

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
    this.pendingInteract = null; // clicked interactable being walked to
    this.hover = null; // interactable under the pointer (renderer glow)
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
    // Every key dismissed since you last walked clear. One slot alone
    // ping-pongs when two encounters overlap (Pirts beside a ghost, the
    // detective under his corkboard): closing B re-armed A each tick.
    this.cooldownKeys = new Set();
    this.encounterDone = new Set(); // encounter keys that resolved for good
    this.dumpstersOut = new Set(); // dumpsters whose fire was smothered
    this.foeOffsets = new Map(); // foe key -> {dx,dy} of chase drift from its post
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

    // The soul's pockets (v0.20) — coins, timber, and tools cross planes.
    this.coins = 0;
    this.wood = 0;
    this.hasAxe = false;
    this.hasRope = false;
    this.hasManual = false;
    this.hasBoat = false;
    this.hasLamp = false; // the genie lamp, pocketed (v0.21)
    this.hasPipe = false; // the half-burnt pipe, pocketed (v0.21)
    this.pipeSpent = false; // the carried pipe's one bowl, smoked
    this.swimming = false; // recomputed each step; true while feet are wet
    this.godMet = false; // you only meet God for the first time once
    this.islandBlessed = false; // the shrine's calm: +2 max focus, always
    this.tippedDetective = false; // he pays for a good tip exactly once
    this.polishedLamps = new Set(); // lamps polished: +1 on the next rub there
    this.dazed = false; // thrown dirt: the foes' next answer goes wide
    this.meatNibbled = false; // the +2 serving splits into two +1 nibbles
    this.boneNamed = false; // the bone's name stays between you two
    this.boatNamed = false; // so does hers

    // Magic and battle (v0.21: leveled slots, restored by resting).
    this.spells = []; // spell ids learned, in the order the leaf taught them
    this.slots = { 1: 0, 2: 0, 3: 0 };
    for (const lv of SLOT_LEVELS) this.slots[lv] = this.maxSlots(lv);
    this.breathed = false; // JUST BREATHE recovers one L1 slot, once per rest
    this.scrolls = {}; // spell id -> count of scrolls held
    this.paper = 0; // blank pages for inscribing
    this.hasBook = false; // the blank book: inscribe without spending paper
    this.hasSword = false; // Cortie's steel
    this.hasWand = false; // Cortie's lightning rod
    this.warded = false; // WARD eats the next bite
    this.shielded = false; // SHIELD eats the one after too
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
    // The spawn ring scales with the live view (v0.19): a big monitor sees
    // further, so the dog waits further out — "ALL ALONE IN THE WOODS" must
    // stay true on frame one at any window size.
    const ringMin = Math.max(DOG_SPAWN_MIN, SCREEN_W / 2 + 30, SCREEN_H / 2 + 40);
    const ringMax = ringMin + (DOG_SPAWN_MAX - DOG_SPAWN_MIN);
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = ringMin + this.rng() * (ringMax - ringMin);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      // Visible at start? (Opening camera sits at (0, -6); pad for the sprite.)
      if (Math.abs(x) < SCREEN_W / 2 + 8 && y > -(SCREEN_H / 2 + 16) && y < SCREEN_H / 2 + 8) continue;
      const b = feetBox({ feetW: DOG.feetW, feetH: DOG.feetH, x, y }, x, y);
      if (!this.world.collides(b.x, b.y, b.w, b.h)) return [x, y];
    }
    return [ringMax, 0]; // forests are sparse; this is effectively unreachable
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
    if (this.location !== 'world') {
      const kind = this.location;
      return { collides: (x, y, w, h) => interiorCollides(kind, x, y, w, h) };
    }
    if (this.plane === 'heaven') {
      // Heaven's water is warm and does not mind: swimmers pass through.
      return { collides: (x, y, w, h) => this.world.collides(x, y, w, h, { swim: true }) };
    }
    return this.world;
  }

  /** Coins in, with the little caption. */
  gainCoins(n) {
    if (n === 0) return;
    this.coins = Math.max(0, this.coins + n);
    this.emit('coin');
    if (n > 0) this.say(`+${n} COIN${n === 1 ? '' : 'S'}`);
  }

  /**
   * Step inside any roofed place (v0.20). kind names an INTERIORS entry;
   * back is where the world resumes when you leave. mansionKey/mansionReturn
   * kept their names from the mansion era but serve every interior now.
   */
  enterInterior(kind, key, back) {
    this.location = kind;
    this.mansionKey = key;
    this.mansionReturn = back;
    const spawn = INTERIORS[kind].spawn;
    this.person.x = spawn.x;
    this.person.y = spawn.y;
    if (this.together) {
      this.dog.x = spawn.x - 20;
      this.dog.y = spawn.y + 3;
    }
    this.clearMoveTarget();
    this.ball = null;
    this.fetch = 'idle';
    if (this.mode === 'turn') this.endBattle('THE DOOR SHUTS THE FIGHT OUTSIDE');
    this.emit('door');
    this.triggerGlitch(0.5);
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
    this.exitInterior();
  }

  /** Leave whatever roof you are under; the world resumes where it waited. */
  exitInterior() {
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
    // A world encounter dismissed just inside its ring (the cathedral's
    // gold, a dumpster by the cabin steps) must not pounce the moment you
    // step out: anchor the cooldown at the doorstep and pre-block whatever
    // encounter feature shares it.
    this.choiceCooldown = { key: 'door', x: spot.x, y: spot.y };
    for (const d of this.world.dumpstersInRect(
      spot.x - ENCOUNTER_RADIUS - 12,
      spot.y - ENCOUNTER_RADIUS - 12,
      (ENCOUNTER_RADIUS + 12) * 2,
      (ENCOUNTER_RADIUS + 12) * 2,
    )) {
      this.cooldownKeys.add(`d:${d.x},${d.y}`);
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
      foeOffsets: this.foeOffsets,
      choiceCooldown: this.choiceCooldown,
      cooldownKeys: this.cooldownKeys,
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
    this.foeOffsets = snap.foeOffsets ?? new Map();
    this.choiceCooldown = snap.choiceCooldown;
    this.cooldownKeys = snap.cooldownKeys ?? new Set();
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
    const world = new World(hseed, 'heaven'); // the heaven deck: island, signs, the minotaur
    const px = 0;
    const py = 30;
    // The nearest Styx east of home: its column center, and the bridge you
    // will cross it on. Cerberus sits past the far bank, level with the deck.
    const river = riverNear(hseed, RIVER_COL * REGION, py);
    const by = bridgeYNear(hseed, river.band, py);
    // The bank at the BRIDGE's latitude — the meander shifts between y=30
    // and the deck — probed eastward until the ground is actually dry:
    // Cerberus waits past the far bank, never in a lake.
    const bank = riverNear(hseed, RIVER_COL * REGION, by);
    let cbx = bank.center + RIVER_W + 36;
    for (let i = 0; i < 40 && isWater(hseed, cbx, by); i++) cbx += 24;
    const spot = { x: cbx, y: by };
    return {
      world,
      memory: new Map(),
      encounterDone: new Set(),
      zombieHp: new Map(),
      foeOffsets: new Map(),
      choiceCooldown: null,
      cooldownKeys: new Set(),
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
      'HAND-PAINTED SIGNS POINT THE WAY TO GOD',
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

  /** Interior tick: doors, stairs, spot menus — dispatched by kind. */
  updateInterior(dt) {
    if (this.location === 'mansion') return this.updateMansion(dt);
    const kind = this.location;
    const p = this.person;
    if (this.active === 'person' && interiorOnDoor(kind, p.x, p.y)) {
      this.exitInterior();
      return;
    }
    if (kind === 'mansion2' && this.active === 'person' && interiorOnStairs(kind, p.x, p.y)) {
      // Back down the stairwell: the ground floor resumes; the world return
      // info rides along untouched.
      const back = this.mansionReturn;
      const key = this.mansionKey.replace(/:up$/, '');
      this.location = 'mansion';
      this.mansionKey = key;
      this.mansionReturn = back;
      this.person.x = 14.5 * 24;
      this.person.y = 4 * 24;
      if (this.together) {
        this.dog.x = this.person.x - 20;
        this.dog.y = this.person.y + 3;
      }
      this.clearMoveTarget();
      this.emit('door');
      return;
    }
    // Re-arm closed menus at distance — but only this interior's own keys.
    // A world cooldown's stored position is in world coordinates; measuring
    // it against interior coordinates would clear it every time, and the
    // dismissed menu would pounce again the moment you stepped back out.
    if (this.choiceCooldown) {
      const cd = this.choiceCooldown;
      const prefix = `${this.mansionKey}:`;
      if (cd.key.startsWith(prefix) && Math.hypot(cd.x - p.x, cd.y - p.y) > ENCOUNTER_REARM) {
        this.choiceCooldown = null;
        for (const k of this.cooldownKeys) if (k.startsWith(prefix)) this.cooldownKeys.delete(k);
      }
    }
    // Named spots wait to be CLICKED (v0.21) — nothing opens on proximity.
    void dt;
  }

  updateMansion(dt) {
    const p = this.person;
    if (this.active === 'person' && onDoor(p.x, p.y)) {
      this.exitInterior();
      return;
    }
    // The stairs (v0.20): the lock rusted through. Standing on the stair
    // tiles climbs to the second floor.
    if (this.active === 'person' && nearStairs(p.x, p.y)) {
      const back = this.mansionReturn;
      this.enterInterior('mansion2', `${this.mansionKey}:up`, back);
      if (!this.encounterDone.has(`${this.mansionKey}:up:first`)) {
        this.encounterDone.add(`${this.mansionKey}:up:first`);
        this.announce(['THE LOCK HAS RUSTED THROUGH', 'THE STAIRS REMEMBER FEET. THEY CREAK ANYWAY']);
      }
      return;
    }
    // Re-arm a closed menu once you actually walk away (the television is
    // the one mansion encounter that comes back). Same interior-key scoping
    // as updateInterior: never wipe a world cooldown against indoor coords.
    if (this.choiceCooldown) {
      const cd = this.choiceCooldown;
      const prefix = `${this.mansionKey}:`;
      if (cd.key.startsWith(prefix) && Math.hypot(cd.x - p.x, cd.y - p.y) > ENCOUNTER_REARM) {
        this.choiceCooldown = null;
        for (const k of this.cooldownKeys) if (k.startsWith(prefix)) this.cooldownKeys.delete(k);
      }
    }
    // The portrait and the television wait to be CLICKED now (v0.21).
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

  /** Fist damage scales with raw strength: floor(STR / 4), never zero. */
  fistDamage() {
    return Math.max(1, Math.floor(this.stats.str / 4));
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
    return (
      (this.hasBone ? BONE_WEIGHT : 0) +
      (this.boneMeat ? MEAT_WEIGHT : 0) +
      this.wood * WEIGHT.wood +
      (this.hasAxe ? WEIGHT.axe : 0) +
      (this.hasRope ? WEIGHT.rope : 0) +
      (this.hasManual ? WEIGHT.manual : 0) +
      (this.hasLamp ? WEIGHT.lamp : 0) +
      (this.hasPipe ? WEIGHT.pipe : 0)
      // The boat is not carried. The boat carries YOU.
    );
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
        // Sobering up clamps any slots the borrowed WIS was holding open.
        for (const lv of SLOT_LEVELS) this.slots[lv] = Math.min(this.slots[lv], this.maxSlots(lv));
      }
    }
    // v0.21: slots do NOT seep back — only rest returns them.
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
      else if (!this.interactNearest()) this.throwBall();
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

    // Heaven's water is warm and swimmable (v0.20): slow strokes — or the
    // boat's easy glide, once you've built her. Night water stays a wall.
    const wasSwimming = this.swimming;
    this.swimming =
      this.plane === 'heaven' &&
      this.location === 'world' &&
      isWater(this.world.seed, this.person.x, this.person.y);
    this.person.speed = PERSON.speed * (this.swimming ? (this.hasBoat ? SAIL_SPEED : SWIM_SPEED) : 1);
    if (this.swimming && !wasSwimming) this.emit(this.hasBoat ? 'sail' : 'splash');

    // Player-controlled character: keys win over a tap target.
    const dirX = dirXLock ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dirY = dirXLock ? 0 : (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dirXLock) this.clearMoveTarget();
    if (dirX !== 0 || dirY !== 0) {
      this.clearMoveTarget();
      this.pendingInteract = null; // steering by hand cancels the walk-to-talk
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

    // Under any roof, the interior runs its own small world.
    if (this.location !== 'world') {
      this.updateInterior(dt);
      return;
    }

    // Doorways (v0.20: every big landmark opens): the mansion, the cabin,
    // the bail-bonds office — and in heaven, the cathedral.
    if (this.active === 'person') {
      const p = this.person;
      for (const m of this.world.mansionsInRect(p.x - 60, p.y - 60, 120, 120)) {
        if (Math.abs(p.x - m.x) < 8 && p.y > m.y - 6 && p.y < m.y + 5) {
          this.enterMansion(m);
          return;
        }
      }
      for (const c of this.world.cabinsInRect(p.x - 80, p.y - 80, 160, 160)) {
        if (Math.abs(p.x - c.x) < 8 && p.y > c.y - 5 && p.y < c.y + 5) {
          this.enterInterior('cabin', `cb:${c.x},${c.y}`, { px: c.x, py: c.y + 12, dx: c.x - 15, dy: c.y + 16 });
          if (!this.encounterDone.has(`${this.mansionKey}:in`)) {
            this.encounterDone.add(`${this.mansionKey}:in`);
            this.announce(['THE DOOR NOBODY EVER SAW OPEN. IT OPENS', 'ONE ROOM. ONE LIFE. SOMEBODY LEFT IN A HURRY']);
          }
          return;
        }
      }
      for (const o of this.world.officesInRect(p.x - 80, p.y - 80, 160, 160)) {
        if (Math.abs(p.x - (o.x + 32)) < 8 && p.y > o.y - 5 && p.y < o.y + 5) {
          this.enterInterior('office', `of:${o.x},${o.y}`, { px: o.x, py: o.y + 12, dx: o.x - 15, dy: o.y + 16 });
          if (!this.encounterDone.has(`${this.mansionKey}:in`)) {
            this.encounterDone.add(`${this.mansionKey}:in`);
            this.announce(['GORSKI - BAIL BONDS, SAYS THE GLASS', 'THE LIGHT INSIDE IS THE COLOR OF COLD COFFEE']);
          }
          return;
        }
      }
      for (const sh of this.world.cortiesInRect(p.x - 80, p.y - 80, 160, 160)) {
        if (Math.abs(p.x - (sh.x + 31)) < 8 && p.y > sh.y - 5 && p.y < sh.y + 5) {
          this.enterInterior('cortie', `co:${sh.x},${sh.y}`, { px: sh.x + 31, py: sh.y + 12, dx: sh.x + 16, dy: sh.y + 16 });
          if (!this.encounterDone.has(`${this.mansionKey}:in`)) {
            this.encounterDone.add(`${this.mansionKey}:in`);
            this.announce(['STEEL, SAYS THE SIGN. THE HINGES AGREE LOUDLY', 'CORTIE DOES NOT LOOK UP. THE WHETSTONE DOES']);
          }
          return;
        }
      }
      for (const sh of this.world.queebeesInRect(p.x - 80, p.y - 80, 160, 160)) {
        if (Math.abs(p.x - (sh.x - 31)) < 8 && p.y > sh.y - 5 && p.y < sh.y + 5) {
          this.enterInterior('queebee', `qb:${sh.x},${sh.y}`, { px: sh.x - 31, py: sh.y + 12, dx: sh.x - 46, dy: sh.y + 16 });
          if (!this.encounterDone.has(`${this.mansionKey}:in`)) {
            this.encounterDone.add(`${this.mansionKey}:in`);
            this.announce(['THE BELL OVER THE DOOR IS A SMALL SILVER GHOST', 'QUEEBEE LOOKS UP OVER HER SPECTACLES. ONE EYEBROW FILES YOU']);
          }
          return;
        }
      }
      if (this.plane === 'heaven') {
        for (const d of this.world.dumpstersInRect(p.x - 60, p.y - 60, 120, 120)) {
          // In heaven the dumpster spots hold cathedrals; their doors stand open.
          if (Math.abs(p.x - d.x) < 7 && p.y > d.y - 6 && p.y < d.y + 5) {
            this.enterInterior('cathedral', `ca:${d.x},${d.y}`, { px: d.x, py: d.y + 12, dx: d.x - 15, dy: d.y + 16 });
            if (!this.encounterDone.has(`${this.mansionKey}:in`)) {
              this.encounterDone.add(`${this.mansionKey}:in`);
              this.announce(['THE NAVE SWALLOWS SOUND AND GIVES BACK MUSIC', 'THE RAGAS WERE ALREADY GOING. THEY ALWAYS WERE']);
            }
            return;
          }
        }
      }
    }

    // A clicked interactable being walked to: open its menu on arrival, or
    // give up if the walk was abandoned.
    if (this.pendingInteract && !this.choice && this.active === 'person') {
      const t = this.pendingInteract;
      if (Math.hypot(t.x - this.person.x, t.y - this.person.y) <= INTERACT_REACH) {
        this.pendingInteract = null;
        this.openMenuFor(t);
      } else if (!this.moveTarget) {
        this.pendingInteract = null;
      }
    }

    // v0.21: zombies lock on and shamble your way while the world is free.
    if (this.location === 'world' && this.plane !== 'heaven' && this.mode === 'free') {
      this.chaseZombies(dt);
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

  /**
   * Everything the person could CLICK right now (v0.21): the world's
   * friendly encounters — and, under a roof, the named spots plus the
   * mansion's portrait and television. Hostiles are never on the list (the
   * battle system owns them), and resolved one-shots don't reappear.
   * Each entry: { kind, key, x, y, r, data }.
   */
  interactables() {
    const out = [];
    const push = (kind, key, x, y, r = 16, data = null) => {
      if (this.encounterDone.has(key)) return;
      out.push({ kind, key, x, y, r, data });
    };
    if (this.location !== 'world') {
      const kind = this.location;
      if (kind === 'mansion') {
        const port = MANSION_FURNISH_LIST.find((f) => f.kind === 'portrait');
        const tv = MANSION_FURNISH_LIST.find((f) => f.kind === 'television');
        if (port) push('portrait', `${this.mansionKey}:port`, port.x, port.y + 14, 20);
        if (tv) push('tv', `${this.mansionKey}:tv`, tv.x, tv.y + 12, 22);
      } else {
        for (const spot of INTERIORS[kind].spots) {
          push(`spot:${spot.id}`, `${this.mansionKey}:${spot.id}`, spot.x, spot.y, Math.max(14, spot.r * 0.5), spot);
        }
      }
      return out;
    }
    const p = this.person;
    const R = 420; // generous: anything on screen is hoverable
    const near = (method) => this.world[method](p.x - R, p.y - R, R * 2, R * 2);
    for (const f of near('dumpstersInRect')) {
      push(this.plane === 'heaven' ? 'cathedral' : 'dumpster', `d:${f.x},${f.y}`, f.x, f.y, 20);
    }
    for (const f of near('catsInRect')) push('cat', `c:${f.x},${f.y}`, f.x, f.y, 14);
    for (const f of near('lampsInRect')) push('lamp', `l:${f.x},${f.y}`, f.x, f.y, 12);
    for (const f of near('pipesInRect')) push('pipe', `p:${f.x},${f.y}`, f.x, f.y, 12);
    if (this.plane === 'heaven') {
      const god = godSpot(this.world.seed);
      if (god) push('god', 'god', god.x, god.y, 18);
      for (const f of near('signsInRect')) push('sign', `sn:${f.x},${f.y}`, f.x, f.y, 14);
      for (const f of near('shrinesInRect')) push('shrine', `sh:${f.x},${f.y}`, f.x, f.y, 16);
      for (const f of near('zombiesInRect')) push('angel', `z:${f.x},${f.y}`, f.x, f.y, 16);
    } else {
      for (const f of near('pirtsInRect')) push('pirts', `pi:${f.x},${f.y}`, f.x, f.y, 16);
      for (const f of near('ghostsInRect')) {
        if (f.temper === 'hostile') continue; // the battle system owns those
        const pos = ghostPos(f, this.time);
        push('ghost', `gh:${f.x},${f.y}`, pos.x, pos.y, 14, { temper: f.temper });
      }
      for (const f of near('townsignsInRect')) push('townsign', `ts:${f.x},${f.y}`, f.x, f.y, 14);
      for (const f of near('wizardsInRect')) {
        push('wizard', `wz:${f.x},${f.y}`, f.x, f.y, 16, { variant: f.variant });
      }
      for (const f of near('qtownsignsInRect')) push('qtownsign', `qs:${f.x},${f.y}`, f.x, f.y, 14);
    }
    return out;
  }

  /** The interactable under a point (world or interior coords), or null. */
  interactableAt(wx, wy) {
    let best = null;
    for (const it of this.interactables()) {
      const d = Math.hypot(it.x - wx, it.y - wy);
      if (d <= it.r + 8 && (!best || d < best.d)) best = { ...it, d };
    }
    return best;
  }

  /**
   * A tap claimed by an interactable: in reach the menu opens right away —
   * clicking again re-interacts immediately, no cooldown — and out of reach
   * the person walks over and opens it on arrival. Returns true when the
   * tap was spent here (main.js falls through to plain tap-to-move).
   */
  interactAt(wx, wy) {
    if (this.choice) return false;
    if (this.active !== 'person') return false;
    const it = this.interactableAt(wx, wy);
    if (!it) {
      this.pendingInteract = null;
      return false;
    }
    if (Math.hypot(it.x - this.person.x, it.y - this.person.y) <= INTERACT_REACH) {
      this.pendingInteract = null;
      this.openMenuFor(it);
    } else {
      this.pendingInteract = { kind: it.kind, key: it.key, x: it.x, y: it.y, data: it.data };
      this.setMoveTarget(it.x, it.y + 10);
    }
    return true;
  }

  /** The action key, out of battle: talk to whatever is in front of you. */
  interactNearest() {
    if (this.choice || this.active !== 'person') return false;
    let best = null;
    for (const it of this.interactables()) {
      const d = Math.hypot(it.x - this.person.x, it.y - this.person.y);
      if (d <= INTERACT_REACH && (!best || d < best.d)) best = { ...it, d };
    }
    if (!best) return false;
    this.openMenuFor(best);
    return true;
  }

  /** Open the right menu for a clicked interactable. */
  openMenuFor(it) {
    const { kind, key, x, y } = it;
    if (kind.startsWith('spot:')) {
      this.openSpotMenu(this.location, it.data ?? { id: kind.slice(5) }, key);
      return;
    }
    if (kind === 'pirts') {
      this.emit('ghost');
      this.openPirtsMenu(key, x, y);
      return;
    }
    if (kind === 'god') return this.openGodMenu();
    if (kind === 'portrait') return this.openPortraitMenu(key);
    if (kind === 'tv') return this.openTvMenu(key);
    const SPECS = {
      cathedral: {
        title: 'A CATHEDRAL OF MELTED GOLD',
        options: [
          { id: 'listen', label: 'LISTEN TO THE RAGAS' },
          { id: 'gold', label: 'ADD TO THE PILE OF GOD' },
          { id: 'confess', label: 'CONFESS NOTHING IN PARTICULAR' },
          { id: 'walkaway', label: 'STEP BACK INTO THE LIGHT' },
        ],
      },
      dumpster: {
        title: 'A DUMPSTER BURNS IN THE DARK',
        options: [
          { id: 'search', label: 'SEARCH THE DUMPSTER' },
          { id: 'putout', label: 'PUT OUT THE FIRE (HOW?)' },
          { id: 'warm', label: 'WARM YOUR HANDS' },
          { id: 'take', label: 'POCKET THE FIRE' },
          { id: 'walkaway', label: 'WALK AWAY' },
        ],
      },
      cat: {
        title: 'A PSYCHEDELIC CAT REGARDS YOU',
        options: [
          { id: 'talk', label: 'TALK TO HIM' },
          { id: 'pet', label: 'PET HIM' },
          { id: 'grab', label: 'GRAB HIM' },
          { id: 'stare', label: 'STARE BACK' },
        ],
      },
      lamp: { title: LAMP_TITLE, options: LAMP_OPTIONS },
      pipe: {
        title: 'A PIPE OF HALF-BURNT GREEN LEAF',
        options: [
          { id: 'smoke', label: 'SMOKE THE PIPE' },
          { id: 'sniff', label: 'SNIFF IT' },
          { id: 'tap', label: 'TAP OUT THE ASH' },
          { id: 'take', label: 'POCKET THE PIPE' },
          { id: 'walkaway', label: 'LEAVE IT BE' },
        ],
      },
      sign: {
        emit: 'sign',
        title: 'A SIGN, HAND-PAINTED, PATIENT',
        options: [
          { id: 'read', label: 'READ IT' },
          { id: 'follow', label: 'FOLLOW WHERE IT POINTS' },
          { id: 'lean', label: 'LEAN ON IT' },
          { id: 'take', label: 'TRY TO TAKE IT' },
          { id: 'walkon', label: 'WALK ON' },
        ],
      },
      shrine: {
        title: 'THE ISLAND SHRINE. YOU MADE IT',
        options: [
          { id: 'offer', label: 'LEAVE AN OFFERING (1 COIN)' },
          { id: 'shade', label: 'SIT IN ITS SHADE' },
          { id: 'stones', label: 'READ THE STACKED STONES' },
          { id: 'take', label: 'POCKET A STONE' },
          { id: 'swim', label: 'SWIM ON' },
        ],
      },
      ghost: {
        emit: 'ghost',
        title:
          it.data?.temper === 'sullen'
            ? 'A GHOST, BUFFERING ITS GRIEF'
            : 'A GHOST DRIFTS THROUGH ITS OLD ROUTINE',
        options: [
          { id: 'what', label: 'ASK WHAT HAPPENED HERE' },
          { id: 'coin', label: 'OFFER A COIN' },
          { id: 'sit', label: 'KEEP IT COMPANY' },
          { id: 'back', label: 'BACK AWAY SLOWLY' },
        ],
      },
      townsign: {
        title: 'A LEANING SIGN',
        options: [
          { id: 'read', label: 'READ IT' },
          { id: 'straighten', label: 'STRAIGHTEN IT' },
          { id: 'listen', label: 'LISTEN TO IT CREAK' },
          { id: 'take', label: 'TRY TO TAKE IT' },
          { id: 'along', label: 'MOVE ALONG' },
        ],
      },
      wizard: {
        title: ['A WIZARD, GRUMPILY', 'A WIZARD, MID-GRUMBLE', 'A WIZARD, SQUINTING AT YOU'][
          (it.data?.variant ?? 0) % 3
        ],
        options: [
          { id: 'talk', label: 'SAY HELLO' },
          { id: 'ask', label: 'ASK ABOUT THE TOWN' },
          { id: 'hat', label: 'COMPLIMENT THE HAT' },
          { id: 'spells', label: 'ASK ABOUT SPELLS' },
          { id: 'leave', label: 'LEAVE HIM TO IT' },
        ],
      },
      qtownsign: {
        title: 'QUEUE TOWN, SAYS THE BOARD',
        options: [
          { id: 'read', label: 'READ IT' },
          { id: 'glyph', label: 'TOUCH THE GLOWING GLYPH' },
          { id: 'wait', label: 'STAND IN LINE, EXPERIMENTALLY' },
          { id: 'along', label: 'MOVE ALONG' },
        ],
      },
      angel: {
        emit: 'blessing',
        title: 'AN ANGEL CONSIDERS YOU',
        options: [
          { id: 'befriend', label: 'TRY TO BEFRIEND IT' },
          { id: 'bask', label: 'BASK IN ITS LIGHT' },
          { id: 'ask', label: 'ASK THE WAY HOME' },
          { id: 'walkaway', label: 'LEAVE IT BE' },
        ],
      },
    };
    const spec = SPECS[kind];
    if (!spec) return;
    if (spec.emit) this.emit(spec.emit);
    this.openChoice({ kind, key, x, y, title: spec.title, options: spec.options });
  }

  /** The mansion portrait's menu (clicked; it only needs to be seen once). */
  openPortraitMenu(key) {
    if (!this.captionSticky) {
      this.caption = null;
      this.captionQueue.length = 0;
    }
    this.openChoice({
      kind: 'portrait',
      key,
      x: this.person.x,
      y: this.person.y,
      title: 'AN OLD PORTRAIT',
      options: [
        { id: 'look', label: 'LOOK CLOSER' },
        { id: 'name', label: 'ASK ITS NAME' },
        { id: 'frame', label: 'STRAIGHTEN THE FRAME' },
        { id: 'away', label: 'LOOK AWAY' },
      ],
    });
  }

  /** The television's menu (clicked): the way up, and the way back down. */
  openTvMenu(key) {
    if (!this.captionSticky) {
      this.caption = null;
      this.captionQueue.length = 0;
    }
    this.emit('tv');
    this.openChoice({
      kind: 'tv',
      key,
      x: this.person.x,
      y: this.person.y,
      title:
        this.plane === 'heaven' ? 'THE TELEVISION SHOWS THE NIGHT BELOW' : 'AN OLD TELEVISION, WARM WITH ROSE LIGHT',
      options: [
        { id: 'inside', label: 'STEP INSIDE' },
        { id: 'channel', label: 'CHANGE THE CHANNEL' },
        { id: 'down', label: 'TURN IT DOWN' },
        { id: 'away', label: 'STEP AWAY' },
      ],
    });
  }

  /** God's audience — the one menu that still opens itself. God initiates. */
  openGodMenu() {
    const god = godSpot(this.world.seed);
    if (!god) return;
    if (!this.godMet) {
      this.godMet = true;
      this.emit('chirp');
      this.announce([
        'THE SIGNS ALL POINTED HERE',
        'GOD IS A CRICKET. GOD HAS ALWAYS BEEN A CRICKET',
      ]);
      this.gainXp(3);
    }
    this.openChoice({
      kind: 'god',
      key: 'god',
      x: god.x,
      y: god.y,
      title: 'GOD, EXISTING AS A CRICKET',
      options: [
        { id: 'question', label: 'ASK THE BIG QUESTION' },
        { id: 'confess', label: 'CONFESS' },
        { id: 'sit', label: 'SIT WITH GOD A WHILE' },
        { id: 'shoo', label: 'SHOO THE FROGS' },
        { id: 'leave', label: 'LEAVE QUIETLY' },
      ],
    });
  }

  /**
   * v0.21: the world no longer ambushes the player with menus — encounters
   * open when CLICKED (interactAt / interactNearest / the action key). The
   * only interruptions left are the ones something else starts: hostiles
   * pull the world turn-based (checkBattle), and God — who has been
   * expecting you — opens the audience when you arrive.
   */
  checkEncounters() {
    if (this.choice) return;
    if (this.location !== 'world') return;
    if (this.active !== 'person') return;
    if (this.mode === 'turn') return;
    const p = this.person;
    // The re-arm walk-away only gates the self-opening menus now; clicks
    // never consult it.
    if (this.choiceCooldown) {
      const cd = this.choiceCooldown;
      if (Math.hypot(cd.x - p.x, cd.y - p.y) > ENCOUNTER_REARM) {
        this.choiceCooldown = null;
        this.cooldownKeys.clear();
      }
    }
    if (this.plane !== 'heaven') return;
    const god = godSpot(this.world.seed);
    if (!god || this.cooldownKeys.has('god') || this.choiceCooldown?.key === 'god') return;
    if (Math.hypot(god.x - p.x, god.y - p.y) <= 48) this.openGodMenu();
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
      // Anchored where YOU stand, not where the feature is: a padded feature
      // can trigger from beyond the re-arm ring, and a feature-anchored
      // cooldown would clear itself while you stood perfectly still.
      this.choiceCooldown = { key: c.key, x: this.person.x, y: this.person.y };
      this.cooldownKeys.add(c.key); // stays blocked even if a neighbor closes after
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
          this.gainCoins(2);
          this.announce([
            `${this.rollText(r)} - YOU PULL OUT A MEATY BONE`,
            'AND TWO COINS, FIRE-WARM (+2 COINS)',
          ]);
          this.openChoice(this.boneMenu(`${c.key}:bone`, c.x, c.y));
        } else {
          this.announce([`${this.rollText(r)} - THE FIRE BITES YOU (-1 HP)`]);
          this.damage(1);
        }
      } else if (id === 'warm') {
        const wk = `${c.key}:warmed`;
        if (!this.encounterDone.has(wk)) {
          this.encounterDone.add(wk);
          this.heal(1);
          this.emit('heal');
          this.hearts.push({ x: c.x, y: c.y - 24, t: 1.6 });
          this.announce(['THE FIRE DOES ONE KIND THING TONIGHT (+1 HP)', 'IT WILL DENY THIS LATER']);
        } else {
          this.announce(['THE FIRE HAS BEEN KIND ONCE ALREADY', 'IT HAS A REPUTATION TO KEEP']);
        }
      } else if (id === 'take') {
        this.announce(['YOU CANNOT POCKET A FIRE', 'YOU CAN ONLY RESPECT IT']);
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
      else if (id === 'sniff') {
        this.emit('eat');
        this.announce(['DINNER AND HISTORY, IN THAT ORDER']);
        this.openChoice(this.boneMenu(c.key, c.x, c.y)); // eat/save stays on the table
      } else if (id === 'heft') {
        this.announce([`${BONE_WEIGHT} LBS OF SOMEBODY'S GOOD IDEA`, 'IT BALANCES LIKE IT MISSES WORK']);
      } else this.announce(['YOU POCKET THE MEATY BONE']);
    } else if (c.kind === 'sheet') {
      if (id === 'spells') this.openSpellMenu();
      else if (id !== 'close') this.openIconDetail(id);
    } else if (c.kind === 'detail') {
      if (id === 'back') this.openSheet();
      else if (id === 'eat') this.eatBoneMeat();
      else if (id === 'nibble') this.nibbleMeat();
      else if (id === 'punch') this.attackFromSheet('fists');
      else if (id === 'swing') this.attackFromSheet('bone');
      else if (id === 'swing-axe') this.attackFromSheet('axe');
      else if (id === 'swing-sword') this.attackFromSheet('sword');
      else if (id === 'flick-wand') this.attackFromSheet('wand');
      else if (id === 'chop') this.chopTree();
      else if (id === 'build') this.buildBoat();
      else if (id === 'throw') this.throwBall();
      else if (id.startsWith('cast-')) this.castScroll(id.slice(5));
      else if (id.startsWith('inscribe-')) this.inscribeScroll(id.slice(9));
      else if (id === 'rub-lamp') this.rubLamp('lamp:carried', this.person.x, this.person.y);
      else if (id === 'smoke-pipe') {
        this.pipeSpent = true;
        this.smokeThePipe();
      } else this.resolveDetailFlavor(id);
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
      else if (id === 'name') {
        this.emit('clock');
        this.announce(['YOU ASK ITS NAME', 'THE HOUSE SWALLOWED IT YEARS AGO']);
      } else if (id === 'frame') {
        this.triggerGlitch(0.3);
        this.announce(['YOU NUDGE IT LEVEL. IT WAS ALREADY LEVEL', 'SOMEWHERE UPSTAIRS, SOMETHING TILTS TO COMPENSATE']);
      } else this.announce(['THE EYES FOLLOW YOU ANYWAY']);
    } else if (c.kind === 'zombie') {
      this.resolveZombie(c, id);
    } else if (c.kind === 'cat') {
      if (id === 'stare') {
        // The one exit that leaves him sitting there: you blink first, the
        // cooldown covers your retreat, and he keeps regarding you.
        this.triggerGlitch(0.3);
        this.announce(['YOU BLINK FIRST. YOU WERE ALWAYS GOING TO', 'THE CAT FILES THIS UNDER EXPECTED']);
      } else {
        this.encounterDone.add(c.key); // however else this goes, the cat is gone
        this.triggerGlitch(0.4);
        if (id === 'talk') {
          this.emit('vanish');
          this.announce(['THE CAT DISSOLVES INTO STATIC']);
        } else {
          this.emit('vanish');
          this.announce(['THE CAT SCRATCHES YOU (-1 HP) AND VANISHES']);
          this.damage(1);
        }
      }
    } else if (c.kind === 'lamp') {
      if (id === 'rub') {
        this.rubLamp(c.key, c.x, c.y);
      } else if (id === 'polish') {
        this.polishedLamps.add(c.key);
        this.triggerGlitch(0.3);
        this.announce(['THE BRASS COMES UP LIKE A SMALL DROWNED SUN', 'SOMETHING INSIDE SHIFTS ITS WEIGHT']);
        this.openChoice({ kind: 'lamp', key: c.key, x: c.x, y: c.y, title: LAMP_TITLE, options: LAMP_OPTIONS });
      } else if (id === 'ear') {
        this.emit('whimper');
        this.announce(['INSIDE: SNORING. FAINT, ANCIENT, CONTENT', 'YOU SET IT DOWN GENTLY. LET SOMETHING SLEEP']);
      } else if (id === 'take') {
        // v0.21: it goes in the pocket. The polish rides along.
        this.encounterDone.add(c.key);
        if (this.polishedLamps.delete(c.key)) this.polishedLamps.add('lamp:carried');
        this.hasLamp = true;
        this.emit('pickup');
        this.announce(['YOU TAKE THE LAMP. IT IS HEAVIER THAN A SECRET', 'SOMETHING INSIDE TURNS OVER IN ITS SLEEP']);
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
      } else if (id === 'nothing') {
        const lines = ['THE GENIE STARES. NOBODY HAS EVER ASKED FOR THAT', 'HE GRANTS IT FLAWLESSLY. NOTHING ARRIVES'];
        if (this.spells.length && this.slots[1] < this.maxSlots(1)) {
          this.slots[1] += 1;
          lines.push('YOU FEEL STRANGELY LOOKED AFTER (+1 SLOT)');
        } else {
          lines.push('YOU FEEL STRANGELY LOOKED AFTER');
        }
        this.announce(lines);
      } else {
        this.announce(['THE GENIE ROLLS HIS EYES AND VANISHES']);
      }
    } else if (c.kind === 'pipe') {
      if (id === 'smoke') {
        this.encounterDone.add(c.key); // the leaf only had one bowl in it
        this.smokeThePipe();
      } else if (id === 'sniff') {
        this.announce(['IT SMELLS LIKE REGRET AND LAWN CLIPPINGS']);
      } else if (id === 'tap') {
        this.triggerGlitch(0.25);
        this.announce(['THE ASH MAKES ONE SMALL GRAY GHOST AND JOINS THE NIGHT']);
      } else if (id === 'take') {
        this.encounterDone.add(c.key);
        this.hasPipe = true;
        this.emit('pickup');
        this.announce(['YOU POCKET THE PIPE, STILL FAINTLY WARM', 'THE WOODS PRETEND NOT TO NOTICE']);
      }
      // walkaway: it keeps smoldering.
    } else if (c.kind === 'battle') {
      const foe = this.nearestFoe();
      if (id === 'wait') {
        this.say('YOU HOLD YOUR GROUND');
        this.endPlayerTurn();
      } else if (id === 'study') {
        const STUDY = {
          zombie: ['IT SHAMBLES ON A BAD HIP. LEFT SIDE', 'KNOWING THIS CHANGES NOTHING. IT HELPS ANYWAY'],
          ghost: ['IT LOOPS THE SAME FOUR FRAMES OF GRIEF', 'BETWEEN FRAME TWO AND THREE, IT IS NOWHERE AT ALL'],
          minotaur: ['HE CHECKS EVERY GAP TWICE, LIKE A MAN WHO LOST HIS KEYS', 'THE MAZE IS NOT AROUND HIM. THAT IS THE PROBLEM'],
        };
        this.announce(STUDY[foe?.kind ?? 'zombie']);
        this.endPlayerTurn();
      } else if (id === 'taunt') {
        const UNMOVED = {
          zombie: 'THE ZOMBIE IS UNMOVED. YOU ARE, SLIGHTLY',
          ghost: 'THE GHOST PLAYS IT BACK, GLITCHED. IT SOUNDS BRAVER THAT WAY',
          minotaur: 'THE MINOTAUR NODS, POLITE. HE HAS HEARD ECHOES BEFORE',
        };
        this.announce(['YOU SHOUT. THE WOODS SWALLOW IT WHOLE', UNMOVED[foe?.kind ?? 'zombie']]);
        this.endPlayerTurn();
      } else if (id === 'dirt') {
        // DEX, at last: land it and their answer goes wide this round.
        const r = this.check('dex');
        if (r.total >= DC_DIRT) {
          this.dazed = true;
          const BLIND = {
            zombie: 'IT PAWS AT WHAT IS LEFT OF ITS EYES',
            ghost: 'THE DIRT SAILS THROUGH. IT FLINCHES ON PRINCIPLE',
            minotaur: 'HE SHAKES HIS GREAT HEAD, BLINDED A BEAT',
          };
          this.announce([`${this.rollText(r)} - ${BLIND[foe?.kind ?? 'zombie']}`]);
        } else {
          this.announce([`${this.rollText(r)} - THE NIGHT THROWS IT BACK`]);
        }
        this.endPlayerTurn();
      } else if (id === 'befriend') {
        const NOPE = {
          zombie: 'THE ZOMBIE DOES NOT WANT FRIENDS',
          ghost: 'IT GLITCHES THROUGH YOUR OUTSTRETCHED HAND',
          minotaur: 'HE DOES NOT HEAR YOU OVER THE MAZE',
        };
        this.announce([NOPE[foe?.kind ?? 'zombie']]);
        this.endPlayerTurn();
      } else if (id === 'maze') {
        this.announce([
          'WHAT DO I DO NEXT, HE ASKS THE AIR',
          'EVERY DOOR I FIND IS ANOTHER ROOM OF ME',
          'HE IS NOT TALKING TO YOU. HE NEVER STOPPED WALKING',
        ]);
        this.endPlayerTurn();
      } else if (id === 'directions') {
        // WIS vs DC 13: you cannot lead him out, but you can point him
        // somewhere kinder. The fight ends if it lands.
        const r = this.check('wis');
        if (foe && r.total >= DC_DIRECTIONS) {
          this.encounterDone.add(foe.key);
          this.zombieHp.delete(foe.key);
          this.emit('vanish');
          this.triggerGlitch(0.5);
          this.announce([
            `${this.rollText(r)} - YOU POINT AT NOTHING, CONFIDENTLY`,
            'HE STARES. THEN HE LAUGHS, ONCE, LIKE A DOOR UNSTICKING',
            'A MAZE IS JUST A PATH THAT LOVES YOU TOO MUCH TO END',
            'HE WANDERS ON. LIGHTER. STILL LOST. LESS ALONE',
          ]);
          this.gainXp(FOES.minotaur.xp);
        } else {
          this.announce([`${this.rollText(r)} - THE WORDS COME OUT AS WALLS`]);
          this.endPlayerTurn();
        }
      } else if (id === 'cast') {
        this.openSpellMenu();
      } else {
        if (!foe) this.endPlayerTurn();
        else this.resolveZombie({ kind: 'zombie', foe: foe.kind, key: foe.key, x: foe.x, y: foe.y }, id);
      }
    } else if (c.kind === 'spell') {
      if (id === 'breathe') {
        if (!this.breathed && this.slots[1] < this.maxSlots(1)) {
          this.breathed = true;
          this.slots[1] += 1;
          this.announce(['IN. OUT. THE CHEAPEST SPELL, AND STILL NOBODY CASTS IT (+1 SLOT)']);
        } else {
          this.announce(['IN. OUT.', 'THE BREATH IS FREE. THE SLOT WAS A ONE-TIME COURTESY']);
        }
        if (this.mode === 'turn') this.endPlayerTurn(); // breathing takes the turn
      } else if (id === 'hum') {
        this.emit('spell-fail');
        this.announce(['YOU HUM THE SYLLABLES WITHOUT THE INTENT', "THE DOG'S EAR TURNS. THE MOON DOES NOT"]);
      } else if (id !== 'back') this.castSpell(id);
      else if (this.mode === 'turn') this.openBattleMenu();
      else this.openSheet();
    } else if (c.kind.startsWith('spot:')) {
      this.resolveSpot(c, id);
    } else if (c.kind === 'god') {
      if (id === 'question') {
        this.emit('chirp');
        this.announce(['YOU ASK IT. THE WHOLE THING. ALL OF IT', 'CHIRP.', 'SOMEHOW THAT COVERS IT']);
      } else if (id === 'confess') {
        this.emit('chirp');
        this.announce(['YOU CONFESS. THE LAKE HOLDS STILL FOR IT', 'GOD CLEANS ONE ANTENNA', 'YOU ARE NOT FORGIVEN. YOU ARE SOMETHING BETTER. HEARD']);
      } else if (id === 'sit') {
        this.rest();
        this.hearts.push({ x: c.x, y: c.y - 21, t: HEART_TTL });
        this.announce(['YOU SIT. GOD EXISTS. YOU EXIST', 'THE FROGS WATCH FROM THEIR LILIPADS', 'SITTING WITH GOD IS A REST. EVERY SLOT RETURNS']);
      } else if (id === 'shoo') {
        this.emit('frog');
        if (!this.encounterDone.has('god:shooed')) {
          this.encounterDone.add('god:shooed');
          this.gainXp(1);
        }
        this.announce(['YOU SHOO THE FROGS. THE FROGS FILE A COMPLAINT', 'GOD DID NOT NEED THE HELP', 'GOD APPRECIATES IT ANYWAY']);
      } else if (id === 'leave') {
        this.announce(['YOU LEAVE QUIETLY', 'BEHIND YOU, A CHIRP. IT SOUNDS LIKE TAKE CARE']);
      }
    } else if (c.kind === 'sign') {
      const god = godSpot(this.world.seed);
      if (id === 'read') {
        this.announce(['GOD, IT SAYS. THEN AN ARROW', 'THE PAINT IS GOLD. THE HAND WAS STEADY']);
      } else if (id === 'follow') {
        if (god) {
          const dx = god.x - c.x;
          const dy = god.y - c.y;
          const len = Math.hypot(dx, dy) || 1;
          this.setMoveTarget(this.person.x + (dx / len) * 180, this.person.y + (dy / len) * 180);
          this.announce(['YOUR FEET AGREE BEFORE YOU DO']);
        }
      } else if (id === 'lean') {
        this.announce(['YOU LEAN. IT LEANS BACK, SLIGHTLY', 'THE SIGN DOES NOT MIND']);
      } else if (id === 'take') {
        this.announce(['YOU PULL. HEAVEN HOLDS ON', 'A DIRECTION IS A GIFT, NOT A THING']);
      }
      // walkon: nothing.
    } else if (c.kind === 'shrine') {
      if (id === 'offer') {
        if (this.islandBlessed) {
          this.announce(['THE BOWL IS FULL OF YOUR LAST COIN', 'THE CALM IS ALREADY YOURS']);
        } else if (this.coins >= 1) {
          this.coins -= 1;
          this.islandBlessed = true;
          this.emit('blessing');
          this.triggerGlitch(0.5);
          this.announce(['THE COIN SETTLES LIKE IT ALWAYS LIVED THERE', "THE ISLANDER'S CALM: ONE MORE SLOT, ALWAYS"]);
        } else {
          this.announce(['YOU HAVE NOTHING TO GIVE', 'THE SHRINE FINDS THIS EXTREMELY RELATABLE']);
        }
      } else if (id === 'shade') {
        this.heal(1);
        this.announce(['YOU SWAM AN OCEAN FOR THIS SHADE (+1 HP)', 'WORTH IT']);
      } else if (id === 'stones') {
        this.announce(['SOMEBODY STACKED THESE ONE AT A TIME', 'THAT IS THE WHOLE TEACHING']);
      } else if (id === 'take') {
        this.announce(['YOU LIFT A STONE. THE STACK LEANS, DISAPPOINTED', 'YOU PUT IT BACK. SOME THINGS ARE A PLACE']);
      }
      // swim: back into the warm water.
    } else if (c.kind === 'ghost') {
      if (id === 'what') {
        this.announce(['IT OPENS ITS MOUTH. STATIC POURS OUT', 'SOMEWHERE IN THE NOISE: A DINNER BELL, A TRAIN, A NAME']);
      } else if (id === 'coin') {
        if (this.coins >= 1) {
          this.coins -= 1;
          this.emit('coin');
          if (!this.encounterDone.has(`${c.key}:paid`)) {
            this.encounterDone.add(`${c.key}:paid`);
            this.gainXp(2);
          }
          this.announce(['THE COIN FALLS THROUGH IT AND LANDS TAILS', 'FOR ONE FRAME IT IS WHOLE, AND YOUNG, AND WAVING']);
        } else {
          this.announce(['YOUR POCKETS ARE AS EMPTY AS IT IS', 'IT NODS. SOLIDARITY']);
        }
      } else if (id === 'sit') {
        this.announce(['YOU STAND TOGETHER IN THE RUINED QUIET', 'IT GLITCHES LESS, BESIDE YOU']);
      } else if (id === 'back') {
        this.announce(['YOU BACK AWAY. IT DOES NOT FOLLOW', 'NOTHING HERE FOLLOWS. THAT IS THE PROBLEM']);
      }
    } else if (c.kind === 'wizard') {
      const GRUMPS = [
        ['HRMPH, HE SAYS', 'IT IS A COMPLETE SENTENCE, THE WAY HE SAYS IT'],
        ['HE LOOKS AT YOU. HE LOOKS AT HIS STAFF', 'HE DECIDES YOU ARE NOT WORTH THE STAFF'],
        ['GOOD EVENING, YOU SAY. HE DISAGREES'],
      ];
      if (id === 'talk') {
        this.wizardGrump = ((this.wizardGrump ?? -1) + 1) % GRUMPS.length;
        this.announce(GRUMPS[this.wizardGrump]);
      } else if (id === 'ask') {
        this.announce([
          'QUEUE TOWN, HE GRUMBLES. NAMED FOR THE WAITING',
          'WIZARDS QUEUE FOR EVERYTHING. POWER, MOSTLY',
          "CORTIE SELLS THE SHARP THINGS. QUEEBEE THE PAPER ONES",
        ]);
      } else if (id === 'hat') {
        this.hearts.push({ x: c.x, y: c.y - 30, t: HEART_TTL });
        this.announce(['THE SCOWL FLICKERS. THE HAT PREENS', 'IT IS A VERY GOOD HAT AND HE KNOWS IT']);
      } else if (id === 'spells') {
        this.announce([
          'LEVELS, HE SAYS, HOLDING UP THREE FINGERS',
          'YOUR MIND CARRIES SO MANY CASTINGS BETWEEN RESTS',
          'INT FILLS THE FIRST SHELF. WIS THE SECOND. CHA THE THIRD',
        ]);
      }
      // leave: he was already done with you.
    } else if (c.kind === 'qtownsign') {
      if (id === 'read') {
        this.announce(['QUEUE TOWN', 'UNDERNEATH, SMALLER: NO CUTTING']);
      } else if (id === 'glyph') {
        this.triggerGlitch(0.4);
        this.announce(['THE GLYPH IS WARM AND FAINTLY OFFENDED', 'YOU PUT YOUR FINGER DOWN. IT DIMS, SATISFIED']);
      } else if (id === 'wait') {
        this.announce(['YOU STAND IN LINE. THERE IS NO LINE', 'A PASSING WIZARD NODS. CORRECT FORM']);
      }
    } else if (c.kind === 'cortie-buy') {
      const buy = (flag, price, lines) => {
        if (this.coins < price) {
          this.announce(['NOT ENOUGH COIN', 'CORTIE SHRUGS. STEEL WAITS. STEEL IS GOOD AT IT']);
        } else {
          this.coins -= price;
          this[flag] = true;
          this.emit('buy');
          this.announce(lines);
        }
        this.openCortieBuy(c.key);
      };
      if (id === 'sword') buy('hasSword', PRICES.sword, ['A GOOD SWORD. IT HAS OPINIONS ABOUT ZOMBIES', 'CORTIE OILS THE SCABBARD, FREE']);
      else if (id === 'wand') buy('hasWand', PRICES.wand, ['THE WAND HUMS AGAINST YOUR PALM', 'POINT IT AWAY FROM THE HAT, CORTIE SAYS']);
      else if (id === 'look') {
        this.announce(['RACKS OF STEEL AND CROOKED LIGHTNING', 'EVERYTHING IS SHARP, INCLUDING THE PRICES']);
        this.openCortieBuy(c.key);
      } else if (id === 'back') this.openSpotMenu(this.location, { id: 'cortie-counter' }, c.key);
    } else if (c.kind === 'queebee-buy') {
      const buyScroll = (spell) => {
        const price = SCROLL_PRICES[spell];
        if (this.coins < price) {
          this.announce(['NOT ENOUGH COIN', 'QUEEBEE MARKS HER PLACE AND WAITS']);
        } else {
          this.coins -= price;
          this.scrolls[spell] = (this.scrolls[spell] ?? 0) + 1;
          this.emit('buy');
          const spec = SPELLS.find((sp) => sp.id === spell);
          this.announce([`ONE SCROLL OF ${spec.name}, TIED WITH VIOLET RIBBON`, 'CAST IT ONCE — OR INSCRIBE IT FOREVER, WITH PAPER OR THE BOOK']);
        }
        this.openQueebeeBuy(c.key);
      };
      if (id in SCROLL_PRICES) buyScroll(id);
      else if (id === 'paper') {
        if (this.coins < PAPER_PRICE) {
          this.announce(['NOT ENOUGH COIN', 'THE PAPER RUSTLES, UNBOUGHT']);
        } else {
          this.coins -= PAPER_PRICE;
          this.paper += 1;
          this.emit('buy');
          this.announce([`ONE BLANK PAGE (${this.paper} HELD)`, 'IT SMELLS OF POSSIBILITY AND A LITTLE OF GLUE']);
        }
        this.openQueebeeBuy(c.key);
      } else if (id === 'book') {
        if (this.coins < BOOK_PRICE) {
          this.announce(['NOT ENOUGH COIN', 'THE BOOK CLOSES ITSELF, UNHURT']);
        } else {
          this.coins -= BOOK_PRICE;
          this.hasBook = true;
          this.emit('buy');
          this.announce(['THE BLANK BOOK. PAGES FOREVER', 'INSCRIBE INTO IT AND NEVER BUY PAPER AGAIN']);
        }
        this.openQueebeeBuy(c.key);
      } else if (id === 'how') {
        this.announce([
          'A SCROLL CASTS ITS SPELL ONCE, FREE, AND BURNS',
          'OR: INSCRIBE IT — SPEND A PAGE (OR USE THE BOOK) AND THE SCROLL',
          'THE SPELL IS YOURS FOREVER AFTER. SLOTS APPLY',
        ]);
        this.openQueebeeBuy(c.key);
      } else if (id === 'back') this.openSpotMenu(this.location, { id: 'queebee-counter' }, c.key);
    } else if (c.kind === 'townsign') {
      if (id === 'read') {
        this.announce(['WELCOME, IT SAYS. THE TOWN NAME IS WEATHER NOW', 'POP. 0 AND RISING']);
      } else if (id === 'straighten') {
        this.triggerGlitch(0.3);
        this.announce(['YOU STRAIGHTEN IT. THE TOWN TILTS TO MATCH']);
      } else if (id === 'listen') {
        this.emit('sign');
        this.announce(['CREAK. CREAK.', 'IT IS THE ONLY ONE STILL DOING ITS JOB']);
      } else if (id === 'take') {
        this.announce(['IT IS NAILED DOWN WITH GHOST NAILS', 'THE TOWN KEEPS ITS NAME, SUCH AS IT IS']);
      }
    } else if (c.kind === 'pirts') {
      if (id === 'buy') this.openPirtsBuy(c.key, c.x, c.y);
      else if (id === 'sell') this.openPirtsSell(c.key, c.x, c.y);
      else if (id === 'talk') {
        const LINES = [
          ['PIRTS IS SPIRIT SPELLED SIDEWAYS. MOSTLY', 'HE LAUGHS AT HIS OWN JOKE. IT ECHOES TWICE'],
          ['BUSINESS IS DEAD, HE SAYS, AND WAITS', 'YOU GIVE HIM THE COURTESY LAUGH. HE BANKS IT'],
          ['ASK ABOUT MY LOYALTY PROGRAM, HE SAYS', 'THE LOYALTY PROGRAM IS THAT HE REMEMBERS YOU FOREVER'],
        ];
        this.pirtsJoke = ((this.pirtsJoke ?? -1) + 1) % LINES.length;
        this.announce(LINES[this.pirtsJoke]);
        this.openPirtsMenu(c.key, c.x, c.y);
      } else if (id === 'town') {
        this.announce([
          'GOOD PEOPLE. BAD LUCK. THE USUAL RECIPE',
          'ONE NIGHT THE LIGHTS HELD THEIR BREATH AND NEVER LET IT OUT',
          'THE DETECTIVE ON THE EDGE OF TOWN IS STILL BREATHING. VISIT HIM',
        ]);
        this.openPirtsMenu(c.key, c.x, c.y);
      }
      // leave: the cooldown covers it; Pirts waves with the wrong hand.
    } else if (c.kind === 'pirts-buy') {
      const buy = (item, price, lines) => {
        if (this.coins < price) {
          this.announce(['NOT ENOUGH COIN', 'PIRTS PATS YOUR SHOULDER. HIS HAND PASSES THROUGH. SORRY, HE SAYS']);
        } else {
          this.coins -= price;
          this.emit('buy');
          if (item === 'draught') this.heal(3);
          else this[item === 'axe' ? 'hasAxe' : item === 'rope' ? 'hasRope' : 'hasManual'] = true;
          this.announce(lines);
        }
        this.openPirtsBuy(c.key, c.x, c.y);
      };
      if (id === 'draught') buy('draught', PRICES.draught, ['IT TASTES LIKE STARLIGHT AND COUGH SYRUP (+3 HP)']);
      else if (id === 'axe') buy('axe', PRICES.axe, ['A GOOD AXE. IT REMEMBERS TREES', 'PIRTS THROWS IN THE STORY OF ITS PREVIOUS OWNER, FREE']);
      else if (id === 'rope') buy('rope', PRICES.rope, ['ROPE. THE HONEST TOOL', 'FIFTY USES, PIRTS SAYS. FIFTY-ONE IF YOU ARE SAD']);
      else if (id === 'manual') buy('manual', PRICES.manual, ['HOW TO BUILD A BOAT, GHOST-PRESS EDITION', 'CHAPTER ONE: WANT TO BE ELSEWHERE. YOU HAVE READ CHAPTER ONE']);
      else if (id === 'haggle') {
        this.announce(['YOU HAGGLE. PIRTS HAGGLES BACK. THE PRICE GOES UP ONE COIN', 'THEN HE WINKS AND PUTS IT BACK. THEATER, HE SAYS']);
        this.openPirtsBuy(c.key, c.x, c.y);
      } else if (id === 'good') {
        this.announce(['THE DRAUGHT, HE SAYS INSTANTLY. HOUSE RECIPE', 'HE IS DEAD. YOU ELECT NOT TO DO THE MATH']);
        this.openPirtsBuy(c.key, c.x, c.y);
      } else if (id === 'back') this.openPirtsMenu(c.key, c.x, c.y);
    } else if (c.kind === 'pirts-sell') {
      const sold = (lines) => {
        this.emit('sell');
        this.announce(lines);
        this.openPirtsSell(c.key, c.x, c.y);
      };
      if (id === 'meat' && this.boneMeat) {
        this.boneMeat = false;
        this.coins += SELLS.meat;
        sold(['HE SNIFFS IT PROFESSIONALLY. VINTAGE, HE SAYS', `+${SELLS.meat} COINS`]);
      } else if (id === 'bone' && this.hasBone) {
        this.hasBone = false;
        this.boneMeat = false;
        this.coins += SELLS.bone;
        sold(['PARTING WITH THE CLUB. BRAVE', `+${SELLS.bone} COINS`]);
      } else if (id === 'wood' && this.wood > 0) {
        this.wood -= 1;
        this.coins += SELLS.wood;
        sold([`ONE PLANK, ${this.wood} LEFT`, `+${SELLS.wood} COIN`]);
      } else if (id === 'story') {
        if (!this.encounterDone.has('pirts:story')) {
          this.encounterDone.add('pirts:story');
          this.coins += 1;
          sold(['YOU TELL HIM ABOUT THE TELEVISION. ABOUT THE CRICKET', 'WORTH EVERY PENNY, HE SAYS. HERE IS ONE', '+1 COIN']);
        } else {
          sold(['HE HAS HEARD THIS ONE. HE LETS YOU FINISH ANYWAY']);
        }
      } else if (id === 'what') {
        sold(['MEAT, BONES, PLANKS, RUMORS', 'SOULS ARE OFF THE MENU. REGULATIONS, HE SAYS, POINTING UP']);
      } else if (id === 'pockets') {
        sold([
          `LINT, ${this.coins} COIN${this.coins === 1 ? '' : 'S'}, ${this.wood} PLANK${this.wood === 1 ? '' : 'S'}`,
          'PIRTS APPRAISES THE LINT. SENTIMENTAL VALUE ONLY',
        ]);
      } else if (id === 'back') this.openPirtsMenu(c.key, c.x, c.y);
    } else if (c.kind === 'tv') {
      if (id === 'inside') {
        this.enterHeaven(); // (from heaven, the set shows the night — and leads there)
      } else if (id === 'channel') {
        this.emit('tv');
        this.announce(['EVERY CHANNEL IS THE SAME WARM LIGHT', 'ONE OF THEM HUMS A LITTLE HIGHER']);
      } else if (id === 'down') {
        this.emit('tv');
        this.triggerGlitch(0.3);
        this.announce(['THE KNOB TURNS. THE HUM DOES NOT', 'IT WAS NEVER COMING FROM THE SET']);
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
        this.rest();
        if (this.spells.length) lines.push('THE MUSIC IS A REST. EVERY SLOT RETURNS');
        this.announce(lines);
      } else if (id === 'gold') {
        this.emit('gold');
        this.goldGiven++;
        this.announce([
          'YOU ADD WHAT YOU CAN TO THE PILE OF GOD',
          'THEY MELT IT IN. THE SPIRE CLIMBS ONE COURSE HIGHER',
        ]);
      } else if (id === 'confess') {
        this.emit('blessing');
        this.hearts.push({ x: c.x, y: c.y - 24, t: HEART_TTL });
        this.announce(['YOU OPEN YOUR MOUTH. THE RAGAS FILL IT FOR YOU', 'ABSOLVED. PROBABLY']);
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

  /** Rub a lamp — in the litter or from the pocket: CHA vs the genie. */
  rubLamp(key, x, y) {
    const r = this.check('cha');
    if (this.polishedLamps.has(key)) {
      // A polished lamp answers a shade easier — once.
      this.polishedLamps.delete(key);
      r.mod += 1;
      r.total += 1;
    }
    if (r.total >= DC_GENIE) {
      this.emit('genie');
      this.triggerGlitch(0.5);
      this.announce([`${this.rollText(r)} - A GENIE BILLOWS OUT IN VIOLET SMOKE`]);
      // Chain straight into the wish menu (same key: resolving any wish
      // finishes the lamp).
      this.openChoice({
        kind: 'genie',
        key,
        x,
        y,
        title: 'THE GENIE OFFERS ONE WISH',
        options: [
          { id: 'health', label: 'WISH FOR HEALTH' },
          { id: 'home', label: 'WISH FOR HOME' },
          { id: 'wishes', label: 'WISH FOR MORE WISHES' },
          { id: 'nothing', label: 'WISH FOR NOTHING' },
        ],
      });
    } else {
      this.announce([`${this.rollText(r)} - ONLY DUST AND A FAINT COUGH INSIDE`]);
    }
  }

  /** One bowl of the half-burnt leaf: WIS vs a vision. */
  smokeThePipe() {
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
  }

  /** Gnaw the meat off the dumpster bone: +2 HP (+1 if nibbled), club remains. */
  eatBoneMeat() {
    if (!this.boneMeat) return;
    const gain = this.meatNibbled ? 1 : 2;
    this.boneMeat = false;
    this.meatNibbled = false;
    this.heal(gain);
    this.emit('eat');
    this.announce([`YOU GNAW OFF THE MEAT (+${gain} HP). THE BONE REMAINS`]);
  }

  /** A polite bite: the +2 serving splits into two +1 nibbles. */
  nibbleMeat() {
    if (!this.boneMeat) return;
    this.heal(1);
    this.emit('eat');
    if (this.meatNibbled) {
      this.boneMeat = false;
      this.meatNibbled = false;
      this.announce(['THE LAST POLITE BITE (+1 HP). THE BONE REMAINS']);
    } else {
      this.meatNibbled = true;
      this.announce(['ONE POLITE BITE (+1 HP). THE REST KEEPS']);
    }
  }

  /** The meaty-bone popup (also reopened after a sniff). */
  boneMenu(key, x, y) {
    return {
      kind: 'bone',
      key,
      x,
      y,
      title: 'A MEATY BONE',
      options: [
        { id: 'eat', label: 'GNAW OFF THE MEAT (+2 HP)' },
        { id: 'sniff', label: 'SNIFF IT FIRST' },
        { id: 'heft', label: 'FEEL ITS HEFT' },
        { id: 'save', label: 'SAVE IT FOR LATER' },
      ],
    };
  }

  /** Swing the axe at a tree in reach: STR vs DC 8, better rolls cut more. */
  chopTree() {
    if (!this.hasAxe || this.location !== 'world') return;
    const p = this.person;
    const trees = this.world.treesInRect(
      p.x - ENCOUNTER_RADIUS, p.y - ENCOUNTER_RADIUS, ENCOUNTER_RADIUS * 2, ENCOUNTER_RADIUS * 2,
    );
    if (!trees.length) {
      this.announce(['NO TREE IN REACH. THE AXE STAYS POLITE']);
      return;
    }
    const r = this.check('str');
    if (r.total >= DC_CHOP) {
      const planks = r.total >= 14 ? 3 : r.total >= 11 ? 2 : 1;
      this.wood += planks;
      this.emit('chop');
      this.triggerGlitch(0.3);
      this.announce([
        `${this.rollText(r)} - THE AXE REMEMBERS TREES (+${planks} PLANK${planks === 1 ? '' : 'S'})`,
        `${this.wood} OF THE ${BOAT_WOOD} A BOAT WANTS`,
      ]);
    } else {
      this.emit('bonk');
      this.announce([`${this.rollText(r)} - THE TREE DECLINES. BARK 1, AXE 0`]);
    }
  }

  /** The island the hard way: planks, the rope, the manual, a shoreline. */
  buildBoat() {
    if (this.hasBoat || this.wood < BOAT_WOOD || !this.hasRope || !this.hasManual) return;
    this.wood -= BOAT_WOOD;
    this.hasRope = false; // fifty-first use
    this.hasBoat = true;
    this.emit('sail');
    this.triggerGlitch(0.6);
    this.announce([
      'YOU BUILD THE BOAT. THE MANUAL WAS RIGHT ABOUT WANTING',
      `${BOAT_WOOD} PLANKS, ONE ROPE, MOST OF YOUR PATIENCE`,
      'SHE FLOATS. SOMEHOW, SHE FLOATS',
    ]);
  }

  /** The detail windows' small flavor verbs — v0.20's four-option floor. */
  resolveDetailFlavor(id) {
    switch (id) {
      // STR
      case 'knuckles':
        this.emit('bonk');
        this.announce(['ONE POP, LOUD AS A DISTANT DOOR', 'THE FOREST DOES NOT MIND']);
        break;
      case 'flex':
        this.announce(['THE NIGHT DECLINES TO NOTICE', 'YOU FEEL MARGINALLY MIGHTIER ANYWAY']);
        break;
      case 'shake':
        this.announce(['FIRM. RELIABLE. THE ONLY HAND YOU CAN COUNT ON']);
        break;
      // INT
      case 'memories':
        this.announce(['YOU GET TO FOUR AND LOSE THE THREAD', 'ONE OF THEM IS TEETH-SHAPED NOW']);
        break;
      case 'math':
        this.announce([`STR TIMES TEN PLUS CON TIMES TWENTY IS ${this.carryCapacity()}`, 'CORRECT. NOBODY CLAPS']);
        break;
      case 'home':
        this.announce([`HOME IS STILL TO THE ${this.homeCompass()}`, 'THINKING DID NOT MOVE IT']);
        break;
      // WIS
      case 'night':
        this.announce(['THE NIGHT SAYS WHAT IT ALWAYS SAYS', 'NOTHING. BEAUTIFULLY']);
        break;
      case 'moon':
        this.announce(['THE MOON DEFERS TO YOUR JUDGMENT', 'TYPICAL']);
        break;
      case 'sit': {
        if (this.spells.length && this.slots[1] < this.maxSlots(1)) {
          this.slots[1] += 1;
          this.announce(['NOTHING IMPROVES. IT HELPS ANYWAY (+1 SLOT)']);
        } else {
          this.announce(['NOTHING IMPROVES. IT HELPS ANYWAY']);
        }
        break;
      }
      // DEX
      case 'juggle':
        this.announce(['FLAWLESS. ZERO OBJECTS, ZERO DROPS']);
        break;
      case 'dodge':
        this.announce(['YOU SLIP LEFT. THE NOTHING MISSES', 'GOOD FORM. THE STAT KEEPS WAITING']);
        break;
      case 'laces':
        this.announce(['DOUBLE-KNOTTED. AT LEAST SOMETHING HOLDS']);
        break;
      // CON
      case 'breath':
        this.announce(['FORTY SECONDS. THE NIGHT HOLDS ITS LONGER']);
        break;
      case 'thump':
        this.emit('bonk');
        this.announce(['THE HEART KNOCKS BACK: OCCUPIED']);
        break;
      case 'weigh':
        this.announce([`${this.carriedWeight()} LBS OF EVERYTHING YOU OWN`, 'THE NIGHT WEIGHS EXTRA. IT IS NOT COUNTED']);
        break;
      // CHA
      case 'smile':
        this.announce(['YOU SMILE AT THE DARK', 'THE DARK IS POLITE ABOUT IT']);
        break;
      case 'wave':
        this.announce(['NOTHING WAVES BACK. RUDE, BUT CONSISTENT']);
        break;
      case 'dog':
        if (this.together) {
          this.hearts.push({ x: this.dog.x, y: this.dog.y - 18, t: HEART_TTL });
          this.announce(['HE ALREADY KNEW. HE TAKES IT WELL ANYWAY']);
        } else {
          this.announce(['YOU SAY IT TO THE NIGHT, FOR PRACTICE', 'THE WORDS KEEP']);
        }
        break;
      // BONE
      case 'polish-bone':
        this.announce(['IT GLEAMS LIKE A SMALL MOON WITH A JOB']);
        break;
      case 'name-bone':
        if (!this.boneNamed) {
          this.boneNamed = true;
          this.announce(['YOU NAME IT. THE NAME STAYS BETWEEN YOU TWO']);
        } else {
          this.announce(['IT HAS A NAME. YOU BOTH KNOW IT']);
        }
        break;
      case 'knock':
        this.emit('bonk');
        this.announce(['KNOCK KNOCK. THE TREES KEEP THEIR DOORS SHUT']);
        break;
      // MEAT
      case 'smell':
        this.emit('eat');
        this.announce(['STILL GOOD. THE NIGHT PRESERVES WHAT IT LIKES']);
        break;
      // BALL
      case 'squeeze':
        this.emit('squeak');
        this.announce(['ONE SQUEAK. SOMEWHERE, EARS ROTATE']);
        break;
      case 'bounce':
        this.announce(['IT COMES BACK TO YOUR HAND', 'LOYALTY, IN RUBBER']);
        break;
      // COINS
      case 'count-coins':
        this.announce([`STILL ${this.coins}. MATH HOLDS`, 'THE NIGHT ECONOMY IS STABLE']);
        break;
      case 'flip':
        this.emit('coin');
        this.announce([
          this.rng() < 0.5 ? 'HEADS. THE FACE IS NOBODY YOU KNOW' : 'TAILS. AN ANIMAL, MID-LEAP, WORN SMOOTH',
          'YOU CATCH IT. THE NIGHT WAS BETTING ON THE GROUND',
        ]);
        break;
      case 'jingle':
        this.emit('coin');
        this.announce(['A SMALL BRIGHT NOISE AGAINST A VERY LARGE DARK']);
        break;
      // WOOD
      case 'stack':
        this.announce(['YOU STACK THEM NEATLY. THEY LEAN ANYWAY', 'WOOD REMEMBERS BEING TREES. TREES LEAN']);
        break;
      case 'sniff-wood':
        this.announce(['CUT PINE AND COLD SAP', 'IT SMELLS LIKE A PLAN COMING TOGETHER']);
        break;
      case 'measure':
        this.announce(['YOU MEASURE TWICE', 'THE NUMBER HOLDS. CARPENTRY IS MOSTLY FAITH']);
        break;
      // AXE
      case 'hone':
        this.announce(['SHARP. SOMEBODY LOVED THIS TOOL', 'NOW SOMEBODY ELSE DOES']);
        break;
      case 'shoulder':
        this.announce(['YOU REST IT ON YOUR SHOULDER', 'FOR ONE WHOLE MINUTE YOU ARE A WOODCUT OF A PERSON']);
        break;
      case 'haft':
        this.announce(['INITIALS, CARVED SMALL, WORN SMOOTH', 'THE PREVIOUS OWNER LOVED SOMEBODY TOO']);
        break;
      // ROPE
      case 'coil':
        this.announce(['YOU COIL IT THE PROPER WAY', 'THE ROPE APPROVES. ROPES LOVE PROTOCOL']);
        break;
      case 'knot':
        this.announce(['A BOWLINE, ALMOST', 'THE RABBIT LEAVES THE HOLE AND FILES A COMPLAINT']);
        break;
      case 'tug':
        this.announce(['IT HOLDS', 'FIFTY USES LEFT. FIFTY-ONE IF YOU ARE SAD']);
        break;
      // MANUAL
      case 'chapter':
        this.announce(['CHAPTER TWO: FIND WOOD. THE BOOK IS NOT WRONG', `A BOAT WANTS ${BOAT_WOOD} PLANKS AND A ROPE`]);
        break;
      case 'pictures':
        this.announce(['THE PICTURES ARE HAND-DRAWN', 'THE BOAT IN THEM IS SMILING']);
        break;
      case 'margins':
        this.announce(['THE MARGINS SAY: SHE FLOATS. UNDERLINED TWICE', 'THE PEN WAS RUNNING OUT. THE FAITH WAS NOT']);
        break;
      // SWORD
      case 'hone-sword':
        this.announce(['THE EDGE IS TRUE', 'CORTIE OILED IT. YOU CAN TELL. IT SMELLS RESPONSIBLE']);
        break;
      case 'flourish':
        this.emit('chop');
        this.announce(['A CLEAN FIGURE-EIGHT. THE NIGHT APPLAUDS SILENTLY', 'YOU CHECK NOBODY SAW. SOMETHING SAW']);
        break;
      case 'sheathe':
        this.announce(['THE SLOW SHEATHE. THE COOLEST THING A PERSON CAN DO', 'THE DOG WAGS ONCE, OBJECTIVELY CORRECT']);
        break;
      // WAND
      case 'point-wand':
        this.triggerGlitch(0.25);
        this.announce(['YOU POINT IT AT A TREE. THE TREE STIFFENS', 'POWER IS MOSTLY AIM, PLUS RESTRAINT']);
        break;
      case 'listen-wand':
        this.announce(['IT HUMS A NOTE JUST UNDER HEARING', 'YOUR TEETH AGREE IT IS THERE']);
        break;
      case 'warm-wand':
        this.announce(['IT WARMS LIKE A SMALL OPINIONATED STONE', 'IT LIKES YOU. PROBABLY']);
        break;
      // SCROLLS
      case 'riffle':
        this.announce(['THEY RUSTLE LIKE SMALL CONTAINED WEATHER', 'ONE OF THEM HUMS YOUR NAME. YOU PUT IT DOWN']);
        break;
      // LAMP (carried)
      case 'polish-lamp':
        this.polishedLamps.add('lamp:carried');
        this.triggerGlitch(0.3);
        this.announce(['THE BRASS COMES UP LIKE A SMALL DROWNED SUN', 'SOMETHING INSIDE SHIFTS ITS WEIGHT']);
        break;
      case 'ear-lamp':
        this.emit('whimper');
        this.announce(['INSIDE: SNORING. FAINT, ANCIENT, CONTENT']);
        break;
      case 'heft-lamp':
        this.announce([`${WEIGHT.lamp} LBS OF BRASS AND SOMEBODY'S PATIENCE`]);
        break;
      case 'shine-lamp':
        this.announce(['YOUR REFLECTION, STRETCHED THIN AND GOLD', 'IT WAVES FIRST. YOU LET IT HAVE THAT']);
        break;
      // PIPE (carried)
      case 'sniff-pipe':
        this.announce(['IT SMELLS LIKE REGRET AND LAWN CLIPPINGS']);
        break;
      case 'tap-pipe':
        this.triggerGlitch(0.25);
        this.announce(['THE ASH MAKES ONE SMALL GRAY GHOST AND JOINS THE NIGHT']);
        break;
      case 'twirl-pipe':
        this.announce(['A CLEAN TWIRL. SOMEWHERE, A CASE CLOSES']);
        break;
      // BOAT
      case 'pat':
        this.announce(['YOU PAT THE HULL. A GOOD HOLLOW SOUND', 'SHE FLOATS. SOMEHOW, SHE FLOATS']);
        break;
      case 'leaks':
        this.announce(['NO LEAKS', 'THE MANUAL LOOKS SMUG FROM YOUR POCKET']);
        break;
      case 'christen':
        if (!this.boatNamed) {
          this.boatNamed = true;
          this.announce(['YOU NAME HER AFTER THE DOG', 'THE DOG, ASKED, APPROVES']);
        } else {
          this.announce(['SHE HAS A NAME. IT SUITS HER']);
        }
        break;
      default:
        break;
    }
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
        ...(this.coins > 0 ? [{ id: 'coins', label: 'COINS', icon: 'coin' }] : []),
        ...(this.wood > 0 ? [{ id: 'wood', label: 'WOOD', icon: 'wood' }] : []),
        ...(this.hasAxe ? [{ id: 'axe', label: 'AXE', icon: 'axe' }] : []),
        ...(this.hasRope ? [{ id: 'rope', label: 'ROPE', icon: 'rope' }] : []),
        ...(this.hasManual ? [{ id: 'manual', label: 'MANUAL', icon: 'manual' }] : []),
        ...(this.hasBoat ? [{ id: 'boat', label: 'BOAT', icon: 'boat' }] : []),
        ...(this.hasSword ? [{ id: 'sword', label: 'SWORD', icon: 'sword' }] : []),
        ...(this.hasWand ? [{ id: 'wand', label: 'WAND', icon: 'wand' }] : []),
        ...(Object.values(this.scrolls).some((n) => n > 0)
          ? [{ id: 'scrolls-item', label: 'SCROLLS', icon: 'scroll' }]
          : []),
        ...(this.hasLamp ? [{ id: 'lamp', label: 'LAMP', icon: 'lamp' }] : []),
        ...(this.hasPipe ? [{ id: 'pipe', label: 'PIPE', icon: 'pipe' }] : []),
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
    // The economy's conditional verbs: an axe wants a tree in reach; a boat
    // wants its bill of materials and a shoreline.
    const p = this.person;
    const treeNear =
      this.location === 'world' &&
      this.world.treesInRect(p.x - ENCOUNTER_RADIUS, p.y - ENCOUNTER_RADIUS, ENCOUNTER_RADIUS * 2, ENCOUNTER_RADIUS * 2)
        .length > 0;
    const shoreNear =
      this.location === 'world' &&
      (this.swimming ||
        isWater(this.world.seed, p.x + 30, p.y) ||
        isWater(this.world.seed, p.x - 30, p.y) ||
        isWater(this.world.seed, p.x, p.y + 30) ||
        isWater(this.world.seed, p.x, p.y - 30));
    const canBuild =
      !this.hasBoat && this.wood >= BOAT_WOOD && this.hasRope && this.hasManual && shoreNear;
    const DETAILS = {
      str: {
        title: 'STRENGTH',
        body: [...statBody('str'), `FISTS DEAL ${this.fistDamage()} DMG`, `THE BONE DEALS ${this.boneDamage()}`],
        options: [
          ...(person ? [{ id: 'punch', label: 'PUNCH SOMETHING' }] : []),
          { id: 'knuckles', label: 'CRACK YOUR KNUCKLES' },
          { id: 'flex', label: 'FLEX AT NO ONE' },
          { id: 'shake', label: 'SHAKE YOUR OWN HAND' },
        ],
      },
      int: {
        title: 'INTELLIGENCE',
        body: [...statBody('int'), 'SEARCHING DUMPSTERS IS DC 10', 'ZOMBIES FIND IT DELICIOUS'],
        options: [
          { id: 'memories', label: 'COUNT YOUR MEMORIES' },
          { id: 'math', label: 'DO SOME MATH' },
          { id: 'home', label: 'THINK ABOUT HOME' },
        ],
      },
      wis: {
        title: 'WISDOM',
        body: [
          ...statBody('wis'),
          'THE PIPE ANSWERS TO IT (DC 15)',
          ...(this.drunk > 0 ? ['+2 WHILE THE COLORS LEAN IN'] : []),
        ],
        options: [
          { id: 'night', label: 'LISTEN TO THE NIGHT' },
          { id: 'moon', label: 'CONSULT THE MOON' },
          { id: 'sit', label: 'SIT WITH IT A MOMENT' },
        ],
      },
      dex: {
        title: 'DEXTERITY',
        body: [...statBody('dex'), `DIRT IN THE EYES IS DC ${DC_DIRT}`, 'IT WAITED. NOW IT WORKS'],
        options: [
          { id: 'juggle', label: 'JUGGLE NOTHING' },
          { id: 'dodge', label: 'DODGE AN IMAGINED BITE' },
          { id: 'laces', label: 'CHECK YOUR LACES' },
        ],
      },
      con: {
        title: 'CONSTITUTION',
        body: [...statBody('con'), 'CARRY: STR X 10 + CON X 20', `= ${this.carryCapacity()} LBS`],
        options: [
          { id: 'breath', label: 'HOLD YOUR BREATH' },
          { id: 'thump', label: 'THUMP YOUR CHEST ONCE' },
          { id: 'weigh', label: 'WEIGH YOUR LOAD' },
        ],
      },
      cha: {
        title: 'CHARISMA',
        body: [...statBody('cha'), 'GENIES ANSWER TO CHARM (DC 12)'],
        options: [
          { id: 'smile', label: 'PRACTICE YOUR SMILE' },
          { id: 'wave', label: 'WAVE AT NOTHING' },
          { id: 'dog', label: 'COMPLIMENT THE DOG' },
        ],
      },
      bone: {
        title: this.boneNamed ? 'THE BONE (IT HAS A NAME)' : 'THE BONE',
        body: [`A GOOD CLUB: DC 9, ${this.boneDamage()} DMG`, `WEIGHS ${BONE_WEIGHT} LBS`],
        options: [
          ...(person ? [{ id: 'swing', label: 'SWING THE BONE' }] : []),
          { id: 'polish-bone', label: 'POLISH THE BONE' },
          { id: 'name-bone', label: 'NAME THE BONE' },
          { id: 'knock', label: 'KNOCK ON WOOD' },
        ],
      },
      meat: {
        title: 'MEAT ON THE BONE',
        body: [
          this.meatNibbled ? 'HALF A SERVING LEFT. STILL GOOD' : 'GNAW FOR +2 HP. ONE SERVING',
          `WEIGHS ${MEAT_WEIGHT} LBS`,
        ],
        options: [
          { id: 'eat', label: `GNAW IT ALL (+${this.meatNibbled ? 1 : 2} HP)` },
          { id: 'nibble', label: 'JUST A NIBBLE (+1 HP)' },
          { id: 'smell', label: 'SMELL IT AGAIN' },
        ],
      },
      ball: {
        title: 'THE PINK BALL',
        body: ['FETCH MENDS THE HEART (+1 HP)'],
        options: [
          { id: 'throw', label: 'THROW THE BALL' },
          { id: 'squeeze', label: 'GIVE IT A SQUEEZE' },
          { id: 'bounce', label: 'BOUNCE IT ONCE' },
        ],
      },
      coins: {
        title: 'COINS',
        body: [`${this.coins} IN THE POCKET`, 'PIRTS TAKES THEM. SO DO SHRINES AND CANDLES'],
        options: [
          { id: 'count-coins', label: 'COUNT THEM AGAIN' },
          { id: 'flip', label: 'FLIP ONE' },
          { id: 'jingle', label: 'JINGLE THEM' },
        ],
      },
      wood: {
        title: 'PLANKS',
        body: [`${this.wood} OF THE ${BOAT_WOOD} A BOAT WANTS`, `EACH WEIGHS ${WEIGHT.wood} LB`],
        options: [
          ...(canBuild ? [{ id: 'build', label: 'BUILD THE BOAT' }] : []),
          { id: 'stack', label: 'STACK THEM NEATLY' },
          { id: 'sniff-wood', label: 'SMELL THE CUT' },
          { id: 'measure', label: 'MEASURE TWICE' },
        ],
      },
      axe: {
        title: 'THE AXE',
        body: [`SWINGS AT DC ${DC_AXE}, ${this.fistDamage() + 2} DMG`, `CHOPS TREES. WEIGHS ${WEIGHT.axe} LBS`],
        options: [
          ...(person && treeNear ? [{ id: 'chop', label: 'CHOP A TREE' }] : []),
          ...(person ? [{ id: 'swing-axe', label: 'SWING THE AXE' }] : []),
          { id: 'hone', label: 'TEST THE EDGE' },
          { id: 'shoulder', label: 'REST IT ON YOUR SHOULDER' },
          { id: 'haft', label: 'CHECK THE HAFT' },
        ],
      },
      rope: {
        title: 'THE ROPE',
        body: ['FIFTY USES. FIFTY-ONE IF YOU ARE SAD', `A BOAT WANTS IT. WEIGHS ${WEIGHT.rope} LBS`],
        options: [
          { id: 'coil', label: 'COIL IT PROPERLY' },
          { id: 'knot', label: 'PRACTICE A KNOT' },
          { id: 'tug', label: 'TUG IT, TESTING' },
        ],
      },
      manual: {
        title: 'HOW TO BUILD A BOAT',
        body: ['GHOST-PRESS EDITION', `A BOAT: ${BOAT_WOOD} PLANKS, THE ROPE, AND WANTING TO BE ELSEWHERE`],
        options: [
          ...(canBuild ? [{ id: 'build', label: 'BUILD THE BOAT' }] : []),
          { id: 'chapter', label: 'READ CHAPTER TWO' },
          { id: 'pictures', label: 'SKIP TO THE PICTURES' },
          { id: 'margins', label: 'READ THE MARGIN NOTES' },
        ],
      },
      boat: {
        title: this.boatNamed ? 'THE BOAT (SHE HAS A NAME)' : 'THE BOAT',
        body: ['YOURS. BUILT BY HAND FROM A GHOST-PRESS BOOK', 'SHE SAILS WHEREVER YOU SWIM'],
        options: [
          { id: 'pat', label: 'PAT THE HULL' },
          { id: 'leaks', label: 'CHECK FOR LEAKS' },
          { id: 'christen', label: 'NAME HER' },
        ],
      },
      sword: {
        title: 'THE SWORD',
        body: [`SWINGS AT DC ${DC_BONE}, ${this.fistDamage() + 3} DMG`, "CORTIE'S HONEST STEEL"],
        options: [
          ...(person ? [{ id: 'swing-sword', label: 'SWING THE SWORD' }] : []),
          { id: 'hone-sword', label: 'CHECK THE EDGE' },
          { id: 'flourish', label: 'TRY A FLOURISH' },
          { id: 'sheathe', label: 'SHEATHE IT, SLOWLY' },
        ],
      },
      wand: {
        title: 'THE WAND',
        body: [`FLICKS AT DC ${DC_WAND} (INT), ${2 + Math.max(0, this.mod('int'))} DMG`, 'POINT IT AWAY FROM THE HAT'],
        options: [
          ...(person ? [{ id: 'flick-wand', label: 'FLICK THE WAND' }] : []),
          { id: 'point-wand', label: 'POINT IT AT THINGS' },
          { id: 'listen-wand', label: 'LISTEN TO IT HUM' },
          { id: 'warm-wand', label: 'WARM IT IN YOUR PALM' },
        ],
      },
      'scrolls-item': {
        title: 'SCROLLS',
        body: [
          ...Object.entries(this.scrolls)
            .filter(([, n]) => n > 0)
            .map(([sid, n]) => {
              const spec = SPELLS.find((sp) => sp.id === sid);
              return `${spec.name} (L${spec.level}) X${n}`;
            }),
          `PAGES ${this.paper}${this.hasBook ? ' + THE BOOK' : ''}`,
        ],
        options: [
          ...Object.entries(this.scrolls)
            .filter(([, n]) => n > 0)
            .flatMap(([sid]) => {
              const spec = SPELLS.find((sp) => sp.id === sid);
              return [
                { id: `cast-${sid}`, label: `CAST ${spec.name} (FREE)` },
                { id: `inscribe-${sid}`, label: `INSCRIBE ${spec.name}` },
              ];
            }),
          { id: 'riffle', label: 'RIFFLE THROUGH THEM' },
        ],
      },
      lamp: {
        title: this.encounterDone.has('lamp:carried') ? 'THE LAMP, QUIET NOW' : 'THE LAMP',
        body: [
          this.encounterDone.has('lamp:carried')
            ? 'THE WISH IS SPENT. THE BRASS REMEMBERS'
            : 'SOMETHING IN THERE SLEEPS LIGHTLY',
          `WEIGHS ${WEIGHT.lamp} LBS`,
        ],
        options: [
          ...(this.encounterDone.has('lamp:carried')
            ? []
            : [
                { id: 'rub-lamp', label: 'RUB THE LAMP' },
                { id: 'polish-lamp', label: 'POLISH IT' },
              ]),
          { id: 'ear-lamp', label: 'HOLD IT TO YOUR EAR' },
          { id: 'heft-lamp', label: 'FEEL ITS HEFT' },
          { id: 'shine-lamp', label: 'ADMIRE YOUR REFLECTION' },
        ],
      },
      pipe: {
        title: this.pipeSpent ? 'THE PIPE, SPENT' : 'THE PIPE',
        body: [
          this.pipeSpent ? 'ONE BOWL. IT WAS A GOOD BOWL' : 'ONE BOWL LEFT OF THE GREEN LEAF',
          `WEIGHS ${WEIGHT.pipe} LB`,
        ],
        options: [
          ...(this.pipeSpent ? [] : [{ id: 'smoke-pipe', label: 'SMOKE THE PIPE' }]),
          { id: 'sniff-pipe', label: 'SNIFF IT' },
          { id: 'tap-pipe', label: 'TAP OUT THE ASH' },
          { id: 'twirl-pipe', label: 'TWIRL IT, DETECTIVE-STYLE' },
        ],
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
      id === 'fists'
        ? 'YOU PUNCH AT THE DARK. IT DOES NOT MIND'
        : id === 'axe'
          ? 'YOU AXE THE DARK. THE DARK FORGIVES THE PUN'
          : 'YOU SWING AT THE DARK. IT DOES NOT MIND',
    ]);
  }

  // --- Magic ---------------------------------------------------------------

  /**
   * Spell slots per level (v0.21): the mind sets the shelf. Level 1 leans
   * on INT, level 2 on WIS, level 3 on CHA. The island's calm adds a first-
   * level slot, always.
   */
  maxSlots(level) {
    const base =
      level === 1
        ? Math.max(1, 2 + this.mod('int')) + (this.islandBlessed ? 1 : 0)
        : level === 2
          ? Math.max(0, 1 + this.mod('wis'))
          : Math.max(0, this.mod('cha'));
    return base;
  }

  /** A rest — a bed, a warm stove, the ragas, God — returns every slot. */
  rest() {
    for (const lv of SLOT_LEVELS) this.slots[lv] = this.maxSlots(lv);
    this.breathed = false;
    if (this.spells.length) this.say('YOUR SLOTS RETURN, EVERY LEVEL OF THEM');
  }

  /** Cast straight off a scroll: free, once, and the scroll burns. */
  castScroll(id) {
    if (!(this.scrolls[id] > 0)) return;
    this.scrolls[id] -= 1;
    this.emit('spell-cast');
    this.say('THE SCROLL BURNS AS IT SPEAKS');
    this.castSpellEffect(id);
    if (this.mode === 'turn') this.endPlayerTurn();
  }

  /**
   * Inscribe a scroll: spend a page (or use the book) and the scroll, and
   * the spell joins your list forever.
   */
  inscribeScroll(id) {
    if (!(this.scrolls[id] > 0)) return;
    const spec = SPELLS.find((sp) => sp.id === id);
    if (this.spells.includes(id)) {
      this.announce([`YOU KNOW ${spec.name}. THE SCROLL SIGHS, UNBURNT`]);
      return;
    }
    if (this.paper > 0) this.paper -= 1;
    else if (!this.hasBook) {
      this.announce(['NOTHING TO INSCRIBE ONTO', 'QUEEBEE SELLS PAGES. AND THE BOOK']);
      return;
    }
    this.scrolls[id] -= 1;
    this.spells.push(id);
    this.emit('spell-learn');
    this.triggerGlitch(0.5);
    this.announce([
      `YOU INSCRIBE ${spec.name}, LETTER BY BURNING LETTER`,
      'THE INK SETS. THE SPELL IS YOURS FOREVER',
    ]);
  }

  /** A vision teaches the next spell in the book (if any are left). */
  learnSpell() {
    // The leaf teaches its own book, never Queebee's scroll-spells.
    const next = SPELLS.find((s) => !s.scroll && !this.spells.includes(s.id));
    if (!next) {
      this.say('THE LEAF HAS NOTHING LEFT TO TEACH');
      return;
    }
    this.spells.push(next.id);
    this.rest(); // a vision is a rest for the mind
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
      title: `SLOTS  L1 ${this.slots[1]}/${this.maxSlots(1)}  L2 ${this.slots[2]}/${this.maxSlots(2)}  L3 ${this.slots[3]}/${this.maxSlots(3)}`,
      body: SPELLS.filter((s) => this.spells.includes(s.id)).map((s) => `${s.name}: ${s.blurb}`),
      options: [
        ...SPELLS.filter((s) => this.spells.includes(s.id)).map((s) => ({
          id: s.id,
          label: `${s.name} (L${s.level})`,
        })),
        { id: 'breathe', label: 'JUST BREATHE (0)' },
        { id: 'hum', label: 'HUM THE WORDS (0)' },
        { id: 'back', label: 'BACK' },
      ],
    });
  }

  /**
   * Cast a known spell by spending a slot of its level (or the next level
   * up, burning bright). Costs your turn in battle.
   */
  castSpell(id) {
    const spell = SPELLS.find((s) => s.id === id);
    if (!spell || !this.spells.includes(id)) return;
    const lv = SLOT_LEVELS.find((l) => l >= spell.level && this.slots[l] > 0);
    if (!lv) {
      this.emit('spell-fail');
      this.announce([`NO LEVEL ${spell.level} SLOT LEFT. REST, SOMEWHERE KIND`]);
      if (this.mode === 'turn') this.endPlayerTurn();
      return;
    }
    this.slots[lv] -= 1;
    this.castSpellEffect(id);
    // Queued after the effect's announce, or that would wipe it.
    if (lv > spell.level) this.say('A BIGGER SLOT BURNS FOR A SMALLER SPELL');
    if (this.mode === 'turn') this.endPlayerTurn();
  }

  /** The spell's actual effect — shared by slot casts and scroll casts. */
  castSpellEffect(id) {
    this.triggerGlitch(0.35);
    if (id === 'ember') {
      this.emit('spell-cast');
      const target = this.nearestFoe();
      if (!target) {
        this.announce(['EMBER BLOOMS AND FINDS NOTHING TO BURN']);
      } else {
        const spec = FOES[target.kind];
        const left = (this.zombieHp.get(target.key) ?? spec.hp) - 3;
        if (left <= 0) {
          this.encounterDone.add(target.key);
          this.zombieHp.delete(target.key);
          this.emit('vanish');
          this.announce([
            target.kind === 'minotaur'
              ? 'EMBER TAKES HIM. THE MAZE BURNS DOWN TO ONE BRIGHT DOOR'
              : target.kind === 'ghost'
                ? 'EMBER TAKES IT. THE STATIC RESOLVES TO QUIET'
                : 'EMBER TAKES IT. THE ZOMBIE GOES OUT LIKE A CANDLE',
          ]);
          this.gainXp(spec.xp);
        } else {
          this.zombieHp.set(target.key, left);
          this.announce([`EMBER BITES. ${spec.name} BURNS AND KEEPS COMING`]);
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
    } else if (id === 'bolt') {
      this.emit('spell-cast');
      const target = this.nearestFoe();
      const dmg = 2 + Math.max(0, this.mod('int'));
      if (!target) {
        this.announce(['THE BOLT CRACKS INTO THE DARK AND FINDS NOTHING']);
      } else {
        this.dealSpellDamage(target, dmg, {
          kills: 'THE BOLT TAKES IT. THE AIR SMELLS OF VIOLETS AND OZONE',
          hurts: `THE BOLT BITES (${dmg}). IT KEEPS COMING`,
        });
      }
    } else if (id === 'mend') {
      this.emit('heal');
      this.heal(2);
      this.hearts.push({ x: this.person.x, y: this.person.y - 30, t: 1.6 });
      this.announce(['SMALL STITCHES OF LIGHT (+2 HP)']);
    } else if (id === 'shield') {
      this.warded = true;
      this.shielded = true; // the second bite too
      this.emit('ward');
      this.announce(['A SHIELD SETTLES OVER YOU, PATIENT AS PLATE']);
    } else if (id === 'starfall') {
      this.emit('spell-cast');
      this.triggerGlitch(0.8);
      const foes = this.hostilesNear(ENCOUNTER_RADIUS);
      if (!foes.length) {
        this.announce(['THE SKY LEANS IN, FINDS NOBODY, AND STRAIGHTENS UP']);
      } else {
        this.announce(['THE SKY LEANS IN']);
        for (const f of foes) {
          this.dealSpellDamage(f, 4, {
            kills: `${FOES[f.kind].name} GOES OUT UNDER THE STARS`,
            hurts: `${FOES[f.kind].name} STAGGERS UNDER THE FALL`,
          });
        }
      }
    }
  }

  /** Spell damage against one foe: shared kill/stagger bookkeeping. */
  dealSpellDamage(target, dmg, lines) {
    const spec = FOES[target.kind];
    const left = (this.zombieHp.get(target.key) ?? spec.hp) - dmg;
    if (left <= 0) {
      this.encounterDone.add(target.key);
      this.zombieHp.delete(target.key);
      this.emit('vanish');
      this.announce([lines.kills]);
      this.gainXp(spec.xp);
    } else {
      this.zombieHp.set(target.key, left);
      this.announce([lines.hurts]);
    }
  }

  // --- Turn-based combat ---------------------------------------------------

  /** Where a chasing zombie stands now: its post plus its hungry drift. */
  zombiePos(z) {
    const o = this.foeOffsets.get(`z:${z.x},${z.y}`);
    return { x: z.x + (o?.dx ?? 0), y: z.y + (o?.dy ?? 0) };
  }

  /** Free-mode pursuit: zombies in lock range drift toward the person. */
  chaseZombies(dt) {
    const p = this.person;
    const R = ZOMBIE_LOCK + ZOMBIE_LEASH;
    for (const z of this.world.zombiesInRect(p.x - R, p.y - R, R * 2, R * 2)) {
      const key = `z:${z.x},${z.y}`;
      if (this.encounterDone.has(key)) continue;
      const pos = this.zombiePos(z);
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d > ZOMBIE_LOCK || d < 14) continue; // unnoticed, or already breathing on you
      const o = this.foeOffsets.get(key) ?? { dx: 0, dy: 0 };
      const step = ZOMBIE_SPEED * dt;
      o.dx += (dx / d) * step;
      o.dy += (dy / d) * step;
      const len = Math.hypot(o.dx, o.dy);
      if (len > ZOMBIE_LEASH) {
        o.dx *= ZOMBIE_LEASH / len;
        o.dy *= ZOMBIE_LEASH / len;
      }
      this.foeOffsets.set(key, o);
    }
  }

  /** Hostiles within a radius of the person: {kind, key, x, y, d}. */
  hostilesNear(radius) {
    if (this.location !== 'world') return [];
    const p = this.person;
    const out = [];
    const consider = (kind, key, x, y) => {
      if (this.encounterDone.has(key)) return;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d <= radius) out.push({ kind, key, x, y, d });
    };
    if (this.plane === 'heaven') {
      // Angels do not bite. The minotaur is the one red exception: he paces
      // the maze of his life, and if you cross his pacing, he notices.
      for (const m of this.world.minotaursInRect(p.x - radius - MINOTAUR_RANGE, p.y - radius - MINOTAUR_RANGE, (radius + MINOTAUR_RANGE) * 2, (radius + MINOTAUR_RANGE) * 2)) {
        const pos = minotaurPos(m, this.time);
        consider('minotaur', `mi:${m.x},${m.y}`, pos.x, pos.y);
      }
      return out;
    }
    for (const z of this.world.zombiesInRect(p.x - radius - ZOMBIE_LEASH, p.y - radius - ZOMBIE_LEASH, (radius + ZOMBIE_LEASH) * 2, (radius + ZOMBIE_LEASH) * 2)) {
      const pos = this.zombiePos(z);
      consider('zombie', `z:${z.x},${z.y}`, pos.x, pos.y);
    }
    for (const g of this.world.ghostsInRect(p.x - radius - 40, p.y - radius - 40, (radius + 40) * 2, (radius + 40) * 2)) {
      if (g.temper !== 'hostile') continue;
      const pos = ghostPos(g, this.time);
      consider('ghost', `gh:${g.x},${g.y}`, pos.x, pos.y);
    }
    return out;
  }

  /** The closest living hostile ({kind, key, x, y, d}), or null. */
  nearestFoe() {
    let best = null;
    for (const f of this.hostilesNear(BATTLE_LEAVE)) {
      if (!best || f.d < best.d) best = f;
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
    this.battleFoes = foes.map((f) => f.key);
    this.clearMoveTarget();
    this.emit(foes.some((f) => f.kind === 'minotaur') ? 'bellow' : 'battle-start');
    this.triggerGlitch(0.5);
    const lead = foes[0]?.kind;
    const line =
      lead === 'minotaur'
        ? 'SOMETHING RED IS PACING THIS WAY'
        : lead === 'ghost'
          ? 'THE STATIC HAS TEETH'
          : 'SOMETHING IS CLOSE';
    this.announce([line, 'TURN-BASED: ONE MOVE, ONE ACTION']);
  }

  endBattle(line = 'THE WOODS LET GO. YOU MOVE FREELY AGAIN') {
    this.mode = 'free';
    this.turn = 'you';
    this.battleFoes = [];
    this.warded = false;
    this.shielded = false;
    this.dazed = false; // thrown dirt does not carry to the next fight
    this.emit('battle-end');
    this.say(line);
  }

  /** The battle action menu — your one action for the turn, per foe. */
  openBattleMenu() {
    const foe = this.nearestFoe();
    const kind = foe?.kind ?? 'zombie';
    const inReach = foe && foe.d <= ENCOUNTER_RADIUS;
    const TITLES = {
      zombie: inReach ? 'A ZOMBIE IS ON YOU' : 'IT SHAMBLES CLOSER',
      ghost: inReach ? 'THE GHOST GLITCHES THROUGH YOU' : 'IT MOSHES CLOSER',
      minotaur: inReach ? 'THE MINOTAUR TOWERS OVER YOU' : 'HE PACES CLOSER, HORNS LOW',
    };
    this.openChoice({
      kind: 'battle',
      key: 'battle',
      x: this.person.x,
      y: this.person.y,
      title: TITLES[kind],
      options: [
        // The first round still lets you try the friendly thing.
        ...(this.round <= 1 ? [{ id: 'befriend', label: 'TRY TO BEFRIEND IT' }] : []),
        // The minotaur can be TALKED past — he is lost, not evil.
        ...(kind === 'minotaur' ? [{ id: 'maze', label: 'ASK ABOUT THE MAZE' }] : []),
        ...(kind === 'minotaur' ? [{ id: 'directions', label: 'OFFER DIRECTIONS' }] : []),
        ...(inReach ? [{ id: 'fists', label: 'ATTACK WITH FISTS' }] : []),
        ...(inReach && this.hasBone ? [{ id: 'bone', label: 'SWING THE BONE' }] : []),
        ...(inReach && this.hasAxe ? [{ id: 'axe', label: 'SWING THE AXE' }] : []),
        ...(inReach && this.hasSword ? [{ id: 'sword', label: 'SWING THE SWORD' }] : []),
        ...(inReach && this.hasWand ? [{ id: 'wand', label: 'FLICK THE WAND' }] : []),
        ...(this.spells.length ? [{ id: 'cast', label: 'CAST A SPELL' }] : []),
        { id: 'taunt', label: 'SHOUT SOMETHING BRAVE' },
        { id: 'dirt', label: 'THROW DIRT IN ITS EYES' },
        { id: 'study', label: 'STUDY ITS MOVEMENTS' },
        { id: 'wait', label: 'HOLD YOUR GROUND' },
      ],
    });
  }

  /** Your action is spent — the hostiles answer, then it's your move again. */
  endPlayerTurn() {
    if (this.mode !== 'turn') return;
    this.turn = 'foes';
    // The hungry close the distance on their turn (v0.21).
    if (this.plane !== 'heaven') {
      for (const foe of this.hostilesNear(BATTLE_LEAVE)) {
        if (foe.kind !== 'zombie' || foe.d <= ENCOUNTER_RADIUS || foe.d < 1) continue;
        const o = this.foeOffsets.get(foe.key) ?? { dx: 0, dy: 0 };
        o.dx += ((this.person.x - foe.x) / foe.d) * ZOMBIE_STEP;
        o.dy += ((this.person.y - foe.y) / foe.d) * ZOMBIE_STEP;
        const len = Math.hypot(o.dx, o.dy);
        if (len > ZOMBIE_LEASH) {
          o.dx *= ZOMBIE_LEASH / len;
          o.dy *= ZOMBIE_LEASH / len;
        }
        this.foeOffsets.set(foe.key, o);
      }
    }
    const dazed = this.dazed;
    this.dazed = false; // dirt only buys the one round, spent or not
    for (const foe of this.hostilesNear(ENCOUNTER_RADIUS)) {
      if (dazed) break; // their answer goes wide
      if (this.warded) {
        if (this.shielded) this.shielded = false; // the shield holds for one more
        else this.warded = false;
        this.emit('ward');
        this.say('THE WARD TAKES THE BITE FOR YOU');
        continue;
      }
      const spec = FOES[foe.kind];
      this.emit(foe.kind === 'minotaur' ? 'bellow' : foe.kind === 'ghost' ? 'ghost' : 'zombie');
      const lethal = this.hp <= spec.dmg;
      this.damage(spec.dmg);
      if (foe.kind === 'ghost' && spec.steals && this.coins > 0) {
        this.coins -= spec.steals;
        this.say(`IT PASSES THROUGH YOU (-${spec.dmg} HP, -1 COIN)`);
      } else if (foe.kind === 'minotaur') {
        this.say(`THE HORNS FIND YOU (-${spec.dmg} HP)`);
      } else if (!lethal) {
        this.say(`IT BITES (-${spec.dmg} HP)`);
      }
      if (lethal) {
        this.stats.int = Math.max(1, this.stats.int - 1);
        this.announce([
          foe.kind === 'minotaur' ? 'THE MAZE GOES DARK A MOMENT (-1 INT)' : 'IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)',
          this.together ? 'THE DOG DRAGS YOU AWAY' : 'YOU WAKE ALONE, AND LIGHTER',
        ]);
      }
      break; // one bite per round; the woods are not that cruel
    }
    this.turn = 'you';
    this.round++;
    this.moveLeft = BATTLE_MOVE;
    this.emit('turn');
  }

  /** A named interior spot's menu (the detective, the altar, the pegs...). */
  openSpotMenu(kind, spot, key) {
    const MENUS = {
      'cortie-counter': {
        title: 'CORTIE LOOKS UP FROM A WHETSTONE',
        options: [
          { id: 'wares', label: 'SEE THE RACK' },
          { id: 'talk', label: 'TALK SHOP' },
          { id: 'town3', label: 'ASK ABOUT QUEUE TOWN' },
          { id: 'leave', label: 'LEAVE HIM TO THE EDGE' },
        ],
      },
      'queebee-counter': {
        title: 'QUEEBEE PEERS OVER HER SPECTACLES',
        options: [
          { id: 'wares', label: 'SEE THE SHELF' },
          { id: 'talk', label: 'TALK PAPER' },
          { id: 'inscribe-how', label: 'ASK ABOUT INSCRIBING' },
          { id: 'leave', label: 'LEAVE HER TO THE INK' },
        ],
      },
      weaponrack: {
        title: 'THE WEAPON RACK, STANDING AT ATTENTION',
        options: [
          { id: 'admire', label: 'ADMIRE THE STEEL' },
          { id: 'thumb', label: 'THUMB AN EDGE' },
          { id: 'count', label: 'COUNT THE WANDS' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      wandcase: {
        title: 'THE WAND CASE, GLINTING',
        options: [
          { id: 'peer', label: 'PEER THROUGH THE GLASS' },
          { id: 'tap-glass', label: 'TAP THE GLASS' },
          { id: 'reflect', label: 'CHECK YOUR REFLECTION' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      bookshelf: {
        title: 'A SHELF OF SPINES, ALL COLORS OF PLUM',
        options: [
          { id: 'browse', label: 'BROWSE THE SPINES' },
          { id: 'sniff-books', label: 'SMELL THE PAPER' },
          { id: 'straighten-b', label: 'STRAIGHTEN ONE' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      scrollrack: {
        title: 'PIGEONHOLES OF ROLLED THUNDER',
        options: [
          { id: 'peek', label: 'PEEK IN A HOLE' },
          { id: 'count-scrolls', label: 'COUNT THE EMPTIES' },
          { id: 'resist', label: 'RESIST UNROLLING ONE' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      inkdesk: {
        title: "QUEEBEE'S DESK. THE INK IS STILL WET",
        options: [
          { id: 'read-desk', label: 'READ THE OPEN PAGE' },
          { id: 'quill', label: 'ADMIRE THE QUILL' },
          { id: 'spill', label: 'WORRY ABOUT THE SPILL' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      detective: {
        title: 'THE DETECTIVE LOOKS UP FROM THE DEVIL FILE',
        options: [
          { id: 'case', label: 'ASK ABOUT THE CASE' },
          { id: 'tip', label: 'OFFER A TIP' },
          { id: 'work', label: 'ASK FOR WORK' },
          { id: 'town2', label: 'ASK ABOUT THE TOWN' },
          { id: 'leave', label: 'LEAVE HIM TO IT' },
        ],
      },
      corkboard: {
        title: 'THE CORKBOARD. RED STRING EVERYWHERE',
        options: [
          { id: 'strings', label: 'FOLLOW THE STRINGS' },
          { id: 'notes', label: 'READ THE NOTES' },
          { id: 'pin', label: 'ADD A PIN' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      altar: {
        title: 'THE ALTAR, WARM AS NOON',
        options: [
          { id: 'pray', label: 'PRAY' },
          { id: 'candle', label: 'LIGHT A CANDLE (1 COIN)' },
          { id: 'cloth', label: 'READ THE ALTAR CLOTH' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      pile: {
        title: 'THE PILE OF GOD, INDOORS AT LAST',
        options: [
          { id: 'gold', label: 'ADD TO THE PILE OF GOD' },
          { id: 'count', label: 'COUNT IT' },
          { id: 'warm', label: 'WARM YOUR HANDS ON THE SHINE' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      singer: {
        title: 'A SINGER, MID-RAGA, MID-FOREVER',
        options: [
          { id: 'listen', label: 'LISTEN' },
          { id: 'hum', label: 'HUM ALONG' },
          { id: 'name', label: "ASK THE MELODY'S NAME" },
          { id: 'step', label: 'LEAVE THEM TO IT' },
        ],
      },
      wallaxe: {
        title: this.hasAxe ? 'EMPTY PEGS ON THE WALL' : 'AN AXE HANGS ON THE WALL',
        options: [
          { id: 'take', label: this.hasAxe ? 'REMEMBER THE AXE' : 'TAKE THE AXE' },
          { id: 'edge', label: 'TEST THE EDGE' },
          { id: 'whose', label: 'ASK WHOSE IT WAS' },
          { id: 'step', label: 'LEAVE IT' },
        ],
      },
      stove: {
        title: 'A COLD STOVE WITH ONE WARM COAL',
        options: [
          { id: 'warm', label: 'WARM YOURSELF' },
          { id: 'grate', label: 'OPEN THE GRATE' },
          { id: 'kettle', label: 'TOUCH THE KETTLE' },
          { id: 'step', label: 'STEP BACK' },
        ],
      },
      telescope: {
        title: 'A BRASS TELESCOPE AIMED AT NOTHING',
        options: [
          { id: 'look', label: 'LOOK THROUGH IT' },
          { id: 'moon', label: 'AIM IT AT THE MOON' },
          { id: 'woods', label: 'AIM IT AT THE WOODS' },
          { id: 'step', label: 'STEP AWAY' },
        ],
      },
      portrait2: {
        title: 'ANOTHER PORTRAIT. SAME EYES',
        options: [
          { id: 'look', label: 'LOOK CLOSER' },
          { id: 'name', label: 'ASK ITS NAME' },
          { id: 'frame', label: 'STRAIGHTEN THE FRAME' },
          { id: 'away', label: 'LOOK AWAY' },
        ],
      },
      bed: {
        title: 'A BED NOBODY DIED IN. PROBABLY',
        options: [
          { id: 'lie', label: 'LIE DOWN A MOMENT' },
          { id: 'under', label: 'CHECK UNDER IT' },
          { id: 'covers', label: 'SMOOTH THE COVERS' },
          { id: 'step', label: 'LEAVE IT MADE' },
        ],
      },
    };
    const menu = MENUS[spot.id];
    if (!menu) return;
    this.openChoice({ kind: `spot:${spot.id}`, key, x: this.person.x, y: this.person.y, title: menu.title, options: menu.options });
    void kind;
  }

  /** Resolve an interior spot menu. Returns true when it handled the id. */
  resolveSpot(c, id) {
    const spot = c.kind.slice(5);
    if (spot === 'cortie-counter') {
      if (id === 'wares') this.openCortieBuy(c.key);
      else if (id === 'talk') {
        this.announce(['A BLADE WANTS STRENGTH. A WAND WANTS BRAINS', 'HE TAPS HIS TEMPLE, THEN THE WHETSTONE. BOTH, IDEALLY']);
      } else if (id === 'town3') {
        this.announce(['GRUMPY? THEY ARE WIZARDS, HE SAYS', 'WAITING IS THE WHOLE DISCIPLINE. THE TOWN IS NAMED FOR IT']);
      }
      return true;
    }
    if (spot === 'queebee-counter') {
      if (id === 'wares') this.openQueebeeBuy(c.key);
      else if (id === 'talk') {
        this.announce(['PAPER REMEMBERS WHAT MINDS FORGET, SHE SAYS', 'SHE UNDERLINES SOMETHING TWICE, FONDLY']);
      } else if (id === 'inscribe-how') {
        this.announce([
          'A SCROLL CASTS ONCE AND BURNS. OR:',
          'INSCRIBE IT — A PAGE (OR THE BOOK) MAKES IT YOURS FOREVER',
          'THE SPELL JOINS YOUR LIST. SLOTS APPLY AS EVER',
        ]);
      }
      return true;
    }
    if (spot === 'weaponrack') {
      if (id === 'admire') this.announce(['THE STEEL ADMIRES YOU BACK, COLDLY']);
      else if (id === 'thumb') this.announce(['SHARP. CORTIE CLEARS HIS THROAT, ONCE', 'YOU PUT YOUR THUMB AWAY']);
      else if (id === 'count') this.announce(['THREE WANDS, EACH PRETENDING TO BE ASLEEP']);
      return true;
    }
    if (spot === 'wandcase') {
      if (id === 'peer') this.announce(['THE WAND TIPS GLOW FAINTLY, LIKE BANKED COALS']);
      else if (id === 'tap-glass') {
        this.triggerGlitch(0.3);
        this.announce(['EVERY WAND POINTS AT YOU AT ONCE', 'THEN THEY PRETEND THEY DID NOT']);
      } else if (id === 'reflect') this.announce(['YOU, WARPED IN SHOP GLASS, AMONG LIGHTNING', 'IT SUITS YOU']);
      return true;
    }
    if (spot === 'bookshelf') {
      if (id === 'browse') this.announce(['TITLES IN LANGUAGES THAT DECLINE TO BE READ', 'ONE SPINE SAYS, SIMPLY: NO']);
      else if (id === 'sniff-books') this.announce(['DUST, INK, AND ONE CENTURY PER SHELF']);
      else if (id === 'straighten-b') this.announce(['YOU STRAIGHTEN ONE. THE SHELF SIGHS', 'QUEEBEE PRETENDS NOT TO BE PLEASED']);
      return true;
    }
    if (spot === 'scrollrack') {
      if (id === 'peek') this.announce(['ROLLED TIGHT, TIED IN VIOLET, HUMMING SMALL']);
      else if (id === 'count-scrolls') this.announce(['TWO PIGEONHOLES STAND EMPTY', 'SOMEBODY CAST FIRST AND PAID AFTER, QUEEBEE SAYS DARKLY']);
      else if (id === 'resist') this.announce(['YOU DO NOT UNROLL ONE', 'THE RESTRAINT IS NOTED SOMEWHERE']);
      return true;
    }
    if (spot === 'inkdesk') {
      if (id === 'read-desk') this.announce(['THE OPEN PAGE IS A LEDGER OF NAMES AND SPELLS', 'YOURS IS NOT IN IT. YET, SAYS THE HANDWRITING']);
      else if (id === 'quill') this.announce(['THE QUILL IS FROM NO BIRD YOU COULD NAME']);
      else if (id === 'spill') this.announce(['THE SPILL IS SHAPED LIKE A SMALL DOG', 'EVERYTHING GOOD IS, EVENTUALLY']);
      return true;
    }
    if (spot === 'detective') {
      if (id === 'case') {
        this.emit('typewriter');
        this.announce([
          'THE DEVIL SKIPPED BAIL, HE SAYS. BIG SURPRISE',
          'WHERE IN THE DEVIL IS THE DEVIL? THAT IS THE CASE',
          'EVERY LEAD BURNS. THAT IS USUALLY THE LEAD',
        ]);
      } else if (id === 'tip') {
        if (!this.tippedDetective) {
          this.tippedDetective = true;
          this.gainCoins(3);
          this.announce([
            'YOU MENTION THE MANSION. THE ATTIC LIGHT. NOBODY HOME',
            'HE WRITES IT DOWN SLOW, LIKE IT HURTS',
            'GOOD TIP, HE SAYS. THE DEVIL ALWAYS LIKED A VIEW',
          ]);
        } else {
          this.announce(['HE TAPS THE NOTEBOOK. ALREADY ON THE BOARD']);
        }
      } else if (id === 'work') {
        this.announce([
          'FIND ME ONE TRUE THING, HE SAYS',
          'A TOWN FULL OF GHOSTS AND NOT ONE WITNESS',
          'COME BACK WHEN YOU HAVE SEEN THE DEVIL. YOU WILL KNOW',
        ]);
      } else if (id === 'town2') {
        this.announce([
          'GOOD PEOPLE. THE BANK TOOK THE BUILDINGS. SOMETHING ELSE TOOK THE REST',
          'ONLY PIRTS STAYED OPEN. SAYS A LOT ABOUT PIRTS',
        ]);
      }
      return true;
    }
    if (spot === 'corkboard') {
      if (id === 'strings') this.announce(['EVERY STRING LEADS TO A CARD THAT SAYS HIM', 'ONE STRING LEADS TO A MIRROR. YOU DECIDE NOT TO ASK']);
      else if (id === 'notes') this.announce(['SIGHTING: THE ATTIC. SIGHTING: THE STATIC. SIGHTING: NONE', 'ONE NOTE JUST SAYS: CHECK HEAVEN? IN SHAKY PEN']);
      else if (id === 'pin') this.announce(['YOU PIN NOTHING TO NOTHING', 'IT HELPS']);
      return true;
    }
    if (spot === 'altar') {
      if (id === 'pray') {
        this.rest();
        this.emit('pray');
        this.announce(['YOU PRAY TO WHATEVER LISTENS. THE GOLD LISTENS', 'PRAYER IS A REST. EVERY SLOT RETURNS']);
      } else if (id === 'candle') {
        if (this.coins >= 1) {
          this.coins -= 1;
          this.heal(1);
          this.emit('blessing');
          this.announce(['ONE SMALL FLAME JOINS THE CHOIR (+1 HP)']);
        } else {
          this.announce(['NO COIN. THE CANDLES BURN FOR YOU ANYWAY, QUIETLY']);
        }
      } else if (id === 'cloth') {
        this.announce(['THE CLOTH IS EMBROIDERED WITH EVERY NAME', 'YOURS IS IN THERE. SPELLED THE WAY YOUR DOG WOULD SPELL IT']);
      }
      return true;
    }
    if (spot === 'pile') {
      if (id === 'gold') {
        this.emit('gold');
        this.goldGiven++;
        this.announce(['YOU ADD WHAT YOU CAN TO THE PILE OF GOD', 'THEY MELT IT IN. THE SPIRE CLIMBS ONE COURSE HIGHER']);
      } else if (id === 'count') {
        this.announce(['ONE, TWO, MANY, MORE', 'YOU LOSE COUNT AT GOD']);
      } else if (id === 'warm') {
        this.announce(['THE SHINE IS WARM AS A HAND ON YOUR BACK']);
      }
      return true;
    }
    if (spot === 'singer') {
      if (id === 'listen') {
        this.rest();
        this.emit('raga');
        this.announce(['THE MELODY PASSES THROUGH YOU LIKE WEATHER', 'THE MUSIC IS A REST. EVERY SLOT RETURNS']);
      } else if (id === 'hum') {
        this.emit('raga');
        this.announce(['YOU HUM. THE SINGER SMILES WITHOUT STOPPING', 'FOR FOUR NOTES, YOU ARE PART OF THE CHORD']);
      } else if (id === 'name') {
        this.announce(['IT IS YOUR NAME, SUNG SLOWLY', 'EVERYONE HEARS THEIR OWN']);
      }
      return true;
    }
    if (spot === 'wallaxe') {
      if (id === 'take') {
        if (this.hasAxe) {
          this.announce(['THE PEGS REMEMBER AN AXE', 'SO DO YOU. IT IS ON YOUR BACK']);
        } else {
          this.hasAxe = true;
          this.emit('chop');
          this.announce(['YOU TAKE THE AXE. THE PEGS EXHALE', 'SOMEWHERE, A TREE SHIVERS ON PRINCIPLE']);
        }
      } else if (id === 'edge') {
        this.announce(['SHARP. SOMEBODY LOVED THIS TOOL']);
      } else if (id === 'whose') {
        this.announce(['THE CABIN SAYS NOTHING', 'THE STOVE COAL GLOWS ONE SHADE WARMER']);
      }
      return true;
    }
    if (spot === 'stove') {
      if (id === 'warm') {
        const wk = `${this.mansionKey}:warmed`;
        if (!this.encounterDone.has(wk)) {
          this.encounterDone.add(wk);
          this.heal(1);
          this.rest();
          this.announce(['THE COAL DOES ITS ONE KIND THING (+1 HP)']);
        } else {
          this.announce(['THE COAL IS SPENT FOR TONIGHT', 'IT GLOWS ANYWAY. FOR MORALE']);
        }
      } else if (id === 'grate') {
        this.announce(['ASH, AND A BUTTON, AND HALF A LETTER', 'THE LETTER STOPS AT: I MEANT TO']);
      } else if (id === 'kettle') {
        this.announce(['STILL FAINTLY WARM', 'SOMEBODY LEFT MID-TEA. NOBODY LEAVES MID-TEA']);
      }
      return true;
    }
    if (spot === 'telescope') {
      if (id === 'look') {
        this.triggerGlitch(0.4);
        this.announce(['IT IS AIMED AT AN ISLAND', 'THERE IS NO ISLAND IN THESE WOODS', 'THE ISLAND IS UP']);
      } else if (id === 'moon') {
        this.announce(['THE MOON, CLOSE ENOUGH TO TOUCH', 'IT HAS BEEN WATCHING YOU WALK THIS WHOLE TIME. FONDLY']);
      } else if (id === 'woods') {
        this.announce(['TREES, TREES, A GLINT OF WATER, TREES', 'AND ONE WINDOW, LIT, VERY FAR AWAY. YOURS?']);
      }
      return true;
    }
    if (spot === 'portrait2') {
      if (id === 'look') {
        this.triggerGlitch(0.4);
        this.announce(['THE SAME FACE AS DOWNSTAIRS. YOUNGER', 'IT LOOKS SORRY ABOUT SOMETHING THAT HAS NOT HAPPENED YET']);
      } else if (id === 'name') {
        this.emit('clock');
        this.announce(['YOU ASK. THE VARNISH CRACKS A LITTLE MORE', 'NO NAME. THE HOUSE ATE IT FIRST']);
      } else if (id === 'frame') {
        this.triggerGlitch(0.3);
        this.announce(['YOU NUDGE IT LEVEL. IT WAS ALREADY LEVEL', 'NOW SOMETHING ELSE IN THE ROOM IS CROOKED']);
      }
      return true;
    }
    if (spot === 'bed') {
      if (id === 'lie') {
        const bk = `${this.mansionKey}:slept`;
        if (!this.encounterDone.has(bk)) {
          this.encounterDone.add(bk);
          this.heal(2);
          this.rest();
          this.announce(['YOU LIE DOWN FOR EXACTLY ONE MINUTE (+2 HP)', 'THE CEILING HAS A WATER STAIN SHAPED LIKE A DOG']);
        } else {
          this.announce(['THE BED HAS GIVEN WHAT IT HAS TO GIVE TONIGHT']);
        }
      } else if (id === 'under') {
        this.announce(['DUST, AND A SINGLE SLIPPER, WAITING', 'YOU LEAVE IT ITS DIGNITY']);
      } else if (id === 'covers') {
        this.announce(['YOU SMOOTH THEM. THE ROOM APPROVES', 'SOMEWHERE DOWNSTAIRS, THE CLOCK TICKS TWICE, PLEASED']);
      }
      return true;
    }
    return false;
  }

  /** Pirts, the merchant ghost. Spirit spelled sideways. Mostly. */
  openPirtsMenu(key, x, y) {
    this.openChoice({
      kind: 'pirts',
      key,
      x,
      y,
      title: `PIRTS, MERCHANT (DECEASED) - YOU HOLD ${this.coins} COIN${this.coins === 1 ? '' : 'S'}`,
      options: [
        { id: 'buy', label: 'SEE HIS WARES' },
        { id: 'sell', label: 'SELL SOMETHING' },
        { id: 'talk', label: 'TALK' },
        { id: 'town', label: 'ASK ABOUT THE TOWN' },
        { id: 'leave', label: 'LEAVE' },
      ],
    });
  }

  openPirtsBuy(key, x, y) {
    this.openChoice({
      kind: 'pirts-buy',
      key,
      x,
      y,
      title: `HIS WARES - YOU HOLD ${this.coins}`,
      options: [
        { id: 'draught', label: `HEAL DRAUGHT (+3 HP) - ${PRICES.draught}C` },
        ...(this.hasAxe ? [] : [{ id: 'axe', label: `AXE - ${PRICES.axe}C` }]),
        ...(this.hasRope ? [] : [{ id: 'rope', label: `ROPE - ${PRICES.rope}C` }]),
        ...(this.hasManual ? [] : [{ id: 'manual', label: `HOW TO BUILD A BOAT - ${PRICES.manual}C` }]),
        { id: 'haggle', label: 'HAGGLE' },
        { id: 'good', label: 'ASK WHAT IS GOOD' },
        { id: 'back', label: 'BACK' },
      ],
    });
  }

  openPirtsSell(key, x, y) {
    this.openChoice({
      kind: 'pirts-sell',
      key,
      x,
      y,
      title: `HE BUYS - YOU HOLD ${this.coins}`,
      options: [
        ...(this.boneMeat ? [{ id: 'meat', label: `THE MEAT - ${SELLS.meat}C` }] : []),
        ...(this.hasBone ? [{ id: 'bone', label: `THE BONE - ${SELLS.bone}C` }] : []),
        ...(this.wood > 0 ? [{ id: 'wood', label: `A PLANK - ${SELLS.wood}C (${this.wood} HELD)` }] : []),
        { id: 'story', label: 'SELL YOUR STORY' },
        { id: 'what', label: 'ASK WHAT HE BUYS' },
        { id: 'pockets', label: 'TURN OUT YOUR POCKETS' },
        { id: 'back', label: 'BACK' },
      ],
    });
  }

  /** Cortie's rack: steel and crooked lightning (v0.21). */
  openCortieBuy(key) {
    this.openChoice({
      kind: 'cortie-buy',
      key,
      x: this.person.x,
      y: this.person.y,
      title: `CORTIE'S RACK - YOU HOLD ${this.coins}C`,
      options: [
        ...(this.hasSword ? [] : [{ id: 'sword', label: `SWORD - ${PRICES.sword}C` }]),
        ...(this.hasWand ? [] : [{ id: 'wand', label: `WAND - ${PRICES.wand}C` }]),
        { id: 'look', label: 'JUST LOOK AT EVERYTHING' },
        { id: 'back', label: 'BACK' },
      ],
    });
  }

  /** Queebee's shelf: scrolls, paper, and the blank book (v0.21). */
  openQueebeeBuy(key) {
    const scrollRows = Object.entries(SCROLL_PRICES).map(([id, price]) => {
      const spec = SPELLS.find((sp) => sp.id === id);
      return { id, label: `SCROLL OF ${spec.name} (L${spec.level}) - ${price}C` };
    });
    this.openChoice({
      kind: 'queebee-buy',
      key,
      x: this.person.x,
      y: this.person.y,
      title: `QUEEBEE'S SHELF - YOU HOLD ${this.coins}C`,
      options: [
        ...scrollRows,
        { id: 'paper', label: `BLANK PAGE - ${PAPER_PRICE}C (${this.paper} HELD)` },
        ...(this.hasBook ? [] : [{ id: 'book', label: `THE BLANK BOOK - ${BOOK_PRICE}C` }]),
        { id: 'how', label: 'ASK HOW SCROLLS WORK' },
        { id: 'back', label: 'BACK' },
      ],
    });
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
        { id: 'shamble', label: 'SHAMBLE ALONGSIDE IT' },
        { id: 'run', label: 'RUN AWAY' },
      ],
    };
  }

  resolveZombie(c, id) {
    if (id === 'shamble') {
      // Resolves like RUN, but sadder: two tired things, one night.
      this.emit('zombie');
      this.announce(['YOU MATCH ITS SWAY. TWO TIRED THINGS, ONE NIGHT', 'IT FORGETS WHICH OF YOU IS DINNER']);
      return;
    }
    if (id === 'run') return; // it is not fast. the cooldown covers your exit.
    const kind = c.foe ?? 'zombie';
    const spec = FOES[kind];
    const hp = this.zombieHp.get(c.key) ?? spec.hp;

    if (id === 'befriend') {
      this.announce([
        kind === 'minotaur'
          ? 'HE DOES NOT HEAR YOU OVER THE MAZE'
          : kind === 'ghost'
            ? 'IT GLITCHES THROUGH YOUR OUTSTRETCHED HAND'
            : 'THE ZOMBIE DOES NOT WANT FRIENDS',
      ]);
      this.zombieBites(c);
      return;
    }

    const weapon =
      id === 'bone' && this.hasBone
        ? 'bone'
        : id === 'axe' && this.hasAxe
          ? 'axe'
          : id === 'sword' && this.hasSword
            ? 'sword'
            : id === 'wand' && this.hasWand
              ? 'wand'
              : null;
    // The wand is the one weapon that answers to the MIND.
    const r = weapon === 'wand' ? this.check('int') : this.check('str');
    const dc =
      weapon === 'bone' ? DC_BONE : weapon === 'axe' ? DC_AXE : weapon === 'sword' ? DC_BONE : weapon === 'wand' ? DC_WAND : DC_FISTS;
    const dmg =
      weapon === 'bone'
        ? this.boneDamage()
        : weapon === 'axe'
          ? this.fistDamage() + 2
          : weapon === 'sword'
            ? this.fistDamage() + 3
            : weapon === 'wand'
              ? 2 + Math.max(0, this.mod('int'))
              : this.fistDamage();
    const DIES = {
      zombie: 'THE ZOMBIE CRUMBLES. THE FOREST EXHALES',
      ghost: 'THE SIGNAL DROPS FOR GOOD. IT LOOKS RELIEVED',
      minotaur: 'THE MINOTAUR KNEELS. THE MAZE, AT LAST, HAS AN EXIT',
    };
    const LOOT = { zombie: 1, ghost: 2, minotaur: 5 };
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
      if (weapon) this.emit(weapon === 'bone' ? 'bonk' : weapon === 'wand' ? 'spell-cast' : 'chop');
      if (left <= 0) {
        this.encounterDone.add(c.key);
        this.zombieHp.delete(c.key);
        this.emit('vanish');
        this.triggerGlitch(0.4);
        this.announce([
          `${this.rollText(r)} - ${
            weapon === 'bone'
              ? 'BONK! THE BONE RINGS TRUE'
              : weapon === 'axe'
                ? 'THE AXE REMEMBERS ITS FIRST JOB'
                : weapon === 'sword'
                  ? 'THE STEEL SINGS ONE CLEAN NOTE'
                  : weapon === 'wand'
                    ? 'THE WAND CRACKS VIOLET'
                    : 'YOU LAND ONE'
          }`,
          DIES[kind],
        ]);
        this.gainXp(spec.xp);
        this.gainCoins(LOOT[kind]);
        if (this.mode === 'turn') this.endPlayerTurn();
      } else {
        this.zombieHp.set(c.key, left);
        this.announce([`${this.rollText(r)} - ${
          weapon === 'bone'
            ? 'BONK! IT STAGGERS'
            : weapon === 'axe'
              ? 'THE AXE BITES. IT STAGGERS'
              : weapon === 'sword'
                ? 'THE STEEL BITES. IT STAGGERS'
                : weapon === 'wand'
                  ? 'VIOLET SPARKS. IT STAGGERS'
                  : 'YOU LAND ONE. IT STAGGERS'
        }`]);
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
      this.choiceCooldown = { key: c.key, x: this.person.x, y: this.person.y };
      this.cooldownKeys.add(c.key);
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
