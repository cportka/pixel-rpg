// The v0.9 D&D layer: rolled abilities, modifiers, the drunk timer, the
// character sheet, the meaty bone, and the zombie fight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, MAX_HP, COLLAPSE_HP, ABILITIES,
  DC_FISTS, DC_BONE, ZOMBIE_HP, ZOMBIE_BITE, DRUNK_TIME, DRUNK_WIS_BONUS,
  BONE_WEIGHT, MEAT_WEIGHT,
  START_STAT, XP_PER_LEVEL, LEVEL_POINTS, XP_DOG, XP_ZOMBIE, MEET_RADIUS,
  SPELLS, FOCUS_BASE, FOCUS_REGEN, BATTLE_RADIUS, BATTLE_LEAVE, BATTLE_MOVE,
} from '../src/core/game.js';
import { generateChunk, CHUNK } from '../src/core/world.js';
import { ZOMBIE_SPRITE, ZOMBIE_COLORS, zombieSway } from '../src/gfx/encounters.js';
import { SCREEN_W, SCREEN_H, choicePanel, sheetLines } from '../src/gfx/renderer.js';
import { ICONS } from '../src/gfx/icons.js';
import { PALETTE } from '../src/gfx/palette.js';
import { measureText } from '../src/gfx/font.js';

const STEP = 1 / 60;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** A together game on an open field, stats flattened to 10 (modifier 0). */
function flatGame() {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  runSeconds(g, 3.5); // let the greeting caption clear
  return g;
}

/**
 * Plant a zombie next to the person and let the world notice it. Since v0.15
 * a hostile inside BATTLE_RADIUS drops the world into turn-based on its own,
 * so this just idles until the gear changes. Sound events are drained per
 * step into g.heard (mirroring main.js) so the cap can't swallow them.
 *
 * `dist` under ENCOUNTER_RADIUS (39) means the zombie is in reach, so the
 * action menu offers fists. `menu: false` leaves the menu closed, for tests
 * that want to spend the move budget themselves.
 */
function zombieGame({ bone = false, dist = 30, menu = true } = {}) {
  const g = flatGame();
  g.hasBone = bone;
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + dist, y: g.person.y, phase: 0 });
  g.zombieKey = `z:${g.person.x + dist},${g.person.y}`;
  g.heard = [];
  const steps = Math.ceil(3 / STEP);
  for (let i = 0; i < steps && g.mode !== 'turn'; i++) {
    g.update(STEP, {});
    g.heard.push(...g.events);
    g.events.length = 0;
  }
  if (menu) g.openBattleMenu();
  return g;
}

// --- Abilities and modifiers ------------------------------------------------

test('everyone begins the universe at 2 across the board, level 1, no XP', () => {
  const g = new Game(7, { story: false });
  assert.deepEqual(Object.keys(g.stats).sort(), [...ABILITIES].sort());
  for (const a of ABILITIES) assert.equal(g.stats[a], START_STAT, `${a} starts at 2`);
  assert.equal(g.level, 1);
  assert.equal(g.xp, 0);
  assert.equal(g.statPoints, 0);
  assert.equal(g.mod('str'), -4, 'a 2 is a -4');
  assert.equal(g.fistDamage(), 0, 'feeble fists');
  assert.equal(g.boneDamage(), 1, 'the club always does something');
  assert.equal(g.carryCapacity(), START_STAT * 10 + START_STAT * 20, '60 lbs to start');
});

// --- Experience and levels --------------------------------------------------

test('XP accumulates with a caption; 10 of it makes a level', () => {
  const g = flatGame();
  g.gainXp(4);
  assert.equal(g.xp, 4);
  assert.equal(g.level, 1);
  assert.ok(
    g.caption.text === '+4 XP' || g.captionQueue.includes('+4 XP'),
    'the gain is announced',
  );
  g.gainXp(6);
  assert.equal(g.level, 2, 'ten XP is level 2');
  assert.equal(g.xp, 0, 'the counter rolls over');
  assert.equal(g.statPoints, LEVEL_POINTS, 'two +1s to spend');
  assert.ok(g.choice, 'the level menu opened');
  assert.equal(g.choice.kind, 'levelup');
  assert.ok(g.menuPaused(), 'leveling pauses the world');
  assert.equal(g.choice.options.length, ABILITIES.length);
});

test('level points spend one at a time — the same stat twice is fine', () => {
  const g = flatGame();
  g.gainXp(XP_PER_LEVEL);
  assert.equal(g.choice.kind, 'levelup');
  const str0 = g.stats.str;
  g.resolveChoice('str');
  assert.equal(g.stats.str, str0 + 1);
  assert.equal(g.statPoints, 1);
  assert.ok(g.choice, 'menu reopens for the second point');
  assert.equal(g.choice.kind, 'levelup');
  assert.match(g.choice.title, /1 LEFT/);
  g.resolveChoice('str'); // together: both on STR
  assert.equal(g.stats.str, str0 + 2);
  assert.equal(g.statPoints, 0);
  assert.equal(g.choice, null, 'all spent — the world resumes');
  assert.equal(g.caption.text, 'YOU FEEL SHARPER');
});

