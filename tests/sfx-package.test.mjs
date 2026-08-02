// Parity between the game's sounds and the 8bit-sfx package, from both ends.
//
// 8bit-sfx is a dev-only dependency from the npm registry; on a fresh clone
// without `npm install` (or in CI without network access to it) it isn't
// resolvable — skip with a note rather than fail, mirroring the runner's
// toolchain-skip philosophy.
//
// Since v0.16 the game doesn't just *depend* on the library, it *plays* it:
// the site is a no-build static page and cannot import from node_modules at
// runtime, so vendor/8bit-sfx carries a copy of the library's synthesis engine
// (dsp + the ported sounds + the rpg generators). These tests pin that copy to
// the installed package byte-for-byte and pin the rendered audio to what the
// library itself produces, so "the game's sounds" and "the library's sounds"
// cannot become two different things.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { EVENT_NAMES, SOUNDS } from '../src/audio/sfx.js';
import { render as renderVendored } from '../vendor/8bit-sfx/index.js';

const VENDORED = ['dsp.js', 'ported.js', 'generators/rpg.js'];

let sfx = null;
let manifest = null;
let pkgDir = null;
try {
  sfx = await import('8bit-sfx');
  manifest = await sfx.loadManifest();
  const require = createRequire(import.meta.url);
  pkgDir = dirname(require.resolve('8bit-sfx/package.json'));
} catch {
  // not installed — the tests below skip with the reason
}

const skip = manifest === null ? '8bit-sfx not installed (run npm install to enable)' : false;

// The 28 sounds the game had before v0.16 are the labeled entries of the
// package's `rpg` category — its ports of this game's originals. The newer
// cues (battle, turns, spells) draw from the same category's procedural bank
// and so carry no label of their own.
const portedEvents = () => EVENT_NAMES.filter((n) => SOUNDS[n].name === `rpg_${n}`);

test('the 8bit-sfx package carries every ported game sound, exactly', { skip }, () => {
  const ported = new Map(
    manifest.effects.filter((e) => e.category === 'rpg' && e.label).map((e) => [e.label, e])
  );

  for (const name of portedEvents()) {
    const entry = ported.get(name);
    assert.ok(entry, `missing from the 8bit-sfx rpg set: ${name}`);
    assert.ok(entry.duration_s > 0, `zero-length port: ${name}`);
    assert.ok(entry.gain > 0 && entry.gain <= 1, `${name}: implausible relative gain ${entry.gain}`);
  }

  const extra = [...ported.keys()].filter((label) => !EVENT_NAMES.includes(label));
  assert.deepEqual(extra, [], 'the package carries ported sounds this game no longer emits');
  assert.equal(
    ported.size,
    portedEvents().length,
    'the rpg set and the game SOUNDS table have drifted apart'
  );
  assert.equal(ported.size, 28, 'all 28 of the original game sounds are still wired up');
});

// 1.0.0 synthesizes on demand rather than shipping audio, so the catalog being
// right is only half the story — the package must actually produce the sound.
test('every game sound synthesizes from the package', { skip }, () => {
  for (const name of EVENT_NAMES) {
    const pcm = sfx.renderPcm(SOUNDS[name].name);
    assert.ok(pcm.length > 0, `${name}: synthesized to nothing`);
    assert.ok(
      Math.max(...pcm) - Math.min(...pcm) >= 8,
      `${name}: synthesized to silence`
    );
  }
});

test('the vendored engine is byte-identical to the installed package', { skip }, async () => {
  for (const rel of VENDORED) {
    const mine = await readFile(new URL(`../vendor/8bit-sfx/${rel}`, import.meta.url));
    const theirs = await readFile(join(pkgDir, 'src', rel));
    assert.ok(mine.equals(theirs), `vendor/8bit-sfx/${rel} has drifted from the package`);
  }
});

test('the package is the 1.0.0 line, the one that synthesizes', { skip }, async () => {
  const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  assert.equal(pkg.version.split('.')[0], '1', `expected 1.x, got ${pkg.version}`);
});

test('the game plays the library, sample for sample', { skip }, () => {
  for (const event of EVENT_NAMES) {
    const name = SOUNDS[event].name;
    const mine = renderVendored(name);
    const theirs = sfx.render(name);
    assert.equal(mine.length, theirs.length, `${event}: length differs`);
    for (let i = 0; i < mine.length; i++) {
      if (mine[i] !== theirs[i]) assert.fail(`${event}: sample ${i} differs`);
    }
  }
});
