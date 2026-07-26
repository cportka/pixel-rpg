import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SPRITE_COLORS, SPARKLE_TINTS } from '../src/gfx/palette.js';
import {
  PERSON_FRAMES, DOG_FRAMES, BALL_SPRITE, HEART_SPRITE, walkFrame, spriteSize,
} from '../src/gfx/sprites.js';
import { GLYPHS, GLYPH_W, GLYPH_H, measureText, textPixels } from '../src/gfx/font.js';
import { treePixels } from '../src/gfx/trees.js';

const HEX = /^#[0-9a-f]{6}$/;

test('palette entries are well-formed hex colors', () => {
  for (const [name, value] of Object.entries(PALETTE)) {
    assert.match(value, HEX, `PALETTE.${name}`);
  }
  for (const tint of SPARKLE_TINTS) assert.match(tint, HEX);
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

test('walk frames within a set share one canvas size', () => {
  for (const frames of [PERSON_FRAMES, DOG_FRAMES]) {
    const sizes = Object.values(frames).map((m) => JSON.stringify(spriteSize(m)));
    assert.equal(new Set(sizes).size, 1);
  }
});

test('walkFrame rests on stand and animates while walking', () => {
  assert.equal(walkFrame(PERSON_FRAMES, false, 12.3), PERSON_FRAMES.stand);
  const seen = new Set();
  for (let t = 0; t < 1; t += 1 / 60) seen.add(walkFrame(DOG_FRAMES, true, t));
  assert.ok(seen.size >= 3, 'walking cycles through multiple frames');
});

test('font glyphs are all 5x7 bitmaps of 0/1', () => {
  for (const [ch, glyph] of Object.entries(GLYPHS)) {
    assert.equal(glyph.length, GLYPH_H, `glyph '${ch}' height`);
    for (const row of glyph) {
      assert.equal(row.length, GLYPH_W, `glyph '${ch}' width`);
      assert.match(row, /^[01]+$/, `glyph '${ch}' bits`);
    }
  }
});

test("every caption the game shows can be typeset", () => {
  const captions = [
    'FETCH IS OUR FAVORITE GAME!',
    'GOOD DOG',
    'YOU ARE THE PERSON',
    'YOU ARE THE DOG',
  ];
  for (const text of captions) {
    for (const ch of text) {
      assert.ok(ch in GLYPHS, `missing glyph for '${ch}'`);
    }
  }
});

test('measureText and textPixels agree with the glyph data', () => {
  assert.equal(measureText(''), 0);
  assert.equal(measureText('A'), GLYPH_W);
  assert.equal(measureText('AB'), GLYPH_W * 2 + 1);
  const lit = GLYPHS['I'].join('').split('').filter((b) => b === '1').length;
  assert.equal(textPixels('I').length, lit);
  // Lowercase maps onto the same glyphs.
  assert.deepEqual(textPixels('dog'), textPixels('DOG'));
});

test('treePixels is deterministic and stays near its anchor', () => {
  const tree = { kind: 'tree', x: 0, y: 0, size: 40, variant: 'ember', detailSeed: 12345 };
  const a = treePixels(tree);
  const b = treePixels(tree);
  assert.deepEqual(a, b);
  assert.ok(a.pixels.length > 100, 'a tree is a substantial pixel cloud');
  const palette = new Set(Object.values(PALETTE));
  for (const p of a.pixels) {
    assert.ok(palette.has(p.c), `off-palette color ${p.c}`);
    assert.ok(p.x >= a.minX && p.x <= a.maxX && p.y >= a.minY && p.y <= a.maxY);
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

test('bushes are squat pixel clouds', () => {
  const bush = { kind: 'bush', x: 0, y: 0, size: 10, variant: 'leafy', detailSeed: 77 };
  const geo = treePixels(bush);
  assert.ok(geo.pixels.length > 10);
  assert.ok(geo.minY >= -20 && geo.maxY <= 2, 'bush hugs the ground');
});