test('a windfall can carry several levels at once', () => {
  const g = flatGame();
  g.gainXp(25);
  assert.equal(g.level, 3, 'two levels crossed');
  assert.equal(g.xp, 5, 'remainder kept');
  assert.equal(g.statPoints, 2 * LEVEL_POINTS, 'four points banked');
});

test('a level-up menu is never clobbered by a same-tick encounter', () => {
  // Regression (v0.12.0 review): meeting the dog next to an unresolved
  // encounter opened the level menu and then checkEncounters overwrote it,
  // stranding the stat points until the NEXT level.
  const g = new Game(1); // story mode: alone, dog waiting
  g.world.collides = () => false;
  for (const a of ABILITIES) g.stats[a] = 10;
  g.xp = 6; // +4 for the dog crosses 10
  g.world.chunkAt(0, 0).dumpsters.push({ x: g.dog.x + 4, y: g.dog.y });
  g.person.x = g.dog.x - (MEET_RADIUS - 2);
  g.person.y = g.dog.y;
  g.encounterCheck = 0.29; // the encounter sweep fires this very tick
  g.update(STEP, {});
  assert.equal(g.together, true);
  assert.equal(g.level, 2);
  assert.equal(g.choice?.kind, 'levelup', 'the level menu survives the dumpster');
  assert.equal(g.statPoints, LEVEL_POINTS);
});

test('a lethal bite from a sheet attack still lets you crawl off', () => {
  // Regression (v0.12.0 review): the cooldown slot was stamped on the detail
  // window, so the zombie force-reopened over your unconscious body.
  const g = flatGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 10, y: g.person.y, phase: 0 });
  g.hp = ZOMBIE_BITE; // the next bite fells you
  g.rng = () => 0; // guaranteed miss
  g.update(STEP, { sheet: true });
  g.resolveChoice('str');
  g.resolveChoice('punch');
  assert.equal(g.hp, COLLAPSE_HP, 'collapsed and rescued');
  assert.equal(g.choice, null, 'the fight is over');
  runSeconds(g, 1.2);
  assert.equal(g.choice, null, 'the zombie does not re-engage while you crawl off');
});

test('closing a pause screen does not wipe an escaped encounter cooldown', () => {
  // Regression (v0.12.0 review): every menu resolve stamped the single
  // cooldown slot, so sheet/map/level-up use un-fled a fled zombie.
  const g = zombieGame();
  g.resolveChoice('run');
  g.update(STEP, {});
  g.update(STEP, { sheet: true });
  g.choiceIndex = g.choice.options.length - 1; // CLOSE
  g.update(STEP, {});
  g.update(STEP, { action: true });
  assert.equal(g.choice, null);
  runSeconds(g, 1.2);
  assert.equal(g.choice, null, 'the zombie menu does not force-reopen');
});

test('the selected-row decoration fits inside the panel', () => {
  // Regression (v0.12.0 review): "- LABEL -" measured wider than the panel.
  const g = flatGame();
  g.choice = {
    kind: 'bone',
    key: 'k',
    x: 0,
    y: 0,
    title: 'A MEATY BONE',
    options: [
      { id: 'eat', label: 'GNAW OFF THE MEAT (+2 HP)' },
      { id: 'save', label: 'SAVE IT FOR LATER' },
    ],
  };
  const panel = choicePanel(g);
  for (const o of g.choice.options) {
    assert.ok(measureText(`- ${o.label} -`) <= panel.w - 8, `'${o.label}' fits decorated`);
  }
});

test('finding the dog is worth 4 XP; a zombie is worth 1', () => {
  const g = new Game(1);
  g.world.collides = () => false;
  g.person.x = g.dog.x - (MEET_RADIUS - 2);
  g.person.y = g.dog.y;
  g.update(STEP, {});
  assert.equal(g.together, true);
  assert.equal(g.xp, XP_DOG);

  const z = zombieGame();
  z.stats.str = 16; // one-punch power, for brevity
  z.rng = () => 0.8;
  z.resolveChoice('fists');
  assert.equal(z.xp, XP_ZOMBIE);
  assert.ok(z.captionQueue.includes('+1 XP'));
});

test('modifiers follow the classic table, and the pipe sharpens wisdom', () => {
  const g = flatGame();
  for (const [score, expected] of [[3, -4], [8, -1], [10, 0], [11, 0], [12, 1], [15, 2], [18, 4]]) {
    g.stats.str = score;
    assert.equal(g.mod('str'), expected, `STR ${score}`);
  }
  g.stats.str = 10;
  assert.equal(g.mod('wis'), 0);
  g.drunk = 100;
  assert.equal(g.mod('wis'), DRUNK_WIS_BONUS, 'drunk wisdom flows easier');
  assert.equal(g.mod('int'), 0, 'only wisdom is sharpened');
});

