// Parity between the game's sound events and the 8bit-sfx package.
//
// 8bit-sfx is a dev-only dependency from the npm registry; on a fresh clone
// without `npm install` (or in CI without network access to it) it isn't
// resolvable — skip with a note rather than fail, mirroring the runner's
// toolchain-skip philosophy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_NAMES } from '../src/audio/sfx.js';

let sfx = null;
let manifest = null;
try {
  sfx = await import('8bit-sfx');
  manifest = await sfx.loadManifest();
} catch {
  // not installed — the tests below skip with the reason
}

const skip = manifest === null ? '8bit-sfx not installed (run npm install to enable)' : false;

// As of 8bit-sfx 1.0.0 the whole set ships: the ported game sounds are the
// labeled entries of its `rpg` category. Every game event must be there and
// nothing extra — no pending-port carve-outs.
test('the 8bit-sfx package carries every game sound, exactly', { skip }, () => {
  const ported = new Map(
    manifest.effects.filter((e) => e.category === 'rpg' && e.label).map((e) => [e.label, e])
  );

  for (const name of EVENT_NAMES) {
    const entry = ported.get(name);
    assert.ok(entry, `missing from the 8bit-sfx rpg set: ${name}`);
    assert.ok(entry.duration_s > 0, `zero-length port: ${name}`);
    assert.ok(entry.gain > 0 && entry.gain <= 1, `${name}: implausible relative gain ${entry.gain}`);
  }

  const extra = [...ported.keys()].filter((label) => !EVENT_NAMES.includes(label));
  assert.deepEqual(extra, [], 'the package carries ported sounds this game no longer emits');
  assert.equal(
    ported.size,
    EVENT_NAMES.length,
    'the rpg set and the game SOUNDS table have drifted apart'
  );
});

// 1.0.0 synthesizes on demand rather than shipping audio, so the catalog being
// right is only half the story — the package must actually produce the sound.
test('every game sound synthesizes from the package', { skip }, () => {
  for (const name of EVENT_NAMES) {
    const pcm = sfx.renderPcm(`rpg_${name}`);
    assert.ok(pcm.length > 0, `${name}: synthesized to nothing`);
    assert.ok(
      Math.max(...pcm) - Math.min(...pcm) >= 8,
      `${name}: synthesized to silence`
    );
  }
});
