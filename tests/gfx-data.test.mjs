import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SPRITE_COLORS, SPARKLE_TINTS, LEASH_COLORS } from '../src/gfx/palette.js';
import {
  PERSON_FRAMES, DOG_FRAMES, BALL_SPRITE, HEART_SPRITE, walkFrame, spriteSize,
} from '../src/gfx/sprites.js';
import {
  GLYPHS, GLYPH_H, TRACKING, SPACE_W, glyphWidth, measureText, textPixels, wrapText,
} from '../src/gfx/font.js';
import { treePixels, BLOCK_W } from '../src/gfx/trees.js';
import { inflatablePixels, INFLATABLE_TINTS } from '../src/gfx/inflatables.js';

const HEX = /^#[0-9a-f]{6}$/;

test('palette entries are well-formed hex colors', () => {
  for (const [name, value] of Object.entries(PALETTE)) {
    assert.match(value, HEX, `PALETTE.${name}`);
  }
  for (const tint of SPARKLE_TINTS) assert.match(tint, HEX);
  for (const c of LEASH_COLORS) assert.match(c, HEX);
  assert.ok(LEASH_COLORS.length >= 3, 'leash cycles through at least 3 colors');
});

function checkSpriteMap(name, map) {
  const w = map[0].length;
  for (const row of map) {
    assert.equal(row.length, w, `${name}: ragged row`);
    for (const ch of row) {
      assert.ok(ch === '.' || ch in SPRITE_COLORS, `${name}: unknown pixel '${ch}'`);
    }
  }
  assert.ok(map.some((row) => [...row].some((ch) => ch !== '.')), `${name}: empty sprite`);
}

test('all sprite maps are rectangular and use palette keys', () => {
  for (const [frame, map] of Object.entries(PERSON_FRAMES)) checkSpriteMap(`person.${frame}`, map);
  for (const [frame, map] of Object.entries(DOG_FRAMES)) checkSpriteMap(`dog.${frame}`, map);
  checkSpriteMap('ball', BALL_SPRITE);
  checkSpriteMap('heart', HEART_SPRITE);
});

test('sprites match the reference proportions', () => {
  const person = spriteSize(PERSON_FRAMES.stand);
  assert.ok(person.h >= 16, `person is tall (${person.h}px)`);
  assert.ok(person.w <= 12, 'person is thin');
  const dog = spriteSize(DOG_FRAMES.stand);
  assert.ok(dog.w >= 12, 'dog is long');
  assert.ok(dog.h < person.h, 'dog is shorter than the person');
});

test('the stride B-frames are exact mirrors of the A-frames', () => {
  for (const pose of ['contact', 'down', 'pass']) {
    const a = PERSON_FRAMES[`${pose}A`];
    const b = PERSON_FRAMES[`${pose}B`];
    assert.deepEqual(
      b,
      a.map((row) => [...row].reverse().join('')),
      `${pose}B mirrors ${pose}A`,
    );
  }
});

test('the person stride uses six distinct frames', () => {
  const seen = new Set();
  for (let t = 0; t < 6 / 7.5; t += 1 / 60) seen.add(walkFrame(PERSON_FRAMES, true, t));
  assert.equal(seen.size, 6, 'contact/down/pass on both legs');
});

test('every character frame is one connected silhouette (no severed pixels)', () => {
  // Regression: a 1px hole in the walk frames left a floating 2px forearm.
  const components = (map) => {
    const lit = new Set();
    map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') lit.add(`${x},${y}`); }));
    let count = 0;
    const seen = new Set();
    for (const start of lit) {
      if (seen.has(start)) continue;
      count++;
      const stack = [start];
      while (stack.length) {
        const cell = stack.pop();
        if (seen.has(cell)) continue;
        seen.add(cell);
        const [cx, cy] = cell.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const n = `${cx + dx},${cy + dy}`;
            if (lit.has(n) && !seen.has(n)) stack.push(n);
          }
        }
      }
    }
    return count;
  };
  for (const [name, map] of Object.entries(PERSON_FRAMES)) {
    assert.equal(components(map), 1, `person.${name} has floating pixels`);
  }
  for (const [name, map] of Object.entries(DOG_FRAMES)) {
    assert.equal(components(map), 1, `dog.${name} has floating pixels`);
  }
});

test('walk frames within a set share one canvas size', () => {
  for (const frames of [PERSON_FRAMES, DOG_FRAMES]) {
    const sizes = Object.values(frames).map((m) => JSON.stringify(spriteSize(m)));
    assert.equal(new Set(sizes).size, 1);
  }
});