test('roll captions show the modifier only when nonzero', () => {
  const g = flatGame();
  g.rng = () => 0.5; // d20 roll of 11
  assert.equal(g.rollText(g.check('str')), 'D20: 11');
  g.stats.str = 14;
  assert.equal(g.rollText(g.check('str')), 'D20: 11+2');
  g.stats.str = 8;
  assert.equal(g.rollText(g.check('str')), 'D20: 11-1');
});

// --- The drunk timer --------------------------------------------------------

test('the inebriation wears off and the world settles back down', () => {
  const g = flatGame();
  g.drunk = 0.5;
  runSeconds(g, 1);
  assert.equal(g.drunk, 0);
  assert.equal(g.caption.text, 'THE WORLD SETTLES BACK DOWN');
  // ...and it only says so once.
  runSeconds(g, 4);
  assert.equal(g.caption, null);
});

test('encounter menus leave time running; the inventory pauses the world', () => {
  const g = zombieGame();
  g.drunk = DRUNK_TIME;
  runSeconds(g, 1);
  assert.ok(g.drunk < DRUNK_TIME, 'a zombie fight does not stop the clock');

  const g2 = flatGame();
  g2.drunk = 100;
  g2.update(STEP, { sheet: true });
  assert.ok(g2.choice, 'sheet open');
  const t0 = g2.time;
  runSeconds(g2, 1);
  assert.equal(g2.drunk, 100, 'the inventory pauses the drunk countdown');
  assert.equal(g2.time, t0, 'time itself stops');
});

// --- The character sheet ----------------------------------------------------

test('the sheet opens on I as an icon grid, freezes the walk, reopens freely', () => {
  const g = flatGame();
  g.update(STEP, { sheet: true });
  assert.ok(g.choice, 'sheet open');
  assert.equal(g.choice.kind, 'sheet');
  assert.equal(g.choice.title, 'YOU');
  assert.deepEqual(
    g.choice.options.map((o) => o.id),
    [...ABILITIES, 'ball', 'close'],
    'six stat icons, the ball, and close',
  );
  assert.ok(g.choice.options.slice(0, 7).every((o) => o.icon), 'icons carry their art id');
  const px = g.person.x;
  g.update(STEP, { right: true });
  assert.equal(g.person.x, px, 'walk frozen while reading');
  g.update(STEP, {});
  g.choiceIndex = g.choice.options.length - 1; // CLOSE
  g.update(STEP, { action: true });
  assert.equal(g.choice, null);
  g.update(STEP, {});
  g.update(STEP, { sheet: true });
  assert.ok(g.choice, 'the sheet is not an encounter — it reopens at once');
});

test('clicking a stat icon opens its little explanation window', () => {
  const g = flatGame();
  g.update(STEP, { sheet: true });
  g.resolveChoice('str');
  assert.equal(g.choice.kind, 'detail');
  assert.equal(g.choice.title, 'STRENGTH');
  assert.ok(g.menuPaused(), 'detail windows pause too');
  assert.ok(g.choice.body.some((l) => l.startsWith('SCORE 10')), 'the score is explained');
  assert.ok(g.choice.body.some((l) => l.includes('D20+0')), 'the modifier is explained');
  assert.ok(g.choice.body.some((l) => l.includes('FISTS DEAL 2')), 'derived numbers shown');
  g.resolveChoice('back');
  assert.equal(g.choice.kind, 'sheet', 'BACK returns to the grid');
});

test('with the bone and its meat, the sheet grows item icons — and the gnaw', () => {
  const g = flatGame();
  g.hasBone = true;
  g.boneMeat = true;
  g.hp = 4;
  g.update(STEP, { sheet: true });
  assert.deepEqual(
    g.choice.options.map((o) => o.id),
    [...ABILITIES, 'bone', 'meat', 'ball', 'close'],
  );
  g.resolveChoice('meat');
  assert.equal(g.choice.kind, 'detail');
  assert.equal(g.choice.title, 'MEAT ON THE BONE');
  g.resolveChoice('eat');
  assert.equal(g.hp, 6, 'the gnaw heals +2');
  assert.equal(g.boneMeat, false);
  assert.ok(g.hasBone, 'the club remains');
  g.update(STEP, {});
  g.update(STEP, { sheet: true });
  assert.ok(!g.choice.options.some((o) => o.id === 'meat'), 'the meat icon is gone');
});

