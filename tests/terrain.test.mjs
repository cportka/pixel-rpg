// The terrain layer (biomes, rivers, lakes, bridges, landmarks) and the
// person's fading memory of it (HUD minimap + the map pause screen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION, BIOMES, RIVER_EVERY, RIVER_COL, RIVER_W, BRIDGE_EVERY, BRIDGE_H,
  regionAt, isHomeRegion, biomeAt, regionHasRiver, riverNear, inRiver,
  bridgeYNear, onBridge, lakeAt, isWater, regionInfo, regionLandmarks,
} from '../src/core/terrain.js';
import { World, generateChunk, CHUNK } from '../src/core/world.js';
import { Game, MEM_FRESH, MEM_FADED } from '../src/core/game.js';
import { choicePanel, hudRect, SCREEN_W, SCREEN_H } from '../src/gfx/renderer.js';
import {
  CABIN_SPRITE, CABIN_COLORS, CAVE_SPRITE, CAVE_COLORS,
  cabinWindowLit, caveGlint, rockPixels, TUFT_PIXELS,
} from '../src/gfx/structures.js';

const STEP = 1 / 60;
const SEED = 77;

function runSeconds(g, seconds, input = {}) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) g.update(STEP, input);
}

/** Scan a square of regions and return them grouped by biome. */
function scanRegions(seed, span = 20) {
  const byBiome = new Map(BIOMES.map((b) => [b, []]));
  for (let rx = -span; rx <= span; rx++) {
    for (let ry = -span; ry <= span; ry++) {
      byBiome.get(biomeAt(seed, rx, ry)).push({ rx, ry });
    }
  }
  return byBiome;
}

// --- Biomes -----------------------------------------------------------------

test('biomes are deterministic, diverse, and home is always oak', () => {
  assert.equal(biomeAt(SEED, 3, -7), biomeAt(SEED, 3, -7));
  const byBiome = scanRegions(SEED);
  for (const b of BIOMES) {
    assert.ok(byBiome.get(b).length > 0, `${b} exists somewhere`);
  }
  for (const [rx, ry] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    assert.ok(isHomeRegion(rx, ry));
    assert.equal(biomeAt(SEED, rx, ry), 'oak', 'the home woods are dry oak');
  }
  assert.equal(isHomeRegion(1, 0), false);
});

test('a different seed deals a different world', () => {
  let differs = 0;
  for (let rx = 1; rx < 30; rx++) {
    if (biomeAt(1, rx, 5) !== biomeAt(2, rx, 5)) differs++;
  }
  assert.ok(differs > 5, `seeds disagree on ${differs} of 29 regions`);
});

// --- Rivers, bridges, lakes -------------------------------------------------

test('rivers run down every fifth region column and meander inside it', () => {
  assert.ok(regionHasRiver(RIVER_COL));
  assert.ok(regionHasRiver(RIVER_COL + RIVER_EVERY));
  assert.ok(regionHasRiver(RIVER_COL - RIVER_EVERY), 'negative columns too');
  assert.equal(regionHasRiver(0), false, 'no river through home');
  const colCenter = RIVER_COL * REGION + REGION / 2;
  for (let y = -1000; y <= 1000; y += 137) {
    const r = riverNear(SEED, colCenter, y);
    assert.ok(Math.abs(r.center - colCenter) <= 60, 'meander stays in its column');
    assert.ok(inRiver(SEED, r.center, y), 'the center line is wet');
    assert.equal(inRiver(SEED, r.center + RIVER_W, y), false, 'the far bank is dry');
  }
});

test('every river region has a bridge, and bridges are dry deck', () => {
  const colCenter = RIVER_COL * REGION + REGION / 2;
  // Max gap between bridges is 630px < REGION 640, so any region-tall window
  // holds at least one.
  for (let wy = -2000; wy <= 2000; wy += REGION) {
    const by = bridgeYNear(SEED, 0, wy + REGION / 2);
    assert.ok(Math.abs(by - (wy + REGION / 2)) <= REGION, 'a bridge within reach');
  }
  const by = bridgeYNear(SEED, 0, 0);
  const r = riverNear(SEED, colCenter, by);
  assert.ok(onBridge(SEED, r.center, by), 'the deck is a bridge');
  assert.equal(isWater(SEED, r.center, by), false, 'the deck is dry');
  const midspan = by + BRIDGE_EVERY / 2;
  const r2 = riverNear(SEED, colCenter, midspan);
  if (Math.abs(midspan - bridgeYNear(SEED, 0, midspan)) > BRIDGE_H) {
    assert.equal(isWater(SEED, r2.center, midspan), true, 'between bridges is water');
  }
});

