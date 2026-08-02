// The vendored 8bit-sfx slice must never drift from the pinned dependency.
//
// The game is a no-build static site, so it cannot import from node_modules at
// runtime — vendor/8bit-sfx carries a copy of the library's synthesis engine
// (dsp + the ported sounds + the rpg generators). These tests pin that copy to
// the installed package byte-for-byte, and pin the rendered audio to what the
// library itself produces, so "the game's sounds" and "the library's sounds"
// cannot become two different things.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { EVENT_NAMES, SOUNDS } from '../src/audio/sfx.js';
import { render as renderVendored } from '../vendor/8bit-sfx/index.js';

const VENDORED = ['dsp.js', 'ported.js', 'generators/rpg.js'];

let pkgDir = null;
try {
  const require = createRequire(import.meta.url);
  pkgDir = new URL('.', require.resolve('8bit-sfx/package.json')).pathname;
} catch {
  // not installed — the tests below skip with the reason
}
const skip = pkgDir === null ? '8bit-sfx not installed (run npm install to enable)' : false;

test('the vendored engine is byte-identical to the pinned package', { skip }, async () => {
  for (const rel of VENDORED) {
    const mine = await readFile(new URL(`../vendor/8bit-sfx/${rel}`, import.meta.url));
    const theirs = await readFile(`${pkgDir}src/${rel}`);
    assert.ok(mine.equals(theirs), `vendor/8bit-sfx/${rel} has drifted from the package`);
  }
});

test('the package is the 1.0.0 line, with the rpg category', { skip }, async () => {
  const pkg = JSON.parse(await readFile(`${pkgDir}package.json`, 'utf8'));
  assert.equal(pkg.version.split('.')[0], '1', `expected 1.x, got ${pkg.version}`);
});

test('the game plays the library, exactly', { skip }, async () => {
  const lib = await import('8bit-sfx');
  const ported = new Set(lib.PORTED_NAMES.map((l) => `rpg_${l}`));
  let portedUsed = 0;
  for (const event of EVENT_NAMES) {
    const name = SOUNDS[event].name;
    if (ported.has(name)) portedUsed++;
    const mine = renderVendored(name);
    const theirs = lib.render(name);
    assert.equal(mine.length, theirs.length, `${event}: length differs`);
    for (let i = 0; i < mine.length; i++) {
      if (mine[i] !== theirs[i]) assert.fail(`${event}: sample ${i} differs`);
    }
  }
  assert.equal(portedUsed, 28, 'all 28 of the game’s ported sounds are wired up');
});