test('sheet header lines show level, XP, HP, weight, and drunkenness', () => {
  const g = flatGame();
  const lines = sheetLines(g);
  assert.equal(lines.length, 3, 'sober: level, HP, weight');
  assert.equal(lines[0], `LVL 1  XP 0 OF ${XP_PER_LEVEL}`);
  assert.equal(lines[1], `HP ${g.hp} OF ${MAX_HP}`);
  assert.equal(lines[2], 'WEIGHT 0 OF 300 LBS');
  g.drunk = 599;
  g.hasBone = true;
  g.boneMeat = true;
  const more = sheetLines(g);
  assert.ok(more.includes('DRUNK 9:59 (WIS +2)'), 'the timer reads M:SS with the bonus');
  assert.equal(sheetLines(g)[2], `WEIGHT ${BONE_WEIGHT + MEAT_WEIGHT} OF 300 LBS`, 'the load shows');
});

test('you can carry STR x 10 + CON x 20 pounds', () => {
  const g = flatGame();
  assert.equal(g.carryCapacity(), 300, '10s across the board');
  g.stats.str = 18;
  g.stats.con = 14;
  assert.equal(g.carryCapacity(), 460);
  assert.equal(g.carriedWeight(), 0, 'empty-handed');
  g.hasBone = true;
  assert.equal(g.carriedWeight(), BONE_WEIGHT);
  g.boneMeat = true;
  assert.equal(g.carriedWeight(), BONE_WEIGHT + MEAT_WEIGHT);
  assert.ok(g.carriedWeight() <= g.carryCapacity(), 'the forest travels light');
});

test('the sheet panel lays its icon grid out on screen, no overlaps', () => {
  const g = flatGame();
  g.hasBone = true;
  g.boneMeat = true;
  g.drunk = 60;
  g.openSheet();
  const panel = choicePanel(g);
  assert.equal(panel.body.length, 4, 'LVL, HP, WEIGHT, DRUNK');
  assert.equal(panel.icons.length, ABILITIES.length + 3, 'six stats + bone, meat, ball');
  assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.w <= SCREEN_W && panel.y + panel.h <= SCREEN_H);
  for (const cell of panel.icons) {
    assert.ok(
      cell.x >= panel.x && cell.y >= panel.y &&
      cell.x + cell.w <= panel.x + panel.w && cell.y + cell.h <= panel.y + panel.h,
      `icon ${cell.id} inside the panel`,
    );
    for (const other of panel.icons) {
      if (other === cell) continue;
      const overlap =
        cell.x < other.x + other.w && cell.x + cell.w > other.x &&
        cell.y < other.y + other.h && cell.y + cell.h > other.y;
      assert.equal(overlap, false, `${cell.id} does not overlap ${other.id}`);
    }
  }
  for (const row of panel.rows) {
    assert.ok(row.y >= panel.y && row.y + row.h <= panel.y + panel.h + 2, 'rows inside the panel');
  }
  const gridBottom = Math.max(...panel.icons.map((c) => c.y + c.h));
  assert.ok(gridBottom < Math.min(...panel.rows.map((r) => r.y)), 'icons sit above the rows');
});

// --- The zombie, and the two gears of the world -----------------------------

test('a hostile close by drops the world into turn-based on its own', () => {
  const g = zombieGame({ menu: false });
  assert.equal(g.mode, 'turn', 'the gear changed without being asked');
  assert.equal(g.turn, 'you', 'and it is your move');
  assert.equal(g.round, 1);
  assert.equal(g.moveLeft, BATTLE_MOVE, 'a full step budget');
  assert.deepEqual(g.battleFoes, [g.zombieKey]);
  assert.ok(g.heard.includes('battle-start'), 'the mode change is audible');
  assert.ok(
    g.captionQueue.includes('TURN-BASED: ONE MOVE, ONE ACTION') || g.caption.text === 'SOMETHING IS CLOSE',
    'and announced',
  );
});

test('the battle menu: no bone option bare-handed, befriend only in round one', () => {
  const g = zombieGame();
  assert.equal(g.choice.kind, 'battle');
  assert.equal(g.choice.title, 'A ZOMBIE IS ON YOU');
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'fists', 'wait']);
  g.resolveChoice('wait');
  assert.equal(g.round, 2, 'holding your ground still spends the turn');
  g.openBattleMenu();
  assert.deepEqual(g.choice.options.map((o) => o.id), ['fists', 'wait'], 'the friendly beat was round one');
});

test('befriending the zombie just gets you bitten (-2 HP)', () => {
  const g = zombieGame();
  g.hp = 8;
  g.resolveChoice('befriend');
  assert.equal(g.hp, 8 - ZOMBIE_BITE);
  assert.equal(g.caption.text, 'THE ZOMBIE DOES NOT WANT FRIENDS');
  assert.ok(g.captionQueue.includes(`IT BITES (-${ZOMBIE_BITE} HP)`));
  assert.equal(g.choice, null, 'the round is over — you get your move back');
  assert.equal(g.turn, 'you');
  assert.equal(g.moveLeft, BATTLE_MOVE);
});