test('lake regions hold water; dry regions hold none', () => {
  const byBiome = scanRegions(SEED);
  const lakeRegion = byBiome.get('lake').find((r) => !regionHasRiver(r.rx));
  assert.ok(lakeRegion, 'a riverless lake region exists');
  const lake = lakeAt(SEED, lakeRegion.rx, lakeRegion.ry);
  assert.ok(lake, 'lake geometry exists');
  assert.ok(isWater(SEED, lake.cx, lake.cy), 'the middle of the lake is wet');
  const grassRegion = byBiome.get('grass').find((r) => !regionHasRiver(r.rx));
  assert.ok(grassRegion);
  assert.equal(lakeAt(SEED, grassRegion.rx, grassRegion.ry), null);
  assert.equal(
    isWater(SEED, grassRegion.rx * REGION + REGION / 2, grassRegion.ry * REGION + REGION / 2),
    false,
    'grassland is dry',
  );
});

// --- Landmarks --------------------------------------------------------------

test('cabins are rare, land-bound, and stand in forests or grass', () => {
  let cabins = 0;
  let land = 0;
  for (let rx = -20; rx <= 20; rx++) {
    for (let ry = -20; ry <= 20; ry++) {
      const info = regionInfo(SEED, rx, ry);
      if (['oak', 'redwood', 'grass'].includes(info.biome) && !isHomeRegion(rx, ry)) land++;
      if (!info.cabin) continue;
      cabins++;
      assert.ok(['oak', 'redwood', 'grass'].includes(info.biome), 'cabins avoid water and rock');
      assert.ok(info.cabin.x >= rx * REGION && info.cabin.x < (rx + 1) * REGION);
      assert.ok(info.cabin.y >= ry * REGION && info.cabin.y < (ry + 1) * REGION);
      assert.equal(isWater(SEED, info.cabin.x, info.cabin.y), false);
    }
  }
  assert.ok(cabins > 0, 'somewhere, a cabin');
  assert.ok(cabins < land * 0.2, `...but rarely (${cabins} of ${land})`);
});

test('mountains keep their caves (unless a river drowned the spot)', () => {
  const byBiome = scanRegions(SEED);
  const mountains = byBiome.get('mountain');
  const withCave = mountains.filter((r) => regionInfo(SEED, r.rx, r.ry).cave);
  assert.ok(withCave.length > mountains.length / 2, 'most mountains have a cave');
  const cave = regionInfo(SEED, withCave[0].rx, withCave[0].ry).cave;
  assert.equal(isWater(SEED, cave.x, cave.y), false);
});

test('regionLandmarks summarizes what the map remembers', () => {
  const marks = regionLandmarks(SEED, RIVER_COL, 4);
  assert.ok(marks.water && marks.bridge, 'river regions carry water and a bridge');
  assert.ok(BIOMES.includes(marks.biome));
  const home = regionLandmarks(SEED, 0, 0);
  assert.deepEqual(
    [home.biome, home.cabin, home.cave, home.water, home.bridge],
    ['oak', false, false, false, false],
    'home is plain remembered woods',
  );
});

// --- Biome-aware chunks -----------------------------------------------------

test('chunk density follows the biome: redwood > oak > grass', () => {
  const byBiome = scanRegions(SEED, 12);
  const meanTrees = (regions) => {
    let total = 0;
    let n = 0;
    for (const { rx, ry } of regions.slice(0, 40)) {
      const chunk = generateChunk(SEED, rx * 4 + 1, ry * 4 + 1);
      total += chunk.trees.filter((t) => t.kind === 'tree').length;
      n++;
    }
    return total / n;
  };
  const redwood = meanTrees(byBiome.get('redwood'));
  const oak = meanTrees(byBiome.get('oak'));
  const grass = meanTrees(byBiome.get('grass'));
  assert.ok(redwood > oak + 1, `redwoods are dense (${redwood.toFixed(1)} vs ${oak.toFixed(1)})`);
  assert.ok(oak > grass + 0.5, `grasslands are open (${oak.toFixed(1)} vs ${grass.toFixed(1)})`);
});

