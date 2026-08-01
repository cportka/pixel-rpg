// Parity between the game's sound events and the 8bit-sfx package's ported set.
//
// 8bit-sfx is a dev-only dependency from the npm registry; on a fresh clone
// without `npm install` (or in CI without network access to it) it isn't
// resolvable — skip with a note rather than fail, mirroring the runner's
// toolchain-skip philosophy.
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

// Sounds added game-side that await the next 8bit-sfx publish. Parity stays
// exact for everything else, in both directions; the assertions below fail
// the moment the pinned package ships one of these, prompting its removal.
const PENDING_PORT = new Set([
  'xp', 'levelup', // added in v0.13.0
  'door', 'clock', // added in v0.14.0 (the mansion)
]);

test(
  'the 8bit-sfx package carries every game sound (minus declared pending), exactly',
  { skip: manifest === null ? '8bit-sfx not installed (run npm install to enable)' : false },
  () => {
    // The ported game sounds live in the package's 'rpg' category (renamed from
    // 'pixelrpg' in 8bit-sfx 0.4.0); they are the entries carrying a label.
    const ported = new Map(
      manifest.effects
        .filter((e) => e.category === 'rpg' && e.label)
        .map((e) => [e.label, e])
    );
    let pendingMissing = 0;
    for (const name of EVENT_NAMES) {
      const entry = ported.get(name);
      if (!entry && PENDING_PORT.has(name)) {
        pendingMissing++;
        continue; // declared: waiting on the next package publish
      }
      assert.ok(entry, `missing from the 8bit-sfx rpg set: ${name}`);
      assert.ok(entry.duration_s > 0, `zero-length port: ${name}`);
      assert.ok(
        !PENDING_PORT.has(name),
        `'${name}' is ported now — remove it from PENDING_PORT`
      );
    }
    for (const name of PENDING_PORT) {
      assert.ok(EVENT_NAMES.includes(name), `stale PENDING_PORT entry: ${name}`);
    }
    assert.equal(
      ported.size,
      EVENT_NAMES.length - pendingMissing,
      'the pixelrpg set and the game SOUNDS table have drifted apart'
    );
  }
);