test('fists: DC 12, 2 damage — two clean hits drop it', () => {
  const g = zombieGame();
  const key = g.zombieKey;
  g.rng = () => 0.99; // roll 20
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20 - YOU LAND ONE. IT STAGGERS');
  assert.equal(g.zombieHp.get(key), ZOMBIE_HP - 2);
  assert.equal(g.mode, 'turn', 'half-dead is not dead');
  g.openBattleMenu();
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20 - YOU LAND ONE');
  assert.ok(g.captionQueue.includes('THE ZOMBIE CRUMBLES. THE FOREST EXHALES'));
  assert.ok(g.encounterDone.has(key), 'it stays down');
  assert.equal(g.zombieHp.has(key), false, 'fight state cleaned up');
  assert.equal(g.choice, null);
});

test('the last hostile down lets the world back into free movement', () => {
  const g = zombieGame();
  g.stats.str = 16; // one punch is enough
  g.rng = () => 0.99;
  g.resolveChoice('fists');
  g.events.length = 0;
  runSeconds(g, 0.4); // the next battle check notices the quiet
  assert.equal(g.mode, 'free');
  assert.equal(g.moveLeft, BATTLE_MOVE, 'the budget stops mattering');
  assert.ok(g.events.includes('battle-end'));
});

test('the bone is the better club: DC 9, 3 damage, and it bonks', () => {
  const g = zombieGame({ bone: true });
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'fists', 'bone', 'wait']);
  const key = g.zombieKey;
  g.events.length = 0;
  g.rng = () => 0.45; // roll 10: lands with the bone, would miss bare-handed
  g.resolveChoice('bone');
  assert.ok(g.events.includes('bonk'));
  assert.equal(g.caption.text, 'D20: 10 - BONK! IT STAGGERS');
  assert.equal(g.zombieHp.get(key), ZOMBIE_HP - 3);
  g.openBattleMenu();
  g.resolveChoice('bone'); // 1 HP left, 3 damage
  assert.equal(g.caption.text, 'D20: 10 - BONK! THE BONE RINGS TRUE');
  assert.ok(g.captionQueue.includes('THE ZOMBIE CRUMBLES. THE FOREST EXHALES'));
  assert.ok(g.encounterDone.has(key));
  assert.ok(DC_BONE < DC_FISTS, 'the club is the easier swing');
});

test('a miss means teeth: bitten (-2 HP), and the round rolls on', () => {
  const g = zombieGame();
  g.hp = 9;
  g.rng = () => 0.3; // roll 7 < DC_FISTS
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 7 - YOU MISS');
  assert.equal(g.hp, 9 - ZOMBIE_BITE);
  assert.ok(g.captionQueue.includes(`IT BITES (-${ZOMBIE_BITE} HP)`));
  assert.equal(g.mode, 'turn', 'the fight is not over');
  assert.equal(g.round, 2);
});

test('too weak: the lethal bite samples your brain (-1 INT) and ends the fight', () => {
  const g = zombieGame();
  const int0 = g.stats.int;
  g.hp = ZOMBIE_BITE; // the next bite fells you
  g.rng = () => 0; // roll 1 — a miss
  g.resolveChoice('fists');
  assert.equal(g.stats.int, int0 - 1);
  assert.equal(g.hp, COLLAPSE_HP, 'the collapse catches you');
  assert.equal(g.caption.text, 'IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)');
  assert.ok(g.captionQueue.includes('THE DOG DRAGS YOU AWAY'));
  assert.equal(g.choice, null, 'no menu over your unconscious body');
  runSeconds(g, 1.2);
  assert.equal(g.choice, null, 'the cooldown lets you crawl off');
});

test('INT can never be eaten below 1', () => {
  const g = zombieGame();
  g.stats.int = 1;
  g.hp = ZOMBIE_BITE;
  g.rng = () => 0;
  g.resolveChoice('fists');
  assert.equal(g.stats.int, 1);
});

test('fist damage is floor(STR / 4); the bone adds one', () => {
  const g = flatGame();
  for (const [str, fists] of [[3, 0], [10, 2], [12, 3], [16, 4], [18, 4]]) {
    g.stats.str = str;
    assert.equal(g.fistDamage(), fists, `STR ${str}`);
    assert.equal(g.boneDamage(), fists + 1, `STR ${str} + club`);
  }
});

test('a mighty punch drops the zombie in one (STR 16 = 4 damage)', () => {
  const g = zombieGame();
  const key = g.zombieKey;
  g.stats.str = 16; // +3 to hit, 4 damage
  g.rng = () => 0.8; // roll 17, +3 = 20
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 17+3 - YOU LAND ONE');
  assert.ok(g.encounterDone.has(key), 'one punch');
  assert.equal(g.choice, null);
});