test('rocks pile up only in the mountains; tufts favor the grass', () => {
  const byBiome = scanRegions(SEED, 12);
  const m = byBiome.get('mountain')[0];
  const g = byBiome.get('grass').find((r) => !regionHasRiver(r.rx));
  const mChunk = generateChunk(SEED, m.rx * 4 + 1, m.ry * 4 + 1);
  const gChunk = generateChunk(SEED, g.rx * 4 + 1, g.ry * 4 + 1);
  assert.equal(mChunk.biome, 'mountain');
  assert.equal(gChunk.biome, 'grass');
  assert.ok(mChunk.rocks.length > 0, 'mountains are rocky');
  assert.equal(gChunk.rocks.length, 0, 'grasslands are not');
  assert.ok(gChunk.tufts.length >= 8, 'grass grows grass');
  for (const r of mChunk.rocks) {
    assert.ok(Number.isInteger(r.detailSeed) && r.size >= 10);
  }
});

test('nothing generates in the water', () => {
  // Chunks straddling the river column near home.
  for (let cy = -4; cy <= 4; cy++) {
    const chunk = generateChunk(SEED, RIVER_COL * 4 + 2, cy);
    const all = [
      ...chunk.trees, ...chunk.dumpsters, ...chunk.cats, ...chunk.lamps,
      ...chunk.pipes, ...chunk.zombies, ...chunk.rocks, ...chunk.tufts,
      ...chunk.inflatables, ...chunk.cabins, ...chunk.caves,
    ];
    for (const f of all) {
      assert.equal(isWater(SEED, f.x, f.y), false, `feature at ${f.x},${f.y} is drowning`);
    }
  }
});

test('a cabin stands in exactly one chunk of its region', () => {
  let found = null;
  for (let rx = -20; rx <= 20 && !found; rx++) {
    for (let ry = -20; ry <= 20 && !found; ry++) {
      const info = regionInfo(SEED, rx, ry);
      if (info.cabin) found = info;
    }
  }
  assert.ok(found);
  let cabins = 0;
  for (let cx = found.rx * 4; cx < (found.rx + 1) * 4; cx++) {
    for (let cy = found.ry * 4; cy < (found.ry + 1) * 4; cy++) {
      cabins += generateChunk(SEED, cx, cy).cabins.length;
    }
  }
  assert.equal(cabins, 1);
});

test('water and rocks block movement; bridges are walkable', () => {
  const w = new World(SEED);
  const colCenter = RIVER_COL * REGION + REGION / 2;
  const midspan = bridgeYNear(SEED, 0, 0) + BRIDGE_EVERY / 2;
  if (Math.abs(midspan - bridgeYNear(SEED, 0, midspan)) > BRIDGE_H) {
    const r = riverNear(SEED, colCenter, midspan);
    assert.ok(w.collides(r.center - 2, midspan - 1, 4, 3), 'the river blocks');
  }
  const by = bridgeYNear(SEED, 0, 0);
  const rb = riverNear(SEED, colCenter, by);
  assert.equal(w.collides(rb.center - 2, by - 1, 4, 3), false, 'the bridge carries you');

  const byBiome = scanRegions(SEED, 12);
  const m = byBiome.get('mountain')[0];
  const chunk = w.chunkAt(m.rx * 4 + 1, m.ry * 4 + 1);
  if (chunk.rocks.length > 0) {
    const rock = chunk.rocks[0];
    assert.ok(w.collides(rock.x - 1, rock.y - 2, 2, 2), 'rock blocks');
  }
});

// --- Memory -----------------------------------------------------------------

function memGame() {
  const g = new Game(1, { story: false });
  g.world.collides = () => false;
  runSeconds(g, 0.6); // one memory sweep
  return g;
}

test('the person memorizes the regions around them', () => {
  const g = memGame();
  assert.equal(g.memory.size, 9, 'a 3x3 of regions');
  const here = g.memory.get('0,0');
  assert.ok(here);
  assert.equal(here.biome, 'oak');
  assert.equal(g.memoryLevel(here), 'fresh');
});

