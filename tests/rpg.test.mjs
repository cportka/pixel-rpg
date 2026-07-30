// The v0.9 D&D layer: rolled abilities, modifiers, the drunk timer, the
// character sheet, the meaty bone, and the zombie fight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, MAX_HP, COLLAPSE_HP, ABILITIES,
  DC_FISTS, DC_BONE, ZOMBIE_HP, ZOMBIE_BITE, DRUNK_TIME, DRUNK_WIS_BONUS,
  BONE_WEIGHT, MEAT_WEIGHT,
  START_STAT, XP_PER_LEVEL, LEVEL_POINTS, XP_DOG, XP_ZOMBIE, MEET_RADIUS,
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
 * Walk up to a planted zombie until its menu opens. Sound events are drained
 * per step into g.heard (mirroring main.js) so the cap can't swallow them.
 */
function zombieGame({ bone = false } = {}) {
  const g = flatGame();
  g.hasBone = bone;
  g.world.chunkAt(0, 0).zombies.push({ x: 40, y: 0, phase: 0 });
  g.heard = [];
  const steps = Math.ceil(6 / STEP);
  for (let i = 0; i < steps && !g.choice; i++) {
    g.update(STEP, { right: true });
    g.heard.push(...g.events);
    g.events.length = 0;
  }
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

// --- The zombie -------------------------------------------------------------

test('a zombie shambles up: groan, menu, no bone option bare-handed', () => {
  const g = zombieGame();
  assert.ok(g.choice, 'the zombie menu opened');
  assert.equal(g.choice.kind, 'zombie');
  assert.equal(g.choice.title, 'A ZOMBIE SHAMBLES IN PLACE');
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'fists', 'run']);
  assert.ok(g.heard.includes('zombie'), 'it groaned on approach');
});

test('befriending the zombie just gets you bitten (-2 HP)', () => {
  const g = zombieGame();
  g.hp = 8;
  g.resolveChoice('befriend');
  assert.equal(g.hp, 8 - ZOMBIE_BITE);
  assert.equal(g.caption.text, 'THE ZOMBIE DOES NOT WANT FRIENDS');
  assert.ok(g.captionQueue.includes(`IT BITES (-${ZOMBIE_BITE} HP)`));
  assert.ok(g.choice, 'it is still coming — the fight menu reopens');
  assert.equal(g.choice.kind, 'zombie');
});

test('fists: DC 12, 2 damage — two clean hits drop it', () => {
  const g = zombieGame();
  const key = g.choice.key;
  g.rng = () => 0.99; // roll 20
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20 - YOU LAND ONE. IT STAGGERS');
  assert.equal(g.zombieHp.get(key), ZOMBIE_HP - 2);
  assert.ok(g.choice, 'half-dead is not dead');
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20 - YOU LAND ONE');
  assert.ok(g.captionQueue.includes('THE ZOMBIE CRUMBLES. THE FOREST EXHALES'));
  assert.ok(g.encounterDone.has(key), 'it stays down');
  assert.equal(g.zombieHp.has(key), false, 'fight state cleaned up');
  assert.equal(g.choice, null);
});

test('the bone is the better club: DC 9, 3 damage, and it bonks', () => {
  const g = zombieGame({ bone: true });
  assert.deepEqual(g.choice.options.map((o) => o.id), ['befriend', 'fists', 'bone', 'run']);
  const key = g.choice.key;
  g.events.length = 0;
  g.rng = () => 0.45; // roll 10: lands with the bone, would miss bare-handed
  g.resolveChoice('bone');
  assert.ok(g.events.includes('bonk'));
  assert.equal(g.caption.text, 'D20: 10 - BONK! IT STAGGERS');
  assert.equal(g.zombieHp.get(key), ZOMBIE_HP - 3);
  g.resolveChoice('bone'); // 1 HP left, 3 damage
  assert.equal(g.caption.text, 'D20: 10 - BONK! THE BONE RINGS TRUE');
  assert.ok(g.captionQueue.includes('THE ZOMBIE CRUMBLES. THE FOREST EXHALES'));
  assert.ok(g.encounterDone.has(key));
  assert.ok(DC_BONE < DC_FISTS, 'the club is the easier swing');
});

test('a miss means teeth: bitten (-2 HP) and the zombie looms again', () => {
  const g = zombieGame();
  g.hp = 9;
  g.rng = () => 0.3; // roll 7 < DC_FISTS
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 7 - YOU MISS');
  assert.equal(g.hp, 9 - ZOMBIE_BITE);
  assert.ok(g.captionQueue.includes(`IT BITES (-${ZOMBIE_BITE} HP)`));
  assert.ok(g.choice, 'the fight is not over');
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
  const key = g.choice.key;
  g.stats.str = 16; // +3 to hit, 4 damage
  g.rng = () => 0.8; // roll 17, +3 = 20
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 17+3 - YOU LAND ONE');
  assert.ok(g.encounterDone.has(key), 'one punch');
  assert.equal(g.choice, null);
});

test('a feeble hit bounces off harmlessly — and earns no bite', () => {
  const g = zombieGame();
  const key = g.choice.key;
  g.stats.str = 3; // -4 to hit, 0 damage
  g.hp = 9;
  g.rng = () => 0.99; // roll 20, -4 = 16: still a hit
  g.resolveChoice('fists');
  assert.equal(g.caption.text, 'D20: 20-4 - YOUR FISTS BOUNCE OFF HARMLESSLY');
  assert.equal(g.hp, 9, 'you did, technically, hit it');
  assert.equal(g.zombieHp.get(key) ?? ZOMBIE_HP, ZOMBIE_HP, 'unhurt');
  assert.ok(g.choice, 'the standoff continues');
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

test('running away costs nothing — the cooldown covers your exit', () => {
  const g = zombieGame();
  g.hp = 8;
  g.resolveChoice('run');
  assert.equal(g.choice, null);
  assert.equal(g.hp, 8, 'no parting bite');
  runSeconds(g, 1.2);
  assert.equal(g.choice, null, 'cooldown holds while you stand there shaking');
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