test('walkFrame rests on stand and cycles through the stride', () => {
  assert.equal(walkFrame(PERSON_FRAMES, false, 12.3), PERSON_FRAMES.stand);
  const seen = new Set();
  for (let t = 0; t < 1; t += 1 / 60) seen.add(walkFrame(PERSON_FRAMES, true, t));
  assert.ok(seen.size >= 3, 'a full stride uses at least 3 distinct frames');
  const dogSeen = new Set();
  for (let t = 0; t < 1; t += 1 / 60) dogSeen.add(walkFrame(DOG_FRAMES, true, t));
  assert.ok(dogSeen.size >= 2, 'dog trot alternates');
});

test('walk cadence is chunky, not fluttering', () => {
  // At the reference cadence a frame holds for multiple 60Hz ticks.
  let changes = 0;
  let prev = null;
  for (let i = 0; i < 60; i++) {
    const f = walkFrame(PERSON_FRAMES, true, i / 60);
    if (f !== prev) changes++;
    prev = f;
  }
  assert.ok(changes <= 10, `${changes} frame changes in 1s — should be ~7.5`);
  assert.ok(changes >= 5, `${changes} frame changes in 1s — should be ~7.5`);
});

test('font glyphs are 8 tall, rectangular, and use only X/.', () => {
  for (const [ch, glyph] of Object.entries(GLYPHS)) {
    assert.equal(glyph.length, GLYPH_H, `glyph '${ch}' height`);
    const w = glyph[0].length;
    assert.ok(w >= 2, `glyph '${ch}' width`);
    for (const row of glyph) {
      assert.equal(row.length, w, `glyph '${ch}' ragged`);
      assert.match(row, /^[X.]+$/, `glyph '${ch}' bits`);
    }
  }
});

test('the font is bold: every letter stem is at least 2px thick', () => {
  // Sample a few letters whose left edge is a vertical stem.
  for (const ch of ['H', 'L', 'B', 'N', 'K']) {
    const glyph = GLYPHS[ch];
    for (const row of glyph) {
      if (row.startsWith('X')) assert.ok(row.startsWith('XX'), `'${ch}' stem row '${row}'`);
    }
  }
});

test('the font is variable-width (narrow I)', () => {
  assert.ok(glyphWidth('I') < glyphWidth('H'), 'I is narrower than H');
  assert.equal(glyphWidth(' '), SPACE_W);
});