test('a feeble hit bounces off harmlessly — but the zombie still gets its turn', () => {
  const g = zombieGame();
  const key = g.zombieKey;
  g.stats.str = 3; // -4 to hit, 0 damage
  g.hp = 9;
  g.rng = () => 0.99; // roll 20, -4 = 16: still a hit
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20-4 - YOUR FISTS BOUNCE OFF HARMLESSLY');
  assert.equal(g.zombieHp.get(key) ?? ZOMBIE_HP, ZOMBIE_HP, 'unhurt');
  assert.equal(g.hp, 9 - ZOMBIE_BITE, 'turn-based means it always answers');
  assert.equal(g.mode, 'turn', 'the standoff continues');
});

test('the STR detail can punch a zombie in reach', () => {
  const g = flatGame();
  g.world.chunkAt(0, 0).zombies.push({ x: g.person.x + 10, y: g.person.y, phase: 0 });
  g.rng = () => 0.99;
  g.update(STEP, { sheet: true });
  assert.equal(g.choice.kind, 'sheet', 'the sheet wins the tick it opens');
  g.resolveChoice('str');
  assert.ok(g.choice.options.some((o) => o.id === 'punch'), 'STRENGTH offers the punch');
  g.resolveChoice('punch');
  assert.match(g.caption.text, /YOU LAND ONE/);
  assert.equal(g.choice.kind, 'zombie', 'the swing joins the fight');
});

test('attacking with nothing in reach hits only the dark', () => {
  const g = flatGame();
  g.update(STEP, { sheet: true });
  g.resolveChoice('str');
  g.resolveChoice('punch');
  assert.equal(g.caption.text, 'YOU PUNCH AT THE DARK. IT DOES NOT MIND');
  assert.equal(g.choice, null);
  const g2 = flatGame();
  g2.hasBone = true;
  g2.update(STEP, { sheet: true });
  g2.resolveChoice('bone');
  assert.equal(g2.choice.kind, 'detail');
  g2.resolveChoice('swing');
  assert.equal(g2.caption.text, 'YOU SWING AT THE DARK. IT DOES NOT MIND');
});

test('the ball icon throws through its detail window', () => {
  const g = flatGame();
  g.update(STEP, { sheet: true });
  assert.ok(g.choice.options.some((o) => o.id === 'ball'));
  g.resolveChoice('ball');
  assert.equal(g.choice.kind, 'detail');
  assert.equal(g.choice.title, 'THE PINK BALL');
  g.resolveChoice('throw');
  assert.equal(g.fetch, 'thrown');
  assert.ok(g.ball, 'the ball is in the air');
  g.update(STEP, {});
  g.update(STEP, { sheet: true });
  assert.ok(!g.choice.options.some((o) => o.id === 'ball'), 'no second ball mid-fetch');
});

test('walking is still the way out: distance disengages the battle', () => {
  const g = zombieGame({ dist: 100, menu: false });
  assert.equal(g.mode, 'turn');
  g.hp = 8;
  // A turn is 60px of walking; put BATTLE_LEAVE between you a turn at a time.
  for (let i = 0; i < 8 && g.mode === 'turn'; i++) {
    runSeconds(g, 1.2, { left: true }); // spends the budget, opens the menu
    if (g.choice) g.resolveChoice('wait');
  }
  assert.equal(g.mode, 'free', 'the woods let go');
  assert.equal(g.hp, 8, 'nothing could reach you out here');
  assert.deepEqual(g.battleFoes, []);
});

test('your move is a budget: spend it and the action menu opens itself', () => {
  const g = zombieGame({ dist: 100, menu: false });
  assert.equal(g.moveLeft, BATTLE_MOVE);
  runSeconds(g, 0.2, { left: true });
  assert.ok(g.moveLeft > 0 && g.moveLeft < BATTLE_MOVE, 'walking spends it');
  assert.equal(g.choice, null, 'and you still have your action');
  runSeconds(g, 2, { left: true });
  assert.equal(g.moveLeft, 0, 'the budget ran out');
  assert.ok(g.choice, 'so the action menu opened on its own');
  assert.equal(g.choice.kind, 'battle');
  assert.equal(g.choice.title, 'IT SHAMBLES CLOSER', 'out of reach, so no fists');
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'wait']);
});

// --- Magic ------------------------------------------------------------------

/** Everything the game has said, still showing or still queued. */
function said(g) {
  return [g.caption && g.caption.text, ...g.captionQueue].filter(Boolean);
}

test('focus is 3 + WIS, and never drops below one point', () => {
  const g = flatGame();
  assert.equal(g.maxFocus(), FOCUS_BASE, 'a WIS of 10 is a flat 3');
  g.stats.wis = 18;
  assert.equal(g.maxFocus(), FOCUS_BASE + 4);
  g.stats.wis = 2; // -4: the pool would go negative
  assert.equal(g.maxFocus(), 1, 'the dimmest mind still holds one spell');
});

