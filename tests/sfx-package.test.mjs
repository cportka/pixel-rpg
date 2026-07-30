// Parity between the game's sound events and the 8bit-sfx package's ported set.
//
// 8bit-sfx is a dev-time git dependency; on a fresh clone without `npm install`
// (or in CI without network access to the dep) it isn't resolvable — skip with
// a note rather than fail, mirroring the runner's toolchain-skip philosophy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_NAMES } from '../src/audio/sfx.js';

let manifest = null;
try {
  const sfx = await import('8bit-sfx');
  manifest = await sfx.loadManifest();
} catch {
  // not installed — the test below skips with the reason
}

test(
  'the 8bit-sfx package carries every game sound, exactly',
  { skip: manifest === null ? '8bit-sfx not installed (run npm install to enable)' : false },
  () => {
    const ported = new Map(
      manifest.effects.filter((e) => e.category === 'pixelrpg').map((e) => [e.label, e])
    );
    for (const name of EVENT_NAMES) {
      const entry = ported.get(name);
      assert.ok(entry, `missing from the 8bit-sfx pixelrpg set: ${name}`);
      assert.ok(entry.duration_s > 0, `zero-length port: ${name}`);
    }
    assert.equal(
      ported.size,
      EVENT_NAMES.length,
      'the pixelrpg set and the game SOUNDS table have drifted apart'
    );
  }
);