test('every caption the game can show can be typeset', () => {
  const captions = [
    'IN THE BEGINNING THERE WAS ONLY THE DARK',
    'ONE SMALL PERSON, ALL ALONE IN THE WOODS',
    'A SOFT WHIMPER DRIFTS FROM THE NORTH',
    'A SOFT WHIMPER DRIFTS FROM THE SOUTH',
    'A SOFT WHIMPER DRIFTS FROM THE EAST',
    'A SOFT WHIMPER DRIFTS FROM THE WEST',
    'A FRIENDLY LOST DOG!',
    'TOGETHER WE WILL FIND HOME',
    'THE INFLATABLES DANCE. NO ONE KNOWS WHY',
    'FETCH IS OUR FAVORITE GAME!',
    'THE WOODS FEEL WARMER NOW',
    'HOME IS OUT THERE SOMEWHERE',
    'YOU ARE THE PERSON',
    'YOU ARE THE DOG',
    'GOOD DOG',
    'A DUMPSTER BURNS IN THE DARK',
    'SEARCH THE DUMPSTER',
    'PUT OUT THE FIRE (HOW?)',
    'WALK AWAY',
    'D20: 20 - YOU PULL OUT A MEATY BONE',
    'D20: 1 - THE FIRE BITES YOU (-1 HP)',
    'D20: 14+2 - SOMEHOW YOU SMOTHER IT',
    'D20: 9-1 - WITH WHAT? IT BURNS ON',
    'A MEATY BONE',
    'GNAW OFF THE MEAT (+2 HP)',
    'SAVE IT FOR LATER',
    'YOU GNAW OFF THE MEAT (+2 HP). THE BONE REMAINS',
    'YOU POCKET THE MEATY BONE',
    'D20: 15 - SOMEHOW YOU SMOTHER IT',
    'D20: 7 - WITH WHAT? IT BURNS ON',
    'A PSYCHEDELIC CAT REGARDS YOU',
    'TALK TO HIM',
    'PET HIM',
    'GRAB HIM',
    'THE CAT DISSOLVES INTO STATIC',
    'THE CAT SCRATCHES YOU (-1 HP) AND VANISHES',
    'YOU COLLAPSE. THE DOG WATCHES OVER YOU',
    'YOU COLLAPSE. THE DARK IS PATIENT',
    'HP 10',
    'AN OLD LAMP GLINTS IN THE LITTER',
    'RUB THE LAMP',
    'LEAVE IT BE',
    'D20: 20 - A GENIE BILLOWS OUT IN VIOLET SMOKE',
    'D20: 3 - ONLY DUST AND A FAINT COUGH INSIDE',
    'THE GENIE OFFERS ONE WISH',
    'WISH FOR HEALTH',
    'WISH FOR HOME',
    'WISH FOR MORE WISHES',
    'YOUR WOUNDS UNWIND (FULL HP)',
    'THE GENIE POINTS. HOME IS FAR TO THE NORTH',
    'THE GENIE ROLLS HIS EYES AND VANISHES',
    'A PIPE OF HALF-BURNT GREEN LEAF',
    'SMOKE THE PIPE',
    'SNIFF IT',
    'D20: 20 - THE STARS LEAN CLOSER',
    'A VISION: THE INFLATABLES DANCE AT THE CENTER OF ALL THINGS',
    'D20: 2 - YOU COUGH FOR A FULL MINUTE (-1 HP)',
    'D20: 11 - NOTHING. PROBABLY OAK LEAF',
    'THE PIPE IS SPENT',
    'IT SMELLS LIKE REGRET AND LAWN CLIPPINGS',
    'THE COLORS LEAN CLOSER TOO (DRUNK 10:00)',
    'THE WORLD SETTLES BACK DOWN',
    'DRUNK 9:59',
    'A ZOMBIE SHAMBLES IN PLACE',
    'TRY TO BEFRIEND IT',
    'ATTACK WITH FISTS',
    'SWING THE BONE',
    'RUN AWAY',
    'THE ZOMBIE DOES NOT WANT FRIENDS',
    'D20: 20 - YOU LAND ONE. IT STAGGERS',
    'D20: 20 - BONK! THE BONE RINGS TRUE',
    'D20: 20 - BONK! IT STAGGERS',
    'D20: 20 - YOU LAND ONE',
    'D20: 4 - YOU MISS',
    'THE ZOMBIE CRUMBLES. THE FOREST EXHALES',
    'IT BITES (-2 HP)',
    'IT TASTES A LITTLE OF YOUR BRAIN (-1 INT)',
    'THE DOG DRAGS YOU AWAY',
    'YOU WAKE ALONE, AND LIGHTER',
    'YOU',
    'CLOSE',
    'WHAT YOU REMEMBER',
    'GNAW THE BONE MEAT (+2 HP)',
    'THROW THE BALL',
    'YOU PUNCH AT THE DARK. IT DOES NOT MIND',
    'YOU SWING AT THE DARK. IT DOES NOT MIND',
    'D20: 20-4 - YOUR FISTS BOUNCE OFF HARMLESSLY',
    'HP 10 OF 10',
    'WEIGHT 7 OF 300 LBS',
    'LVL 1  XP 0 OF 10',
    'LVL 2  XP 3/10',
    'DRUNK 9:59 (WIS +2)',
    '+4 XP',
    '+1 XP',
    'LEVEL 2!',
    'CHOOSE 2 STAT POINTS',
    'PICK +1 (2 LEFT)',
    'STR 2 > 3',
    'YOU FEEL SHARPER',
    'STRENGTH',
    'INTELLIGENCE',
    'WISDOM',
    'DEXTERITY',
    'CONSTITUTION',
    'CHARISMA',
    'SCORE 2  MOD -4',
    'CHECKS ROLL D20-4',
    'FISTS DEAL 0 DMG',
    'THE BONE DEALS 1',
    'SEARCHING DUMPSTERS IS DC 10',
    'ZOMBIES FIND IT DELICIOUS',
    'THE PIPE ANSWERS TO IT (DC 15)',
    '+2 WHILE THE COLORS LEAN IN',
    'NOTHING ASKS FOR IT YET',
    'IT WAITS',
    'CARRY: STR X 10 + CON X 20',
    '= 60 LBS',
    'GENIES ANSWER TO CHARM (DC 12)',
    'THE BONE',
    'A GOOD CLUB: DC 9, 1 DMG',
    'WEIGHS 5 LBS',
    'MEAT ON THE BONE',
    'GNAW FOR +2 HP. ONE SERVING',
    'WEIGHS 2 LBS',
    'THE PINK BALL',
    'FETCH MENDS THE HEART (+1 HP)',
    'PUNCH SOMETHING',
    'BACK',
    'THE DOOR WAS NOT LOCKED',
    'IT SHUT ITSELF BEHIND YOU ANYWAY',
    'THE MANSION AGAIN. IT REMEMBERS YOU',
    'THE NIGHT AIR AGAIN',
    'AN OLD PORTRAIT',
    'LOOK CLOSER',
    'LOOK AWAY',
    'IT IS NO ONE YOU KNOW',
    'IT KNOWS YOU, THOUGH',
    'THE EYES FOLLOW YOU ANYWAY',
    'THE STAIRS ARE LOCKED',
    'WHO LOCKS STAIRS?',
    'NOT IN HERE',
  ];
  for (const text of captions) {
    for (const ch of text) {
      assert.ok(ch === ' ' || ch in GLYPHS, `missing glyph for '${ch}'`);
    }
  }
});