test('the leaf teaches one spell at a time, in the order of the book', () => {
  const g = flatGame();
  assert.deepEqual(g.spells, [], 'you start knowing nothing');
  for (let i = 0; i < SPELLS.length; i++) {
    g.focus = 0;
    g.learnSpell();
    assert.deepEqual(g.spells, SPELLS.slice(0, i + 1).map((s) => s.id));
    assert.equal(g.focus, g.maxFocus(), 'a vision fills you back up');
  }
  g.learnSpell();
  assert.equal(g.spells.length, SPELLS.length, 'the book runs out');
  assert.ok(said(g).includes('THE LEAF HAS NOTHING LEFT TO TEACH'));
});

test('focus seeps back under the open sky, a point at a time', () => {
  const g = flatGame();
  g.spells.push('ember');
  g.focus = 0;
  runSeconds(g, FOCUS_REGEN - 1);
  assert.equal(g.focus, 0, 'not yet');
  runSeconds(g, 1.1);
  assert.equal(g.focus, 1);
  runSeconds(g, FOCUS_REGEN * 3);
  assert.equal(g.focus, g.maxFocus(), 'and it stops at full');
});

test('the spell menu is a pause screen, and needs a spell to open', () => {
  const g = flatGame();
  g.openSpellMenu();
  assert.equal(g.choice, null);
  assert.equal(g.caption.text, 'YOU KNOW NO SPELLS. THE LEAF KNOWS SOME');
  g.learnSpell();
  g.openSpellMenu();
  assert.equal(g.choice.kind, 'spell');
  assert.match(g.choice.title, /^FOCUS \d+ OF \d+$/);
  assert.ok(g.menuPaused(), 'the world waits while you read the book');
  assert.deepEqual(g.choice.options.map((o) => o.id), [SPELLS[0].id, 'back']);
});

test('the SPELLS icon joins the sheet only once you know one', () => {
  const g = flatGame();
  g.openSheet();
  assert.equal(g.choice.options.some((o) => o.id === 'spells'), false);
  g.resolveChoice('close');
  g.learnSpell();
  g.openSheet();
  assert.ok(g.choice.options.some((o) => o.id === 'spells'), 'now it is inventory');
  g.resolveChoice('spells');
  assert.equal(g.choice.kind, 'spell');
  g.resolveChoice('back');
  assert.equal(g.choice.kind, 'sheet', 'BACK returns you to the sheet');
});

test('EMBER burns a zombie for 3 and spends a point of focus', () => {
  const g = zombieGame({ menu: false });
  g.spells.push('ember');
  g.focus = 2;
  g.openBattleMenu();
  assert.ok(g.choice.options.some((o) => o.id === 'cast'), 'battle offers the book');
  g.resolveChoice('cast');
  assert.equal(g.choice.kind, 'spell');
  g.events.length = 0;
  g.resolveChoice('ember');
  assert.equal(g.focus, 1, 'one point burned');
  assert.ok(g.events.includes('spell-cast'));
  assert.equal(g.caption.text, 'EMBER BITES. THE ZOMBIE BURNS AND KEEPS COMING');
  assert.equal(g.zombieHp.get(g.zombieKey), ZOMBIE_HP - 3);
  assert.equal(g.round, 2, 'casting costs your turn');
  // 1 HP left: the second ember puts it out.
  g.openBattleMenu();
  g.resolveChoice('cast');
  g.resolveChoice('ember');
  assert.equal(g.caption.text, 'EMBER TAKES IT. THE ZOMBIE GOES OUT LIKE A CANDLE');
  assert.ok(g.encounterDone.has(g.zombieKey));
  assert.equal(g.xp, XP_ZOMBIE, 'a kill is a kill');
});

test('EMBER with nothing to burn just blooms', () => {
  const g = flatGame();
  g.spells.push('ember');
  g.focus = 3;
  g.castSpell('ember');
  assert.equal(g.caption.text, 'EMBER BLOOMS AND FINDS NOTHING TO BURN');
  assert.equal(g.focus, 2, 'the focus is spent regardless');
});

test('WARD eats the next bite instead of you', () => {
  const g = zombieGame({ menu: false });
  g.spells.push('ward');
  g.hp = 8;
  g.openBattleMenu();
  g.resolveChoice('cast');
  g.events.length = 0;
  g.resolveChoice('ward');
  assert.equal(g.hp, 8, 'nothing got through');
  assert.equal(g.warded, false, 'the frost was spent doing it');
  assert.equal(g.caption.text, 'A WARD SETTLES OVER YOU, THIN AS FROST');
  assert.ok(said(g).includes('THE WARD TAKES THE BITE FOR YOU'));
  assert.ok(g.events.includes('ward'));
  // Only the one bite, though.
  g.openBattleMenu();
  g.resolveChoice('wait');
  assert.equal(g.hp, 8 - ZOMBIE_BITE, 'the next one lands');
});