test('memories fade over minutes down to the barest outline', () => {
  const g = memGame();
  const here = g.memory.get('0,0');
  assert.equal(g.memoryLevel(here), 'fresh');
  here.seenAt = g.time - (MEM_FRESH + 1);
  assert.equal(g.memoryLevel(here), 'faded');
  here.seenAt = g.time - (MEM_FADED + 1);
  assert.equal(g.memoryLevel(here), 'outline');
  assert.ok(MEM_FADED >= 4 * 60, 'the outline takes minutes to set in');
});

test('memory persists after leaving — remembered once seen', () => {
  const g = memGame();
  const seenAt = g.memory.get('0,0').seenAt;
  g.person.x = 7 * REGION + REGION / 2; // a long way east
  g.dog.x = g.person.x - 18;
  runSeconds(g, 0.6);
  assert.ok(g.memory.get('7,0'), 'the new region is learned');
  const old = g.memory.get('0,0');
  assert.ok(old, 'the old region is not forgotten');
  assert.equal(old.seenAt, seenAt, '...but it stopped refreshing');
});

// --- The map screen and HUD -------------------------------------------------

test('the map opens on P (or a HUD tap), pauses the world, and closes', () => {
  const g = memGame();
  g.update(STEP, { map: true });
  assert.ok(g.choice, 'map open');
  assert.equal(g.choice.kind, 'map');
  assert.equal(g.choice.title, 'WHAT YOU REMEMBER');
  assert.ok(g.menuPaused());
  const t0 = g.time;
  runSeconds(g, 1);
  assert.equal(g.time, t0, 'the map pauses the world');
  g.resolveChoice('close');
  assert.equal(g.choice, null);
  runSeconds(g, 0.1);
  assert.ok(g.time > t0, 'the world resumes');
});

test('map panel fills the screen; HUD sits in the top-right corner', () => {
  const g = memGame();
  g.openMap();
  const panel = choicePanel(g);
  assert.ok(panel.w >= SCREEN_W - 16 && panel.h >= SCREEN_H - 16, 'full-screen map');
  for (const row of panel.rows) {
    assert.ok(row.y >= panel.y && row.y + row.h <= panel.y + panel.h, 'rows inside');
  }
  const hud = hudRect();
  assert.ok(hud.x + hud.w <= SCREEN_W && hud.y >= 0 && hud.x > SCREEN_W / 2, 'top-right');
  assert.ok(hud.y + hud.h < SCREEN_H / 2);
});

// --- Structure art ----------------------------------------------------------

test('cabin and cave sprites are rectangular with known colors', () => {
  for (const [sprite, colors] of [[CABIN_SPRITE, CABIN_COLORS], [CAVE_SPRITE, CAVE_COLORS]]) {
    for (const row of sprite) {
      assert.equal(row.length, sprite[0].length, 'rectangular');
      for (const ch of row) assert.ok(ch === '.' || ch in colors, `unknown '${ch}'`);
    }
  }
  assert.ok(CABIN_SPRITE.some((r) => r.includes('W')), 'the cabin has its window');
  assert.ok(CAVE_SPRITE.some((r) => r.includes('A')), 'the cave has its dark');
});

test('the window and the glint keep their own hours', () => {
  let lit = 0;
  let glints = 0;
  for (let t = 0; t < 30; t += 0.25) {
    if (cabinWindowLit(t)) lit++;
    if (caveGlint(t)) glints++;
  }
  assert.ok(lit > 60 && lit < 120, `the window is lit most of the time (${lit}/120)`);
  assert.ok(glints > 0 && glints < 30, `the cave glints only sometimes (${glints}/120)`);
});

test('rocks are deterministic angular mounds', () => {
  assert.deepEqual(rockPixels(14, 123), rockPixels(14, 123));
  assert.notDeepEqual(rockPixels(14, 123), rockPixels(14, 124), 'seeds differ');
  const px = rockPixels(16, 5);
  assert.ok(px.length > 20, 'a real pile');
  for (const p of px) assert.ok(p.y <= 0, 'rocks rise from their anchor');
  assert.equal(TUFT_PIXELS.length, 3, 'a tuft is three pixels');
});