test('measureText and textPixels agree with the glyph data', () => {
  assert.equal(measureText(''), 0);
  assert.equal(measureText('H'), glyphWidth('H'));
  assert.equal(measureText('HI'), glyphWidth('H') + TRACKING + glyphWidth('I'));
  const lit = GLYPHS['I'].join('').split('').filter((b) => b === 'X').length;
  assert.equal(textPixels('I').length, lit);
  // Lowercase maps onto the same glyphs.
  assert.deepEqual(textPixels('dog'), textPixels('DOG'));
});

test('wrapText splits long captions and never exceeds the width', () => {
  const text = 'IN THE BEGINNING THERE WAS ONLY THE DARK';
  const lines = wrapText(text, 160);
  assert.ok(lines.length >= 2, 'long line wraps');
  for (const line of lines) {
    assert.ok(measureText(line) <= 160, `'${line}' too wide`);
  }
  assert.equal(lines.join(' '), text, 'no words lost');
  assert.deepEqual(wrapText('GOOD DOG', 300), ['GOOD DOG'], 'short lines stay whole');
});

test('treePixels is deterministic, block-aligned, and stays near its anchor', () => {
  const tree = { kind: 'tree', x: 0, y: 0, size: 40, variant: 'ember', detailSeed: 12345 };
  const a = treePixels(tree);
  const b = treePixels(tree);
  assert.deepEqual(a, b);
  assert.ok(a.pixels.length > 100, 'a tree is a substantial block cloud');
  const palette = new Set(Object.values(PALETTE));
  for (const p of a.pixels) {
    assert.ok(palette.has(p.c), `off-palette color ${p.c}`);
    assert.equal(Math.abs(p.x % 2), 0, 'blocks sit on even x (2x1 dither)');
    assert.ok(p.x >= a.minX && p.x + BLOCK_W - 1 <= a.maxX);
    assert.ok(p.y >= a.minY && p.y <= a.maxY);
  }
  assert.ok(a.minY < -tree.size * 0.5, 'canopy rises above the trunk base');
  assert.ok(a.maxY <= 4, 'litter stays near the ground line');
});

test('different detail seeds grow different trees', () => {
  const base = { kind: 'tree', x: 0, y: 0, size: 40, variant: 'ember' };
  const a = treePixels({ ...base, detailSeed: 1 });
  const b = treePixels({ ...base, detailSeed: 2 });
  assert.notDeepEqual(a.pixels, b.pixels);
});

test('bushes are squat block clouds', () => {
  const bush = { kind: 'bush', x: 0, y: 0, size: 10, variant: 'leafy', detailSeed: 77 };
  const geo = treePixels(bush);
  assert.ok(geo.pixels.length > 10);
  assert.ok(geo.minY >= -20 && geo.maxY <= 2, 'bush hugs the ground');
});

test('inflatables are deterministic per moment and animate over time', () => {
  const inf = { x: 0, y: 0, h: 26, tint: 1, phase: 0.5, speed: 4 };
  assert.deepEqual(inflatablePixels(inf, 2.0), inflatablePixels(inf, 2.0));
  const a = inflatablePixels(inf, 2.0);
  const b = inflatablePixels(inf, 2.4);
  assert.notDeepEqual(a.pixels, b.pixels, 'the dancer moves');
  const palette = new Set([...Object.values(PALETTE)]);
  for (const p of a.pixels) {
    assert.ok(palette.has(p.c), `off-palette color ${p.c}`);
    assert.equal(Math.abs(p.x % 2), 0, 'blocks sit on even x');
    assert.ok(p.x >= a.minX && p.x + BLOCK_W - 1 <= a.maxX);
    assert.ok(p.y >= a.minY && p.y <= a.maxY);
  }
  assert.equal(a.minY, -inf.h, 'the head crowns the tube');
  assert.ok(a.pixels.length >= inf.h + 6, 'tube + head + both arms');
  for (const tint of INFLATABLE_TINTS) assert.match(tint, /^#[0-9a-f]{6}$/);
});