test('MOONLIGHT costs two and pours three HP back', () => {
  const g = flatGame();
  g.spells.push('moonlight');
  g.focus = 3;
  g.hp = 4;
  g.castSpell('moonlight');
  assert.equal(g.hp, 7);
  assert.equal(g.focus, 1);
  assert.equal(g.caption.text, 'YOU DRINK THE MOON (+3 HP)');
  assert.equal(g.hearts.length, 1, 'a heart floats up');
});

test('an empty pool scatters the words — and still costs you the turn', () => {
  const g = zombieGame({ menu: false });
  g.spells.push('moonlight');
  g.focus = 1; // MOONLIGHT costs 2
  g.hp = 8;
  g.openBattleMenu();
  g.resolveChoice('cast');
  g.events.length = 0;
  g.resolveChoice('moonlight');
  assert.equal(g.caption.text, 'NOT ENOUGH FOCUS. THE WORDS SCATTER');
  assert.equal(g.focus, 1, 'nothing spent');
  assert.ok(g.events.includes('spell-fail'));
  assert.equal(g.hp, 8 - ZOMBIE_BITE, 'the zombie is not sympathetic');
});

test('you cannot cast what the leaf has not taught you', () => {
  const g = flatGame();
  const focus0 = g.focus;
  g.castSpell('ember');
  assert.equal(g.focus, focus0);
  assert.equal(g.caption, null, 'nothing happens at all');
});

// --- World generation and art -----------------------------------------------

test('zombies generate rarely and stay inside their chunks', () => {
  let zombies = 0;
  const N = 40;
  for (let cx = 0; cx < N; cx++) {
    for (let cy = 0; cy < N; cy++) {
      const chunk = generateChunk(33, cx, cy);
      for (const z of chunk.zombies) {
        zombies++;
        assert.ok(z.x >= cx * CHUNK && z.x < (cx + 1) * CHUNK);
        assert.ok(z.y >= cy * CHUNK && z.y < (cy + 1) * CHUNK);
        assert.equal(typeof z.phase, 'number');
      }
    }
  }
  assert.ok(zombies > 0, 'the dead walk somewhere');
  assert.ok(zombies < N * N * 0.05, '...but rarely');
});

test('every sheet icon exists, is rectangular, and stays in the palette', () => {
  const expected = [...ABILITIES, 'bone', 'meat', 'ball'];
  const palette = new Set(Object.values(PALETTE));
  for (const id of expected) {
    const art = ICONS[id];
    assert.ok(art, `icon '${id}' exists`);
    assert.equal(art.sprite.length, 9, `${id} is 9 tall`);
    for (const row of art.sprite) {
      assert.equal(row.length, 9, `${id} is 9 wide`);
      for (const ch of row) {
        if (ch === '.') continue;
        assert.ok(ch in art.colors, `${id}: color '${ch}' known`);
        assert.ok(palette.has(art.colors[ch]), `${id}: '${ch}' in the palette`);
      }
    }
    assert.ok(art.sprite.some((r) => /[^.]/.test(r)), `${id} is not empty`);
  }
});

test('the zombie sprite is rectangular with known colors, and it lurches', () => {
  for (const row of ZOMBIE_SPRITE) {
    assert.equal(row.length, ZOMBIE_SPRITE[0].length, 'rectangular');
    for (const ch of row) assert.ok(ch === '.' || ch in ZOMBIE_COLORS, `zombie '${ch}'`);
  }
  assert.ok(ZOMBIE_SPRITE.some((row) => row.includes('e')), 'it keeps its eye');
  assert.equal(zombieSway(1.3, 0), zombieSway(1.3, 0), 'deterministic');
  const seen = new Set();
  for (let t = 0; t < 4; t += 0.1) seen.add(zombieSway(t, 0));
  assert.deepEqual([...seen].sort(), [0, 1], 'the shamble lurches between two poses');
});

test('the vision that teaches you also fuels you — until you sober up', () => {
  const g = flatGame();
  g.stats.wis = 6; // a sober pool of exactly 1 (a -2 modifier)
  assert.equal(g.maxFocus(), 1);
  g.drunk = DRUNK_TIME; // the pipe's ten minutes: WIS +2
  assert.equal(g.maxFocus(), FOCUS_BASE, 'the colors lend you the points back');
  g.learnSpell();
  assert.equal(g.focus, FOCUS_BASE, 'and the vision fills the bigger pool');
  g.drunk = 0.01;
  runSeconds(g, 0.1);
  assert.equal(g.drunk, 0);
  assert.equal(g.focus, 1, 'sobering up takes the borrowed point back');
});
